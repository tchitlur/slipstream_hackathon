/**
 * S9 Analytics: readiness ladders, neighbor relations, transfer verdicts with counter-reasons,
 * Louvain clusters and a force layout, bridges and demo candidates (SPEC section 9).
 */
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { readValidated, readJsonOr, writeJson, log, uniq } from "./lib/io";
import { files } from "./lib/paths";
import { writeEvidence, readEvidence } from "./lib/evidence";
import { updateManifest } from "./lib/manifest";
import {
  AtlasSchema,
  PhenotypesFileSchema,
  SimilarityFileSchema,
  StudiesFileSchema,
  OrgsFileSchema,
  FundingFileSchema,
  LiteratureFileSchema,
  InvestigatorsFileSchema,
  ApprovedTherapySeedSchema,
  type Condition,
  type Ladder,
  type Evidence,
  type TransferPair,
  type TransferVerdict,
  type CounterCode,
  type Neighbor,
  type Cluster,
  type Study,
} from "../src/lib/schemas";
import { computeLadder, aheadOn, isUsableStudyStatus, MILESTONES } from "../src/lib/ladder";
import { mechanismRelation } from "../src/lib/roads";
import { RULES, COUNTER_PRIORITY, ALWAYS_C2, COUNTER_REASONS, type RuleContext } from "../src/lib/transferRules";
import { closureOf } from "../src/lib/similarity";
import { z } from "zod";

const LOW_INFO_SHARE_C1 = 0.8;

function fiscalYearNow() {
  const d = new Date();
  return d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
}

async function main() {
  const atlas = readValidated(files.atlas, AtlasSchema);
  const ph = readValidated(files.phenotypes, PhenotypesFileSchema);
  const sim = readValidated(files.similarity, SimilarityFileSchema);
  const studiesFile = readJsonOr<z.infer<typeof StudiesFileSchema> | null>(files.studies, null);
  const studiesParsed = studiesFile ? StudiesFileSchema.parse(studiesFile) : { genesSearched: [], studies: {} };
  const orgsFile = readJsonOr<z.infer<typeof OrgsFileSchema> | null>(files.orgs, null);
  const orgs = orgsFile ? Object.values(OrgsFileSchema.parse(orgsFile).orgs) : [];
  const fundingFile = readJsonOr<z.infer<typeof FundingFileSchema> | null>(files.funding, null);
  const funding = fundingFile ? FundingFileSchema.parse(fundingFile) : null;
  const litFile = readJsonOr<z.infer<typeof LiteratureFileSchema> | null>(files.literature, null);
  const lit = litFile ? LiteratureFileSchema.parse(litFile) : null;
  const invFile = readJsonOr<z.infer<typeof InvestigatorsFileSchema> | null>(files.investigators, null);
  const investigators = invFile ? Object.values(InvestigatorsFileSchema.parse(invFile).investigators) : [];
  const approvedSeed = z.array(ApprovedTherapySeedSchema).parse(readJsonOr(files.seedTherapies, []));
  const evidenceAll = readEvidence();

  const condById = new Map(atlas.conditions.map((c) => [c.id, c]));
  const studies = Object.values(studiesParsed.studies);
  const studiesByCond = new Map<string, Study[]>();
  for (const s of studies) for (const cid of s.conditionIds) (studiesByCond.get(cid) ?? studiesByCond.set(cid, []).get(cid)!).push(s);
  const grants = funding ? Object.values(funding.grants) : [];
  const fy = fiscalYearNow();

  // Approved therapies evidence (seed)
  const newEvidence: Evidence[] = [];
  const approvedByCond = new Map<string, { therapy: string; regulator: string; evidenceId: string; verified: boolean }[]>();
  approvedSeed.forEach((a, i) => {
    const target = atlas.conditions.filter((c) => c.id === a.condition || c.geneSymbol === a.condition.toUpperCase() || c.name === a.condition);
    const evId = `ev:seed:therapy:${i}`;
    newEvidence.push({ id: evId, kind: "curated", source: "seed", sourceId: `approved_therapies[${i}]`, url: a.url, retrievedAt: atlas.builtAt.slice(0, 10), confidence: a.verified ? "high" : "low", title: `${a.therapy} (${a.regulator})`, note: a.verified ? "Hand-verified seed entry." : "Unverified seed entry: a human must confirm against the regulator page." });
    for (const c of target) (approvedByCond.get(c.id) ?? approvedByCond.set(c.id, []).get(c.id)!).push({ therapy: a.therapy, regulator: a.regulator, evidenceId: evId, verified: a.verified });
  });

  // ---- Ladders
  const ladders: Record<string, Ladder> = {};
  for (const c of atlas.conditions) {
    const geneSearchedStudies = studiesParsed.genesSearched.includes(c.geneSymbol);
    const geneSearchedGrants = Boolean(funding && funding.genesSearched.includes(c.geneSymbol));
    const litEntry = lit?.byGene[c.geneSymbol];
    const models = litEntry ? { count: litEntry.modelCount, topPmids: litEntry.modelTopPmids, evidenceId: `ev:pubmed:models:${c.geneSymbol}` } : undefined;
    ladders[c.id] = {
      conditionId: c.id,
      milestones: computeLadder({
        condition: c,
        studies: studiesByCond.get(c.id) ?? [],
        orgs,
        grants,
        models: litEntry ? models : undefined,
        approved: approvedByCond.get(c.id) ?? [],
        searched: { studies: geneSearchedStudies, orgs: Boolean(orgsFile) && c.depth === "deep", grants: geneSearchedGrants, literature: Boolean(litEntry), approved: c.depth === "deep" },
        currentFiscalYear: fy,
      }),
    };
  }

  // ---- Neighbors: relation, aheadOn, shared investigators
  const invByCond = new Map<string, string[]>();
  for (const inv of investigators) for (const cid of inv.conditionIds) (invByCond.get(cid) ?? invByCond.set(cid, []).get(cid)!).push(inv.id);
  for (const [cid, list] of Object.entries(sim.neighbors)) {
    const focal = condById.get(cid)!;
    for (const n of list) {
      const other = condById.get(n.id)!;
      n.relation = mechanismRelation(focal, other);
      n.aheadOn = aheadOn(ladders[cid].milestones, ladders[n.id].milestones);
      const shared = (invByCond.get(cid) ?? []).filter((i) => (invByCond.get(n.id) ?? []).includes(i));
      n.sharedInvestigatorIds = shared;
      n.band = n.similarity >= sim.cutoffs!.high ? "high" : n.similarity >= sim.cutoffs!.medium ? "medium" : "low";
    }
  }

  // ---- Transfers for deep focal conditions
  const pairs: Record<string, TransferPair> = {};
  const counterCounts: Record<string, number> = {};
  const verdictCounts: Record<string, number> = {};
  const ruleEvidence: Evidence[] = RULES.map((r) => ({
    id: `ev:rule:${r.id}`,
    kind: "hypothesis",
    source: "rule",
    sourceId: r.id,
    url: `/method#${r.id}`,
    retrievedAt: atlas.builtAt.slice(0, 10),
    confidence: "low",
    title: `Transfer rule ${r.id}: ${r.asset}`,
    note: r.logic,
  }));
  for (const focal of atlas.conditions.filter((c) => c.depth === "deep")) {
    for (const n of sim.neighbors[focal.id] ?? []) {
      const nb = condById.get(n.id)!;
      const nbStudies = studiesByCond.get(nb.id) ?? [];
      const nbTargeted = nbStudies.filter((s) => s.classification?.aboutCondition && s.classification.role === "interventional_targeted");
      const nbRegistry = nbStudies.filter((s) => s.classification?.aboutCondition && (s.classification.role === "natural_history" || s.classification.role === "registry"));
      const nbOrgs = orgs.filter((o) => o.conditionIds.includes(nb.id));
      const nbLadder = ladders[nb.id].milestones;
      const ctx: RuleContext = {
        simBand: n.band ?? "low",
        relation: n.relation ?? "unknown",
        sharedInvestigator: (n.sharedInvestigatorIds ?? []).length > 0,
        neighborModalities: uniq(nbTargeted.map((s) => s.classification!.modality).filter((m) => m !== "none" && m !== "unclear")),
      };
      const verdicts: TransferVerdict[] = [];
      for (const rule of RULES) {
        const res = rule.apply(ctx);
        // Applicable counter-reasons
        const applicable: { code: CounterCode; text: string; evidenceIds: string[] }[] = [];
        const add = (code: CounterCode, text: string, evidenceIds: string[] = []) => {
          if (!applicable.some((a) => a.code === code)) applicable.push({ code, text, evidenceIds });
        };
        const mechRule = ALWAYS_C2.includes(rule.id);
        if (focal.contested || nb.contested) add("C3", `${focal.contested ? focal.name : nb.name}: curated mechanism and verified published claims disagree.`, [...(focal.contested?.claims.map((c) => c.evidenceId) ?? []), ...(nb.contested?.claims.map((c) => c.evidenceId) ?? [])]);
        if (mechRule) add("C2", "Mechanism is recorded per gene and disease. This family's variant may act differently; confirm its class (loss, gain, dominant negative) with a clinical geneticist before acting on this verdict.", [focal.evidenceIds[0]]);
        if (mechRule && (focal.mechanismSupport === "inferred" || nb.mechanismSupport === "inferred")) add("C4", `The curated mechanism for ${[focal, nb].filter((c) => c.mechanismSupport === "inferred").map((c) => c.geneSymbol).join(" and ")} is inferred from variant types, not from functional evidence.`, [focal.evidenceIds[0], nb.evidenceIds[0]]);
        if (focal.allelicClass !== nb.allelicClass) add("C5", `Allelic requirement differs: ${focal.allelicRequirementRaw.replace(/_/g, " ")} versus ${nb.allelicRequirementRaw.replace(/_/g, " ")}.`, [focal.evidenceIds[0], nb.evidenceIds[0]]);
        if (focal.thinAnnotation || nb.thinAnnotation) add("C6", `${[focal, nb].filter((c) => c.thinAnnotation).map((c) => `${c.name} has ${c.phenotypeMatch.termCount} annotated phenotypes`).join("; ")}, so the similarity value is unreliable.`, n.evidenceIds);
        if (n.lowInfoShare >= LOW_INFO_SHARE_C1) add("C1", `${Math.round(n.lowInfoShare * 100)}% of the shared phenotype weight comes from common, low-information terms (below the median information content).`, n.evidenceIds);
        const assetStudies = rule.id === "R1" || rule.id === "R2" ? nbRegistry : ["R4", "R6", "R7"].includes(rule.id) ? nbTargeted : [];
        if (assetStudies.length === 1 || (assetStudies.length > 0 && assetStudies.every((s) => !isUsableStudyStatus(s.status) || s.status === "NOT_YET_RECRUITING"))) {
          const s0 = assetStudies[0];
          add("C7", assetStudies.length === 1 ? `This asset rests on a single study (${s0.id}, status ${s0.status.toLowerCase().replace(/_/g, " ")}).` : `All supporting studies are ${s0.status.toLowerCase().replace(/_/g, " ")}.`, assetStudies.flatMap((s) => s.evidenceIds));
        }
        if (rule.id === "R3" && nbOrgs.some((o) => !o.verified)) add("C8", `The organization listing for ${nb.name} is unverified.`, nbOrgs.flatMap((o) => o.evidenceIds));
        if (!applicable.length) add("C2", "Even where phenotypes match closely, mechanism is recorded per gene and disease; an individual's variant may act differently. Confirm the variant class with a clinical geneticist.", [focal.evidenceIds[0]]);
        const order = COUNTER_PRIORITY[rule.id];
        applicable.sort((a, b) => (order.indexOf(a.code) === -1 ? 99 : order.indexOf(a.code)) - (order.indexOf(b.code) === -1 ? 99 : order.indexOf(b.code)));

        const assetRecords: TransferVerdict["assetRecords"] = [];
        const pushStudy = (s: Study) => assetRecords.push({ label: `${s.id}: ${s.briefTitle}`, url: `https://clinicaltrials.gov/study/${s.id}`, evidenceId: s.evidenceIds[0] });
        if (rule.id === "R1" || rule.id === "R2") {
          nbRegistry.forEach(pushStudy);
          for (const o of nbOrgs.filter((o) => o.registry === "yes")) assetRecords.push({ label: `${o.name} (registry stated on site)`, url: o.registryUrl ?? o.url, evidenceId: o.evidenceIds[0] });
        }
        if (rule.id === "R3") {
          for (const invId of (n.sharedInvestigatorIds ?? []).slice(0, 5)) {
            const inv = investigators.find((i) => i.id === invId)!;
            assetRecords.push({ label: `${inv.displayName} (works on both)`, url: inv.records[0]?.url ?? "/method", evidenceId: inv.records[0] ? `ev:${inv.records[0].kind === "grant" ? "reporter" : inv.records[0].kind === "study" ? "ctgov" : "pubmed"}:${inv.records[0].id}${inv.records[0].kind === "study" ? ":role" : ""}` : "ev:rule:R3" });
          }
          for (const o of nbOrgs) assetRecords.push({ label: o.name, url: o.url, evidenceId: o.evidenceIds[0] });
          for (const s of [...nbTargeted, ...nbRegistry].slice(0, 4)) pushStudy(s);
        }
        if (rule.id === "R4" || rule.id === "R6" || rule.id === "R7") nbTargeted.forEach(pushStudy);
        if (rule.id === "R5" && lit?.byGene[nb.geneSymbol]?.modelCount) assetRecords.push({ label: `${lit.byGene[nb.geneSymbol].modelCount} disease-model papers for ${nb.geneSymbol}`, url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(lit.byGene[nb.geneSymbol].modelQuery)}`, evidenceId: `ev:pubmed:models:${nb.geneSymbol}` });
        // Only keep records whose evidence exists.
        const validRecords = assetRecords.filter((r) => evidenceAll[r.evidenceId] || newEvidence.some((e) => e.id === r.evidenceId) || ruleEvidence.some((e) => e.id === r.evidenceId));

        const evIds = uniq([`ev:rule:${rule.id}`, ...n.evidenceIds, ...validRecords.map((r) => r.evidenceId)]);
        verdicts.push({ ruleId: rule.id, asset: rule.asset, verdict: res.verdict, reason: res.reason, assetRecords: validRecords, counterReasons: applicable, evidenceIds: evIds, warning: Boolean(res.warning) });
        for (const a of applicable) counterCounts[a.code] = (counterCounts[a.code] ?? 0) + 1;
        verdictCounts[res.verdict ?? "none"] = (verdictCounts[res.verdict ?? "none"] ?? 0) + 1;
      }
      const fired = uniq(verdicts.flatMap((v) => v.counterReasons.map((c) => c.code)));
      const expertQuestions = fired.map((code) => expertQuestion(code, focal, nb)).filter(Boolean) as string[];
      pairs[`${focal.id}__${nb.id}`] = { focalId: focal.id, neighborId: nb.id, verdicts, expertQuestions };
    }
  }

  // ---- Clusters and layout over all conditions with phenotype sets
  const graph = new Graph({ type: "undirected" });
  const withPh = atlas.conditions.filter((c) => (ph.conditionTerms[c.id] ?? []).length > 0);
  for (const c of withPh) graph.addNode(c.id);
  const edgeT = sim.cutoffs!.edge;
  const edges: [string, string, number][] = [];
  for (const [cid, list] of Object.entries(sim.neighbors)) {
    for (const n of list) {
      if (n.similarity < edgeT || !graph.hasNode(cid) || !graph.hasNode(n.id)) continue;
      if (!graph.hasEdge(cid, n.id)) {
        graph.addEdge(cid, n.id, { weight: n.similarity });
        edges.push([cid, n.id, n.similarity]);
      }
    }
  }
  let clusters: Cluster[] = [];
  if (graph.order > 0) {
    const communities = louvain(graph, { resolution: 1, rng: seeded(42) }) as Record<string, number>;
    const byComm = new Map<number, string[]>();
    for (const [node, comm] of Object.entries(communities)) (byComm.get(comm) ?? byComm.set(comm, []).get(comm)!).push(node);
    const sortedComms = [...byComm.entries()].sort((a, b) => b[1].length - a[1].length);
    clusters = sortedComms.map(([, members], i) => {
      const id = `cluster:${i + 1}`;
      // Label by most informative shared phenotypes: share of members whose closure has the term, weighted by IC.
      const termShare = new Map<string, number>();
      for (const m of members) for (const t of closureOf(ph.conditionTerms[m] ?? [], (x) => ph.terms[x]?.parents ?? [])) termShare.set(t, (termShare.get(t) ?? 0) + 1);
      const scored = [...termShare.entries()]
        .map(([t, n]) => ({ id: t, label: ph.terms[t]?.label ?? t, ic: ph.terms[t]?.ic ?? 0, share: n / members.length }))
        .filter((x) => x.share >= 0.5)
        .sort((a, b) => b.share * b.ic - a.share * a.ic)
        .slice(0, 5);
      for (const m of members) condById.get(m)!.clusterId = id;
      return { id, label: scored.slice(0, 3).map((s) => s.label).join(" · ") || `Cluster ${i + 1}`, memberIds: members, topPhenotypes: scored };
    });
    // Layout
    const rng = seeded(7);
    graph.forEachNode((n) => {
      graph.setNodeAttribute(n, "x", rng() * 100);
      graph.setNodeAttribute(n, "y", rng() * 100);
    });
    const positions = forceAtlas2(graph, { iterations: 400, settings: { gravity: 1, scalingRatio: 10, barnesHutOptimize: graph.order > 300, slowDown: 2 } });
    // Place isolated (no-phenotype) conditions on a ring outside.
    const nodes: Record<string, { x: number; y: number }> = {};
    for (const [id, p] of Object.entries(positions)) nodes[id] = { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) };
    writeJson(files.layout, { nodes, edges, threshold: edgeT }, { pretty: false });
  }
  atlas.clusters = clusters;

  // ---- Bridges (investigators spanning roads or clusters) are computed in S8; refresh cluster ids here.
  if (investigators.length) {
    for (const inv of investigators) {
      inv.clusterIds = uniq(inv.conditionIds.map((cid) => condById.get(cid)?.clusterId).filter(Boolean) as string[]);
      inv.roadIds = uniq(inv.conditionIds.map((cid) => condById.get(cid)?.roadId).filter(Boolean) as string[]);
      inv.isBridge = inv.conditionIds.length >= 2 && (inv.roadIds.length >= 2 || inv.clusterIds.length >= 2);
      inv.bridgeReason = inv.isBridge ? (inv.roadIds.length >= 2 ? `linked to conditions on ${inv.roadIds.length} different roads` : `linked to conditions in ${inv.clusterIds.length} different clusters`) : undefined;
    }
    writeJson(files.investigators, { investigators: Object.fromEntries(investigators.map((i) => [i.id, i])) }, { pretty: false });
  }

  // ---- Demo candidates (section 9.6)
  const demo: { conditionId: string; neighborId: string; counterexampleId?: string; score: number; reason: string }[] = [];
  for (const c of atlas.conditions.filter((c) => c.depth === "deep")) {
    const L = ladders[c.id].milestones;
    const lacking = [4, 5, 6, 7].filter((n) => L[n - 1].status === "not_found");
    const ns = (sim.neighbors[c.id] ?? []).filter((n) => !n.sameGene);
    const sameRoad = ns.filter((n) => n.relation === "same road" && n.band === "high" && (n.aheadOn ?? []).filter((m) => m >= 4 && m <= 7).length >= 2).sort((a, b) => (b.aheadOn!.length - a.aheadOn!.length) || b.similarity - a.similarity);
    const opposite = ns.find((n) => n.relation === "opposite direction" && n.band === "high");
    if (!sameRoad.length) continue;
    const best = sameRoad[0];
    const score = lacking.length * 2 + best.aheadOn!.length * 2 + (opposite ? 3 : 0) + best.similarity;
    const nb = condById.get(best.id)!;
    demo.push({
      conditionId: c.id,
      neighborId: best.id,
      counterexampleId: opposite?.id,
      score: Number(score.toFixed(2)),
      reason: `${c.geneSymbol} lacks ${lacking.length} of milestones 4-7; ${nb.geneSymbol} (same road, similarity ${best.similarity}) is ahead on ${best.aheadOn!.map((m) => MILESTONES[m - 1].short).join(", ")}${opposite ? `; ${condById.get(opposite.id)!.geneSymbol} is a high-similarity neighbor in the opposite direction` : "; no opposite-direction counterexample above the high cutoff"}.`,
    });
  }
  demo.sort((a, b) => b.score - a.score);
  writeJson(files.demoCandidates, demo.slice(0, 10));

  writeJson(files.ladders, { ladders }, { pretty: false });
  writeJson(files.similarity, sim, { pretty: false });
  writeJson(files.transfers, { cutoffs: { high: sim.cutoffs!.high, medium: sim.cutoffs!.medium }, pairs }, { pretty: false });
  writeJson(files.atlas, atlas, { pretty: false });
  writeEvidence(["ev:rule:R", "ev:seed:therapy:"], [...ruleEvidence, ...newEvidence]);
  const found = Object.values(ladders).filter((l) => l.conditionId && condById.get(l.conditionId)!.depth === "deep");
  const perMilestone = MILESTONES.map((m) => found.filter((l) => l.milestones[m.n - 1].status === "found").length);
  updateManifest((m) => {
    m.counts.ladders = Object.keys(ladders).length;
    m.counts.transferPairs = Object.keys(pairs).length;
    m.counts.transferVerdicts = Object.values(pairs).reduce((a, p) => a + p.verdicts.length, 0);
    m.counts.verdictDoNotTransfer = verdictCounts.do_not_transfer ?? 0;
    m.counts.verdictTransferable = verdictCounts.transferable ?? 0;
    m.counts.verdictNeedsExpertReview = verdictCounts.needs_expert_review ?? 0;
    m.counts.clusters = clusters.length;
    m.counts.layoutEdges = edges.length;
    m.counts.demoCandidates = demo.length;
    m.counts.contestedMechanisms = atlas.conditions.filter((c) => c.contested).length;
    m.counts.bridges = investigators.filter((i) => i.isBridge).length;
    m.thresholds.lowInfoShareC1 = LOW_INFO_SHARE_C1;
    MILESTONES.forEach((ms, i) => (m.counts[`milestone${ms.n}_found_deep`] = perMilestone[i]));
  });
  log("S9", `ladders ${Object.keys(ladders).length}; deep found per milestone ${JSON.stringify(perMilestone)}`);
  log("S9", `transfers: ${Object.keys(pairs).length} pairs, verdicts ${JSON.stringify(verdictCounts)}, counter-reasons ${JSON.stringify(counterCounts)}`);
  log("S9", `clusters ${clusters.length}: ${clusters.map((c) => `${c.memberIds.length}[${c.label}]`).join(" | ")}`);
  log("S9", `demo candidates: ${demo.slice(0, 5).map((d) => `${condById.get(d.conditionId)!.geneSymbol}->${condById.get(d.neighborId)!.geneSymbol}(${d.score})`).join(", ")}`);
}

function expertQuestion(code: CounterCode, focal: Condition, nb: Condition): string | null {
  switch (code) {
    case "C1":
      return `Does the overlap between ${focal.geneSymbol} and ${nb.geneSymbol} go beyond common features such as seizures and developmental delay, in your clinical experience?`;
    case "C2":
      return `Has our child's specific ${focal.geneSymbol} variant been functionally classified (loss of function, gain of function or dominant negative), and does it match the mechanism recorded for the condition?`;
    case "C3":
      return `Published claims disagree with the curated mechanism for ${focal.contested ? focal.geneSymbol : nb.geneSymbol}. Which direction do you consider established, and on what evidence?`;
    case "C4":
      return `The curated mechanism is inferred from variant types rather than functional studies. What functional evidence exists for ${focal.geneSymbol}?`;
    case "C5":
      return `The two conditions differ in how many gene copies are affected. Does that change which strategies could apply to ${focal.geneSymbol}?`;
    case "C6":
      return `One of the conditions has very few recorded phenotypes. What features of ${focal.geneSymbol} are missing from the annotation that would change the comparison?`;
    case "C7":
      return `The neighbor's asset rests on a single or inactive study. Is there other work on ${nb.geneSymbol} that we should know about?`;
    case "C8":
      return `Is the patient organization listed for ${nb.geneSymbol} the right contact, and does it run a registry?`;
    default:
      return null;
  }
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
