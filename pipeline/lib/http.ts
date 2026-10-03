import crypto from "node:crypto";
import path from "node:path";
import { RAW } from "./paths";
import { exists, readText, writeText, log } from "./io";

/** Per-host minimum interval between requests, in ms. */
const HOST_INTERVAL: Record<string, number> = {
  "eutils.ncbi.nlm.nih.gov": process.env.NCBI_API_KEY ? 110 : 350,
  "api.reporter.nih.gov": 1100,
  "clinicaltrials.gov": 250,
  "www.ebi.ac.uk": 200,
};
const lastCall: Record<string, number> = {};
const hostQueues: Record<string, Promise<void>> = {};

async function throttle(host: string) {
  const interval = HOST_INTERVAL[host] ?? 100;
  const prev = hostQueues[host] ?? Promise.resolve();
  let release!: () => void;
  hostQueues[host] = new Promise<void>((r) => (release = r));
  await prev;
  const wait = (lastCall[host] ?? 0) + interval - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall[host] = Date.now();
  release();
}

export type FetchOpts = {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  /** Cache namespace under data/raw, e.g. "ctgov/queries". */
  cacheDir: string;
  /** Cache key; hashed if too long. */
  cacheKey: string;
  gzip?: boolean;
  retries?: number;
  timeoutMs?: number;
  force?: boolean;
};

export function cachePath(cacheDir: string, cacheKey: string, gzip = false) {
  const safe = cacheKey.length > 80 || /[^A-Za-z0-9._-]/.test(cacheKey) ? crypto.createHash("sha1").update(cacheKey).digest("hex") : cacheKey;
  return path.join(RAW, cacheDir, safe + (gzip ? ".json.gz" : ".json"));
}

export type Cached<T> = { data: T; fromCache: boolean; retrievedAt: string; path: string };

/** Fetch JSON with on-disk caching under data/raw. Cached responses are never re-fetched unless force. */
export async function fetchJsonCached<T = unknown>(url: string, opts: FetchOpts): Promise<Cached<T>> {
  const p = cachePath(opts.cacheDir, opts.cacheKey, opts.gzip);
  if (!opts.force && exists(p)) {
    const wrapped = JSON.parse(readText(p)) as { retrievedAt: string; url: string; data: T };
    return { data: wrapped.data, fromCache: true, retrievedAt: wrapped.retrievedAt, path: p };
  }
  const text = await fetchTextRaw(url, opts);
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 200)}`);
  }
  const retrievedAt = new Date().toISOString();
  writeText(p, JSON.stringify({ retrievedAt, url, data }));
  return { data, fromCache: false, retrievedAt, path: p };
}

/** Fetch text (e.g. XML, CSV) with caching. */
export async function fetchTextCached(url: string, opts: FetchOpts & { ext?: string }): Promise<Cached<string>> {
  const p = cachePath(opts.cacheDir, opts.cacheKey, opts.gzip).replace(/\.json(\.gz)?$/, (opts.ext ?? ".txt") + (opts.gzip ? ".gz" : ""));
  const metaPath = p + ".meta.json";
  if (!opts.force && exists(p)) {
    const meta = exists(metaPath) ? (JSON.parse(readText(metaPath)) as { retrievedAt: string }) : { retrievedAt: "unknown" };
    return { data: readText(p), fromCache: true, retrievedAt: meta.retrievedAt, path: p };
  }
  const text = await fetchTextRaw(url, opts);
  const retrievedAt = new Date().toISOString();
  writeText(p, text);
  writeText(metaPath, JSON.stringify({ retrievedAt, url }));
  return { data: text, fromCache: false, retrievedAt, path: p };
}

export async function fetchTextRaw(url: string, opts: Partial<FetchOpts>): Promise<string> {
  const host = new URL(url).host;
  const retries = opts.retries ?? 4;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(host);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: { "user-agent": "slipstream/0.1 (research navigation aid)", accept: "application/json, text/plain, */*", ...(opts.body ? { "content-type": "application/json" } : {}), ...(opts.headers ?? {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} from ${url}`);
        const backoff = Math.min(30_000, 1000 * 2 ** attempt);
        log("http", `${res.status} from ${host}; retrying in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}: ${(await res.text()).slice(0, 300)}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      const backoff = Math.min(30_000, 1000 * 2 ** attempt);
      log("http", `error from ${host} (${(e as Error).message.slice(0, 80)}); retrying in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Download a (possibly large) file to data/raw if it is not already there. Returns the path. */
export async function downloadCached(url: string, relPath: string, opts: { force?: boolean; gzip?: boolean } = {}): Promise<{ path: string; fromCache: boolean; retrievedAt: string }> {
  const p = path.join(RAW, relPath);
  const metaPath = p + ".meta.json";
  if (!opts.force && exists(p)) {
    const meta = exists(metaPath) ? (JSON.parse(readText(metaPath)) as { retrievedAt: string }) : { retrievedAt: "unknown" };
    return { path: p, fromCache: true, retrievedAt: meta.retrievedAt };
  }
  log("http", `downloading ${url}`);
  const res = await fetch(url, { headers: { "user-agent": "slipstream/0.1" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  let buf = Buffer.from(await res.arrayBuffer());
  if (opts.gzip && !(buf[0] === 0x1f && buf[1] === 0x8b)) {
    const zlib = await import("node:zlib");
    buf = zlib.gzipSync(buf);
  }
  const { ensureDir } = await import("./io");
  ensureDir(path.dirname(p));
  const fs = await import("node:fs");
  fs.writeFileSync(p, buf);
  const retrievedAt = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify({ retrievedAt, url, bytes: buf.length }));
  return { path: p, fromCache: false, retrievedAt };
}
