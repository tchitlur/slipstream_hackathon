"use client";

import type { TransferVerdict } from "@/lib/schemas";
import { VERDICT_LABEL, COUNTER_REASONS, ruleById } from "@/lib/transferRules";
import { EvidenceLink } from "./EvidenceDrawer";
import { KindBadge } from "./Badges";

const TONE: Record<string, { border: string; bg: string; text: string; glyph: string }> = {
  transferable: { border: "border-[#86efac]", bg: "bg-ok-bg", text: "text-ok", glyph: "✓" },
  needs_expert_review: { border: "border-[#fdba74]", bg: "bg-warn-bg", text: "text-warn", glyph: "?" },
  do_not_transfer: { border: "border-[#fca5a5]", bg: "bg-stop-bg", text: "text-stop", glyph: "✕" },
  none: { border: "border-line-2", bg: "bg-paper-2", text: "text-ink-2", glyph: "–" },
};

export function BorrowCard({ v, neighborName, eligibility }: { v: TransferVerdict; neighborName: string; eligibility?: { id: string; title: string; excerpt: string; url: string; evidenceId: string }[] }) {
  const tone = TONE[v.verdict ?? "none"];
  const rule = ruleById(v.ruleId);
  const strongest = v.counterReasons[0];
  const rest = v.counterReasons.slice(1);
  return (
    <article className={`border rounded-md ${tone.border} ${v.verdict === "do_not_transfer" ? "bg-stop-bg/40" : "bg-white/60"} p-4 flex flex-col gap-3`} aria-labelledby={`card-${v.ruleId}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">
            Rule {v.ruleId} · {rule.shortAsset}
          </div>
          <h3 id={`card-${v.ruleId}`} className="text-lg leading-snug">{v.asset}</h3>
        </div>
        <EvidenceLink ids={v.evidenceIds} title={`${v.asset}: ${v.verdict ? VERDICT_LABEL[v.verdict] : "not asserted"}`} detail={rule.logic} className="inline-flex">
          <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-sm font-medium ${tone.border} ${tone.bg} ${tone.text}`}>
            <span aria-hidden>{tone.glyph}</span>
            {v.verdict ? VERDICT_LABEL[v.verdict] : "Not asserted"}
          </span>
        </EvidenceLink>
      </header>
      {v.warning && (
        <p className="text-sm text-stop font-medium">Warning: this is the counterexample. Looking alike in symptoms does not mean the same treatment logic applies.</p>
      )}
      <p className="text-sm text-ink">{v.reason}</p>
      <div className="text-xs text-muted flex items-center gap-2">
        <KindBadge kind="hypothesis" small /> Rule: {rule.logic}
      </div>
      {v.assetRecords.length > 0 ? (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-1">The specific asset at {neighborName}</div>
          <ul className="text-sm space-y-1">
            {v.assetRecords.slice(0, 6).map((r) => (
              <li key={r.evidenceId + r.label} className="flex flex-wrap items-baseline gap-x-2">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {r.label}
                </a>
                <EvidenceLink ids={[r.evidenceId]} title={r.label} className="text-xs text-muted underline decoration-dotted">
                  evidence
                </EvidenceLink>
              </li>
            ))}
            {v.assetRecords.length > 6 && <li className="text-xs text-muted">+{v.assetRecords.length - 6} more</li>}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted">No specific record of this asset type was found for {neighborName} in the sources searched; the verdict describes what would apply if one existed.</p>
      )}
      {v.exclusions.length > 0 && (
        <div className="border border-[#fcd34d] bg-[#fffbeb] rounded-md p-3 space-y-2">
          <div className="text-xs uppercase tracking-wide text-warn">Eligibility that depends on the variant class</div>
          {v.exclusions.slice(0, 3).map((x) => (
            <div key={x.studyId} className="text-sm">
              <a href={`https://clinicaltrials.gov/study/${x.studyId}`} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                {x.studyId}
              </a>{" "}
              excludes <span className="text-ink font-medium">{x.excludes}</span>: this trial&apos;s eligibility rules out that class of variants, so whether a family qualifies depends on their own variant, not on the diagnosis.
              <blockquote className="mt-1 border-l-2 border-[#1e3a8a] pl-2 text-ink-2">
                <mark className="bg-[#fff3b0] px-0.5">“{x.quote}”</mark>{" "}
                <EvidenceLink ids={[x.evidenceId]} title={`${x.studyId} eligibility`} className="text-xs text-muted underline decoration-dotted">
                  verified quote
                </EvidenceLink>
              </blockquote>
            </div>
          ))}
        </div>
      )}
      {v.ruleId === "R7" && eligibility && eligibility.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted">Eligibility excerpts to take to the study team</div>
          {eligibility.slice(0, 2).map((e) => (
            <blockquote key={e.id} className="text-sm border-l-2 border-line-2 pl-3 text-ink-2">
              <div className="text-ink">
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {e.id}
                </a>{" "}
                · {e.title}
              </div>
              <div className="text-xs mt-1">{e.excerpt}</div>
            </blockquote>
          ))}
          <p className="text-xs text-muted">Slipstream does not decide eligibility. Ask the study team whether your child&apos;s variant and age fit.</p>
        </div>
      )}
      {strongest && (
        <div className="border-t border-line pt-3">
          <div className="text-xs uppercase tracking-wide text-muted mb-1">Strongest reason this could be wrong</div>
          <div className="text-sm">
            <span className="font-medium">
              {strongest.code} · {COUNTER_REASONS[strongest.code].title}.
            </span>{" "}
            <EvidenceLink ids={strongest.evidenceIds.length ? strongest.evidenceIds : v.evidenceIds} title={`${strongest.code}: ${COUNTER_REASONS[strongest.code].title}`} className="text-ink-2 text-left">
              {strongest.text}
            </EvidenceLink>
          </div>
          {rest.length > 0 && (
            <details className="mt-1 text-sm">
              <summary className="cursor-pointer text-muted">
                {rest.length} more reason{rest.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-1 space-y-1 text-ink-2">
                {rest.map((c) => (
                  <li key={c.code}>
                    <span className="font-medium text-ink">{c.code}</span> {c.text}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
