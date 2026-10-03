/**
 * S99 Validate: check every derived file against its schema and enforce the invariants in
 * SPEC section 11. Exits non-zero on any violation.
 */
import fs from "node:fs";
import path from "node:path";
import { files, DERIVED, BRIEFS, RAW } from "./lib/paths";
import { readJson, exists, log, readText } from "./lib/io";
import {
  AtlasSchema,
  PhenotypesFileSchema,
  SimilarityFileSchema,
  LaddersFileSchema,
  TransfersFileSchema,
  InvestigatorsFileSchema,
  OrgsFileSchema,
  EvidenceFileSchema,
  LayoutFileSchema,
  SearchIndexFileSchema,
  DemoCandidatesFileSchema,
  BriefSchema,
  BuildManifestSchema,
  ProbeFileSchema,
  StudiesFileSchema,
  LiteratureFileSchema,
  FundingFileSchema,
  ReconciliationFileSchema,
  ApprovedTherapySeedSchema,
  PatientOrgSeedSchema,
} from "../src/lib/schemas";
import { offsetsMatch } from "../src/lib/quotes";
import { z } from "zod";

const problems: string[] = [];
const warnings: string[] = [];
const fail = (m: string) => problems.push(m);

function check<T>(p: string, schema: z.ZodType<T>, required = true): T | null {
  if (!exists(p)) {
    if (required) fail(`missing required file ${path.relative(process.cwd(), p)}`);
    else warnings.push(`optional file not present: ${path.relative(process.cwd(), p)}`);
    return null;
  }
  const res = schema.safeParse(readJson(p));
  if (!res.success) {
    fail(`${path.relative(process.cwd(), p)} fails schema: ${res.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    return null;
  }
  return res.data;
}

function sourceText(ref: string): string | null {
  const [src, id] = ref.split(":", 2);
  if (src === "ctgov") {
    const p = path.join(RAW, "ctgov", "studies", `${id}.txt`);
    return exists(p) ? readText(p) : null;
  }
  if (src === "pubmed") {
    const p = path.join(RAW, "pubmed", "abstracts", `${id}.txt`);
    return exists(p) ? readText(p) : null;
  }
  return null;
}

function main() {
  check(files.probe, ProbeFileSchema, false);
  const atlas = check(files.atlas, AtlasSchema);
  const ph = check(files.phenotypes, PhenotypesFileSchema);
  const sim = check(files.similarity, SimilarityFileSchema);
  const ladders = check(files.ladders, LaddersFileSchema);
  const transfers = check(files.transfers, TransfersFileSchema);
  const evidence = check(files.evidence, EvidenceFileSchema);
  const investigators = check(files.investigators, InvestigatorsFileSchema, false);
  const orgs = check(files.orgs, OrgsFileSchema, false);
  const layout = check(files.layout, LayoutFileSchema, false);
  check(files.searchIndex, SearchIndexFileSchema);
  const demo = check(files.demoCandidates, DemoCandidatesFileSchema);
  const manifest = check(files.manifest, BuildManifestSchema);
  const studies = check(files.studies, StudiesFileSchema, false);
  check(files.literature, LiteratureFileSchema, false);
  check(files.funding, FundingFileSchema, false);
  check(files.reconciliation, ReconciliationFileSchema, false);
  check(files.seedTherapies, z.array(ApprovedTherapySeedSchema));
  check(files.seedOrgs, z.array(PatientOrgSeedSchema));
  const briefs: z.infer<typeof BriefSchema>[] = [];
  if (fs.existsSync(BRIEFS)) {
    for (const f of fs.readdirSync(BRIEFS).filter((f) => f.endsWith(".json"))) {
      const b = check(path.join(BRIEFS, f), BriefSchema);
      if (b) briefs.push(b);
    }
  }
  if (!atlas || !evidence || !ladders || !transfers || !sim || !ph) return finish();

  const evIds = new Set(Object.keys(evidence));
  const condIds = new Set(atlas.conditions.map((c) => c.id));
  const roadIds = new Set(atlas.roads.map((r) => r.id));
  const has = (id: string) => evIds.has(id);

  // No condition without a road; every condition cites existing evidence.
  for (const c of atlas.conditions) {
    if (!roadIds.has(c.roadId)) fail(`${c.id} has unknown road ${c.roadId}`);
    if (!c.evidenceIds.length || !c.evidenceIds.every(has)) fail(`${c.id} references missing evidence: ${c.evidenceIds.filter((e) => !has(e)).join(",")}`);
    if (c.contested) for (const cl of c.contested.claims) if (!has(cl.evidenceId)) fail(`${c.id} contested claim cites missing evidence ${cl.evidenceId}`);
  }
  // Every neighbor edge references existing evidence.
  for (const [cid, list] of Object.entries(sim.neighbors)) {
    if (!condIds.has(cid)) fail(`similarity has unknown condition ${cid}`);
    for (const n of list) {
      if (!condIds.has(n.id)) fail(`similarity ${cid} -> unknown ${n.id}`);
      if (!n.evidenceIds.length || !n.evidenceIds.every(has)) fail(`edge ${cid} -> ${n.id} cites missing evidence`);
    }
  }
  // Every extracted evidence record has a verbatim quote whose offsets match the cached source text.
  let extracted = 0;
  let extractedChecked = 0;
  for (const ev of Object.values(evidence)) {
    if (ev.kind !== "extracted") continue;
    extracted++;
    if (!ev.quote) {
      fail(`extracted evidence ${ev.id} has no quote`);
      continue;
    }
    const ref = ev.quote.sourceText;
    const text = ref ? sourceText(ref) : null;
    if (!text) {
      warnings.push(`extracted evidence ${ev.id}: cached source text ${ref ?? "(none)"} not available locally; offsets not re-checked`);
      continue;
    }
    extractedChecked++;
    if (!offsetsMatch(ev.quote, text)) fail(`extracted evidence ${ev.id}: quote offsets do not match cached source text`);
  }
  // Ladders: every found milestone has evidence; every not_found lists sources searched.
  for (const [cid, l] of Object.entries(ladders.ladders)) {
    if (!condIds.has(cid)) fail(`ladder for unknown condition ${cid}`);
    for (const m of l.milestones) {
      if (m.status === "found" && (!m.evidenceIds.length || !m.evidenceIds.every(has))) fail(`${cid} milestone ${m.n} found without existing evidence`);
      if (m.status === "not_found" && !m.sourcesSearched.length) fail(`${cid} milestone ${m.n} not_found without sources searched`);
    }
  }
  // Transfers: every verdict cites a rule id and at least one counter-reason, and existing evidence.
  for (const [key, pair] of Object.entries(transfers.pairs)) {
    for (const v of pair.verdicts) {
      if (!/^R[1-7]$/.test(v.ruleId)) fail(`${key} verdict without rule id`);
      if (!v.counterReasons.length) fail(`${key} ${v.ruleId} has no counter-reason`);
      if (!v.evidenceIds.includes(`ev:rule:${v.ruleId}`)) fail(`${key} ${v.ruleId} does not cite its rule evidence`);
      if (!v.evidenceIds.every(has)) fail(`${key} ${v.ruleId} cites missing evidence ${v.evidenceIds.filter((e) => !has(e)).join(",")}`);
      for (const r of v.assetRecords) if (!has(r.evidenceId)) fail(`${key} ${v.ruleId} asset record cites missing evidence ${r.evidenceId}`);
    }
  }
  // Orgs and therapies must have URLs.
  if (orgs) for (const o of Object.values(orgs.orgs)) if (!/^https?:\/\//.test(o.url)) fail(`org ${o.id} without URL`);
  // Studies: evidence exists
  if (studies) for (const s of Object.values(studies.studies)) for (const e of s.evidenceIds) if (!has(e)) fail(`study ${s.id} cites missing evidence ${e}`);
  // Investigators link only to public records with URLs.
  if (investigators) for (const i of Object.values(investigators.investigators)) for (const r of i.records) if (!/^https?:\/\//.test(r.url)) fail(`investigator ${i.id} record without URL`);
  // Briefs: every sentence cites existing evidence.
  for (const b of briefs) for (const s of b.sections) for (const sent of s.sentences) if (!sent.evidenceIds.length || !sent.evidenceIds.every(has)) fail(`brief ${b.focalId}__${b.neighborId}: sentence without existing evidence: "${sent.text.slice(0, 60)}"`);
  // Demo candidates reference known conditions.
  for (const d of demo ?? []) if (!condIds.has(d.conditionId) || !condIds.has(d.neighborId)) fail(`demo candidate references unknown condition`);
  // Layout covers conditions with phenotypes
  if (layout) for (const id of Object.keys(layout.nodes)) if (!condIds.has(id)) fail(`layout has unknown node ${id}`);

  log("validate", `conditions ${atlas.conditions.length}, evidence ${evIds.size}, extracted ${extracted} (offsets re-checked ${extractedChecked}), ladders ${Object.keys(ladders.ladders).length}, transfer pairs ${Object.keys(transfers.pairs).length}, briefs ${briefs.length}, manifest spend $${manifest?.llm.spendUsd.toFixed(3)}`);
  finish();
}

function finish() {
  for (const w of warnings.slice(0, 10)) log("validate", `warning: ${w}`);
  if (warnings.length > 10) log("validate", `... and ${warnings.length - 10} more warnings`);
  if (problems.length) {
    for (const p of problems.slice(0, 30)) log("validate", `FAIL: ${p}`);
    if (problems.length > 30) log("validate", `... and ${problems.length - 30} more`);
    log("validate", `${problems.length} problem(s)`);
    process.exit(1);
  }
  log("validate", "all invariants hold");
}

main();
