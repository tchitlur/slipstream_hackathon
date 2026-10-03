import type { Investigator } from "@/lib/schemas";
import { Chip } from "./Badges";

export function InvestigatorList({ investigators, focalConditionId, conditionNames, searched }: { investigators: Investigator[]; focalConditionId: string; conditionNames: Record<string, string>; searched: boolean }) {
  if (!searched) return <p className="text-sm text-ink-2 border border-line rounded-md p-3 bg-white/50">Investigator records have not been built for this layer yet (NIH RePORTER and PubMed stages run in phase 2).</p>;
  if (!investigators.length) return <p className="text-sm text-ink-2 border border-line rounded-md p-3 bg-white/50">No investigator was found in NIH RePORTER (last four fiscal years), ClinicalTrials.gov officials or the mechanism literature for this road.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {investigators.map((inv) => (
        <li key={inv.id} className="border border-line rounded-md p-3 bg-white/50 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{inv.displayName}</span>
            {inv.isBridge && (
              <Chip tone="info" title={inv.bridgeReason}>
                bridge
              </Chip>
            )}
            {inv.conditionIds.includes(focalConditionId) && <Chip tone="neutral">works on this condition</Chip>}
          </div>
          {inv.organizations.length > 0 && <div className="text-ink-2 text-xs mt-0.5">{inv.organizations.slice(0, 2).join("; ")}</div>}
          <div className="text-xs text-ink-2 mt-1">
            {inv.conditionIds
              .slice(0, 4)
              .map((cid) => conditionNames[cid] ?? cid)
              .join(" · ")}
            {inv.conditionIds.length > 4 && ` · +${inv.conditionIds.length - 4}`}
          </div>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {inv.records.slice(0, 4).map((r) => (
              <li key={r.kind + r.id}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {r.kind === "grant" ? "RePORTER " : r.kind === "study" ? "" : "PMID "}
                  {r.id}
                </a>{" "}
                <span className="text-muted">({r.role})</span>
              </li>
            ))}
            {inv.records.length > 4 && <li className="text-muted">+{inv.records.length - 4} more</li>}
          </ul>
        </li>
      ))}
    </ul>
  );
}
