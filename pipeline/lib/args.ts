import fs from "node:fs";
import { files } from "./paths";

export type Args = {
  genes: string[] | null;
  all: boolean;
  limit: number | null;
  flags: Set<string>;
  values: Record<string, string>;
};

export function parseArgs(argv = process.argv.slice(2)): Args {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, inlineV] = a.slice(2).split("=", 2);
    if (inlineV !== undefined) values[k] = inlineV;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) values[k] = argv[++i];
    else flags.add(k);
  }
  const genes = values.genes ? values.genes.split(/[\s,]+/).filter(Boolean).map((g) => g.toUpperCase()) : null;
  return { genes, all: flags.has("all"), limit: values.limit ? Number(values.limit) : null, flags, values };
}

export function seedGenes(): string[] {
  return fs
    .readFileSync(files.seedGenes, "utf8")
    .split(/\s+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export const PHASE1_GENES = ["SCN1A", "SCN2A", "SCN8A", "KCNQ2", "KCNT1", "STXBP1", "SYNGAP1", "SLC6A1", "CDKL5", "MECP2"];

/** Deep-slice genes for this run: --genes overrides, otherwise the full seed list. */
export function deepGenes(args: Args): string[] {
  return args.genes ?? seedGenes();
}
