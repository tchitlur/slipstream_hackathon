/**
 * Readiness ladder (SPEC section 9.1). Pure status logic so it can be unit-tested.
 * Status: found, not_found (searched, nothing returned) or not_searched (shallow conditions).
 */
import type { Condition, Milestone, MilestoneStatus, Study, Grant, PatientOrg } from "./schemas";

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
  grants: Grant[];
  /** Disease-model literature result for the gene, if the stage ran. */
  models?: { count: number; topPmids: string[]; evidenceId: string } | null;
  approved?: { therapy: string; regulator: string; evidenceId: string; verified: boolean }[];
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
  const mk = (n: number, status: MilestoneStatus, evidenceIds: string[], detail?: string, flags: string[] = []): Milestone => {
    const def = MILESTONES[n - 1];
    return { n, key: def.key, label: def.label, status, evidenceIds, sourcesSearched: def.sources, detail, flags };
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
    out.push(mk(3, orgs.length ? "found" : "not_found", orgs.flatMap((o) => o.evidenceIds), orgs.map((o) => o.name).join("; ") || undefined, orgs.some((o) => !o.verified) ? ["unverified"] : []));
  }

  // 4 Registry or natural history study
  if (shallow || !inp.searched.studies) out.push(mk(4, "not_searched", []));
  else {
    const reg = inp.studies.filter((s) => s.conditionIds.includes(c.id) && s.classification?.aboutCondition && (s.classification.role === "natural_history" || s.classification.role === "registry"));
    const orgReg = inp.orgs.filter((o) => o.conditionIds.includes(c.id) && o.registry === "yes");
    const ids = [...reg.flatMap((s) => s.evidenceIds), ...orgReg.flatMap((o) => o.evidenceIds)];
    const flags: string[] = [];
    if (reg.length === 1 && !orgReg.length) flags.push("single study");
    if (reg.length && reg.every((s) => !isUsableStudyStatus(s.status))) flags.push("status: " + reg[0].status.toLowerCase().replace(/_/g, " "));
    if (orgReg.some((o) => !o.verified)) flags.push("org unverified");
    out.push(mk(4, ids.length ? "found" : "not_found", ids, [reg.length ? `${reg.length} stud${reg.length === 1 ? "y" : "ies"} (${reg.map((s) => s.id).slice(0, 3).join(", ")})` : "", orgReg.length ? `${orgReg.length} organization${orgReg.length === 1 ? "" : "s"} stating a registry` : ""].filter(Boolean).join("; ") || undefined, flags));
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

  // 7 Targeted clinical trial
  if (shallow || !inp.searched.studies) out.push(mk(7, "not_searched", []));
  else {
    const trials = inp.studies.filter((s) => s.conditionIds.includes(c.id) && s.classification?.aboutCondition && s.classification.role === "interventional_targeted");
    const best = [...trials].sort((a, b) => PHASE_ORDER.indexOf(highestPhase(b.phases) ?? "") - PHASE_ORDER.indexOf(highestPhase(a.phases) ?? ""))[0];
    const flags: string[] = [];
    if (trials.length === 1) flags.push("single study");
    if (trials.length && trials.every((s) => !isUsableStudyStatus(s.status) || s.status === "NOT_YET_RECRUITING")) flags.push("status: " + trials[0].status.toLowerCase().replace(/_/g, " "));
    const modalities = Array.from(new Set(trials.map((t) => t.classification!.modality).filter((m) => m !== "none" && m !== "unclear")));
    out.push(mk(7, trials.length ? "found" : "not_found", trials.flatMap((s) => s.evidenceIds), trials.length ? `${trials.length} trial${trials.length === 1 ? "" : "s"}; highest ${phaseLabel(highestPhase(best.phases))}${modalities.length ? "; " + modalities.map((m) => m.replace(/_/g, " ")).join(", ") : ""}` : undefined, flags));
  }

  // 8 Approved disease-specific therapy
  if (shallow || !inp.searched.approved) out.push(mk(8, "not_searched", []));
  else {
    const ap = inp.approved ?? [];
    out.push(mk(8, ap.length ? "found" : "not_found", ap.map((a) => a.evidenceId), ap.map((a) => `${a.therapy} (${a.regulator})`).join("; ") || undefined, ap.some((a) => !a.verified) ? ["unverified"] : []));
  }
  return out;
}

/** A neighbor is ahead on a milestone when it has found and the focal condition has not_found. */
export function aheadOn(focal: Milestone[], neighbor: Milestone[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < focal.length; i++) if (focal[i].status === "not_found" && neighbor[i]?.status === "found") out.push(focal[i].n);
  return out;
}
