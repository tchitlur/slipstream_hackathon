import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore, conditionHref } from "@/lib/data";
import { RoadDot } from "@/components/Badges";
import { closureOf } from "@/lib/similarity";

export const dynamic = "force-static";
export const dynamicParams = true;
export function generateStaticParams() {
  return [] as { id: string }[];
}

export default async function PhenotypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hp = id.replace("_", ":");
  const store = getStore();
  const term = store.phenotypes?.terms[hp];
  if (!term || !store.phenotypes) notFound();
  const ph = store.phenotypes;
  const carriers = store.atlas.conditions
    .map((c) => {
      const direct = (ph.conditionTerms[c.id] ?? []).includes(hp);
      const inClosure = direct || closureOf(ph.conditionTerms[c.id] ?? [], (t) => ph.terms[t]?.parents ?? []).has(hp);
      return { c, direct, inClosure };
    })
    .filter((x) => x.inClosure)
    .sort((a, b) => Number(b.direct) - Number(a.direct) || (b.c.depth === "deep" ? 1 : 0) - (a.c.depth === "deep" ? 1 : 0));
  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-wide text-muted">Symptom or feature</div>
        <h1 className="text-3xl">{term.label}</h1>
        <p className="text-sm text-ink-2">
          <a href={`https://hpo.jax.org/browse/term/${hp}`} target="_blank" rel="noopener noreferrer" className="underline">
            {hp}
          </a>{" "}
          · information content {term.ic.toFixed(2)} (higher means rarer across annotated diseases, so more informative when shared)
        </p>
      </header>
      <section>
        <h2 className="text-xl mb-2">
          {carriers.length} condition{carriers.length === 1 ? "" : "s"} in the atlas carry this feature
        </h2>
        <ul className="grid gap-1 sm:grid-cols-2 text-sm">
          {carriers.map(({ c, direct }) => (
            <li key={c.id} className="flex items-center gap-2">
              <RoadDot roadId={c.roadId} />
              <Link href={conditionHref(c.id)} className="underline">
                {c.geneSymbol} · {c.name}
              </Link>
              {!direct && <span className="text-xs text-muted">(via a more specific term)</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
