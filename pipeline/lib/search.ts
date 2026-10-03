import { readValidated, writeJson, log } from "./io";
import { files } from "./paths";
import { AtlasSchema, PhenotypesFileSchema, OrgsFileSchema, type SearchDoc } from "../../src/lib/schemas";
import { readJsonOr } from "./io";
import { roadById } from "../../src/lib/roads";

export function buildSearchIndex() {
  const atlas = readValidated(files.atlas, AtlasSchema);
  const ph = readValidated(files.phenotypes, PhenotypesFileSchema);
  const orgsFile = readJsonOr<{ orgs: Record<string, unknown> } | null>(files.orgs, null);
  const orgs = orgsFile ? Object.values(OrgsFileSchema.parse(orgsFile).orgs) : [];
  const docs: SearchDoc[] = [];
  const synonyms: Record<string, string> = {};
  const geneById = new Map(atlas.genes.map((g) => [g.id, g]));
  for (const c of atlas.conditions) {
    const g = geneById.get(c.geneId);
    const road = roadById(c.roadId);
    const syn = [...c.synonyms, ...(g?.hpoDiseaseNames.map((d) => d.name) ?? [])];
    docs.push({
      id: c.id,
      type: "condition",
      title: c.name,
      subtitle: `${c.geneSymbol} · ${road?.label ?? ""}${c.depth === "shallow" ? " · mechanism and symptoms only" : ""}`,
      text: [c.geneSymbol, ...(g?.aliases ?? []), ...syn, c.mechanism, road?.label ?? "", c.diseaseMim ? `OMIM:${c.diseaseMim}` : "", c.diseaseMondo ?? "", c.g2pId].join(" | "),
      href: `/condition/${c.g2pId}`,
      weight: c.depth === "deep" ? 2 : 1,
    });
    for (const s of syn) synonyms[s.toLowerCase()] = c.id;
  }
  for (const g of atlas.genes) {
    docs.push({ id: g.id, type: "gene", title: g.symbol, subtitle: `${g.conditionIds.length} condition${g.conditionIds.length === 1 ? "" : "s"}${g.aliases.length ? " · also " + g.aliases.slice(0, 4).join(", ") : ""}`, text: [g.symbol, ...g.aliases, ...g.hpoDiseaseNames.map((d) => d.name)].join(" | "), href: `/gene/${g.symbol}`, weight: g.depth === "deep" ? 2 : 1 });
  }
  const direct = new Set<string>();
  for (const terms of Object.values(ph.conditionTerms)) for (const t of terms) direct.add(t);
  for (const t of direct) {
    const term = ph.terms[t];
    if (!term) continue;
    docs.push({ id: t, type: "phenotype", title: term.label, subtitle: `${t} · information content ${term.ic.toFixed(2)}`, text: `${term.label} ${t}`, href: `/phenotype/${t.replace(":", "_")}`, weight: 1 });
  }
  for (const o of orgs) {
    docs.push({ id: o.id, type: "org", title: o.name, subtitle: `patient organization${o.verified ? "" : " (unverified listing)"}`, text: [o.name, ...o.conditions].join(" | "), href: o.conditionIds[0] ? `/condition/${o.conditionIds[0].replace(/^cond:/, "")}` : "/", weight: 1 });
  }
  for (const r of atlas.roads) {
    if (!r.conditionIds.length) continue;
    docs.push({ id: r.id, type: "road", title: r.label, subtitle: `${r.mechanism} · ${r.conditionIds.length} conditions`, text: `${r.label} ${r.description} ${r.mechanism} haploinsufficiency`, href: `/road/${r.id.replace(/^road:/, "").replace(/:/g, "-")}`, weight: 1 });
  }
  writeJson(files.searchIndex, { docs, synonyms }, { pretty: false });
  log("S10", `search index: ${docs.length} docs (${docs.filter((d) => d.type === "phenotype").length} phenotypes), ${Object.keys(synonyms).length} synonyms`);
  return docs.length;
}
