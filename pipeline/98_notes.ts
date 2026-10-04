/**
 * S98 Data notes: check the "expectations to report, not enforce" (SPEC section 11) and write the
 * results into docs/DATA_NOTES.md between generated markers. Never changes data.
 */
import fs from "node:fs";
import path from "node:path";
import { readValidated, readJsonOr } from "./lib/io";
import { files, ROOT } from "./lib/paths";
import { AtlasSchema, StudiesFileSchema, DemoCandidatesFileSchema } from "../src/lib/schemas";
import { readManifest } from "./lib/manifest";

function main() {
  const atlas = readValidated(files.atlas, AtlasSchema);
  const studiesRaw = readJsonOr<unknown>(files.studies, null);
  const studies = studiesRaw ? Object.values(StudiesFileSchema.parse(studiesRaw).studies) : [];
  const demo = readJsonOr<unknown>(files.demoCandidates, null);
  const demoList = demo ? DemoCandidatesFileSchema.parse(demo) : [];
  const m = readManifest();
  const deep = atlas.conditions.filter((c) => c.depth === "deep");
  const ion = /^(SCN|KCN|CACNA|HCN|GRIN|GABR)/;

  const scn1aLof = deep.filter((c) => c.geneSymbol === "SCN1A" && c.mechanism === "loss of function" && c.allelicClass === "monoallelic");
  const ionNonLof = deep.filter((c) => ion.test(c.geneSymbol) && c.mechanism !== "loss of function" && c.mechanism !== "undetermined");
  const bothDirections: string[] = [];
  const byGene = new Map<string, typeof deep>();
  for (const c of deep) (byGene.get(c.geneSymbol) ?? byGene.set(c.geneSymbol, []).get(c.geneSymbol)!).push(c);
  for (const [g, conds] of byGene) {
    const dirs = new Set<string>();
    for (const c of conds) {
      if (c.mechanism === "loss of function") dirs.add("loss");
      if (c.mechanism === "gain of function") dirs.add("gain");
      if (c.mechanism === "dominant negative") dirs.add("dominant_negative");
      for (const cl of [...c.supportingClaims, ...(c.contested?.claims ?? [])]) if (cl.direction !== "unclear") dirs.add(cl.direction);
    }
    if (dirs.has("loss") && (dirs.has("gain") || dirs.has("dominant_negative"))) bothDirections.push(g);
  }
  const exclusions = studies.filter((s) => s.classification?.excludesMechanism && s.classification.excludesQuoteVerified);
  const contested = deep.filter((c) => c.contested);
  const dissent = deep.filter((c) => c.dissentingClaims.length);

  const lines: string[] = [];
  lines.push(`<!-- generated:start (npm run data:notes, ${new Date().toISOString().slice(0, 10)}) -->`);
  lines.push("");
  lines.push("| Expectation | Result | Detail |");
  lines.push("|---|---|---|");
  lines.push(`| SCN1A has a monoallelic loss-of-function condition | ${scn1aLof.length ? "true" : "false"} | ${scn1aLof.map((c) => `${c.g2pId} ${c.name}`).join("; ") || "none found"} |`);
  lines.push(`| At least one ion-channel gene in the slice has a condition that is not loss of function | ${ionNonLof.length ? "true" : "false"} | ${ionNonLof.map((c) => `${c.geneSymbol} (${c.mechanism})`).join("; ")} |`);
  lines.push(`| At least one gene has conditions or verified claims in both directions | ${bothDirections.length ? "true" : "false"} | ${bothDirections.join(", ")} |`);
  lines.push(`| At least one ClinicalTrials.gov study has eligibility text that excludes a variant class | ${exclusions.length ? "true" : "false"} | ${exclusions.map((s) => `${s.id} excludes ${s.classification!.excludesMechanism}`).join("; ")} |`);
  lines.push("");
  lines.push("## Observations from the build");
  lines.push("");
  lines.push(`- Deep slice: ${deep.length} conditions, ${byGene.size} genes; seed genes dropped: ${m.genesDropped.map((g) => g.symbol).join(", ") || "none"}.`);
  lines.push(`- Mechanism support is "inferred" for ${deep.filter((c) => c.mechanismSupport === "inferred").length} of ${deep.length} deep conditions; only ${deep.filter((c) => c.mechanismSupport === "evidence").length} rest on functional evidence in Gene2Phenotype.`);
  const strict = contested.filter((c) => c.contested!.kind === "contested");
  const both = contested.filter((c) => c.contested!.kind === "both_directions");
  lines.push(`- Mechanism flags after the claim-by-claim review (verified claims from at least ${m.thresholds.contestedMinPapers ?? 2} papers in another direction): ${strict.length} contested (same variant class disputed): ${strict.map((c) => `${c.geneSymbol} ${c.g2pId} (curated ${c.mechanism}; claims ${Array.from(new Set(c.contested!.claims.map((x) => x.direction))).join("/")} from ${new Set(c.contested!.claims.map((x) => x.pmid)).size} papers)`).join("; ") || "none"}; ${both.length} both directions reported in patients: ${both.map((c) => `${c.geneSymbol} ${c.g2pId}`).join(", ") || "none"}.`);
  lines.push(`- Claims rejected on review and kept for audit: ${deep.reduce((a, c) => a + c.rejectedClaims.length, 0)} (reasons: model-system manipulation, cancer or dosage context, speculative statements, wrong gene, direction not asserted). Reviewer: ${deep.find((c) => c.rejectedClaims.length)?.rejectedClaims[0]?.reviewer ?? "n/a"}.`);
  lines.push(`- Single-paper dissent (recorded, not flagged): ${dissent.length} conditions: ${dissent.map((c) => c.geneSymbol).join(", ")}.`);
  lines.push(`- Several of these contests reflect genuine mixed-direction biology rather than curation error (sodium and NMDA-receptor channel genes commonly carry both loss- and gain-of-function variants); the product shows both sides and does not adjudicate.`);
  lines.push(`- Gene2Phenotype curates SCN8A-related epileptic encephalopathy as dominant negative rather than gain of function, and KCNQ2-related epileptic encephalopathy as gain of function; both differ from how some of the literature describes them. The data was kept as curated, and the contested flags record the disagreement where it reached the threshold.`);
  lines.push(`- Phenotype match methods: ${Object.entries(m.counts).filter(([k]) => k.startsWith("phenotypeMatch_")).map(([k, v]) => `${k.replace("phenotypeMatch_", "")} ${v}`).join(", ")}; thin annotation (<${m.thresholds.thinAnnotationTerms} terms): ${m.counts.conditionsThinAnnotation}.`);
  lines.push(`- Shared registries (added 2026-10-04): ${m.counts.sharedRegistries ?? 0} multi-gene registries confirmed from their own sites, covering ${m.counts.conditionsInSharedRegistry ?? 0} deep conditions; ${m.counts.orgSharedRegistryLinks ?? 0} organization pages state participation; ${m.counts.externalRegistries ?? 0} registries found outside ClinicalTrials.gov. Milestone 4 "partly" = included in a shared registry only.`);
  lines.push(`- Targeted trials by level: ${m.counts.targetedGeneProduct ?? 0} act on the gene or its product (count as milestone 7), ${m.counts.targetedPathway ?? 0} act on a downstream pathway (shown as partly), ${m.counts.targetedSymptomaticOrUnknown ?? 0} symptomatic or mechanism not established.`);
  lines.push(`- Studies: ${m.counts.studiesRetrieved} retrieved, ${m.counts.studiesAboutCondition} classified as about a condition, ${m.counts.studiesDiscardedNotAbout} discarded as not about it (gene panels, broad epilepsy studies). ${m.counts.studiesWithMechanismExclusion} studies exclude a variant class in their eligibility text.`);
  lines.push(`- Quotes: ${(m.counts.t2QuotesVerified ?? 0) + (m.counts.t1ClaimsVerified ?? 0)} verified verbatim, ${(m.counts.t2QuotesDiscarded ?? 0) + (m.counts.t1ClaimsDiscarded ?? 0)} discarded.`);
  lines.push(`- Disease-model literature returned at least one paper for every deep gene, so milestone 5 does not discriminate within this slice; the count and top PMIDs are shown so a reader can judge depth.`);
  lines.push(`- Demo candidates (section 9.6): ${demoList.length}; top: ${demoList.slice(0, 3).map((d) => `${atlas.conditions.find((c) => c.id === d.conditionId)?.geneSymbol} -> ${atlas.conditions.find((c) => c.id === d.neighborId)?.geneSymbol}`).join(", ") || "none"}.`);
  lines.push(`- LLM spend (upper-bound price estimate): $${m.llm.spendUsd.toFixed(2)}.`);
  lines.push("");
  lines.push("<!-- generated:end -->");

  const p = path.join(ROOT, "docs", "DATA_NOTES.md");
  let doc = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "# Data notes\n\n";
  const block = lines.join("\n");
  if (/<!-- generated:start[\s\S]*<!-- generated:end -->/.test(doc)) doc = doc.replace(/<!-- generated:start[\s\S]*<!-- generated:end -->/, block);
  else doc = doc.replace(/## Reported expectations \(SPEC section 11\)[\s\S]*$/, `## Reported expectations (SPEC section 11)\n\n${block}\n`);
  fs.writeFileSync(p, doc);
  console.log(block);
}

main();
