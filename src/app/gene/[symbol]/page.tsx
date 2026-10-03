import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore, conditionHref } from "@/lib/data";
import { RoadBadge, Chip } from "@/components/Badges";
import { ResolvedNotice } from "@/components/ResolvedNotice";

export const dynamic = "force-static";
export const dynamicParams = true;
export function generateStaticParams() {
  return getStore().atlas.genes.filter((g) => g.depth === "deep").map((g) => ({ symbol: g.symbol }));
}

export default async function GenePage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ via?: string; q?: string }> }) {
  const { symbol } = await params;
  const sp = await searchParams;
  const store = getStore();
  const gene = store.atlas.genes.find((g) => g.symbol.toUpperCase() === symbol.toUpperCase());
  if (!gene) notFound();
  const conds = gene.conditionIds.map((id) => store.conditions.get(id)!).filter(Boolean);
  return (
    <div className="space-y-6">
      <ResolvedNotice via={sp.via} q={sp.q} shown={gene.symbol} />
      <header>
        <div className="text-xs uppercase tracking-wide text-muted">Gene</div>
        <h1 className="text-3xl">{gene.symbol}</h1>
        {gene.aliases.length > 0 && <p className="text-sm text-ink-2">Previous symbols: {gene.aliases.join(", ")}</p>}
      </header>
      <section>
        <h2 className="text-xl mb-2">Conditions curated for this gene</h2>
        <p className="text-sm text-ink-2 mb-3">The same gene can cause more than one condition with different mechanisms. Each is a separate node, because only conditions on the same road can share a treatment strategy.</p>
        <ul className="space-y-2">
          {conds.map((c) => (
            <li key={c.id} className="border border-line rounded-md p-3 bg-white/50">
              <Link href={conditionHref(c.id)} className="font-medium underline">
                {c.name}
              </Link>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
                <RoadBadge roadId={c.roadId} />
                <Chip>{c.allelicRequirementRaw.replace(/_/g, " ")}</Chip>
                <Chip>{c.confidence}</Chip>
                {c.depth === "shallow" && <Chip>mechanism and symptoms only</Chip>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {gene.hpoDiseaseNames.length > 0 && (
        <section>
          <h2 className="text-xl mb-2">Disease names annotated to this gene in HPO</h2>
          <ul className="text-sm text-ink-2 columns-1 sm:columns-2">
            {gene.hpoDiseaseNames.map((d) => (
              <li key={d.id}>
                {d.name} <span className="text-muted">({d.id})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
