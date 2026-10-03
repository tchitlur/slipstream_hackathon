/**
 * Brief generation (SPEC 10.5, T4, 8.3): the evidence pack, the deterministic template, the
 * grounding check, and the T4 prompt and schema. Shared by the pipeline (pre-generation) and
 * the live /api/brief route.
 */
import { z } from "zod";
import type { Condition, Evidence, Ladder, Neighbor, TransferPair, Brief, PatientOrg, Study } from "./schemas";
import { MILESTONES } from "./ladder";
import { roadById } from "./roads";
import { VERDICT_LABEL } from "./transferRules";

export type EvidencePack = {
  focal: Condition;
  neighbor: Condition;
  neighborEdge: Neighbor;
  focalLadder: Ladder;
  neighborLadder: Ladder;
  transfer: TransferPair;
  neighborOrgs: PatientOrg[];
  neighborStudies: Study[];
  evidence: Record<string, Evidence>;
  cutoffs: { high: number; medium: number };
};

export const BriefOutputSchema = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      sentences: z.array(z.object({ text: z.string(), evidenceIds: z.array(z.string()) })),
    }),
  ),
  glossary: z.array(z.object({ term: z.string(), meaning: z.string() })),
});

export const T4_SYSTEM = `You write a one-page brief that a parent who leads a small rare-disease patient group will send to a better-resourced community. Plain language, calm, respectful, no hype, no exclamation marks. Reading level: a parent without medical training. Short sentences.

Hard rules:
- Every sentence that states a fact MUST carry one or more evidenceIds copied exactly from the evidence pack. A sentence with no evidence id is allowed only in the "Who we are" section (which is a placeholder) and for pure courtesy sentences ("Thank you for reading.").
- Never invent names, numbers, trials, organizations or dates. Use only what the pack contains. If the pack says something was not found, say so plainly.
- Never say a therapy works. A trial existing is not proof.
- Where the pack marks a transfer verdict "do not transfer", state the reason clearly as something the two communities must not assume they share.
- Mechanism is recorded per gene and disease, not per family; say that the family's own variant must be confirmed by a clinical geneticist.
- Use these section headings in this order: "Who we are", "Why we are writing to you", "What we share", "What we would like to learn from or reuse", "What we know differs", "Questions for expert review".
- "Who we are" must contain exactly one sentence: "[Name of our group, who we represent, and how many families we are in touch with.]" with empty evidenceIds.
- Add a glossary of at most six unavoidable terms.
Return JSON only.`;

export function packSummary(p: EvidencePack): string {
  const f = p.focal;
  const n = p.neighbor;
  const ev = (ids: string[]) => ids.filter((id) => p.evidence[id]);
  const lines: string[] = [];
  lines.push(`FOCAL CONDITION: ${f.name} (gene ${f.geneSymbol}); road: ${roadById(f.roadId)?.label}; curated mechanism: ${f.mechanism} (${f.mechanismSupport}); confidence ${f.confidence}; evidenceIds: ${ev(f.evidenceIds).join(", ")}${f.contested ? `; CONTESTED by published claims: ${f.contested.claims.map((c) => c.direction + " [" + c.evidenceId + "]").join(", ")}` : ""}`);
  lines.push(`NEIGHBOR CONDITION: ${n.name} (gene ${n.geneSymbol}); road: ${roadById(n.roadId)?.label}; curated mechanism: ${n.mechanism} (${n.mechanismSupport}); confidence ${n.confidence}; evidenceIds: ${ev(n.evidenceIds).join(", ")}${n.contested ? `; CONTESTED: ${n.contested.claims.map((c) => c.direction + " [" + c.evidenceId + "]").join(", ")}` : ""}`);
  lines.push(`MECHANISM RELATION: ${p.neighborEdge.relation}. PHENOTYPE SIMILARITY: ${p.neighborEdge.similarity} (${p.neighborEdge.band}; cutoffs high ${p.cutoffs.high}, medium ${p.cutoffs.medium}); shared informative features: ${p.neighborEdge.sharedTop.map((t) => t.label).join(", ")}; ${Math.round(p.neighborEdge.lowInfoShare * 100)}% of shared weight from common low-information terms; evidenceIds: ${ev(p.neighborEdge.evidenceIds).join(", ")}`);
  lines.push("LADDER (milestone: focal status / neighbor status; evidence ids):");
  for (let i = 0; i < 8; i++) {
    const a = p.focalLadder.milestones[i];
    const b = p.neighborLadder.milestones[i];
    lines.push(`  ${a.n}. ${a.label}: focal ${a.status}${a.detail ? " (" + a.detail + ")" : ""} [${ev(a.evidenceIds).join(", ") || "no evidence; sources searched: " + a.sourcesSearched.join("; ")}] / neighbor ${b.status}${b.detail ? " (" + b.detail + ")" : ""} [${ev(b.evidenceIds).join(", ") || "no evidence"}]${b.flags.length ? " flags: " + b.flags.join(", ") : ""}`);
  }
  lines.push("TRANSFER VERDICTS:");
  for (const v of p.transfer.verdicts) {
    lines.push(`  ${v.ruleId} ${v.asset}: ${v.verdict ? VERDICT_LABEL[v.verdict] : "not asserted"}. ${v.reason} Records: ${v.assetRecords.map((r) => r.label + " [" + r.evidenceId + "]").join("; ") || "none"}. Counter-reasons: ${v.counterReasons.map((c) => c.code + " " + c.text).join(" | ")}. evidenceIds: ${ev(v.evidenceIds).join(", ")}`);
  }
  if (p.neighborOrgs.length) lines.push(`NEIGHBOR ORGANIZATIONS: ${p.neighborOrgs.map((o) => `${o.name} (${o.url}; registry: ${o.registry}; ${o.verified ? "verified" : "unverified listing"}) [${ev(o.evidenceIds).join(", ")}]`).join("; ")}`);
  const studies = p.neighborStudies.filter((s) => s.classification?.aboutCondition).slice(0, 8);
  if (studies.length) lines.push(`NEIGHBOR STUDIES: ${studies.map((s) => `${s.id} ${s.briefTitle} (${s.classification!.role.replace(/_/g, " ")}, ${s.status.toLowerCase().replace(/_/g, " ")}${s.phases.length ? ", " + s.phases.join("/") : ""}${s.classification!.excludesMechanism ? "; eligibility excludes " + s.classification!.excludesMechanism : ""}) [${ev(s.evidenceIds).join(", ")}]`).join("; ")}`);
  lines.push(`EXPERT QUESTIONS (from counter-reasons): ${p.transfer.expertQuestions.join(" | ")}`);
  return lines.join("\n");
}

/** Drop sentences whose evidenceIds are empty or not in the pack (SPEC 8.3). Returns the share dropped. */
export function groundingCheck(out: z.infer<typeof BriefOutputSchema>, packEvidenceIds: Set<string>): { sections: Brief["sections"]; dropped: number; total: number } {
  let dropped = 0;
  let total = 0;
  const sections = out.sections.map((s) => {
    const isWhoWeAre = /who we are/i.test(s.heading);
    const kept = s.sentences.filter((sent) => {
      total++;
      if (isWhoWeAre && sent.evidenceIds.length === 0) return true;
      if (/^thank you/i.test(sent.text.trim()) && sent.evidenceIds.length === 0) return true;
      const ok = sent.evidenceIds.length > 0 && sent.evidenceIds.every((id) => packEvidenceIds.has(id));
      if (!ok) dropped++;
      return ok;
    });
    return { heading: s.heading, sentences: kept };
  });
  return { sections, dropped, total };
}

export function packEvidenceIdSet(p: EvidencePack): Set<string> {
  return new Set(Object.keys(p.evidence));
}

/** Deterministic brief from the same evidence pack (fallback, SPEC 10.5). */
export function templateBrief(p: EvidencePack): Brief {
  const f = p.focal;
  const n = p.neighbor;
  const ev = (ids: string[]) => ids.filter((id) => p.evidence[id]);
  const S = (text: string, evidenceIds: string[]) => ({ text, evidenceIds: ev(evidenceIds) });
  const fRoad = roadById(f.roadId)?.label ?? f.roadId;
  const nRoad = roadById(n.roadId)?.label ?? n.roadId;
  const ahead = (p.neighborEdge.aheadOn ?? []).map((m) => MILESTONES[m - 1]);
  const share: Brief["sections"][number]["sentences"] = [];
  share.push(S(`Our condition, ${f.name}, is caused by changes in the gene ${f.geneSymbol}; the curated source records the mechanism as "${f.mechanism}" (${f.mechanismSupport}), which it describes as: ${fRoad}.`, f.evidenceIds));
  share.push(S(`Your condition, ${n.name}, is caused by changes in ${n.geneSymbol}; its curated mechanism is "${n.mechanism}" (${n.mechanismSupport}): ${nRoad}.`, n.evidenceIds));
  share.push(S(`On symptoms, the two conditions have a phenotype similarity of ${p.neighborEdge.similarity.toFixed(2)} (${p.neighborEdge.band}), with shared informative features including ${p.neighborEdge.sharedTop.slice(0, 4).map((t) => t.label.toLowerCase()).join(", ")}.`, p.neighborEdge.evidenceIds));
  share.push(S(p.neighborEdge.relation === "same road" ? `The two conditions are on the same mechanism road, so the logic of a treatment strategy may apply to both, subject to expert review.` : p.neighborEdge.relation === "opposite direction" ? `The two mechanisms point in opposite directions, so a treatment strategy for one would not apply to the other even though the symptoms look alike.` : `The mechanism relation between the two conditions is "${p.neighborEdge.relation}", so no treatment logic is assumed to be shared.`, [...f.evidenceIds, ...n.evidenceIds]));

  const reuse: Brief["sections"][number]["sentences"] = [];
  for (const m of ahead) {
    const nm = p.neighborLadder.milestones[m.n - 1];
    reuse.push(S(`Your community has reached "${m.label}"${nm.detail ? " (" + nm.detail + ")" : ""}, which ours has not found in the sources we searched.`, [...nm.evidenceIds]));
  }
  for (const v of p.transfer.verdicts.filter((v) => v.verdict === "transferable" || v.verdict === "needs_expert_review")) {
    reuse.push(S(`${v.asset}: ${VERDICT_LABEL[v.verdict!].toLowerCase()}. ${v.reason}`, v.evidenceIds));
  }
  if (!reuse.length) reuse.push(S(`We did not find a milestone on which your community is ahead of ours in the sources searched, so we are writing mainly to compare notes.`, [...p.focalLadder.milestones.flatMap((m) => m.evidenceIds), ...p.neighborLadder.milestones.flatMap((m) => m.evidenceIds)]));

  const differs: Brief["sections"][number]["sentences"] = [];
  for (const v of p.transfer.verdicts.filter((v) => v.verdict === "do_not_transfer")) differs.push(S(`${v.asset}: do not transfer. ${v.reason}`, v.evidenceIds));
  const counters = new Map<string, { text: string; evidenceIds: string[] }>();
  for (const v of p.transfer.verdicts) for (const c of v.counterReasons) if (!counters.has(c.code)) counters.set(c.code, c);
  for (const c of counters.values()) differs.push(S(c.text, c.evidenceIds.length ? c.evidenceIds : [...f.evidenceIds]));

  const questions = p.transfer.expertQuestions.map((q) => S(q, [...f.evidenceIds, ...n.evidenceIds]));

  return {
    focalId: f.id,
    neighborId: n.id,
    generatedAt: new Date().toISOString(),
    mode: "template",
    sections: [
      { heading: "Who we are", sentences: [{ text: "[Name of our group, who we represent, and how many families we are in touch with.]", evidenceIds: [] }] },
      {
        heading: "Why we are writing to you",
        sentences: [
          S(`We lead a patient community for ${f.name}, a condition caused by changes in the gene ${f.geneSymbol}.`, f.evidenceIds),
          S(`A public-data comparison placed your community, ${n.name}, among the closest to ours by symptoms (similarity ${p.neighborEdge.similarity.toFixed(2)}) and showed that you are ahead of us on ${ahead.length ? ahead.map((m) => m.label.toLowerCase()).join(", ") : "none of the milestones we could measure"}.`, [...p.neighborEdge.evidenceIds, ...ahead.flatMap((m) => p.neighborLadder.milestones[m.n - 1].evidenceIds)]),
        ],
      },
      { heading: "What we share", sentences: share },
      { heading: "What we would like to learn from or reuse", sentences: reuse },
      { heading: "What we know differs", sentences: differs },
      { heading: "Questions for expert review", sentences: questions },
    ],
    glossary: [
      { term: "Mechanism", meaning: "How a gene change causes disease: too little protein (loss of function), an overactive or altered protein (gain of function), or a faulty protein that interferes with the normal one (dominant negative)." },
      { term: "Phenotype similarity", meaning: "A calculated score for how much two conditions' recorded symptoms overlap, weighted so that rare, specific features count more than common ones." },
      { term: "Natural history study", meaning: "A study that follows people with a condition over time without testing a treatment, to learn how the condition usually progresses." },
      { term: "Registry", meaning: "An organized collection of information about people with a condition, usually run by a patient group or a research centre." },
    ],
    droppedSentences: 0,
  };
}

export function briefToText(b: Brief, evidence: Record<string, Evidence>): string {
  const refs: string[] = [];
  const refIndex = new Map<string, number>();
  const cite = (ids: string[]) =>
    ids
      .map((id) => {
        if (!refIndex.has(id)) {
          refIndex.set(id, refs.length + 1);
          const e = evidence[id];
          refs.push(e ? `${e.title ?? e.sourceId} (${e.source}, ${e.url}${e.quote ? `; quote: "${e.quote.text}"` : ""})` : id);
        }
        return `[${refIndex.get(id)}]`;
      })
      .join("");
  const lines: string[] = [];
  for (const s of b.sections) {
    lines.push(s.heading.toUpperCase());
    lines.push(s.sentences.map((x) => `${x.text}${cite(x.evidenceIds)}`).join(" "));
    lines.push("");
  }
  if (b.glossary.length) {
    lines.push("GLOSSARY");
    for (const g of b.glossary) lines.push(`${g.term}: ${g.meaning}`);
    lines.push("");
  }
  lines.push("EVIDENCE");
  refs.forEach((r, i) => lines.push(`[${i + 1}] ${r}`));
  lines.push("");
  lines.push(`Generated by Slipstream (${b.mode === "llm" ? "drafted with " + (b.model ?? "an LLM") + ", every sentence checked against the evidence pack" : "deterministic template from the evidence pack"}) on ${b.generatedAt.slice(0, 10)}. A research navigation aid. Not medical advice.`);
  return lines.join("\n");
}
