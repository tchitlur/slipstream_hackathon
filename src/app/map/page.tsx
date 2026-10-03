import Link from "next/link";
import { getStore, conditionHref, roadSlug } from "@/lib/data";
import { ROADS, roadById } from "@/lib/roads";
import { MapCanvas, type MapNode, type MapCluster } from "@/components/MapCanvas";
import { RoadDot } from "@/components/Badges";

export const dynamic = "force-static";

export default function MapPage() {
  const store = getStore();
  const layout = store.layout;
  const nodes: MapNode[] = [];
  if (layout) {
    for (const [id, p] of Object.entries(layout.nodes)) {
      const c = store.conditions.get(id);
      if (!c) continue;
      nodes.push({ id, x: p.x, y: p.y, name: c.name, gene: c.geneSymbol, roadId: c.roadId, color: roadById(c.roadId)?.color ?? "#999", depth: c.depth, clusterId: c.clusterId, href: conditionHref(id) });
    }
  }
  const clusters: MapCluster[] = [...store.atlas.clusters]
    .sort((a, b) => b.memberIds.length - a.memberIds.length)
    .slice(0, 10)
    .filter((cl) => cl.memberIds.length >= 3)
    .map((cl) => {
      const pts = cl.memberIds.map((m) => layout?.nodes[m]).filter(Boolean) as { x: number; y: number }[];
      const x = pts.reduce((a, p) => a + p.x, 0) / (pts.length || 1);
      const y = pts.reduce((a, p) => a + p.y, 0) / (pts.length || 1);
      return { id: cl.id, label: cl.label, x, y, size: cl.memberIds.length };
    });
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">Map</h1>
        <p className="text-ink-2 max-w-3xl">
          Conditions placed by phenotype similarity (a precomputed force layout over edges above the cluster threshold of {layout?.threshold ?? "—"}), colored by mechanism road. Clusters are Louvain communities named by their most informative shared phenotypes. Lighter dots are atlas-wide conditions with mechanism and symptoms only; edges are drawn only where a deep-slice condition is involved, to keep the picture legible. Hover for the name; click to open. The ladder on each condition page is the primary view; this map is the overview.
        </p>
      </header>
      {nodes.length ? <MapCanvas nodes={nodes} edges={layout!.edges.filter(([a, b]) => store.conditions.get(a)?.depth === "deep" || store.conditions.get(b)?.depth === "deep")} clusters={clusters} /> : <p className="text-ink-2">No layout has been built yet.</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {ROADS.filter((r) => nodes.some((n) => n.roadId === r.id)).map((r) => (
          <Link key={r.id} href={`/road/${roadSlug(r.id)}`} className="flex items-center gap-1.5 hover:underline">
            <RoadDot roadId={r.id} /> {r.label}
          </Link>
        ))}
      </div>
      <section>
        <h2 className="text-2xl mb-2">Clusters</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {store.atlas.clusters.filter((cl) => cl.memberIds.length >= 2 || cl.memberIds.some((m) => store.conditions.get(m)?.depth === "deep")).slice(0, 60).map((cl) => (
            <li key={cl.id} className="border border-line rounded-md p-3 bg-white/50">
              <div className="font-medium">{cl.label}</div>
              <div className="text-xs text-muted mb-1">
                {cl.memberIds.length} condition{cl.memberIds.length === 1 ? "" : "s"} · {cl.topPhenotypes.map((t) => `${t.label} (${Math.round(t.share * 100)}%)`).slice(0, 3).join(", ")}
              </div>
              <div className="text-xs text-ink-2 flex flex-wrap gap-x-2">
                {cl.memberIds.slice(0, 14).map((m) => {
                  const c = store.conditions.get(m);
                  return c ? (
                    <Link key={m} href={conditionHref(m)} className="hover:underline inline-flex items-center gap-1">
                      <RoadDot roadId={c.roadId} /> {c.geneSymbol}
                    </Link>
                  ) : null;
                })}
                {cl.memberIds.length > 14 && <span className="text-muted">+{cl.memberIds.length - 14}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
