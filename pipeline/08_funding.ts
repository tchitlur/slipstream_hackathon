/**
 * S8 Funding and investigators: NIH RePORTER projects (last four fiscal years) by gene symbol
 * and distinctive disease name; Investigator nodes from RePORTER PIs, ClinicalTrials.gov
 * overall officials and last authors of S4 mechanism papers. Names are merged conservatively.
 */
import { parseArgs, deepGenes } from "./lib/args";
import { fetchJsonCached } from "./lib/http";
import { readValidated, readJsonOr, writeJson, log, uniq } from "./lib/io";
import { files } from "./lib/paths";
import { distinctiveNames as diseaseNamesOf } from "./lib/baselineStudies";
import { writeEvidence } from "./lib/evidence";
import { updateManifest } from "./lib/manifest";
import { AtlasSchema, StudiesFileSchema, LiteratureFileSchema, type Grant, type Evidence, type Condition } from "../src/lib/schemas";
import { mergeInvestigators, type RawMention } from "../src/lib/investigators";

const REPORTER = "https://api.reporter.nih.gov/v2/projects/search";
/** A gene-symbol hit counts only when the project is plainly about the gene in a developmental/epilepsy context. */
const CONTEXT = /epilep|seizure|epileptic encephalopath|developmental and epileptic|neurodevelopment|intellectual disab|autis|developmental (delay|disorder|disabilit)|rett syndrome|dravet|angelman|tuberous sclerosis|pitt.hopkins|phelan.mcdermid|kbg syndrome|glut1|infantile spasm|lennox|west syndrome|channelopath|haploinsufficien|rare (genetic |neurological |pediatric )?(disease|disorder)|monogenic|neurogenetic|pathogenic variant|loss.of.function|gain.of.function/i;
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
  // Start from existing grants only for genes not in this run, so a tightened rule actually drops records.
  const runGenes = new Set(genes);
  const grants: Record<string, Grant> = {};
  for (const [id, g] of Object.entries(existing?.grants ?? {})) {
    const gGenes = g.conditionIds.map((cid) => atlas.conditions.find((c) => c.id === cid)?.geneSymbol).filter(Boolean) as string[];
    if (gGenes.some((sym) => !runGenes.has(sym))) grants[id] = g;
  }
  const genesSearched = uniq([...(existing?.genesSearched ?? []), ...genes]);
  const evidence: Evidence[] = [];
  const droppedByRelevance = new Set<string>();

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
        // Gene-symbol queries over abstract text are noisy. Keep a gene-symbol hit only if the symbol is in the title,
        // or the abstract names the symbol and reads as a developmental-disorder / epilepsy project (CONTEXT).
        if (q.text === symbol) {
          const re = new RegExp(`\\b${symbol}\\b`);
          const inTitle = re.test(p.project_title ?? "");
          const mentions = ((p.abstract_text ?? "").match(new RegExp(`\\b${symbol}\\b`, "g")) ?? []).length;
          const context = CONTEXT.test(`${p.project_title ?? ""} ${p.abstract_text ?? ""}`);
          // Keep when the project reads as a developmental-disorder / epilepsy project (CONTEXT) and names the gene in the
          // title or at least twice in the abstract. A title mention alone is not enough: DYRK1A beta-cell and SNAP25
          // vesicle-biology grants name the gene without being about the condition.
          if (!context || !(inTitle || mentions >= 2)) {
            droppedByRelevance.add(coreProjectNumber(p.project_num));
            continue;
          }
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
  // A record "names the condition" when its own text carries a distinctive disease name of one of its conditions (not only
  // the gene symbol); for studies, when the reconciliation layer matched the record to the condition by name.
  const condByIdAll = new Map(atlas.conditions.map((c) => [c.id, c]));
  const namesAny = (text: string, conditionIds: string[]) => conditionIds.some((cid) => { const c = condByIdAll.get(cid); return c ? diseaseNamesOf(c).some((n) => text.toLowerCase().includes(n.toLowerCase())) : false; });
  const recon = readJsonOr<{ decisions: { recordId: string; conditionId: string | null; method: string; source: string }[] } | null>(files.reconciliation, null);
  const studyByName = new Set((recon?.decisions ?? []).filter((d) => d.source === "ctgov" && d.conditionId && d.method !== "none" && d.method !== "gene").map((d) => d.recordId));
  for (const g of Object.values(grants)) for (const pi of g.piNames) raws.push({ name: pi, org: g.organization, record: { kind: "grant", id: g.projectNumber, url: g.url, role: "principal investigator", conditionIds: g.conditionIds, namesCondition: namesAny(`${g.title} ${g.abstractExcerpt ?? ""}`, g.conditionIds) } });
  const studiesFile = readJsonOr<unknown>(files.studies, null);
  if (studiesFile) {
    const st = StudiesFileSchema.parse(studiesFile);
    for (const s of Object.values(st.studies)) {
      if (!s.classification?.aboutCondition) continue;
      for (const o of s.officials) raws.push({ name: o.name, org: o.affiliation, record: { kind: "study", id: s.id, url: `https://clinicaltrials.gov/study/${s.id}`, role: (o.role ?? "overall official").toLowerCase().replace(/_/g, " "), conditionIds: s.conditionIds, namesCondition: studyByName.has(s.id) || namesAny(`${s.briefTitle} ${s.officialTitle ?? ""} ${s.conditions.join(" ")}`, s.conditionIds) } });
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
        raws.push({ name: p.lastAuthor, record: { kind: "paper", id: pmid, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, role: "last author", conditionIds: conds.map((c) => c.id), namesCondition: namesAny(p.title, conds.map((c) => c.id)) } });
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
    m.counts.grantsDroppedByRelevance = [...droppedByRelevance].filter((n) => !grants[`grant:${n}`]).length;
    m.counts.investigators = investigators.length;
    m.counts.investigatorRawMentions = raws.length;
    m.counts.bridges = investigators.filter((i) => i.isBridge).length;
  });
  log("S8", `${[...droppedByRelevance].filter((n) => !grants[`grant:${n}`]).length} gene-symbol hits dropped as not about the condition; ${Object.keys(grants).length} grants; ${investigators.length} investigators from ${raws.length} mentions; ${investigators.filter((i) => i.isBridge).length} bridges`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
