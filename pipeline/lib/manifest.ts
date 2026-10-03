import { execSync } from "node:child_process";
import { files } from "./paths";
import { readJsonOr, writeJson } from "./io";
import type { BuildManifest } from "../../src/lib/schemas";

export function readManifest(): BuildManifest {
  return readJsonOr<BuildManifest>(files.manifest, {
    builtAt: new Date().toISOString(),
    sources: {},
    counts: {},
    thresholds: {},
    llm: { spendUsd: 0, byStage: {}, models: {} },
    genesRequested: [],
    genesDropped: [],
    notes: [],
  });
}

export function updateManifest(fn: (m: BuildManifest) => void) {
  const m = readManifest();
  fn(m);
  m.builtAt = new Date().toISOString();
  try {
    m.gitCommit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    /* not a git checkout */
  }
  writeJson(files.manifest, m);
}

export function addNote(note: string) {
  updateManifest((m) => {
    if (!m.notes.includes(note)) m.notes.push(note);
  });
}
