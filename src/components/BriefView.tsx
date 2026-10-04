"use client";

import { useMemo, useState } from "react";
import type { Brief, Evidence } from "@/lib/schemas";
import { briefToText } from "@/lib/brief";
import { EvidenceLink } from "./EvidenceDrawer";
import { KindBadge } from "./Badges";

export function BriefView({ focalId, neighborId, pregenerated, evidence, neighborName }: { focalId: string; neighborId: string; pregenerated: Brief | null; evidence: Record<string, Evidence>; neighborName: string }) {
  const [brief, setBrief] = useState<Brief | null>(pregenerated);
  const [source, setSource] = useState<string>(pregenerated ? "pregenerated" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const draft = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ focalId, neighborId }) });
      const data = (await res.json()) as { brief?: Brief; source?: string; error?: string; reason?: string };
      if (!res.ok || !data.brief) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBrief(data.brief);
      setSource(data.source ?? "live");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const footnotes = useMemo(() => {
    const idx = new Map<string, number>();
    if (!brief) return idx;
    for (const s of brief.sections) for (const sent of s.sentences) for (const id of sent.evidenceIds) if (!idx.has(id)) idx.set(id, idx.size + 1);
    return idx;
  }, [brief]);

  const copy = async () => {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(briefToText(brief, evidence));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed; select the text and copy manually.");
    }
  };

  return (
    <section aria-labelledby="brief-h" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <h2 id="brief-h" className="text-2xl">A brief for the {neighborName} community</h2>
          <p className="text-sm text-ink-2 max-w-2xl">One page you can send ahead. Every factual sentence carries a footnote to an evidence record; sentences that could not be grounded were removed before you see them.</p>
        </div>
        <div className="flex items-center gap-2">
          {!brief && (
            <button onClick={draft} disabled={loading} className="border border-ink rounded px-3 py-1.5 text-sm bg-ink text-paper hover:opacity-90 disabled:opacity-50">
              {loading ? "Drafting…" : "Draft a brief for this community"}
            </button>
          )}
          {brief && (
            <>
              <button onClick={copy} className="border border-line-2 rounded px-3 py-1.5 text-sm hover:bg-paper-2">
                {copied ? "Copied" : "Copy as text"}
              </button>
              <button onClick={() => window.print()} className="border border-line-2 rounded px-3 py-1.5 text-sm hover:bg-paper-2">
                Print
              </button>
              {source !== "pregenerated" && (
                <button onClick={draft} disabled={loading} className="border border-line-2 rounded px-3 py-1.5 text-sm hover:bg-paper-2 disabled:opacity-50">
                  {loading ? "Drafting…" : "Redraft"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-stop">Could not draft the brief: {error}</p>}
      {brief && (
        <article className="border border-line rounded-md bg-white p-5 sm:p-8 max-w-3xl print:border-0 print:p-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-4">
            <span>
              {brief.mode === "llm" ? `Drafted with ${brief.model ?? "an LLM"} and checked sentence by sentence against the evidence records` : "Deterministic template built from the evidence pack (no language model involved)"}
              {brief.droppedSentences > 0 ? `; ${brief.droppedSentences} ungrounded sentence${brief.droppedSentences === 1 ? "" : "s"} removed` : ""}.
            </span>
            <span>Generated {brief.generatedAt.slice(0, 10)}.</span>
            {source && <span className="no-print">Source: {source}.</span>}
          </div>
          {brief.sections.map((s) => (
            <section key={s.heading} className="mb-5">
              <h3 className="text-lg mb-1">{s.heading}</h3>
              <p className="text-[15px] leading-relaxed text-ink">
                {s.sentences.map((sent, i) => {
                  // Most specific evidence first: extracted (verbatim quote) > curated record > computed > hypothesis.
                  const rank = (id: string) => ({ extracted: 0, curated: 1, computed: 2, hypothesis: 3 })[evidence[id]?.kind ?? "hypothesis"] ?? 3;
                  const ordered = [...sent.evidenceIds].sort((a, b) => rank(a) - rank(b) || (footnotes.get(a) ?? 0) - (footnotes.get(b) ?? 0));
                  const key = `${s.heading}:${i}`;
                  const showAll = expanded.has(key);
                  const shown = showAll ? ordered : ordered.slice(0, 3);
                  const hidden = ordered.length - shown.length;
                  return (
                    <span key={i}>
                      {sent.text}
                      {shown.map((id) => (
                        <EvidenceLink key={id} ids={[id]} title={evidence[id]?.title ?? id} className="align-super text-[10px] text-accent ml-0.5 no-underline hover:underline">
                          {footnotes.get(id)}
                        </EvidenceLink>
                      ))}
                      {hidden > 0 && (
                        <button type="button" onClick={() => setExpanded((prev) => new Set(prev).add(key))} className="align-super text-[10px] text-muted ml-0.5 underline decoration-dotted no-print" aria-label={`Show ${hidden} more footnotes`}>
                          +{hidden}
                        </button>
                      )}{" "}
                    </span>
                  );
                })}
              </p>
            </section>
          ))}
          {brief.glossary.length > 0 && (
            <section className="mb-5">
              <h3 className="text-lg mb-1">Glossary</h3>
              <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {brief.glossary.map((g) => (
                  <div key={g.term} className="contents">
                    <dt className="font-medium">{g.term}</dt>
                    <dd className="text-ink-2">{g.meaning}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section>
            <h3 className="text-lg mb-1">Evidence</h3>
            <ol className="text-xs text-ink-2 space-y-1 list-decimal pl-5">
              {[...footnotes.entries()].map(([id, n]) => {
                const e = evidence[id];
                return (
                  <li key={id} value={n}>
                    {e ? (
                      <>
                        <KindBadge kind={e.kind} small /> {e.title ?? e.sourceId} ·{" "}
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline break-all">
                          {e.sourceId}
                        </a>
                        {e.quote && <span className="block mt-0.5 italic">“{e.quote.text}”</span>}
                      </>
                    ) : (
                      id
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
          <p className="text-xs text-muted mt-6">A research navigation aid. Not medical advice. Confirm anything here with a clinician or genetic counselor.</p>
        </article>
      )}
    </section>
  );
}
