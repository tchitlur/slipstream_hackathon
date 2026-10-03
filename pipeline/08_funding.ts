/**
 * S8 Funding and investigators: NIH RePORTER projects (last four fiscal years) by gene symbol
 * and distinctive disease name; Investigator nodes from RePORTER PIs, ClinicalTrials.gov
 * overall officials and last authors of S4 mechanism papers. Names are merged conservatively.
 */
import { parseArgs, deepGenes } from "./lib/args";
import { fetchJsonCached } from "./lib/http";
import { readValidated, readJsonOr, writeJson, log, uniq, slugify } from "./lib/io";
import { files } from "./lib/paths";
import { writeEvidence } from "./lib/evidence";
import { updateManifest } from "./lib/manifest";
import { AtlasSchema, StudiesFileSchema, LiteratureFileSchema, type Grant, type Evidence, type Condition } from "../src/lib/schemas";
import { mergeInvestigators, type RawMention } from "../src/lib/investigators";

const REPORTER = "https://api.reporter.nih.gov/v2/projects/search";
const LIMIT = 50;

function fiscalYears() {
  const d = new Date();
  const fy = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
  return [fy - 3, fy - 2, fy - 1, fy];
}

type RProject = {
  project_num: string;
  project_title: string;
  fiscal_year: number;
  organization?: { org_name?: string };
  principal_investigators?: { profile_id?: number; first_name?: string; last_name?: string; full_name?: string; is_contact_pi?: boolean }[];
  abstract_text?: string;
  project_detail_url?: string;
};

function coreProjectNumber(num: string) {
  // 5R01NS123456-03 -> R01NS123456
  const m = num.match(/^\d?([A-Z]\d{2}[A-Z]{2}\d{6})/);
  return m ? m[1] : num.replace(/-\d+[A-Z0-9]*$/, "");
}

/** Distinctive disease names for RePORTER text search (eponyms and named syndromes only). */
function distinctiveNames(c: Condition): string[] {
  return c.synonyms.filter((n) => /^[A-Z][a-z]+(-[A-Z][a-z]+)*( |-)(syndrome|disease)/.test(n) || /syndrome$/.test(n) && /^[A-Z][a-z]+ [A-Z]?[a-z]*/.test(n)).filter((n) => !/^(epilepsy|intellectual|neurodevelopmental|developmental)/i.test(n)).slice(0, 2);
}

async function main() {
  const args = parseArgs();
  const atlas = readValidated(files.atlas, AtlasSchema);
  const genes = deepGenes(args).filter((g) => atlas.genes.some((x) => x.symbol === g));
  const condsByGene = new Map<string, Condition[]>();
  for (const c of atlas.conditions) if (c.depth === "deep") (condsByGene.get(c.geneSymbol) ?? condsByGene.set(c.geneSymbol, []).get(c.geneSymbol)!).push(c);
  const fys = fiscalYears();
  const existing = readJsonOr<{ genesSearched?: string[]; grants: Record<string, Grant> } | null>(files.funding, null);
  const grants: Record<string, Grant> = { ...(existing?.grants ?? {}) };
  const genesSearched = uniq([...(existing?.genesSearched ?? []), ...genes]);
  const evidence: Evidence[] = [];

  for (const symbol of genes) {
    const conds = condsByGene.get(symbol) ?? [];
    if (!conds.length) continue;
    const queries: { text: string; conditionIds: string[] }[] = [{ text: symbol, conditionIds: conds.map((c) => c.id) }];
    for (const c of conds) for (const n of distinctiveNames(c)) queries.push({ text: n, conditionIds: [c.id] });
    let n = 0;
    for (const q of queries) {
      const body = { criteria: { advanced_text_search: { operator: "and", search_field: "projecttitle,abstracttext,terms", search_text: q.text }, fiscal_years: fys }, include_fields: ["ProjectNum", "ProjectTitle", "FiscalYear", "PrincipalInvestigators", "Organization", "AbstractText", "ProjectDetailUrl"], offset: 0, limit: LIMIT, sort_field: "fiscal_year", sort_order: "desc" };
      let res;
      try {
        res = await fetchJsonCached<{ results: RProject[]; meta: { total: number } }>(REPORTER, { method: "POST", body, cacheDir: "reporter", cacheKey: `${q.text}_${fys[0]}-${fys[3]}`, gzip: true });
      } catch (e) {
        log("S8", `RePORTER query failed (${q.text}): ${(e as Error).message.slice(0, 120)}`);
        continue;
      }
      for (const p of res.data.results ?? []) {
        // Gene-symbol queries over abstract text are noisy: require the symbol as a whole word in title or abstract.
        if (q.text === symbol) {
          const re = new RegExp(`\\b${symbol}\\b`);
          if (!re.test(p.project_title ?? "") && !re.test(p.abstract_text ?? "")) continue;
        }
        const core = coreProjectNumber(p.project_num);
        const id = `grant:${core}`;
        const url = p.project_detail_url ?? `https://reporter.nih.gov/project-details/${p.project_num}`;
        const g: Grant = grants[id] ?? { id, projectNumber: core, title: p.project_title, fiscalYears: [], organization: p.organization?.org_name, piNames: [], abstractExcerpt: (p.abstract_text ?? "").replace(/\s+/g, " ").slice(0, 400), conditionIds: [], queryTerms: [], evidenceIds: [`ev:reporter:${core}`], url };
        g.fiscalYears = uniq([...g.fiscalYears, p.fiscal_year]).sort();
        g.piNames = uniq([...g.piNames, ...(p.principal_investigators ?? []).map((pi) => pi.full_name?.replace(/\s+/g, " ").trim() || `${pi.first_name ?? ""} ${pi.last_name ?? ""}`.trim())]).filter(Boolean);
        g.conditionIds = uniq([...g.conditionIds, ...q.conditionIds]);
        g.queryTerms = uniq([...g.queryTerms, q.text]);
        grants[id] = g;
        n++;
      }
    }
    log("S8", `${symbol}: ${queries.length} queries, ${n} project-year rows`);
  }
  const retrievedAt = new Date().toISOString().slice(0, 10);
  for (const g of Object.values(grants)) {
    evidence.push({
      id: `ev:reporter:${g.projectNumber}`,
      kind: "curated",
      source: "reporter",
      sourceId: g.projectNumber,
      url: g.url,
      retrievedAt,
      confidence: "high",
      title: `${g.projectNumber}: ${g.title}`,
      note: `NIH RePORTER project, fiscal years ${g.fiscalYears.join(", ")}${g.organization ? ", " + g.organization : ""}. PI: ${g.piNames.join("; ") || "not listed"}. Matched on: ${g.queryTerms.join(", ")}.`,
    });
  }

  // Investigators
  const raws: RawMention[] = [];
  for (const g of Object.values(grants)) for (const pi of g.piNames) raws.push({ name: pi, org: g.organization, record: { kind: "grant", id: g.projectNumber, url: g.url, role: "principal investigator", conditionIds: g.conditionIds } });
  const studiesFile = readJsonOr<unknown>(files.studies, null);
  if (studiesFile) {
    const st = StudiesFileSchema.parse(studiesFile);
    for (const s of Object.values(st.studies)) {
      if (!s.classification?.aboutCondition) continue;
      for (const o of s.officials) raws.push({ name: o.name, org: o.affiliation, record: { kind: "study", id: s.id, url: `https://clinicaltrials.gov/study/${s.id}`, role: (o.role ?? "overall official").toLowerCase().replace(/_/g, " "), conditionIds: s.conditionIds } });
    }
  }
  const litFile = readJsonOr<unknown>(files.literature, null);
  if (litFile) {
    const lit = LiteratureFileSchema.parse(litFile);
    for (const [symbol, g] of Object.entries(lit.byGene)) {
      const conds = condsByGene.get(symbol) ?? [];
      for (const pmid of g.mechanismPmids) {
        const p = lit.papers[pmid];
        if (!p?.lastAuthor) continue;
        raws.push({ name: p.lastAuthor, record: { kind: "paper", id: pmid, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, role: "last author", conditionIds: conds.map((c) => c.id) } });
      }
    }
  }
  const investigators = mergeInvestigators(raws);
  const condById = new Map(atlas.conditions.map((c) => [c.id, c]));
  for (const inv of investigators) {
    inv.roadIds = uniq(inv.conditionIds.map((cid) => condById.get(cid)?.roadId).filter(Boolean) as string[]);
    inv.clusterIds = uniq(inv.conditionIds.map((cid) => condById.get(cid)?.clusterId).filter(Boolean) as string[]);
    const geneCount = uniq(inv.conditionIds.map((cid) => condById.get(cid)?.geneId).filter(Boolean)).length;
    inv.isBridge = geneCount >= 2 && (inv.roadIds.length >= 2 || inv.clusterIds.length >= 2);
    inv.bridgeReason = inv.isBridge ? (inv.roadIds.length >= 2 ? `linked to conditions on ${inv.roadIds.length} different roads` : `linked to conditions in ${inv.clusterIds.length} different clusters`) : undefined;
  }

  writeJson(files.funding, { genesSearched, grants }, { pretty: false });
  writeJson(files.investigators, { investigators: Object.fromEntries(investigators.map((i) => [i.id, i])) }, { pretty: false });
  writeEvidence(["ev:reporter:"], evidence);
  updateManifest((m) => {
    m.sources.reporter = { url: REPORTER, version: `FY${fys[0]}-${fys[3]}`, retrievedAt: new Date().toISOString() };
    m.counts.grants = Object.keys(grants).length;
    m.counts.investigators = investigators.length;
    m.counts.investigatorRawMentions = raws.length;
    m.counts.bridges = investigators.filter((i) => i.isBridge).length;
  });
  log("S8", `${Object.keys(grants).length} grants; ${investigators.length} investigators from ${raws.length} mentions; ${investigators.filter((i) => i.isBridge).length} bridges`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
