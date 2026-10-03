"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MiniSearch from "minisearch";
import type { SearchDoc } from "@/lib/schemas";

type Index = { docs: SearchDoc[]; synonyms: Record<string, string> };
const TYPE_LABEL: Record<SearchDoc["type"], string> = { condition: "Conditions", gene: "Genes", phenotype: "Symptoms and features", org: "Patient organizations", road: "Mechanism roads" };
const TYPE_ORDER: SearchDoc["type"][] = ["condition", "gene", "road", "org", "phenotype"];

export function SearchBox({ autoFocus, placeholder, compact }: { autoFocus?: boolean; placeholder?: string; compact?: boolean }) {
  const [index, setIndex] = useState<Index | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/search-index")
      .then((r) => r.json())
      .then((d: Index) => alive && setIndex(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const mini = useMemo(() => {
    if (!index) return null;
    const ms = new MiniSearch<SearchDoc>({ fields: ["title", "text", "subtitle"], storeFields: ["id", "type", "title", "subtitle", "href", "weight", "text"], searchOptions: { boost: { title: 3, text: 1 }, prefix: true, fuzzy: 0.15, combineWith: "AND" } });
    ms.addAll(index.docs);
    return ms;
  }, [index]);

  const results = useMemo(() => {
    if (!mini || q.trim().length < 2) return [] as (SearchDoc & { score: number; via?: string })[];
    const raw = mini.search(q.trim()) as unknown as (SearchDoc & { score: number; match: Record<string, string[]> })[];
    const ql = q.trim().toLowerCase();
    return raw
      .map((r) => {
        const titleHit = r.title.toLowerCase().includes(ql);
        let via: string | undefined;
        if (!titleHit && r.type === "condition") {
          const syn = r.text.split(" | ").find((s) => s.toLowerCase().includes(ql) && s.toLowerCase() !== r.title.toLowerCase());
          if (syn && !/^(loss|gain|dominant|undetermined)/i.test(syn)) via = syn;
        }
        return { ...r, score: r.score * (r.weight ?? 1), via };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 24);
  }, [mini, q]);

  const grouped = useMemo(() => {
    const g: Record<string, (typeof results)[number][]> = {};
    for (const r of results) (g[r.type] ||= []).push(r);
    return TYPE_ORDER.filter((t) => g[t]?.length).map((t) => ({ type: t, items: g[t].slice(0, t === "phenotype" ? 6 : 8) }));
  }, [results]);
  const flat = grouped.flatMap((g) => g.items);


  const go = (r: SearchDoc) => {
    const via = (r as { via?: string }).via;
    router.push(via ? `${r.href}?via=${encodeURIComponent(via)}&q=${encodeURIComponent(q.trim())}` : r.href);
  };

  return (
    <div className="relative">
      <label htmlFor="atlas-search" className="sr-only">
        Search the atlas
      </label>
      <input
        id="atlas-search"
        ref={inputRef}
        type="search"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(flat.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && flat[active]) {
            e.preventDefault();
            go(flat[active]);
          }
        }}
        placeholder={placeholder ?? "Gene, disease, symptom, organization or mechanism…"}
        role="combobox"
        aria-autocomplete="list"
        aria-controls="search-results"
        aria-expanded={flat.length > 0}
        className={`w-full border border-line-2 bg-white rounded-md px-4 ${compact ? "py-2 text-base" : "py-3 text-lg"} focus:outline-none focus:ring-2 focus:ring-accent`}
      />
      {q.trim().length >= 2 && (
        <div id="search-results" role="listbox" className="absolute left-0 right-0 mt-1 bg-paper border border-line-2 rounded-md shadow-lg max-h-[70vh] overflow-y-auto z-30 text-left">
          {!index && <div className="px-4 py-3 text-sm text-muted">Loading index…</div>}
          {index && flat.length === 0 && <div className="px-4 py-3 text-sm text-ink-2">Nothing in the atlas matches “{q}”. Try a gene symbol (for example SCN1A), a disease name, or a symptom.</div>}
          {grouped.map((g) => (
            <div key={g.type}>
              <div className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted">{TYPE_LABEL[g.type]}</div>
              {g.items.map((r) => {
                const idx = flat.indexOf(r);
                return (
                  <button
                    key={r.id}
                    role="option"
                    aria-selected={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(r)}
                    className={`w-full text-left px-4 py-2 border-t border-line/60 ${idx === active ? "bg-paper-2" : ""}`}
                  >
                    <div className="text-ink">{r.title}</div>
                    {r.subtitle && <div className="text-xs text-ink-2">{r.subtitle}</div>}
                    {r.via && <div className="text-xs text-accent">matched synonym “{r.via}”</div>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
