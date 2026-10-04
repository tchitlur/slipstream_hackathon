/**
 * S9 Analytics: readiness ladders, neighbor relations, transfer verdicts with counter-reasons,
 * Louvain clusters and a force layout, bridges and demo candidates (SPEC section 9).
 */
import fs from "node:fs";
import path from "node:path";
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { readValidated, readJsonOr, writeJson, log, uniq } from "./lib/io";
import { files, TRANSFERS_DIR } from "./lib/paths";
import { readAllNeighbors, writeSimilarity } from "./lib/similarityStore";
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
  type Cluster,
  type Study,
  type PatientOrg,
  BaselineFileSchema,
  RegistriesFileSchema,
} from "../src/lib/schemas";
import { computeLadder, aheadOn, isUsableStudyStatus, MILESTONES } from "../src/lib/ladder";
import { mechanismRelation } from "../src/lib/roads";
import { RULES, COUNTER_PRIORITY, ALWAYS_C2, type RuleContext } from "../src/lib/transferRules";
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
  const simIndex = readValidated(files.similarity, SimilarityFileSchema);
  const sim = { cutoffs: simIndex.cutoffs, neighbors: readAllNeighbors() };
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
  const regRaw = readJsonOr<unknown>(files.registries, null);
  const registries = regRaw ? Object.values(RegistriesFileSchema.parse(regRaw).registries) : [];
  const evidenceAll = readEvidence();

  const condById = new Map(atlas.conditions.map((c) => [c.id, c]));
  const studies = Object.values(studiesParsed.studies);
  const studiesByCond = new Map<string, Study[]>();
  for (const s of studies) for (const cid of s.conditionIds) (studiesByCond.get(cid) ?? studiesByCond.set(cid, []).get(cid)!).push(s);
  const grants = funding ? Object.values(funding.grants) : [];
  // "Current" fiscal year = the latest one present in RePORTER data (a new FY starts 1 October before records exist).
  const fy = grants.length ? Math.min(fiscalYearNow(), Math.max(...grants.flatMap((g) => g.fiscalYears))) : fiscalYearNow();

  // Approved therapies evidence (seed)
  const newEvidence: Evidence[] = [];
  const approvedByCond = new Map<string, { therapy: string; regulator: string; evidenceId: string; verified: boolean; targets?: "gene_product" | "pathway" | "symptomatic_or_unknown"; conditionName?: string }[]>();
  approvedSeed.forEach((a, i) => {
    const target = atlas.conditions.filter((c) => c.id === a.condition || c.geneSymbol === a.condition.toUpperCase() || c.name === a.condition);
    const evId = `ev:seed:therapy:${i}`;
    const targetLabel = a.targets === "gene_product" ? "acts on the gene or its product" : a.targets === "pathway" ? "acts on a downstream pathway" : "treats symptoms or mechanism not established";
    newEvidence.push({
      id: evId,
      kind: "curated",
      source: "seed",
      sourceId: `${a.source ?? a.regulator}: ${a.therapy}`,
      url: a.url,
      retrievedAt: a.check?.date ?? atlas.builtAt.slice(0, 10),
      confidence: a.verified ? "high" : a.check?.status === "auto" ? "medium" : "low",
      title: `${a.therapy}, ${a.regulator}${a.approvalYear ? " " + a.approvalYear : ""}: ${targetLabel}`,
      quote: a.indicationQuote ? { text: a.indicationQuote, start: 0, end: a.indicationQuote.length } : undefined,
      note: `${a.verified ? "Human-verified" : a.check?.status === "auto" ? `Automatically checked on ${a.check.date} against the regulator page` : "Unverified"}. Indication names ${a.conditionName ?? a.condition}. ${a.targetsNote ?? ""} Approval is not evidence of benefit for any individual.`,
    });
    for (const c of target) (approvedByCond.get(c.id) ?? approvedByCond.set(c.id, []).get(c.id)!).push({ therapy: `${a.therapy} (${targetLabel})`, regulator: a.regulator, evidenceId: evId, verified: a.verified, targets: a.targets, conditionName: a.conditionName });
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
        registries,
        grants,
        models: litEntry ? models : undefined,
        approved: approvedByCond.get(c.id) ?? [],
        searched: { studies: geneSearchedStudies, orgs: Boolean(orgsFile) && c.depth === "deep", grants: geneSearchedGrants, literature: Boolean(litEntry), approved: c.depth === "deep" },
        currentFiscalYear: fy,
      }),
    };
  }

  // ---- 10x baseline (ITEM 5): organization founding year paired with the earliest registry / natural history study start.
  writeJson(files.baseline, computeBaseline(orgs, studies), { pretty: true });

  // ---- Neighbors: relation, aheadOn, shared investigators
  const invByCond = new Map<string, string[]>();
  for (const inv of investigators) for (const cid of inv.conditionIds) (invByCond.get(cid) ?? invByCond.set(cid, []).get(cid)!).push(inv.id);
  for (const [cid, list] of Object.entries(sim.neighbors)) {
    const focal = condById.get(cid)!;
    for (const n of list) {
      const other = condById.get(n.id)!;
      n.relation = mechanismRelation(focal, other);
      n.curatedRelation = mechanismRelation(focal, other, { ignoreContested: true });
      n.aheadOn = aheadOn(ladders[cid].milestones, ladders[n.id].milestones);
      const shared = (invByCond.get(cid) ?? []).filter((i) => (invByCond.get(n.id) ?? []).includes(i));
      n.sharedInvestigatorIds = shared;
      n.band = n.similarity >= sim.cutoffs.high ? "high" : n.similarity >= sim.cutoffs.medium ? "medium" : "low";
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
      const ctx: RuleContext = {
        simBand: n.band ?? "low",
        relation: n.relation ?? "unknown",
        curatedRelation: n.curatedRelation ?? n.relation ?? "unknown",
        contestedSide: [focal, nb].filter((c) => c.contested).map((c) => c.geneSymbol).join(" and "),
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
        if (focal.contested || nb.contested) {
          const flagged = [focal, nb].filter((c) => c.contested);
          const text = flagged.map((c) => (c.contested!.kind === "both_directions" ? `${c.geneSymbol}: published cases document variants acting in more than one direction; the curated direction is not the only one seen in patients, so which applies depends on the individual variant.` : c.contested!.kind === "different_mechanism" ? `${c.geneSymbol}: a different mechanism (dominant negative) is also reported for some variants alongside the curated loss of function; which applies depends on the individual variant.` : `${c.geneSymbol}: published claims dispute the curated direction for the same class of variants.`)).join(" ");
          add("C3", text, flagged.flatMap((c) => c.contested!.claims.map((x) => x.evidenceId)));
        }
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
        if (rule.id === "R3" && nbOrgs.some((o) => !o.verified)) add("C8", nbOrgs.some((o) => o.check?.status === "auto") ? `The organization listing for ${nb.name} passed only an automated check of its own site on ${nbOrgs.find((o) => o.check?.status === "auto")!.check!.date}; no human has verified it.` : `The organization listing for ${nb.name} has not been checked.`, nbOrgs.flatMap((o) => o.evidenceIds));
        if (!applicable.length) add("C2", "Even where phenotypes match closely, mechanism is recorded per gene and disease; an individual's variant may act differently. Confirm the variant class with a clinical geneticist.", [focal.evidenceIds[0]]);
        const order = COUNTER_PRIORITY[rule.id];
        applicable.sort((a, b) => (order.indexOf(a.code) === -1 ? 99 : order.indexOf(a.code)) - (order.indexOf(b.code) === -1 ? 99 : order.indexOf(b.code)));

        const assetRecords: TransferVerdict["assetRecords"] = [];
        const pushStudy = (s: Study) => assetRecords.push({ label: `${s.id}: ${s.briefTitle}`, url: `https://clinicaltrials.gov/study/${s.id}`, evidenceId: s.evidenceIds[0] });
        const nbRegs = registries.filter((r) => r.conditionIds.includes(nb.id));
        if (rule.id === "R1" || rule.id === "R2") {
          nbRegistry.forEach(pushStudy);
          for (const o of nbOrgs.filter((o) => o.registry === "yes")) assetRecords.push({ label: `${o.name} (registry stated on site)`, url: o.registryUrl ?? o.url, evidenceId: o.evidenceIds[0] });
          for (const r of nbRegs) assetRecords.push({ label: r.kind === "shared_registry" ? `${r.name} (shared multi-gene registry that includes ${nb.geneSymbol}; its data items and consent are reusable)` : `${r.name} (${r.kind.replace(/_/g, " ")}, outside ClinicalTrials.gov)`, url: r.url, evidenceId: r.evidenceIds[0] });
        }
        if (rule.id === "R3") for (const r of nbRegs.filter((r) => r.kind === "shared_registry")) assetRecords.push({ label: `${r.name} (shared registry; a route to the same clinical network)`, url: r.url, evidenceId: r.evidenceIds[0] });
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
  const edgeT = sim.cutoffs.edge;
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
    // Isolated nodes are laid out on a ring around the connected component layout.
    const isolated = graph.nodes().filter((n) => graph.degree(n) === 0);
    for (const n of isolated) graph.dropNode(n);
    const positions = graph.order > 0 ? forceAtlas2(graph, { iterations: 800, settings: { gravity: 0.05, scalingRatio: 150, strongGravityMode: false, barnesHutOptimize: graph.order > 300, slowDown: 3, adjustSizes: false, outboundAttractionDistribution: true, linLogMode: true, edgeWeightInfluence: 1 } }) : {};
    const nodes: Record<string, { x: number; y: number }> = {};
    const xs = Object.values(positions).map((p) => p.x);
    const ys = Object.values(positions).map((p) => p.y);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    const cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    const radius = xs.length ? Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.55 + 10 : 50;
    for (const [id, p] of Object.entries(positions)) nodes[id] = { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) };
    isolated.forEach((id, i) => {
      const a = (2 * Math.PI * i) / Math.max(1, isolated.length);
      nodes[id] = { x: Number((cx + radius * Math.cos(a)).toFixed(2)), y: Number((cy + radius * Math.sin(a)).toFixed(2)) };
    });
    writeJson(files.layout, { nodes, edges, threshold: edgeT }, { pretty: false });
  }
  atlas.clusters = clusters;

  // ---- Bridges (investigators spanning roads or clusters) are computed in S8; refresh cluster ids here.
  if (investigators.length) {
    for (const inv of investigators) {
      inv.clusterIds = uniq(inv.conditionIds.map((cid) => condById.get(cid)?.clusterId).filter(Boolean) as string[]);
      inv.roadIds = uniq(inv.conditionIds.map((cid) => condById.get(cid)?.roadId).filter(Boolean) as string[]);
      const geneCount = uniq(inv.conditionIds.map((cid) => condById.get(cid)?.geneId).filter(Boolean)).length;
      inv.isBridge = geneCount >= 2 && (inv.roadIds.length >= 2 || inv.clusterIds.length >= 2);
      inv.bridgeReason = inv.isBridge ? (inv.roadIds.length >= 2 ? `linked to conditions on ${inv.roadIds.length} different roads` : `linked to conditions in ${inv.clusterIds.length} different clusters`) : undefined;
    }
    writeJson(files.investigators, { investigators: Object.fromEntries(investigators.map((i) => [i.id, i])) }, { pretty: false });
  }

  // ---- Demo candidates (section 9.6; criteria set by the human on 2026-10-04, second revision):
  // focal: deep, severe childhood onset (epilepsy/encephalopathy terms in name or phenotypes), organization passed the
  // automated check, mechanism not strictly contested, never KCNC1/EEF1A2/SCN8A/PCDH19;
  // community ahead: same road, high similarity, ahead on a gene-level targeted trial (milestone 7 "found"); a
  // "both directions" flag on the neighbor is allowed and a plus when its trial eligibility excludes a variant class;
  // counterexample: high similarity on a different road (opposite direction or different road), preferring a same-gene
  // pair where the curated source has two conditions with different mechanisms;
  // the main pair's shared phenotypes must not be dominated by common terms (C1 must not fire).
  const demo: { conditionId: string; neighborId: string; counterexampleId?: string; score: number; reason: string; tier: number; alternativeNeighborIds: string[] }[] = [];
  const studiesWithExclusion = new Set(studies.filter((s) => s.classification?.excludesMechanism).flatMap((s) => s.conditionIds));
  // "Severe, childhood onset": the curated name says encephalopathy or spasms, or the phenotype set carries
  // encephalopathy, infantile/epileptic spasms, severe or profound developmental delay or intellectual disability,
  // or status epilepticus. A plain "epilepsy" (e.g. GEFS+) does not qualify.
  const severeName = /encephalopath|infantile spasm|epileptic spasm/i;
  const severeTerms = /encephalopath|infantile spasms|epileptic spasm|severe global developmental delay|profound global developmental delay|intellectual disability, severe|intellectual disability, profound|status epilepticus/i;
  const EXCLUDED = new Set(["KCNC1", "EEF1A2", "SCN8A", "PCDH19"]);
  for (const c of atlas.conditions.filter((c) => c.depth === "deep")) {
    if (EXCLUDED.has(c.geneSymbol)) continue;
    const L = ladders[c.id].milestones;
    const lacking = [4, 5, 6, 7].filter((n) => L[n - 1].status !== "found");
    const orgOk = orgs.some((o) => o.conditionIds.includes(c.id) && (o.verified || o.check?.status === "auto"));
    const strictlyContested = c.contested?.kind === "contested";
    const terms = (ph.conditionTerms[c.id] ?? []).map((t) => ph.terms[t]?.label ?? "").join(" ");
    const onsetOk = severeName.test(c.name) || severeTerms.test(terms);
    const ns = sim.neighbors[c.id] ?? [];
    const ahead = ns
      .filter((n) => !n.sameGene && n.relation === "same road" && n.band === "high" && (n.aheadOn ?? []).includes(7) && ladders[n.id].milestones[6].status === "found" && condById.get(n.id)!.contested?.kind !== "contested" && n.lowInfoShare < LOW_INFO_SHARE_C1)
      .sort((a, b) => Number(studiesWithExclusion.has(b.id)) - Number(studiesWithExclusion.has(a.id)) || (b.aheadOn!.length - a.aheadOn!.length) || b.similarity - a.similarity);
    // Counterexample preference: a same-gene pair with two curated mechanisms, then a deep-slice neighbor (full ladder
    // and borrow view), then opposite direction over merely different road, then similarity.
    const counter = ns
      .filter((n) => n.band === "high" && (n.relation === "opposite direction" || n.relation === "different road"))
      .sort((a, b) => Number(Boolean(b.sameGene)) - Number(Boolean(a.sameGene)) || Number(condById.get(b.id)!.depth === "deep") - Number(condById.get(a.id)!.depth === "deep") || Number(b.relation === "opposite direction") - Number(a.relation === "opposite direction") || b.similarity - a.similarity)[0];
    if (!ahead.length || !onsetOk || strictlyContested) continue;
    const best = ahead[0];
    const nb = condById.get(best.id)!;
    // Tier 1: all criteria. Tier 2: no organization passed the check. Tier 3: no high-similarity counterexample on a different road.
    const tier = !orgOk ? 2 : !counter ? 3 : 1;
    // Opposite direction is what makes R4 a "do not transfer" card (a different road only gives expert review on R4),
    // so it scores higher; a deep-slice counterexample has a full ladder and borrow view.
    const score = (studiesWithExclusion.has(best.id) ? 3 : 0) + best.aheadOn!.length * 2 + lacking.length + best.similarity + (counter?.similarity ?? 0) + (counter?.sameGene ? 2 : 0) + (counter?.relation === "opposite direction" ? 3 : 0) + (counter && condById.get(counter.id)!.depth === "deep" ? 1 : 0);
    const caveats = [!orgOk ? "no organization passed the automated check" : "", !counter ? "no high-similarity neighbor on a different road" : "", c.contested ? `focal mechanism flag: ${c.contested.kind.replace(/_/g, " ")}` : ""].filter(Boolean);
    demo.push({
      conditionId: c.id,
      neighborId: best.id,
      counterexampleId: counter?.id,
      score: Number(score.toFixed(2)),
      tier,
      alternativeNeighborIds: ahead.slice(1, 6).map((n) => n.id),
      reason: `${c.geneSymbol} (${c.mechanism}) lacks ${lacking.length} of milestones 4-7; ${nb.geneSymbol} (same road, similarity ${best.similarity}, shared: ${best.sharedTop.slice(0, 3).map((t) => t.label).join(", ")}) is ahead on ${best.aheadOn!.map((m) => MILESTONES[m - 1].short).join(", ")} with a gene-level trial${studiesWithExclusion.has(best.id) ? " whose eligibility excludes a variant class" : ""}${nb.contested ? ` (neighbor flag: ${nb.contested.kind.replace(/_/g, " ")})` : ""}${counter ? `; counterexample ${condById.get(counter.id)!.geneSymbol} (${counter.relation}, similarity ${counter.similarity}${counter.sameGene ? ", same gene" : ""})` : ""}.${caveats.length ? " Caveats: " + caveats.join("; ") + "." : ""}`,
    });
  }
  demo.sort((a, b) => a.tier - b.tier || b.score - a.score);
  writeJson(files.demoCandidates, demo.slice(0, 12));

  writeJson(files.ladders, { ladders }, { pretty: false });
  writeSimilarity(sim.cutoffs, sim.neighbors);
  // Transfers are split per focal condition so the app loads only what a page needs.
  const byFocal = new Map<string, Record<string, TransferPair>>();
  for (const [key, pair] of Object.entries(pairs)) (byFocal.get(pair.focalId) ?? byFocal.set(pair.focalId, {}).get(pair.focalId)!)[key] = pair;
  if (fs.existsSync(TRANSFERS_DIR)) fs.rmSync(TRANSFERS_DIR, { recursive: true });
  for (const [focalId, ps] of byFocal) writeJson(path.join(TRANSFERS_DIR, `${focalId.replace(/^cond:/, "")}.json`), { focalId, pairs: ps }, { pretty: false });
  writeJson(files.transfers, { cutoffs: { high: sim.cutoffs.high, medium: sim.cutoffs.medium }, focalIds: [...byFocal.keys()], pairCount: Object.keys(pairs).length }, { pretty: false });
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

function computeBaseline(orgs: PatientOrg[], studies: Study[]) {
  const pairs: z.infer<typeof BaselineFileSchema>["pairs"] = [];
  const passed = orgs.filter((o) => o.verified || o.check?.status === "auto");
  for (const o of passed) {
    if (!o.founded) continue;
    // Earliest registry or natural history study for the condition that started after the organization was founded;
    // a study that predates the group is not a milestone the group reached.
    const reg = studies
      .filter((s) => s.classification?.aboutCondition && (s.classification.role === "registry" || s.classification.role === "natural_history") && s.startDate && Number(s.startDate.slice(0, 4)) >= o.founded!.year && s.conditionIds.some((cid) => o.conditionIds.includes(cid)))
      .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
    const first = reg[0];
    if (!first) continue;
    const startYear = Number(first.startDate!.slice(0, 4));
    const startMonth = first.startDate!.length >= 7 ? Number(first.startDate!.slice(5, 7)) : 6;
    const years = Number((startYear + (startMonth - 1) / 12 - o.founded.year).toFixed(1));
    pairs.push({ orgId: o.id, orgName: o.name, foundedYear: o.founded.year, foundedUrl: o.founded.url, foundedSnippet: o.founded.snippet, conditionIds: o.conditionIds, studyId: first.id, studyTitle: first.briefTitle, studyRole: first.classification!.role, studyStartDate: first.startDate!, years, evidenceIds: [...o.evidenceIds, ...first.evidenceIds] });
  }
  const ys = pairs.map((p) => p.years).sort((a, b) => a - b);
  const median = ys.length ? (ys.length % 2 ? ys[(ys.length - 1) / 2] : (ys[ys.length / 2 - 1] + ys[ys.length / 2]) / 2) : null;
  return { computedAt: new Date().toISOString(), pairs, medianYears: median, minYears: ys.length ? ys[0] : null, maxYears: ys.length ? ys[ys.length - 1] : null, orgsWithFoundingYear: passed.filter((o) => o.founded).length, orgsPassed: passed.length };
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
