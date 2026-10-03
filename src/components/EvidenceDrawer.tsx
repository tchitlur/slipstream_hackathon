"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Evidence } from "@/lib/schemas";
import { KindBadge } from "./Badges";

type OpenArgs = { title: string; evidenceIds: string[]; detail?: string; contradictingIds?: string[] };
type Ctx = { open: (args: OpenArgs) => void; has: (id: string) => boolean };

const EvidenceContext = createContext<Ctx | null>(null);

export function useEvidence() {
  const ctx = useContext(EvidenceContext);
  if (!ctx) throw new Error("useEvidence must be used within EvidenceProvider");
  return ctx;
}

const SOURCE_LABEL: Record<Evidence["source"], string> = {
  g2p: "Gene2Phenotype",
  hpo: "Human Phenotype Ontology",
  ctgov: "ClinicalTrials.gov",
  reporter: "NIH RePORTER",
  pubmed: "PubMed",
  seed: "Seed list (hand-drafted)",
  rule: "Slipstream rule",
};

export function EvidenceProvider({ evidence, children }: { evidence: Record<string, Evidence>; children: React.ReactNode }) {
  const [state, setState] = useState<OpenArgs | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const open = useCallback((args: OpenArgs) => setState(args), []);
  const has = useCallback((id: string) => Boolean(evidence[id]), [evidence]);
  const value = useMemo(() => ({ open, has }), [open, has]);

  useEffect(() => {
    if (!state) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  const records = state ? state.evidenceIds.map((id) => evidence[id]).filter(Boolean) : [];
  const missing = state ? state.evidenceIds.filter((id) => !evidence[id]) : [];
  const contradicting = state?.contradictingIds?.map((id) => evidence[id]).filter(Boolean) ?? [];

  return (
    <EvidenceContext.Provider value={value}>
      {children}
      {state && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button aria-label="Close evidence panel" className="absolute inset-0 bg-ink/20 cursor-default" onClick={() => setState(null)} tabIndex={-1} />
          <aside role="dialog" aria-modal="true" aria-labelledby="evidence-title" className="relative h-full w-full max-w-lg bg-paper border-l border-line shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-paper border-b border-line px-5 py-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Evidence</div>
                <h2 id="evidence-title" className="text-lg leading-snug">{state.title}</h2>
                {state.detail && <p className="text-sm text-ink-2 mt-1">{state.detail}</p>}
              </div>
              <button ref={closeBtn} onClick={() => setState(null)} className="text-sm border border-line-2 rounded px-2 py-1 hover:bg-paper-2">
                Close
              </button>
            </div>
            <div className="px-5 py-4 space-y-5">
              {records.length === 0 && (
                <p className="text-sm text-ink-2">
                  No evidence record is attached to this claim. {missing.length ? `Missing ids: ${missing.join(", ")}.` : "Nothing was found in the sources searched."}
                </p>
              )}
              {records.map((ev) => (
                <EvidenceCard key={ev.id} ev={ev} />
              ))}
              {contradicting.length > 0 && (
                <div className="border-t border-line pt-4">
                  <div className="text-xs uppercase tracking-wide text-stop mb-2">Contradicting evidence</div>
                  <div className="space-y-4">
                    {contradicting.map((ev) => (
                      <EvidenceCard key={ev.id} ev={ev} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </EvidenceContext.Provider>
  );
}

export function EvidenceCard({ ev }: { ev: Evidence }) {
  const external = /^https?:/.test(ev.url);
  return (
    <article className="border border-line rounded-md p-3 bg-white/60">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <KindBadge kind={ev.kind} />
        <span className={`text-xs ${ev.confidence === "high" ? "text-ok" : ev.confidence === "medium" ? "text-warn" : "text-stop"}`}>confidence: {ev.confidence}</span>
      </div>
      {ev.title && <div className="text-sm font-medium text-ink mb-1">{ev.title}</div>}
      <dl className="text-xs text-ink-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted">Source</dt>
        <dd>{SOURCE_LABEL[ev.source]}</dd>
        <dt className="text-muted">Record</dt>
        <dd>
          <a href={ev.url} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="underline break-all">
            {ev.sourceId}
          </a>
        </dd>
        <dt className="text-muted">Retrieved</dt>
        <dd>{ev.retrievedAt}</dd>
      </dl>
      {ev.quote && (
        <blockquote className="mt-2 text-sm border-l-2 border-[#1e3a8a] pl-3 text-ink">
          <mark className="bg-[#fff3b0] px-0.5">{ev.quote.text}</mark>
          <div className="text-[11px] text-muted mt-1">verbatim; characters {ev.quote.start}–{ev.quote.end} of the cached source text</div>
        </blockquote>
      )}
      {ev.note && <p className="text-sm text-ink-2 mt-2">{ev.note}</p>}
    </article>
  );
}

/** A small inline button that opens the drawer for a set of evidence ids. */
export function EvidenceLink({ ids, title, detail, children, className, contradictingIds }: { ids: string[]; title: string; detail?: string; children: React.ReactNode; className?: string; contradictingIds?: string[] }) {
  const { open } = useEvidence();
  return (
    <button type="button" onClick={() => open({ title, evidenceIds: ids, detail, contradictingIds })} className={className ?? "underline decoration-dotted underline-offset-2 hover:decoration-solid text-left"}>
      {children}
    </button>
  );
}
