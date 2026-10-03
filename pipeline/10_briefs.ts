/**
 * S10 Briefs and search: pre-generate briefs for the top demo candidates (LLM task T4) and
 * build the client-side search index.
 */
import { parseArgs } from "./lib/args";
import { buildSearchIndex } from "./lib/search";
import { log } from "./lib/io";
import { updateManifest } from "./lib/manifest";
import { generateBriefs } from "./lib/briefs";
import { readLedger } from "./lib/llm";

async function main() {
  const args = parseArgs();
  const n = buildSearchIndex();
  updateManifest((m) => {
    m.counts.searchDocs = n;
  });
  if (args.flags.has("search-only")) return;
  await generateBriefs(args.limit ?? 5);
  const l = readLedger();
  updateManifest((m) => {
    m.llm.spendUsd = l.totalUsd;
    m.llm.byStage = Object.fromEntries(Object.entries(l.byStage).map(([k, v]) => [k, { calls: v.calls, inputTokens: v.inputTokens, outputTokens: v.outputTokens, usd: v.usd }]));
    m.llm.models = { ...l.models, ...m.llm.models };
  });
  log("S10", "done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
