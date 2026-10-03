/** Runs every pipeline stage in order. Pass-through of --genes / --all / --skip-llm. */
import { spawnSync } from "node:child_process";

const stages = ["00_probe", "01_mechanism", "02_phenotypes", "03_similarity", "04_literature", "05_studies", "06_reconcile", "07_orgs", "08_funding", "09_analytics", "10_briefs", "99_validate"];
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--from="))?.slice(7);
let started = !only;
for (const s of stages) {
  if (!started && s.startsWith(only!)) started = true;
  if (!started) continue;
  console.log(`\n=== ${s} ===`);
  const r = spawnSync("npx", ["tsx", `pipeline/${s}.ts`, ...args.filter((a) => !a.startsWith("--from="))], { stdio: "inherit" });
  if (r.status !== 0 && s !== "00_probe") {
    console.error(`stage ${s} failed with code ${r.status}`);
    process.exit(r.status ?? 1);
  }
}
