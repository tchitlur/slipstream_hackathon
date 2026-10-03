import crypto from "node:crypto";
import fs from "node:fs";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { files, LLM } from "./paths";
import { ensureDir, exists, log, readJsonOr, writeJson } from "./io";

export const BUDGET_USD = Number(process.env.SLIPSTREAM_LLM_BUDGET_USD ?? 7.0);

export const MODEL_EXPLAIN = process.env.OPENAI_MODEL_EXPLAIN ?? "gpt-5.4";
export const MODEL_EXTRACT = process.env.OPENAI_MODEL_EXTRACT ?? "gpt-5.4-mini";

/**
 * Price estimates in USD per 1M tokens. These are conservative upper-bound
 * estimates recorded in docs/DECISIONS.md; the ledger uses them to stop at the cap.
 */
export const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-5.4": { input: 2.5, output: 15 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
};

export function priceFor(model: string) {
  const key = Object.keys(PRICES).find((k) => model === k || model.startsWith(k + "-"));
  return PRICES[key ?? "gpt-5.4"];
}

export function estimateUsd(model: string, inputTokens: number, outputTokens: number) {
  const p = priceFor(model);
  return (inputTokens * p.input + outputTokens * p.output) / 1e6;
}

/** Rough token estimate: ~4 characters per token. */
export function approxTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export type StageLedger = { calls: number; cachedCalls: number; inputTokens: number; outputTokens: number; usd: number; model?: string };
export type Ledger = { totalUsd: number; byStage: Record<string, StageLedger>; updatedAt: string; models: Record<string, string> };

export function readLedger(): Ledger {
  return readJsonOr<Ledger>(files.llmLedger, { totalUsd: 0, byStage: {}, updatedAt: new Date().toISOString(), models: {} });
}

function writeLedger(l: Ledger) {
  l.updatedAt = new Date().toISOString();
  writeJson(files.llmLedger, l);
}

export function hasKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI();
  return client;
}

type CacheRow = { key: string; model: string; task: string; input: unknown; output: unknown; usage: { input: number; output: number }; at: string };
let cacheIndex: Map<string, CacheRow> | null = null;

function loadCache(): Map<string, CacheRow> {
  if (cacheIndex) return cacheIndex;
  cacheIndex = new Map();
  if (exists(files.llmCache)) {
    for (const line of fs.readFileSync(files.llmCache, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as CacheRow;
        cacheIndex.set(row.key, row);
      } catch {
        /* skip corrupt line */
      }
    }
  }
  return cacheIndex;
}

function appendCache(row: CacheRow) {
  ensureDir(LLM);
  fs.appendFileSync(files.llmCache, JSON.stringify(row) + "\n");
  loadCache().set(row.key, row);
}

export class BudgetExceeded extends Error {}

export type LlmCallOpts<S extends z.ZodTypeAny> = {
  task: string;
  stage: string;
  model: string;
  schema: S;
  schemaName: string;
  system: string;
  user: string;
  reasoning?: "none" | "minimal" | "low" | "medium";
  maxOutputTokens?: number;
};

export type LlmResult<T> = { data: T; fromCache: boolean; usage: { input: number; output: number } };

/**
 * Structured-output call with a content-addressed cache and a spend ledger.
 * Re-running with the same model, schema and input costs nothing.
 */
export async function llmStructured<S extends z.ZodTypeAny>(opts: LlmCallOpts<S>): Promise<LlmResult<z.infer<S>>> {
  const format = zodTextFormat(opts.schema, opts.schemaName);
  const key = crypto
    .createHash("sha256")
    .update(JSON.stringify({ model: opts.model, schema: format.schema, system: opts.system, user: opts.user }))
    .digest("hex");
  const cache = loadCache();
  const hit = cache.get(key);
  if (hit) {
    const ledger = readLedger();
    const st = (ledger.byStage[opts.stage] ||= { calls: 0, cachedCalls: 0, inputTokens: 0, outputTokens: 0, usd: 0, model: opts.model });
    st.cachedCalls++;
    writeLedger(ledger);
    return { data: opts.schema.parse(hit.output), fromCache: true, usage: hit.usage };
  }
  if (!hasKey()) throw new Error("OPENAI_API_KEY is not set");
  const ledger = readLedger();
  const projected = ledger.totalUsd + estimateUsd(opts.model, approxTokens(opts.system + opts.user), opts.maxOutputTokens ?? 600);
  if (projected > BUDGET_USD) throw new BudgetExceeded(`LLM budget cap of $${BUDGET_USD.toFixed(2)} would be exceeded (ledger at $${ledger.totalUsd.toFixed(3)})`);

  const body: Record<string, unknown> = {
    model: opts.model,
    input: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    text: { format },
    max_output_tokens: opts.maxOutputTokens ?? 1200,
    store: false,
  };
  if (opts.reasoning) body.reasoning = { effort: opts.reasoning };

  let parsed: unknown;
  let usage = { input: 0, output: 0 };
  let attempt = 0;
  for (;;) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await getClient().responses.create(body as any);
      usage = { input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0 };
      const text: string | undefined = res.output_text;
      if (!text) {
        const status = res.status ?? "unknown";
        const reason = res.incomplete_details?.reason ?? "";
        throw new Error(`empty structured output (status=${status} ${reason})`);
      }
      parsed = JSON.parse(text);
      break;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      // Models that reject a reasoning effort value: drop it and retry once.
      if (/reasoning/i.test(msg) && body.reasoning && attempt === 0) {
        delete body.reasoning;
        attempt++;
        continue;
      }
      if (/temperature/i.test(msg) && "temperature" in body) {
        delete body.temperature;
        attempt++;
        continue;
      }
      if (attempt < 3 && /(429|5\d\d|rate|overloaded|timeout|ECONNRESET|empty structured)/i.test(msg)) {
        attempt++;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw e;
    }
  }
  const data = opts.schema.parse(parsed);
  const usd = estimateUsd(opts.model, usage.input, usage.output);
  const l2 = readLedger();
  const st = (l2.byStage[opts.stage] ||= { calls: 0, cachedCalls: 0, inputTokens: 0, outputTokens: 0, usd: 0, model: opts.model });
  st.calls++;
  st.inputTokens += usage.input;
  st.outputTokens += usage.output;
  st.usd += usd;
  st.model = opts.model;
  l2.totalUsd += usd;
  l2.models[opts.task] = opts.model;
  writeLedger(l2);
  appendCache({ key, model: opts.model, task: opts.task, input: { system: opts.system, user: opts.user }, output: data, usage, at: new Date().toISOString() });
  return { data, fromCache: false, usage };
}

/** Run tasks with bounded concurrency; stops scheduling new work once the budget is hit. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  let budgetHit = false;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !budgetHit) {
      const i = next++;
      try {
        out[i] = await fn(items[i], i);
      } catch (e) {
        if (e instanceof BudgetExceeded) {
          budgetHit = true;
          log("llm", e.message);
        } else {
          log("llm", `item ${i} failed: ${(e as Error).message.slice(0, 200)}`);
        }
      }
    }
  });
  await Promise.all(workers);
  return out;
}

/** Confirm the configured models exist. Returns the (possibly substituted) model IDs. */
export async function confirmModels(): Promise<{ explain: string; extract: string; notes: string[] }> {
  const notes: string[] = [];
  if (!hasKey()) return { explain: MODEL_EXPLAIN, extract: MODEL_EXTRACT, notes: ["no key; models not confirmed"] };
  const list = await getClient().models.list();
  const ids = new Set<string>();
  for await (const m of list) ids.add(m.id);
  const pick = (wanted: string, fallbacks: string[]) => {
    if (ids.has(wanted)) return wanted;
    const fb = fallbacks.find((f) => ids.has(f));
    notes.push(`model ${wanted} not available; using ${fb ?? wanted}`);
    return fb ?? wanted;
  };
  return {
    explain: pick(MODEL_EXPLAIN, ["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-4.1"]),
    extract: pick(MODEL_EXTRACT, ["gpt-5-mini", "gpt-4.1-mini"]),
    notes,
  };
}
