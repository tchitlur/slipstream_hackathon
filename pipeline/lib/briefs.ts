import path from "node:path";
import { readValidated, readJsonOr, writeJson, log } from "./io";
import { files, BRIEFS, TRANSFERS_DIR } from "./paths";
import { readEvidence } from "./evidence";
import { llmStructured, hasKey, confirmModels, BudgetExceeded } from "./llm";
import { updateManifest } from "./manifest";
import { AtlasSchema, SimilarityFileSchema, LaddersFileSchema, DemoCandidatesFileSchema, TransfersFocalFileSchema, OrgsFileSchema, StudiesFileSchema, type Brief } from "../../src/lib/schemas";
import { BriefOutputSchema, T4_SYSTEM, packSummary, groundingCheck, packEvidenceIdSet, templateBrief, type EvidencePack } from "../../src/lib/brief";

export function buildPack(focalId: string, neighborId: string): EvidencePack | null {
  const atlas = readValidated(files.atlas, AtlasSchema);
  const sim = readValidated(files.similarity, SimilarityFileSchema);
  const ladders = readValidated(files.ladders, LaddersFileSchema).ladders;
  const tf = readJsonOr<unknown>(path.join(TRANSFERS_DIR, `${focalId.replace(/^cond:/, "")}.json`), null);
  const transfer = tf ? TransfersFocalFileSchema.parse(tf).pairs[`${focalId}__${neighborId}`] : undefined;
  const focal = atlas.conditions.find((c) => c.id === focalId);
  const neighbor = atlas.conditions.find((c) => c.id === neighborId);
  const edge = sim.neighbors[focalId]?.find((n) => n.id === neighborId);
  if (!focal || !neighbor || !edge || !transfer || !ladders[focalId] || !ladders[neighborId]) return null;
  const orgsRaw = readJsonOr<unknown>(files.orgs, null);
  const orgs = orgsRaw ? Object.values(OrgsFileSchema.parse(orgsRaw).orgs).filter((o) => o.conditionIds.includes(neighborId)) : [];
  const stRaw = readJsonOr<unknown>(files.studies, null);
  const studies = stRaw ? Object.values(StudiesFileSchema.parse(stRaw).studies).filter((s) => s.conditionIds.includes(neighborId)) : [];
  const all = readEvidence();
  const ids = new Set<string>();
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (k === "evidenceIds" && Array.isArray(v)) v.forEach((x) => typeof x === "string" && ids.add(x));
      else if (k === "evidenceId" && typeof v === "string") ids.add(v);
      else if (k === "curatedEvidenceId" && typeof v === "string") ids.add(v);
      else walk(v);
    }
  };
  walk([focal, neighbor, edge, ladders[focalId], ladders[neighborId], transfer, orgs, studies]);
  const evidence: EvidencePack["evidence"] = {};
  for (const id of ids) if (all[id]) evidence[id] = all[id];
  return { focal, neighbor, neighborEdge: edge, focalLadder: ladders[focalId], neighborLadder: ladders[neighborId], transfer, neighborOrgs: orgs, neighborStudies: studies, evidence, cutoffs: { high: sim.cutoffs!.high, medium: sim.cutoffs!.medium } };
}

export async function generateOneBrief(pack: EvidencePack, model: string, stage = "S10"): Promise<Brief> {
  const packIds = packEvidenceIdSet(pack);
  const user = `EVIDENCE PACK\n${packSummary(pack)}`;
  let attempt = 0;
  for (;;) {
    const r = await llmStructured({ task: "T4", stage, model, schema: BriefOutputSchema, schemaName: "brief", system: T4_SYSTEM + (attempt ? "\nYour previous draft had too many sentences without valid evidence ids. Cite ids from the pack on every factual sentence." : ""), user, reasoning: "medium", maxOutputTokens: 3000 });
    const g = groundingCheck(r.data, packIds);
    if (g.total > 0 && g.dropped / g.total <= 0.2) {
      return { focalId: pack.focal.id, neighborId: pack.neighbor.id, generatedAt: new Date().toISOString(), mode: "llm", model, sections: g.sections, glossary: r.data.glossary.slice(0, 6), droppedSentences: g.dropped };
    }
    log(stage, `brief ${pack.focal.geneSymbol}->${pack.neighbor.geneSymbol}: ${g.dropped}/${g.total} sentences failed grounding (attempt ${attempt + 1})`);
    if (attempt >= 1) {
      const t = templateBrief(pack);
      t.droppedSentences = g.dropped;
      return t;
    }
    attempt++;
  }
}

export async function generateBriefs(limit: number) {
  const demo = readValidated(files.demoCandidates, DemoCandidatesFileSchema).slice(0, limit);
  if (!demo.length) {
    log("S10", "no demo candidates; no briefs pre-generated");
    return;
  }
  const models = await confirmModels();
  let llmCount = 0;
  let templateCount = 0;
  for (const d of demo) {
    const pack = buildPack(d.conditionId, d.neighborId);
    if (!pack) {
      log("S10", `no pack for ${d.conditionId} -> ${d.neighborId}`);
      continue;
    }
    const outPath = path.join(BRIEFS, `${d.conditionId.replace(/^cond:/, "")}__${d.neighborId.replace(/^cond:/, "")}.json`);
    let brief: Brief;
    if (!hasKey()) brief = templateBrief(pack);
    else {
      try {
        brief = await generateOneBrief(pack, models.explain);
      } catch (e) {
        log("S10", `${e instanceof BudgetExceeded ? "budget" : "error"}: ${(e as Error).message.slice(0, 120)}; using template`);
        brief = templateBrief(pack);
      }
    }
    if (brief.mode === "llm") llmCount++;
    else templateCount++;
    writeJson(outPath, brief);
    log("S10", `brief ${pack.focal.geneSymbol} -> ${pack.neighbor.geneSymbol}: ${brief.mode}, ${brief.sections.reduce((a, s) => a + s.sentences.length, 0)} sentences, ${brief.droppedSentences} dropped`);
  }
  updateManifest((m) => {
    m.counts.briefsPregenerated = llmCount + templateCount;
    m.counts.briefsLlm = llmCount;
    m.counts.briefsTemplate = templateCount;
  });
}
