/**
 * S10 Briefs and search: pre-generate briefs for the top demo candidates (LLM task T4) and
 * build the client-side search index.
 */
import { parseArgs } from "./lib/args";
import { buildSearchIndex } from "./lib/search";
import { log } from "./lib/io";
import { updateManifest } from "./lib/manifest";
import { generateBriefs } from "./lib/briefs";

async function main() {
  const args = parseArgs();
  const n = buildSearchIndex();
  updateManifest((m) => {
    m.counts.searchDocs = n;
  });
  if (args.flags.has("search-only")) return;
  await generateBriefs(args.limit ?? 5);
  log("S10", "done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
