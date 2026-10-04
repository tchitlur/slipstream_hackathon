import type { Condition, Investigator, Neighbor, PatientOrg, TransferPair, TransferVerdict } from "@/lib/schemas";
import { COUNTER_REASONS } from "@/lib/transferRules";
import { EvidenceLink } from "./EvidenceDrawer";

/**
 * "What to do this week": up to three concrete steps built only from data already on the borrow page. Every step
 * links to the evidence record it rests on. On a counterexample page the first step says what not to pursue.
 */
export type Step = { kind: "do" | "dont"; text: string; evidenceIds: string[]; title: string; href?: string; hrefLabel?: string };

const MECHANISM_CODES = new Set(["C2", "C3", "C4"]);

function firstRecord(v: TransferVerdict | undefined, pred: (label: string) => boolean = () => true) {
  return v?.assetRecords.find((r) => pred(r.label));
}

export function buildSteps({ focal, nb, pair, edge, nbOrgs, bridges }: { focal: Condition; nb: Condition; pair: TransferPair; edge: Neighbor; nbOrgs: PatientOrg[]; bridges: Investigator[] }): { steps: Step[]; counterexample: boolean } {
  const byRule = Object.fromEntries(pair.verdicts.map((v) => [v.ruleId, v])) as Partial<Record<string, TransferVerdict>>;
  const r1 = byRule.R1, r2 = byRule.R2, r4 = byRule.R4, r7 = byRule.R7;
  const counterexample = pair.verdicts.some((v) => v.warning) || (r4?.verdict === "do_not_transfer" && (edge.relation === "opposite direction" || edge.relation === "different road"));
  const steps: Step[] = [];
  const used = new Set<string>();
  const push = (s: Step) => {
    if (steps.length >= 3 || used.has(s.text)) return;
    used.add(s.text);
    steps.push(s);
  };

  // Counterexample: say first what not to pursue, and why.
  if (counterexample && r4) {
    const strongest = r4.counterReasons.find((c) => MECHANISM_CODES.has(c.code)) ?? r4.counterReasons[0];
    push({
      kind: "dont",
      text: `Do not pursue the therapeutic strategy used for ${nb.geneSymbol}. ${r4.reason}${strongest ? ` ${strongest.code}: ${strongest.text}` : ""}`,
      evidenceIds: Array.from(new Set([...(strongest?.evidenceIds ?? []), ...r4.evidenceIds])),
      title: `R4 for ${focal.geneSymbol} with ${nb.geneSymbol}: do not transfer`,
    });
  }

  // 1. A patient organization that passed its automated check: send the brief.
  const org = nbOrgs.find((o) => o.check?.status !== "failed");
  if (org) {
    push({
      kind: "do",
      text: `Send the brief at the bottom of this page to ${org.name}${org.check?.status === "auto" ? " (organization page automatically checked, not human-verified)" : ""} and ask whether they will share their registry design and outcome measures.`,
      evidenceIds: org.evidenceIds,
      title: org.name,
      href: org.url,
      hrefLabel: "organization site",
    });
  }

  // 2. A mechanism-dependent verdict or an exclusion criterion: the variant class decides, so ask a clinical geneticist.
  const excl = (r4?.exclusions ?? []).concat(r7?.exclusions ?? [])[0];
  if (excl) {
    push({
      kind: "do",
      text: `Ask the clinical geneticist which class the family's ${focal.geneSymbol} variant belongs to. ${excl.studyId} excludes ${excl.excludes}, so the answer decides whether the trial route for ${nb.geneSymbol} is even open.`,
      evidenceIds: [excl.evidenceId],
      title: `${excl.studyId} eligibility`,
      href: `https://clinicaltrials.gov/study/${excl.studyId}`,
      hrefLabel: excl.studyId,
    });
  } else if (!counterexample) {
    const mech = pair.verdicts.find((v) => v.verdict === "needs_expert_review" && v.counterReasons.some((c) => MECHANISM_CODES.has(c.code)));
    const c = mech?.counterReasons.find((c) => MECHANISM_CODES.has(c.code));
    if (mech && c) {
      push({
        kind: "do",
        text: `Ask the clinical geneticist which class the family's ${focal.geneSymbol} variant belongs to before acting on ${mech.asset.toLowerCase()} from ${nb.geneSymbol}: ${COUNTER_REASONS[c.code].title.toLowerCase()} (${c.code}).`,
        evidenceIds: c.evidenceIds.length ? c.evidenceIds : mech.evidenceIds,
        title: `${c.code}: ${COUNTER_REASONS[c.code].title}`,
      });
    }
  }

  // 3. A registry or natural history study of the neighbor whose design can be reused (R1 or R2 transferable).
  const reg = (r1?.verdict === "transferable" ? firstRecord(r1) : undefined) ?? (r2?.verdict === "transferable" ? firstRecord(r2) : undefined);
  if (reg) {
    const label = reg.label.replace(/\s*\((shared|registry|natural)[^)]*\)\s*$/i, "");
    push({
      kind: "do",
      text: `Ask the team behind ${label} whether its data items, consent forms and outcome measures can be reused for a ${focal.geneSymbol} registry. Phenotype overlap is what makes this reusable, not mechanism.`,
      evidenceIds: [reg.evidenceId],
      title: reg.label,
      href: reg.url,
      hrefLabel: "record",
    });
  }

  // 4. An investigator linked by public records to both conditions.
  const bridge = bridges[0];
  if (bridge) {
    const rec = bridge.records.find((r) => r.conditionIds.includes(nb.id)) ?? bridge.records[0];
    push({
      kind: "do",
      text: `Contact ${bridge.displayName}${bridge.organizations[0] ? ` (${bridge.organizations[0]})` : ""}, who is linked by public records to both ${focal.geneSymbol} and ${nb.geneSymbol}.`,
      evidenceIds: [],
      title: bridge.displayName,
      href: rec?.url,
      hrefLabel: rec ? `${rec.kind} record` : undefined,
    });
  }

  // 5. A trial of the neighbor with an eligibility excerpt: ask the study team (R7 asserted).
  if (r7?.verdict && r7.assetRecords[0]) {
    const rec = r7.assetRecords[0];
    push({
      kind: "do",
      text: `Ask the study team of ${rec.label.split(":")[0]} whether a ${focal.geneSymbol} family could ever be eligible. Slipstream does not decide eligibility.`,
      evidenceIds: [rec.evidenceId],
      title: rec.label,
      href: rec.url,
      hrefLabel: "record",
    });
  }

  return { steps, counterexample };
}

export function NextSteps({ steps, counterexample, focalGene, neighborGene }: { steps: Step[]; counterexample: boolean; focalGene: string; neighborGene: string }) {
  return (
    <section aria-labelledby="week-h" className={`border rounded-md p-4 sm:p-5 ${counterexample ? "border-[#fca5a5] bg-stop-bg/30" : "border-[#93c5fd] bg-[#eff6ff]"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 id="week-h" className="text-xl">What to do this week</h2>
        <span className="text-xs text-muted">Built only from the records on this page. Each step links to its evidence.</span>
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-ink-2">
          The data on this page supports no concrete step this week: no patient organization, registry, natural history study, eligibility criterion or shared investigator was found for {neighborGene} in the sources searched. The cards below say what was searched.
        </p>
      ) : (
        <ol className="list-decimal pl-5 space-y-2 text-[15px] max-w-3xl">
          {steps.map((s) => (
            <li key={s.text} className={s.kind === "dont" ? "text-stop" : ""}>
              <span className={s.kind === "dont" ? "font-medium" : ""}>{s.text}</span>{" "}
              {s.href && (
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline text-ink-2 text-sm">
                  {s.hrefLabel ?? "source"}
                </a>
              )}
              {s.evidenceIds.length > 0 && (
                <>
                  {" "}
                  <EvidenceLink ids={s.evidenceIds} title={s.title} className="text-xs text-muted underline decoration-dotted">
                    evidence
                  </EvidenceLink>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {steps.length > 0 && steps.length < 3 && (
        <p className="text-xs text-muted mt-2">
          {`Only ${steps.length === 1 ? "one step is" : "two steps are"} supported by the records found for ${focalGene} with ${neighborGene}. Slipstream does not invent a third.`}
        </p>
      )}
    </section>
  );
}
