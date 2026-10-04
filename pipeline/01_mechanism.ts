/**
 * S1 Mechanism: load Gene2Phenotype records and create Condition, Gene and Road nodes
 * with curated evidence. Deep slice = --genes or data/seed/genes.txt. --all adds the whole
 * DD panel as shallow conditions (phase 4).
 */
import path from "node:path";
import { parseArgs, deepGenes } from "./lib/args";
import { downloadCached } from "./lib/http";
import { readText, writeJson, log, uniq, nowIso } from "./lib/io";
import { parseCsv } from "./lib/csv";
import { files } from "./lib/paths";
import { writeEvidence } from "./lib/evidence";
import { updateManifest } from "./lib/manifest";
import { ROADS, roadIdFor, allelicClassOf } from "../src/lib/roads";
import { Mechanism, MechanismSupport, G2PConfidence, type Condition, type Gene, type Road, type Evidence, type Atlas } from "../src/lib/schemas";

const G2P_RELEASE = process.env.G2P_RELEASE ?? "2026_09_28";
const G2P_FILE = `DDG2P_${G2P_RELEASE.replace(/_/g, "-")}.csv.gz`;
const G2P_URL = `https://ftp.ebi.ac.uk/pub/databases/gene2phenotype/G2P_data_downloads/${G2P_RELEASE}/${G2P_FILE}`;

function splitList(s: string): string[] {
  return s
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Synonyms we can derive deterministically from the curated name. */
function synonymsFor(name: string, symbol: string): string[] {
  const out = new Set<string>();
  const stripped = name.replace(new RegExp(`^${symbol}-related\\s+`, "i"), "");
  if (stripped !== name) out.add(stripped);
  out.add(name.replace(/-related/i, ""));
  out.delete(name);
  return [...out].filter((s) => s.length > 3);
}

async function main() {
  const args = parseArgs();
  const deep = new Set(deepGenes(args));
  const dl = await downloadCached(G2P_URL, path.join("g2p", G2P_FILE), { gzip: true });
  const rows = parseCsv(readText(dl.path));
  log("S1", `G2P DD panel ${G2P_RELEASE}: ${rows.length} records (${dl.fromCache ? "cached" : "downloaded"})`);

  const selected = rows.filter((r) => args.all || deep.has(r["gene symbol"].toUpperCase()));
  const presentGenes = new Set(rows.map((r) => r["gene symbol"].toUpperCase()));
  const dropped = [...deep].filter((g) => !presentGenes.has(g)).map((symbol) => ({ symbol, reason: "no record in the Gene2Phenotype DD panel" }));
  for (const d of dropped) log("S1", `dropping ${d.symbol}: ${d.reason}`);

  const conditions: Condition[] = [];
  const evidence: Evidence[] = [];
  const genes = new Map<string, Gene>();
  const retrievedAt = dl.retrievedAt.slice(0, 10);

  for (const r of selected) {
    const g2pId = r["g2p id"];
    const symbol = r["gene symbol"].toUpperCase();
    const hgnc = r["hgnc id"];
    const mech = Mechanism.safeParse(r["molecular mechanism"]);
    const support = MechanismSupport.safeParse(r["molecular mechanism support"]);
    const conf = G2PConfidence.safeParse(r["confidence"]);
    if (!mech.success || !support.success || !conf.success) {
      log("S1", `skipping ${g2pId}: unparseable mechanism/support/confidence (${r["molecular mechanism"]}/${r["molecular mechanism support"]}/${r["confidence"]})`);
      continue;
    }
    const geneId = `gene:HGNC:${hgnc}`;
    const evId = `ev:g2p:${g2pId}`;
    const isDeep = deep.has(symbol);
    evidence.push({
      id: evId,
      kind: "curated",
      source: "g2p",
      sourceId: g2pId,
      url: `https://www.ebi.ac.uk/gene2phenotype/lgd/${g2pId}`,
      retrievedAt,
      confidence: conf.data === "definitive" || conf.data === "strong" ? "high" : conf.data === "moderate" ? "medium" : "low",
      title: `Gene2Phenotype record ${g2pId}`,
      note: `${r["disease name"]}: ${r["allelic requirement"]}, mechanism "${mech.data}" (${support.data}), confidence ${conf.data}${r["molecular mechanism categorisation"] ? ", categorisation: " + r["molecular mechanism categorisation"] : ""}${r["molecular mechanism evidence"] ? ", mechanism evidence: " + r["molecular mechanism evidence"] : ""}. Publications: ${splitList(r["publications"]).slice(0, 8).map((p) => "PMID:" + p).join(", ")}${splitList(r["publications"]).length > 8 ? " and more" : ""}.`,
    });
    const cond: Condition = {
      id: `cond:${g2pId}`,
      g2pId,
      name: r["disease name"],
      synonyms: synonymsFor(r["disease name"], symbol),
      geneId,
      geneSymbol: symbol,
      diseaseMim: r["disease mim"] || undefined,
      diseaseMondo: r["disease MONDO"] || undefined,
      allelicRequirementRaw: r["allelic requirement"],
      allelicClass: allelicClassOf(r["allelic requirement"]),
      mechanism: mech.data,
      mechanismSupport: support.data,
      mechanismCategorisation: r["molecular mechanism categorisation"] || undefined,
      confidence: conf.data,
      roadId: roadIdFor(r["allelic requirement"], mech.data),
      depth: isDeep ? "deep" : "shallow",
      publications: splitList(r["publications"]),
      curatedPhenotypeIds: splitList(r["phenotypes"]).filter((t) => /^HP:\d{7}$/.test(t)),
      evidenceIds: [evId],
      phenotypeMatch: { method: "none", termCount: 0 },
      thinAnnotation: true,
      sameGeneOtherMechanism: [],
      supportingClaims: [],
      dissentingClaims: [],
      rejectedClaims: [],
      lastReviewed: r["date of last review"]?.slice(0, 10) || undefined,
    };
    conditions.push(cond);
    const gene: Gene = genes.get(geneId) ?? { id: geneId, hgncId: `HGNC:${hgnc}`, symbol, aliases: [], conditionIds: [], depth: isDeep ? "deep" : "shallow", hpoDiseaseNames: [] };
    gene.aliases = uniq([...gene.aliases, ...splitList(r["previous gene symbols"])]);
    gene.conditionIds.push(cond.id);
    genes.set(geneId, gene);
  }

  // Same gene, different mechanism links.
  const byGene = new Map<string, Condition[]>();
  for (const c of conditions) (byGene.get(c.geneId) ?? byGene.set(c.geneId, []).get(c.geneId)!).push(c);
  for (const list of byGene.values()) {
    for (const c of list) c.sameGeneOtherMechanism = list.filter((o) => o.id !== c.id && o.mechanism !== c.mechanism).map((o) => o.id);
  }

  const roads: Road[] = ROADS.map((r) => ({ ...r, conditionIds: conditions.filter((c) => c.roadId === r.id).map((c) => c.id) }));
  const atlas: Atlas = { builtAt: nowIso(), conditions, genes: [...genes.values()], roads, clusters: [] };
  writeJson(files.atlas, atlas, { pretty: false });
  writeEvidence(["ev:g2p:"], evidence);
  updateManifest((m) => {
    m.sources.g2p = { url: G2P_URL, version: G2P_RELEASE, retrievedAt: dl.retrievedAt };
    m.counts.g2pRecordsInPanel = rows.length;
    m.counts.conditions = conditions.length;
    m.counts.conditionsDeep = conditions.filter((c) => c.depth === "deep").length;
    m.counts.genes = genes.size;
    m.genesRequested = [...deep];
    m.genesDropped = dropped;
  });
  const deepCount = conditions.filter((c) => c.depth === "deep").length;
  log("S1", `wrote ${conditions.length} conditions (${deepCount} deep) across ${genes.size} genes; ${dropped.length} seed genes dropped`);
  const mechCounts: Record<string, number> = {};
  for (const c of conditions.filter((c) => c.depth === "deep")) mechCounts[c.roadId] = (mechCounts[c.roadId] ?? 0) + 1;
  log("S1", `deep roads: ${JSON.stringify(mechCounts)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
