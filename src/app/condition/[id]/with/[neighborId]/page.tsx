import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCondition, getNeighbors, getLadder, getEvidence, getStore, getOrgsFor, getStudiesFor, getTransferPair, getBrief, collectEvidenceIds, conditionIdFromSlug, conditionHref, roadSlug } from "@/lib/data";
import { roadById } from "@/lib/roads";
import { EvidenceProvider, EvidenceLink } from "@/components/EvidenceDrawer";
import { RelationChip, SimilarityBar } from "@/components/Ladder";
import { RoadBadge, Chip } from "@/components/Badges";
import { BorrowCard } from "@/components/BorrowCard";
import { BriefView } from "@/components/BriefView";
import { MILESTONES } from "@/lib/ladder";
import { humanAllelic } from "@/lib/format";

export const dynamic = "force-static";
export const dynamicParams = true;

export function generateStaticParams() {
  const store = getStore();
  const out: { id: string; neighborId: string }[] = [];
  for (const c of store.atlas.conditions.filter((c) => c.depth === "deep")) {
    for (const n of (store.similarity.neighbors[c.id] ?? []).slice(0, 8)) out.push({ id: c.id.replace(/^cond:/, ""), neighborId: n.id.replace(/^cond:/, "") });
  }
  return out;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; neighborId: string }> }): Promise<Metadata> {
  const { id, neighborId } = await params;
  const a = getCondition(conditionIdFromSlug(id));
  const b = getCondition(conditionIdFromSlug(neighborId));
  return { title: a && b ? `${a.geneSymbol} with ${b.geneSymbol} · Slipstream` : "Borrow · Slipstream" };
}

export default async function BorrowPage({ params }: { params: Promise<{ id: string; neighborId: string }> }) {
  const { id, neighborId } = await params;
  const focal = getCondition(conditionIdFromSlug(id));
  const nb = getCondition(conditionIdFromSlug(neighborId));
  if (!focal || !nb) notFound();
  const edge = getNeighbors(focal.id).find((n) => n.id === nb.id);
  const pair = getTransferPair(focal.id, nb.id);
  const fl = getLadder(focal.id);
  const nl = getLadder(nb.id);
  const store = getStore();
  const nbOrgs = getOrgsFor(nb.id);
  const nbStudies = getStudiesFor(nb.id).filter((s) => s.classification?.aboutCondition);
  const targeted = nbStudies.filter((s) => s.classification!.role === "interventional_targeted");
  const brief = getBrief(focal.id, nb.id);
  const ph = store.phenotypes;
  const focalTerms = new Set(ph?.conditionTerms[focal.id] ?? []);
  const nbTerms = new Set(ph?.conditionTerms[nb.id] ?? []);
  const onlyFocal = [...focalTerms].filter((t) => !nbTerms.has(t)).map((t) => ph!.terms[t]).filter(Boolean).sort((a, b) => b.ic - a.ic).slice(0, 5);
  const onlyNb = [...nbTerms].filter((t) => !focalTerms.has(t)).map((t) => ph!.terms[t]).filter(Boolean).sort((a, b) => b.ic - a.ic).slice(0, 5);

  const evidenceIds = collectEvidenceIds(focal, nb, edge, pair, fl, nl, nbOrgs, nbStudies, brief);
  if (focal.contested) {
    evidenceIds.add(focal.contested.curatedEvidenceId);
    focal.contested.claims.forEach((c) => evidenceIds.add(c.evidenceId));
  }
  if (nb.contested) {
    evidenceIds.add(nb.contested.curatedEvidenceId);
    nb.contested.claims.forEach((c) => evidenceIds.add(c.evidenceId));
  }
  const evidence = getEvidence(evidenceIds);
  const ahead = (edge?.aheadOn ?? []).map((m) => MILESTONES[m - 1]);

  if (!edge || !pair || !fl || !nl) {
    return (
      <div className="space-y-4">
        <Link href={conditionHref(focal.id)} className="text-sm underline">← {focal.name}</Link>
        <h1 className="text-3xl">{focal.geneSymbol} with {nb.geneSymbol}</h1>
        <p className="text-ink-2 border border-line rounded-md p-4 bg-white/50">
          {focal.depth === "shallow"
            ? `${focal.name} is in the atlas-wide layer (mechanism and symptoms only), so transfer verdicts were not computed for it. The deeper layers are built for the ${store.atlas.conditions.filter((c) => c.depth === "deep").length} deep-slice conditions.`
            : `${nb.name} is not among the computed neighbors of ${focal.name}, so there is no evidence pack for this pair.`}
        </p>
      </div>
    );
  }

  return (
    <EvidenceProvider evidence={evidence}>
      <article className="space-y-10">
        <div className="text-sm">
          <Link href={conditionHref(focal.id)} className="underline">← Back to {focal.name}</Link>
        </div>
        <header className="space-y-4">
          <div className="text-xs uppercase tracking-wide text-muted">What can be borrowed</div>
          <h1 className="text-3xl sm:text-4xl leading-tight">
            {focal.geneSymbol} <span className="text-muted">with</span> {nb.geneSymbol}
          </h1>
          <div className="grid sm:grid-cols-2 gap-4">
            {[focal, nb].map((c, i) => {
              const l = i === 0 ? fl : nl;
              return (
                <div key={c.id} className={`border rounded-md p-4 ${i === 0 ? "border-[#f5d58a] bg-[#fffbea]" : "border-line bg-white/60"}`}>
                  <div className="text-xs uppercase tracking-wide text-muted">{i === 0 ? "Your condition" : "The neighbor"}</div>
                  <div className="font-medium text-lg leading-snug">
                    <Link href={conditionHref(c.id)} className="hover:underline">
                      {c.name}
                    </Link>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <RoadBadge roadId={c.roadId} size="sm" />
                    <span className="text-ink-2">{humanAllelic(c.allelicRequirementRaw)}</span>
                    <Chip tone={c.mechanismSupport === "evidence" ? "ok" : "neutral"}>support: {c.mechanismSupport}</Chip>
                    {c.contested && <Chip tone="warn">contested</Chip>}
                  </div>
                  <div className="mt-2 text-xs text-ink-2">
                    Milestones found: {l.milestones.filter((m) => m.status === "found").map((m) => m.n).join(", ") || "none"}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-2">
              Mechanism relation <RelationChip relation={edge.relation} />
            </span>
            <span className="flex items-center gap-2">
              Phenotype similarity <SimilarityBar value={edge.similarity} band={edge.band} />
            </span>
            {ahead.length > 0 && <span className="text-ahead">{nb.geneSymbol} is ahead on: {ahead.map((m) => m.label.toLowerCase()).join(", ")}</span>}
          </div>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted mb-1">Shared informative features</div>
              <ul className="space-y-0.5">
                {edge.sharedTop.map((t) => (
                  <li key={t.id}>
                    <Link href={`/phenotype/${t.id.replace(":", "_")}`} className="hover:underline">
                      {t.label}
                    </Link>{" "}
                    <span className="text-muted text-xs">IC {t.ic.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
              <EvidenceLink ids={edge.evidenceIds} title={`Phenotype similarity ${focal.geneSymbol} and ${nb.geneSymbol}`} detail={`simGIC ${edge.similarity} over ${edge.sharedCount ?? "?"} shared terms; ${Math.round(edge.lowInfoShare * 100)}% of shared weight from low-information terms.`} className="text-xs text-muted underline decoration-dotted mt-1 inline-block">
                how this was calculated
              </EvidenceLink>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted mb-1">Recorded for {focal.geneSymbol} only</div>
              <ul className="space-y-0.5 text-ink-2">{onlyFocal.length ? onlyFocal.map((t) => <li key={t.id}>{t.label}</li>) : <li className="text-muted">none above the shared set</li>}</ul>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted mb-1">Recorded for {nb.geneSymbol} only</div>
              <ul className="space-y-0.5 text-ink-2">{onlyNb.length ? onlyNb.map((t) => <li key={t.id}>{t.label}</li>) : <li className="text-muted">none above the shared set</li>}</ul>
            </div>
          </div>
        </header>

        <section aria-labelledby="cards-h">
          <h2 id="cards-h" className="text-2xl mb-1">What can be borrowed, and what must not</h2>
          <p className="text-sm text-ink-2 max-w-3xl mb-4">
            One card per asset type. Each verdict comes from a typed rule (read them on the <Link href="/method#rules" className="underline">Method page</Link>), is marked as a hypothesis for expert review, and shows the strongest reason it might be wrong.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {pair.verdicts.map((v) => (
              <BorrowCard key={v.ruleId} v={v} neighborName={nb.geneSymbol} eligibility={v.ruleId === "R7" ? targeted.filter((s) => s.eligibilityExcerpt).map((s) => ({ id: s.id, title: s.briefTitle, excerpt: s.eligibilityExcerpt!, url: `https://clinicaltrials.gov/study/${s.id}`, evidenceId: s.evidenceIds[0] })) : undefined} />
            ))}
          </div>
        </section>

        <section aria-labelledby="q-h">
          <h2 id="q-h" className="text-2xl mb-1">Questions to take to an expert</h2>
          <p className="text-sm text-ink-2 mb-3">Generated from the counter-reasons that fired for this pair.</p>
          <ol className="list-decimal pl-5 space-y-1 text-[15px] max-w-3xl">
            {pair.expertQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>

        <BriefView focalId={focal.id} neighborId={nb.id} pregenerated={brief} evidence={evidence} neighborName={nb.geneSymbol} />

        <p className="text-xs text-muted">
          Road pages: <Link href={`/road/${roadSlug(focal.roadId)}`} className="underline">{roadById(focal.roadId)?.label}</Link>
          {focal.roadId !== nb.roadId && (
            <>
              {" · "}
              <Link href={`/road/${roadSlug(nb.roadId)}`} className="underline">{roadById(nb.roadId)?.label}</Link>
            </>
          )}
        </p>
      </article>
    </EvidenceProvider>
  );
}
