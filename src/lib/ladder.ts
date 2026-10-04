/**
 * Readiness ladder (SPEC section 9.1). Pure status logic so it can be unit-tested.
 * Status: found, not_found (searched, nothing returned) or not_searched (shallow conditions).
 */
import type { Condition, Milestone, MilestoneStatus, Study, Grant, PatientOrg, RegistryRecord } from "./schemas";

export const MILESTONES: { n: number; key: string; label: string; short: string; sources: string[] }[] = [
  { n: 1, key: "gene_link", label: "Gene link confirmed", short: "Gene link", sources: ["Gene2Phenotype"] },
  { n: 2, key: "mechanism", label: "Mechanism established", short: "Mechanism", sources: ["Gene2Phenotype"] },
  { n: 3, key: "patient_org", label: "Patient organization", short: "Patient org", sources: ["seed list of patient organizations (hand-drafted, verification pending)"] },
  { n: 4, key: "registry", label: "Registry or natural history study", short: "Registry / NHS", sources: ["ClinicalTrials.gov (classified studies)", "organization sites in the seed list"] },
  { n: 5, key: "models", label: "Disease models reported", short: "Disease models", sources: ["PubMed (disease-model query)"] },
  { n: 6, key: "funding", label: "Active NIH-funded research", short: "NIH funding", sources: ["NIH RePORTER (last two fiscal years)"] },
  { n: 7, key: "trial", label: "Targeted clinical trial", short: "Targeted trial", sources: ["ClinicalTrials.gov (classified studies)"] },
  { n: 8, key: "approved", label: "Approved disease-specific therapy", short: "Approved therapy", sources: ["seed list of approved therapies (regulator or label URL required)"] },
];

export const PHASE_ORDER = ["EARLY_PHASE1", "PHASE1", "PHASE2", "PHASE3", "PHASE4"];
export function highestPhase(phases: string[]): string | undefined {
  let best: string | undefined;
  for (const p of phases) if (PHASE_ORDER.indexOf(p) > PHASE_ORDER.indexOf(best ?? "")) best = p;
  return best;
}
export function phaseLabel(p?: string) {
  if (!p) return "phase not stated";
  return p.replace("EARLY_PHASE1", "early phase 1").replace("PHASE", "phase ");
}

export type LadderInputs = {
  condition: Condition;
  studies: Study[];
  orgs: PatientOrg[];
  /** Shared, organization-page and web-search registries (see pipeline/lib/registries.ts). */
  registries?: RegistryRecord[];
  grants: Grant[];
  /** Disease-model literature result for the gene, if the stage ran. */
  models?: { count: number; topPmids: string[]; evidenceId: string } | null;
  approved?: { therapy: string; regulator: string; evidenceId: string; verified: boolean; targets?: "gene_product" | "pathway" | "symptomatic_or_unknown"; conditionName?: string }[];
  /** Which sources were actually searched for this condition (stage ran). */
  searched: { studies: boolean; orgs: boolean; grants: boolean; literature: boolean; approved: boolean };
  currentFiscalYear: number;
};

const ACTIVE_STATUSES = new Set(["RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION", "NOT_YET_RECRUITING", "COMPLETED", "AVAILABLE", "APPROVED_FOR_MARKETING"]);
export function isUsableStudyStatus(status: string) {
  return ACTIVE_STATUSES.has(status) || status === "UNKNOWN";
}

export function computeLadder(inp: LadderInputs): Milestone[] {
  const c = inp.condition;
  const shallow = c.depth === "shallow";
  const mk = (n: number, status: MilestoneStatus, evidenceIds: string[], detail?: string, flags: string[] = [], partialKind?: Milestone["partialKind"]): Milestone => {
    const def = MILESTONES[n - 1];
    return { n, key: def.key, label: def.label, status, evidenceIds, sourcesSearched: def.sources, detail, flags, partialKind };
  };
  const out: Milestone[] = [];

  // 1 Gene link confirmed: curated confidence definitive or strong.
  const geneLink = c.confidence === "definitive" || c.confidence === "strong";
  out.push(mk(1, geneLink ? "found" : "not_found", geneLink ? c.evidenceIds.filter((e) => e.startsWith("ev:g2p:")) : [], `Gene2Phenotype confidence: ${c.confidence}`, geneLink ? [] : [`confidence: ${c.confidence}`]));

  // 2 Mechanism established: curated mechanism not undetermined.
  const mech = c.mechanism !== "undetermined";
  const mechFlags = [`support: ${c.mechanismSupport}`];
  if (c.contested) mechFlags.push("contested");
  out.push(mk(2, mech ? "found" : "not_found", mech ? c.evidenceIds.filter((e) => e.startsWith("ev:g2p:")) : [], mech ? `${c.mechanism} (${c.mechanismSupport})` : "Mechanism undetermined in the curated source", mech ? mechFlags : []));

  // 3 Patient organization
  if (shallow || !inp.searched.orgs) out.push(mk(3, "not_searched", []));
  else {
    const orgs = inp.orgs.filter((o) => o.conditionIds.includes(c.id));
    const orgFlags: string[] = [];
    if (orgs.length && orgs.every((o) => !o.verified)) orgFlags.push(orgs.some((o) => o.check?.status === "auto") ? "auto-checked" : "unverified");
    out.push(mk(3, orgs.length ? "found" : "not_found", orgs.flatMap((o) => o.evidenceIds), orgs.map((o) => o.name).join("; ") || undefined, orgFlags));
  }

  // 4 Registry or natural history study. Three states: a condition-specific study or registry (found), inclusion in a
  // shared multi-gene registry such as Simons Searchlight (partial, named), or nothing found.
  if (shallow || !inp.searched.studies) out.push(mk(4, "not_searched", []));
  else {
    const reg = inp.studies.filter((s) => s.conditionIds.includes(c.id) && s.classification?.aboutCondition && (s.classification.role === "natural_history" || s.classification.role === "registry"));
    const orgReg = inp.orgs.filter((o) => o.conditionIds.includes(c.id) && o.registry === "yes");
    const regs = (inp.registries ?? []).filter((r) => r.conditionIds.includes(c.id));
    const specific = regs.filter((r) => r.kind !== "shared_registry");
    const shared = regs.filter((r) => r.kind === "shared_registry");
    const ids = [...reg.flatMap((s) => s.evidenceIds), ...orgReg.flatMap((o) => o.evidenceIds), ...specific.flatMap((r) => r.evidenceIds)];
    const flags: string[] = [];
    if (reg.length === 1 && !orgReg.length && !specific.length) flags.push("single study");
    if (reg.length && reg.every((s) => !isUsableStudyStatus(s.status))) flags.push("status: " + reg[0].status.toLowerCase().replace(/_/g, " "));
    if (orgReg.some((o) => !o.verified)) flags.push(orgReg.some((o) => o.check?.status === "auto") ? "org auto-checked" : "org unverified");
    if (specific.length) flags.push("outside ClinicalTrials.gov");
    const sharedNames = Array.from(new Set(shared.map((r) => r.name)));
    if (ids.length) {
      out.push(mk(4, "found", ids, [reg.length ? `${reg.length} stud${reg.length === 1 ? "y" : "ies"} (${reg.map((s) => s.id).slice(0, 3).join(", ")})` : "", orgReg.length ? `${orgReg.length} organization${orgReg.length === 1 ? "" : "s"} stating a registry` : "", specific.length ? specific.map((r) => r.name).join("; ") : "", sharedNames.length ? `also included in ${sharedNames.join(", ")}` : ""].filter(Boolean).join("; ") || undefined, flags));
    } else if (shared.length) {
      out.push(mk(4, "partial", shared.flatMap((r) => r.evidenceIds), `Included in a shared multi-gene registry: ${sharedNames.join(", ")}. No condition-specific registry or natural history study found.`, ["shared registry"], "shared_registry"));
    } else out.push(mk(4, "not_found", [], undefined, flags));
  }

  // 5 Disease models reported
  if (shallow || !inp.searched.literature || inp.models === undefined) out.push(mk(5, "not_searched", []));
  else if (inp.models && inp.models.count > 0) out.push(mk(5, "found", [inp.models.evidenceId], `${inp.models.count} PubMed records; top: ${inp.models.topPmids.slice(0, 3).map((p) => "PMID " + p).join(", ")}`, inp.models.count < 3 ? ["few records"] : []));
  else out.push(mk(5, "not_found", [], "0 PubMed records for the disease-model query"));

  // 6 Active NIH-funded research: projects in the last two fiscal years
  if (shallow || !inp.searched.grants) out.push(mk(6, "not_searched", []));
  else {
    const recent = inp.grants.filter((g) => g.conditionIds.includes(c.id) && g.fiscalYears.some((fy) => fy >= inp.currentFiscalYear - 1));
    out.push(mk(6, recent.length ? "found" : "not_found", recent.flatMap((g) => g.evidenceIds), recent.length ? `${recent.length} project${recent.length === 1 ? "" : "s"} in FY${inp.currentFiscalYear - 1}-${inp.currentFiscalYear}` : `No RePORTER projects in FY${inp.currentFiscalYear - 1}-${inp.currentFiscalYear}`, recent.length === 1 ? ["single project"] : []));
  }

  // 7 Targeted clinical trial. Only trials whose intervention acts on the gene or its product count as found;
  // pathway-level trials (mTOR inhibitors, IGF-1 approaches) show as a distinct partial state.
  if (shallow || !inp.searched.studies) out.push(mk(7, "not_searched", []));
  else {
    const targetedAll = inp.studies.filter((s) => s.conditionIds.includes(c.id) && s.classification?.aboutCondition && s.classification.role === "interventional_targeted");
    const geneLevel = targetedAll.filter((s) => (s.classification!.target ?? "gene_product") === "gene_product");
    const pathway = targetedAll.filter((s) => s.classification!.target === "pathway");
    const describe = (trials: Study[]) => {
      const best = [...trials].sort((a, b) => PHASE_ORDER.indexOf(highestPhase(b.phases) ?? "") - PHASE_ORDER.indexOf(highestPhase(a.phases) ?? ""))[0];
      const modalities = Array.from(new Set(trials.map((t) => t.classification!.modality).filter((m) => m !== "none" && m !== "unclear")));
      return `${trials.length} trial${trials.length === 1 ? "" : "s"}; highest ${phaseLabel(highestPhase(best.phases))}${modalities.length ? "; " + modalities.map((m) => m.replace(/_/g, " ")).join(", ") : ""}`;
    };
    const flagsFor = (trials: Study[]) => {
      const flags: string[] = [];
      if (trials.length === 1) flags.push("single study");
      if (trials.length && trials.every((s) => !isUsableStudyStatus(s.status) || s.status === "NOT_YET_RECRUITING")) flags.push("status: " + trials[0].status.toLowerCase().replace(/_/g, " "));
      return flags;
    };
    if (geneLevel.length) out.push(mk(7, "found", geneLevel.flatMap((s) => s.evidenceIds), `Gene-level: ${describe(geneLevel)}${pathway.length ? `; plus ${pathway.length} pathway-level trial${pathway.length === 1 ? "" : "s"}` : ""}`, flagsFor(geneLevel)));
    else if (pathway.length) out.push(mk(7, "partial", pathway.flatMap((s) => s.evidenceIds), `Pathway-level only: ${describe(pathway)}. No trial acting on the gene or its product.`, ["pathway trial", ...flagsFor(pathway)], "pathway_trial"));
    else out.push(mk(7, "not_found", []));
  }

  // 8 Approved disease-specific therapy
  if (shallow || !inp.searched.approved) out.push(mk(8, "not_searched", []));
  else {
    const ap = inp.approved ?? [];
    const flags8: string[] = [];
    if (ap.length && ap.every((a) => (a.targets ?? "symptomatic_or_unknown") === "symptomatic_or_unknown")) flags8.push("symptoms only");
    if (ap.some((a) => a.targets === "gene_product")) flags8.push("acts on gene product");
    else if (ap.some((a) => a.targets === "pathway")) flags8.push("acts on pathway");
    if (ap.some((a) => !a.verified)) flags8.push("auto-checked");
    const indications = Array.from(new Set(ap.map((a) => a.conditionName).filter(Boolean)));
    out.push(mk(8, ap.length ? "found" : "not_found", ap.map((a) => a.evidenceId), [ap.map((a) => `${a.therapy}, ${a.regulator}`).join("; "), indications.length && indications.some((n) => n && n.toLowerCase() !== c.name.toLowerCase()) ? `indication text names ${indications.join(", ")} specifically` : ""].filter(Boolean).join(". ") || undefined, flags8));
  }
  return out;
}

/** A neighbor is ahead on a milestone when it has found and the focal condition has not_found. */
const RANK: Record<MilestoneStatus, number> = { found: 2, partial: 1, not_found: 0, not_searched: 0 };
/** A neighbor is ahead when its status ranks higher (found > partial > not found) and the focal condition has not reached "found". */
export function aheadOn(focal: Milestone[], neighbor: Milestone[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < focal.length; i++) if (focal[i].status !== "not_searched" && RANK[neighbor[i]?.status ?? "not_found"] > RANK[focal[i].status]) out.push(focal[i].n);
  return out;
}
