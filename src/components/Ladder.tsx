"use client";

import Link from "next/link";
import type { Milestone, Neighbor, MechanismRelation } from "@/lib/schemas";
import { MILESTONES } from "@/lib/ladder";
import { useEvidence } from "./EvidenceDrawer";
import { RoadDot, Chip } from "./Badges";

export type LadderRow = {
  id: string;
  name: string;
  geneSymbol: string;
  roadId: string;
  roadLabel: string;
  href: string;
  depth: "deep" | "shallow";
  milestones: Milestone[];
  neighbor?: Neighbor;
};

export const RELATION_TONE: Record<MechanismRelation, "info" | "stop" | "warn" | "neutral"> = {
  "same road": "info",
  "opposite direction": "stop",
  contested: "warn",
  "different road": "neutral",
  unknown: "neutral",
};

export function RelationChip({ relation, curatedRelation }: { relation?: MechanismRelation; curatedRelation?: MechanismRelation }) {
  if (!relation) return null;
  const glyph = relation === "same road" ? "=" : relation === "opposite direction" ? "⇅" : relation === "contested" ? "!" : relation === "different road" ? "≠" : "?";
  const sub = relation === "contested" && curatedRelation && curatedRelation !== "contested" ? ` (curated: ${curatedRelation})` : "";
  return (
    <Chip tone={RELATION_TONE[relation]} title={`Mechanism relation: ${relation}${sub}`}>
      <span aria-hidden>{glyph}</span> {relation}
      {sub && <span className="opacity-80">{sub}</span>}
    </Chip>
  );
}

export function SimilarityBar({ value, band }: { value: number; band?: "high" | "medium" | "low" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2" title={`Phenotype similarity (simGIC): ${value.toFixed(2)}, ${band ?? ""}`}>
      <span className="inline-block h-1.5 w-16 rounded bg-paper-2 overflow-hidden" aria-hidden>
        <span className="block h-full bg-ink-2" style={{ width: `${Math.min(100, Math.round(value * 100 * 2))}%` }} />
      </span>
      <span>
        {value.toFixed(2)} <span className="text-muted">{band}</span>
      </span>
    </span>
  );
}

function StatusGlyph({ status }: { status: Milestone["status"] }) {
  if (status === "found") return <span aria-hidden className="text-base leading-none">●</span>;
  if (status === "not_found") return <span aria-hidden className="text-base leading-none">○</span>;
  return <span aria-hidden className="text-base leading-none">–</span>;
}

const STATUS_TEXT: Record<Milestone["status"], string> = { found: "Found", not_found: "Not found in the sources we searched", not_searched: "Not searched (deeper layers not yet built)" };

export function Ladder({ rows, focalId }: { rows: LadderRow[]; focalId: string }) {
  const { open } = useEvidence();
  const focal = rows.find((r) => r.id === focalId);

  const onCell = (row: LadderRow, m: Milestone) => {
    const ahead = row.id !== focalId && focal && focal.milestones[m.n - 1].status === "not_found" && m.status === "found";
    const detailParts = [STATUS_TEXT[m.status]];
    if (m.detail) detailParts.push(m.detail);
    if (m.status === "not_found") detailParts.push(`Sources searched: ${m.sourcesSearched.join("; ")}.`);
    if (m.flags.length) detailParts.push(`Flags: ${m.flags.join(", ")}.`);
    if (ahead) detailParts.push(`${row.geneSymbol} is ahead of ${focal!.geneSymbol} on this milestone.`);
    open({ title: `${m.label}: ${row.name}`, evidenceIds: m.evidenceIds, detail: detailParts.join(" ") });
  };

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="min-w-[860px] w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-paper text-left font-normal text-muted text-xs uppercase tracking-wide px-4 sm:px-2 py-2 border-b border-line w-[280px]">
              Condition
            </th>
            {MILESTONES.map((m) => (
              <th key={m.n} scope="col" className="font-normal text-muted text-[11px] leading-tight uppercase tracking-wide px-1 py-2 border-b border-line align-bottom w-[70px]">
                <span className="block text-ink-2 serif text-sm normal-case tracking-normal">{m.n}</span>
                {m.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isFocal = row.id === focalId;
            return (
              <tr key={row.id} className={isFocal ? "bg-[#fffbea]" : "hover:bg-white/60"}>
                <th scope="row" className={`sticky left-0 z-10 text-left font-normal px-4 sm:px-2 py-2 border-b border-line align-top ${isFocal ? "bg-[#fffbea]" : "bg-paper"}`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5">
                      <RoadDot roadId={row.roadId} title={row.roadLabel} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <Link href={row.href} className="font-medium text-ink hover:underline truncate max-w-[200px] inline-block align-bottom" title={row.name}>
                          {row.geneSymbol}
                        </Link>
                        {isFocal && <span className="text-[11px] uppercase tracking-wide text-warn">your road</span>}
                        {row.depth === "shallow" && <span className="text-[11px] text-muted">shallow</span>}
                      </div>
                      <div className="text-xs text-ink-2 truncate max-w-[220px]" title={row.name}>
                        {row.name}
                      </div>
                      {row.neighbor && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <RelationChip relation={row.neighbor.relation} curatedRelation={row.neighbor.curatedRelation} />
                          <SimilarityBar value={row.neighbor.similarity} band={row.neighbor.band} />
                        </div>
                      )}
                    </div>
                  </div>
                </th>
                {row.milestones.map((m) => {
                  const ahead = !isFocal && focal && focal.milestones[m.n - 1].status === "not_found" && m.status === "found";
                  const cls = m.status === "found" ? "cell-found" : m.status === "not_found" ? "cell-notfound" : "cell-notsearched";
                  return (
                    <td key={m.n} className="border-b border-line p-1 align-middle text-center">
                      <button
                        type="button"
                        onClick={() => onCell(row, m)}
                        aria-label={`${m.label} for ${row.name}: ${STATUS_TEXT[m.status]}${ahead ? ", ahead of your condition" : ""}. Open evidence.`}
                        title={`${m.label}: ${STATUS_TEXT[m.status]}${m.detail ? " — " + m.detail : ""}`}
                        className={`w-full h-10 rounded flex flex-col items-center justify-center gap-0 ${cls} ${ahead ? "cell-ahead" : ""} hover:brightness-95 focus-visible:outline-2`}
                      >
                        <StatusGlyph status={m.status} />
                        {m.flags.length > 0 && m.status === "found" && <span className="text-[9px] leading-none opacity-80">{m.flags[0].startsWith("support") ? m.flags[0].replace("support: ", "") : m.flags[0].includes("unverified") ? "unverified" : m.flags[0] === "auto-checked" || m.flags[0] === "org auto-checked" ? "auto" : m.flags[0].startsWith("status:") ? "inactive" : m.flags[0] === "few records" ? "few" : m.flags[0] === "symptoms only" ? "symptoms" : m.flags[0] === "targets genetic cause" ? "cause" : m.flags[0] === "acts on pathway" ? "pathway" : m.flags[0].startsWith("single") ? "1 study" : "flag"}</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted px-4 sm:px-2 py-2">
        <span>
          <span className="inline-block w-3 h-3 rounded cell-found align-middle mr-1" /> found, with evidence
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded cell-notfound align-middle mr-1" /> not found in the sources we searched
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded border border-line-2 align-middle mr-1" /> not searched
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded cell-found cell-ahead align-middle mr-1" /> neighbor is ahead
        </span>
        <span>Click any cell to open its evidence.</span>
      </div>
    </div>
  );
}
