import { NextRequest } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getStore, getCondition, getNeighbors, getLadder, getTransferPair, getOrgsFor, getStudiesFor, getEvidence, collectEvidenceIds, getBrief } from "@/lib/data";
import { BriefOutputSchema, T4_SYSTEM, packSummary, groundingCheck, packEvidenceIdSet, templateBrief, type EvidencePack } from "@/lib/brief";
import type { Brief } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// In-memory cache and a simple per-IP rate limit (SPEC 10.5).
const cache = new Map<string, Brief>();
const hits = new Map<string, number[]>();
const LIMIT = 6;
const WINDOW_MS = 60_000;

function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > LIMIT;
}

function buildPack(focalId: string, neighborId: string): EvidencePack | null {
  const store = getStore();
  const focal = getCondition(focalId);
  const neighbor = getCondition(neighborId);
  const edge = getNeighbors(focalId).find((n) => n.id === neighborId);
  const transfer = getTransferPair(focalId, neighborId);
  const fl = getLadder(focalId);
  const nl = getLadder(neighborId);
  if (!focal || !neighbor || !edge || !transfer || !fl || !nl) return null;
  const neighborOrgs = getOrgsFor(neighborId);
  const neighborStudies = getStudiesFor(neighborId);
  const ids = collectEvidenceIds(focal, neighbor, edge, fl, nl, transfer, neighborOrgs, neighborStudies);
  if (focal.contested) {
    ids.add(focal.contested.curatedEvidenceId);
    focal.contested.claims.forEach((c) => ids.add(c.evidenceId));
  }
  if (neighbor.contested) {
    ids.add(neighbor.contested.curatedEvidenceId);
    neighbor.contested.claims.forEach((c) => ids.add(c.evidenceId));
  }
  return { focal, neighbor, neighborEdge: edge, focalLadder: fl, neighborLadder: nl, transfer, neighborOrgs, neighborStudies, evidence: getEvidence(ids), cutoffs: store.transfers.cutoffs };
}

export async function POST(req: NextRequest) {
  let body: { focalId?: string; neighborId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { focalId, neighborId } = body;
  if (!focalId || !neighborId || !/^cond:G2P\d+$/.test(focalId) || !/^cond:G2P\d+$/.test(neighborId)) return Response.json({ error: "focalId and neighborId are required" }, { status: 400 });
  const key = `${focalId}__${neighborId}`;
  const pre = getBrief(focalId, neighborId);
  if (pre) return Response.json({ brief: pre, source: "pregenerated" });
  const cached = cache.get(key);
  if (cached) return Response.json({ brief: cached, source: "cache" });
  const pack = buildPack(focalId, neighborId);
  if (!pack) return Response.json({ error: "no evidence pack for this pair" }, { status: 404 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    const t = templateBrief(pack);
    return Response.json({ brief: t, source: "template", reason: "rate limit" });
  }
  if (!process.env.OPENAI_API_KEY) {
    const t = templateBrief(pack);
    cache.set(key, t);
    return Response.json({ brief: t, source: "template", reason: "no key" });
  }
  const model = process.env.OPENAI_MODEL_EXPLAIN ?? "gpt-5.4";
  const client = new OpenAI();
  const packIds = packEvidenceIdSet(pack);
  const user = `EVIDENCE PACK\n${packSummary(pack)}`;
  let lastDropped = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const body: Record<string, unknown> = {
        model,
        input: [
          { role: "system", content: T4_SYSTEM + (attempt ? "\nYour previous draft had too many sentences without valid evidence ids. Cite ids from the pack on every factual sentence." : "") },
          { role: "user", content: user },
        ],
        text: { format: zodTextFormat(BriefOutputSchema, "brief") },
        max_output_tokens: 3000,
        store: false,
        reasoning: { effort: "medium" },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await client.responses.create(body as any);
      const parsed = BriefOutputSchema.parse(JSON.parse(res.output_text));
      const g = groundingCheck(parsed, packIds);
      lastDropped = g.dropped;
      if (g.total > 0 && g.dropped / g.total <= 0.2) {
        const brief: Brief = { focalId, neighborId, generatedAt: new Date().toISOString(), mode: "llm", model, sections: g.sections, glossary: parsed.glossary.slice(0, 6), droppedSentences: g.dropped };
        cache.set(key, brief);
        return Response.json({ brief, source: "live" });
      }
    } catch (e) {
      console.error("brief generation failed", (e as Error).message);
      break;
    }
  }
  const t = templateBrief(pack);
  t.droppedSentences = lastDropped;
  cache.set(key, t);
  return Response.json({ brief: t, source: "template", reason: "grounding check or API failure" });
}
