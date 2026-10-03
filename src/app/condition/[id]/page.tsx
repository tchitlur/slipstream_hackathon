import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCondition, getNeighbors, getLadder, getEvidence, getStore, getOrgsFor, getInvestigatorsFor, collectEvidenceIds, conditionIdFromSlug, conditionHref, roadSlug, getStudiesFor } from "@/lib/data";
import { roadById } from "@/lib/roads";
import { EvidenceProvider, EvidenceLink } from "@/components/EvidenceDrawer";
import { Ladder, type LadderRow, RelationChip, SimilarityBar } from "@/components/Ladder";
import { RoadBadge, Chip, KindBadge } from "@/components/Badges";
import { MILESTONES } from "@/lib/ladder";
import { humanAllelic } from "@/lib/format";
import { SameGeneNotice, VariantNotice } from "@/components/Notices";
import { CommunitySection } from "@/components/CommunitySection";
import { InvestigatorList } from "@/components/InvestigatorList";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getStore()
    .atlas.conditions.filter((c) => c.depth === "deep")
    .map((c) => ({ id: c.id.replace(/^cond:/, "") }));
}
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = getCondition(conditionIdFromSlug(id));
  return { title: c ? `${c.name} · Slipstream` : "Condition · Slipstream" };
}

export default async function ConditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const condId = conditionIdFromSlug(id);
  const c = getCondition(condId);
  if (!c) notFound();
  const store = getStore();
  const road = roadById(c.roadId);
  const ladder = getLadder(c.id);
  const neighborsAll = getNeighbors(c.id);
  const cutoffs = store.similarity.cutoffs ?? { high: 1, medium: 1, edge: 1 };
  const supported = neighborsAll.filter((n) => n.similarity >= cutoffs.medium);
  const shown = (supported.length ? supported : []).slice(0, 8);
  const rows: LadderRow[] = [];
  const toRow = (cid: string, neighbor?: typeof neighborsAll[number]): LadderRow | null => {
    const cc = getCondition(cid);
    const l = getLadder(cid);
    if (!cc || !l) return null;
    return { id: cc.id, name: cc.name, geneSymbol: cc.geneSymbol, roadId: cc.roadId, roadLabel: roadById(cc.roadId)?.label ?? cc.roadId, href: conditionHref(cc.id), depth: cc.depth, milestones: l.milestones, neighbor };
  };
  const focalRow = toRow(c.id);
  if (focalRow) rows.push(focalRow);
  for (const n of shown) {
    const r = toRow(n.id, n);
    if (r) rows.push(r);
  }
  const orgs = getOrgsFor(c.id);
  const sameRoad = store.atlas.conditions.filter((x) => x.roadId === c.roadId && x.id !== c.id);
  const sameRoadIds = sameRoad.map((x) => x.id);
  const investigators = getInvestigatorsFor([c.id, ...sameRoadIds]).sort((a, b) => Number(b.isBridge) - Number(a.isBridge) || b.records.length - a.records.length);
  const studies = getStudiesFor(c.id).filter((s) => s.classification?.aboutCondition);
  const exclusionStudies = studies.filter((s) => s.classification?.excludesMechanism);
  const sameGeneOther = c.sameGeneOtherMechanism.map((id) => getCondition(id)).filter(Boolean);
  const relatedCommunities = neighborsAll.slice(0, 12).map((n) => ({ n, orgs: getOrgsFor(n.id), cond: getCondition(n.id)! })).filter((x) => x.orgs.length > 0).slice(0, 4);

  const evidenceIds = collectEvidenceIds(c, ladder, rows, orgs, investigators, studies, relatedCommunities.map((r) => r.orgs), c.contested);
  if (c.contested) for (const cl of c.contested.claims) evidenceIds.add(cl.evidenceId);
  for (const cl of c.dissentingClaims) evidenceIds.add(cl.evidenceId);
  const evidence = getEvidence(evidenceIds);
  const curatedEv = c.evidenceIds.filter((e) => e.startsWith("ev:g2p:"));
  const manifest = store.manifest;

  return (
    <EvidenceProvider evidence={evidence}>
      <article className="space-y-10">
        {/* 1. Header */}
        <header className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted">
            Your road · <Link href={`/road/${roadSlug(c.roadId)}`} className="hover:underline">{road?.label}</Link>
          </div>
          <h1 className="text-3xl sm:text-4xl leading-tight">{c.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2">
            <span>
              Gene <span className="font-medium text-ink">{c.geneSymbol}</span>
            </span>
            <RoadBadge roadId={c.roadId} />
            <span>{humanAllelic(c.allelicRequirementRaw)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EvidenceLink ids={curatedEv} title={`Mechanism record: ${c.name}`} className="inline-flex">
              <KindBadge kind="curated" />
            </EvidenceLink>
            <Chip tone={c.mechanismSupport === "evidence" ? "ok" : "neutral"} title="Whether the curated mechanism rests on functional evidence or is inferred from variant types">
              mechanism support: {c.mechanismSupport}
            </Chip>
            <Chip tone={c.confidence === "definitive" || c.confidence === "strong" ? "ok" : "warn"}>gene link: {c.confidence}</Chip>
            {c.contested && (
              <EvidenceLink ids={[c.contested.curatedEvidenceId]} contradictingIds={c.contested.claims.map((cl) => cl.evidenceId)} title={`Contested mechanism: ${c.name}`} detail={`Curated: ${c.contested.curatedMechanism}. ${c.contested.claims.length} verified published claim(s) point in a different direction.`} className="inline-flex">
                <Chip tone="warn">contested mechanism</Chip>
              </EvidenceLink>
            )}
            {c.depth === "shallow" && <Chip tone="neutral">mechanism and symptoms only; deeper layers not yet built</Chip>}
          </div>
          {c.synonyms.length > 0 && <p className="text-sm text-muted">Also recorded as: {c.synonyms.slice(0, 3).join("; ")}</p>}
          <VariantNotice geneSymbol={c.geneSymbol} mechanism={c.mechanism} />
          {!c.contested && c.dissentingClaims.length > 0 && (
            <p className="text-sm text-ink-2 max-w-3xl">
              One published paper disagrees with the curated direction (
              {c.dissentingClaims.filter((cl, i, arr) => arr.findIndex((x) => x.pmid === cl.pmid) === i).map((cl, i) => (
                <span key={cl.evidenceId}>
                  {i > 0 && ", "}
                  <EvidenceLink ids={[cl.evidenceId]} title={`Published claim (PMID ${cl.pmid})`}>
                    PMID {cl.pmid}: {cl.direction.replace("_", " ")}
                  </EvidenceLink>
                </span>
              ))}
              ). Below the two-paper threshold for a contested flag; shown for completeness.
            </p>
          )}
          {sameGeneOther.length > 0 && <SameGeneNotice conditions={sameGeneOther.map((o) => ({ id: o!.id, name: o!.name, roadLabel: roadById(o!.roadId)?.label ?? "", href: conditionHref(o!.id), roadId: o!.roadId }))} />}
          {c.contested && (
            <div className="border border-[#fdba74] bg-warn-bg rounded-md p-3 text-sm">
              <div className="font-medium text-warn mb-1">Mechanism is contested</div>
              <p className="text-ink-2">
                Gene2Phenotype records <strong>{c.contested.curatedMechanism}</strong>. {c.contested.claims.length} verified sentence{c.contested.claims.length === 1 ? "" : "s"} from PubMed abstract{new Set(c.contested.claims.map((cl) => cl.pmid)).size === 1 ? "" : "s"} ({new Set(c.contested.claims.map((cl) => cl.pmid)).size} paper{new Set(c.contested.claims.map((cl) => cl.pmid)).size === 1 ? "" : "s"}) point to{" "}
                {Array.from(new Set(c.contested.claims.map((cl) => cl.direction.replace("_", " ")))).join(" or ")}. Both sides are shown in the evidence panel; neither is treated as settled.
              </p>
              <ul className="mt-2 space-y-1">
                {c.contested.claims.filter((cl, i, arr) => arr.findIndex((x) => x.pmid === cl.pmid && x.direction === cl.direction) === i).slice(0, 5).map((cl) => (
                  <li key={cl.evidenceId} className="text-ink-2">
                    <EvidenceLink ids={[cl.evidenceId]} title={`Published claim (PMID ${cl.pmid})`}>
                      PMID {cl.pmid}: {cl.direction.replace("_", " ")} — {cl.mechanism}
                    </EvidenceLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        {/* 2. Community */}
        <CommunitySection condition={{ id: c.id, name: c.name, geneSymbol: c.geneSymbol, depth: c.depth }} orgs={orgs} related={relatedCommunities.map((r) => ({ condition: { id: r.cond.id, name: r.cond.name, geneSymbol: r.cond.geneSymbol, href: conditionHref(r.cond.id) }, similarity: r.n.similarity, relation: r.n.relation, orgs: r.orgs }))} orgsSearched={Object.keys(store.orgs).length > 0} />

        {/* 3. The ladder */}
        <section aria-labelledby="ladder-h">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <h2 id="ladder-h" className="text-2xl">Who is ahead on this road, and who looks alike</h2>
              <p className="text-sm text-ink-2 max-w-3xl mt-1">
                Eight milestones computed from public records. Rows are your condition and its closest phenotype neighbors. Each neighbor carries two separate indicators: the mechanism relation (whether a treatment strategy could even be shared) and phenotype similarity (whether registries and outcome measures could be shared). They are never blended into one score.
              </p>
            </div>
            <div className="text-xs text-muted">
              Similarity cutoffs: high ≥ {cutoffs.high}, medium ≥ {cutoffs.medium}
            </div>
          </div>
          {c.depth === "shallow" && (
            <p className="text-sm border border-line rounded-md p-3 bg-paper-2 mb-3">This condition is in the atlas-wide layer: mechanism and symptoms only. Milestones 3 to 8 were not searched for it, so cells show “not searched”. Neighbors in the deep slice still show their full ladders.</p>
          )}
          {supported.length > 0 ? (
            <Ladder rows={rows} focalId={c.id} />
          ) : (
            <NoSupportedRoute condition={c} neighborsAll={neighborsAll} cutoffs={cutoffs} />
          )}
          {supported.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-base text-ink-2">Open a neighbor to see what can be borrowed</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {shown.map((n) => {
                  const nc = getCondition(n.id)!;
                  const aheadLabels = (n.aheadOn ?? []).map((m) => MILESTONES[m - 1].short);
                  return (
                    <li key={n.id} className="border border-line rounded-md p-3 bg-white/50 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`${conditionHref(c.id)}/with/${nc.id.replace(/^cond:/, "")}`} className="font-medium hover:underline">
                          {nc.geneSymbol} <span className="text-ink-2 font-normal">· {nc.name}</span>
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <RelationChip relation={n.relation} />
                        <SimilarityBar value={n.similarity} band={n.band} />
                      </div>
                      <div className="text-xs text-ink-2">
                        Shared: {n.sharedTop.slice(0, 3).map((t) => t.label).join(", ")}
                        {aheadLabels.length > 0 && <span className="text-ahead"> · ahead on {aheadLabels.join(", ")}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {exclusionStudies.length > 0 && (
            <div className="mt-5 border border-line rounded-md p-3 bg-white/50 text-sm">
              <div className="font-medium mb-1">Why direction matters: eligibility text in trials for this condition</div>
              <ul className="space-y-1">
                {exclusionStudies.map((s) => (
                  <li key={s.id} className="text-ink-2">
                    <EvidenceLink ids={s.evidenceIds.filter((e) => e.endsWith(":excludes"))} title={`${s.id} eligibility`}>
                      {s.id}
                    </EvidenceLink>{" "}
                    excludes <span className="text-ink">{s.classification!.excludesMechanism}</span>: “{s.classification!.excludesQuote?.slice(0, 160)}
                    {(s.classification!.excludesQuote?.length ?? 0) > 160 ? "…" : ""}”
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 4. Who works on this mechanism */}
        <section aria-labelledby="inv-h">
          <h2 id="inv-h" className="text-2xl mb-1">Who works on this mechanism</h2>
          <p className="text-sm text-ink-2 max-w-3xl mb-3">
            Investigators linked by public records (NIH RePORTER projects, ClinicalTrials.gov officials, last authors of mechanism papers) to conditions on the road “{road?.label}”, across gene names. Bridges span more than one road or cluster.
          </p>
          <InvestigatorList investigators={investigators.slice(0, 20)} focalConditionId={c.id} conditionNames={Object.fromEntries(store.atlas.conditions.map((x) => [x.id, `${x.geneSymbol} · ${x.name}`]))} searched={Object.keys(store.investigators).length > 0} />
        </section>

        <p className="text-xs text-muted">
          Atlas built {manifest?.builtAt?.slice(0, 10)} from Gene2Phenotype {manifest?.sources?.g2p?.version}, HPO {manifest?.sources?.hpoa?.version}, ClinicalTrials.gov, NIH RePORTER and PubMed. See <Link href="/method" className="underline">Method</Link>.
        </p>
      </article>
    </EvidenceProvider>
  );
}

function NoSupportedRoute({ condition, neighborsAll, cutoffs }: { condition: { name: string; geneSymbol: string; phenotypeMatch: { termCount: number; method: string }; thinAnnotation: boolean }; neighborsAll: { similarity: number; id: string }[]; cutoffs: { medium: number; high: number } }) {
  const best = neighborsAll[0];
  const bestCond = best ? getCondition(best.id) : undefined;
  return (
    <div className="border border-line-2 rounded-md p-4 bg-white/60 space-y-3">
      <h3 className="text-lg">No supported route yet</h3>
      <p className="text-sm text-ink-2">
        No condition clears the medium similarity cutoff ({cutoffs.medium}) for {condition.name}. This is a real result, not an error: the atlas does not have enough shared, informative phenotype evidence to justify borrowing a registry design or outcome measures from another community.
      </p>
      <dl className="text-sm grid sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted">What was searched</dt>
        <dd>HPO annotations for the cross-referenced disease and the Gene2Phenotype record ({condition.phenotypeMatch.termCount} phenotype terms, matched by {condition.phenotypeMatch.method.replace(/_/g, " ")}), compared against every other condition in the atlas by simGIC.</dd>
        <dt className="text-muted">What is missing</dt>
        <dd>
          {condition.thinAnnotation ? `Only ${condition.phenotypeMatch.termCount} phenotype terms are annotated, so similarity cannot be computed reliably. ` : "The annotated phenotypes are shared mostly with conditions below the cutoff. "}
          {best && bestCond ? `The closest condition is ${bestCond.geneSymbol} (${bestCond.name}) at ${best.similarity.toFixed(2)}.` : "No neighbor has any shared informative phenotype."}
        </dd>
        <dt className="text-muted">Next question worth testing</dt>
        <dd>
          {condition.thinAnnotation
            ? `Would a deeper phenotype description of ${condition.geneSymbol} (for example from a case series or a registry) move it next to a community that already has a natural history study? That is the cheapest experiment: annotate first, then re-run the comparison.`
            : `Does ${condition.geneSymbol} share a mechanism road with a better-resourced community even though the symptoms differ? The road page lists every condition on the same road, which is where a therapeutic strategy, not a registry, could be borrowed.`}
        </dd>
      </dl>
    </div>
  );
}
