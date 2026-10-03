import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { ZodType } from "zod";

export function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function readJson<T = unknown>(p: string): T {
  if (p.endsWith(".gz")) return JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString("utf8")) as T;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

export function readJsonOr<T>(p: string, fallback: T): T {
  return fs.existsSync(p) ? readJson<T>(p) : fallback;
}

export function readValidated<T>(p: string, schema: ZodType<T>): T {
  const raw = readJson(p);
  const res = schema.safeParse(raw);
  if (!res.success) {
    throw new Error(`${path.relative(process.cwd(), p)} failed schema: ${res.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return res.data;
}

export function writeJson(p: string, data: unknown, opts: { pretty?: boolean } = {}) {
  ensureDir(path.dirname(p));
  const text = opts.pretty === false ? JSON.stringify(data) : JSON.stringify(data, null, 1);
  if (p.endsWith(".gz")) fs.writeFileSync(p, zlib.gzipSync(text));
  else fs.writeFileSync(p, text + "\n");
}

export function exists(p: string) {
  return fs.existsSync(p);
}

export function readText(p: string): string {
  if (p.endsWith(".gz")) return zlib.gunzipSync(fs.readFileSync(p)).toString("utf8");
  return fs.readFileSync(p, "utf8");
}

export function writeText(p: string, text: string) {
  ensureDir(path.dirname(p));
  if (p.endsWith(".gz")) fs.writeFileSync(p, zlib.gzipSync(text));
  else fs.writeFileSync(p, text);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function log(stage: string, msg: string) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] [${stage}] ${msg}`);
}

export function uniq<T>(xs: Iterable<T>): T[] {
  return Array.from(new Set(xs));
}

export function groupBy<T, K extends string>(xs: T[], key: (x: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const x of xs) {
    const k = key(x);
    (out[k] ||= []).push(x);
  }
  return out;
}
