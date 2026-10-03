/**
 * S5 Studies: query ClinicalTrials.gov v2 for each deep-slice gene by distinctive disease
 * names (query.cond) and by gene symbol (query.term), deduplicate by NCT ID, classify each
 * study with LLM task T2, verify quotes verbatim, and discard studies not about the condition.
 */
import path from "node:path";
import { z } from "zod";
import { parseArgs, deepGenes } from "./lib/args";
import { fetchJsonCached } from "./lib/http";
import { readValidated, readJsonOr, writeJson, writeText, log, uniq } from "./lib/io";
import { files, RAW } from "./lib/paths";
import { writeEvidence } from "./lib/evidence";
import { updateManifest } from "./lib/manifest";
import { llmStructured, mapLimit, hasKey, confirmModels, estimateUsd, approxTokens, readLedger, BUDGET_USD } from "./lib/llm";
import { AtlasSchema, StudyRole, StudyModality, type Study, type Evidence, type Condition } from "../src/lib/schemas";
import { verifyQuote } from "../src/lib/quotes";

const FIELDS = [
  "NCTId",
  "BriefTitle",
  "OfficialTitle",
  "OverallStatus",
  "StudyType",
  "Phase",
  "Condition",
  "InterventionName",
  "InterventionType",
  "BriefSummary",
  "EligibilityCriteria",
  "LeadSponsorName",
  "OverallOfficialName",
  "OverallOfficialAffiliation",
  "OverallOfficialRole",
  "StartDate",
  "EnrollmentCount",
].join(",");
const PAGE = 50;
const MAX_PAGES = 2;
const MAX_PER_GENE = 30;
const ELIG_CHARS = 2200;
const SUMMARY_CHARS = 1200;

type RawStudy = {
  protocolSection: {
    identificationModule: { nctId: string; briefTitle?: string; officialTitle?: string };
    statusModule?: { overallStatus?: string; startDateStruct?: { date?: string } };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
    descriptionModule?: { briefSummary?: string };
    conditionsModule?: { conditions?: string[] };
    designModule?: { studyType?: string; phases?: string[]; enrollmentInfo?: { count?: number } };
    armsInterventionsModule?: { interventions?: { type?: string; name?: string }[] };
    eligibilityModule?: { eligibilityCriteria?: string };
    contactsLocationsModule?: { overallOfficials?: { name?: string; affiliation?: string; role?: string }[] };
  };
};

/** Deterministic text block used both in the T2 prompt and for quote verification. */
export function studyText(s: Omit<Study, "hits" | "conditionIds" | "classification" | "evidenceIds" | "retrievedAt"> & { briefSummary?: string; eligibility?: string }) {
  return [
    `Title: ${s.briefTitle}`,
    s.officialTitle ? `Official title: ${s.officialTitle}` : "",
    `Status: ${s.status}. Type: ${s.studyType}. Phases: ${s.phases.join(", ") || "none"}.`,
    `Conditions: ${s.conditions.join("; ")}`,
    `Interventions: ${s.interventions.map((i) => `${i.name} (${i.type})`).join("; ") || "none"}`,
    `Summary: ${(s.briefSummary ?? "").slice(0, SUMMARY_CHARS)}`,
    `Eligibility: ${(s.eligibility ?? "").slice(0, ELIG_CHARS)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Disease names distinctive enough to send to query.cond (proper nouns, numbered OMIM entries, eponyms). */
function distinctiveNames(c: Condition, hpoNames: string[]): string[] {
  const out = new Set<string>();
  const candidates = [...c.synonyms, ...hpoNames];
  for (const n of candidates) {
    const words = n.split(/\s+/);
    const hasProper = words.some((w, i) => i > 0 && /^[A-Z][a-z]+/.test(w) && !/^(Of|And|With|The|Type)$/.test(w));
    const hasEponymStart = /^[A-Z][a-z]+(-[A-Z][a-z]+)+ /.test(n) || /^(Rett|Dravet|Angelman|Pitt-Hopkins|Glass|KBG|Temple-Baraitser|Cornelia|Phelan|West|Ohtahara|Lennox|Doose|Landau)/.test(n);
    const hasNumber = /\b\d+[A-Z]?\b/.test(n) && /encephalopathy|disorder|syndrome/i.test(n);
    const generic = /^(epilepsy|epileptic encephalopathy|seizure disorders|intellectual disability|intellectual developmental disorder|autism|neurodevelopmental disorder|syndrome|focal epilepsy|childhood absence epilepsy|juvenile myoclonic epilepsy)$/i.test(n.trim());
    if (!generic && (hasProper || hasEponymStart || hasNumber) && n.length <= 90) out.add(n);
  }
  return [...out].slice(0, 6);
}

const T2Schema = z.object({
  aboutCondition: z.boolean().describe("True if the study is about one or more of the listed candidate conditions (not merely a gene panel or a broad epilepsy study that lists the gene)."),
  matchedConditionIds: z.array(z.string()).describe("IDs of the candidate conditions this study is about. Empty if none."),
  role: StudyRole,
  modality: StudyModality,
  excludesMechanism: z.string().nullable().describe("If eligibility text excludes a variant class or mechanism (e.g. gain-of-function variants), name it in a few words. Otherwise null."),
  excludesQuote: z.string().nullable().describe("Verbatim sentence from the study text that states the exclusion, copied exactly. Null if none."),
  quote: z.string().describe("One verbatim sentence copied exactly from the study text that best supports the role classification."),
});

const T2_SYSTEM = `You classify ClinicalTrials.gov records for a rare-disease research atlas. Be literal and conservative.
Definitions:
- aboutCondition: the study is specifically about one of the candidate conditions (the disease caused by the named gene). Studies that list the gene only inside a long gene panel, or that are about epilepsy in general and merely mention the gene, are NOT about the condition.
- role: natural_history = observational study following the course of the disease; registry = patient registry or biobank; interventional_targeted = an intervention that addresses the genetic cause (e.g. antisense oligonucleotide, gene therapy, gene editing, enzyme replacement for the defective enzyme, a drug chosen because of the gene's mechanism); interventional_symptomatic = an intervention for symptoms (e.g. a broad anti-seizure drug, diet, device, behavioral therapy); other = anything else (surveys, biomarker, imaging, caregiver studies).
- modality: the type of the main intervention. "none" for non-interventional studies.
- excludesMechanism: fill only when the eligibility text explicitly excludes a class of variants or a mechanism (for example "gain-of-function variants are excluded"). Otherwise null.
- quote and excludesQuote must be copied verbatim from the study text given, character for character. Never paraphrase. If no suitable sentence exists, copy the title.
Return JSON only.`;

async function main() {
  const args = parseArgs();
  const atlas = readValidated(files.atlas, AtlasSchema);
  const genes = deepGenes(args).filter((g) => atlas.genes.some((x) => x.symbol === g));
  const condsByGene = new Map<string, Condition[]>();
  for (const c of atlas.conditions) if (c.depth === "deep") (condsByGene.get(c.geneSymbol) ?? condsByGene.set(c.geneSymbol, []).get(c.geneSymbol)!).push(c);

  const existing = readJsonOr<{ genesSearched?: string[]; studies: Record<string, Study> }>(files.studies, { studies: {} });
  const genesSearched = uniq([...(existing.genesSearched ?? []), ...genes]);
  const studies: Record<string, Study> = { ...existing.studies };
  const rawById = new Map<string, { raw: RawStudy; retrievedAt: string }>();
  const hitsById = new Map<string, Study["hits"]>();

  for (const symbol of genes) {
    const conds = condsByGene.get(symbol) ?? [];
    if (!conds.length) continue;
    const gene = atlas.genes.find((g) => g.symbol === symbol)!;
    const queries: { via: "cond" | "term"; q: string; conditionIds: string[] }[] = [];
    queries.push({ via: "term", q: symbol, conditionIds: conds.map((c) => c.id) });
    queries.push({ via: "cond", q: symbol, conditionIds: conds.map((c) => c.id) });
    for (const c of conds) for (const n of distinctiveNames(c, [])) queries.push({ via: "cond", q: n, conditionIds: [c.id] });
    for (const n of distinctiveNames(conds[0], gene.hpoDiseaseNames.map((d) => d.name))) if (!queries.some((q) => q.q === n)) queries.push({ via: "cond", q: n, conditionIds: conds.map((c) => c.id) });

    let geneHits = 0;
    for (const q of queries) {
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams({ [q.via === "cond" ? "query.cond" : "query.term"]: q.q, pageSize: String(PAGE), fields: FIELDS, countTotal: "true" });
        if (pageToken) params.set("pageToken", pageToken);
        const url = `https://clinicaltrials.gov/api/v2/studies?${params}`;
        let res;
        try {
          res = await fetchJsonCached<{ studies: RawStudy[]; nextPageToken?: string; totalCount?: number }>(url, { cacheDir: "ctgov/queries", cacheKey: `${q.via}:${q.q}:p${page}`, gzip: true });
        } catch (e) {
          log("S5", `query failed (${q.via}=${q.q}): ${(e as Error).message.slice(0, 120)}`);
          break;
        }
        for (const s of res.data.studies ?? []) {
          const id = s.protocolSection.identificationModule.nctId;
          if (!rawById.has(id)) rawById.set(id, { raw: s, retrievedAt: res.retrievedAt });
          const hits = hitsById.get(id) ?? hitsById.set(id, []).get(id)!;
          for (const cid of q.conditionIds) if (!hits.some((h) => h.conditionId === cid && h.via === q.via && h.query === q.q)) hits.push({ conditionId: cid, via: q.via, query: q.q });
          geneHits++;
        }
        pageToken = res.data.nextPageToken;
        if (!pageToken) break;
      }
    }
    log("S5", `${symbol}: ${queries.length} queries, ${geneHits} hits`);
  }

  // Normalize and cap per gene (prefer interventional, then most recent).
  const normalized = new Map<string, Study & { text: string }>();
  for (const [id, { raw, retrievedAt }] of rawById) {
    const p = raw.protocolSection;
    const base = {
      id,
      briefTitle: p.identificationModule.briefTitle ?? "",
      officialTitle: p.identificationModule.officialTitle,
      status: p.statusModule?.overallStatus ?? "UNKNOWN",
      studyType: p.designModule?.studyType ?? "UNKNOWN",
      phases: p.designModule?.phases ?? [],
      conditions: p.conditionsModule?.conditions ?? [],
      interventions: (p.armsInterventionsModule?.interventions ?? []).map((i) => ({ name: i.name ?? "", type: i.type ?? "" })),
      sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name,
      officials: (p.contactsLocationsModule?.overallOfficials ?? []).map((o) => ({ name: o.name ?? "", affiliation: o.affiliation, role: o.role })).filter((o) => o.name),
      startDate: p.statusModule?.startDateStruct?.date,
      enrollment: p.designModule?.enrollmentInfo?.count,
      eligibilityExcerpt: (p.eligibilityModule?.eligibilityCriteria ?? "").replace(/\s+/g, " ").trim().slice(0, 700) || undefined,
    };
    const text = studyText({ ...base, briefSummary: p.descriptionModule?.briefSummary, eligibility: p.eligibilityModule?.eligibilityCriteria });
    const hits = hitsById.get(id) ?? [];
    normalized.set(id, { ...base, hits, conditionIds: [], evidenceIds: [], retrievedAt, text });
    writeText(path.join(RAW, "ctgov", "studies", `${id}.txt`), text);
  }
  const perGene = new Map<string, (Study & { text: string })[]>();
  for (const s of normalized.values()) {
    const symbols = uniq(s.hits.map((h) => atlas.conditions.find((c) => c.id === h.conditionId)?.geneSymbol ?? ""));
    for (const sym of symbols) (perGene.get(sym) ?? perGene.set(sym, []).get(sym)!).push(s);
  }
  const selected = new Map<string, Study & { text: string }>();
  for (const [sym, list] of perGene) {
    const scored = list
      .map((s) => ({ s, score: (s.studyType === "INTERVENTIONAL" ? 2 : s.studyType === "OBSERVATIONAL" ? 1 : 0) + (s.hits.some((h) => h.via === "cond") ? 1 : 0) + (s.conditions.some((c) => c.toUpperCase().includes(sym)) ? 1 : 0) }))
      .sort((a, b) => b.score - a.score || (b.s.startDate ?? "").localeCompare(a.s.startDate ?? ""));
    for (const { s } of scored.slice(0, MAX_PER_GENE)) selected.set(s.id, s);
    if (list.length > MAX_PER_GENE) log("S5", `${sym}: ${list.length} candidate studies, keeping ${MAX_PER_GENE}`);
  }
  log("S5", `${normalized.size} unique studies retrieved; ${selected.size} selected for classification`);

  // T2 classification
  const models = await confirmModels();
  const toClassify = [...selected.values()].filter((s) => !studies[s.id]?.classification);
  const estIn = toClassify.reduce((a, s) => a + approxTokens(T2_SYSTEM + s.text) + 200, 0);
  const est = estimateUsd(models.extract, estIn, toClassify.length * 220);
  log("S5", `T2: ${toClassify.length} studies to classify on ${models.extract}; estimated $${est.toFixed(2)} (ledger $${readLedger().totalUsd.toFixed(2)}, cap $${BUDGET_USD})`);
  let discardedQuotes = 0;
  let verifiedQuotes = 0;
  if (!hasKey()) {
    log("S5", "WARNING: OPENAI_API_KEY not set; studies kept unclassified");
  } else {
    await mapLimit(toClassify, 4, async (s) => {
      const candidates = uniq(s.hits.map((h) => h.conditionId)).map((cid) => atlas.conditions.find((c) => c.id === cid)!);
      const user = `Candidate conditions:\n${candidates.map((c) => `- ${c.id}: ${c.name} (gene ${c.geneSymbol}; mechanism: ${c.mechanism}; ${c.allelicRequirementRaw}${c.synonyms.length ? "; also called " + c.synonyms.slice(0, 2).join(", ") : ""})`).join("\n")}\n\nStudy text:\n${s.text}`;
      const r = await llmStructured({ task: "T2", stage: "S5", model: models.extract, schema: T2Schema, schemaName: "study_classification", system: T2_SYSTEM, user, reasoning: "low", maxOutputTokens: 500 });
      const q = verifyQuote(r.data.quote, s.text);
      const eq = r.data.excludesQuote ? verifyQuote(r.data.excludesQuote, s.text) : null;
      if (!q) discardedQuotes++;
      else verifiedQuotes++;
      if (r.data.excludesQuote && !eq) discardedQuotes++;
      else if (eq) verifiedQuotes++;
      const matched = r.data.matchedConditionIds.filter((id) => candidates.some((c) => c.id === id));
      studies[s.id] = {
        ...s,
        text: undefined,
        conditionIds: r.data.aboutCondition ? (matched.length ? matched : candidates.map((c) => c.id)) : [],
        classification: {
          aboutCondition: r.data.aboutCondition,
          role: r.data.role,
          modality: r.data.modality,
          excludesMechanism: eq && r.data.excludesMechanism ? r.data.excludesMechanism : undefined,
          quote: q ? q.text : "",
          quoteVerified: Boolean(q),
          excludesQuote: eq ? eq.text : undefined,
          excludesQuoteVerified: eq ? true : r.data.excludesQuote ? false : undefined,
        },
        evidenceIds: [],
      } as Study;
    });
  }

  // Build evidence for studies about a condition with a verified quote.
  const evidence: Evidence[] = [];
  const kept: Record<string, Study> = {};
  for (const s of Object.values(studies)) {
    if (!s.classification) {
      kept[s.id] = { ...s, evidenceIds: [] };
      continue;
    }
    if (!s.classification.aboutCondition) continue; // discarded: not about the condition
    const text = normalized.get(s.id)?.text;
    const q = text ? verifyQuote(s.classification.quote, text) : null;
    const url = `https://clinicaltrials.gov/study/${s.id}`;
    const ids: string[] = [];
    if (q) {
      const ev: Evidence = {
        id: `ev:ctgov:${s.id}:role`,
        kind: "extracted",
        source: "ctgov",
        sourceId: s.id,
        url,
        retrievedAt: s.retrievedAt.slice(0, 10),
        quote: { ...q, sourceText: `ctgov:${s.id}` },
        confidence: s.status === "WITHDRAWN" || s.status === "TERMINATED" ? "low" : "medium",
        title: `${s.id}: ${s.briefTitle}`,
        note: `Classified as ${s.classification.role.replace(/_/g, " ")}${s.classification.modality !== "none" ? ", modality " + s.classification.modality.replace(/_/g, " ") : ""}; status ${s.status}${s.phases.length ? ", phase " + s.phases.join("/") : ""}. A study existing is not evidence that a therapy works.`,
      };
      evidence.push(ev);
      ids.push(ev.id);
    } else {
      // Quote failed verification: keep the curated-record facts only, with a computed record and no quote.
      evidence.push({
        id: `ev:ctgov:${s.id}:record`,
        kind: "curated",
        source: "ctgov",
        sourceId: s.id,
        url,
        retrievedAt: s.retrievedAt.slice(0, 10),
        confidence: "medium",
        title: `${s.id}: ${s.briefTitle}`,
        note: `ClinicalTrials.gov record (status ${s.status}, type ${s.studyType}). The classifier's supporting quote could not be verified verbatim, so the classification is shown with low confidence.`,
      });
      ids.push(`ev:ctgov:${s.id}:record`);
    }
    if (s.classification.excludesQuote && s.classification.excludesQuoteVerified && text) {
      const eq = verifyQuote(s.classification.excludesQuote, text);
      if (eq) {
        evidence.push({
          id: `ev:ctgov:${s.id}:excludes`,
          kind: "extracted",
          source: "ctgov",
          sourceId: s.id,
          url,
          retrievedAt: s.retrievedAt.slice(0, 10),
          quote: { ...eq, sourceText: `ctgov:${s.id}` },
          confidence: "high",
          title: `${s.id}: eligibility excludes ${s.classification.excludesMechanism}`,
          note: "Eligibility text that excludes a variant class: direct evidence that mechanism direction governs who a therapy fits.",
        });
        ids.push(`ev:ctgov:${s.id}:excludes`);
      }
    }
    kept[s.id] = { ...s, evidenceIds: ids };
  }
  writeJson(files.studies, { genesSearched, studies: kept }, { pretty: false });
  writeEvidence(["ev:ctgov:"], evidence);
  const about = Object.values(kept).filter((s) => s.classification?.aboutCondition);
  const roles: Record<string, number> = {};
  for (const s of about) roles[s.classification!.role] = (roles[s.classification!.role] ?? 0) + 1;
  const excludes = about.filter((s) => s.classification?.excludesMechanism);
  updateManifest((m) => {
    m.sources.ctgov = { url: "https://clinicaltrials.gov/api/v2/studies", retrievedAt: new Date().toISOString() };
    m.counts.studiesRetrieved = normalized.size;
    m.counts.studiesClassified = Object.values(kept).filter((s) => s.classification).length;
    m.counts.studiesAboutCondition = about.length;
    m.counts.studiesDiscardedNotAbout = Object.values(studies).filter((s) => s.classification && !s.classification.aboutCondition).length;
    m.counts.studiesWithMechanismExclusion = excludes.length;
    m.counts.t2QuotesVerified = (m.counts.t2QuotesVerified ?? 0) + verifiedQuotes;
    m.counts.t2QuotesDiscarded = (m.counts.t2QuotesDiscarded ?? 0) + discardedQuotes;
    m.thresholds.studiesMaxPerGene = MAX_PER_GENE;
    const l = readLedger();
    m.llm.spendUsd = l.totalUsd;
    m.llm.byStage = Object.fromEntries(Object.entries(l.byStage).map(([k, v]) => [k, { calls: v.calls, inputTokens: v.inputTokens, outputTokens: v.outputTokens, usd: v.usd }]));
    m.llm.models = l.models;
  });
  log("S5", `about condition: ${about.length}; roles ${JSON.stringify(roles)}; mechanism exclusions: ${excludes.length}; quotes verified ${verifiedQuotes}, discarded ${discardedQuotes}; spend $${readLedger().totalUsd.toFixed(3)}`);
  for (const s of excludes) log("S5", `  exclusion: ${s.id} ${s.classification!.excludesMechanism} :: ${s.classification!.excludesQuote?.slice(0, 120)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
