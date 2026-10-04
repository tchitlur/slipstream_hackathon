import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore, getLadder, getOrgsFor, getStudiesFor, getInvestigatorsFor, conditionHref, roadIdFromSlug, roadSlug, getEvidence, collectEvidenceIds } from "@/lib/data";
import { ROADS, roadById } from "@/lib/roads";
import { RoadDot, Chip } from "@/components/Badges";
import { MILESTONES } from "@/lib/ladder";
import { EvidenceProvider, EvidenceLink } from "@/components/EvidenceDrawer";
import { humanAllelic } from "@/lib/format";

export const dynamic = "force-static";
export const dynamicParams = true;
export function generateStaticParams() {
  return ROADS.map((r) => ({ roadId: roadSlug(r.id) }));
}

export default async function RoadPage({ params }: { params: Promise<{ roadId: string }> }) {
  const { roadId } = await params;
  const id = roadIdFromSlug(roadId);
  const road = roadById(id);
  if (!road) notFound();
  const store = getStore();
  const conds = store.atlas.conditions.filter((c) => c.roadId === id);
  const rows = conds
    .map((c) => {
      const l = getLadder(c.id);
      const found = l ? l.milestones.filter((m) => m.status === "found").length : 0;
      const studies = getStudiesFor(c.id).filter((s) => s.classification?.aboutCondition);
      const targeted = studies.filter((s) => s.classification!.role === "interventional_targeted");
      const registry = studies.filter((s) => s.classification!.role === "registry" || s.classification!.role === "natural_history");
      return { c, l, found, orgs: getOrgsFor(c.id), targeted, registry };
    })
    .sort((a, b) => (b.c.depth === "deep" ? 1 : 0) - (a.c.depth === "deep" ? 1 : 0) || b.found - a.found || a.c.name.localeCompare(b.c.name));
  const investigators = getInvestigatorsFor(conds.map((c) => c.id)).sort((a, b) => Number(b.isBridge) - Number(a.isBridge) || b.records.length - a.records.length);
  const modalities = new Map<string, number>();
  for (const r of rows) for (const s of r.targeted) {
    const m = s.classification!.modality;
    if (m !== "none" && m !== "unclear") modalities.set(m, (modalities.get(m) ?? 0) + 1);
  }
  const evidence = getEvidence(collectEvidenceIds(rows.map((r) => [r.l, r.orgs, r.targeted, r.registry])));

  return (
    <EvidenceProvider evidence={evidence}>
      <article className="space-y-8">
        <header className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted">Mechanism road</div>
          <h1 className="text-3xl sm:text-4xl flex items-center gap-3">
            <RoadDot roadId={road.id} /> {road.label}
          </h1>
          <p className="text-ink-2 max-w-3xl">{road.description}</p>
          <p className="text-sm text-ink-2 max-w-3xl">
            Every condition on this road breaks the same way, so a therapeutic strategy for one is at least a hypothesis for the others (always subject to confirming the individual variant). This is the view for someone who holds one mechanism and wants every disease it could fit. {conds.length} condition{conds.length === 1 ? "" : "s"}, ranked by readiness.
          </p>
          {modalities.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Targeted-trial modalities on this road:</span>
              {[...modalities.entries()].map(([m, n]) => (
                <Chip key={m}>
                  {m.replace(/_/g, " ")} × {n}
                </Chip>
              ))}
            </div>
          )}
        </header>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-[760px] w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 sm:px-2 py-2 border-b border-line font-normal">Condition</th>
                <th className="px-2 py-2 border-b border-line font-normal">Readiness</th>
                <th className="px-2 py-2 border-b border-line font-normal">Organization</th>
                <th className="px-2 py-2 border-b border-line font-normal">Registry / NHS</th>
                <th className="px-2 py-2 border-b border-line font-normal">Targeted trials</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, l, found, orgs, targeted, registry }) => (
                <tr key={c.id} className="hover:bg-white/60 align-top">
                  <td className="px-4 sm:px-2 py-2 border-b border-line">
                    <Link href={conditionHref(c.id)} className="font-medium hover:underline">
                      {c.geneSymbol}
                    </Link>
                    <div className="text-xs text-ink-2">{c.name}</div>
                    <div className="text-xs text-muted">
                      {humanAllelic(c.allelicRequirementRaw)} · {c.confidence}
                      {c.depth === "shallow" && " · mechanism and symptoms only"}
                    </div>
                  </td>
                  <td className="px-2 py-2 border-b border-line">
                    {l && c.depth === "deep" ? (
                      <div className="flex gap-0.5" aria-label={`${found} of 8 milestones found`}>
                        {l.milestones.map((m) => (
                          <EvidenceLink key={m.n} ids={m.evidenceIds} title={`${m.label}: ${c.name}`} detail={m.status === "found" || m.status === "partial" ? m.detail : m.status === "not_found" ? `Not found. Sources searched: ${m.sourcesSearched.join("; ")}` : "Not searched"} className={`w-5 h-5 rounded-sm text-[10px] flex items-center justify-center ${m.status === "found" ? "cell-found" : m.status === "partial" ? "cell-partial" : m.status === "not_found" ? "cell-notfound" : "border border-line"}`}>
                            {m.n}
                          </EvidenceLink>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">not searched</span>
                    )}
                    {l && c.depth === "deep" && <div className="text-xs text-muted mt-1">{MILESTONES.filter((m) => l.milestones[m.n - 1].status === "found").map((m) => m.short).join(", ") || "none found"}</div>}
                  </td>
                  <td className="px-2 py-2 border-b border-line">
                    {orgs.length ? (
                      orgs.map((o) => (
                        <div key={o.id}>
                          <a href={o.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {o.name}
                          </a>
                          {!o.verified && <span className="text-xs text-muted ml-1">{o.check?.status === "auto" ? `auto-checked ${o.check.date}` : "unchecked"}</span>}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted">{c.depth === "deep" ? "none in seed list" : "not searched"}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 border-b border-line">
                    {registry.length ? (
                      registry.slice(0, 3).map((s) => (
                        <div key={s.id}>
                          <EvidenceLink ids={s.evidenceIds} title={`${s.id}: ${s.briefTitle}`}>
                            {s.id}
                          </EvidenceLink>{" "}
                          <span className="text-xs text-muted">{s.classification!.role.replace(/_/g, " ")}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted">{c.depth === "deep" ? "not found" : "not searched"}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 border-b border-line">
                    {targeted.length ? (
                      targeted.slice(0, 3).map((s) => (
                        <div key={s.id}>
                          <EvidenceLink ids={s.evidenceIds} title={`${s.id}: ${s.briefTitle}`}>
                            {s.id}
                          </EvidenceLink>{" "}
                          <span className="text-xs text-muted">
                            {s.classification!.modality.replace(/_/g, " ")}
                            {s.phases.length ? ", " + s.phases.join("/").toLowerCase().replace(/phase/g, "phase ") : ""}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted">{c.depth === "deep" ? "not found" : "not searched"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section>
          <h2 className="text-2xl mb-1">Investigators on this road</h2>
          <p className="text-sm text-ink-2 mb-3">Linked by public records across the gene names on this road. Bridges span more than one road or cluster.</p>
          {investigators.length ? (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {investigators.slice(0, 30).map((inv) => (
                <li key={inv.id} className="border border-line rounded-md p-2 bg-white/50">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{inv.displayName}</span>
                    {inv.isBridge && <Chip tone="info">bridge</Chip>}
                  </div>
                  <div className="text-xs text-ink-2">{inv.organizations[0]}</div>
                  <div className="text-xs text-muted">
                    {inv.conditionIds
                      .map((cid) => store.conditions.get(cid)?.geneSymbol)
                      .filter(Boolean)
                      .join(", ")}{" "}
                    ·{" "}
                    {inv.records.slice(0, 2).map((r) => (
                      <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="underline mr-1">
                        {r.id}
                      </a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No investigator records for this road yet.</p>
          )}
        </section>

        <nav className="text-sm">
          <div className="text-xs uppercase tracking-wide text-muted mb-1">Other roads</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {ROADS.filter((r) => r.id !== road.id && store.atlas.roads.find((x) => x.id === r.id)?.conditionIds.length).map((r) => (
              <li key={r.id}>
                <Link href={`/road/${roadSlug(r.id)}`} className="underline flex items-center gap-1.5">
                  <RoadDot roadId={r.id} /> {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </EvidenceProvider>
  );
}
