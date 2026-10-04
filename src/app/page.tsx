import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { getStore, getDemoCandidates, getCondition, conditionHref } from "@/lib/data";
import { RoadDot } from "@/components/Badges";
import { roadById } from "@/lib/roads";

export default function Home() {
  const store = getStore();
  const m = store.manifest;
  // Three examples pointing at three different neighbors ahead, where the candidate list allows it.
  const demoAll = getDemoCandidates();
  const demo: typeof demoAll = [];
  const usedNeighbors = new Set<string>();
  const usedConditions = new Set<string>();
  for (const d of demoAll) {
    if (demo.length >= 3 || usedConditions.has(d.conditionId)) continue;
    const neighborId = !usedNeighbors.has(d.neighborId) ? d.neighborId : (d.alternativeNeighborIds ?? []).find((id) => !usedNeighbors.has(id));
    if (!neighborId) continue;
    demo.push({ ...d, neighborId });
    usedNeighbors.add(neighborId);
    usedConditions.add(d.conditionId);
  }
  for (const d of demoAll) if (demo.length < 3 && !usedConditions.has(d.conditionId)) {
    demo.push(d);
    usedConditions.add(d.conditionId);
  }
  const fallback = store.atlas.conditions.filter((c) => c.depth === "deep").slice(0, 3);
  const examples = demo.length
    ? demo.map((d) => ({ c: getCondition(d.conditionId)!, nb: getCondition(d.neighborId), reason: d.reason }))
    : fallback.map((c) => ({ c, nb: undefined, reason: "" }));
  const deep = store.atlas.conditions.filter((c) => c.depth === "deep").length;
  const shallow = store.atlas.conditions.length - deep;

  return (
    <div className="max-w-3xl mx-auto pt-10 sm:pt-20 space-y-10">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl sm:text-5xl leading-tight">Which community is further along your road?</h1>
        <p className="text-ink-2 text-lg max-w-2xl mx-auto">
          Type a gene or a diagnosis. Slipstream shows which rare-disease communities break the same way, which ones only look alike, what you can borrow from them, and what you must not.
        </p>
      </div>
      <SearchBox autoFocus />
      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Examples</div>
        <ul className="grid gap-2 sm:grid-cols-3">
          {examples.map(({ c, nb }) => (
            <li key={c.id}>
              <Link href={conditionHref(c.id)} className="block border border-line rounded-md p-3 bg-white/50 hover:bg-white h-full">
                <div className="flex items-center gap-2 font-medium">
                  <RoadDot roadId={c.roadId} /> {c.geneSymbol}
                </div>
                <div className="text-sm text-ink-2 leading-snug">{c.name}</div>
                <div className="text-xs text-muted mt-1">{roadById(c.roadId)?.label}</div>
                {nb && <div className="text-xs text-accent mt-1">neighbor ahead: {nb.geneSymbol}</div>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-muted text-center">
        Covers {deep} conditions across {store.atlas.genes.filter((g) => g.depth === "deep").length} genes in developmental and epileptic encephalopathies and related disorders in depth
        {shallow > 0 ? `, plus ${shallow} conditions from the Gene2Phenotype developmental disorders panel at mechanism-and-symptoms depth` : ""}. Built {m?.builtAt?.slice(0, 10) ?? "—"} from Gene2Phenotype, the Human Phenotype Ontology, ClinicalTrials.gov, NIH RePORTER and PubMed.{" "}
        <Link href="/method" className="underline">
          How it works
        </Link>
      </p>
    </div>
  );
}
