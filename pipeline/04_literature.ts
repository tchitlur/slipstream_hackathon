/**
 * S4 Literature: for each deep-slice gene, fetch up to N abstracts for a mechanism query and
 * counts plus top PMIDs for a disease-model query (PubMed E-utilities). Run LLM task T1 on the
 * mechanism abstracts, verify quotes verbatim, and cross-check against the curated mechanism
 * (SPEC 8.2): a verified claim in a different direction creates a `contested` flag, or is
 * attached to the curated condition for that other direction when one exists.
 */
import path from "node:path";
import { z } from "zod";
import { parseArgs, deepGenes } from "./lib/args";
import { fetchJsonCached, fetchTextCached } from "./lib/http";
import { readValidated, writeJson, writeText, log, uniq, readJsonOr } from "./lib/io";
import { files, RAW, SEED } from "./lib/paths";
import { writeEvidence } from "./lib/evidence";
import { updateManifest } from "./lib/manifest";
import { llmStructured, mapLimit, hasKey, confirmModels, estimateUsd, approxTokens, readLedger, BUDGET_USD } from "./lib/llm";
import { AtlasSchema, Direction, type Evidence, type Paper, type LiteratureFile, type Condition, type Mechanism } from "../src/lib/schemas";
import type { z as zod } from "zod";
import type { MechanismClaimSchema } from "../src/lib/schemas";
type MechanismClaimEntry = zod.infer<typeof MechanismClaimSchema>;
import { verifyQuote } from "../src/lib/quotes";

const MECH_N = Number(process.env.SLIPSTREAM_T1_ABSTRACTS ?? 12);
const MODEL_TOP = 5;
const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function eutilsParams(extra: Record<string, string>) {
  const p = new URLSearchParams({ db: "pubmed", tool: "slipstream", ...extra });
  if (process.env.NCBI_API_KEY) p.set("api_key", process.env.NCBI_API_KEY);
  if (process.env.NCBI_EMAIL) p.set("email", process.env.NCBI_EMAIL);
  return p;
}

function mechanismQuery(symbol: string) {
  return `${symbol}[TIAB] AND ("loss of function"[TIAB] OR "gain of function"[TIAB] OR haploinsufficiency[TIAB] OR "dominant negative"[TIAB])`;
}
function modelQuery(symbol: string) {
  return `${symbol}[TIAB] AND ("mouse model"[TIAB] OR knockout[TIAB] OR "knock-in"[TIAB] OR iPSC[TIAB] OR organoid[TIAB] OR zebrafish[TIAB])`;
}

async function esearch(term: string, retmax: number, key: string) {
  const url = `${EUTILS}/esearch.fcgi?${eutilsParams({ term, retmax: String(retmax), retmode: "json", sort: "relevance" })}`;
  const res = await fetchJsonCached<{ esearchresult: { count: string; idlist: string[] } }>(url.replace(/&api_key=[^&]+/, ""), { cacheDir: "pubmed/esearch", cacheKey: key, gzip: true });
  return { count: Number(res.data.esearchresult.count), ids: res.data.esearchresult.idlist, retrievedAt: res.retrievedAt };
}

type Fetched = Paper & { abstract: string };

function decode(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function parseEfetch(xml: string): Fetched[] {
  const out: Fetched[] = [];
  const articles = xml.split("<PubmedArticle>").slice(1);
  for (const a of articles) {
    const pmid = a.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const title = decode((a.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? "").replace(/<[^>]+>/g, ""));
    const year = a.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] ?? a.match(/<MedlineDate>(\d{4})/)?.[1];
    const abs = [...a.matchAll(/<AbstractText(?: Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) => (m[1] ? `${m[1]}: ` : "") + decode(m[2].replace(/<[^>]+>/g, ""))).join(" ");
    const authors = [...a.matchAll(/<Author[^>]*>[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?(?:<ForeName>([^<]+)<\/ForeName>|<Initials>([^<]+)<\/Initials>)?[\s\S]*?<\/Author>/g)].map((m) => `${m[1]}${m[2] ? ", " + m[2] : m[3] ? ", " + m[3] : ""}`.trim());
    out.push({ pmid, title, year, authors, lastAuthor: authors[authors.length - 1], hasAbstract: abs.length > 0, abstract: abs });
  }
  return out;
}

async function efetch(ids: string[]): Promise<Fetched[]> {
  if (!ids.length) return [];
  const url = `${EUTILS}/efetch.fcgi?${eutilsParams({ id: ids.join(","), retmode: "xml" })}`;
  const res = await fetchTextCached(url.replace(/&api_key=[^&]+/, ""), { cacheDir: "pubmed/efetch", cacheKey: ids.join("_"), gzip: true, ext: ".xml" });
  return parseEfetch(res.data);
}

const T1Schema = z.object({
  claims: z.array(
    z.object({
      conditionHint: z.string().describe("The disease or phenotype the claim is about, as named in the abstract (short)."),
      mechanism: z.string().describe("The mechanism as stated, in a few words (e.g. 'haploinsufficiency', 'gain of function in the sodium channel')."),
      direction: Direction,
      quote: z.string().describe("One sentence copied verbatim from the abstract that states the mechanism claim."),
    }),
  ),
});

const T1_SYSTEM = `You extract mechanism claims about a gene from a PubMed abstract for a rare-disease atlas.
A claim is a statement that variants in the gene cause disease through a direction of effect:
- loss: loss of function, haploinsufficiency, reduced or absent protein or channel activity, null alleles.
- gain: gain of function, increased activity, overactive or constitutively active protein, hyperexcitability caused by increased channel current.
- dominant_negative: a mutant protein that interferes with the wild-type protein.
- unclear: the abstract discusses mechanism but does not commit to a direction, or reports mixed directions without resolving them.
Rules: extract only claims about the named gene (not other genes in the abstract). Each quote must be copied verbatim from the abstract text, character for character, as one complete sentence. Do not paraphrase. If the abstract makes no mechanism claim about the gene, return an empty list. Prefer claims about human disease over purely experimental manipulations. Return JSON only.`;

function directionOfMechanism(m: Mechanism): "loss" | "gain" | "dominant_negative" | "unclear" {
  if (m === "loss of function") return "loss";
  if (m === "gain of function") return "gain";
  if (m === "dominant negative") return "dominant_negative";
  return "unclear";
}

async function main() {
  const args = parseArgs();
  const atlas = readValidated(files.atlas, AtlasSchema);
  const genes = deepGenes(args).filter((g) => atlas.genes.some((x) => x.symbol === g));
  const existing = readJsonOr<LiteratureFile | null>(files.literature, null);
  const byGene: LiteratureFile["byGene"] = { ...(existing?.byGene ?? {}) };
  const papers: Record<string, Paper> = { ...(existing?.papers ?? {}) };
  const abstracts = new Map<string, string>();
  const mechPmidsByGene = new Map<string, string[]>();

  for (const symbol of genes) {
    const mq = mechanismQuery(symbol);
    const modq = modelQuery(symbol);
    const m = await esearch(mq, MECH_N, `mech_${symbol}`);
    const d = await esearch(modq, MODEL_TOP, `model_${symbol}`);
    const fetched = await efetch(uniq([...m.ids, ...d.ids]));
    for (const f of fetched) {
      papers[f.pmid] = { pmid: f.pmid, title: f.title, year: f.year, authors: f.authors, lastAuthor: f.lastAuthor, hasAbstract: f.hasAbstract };
      if (f.hasAbstract) {
        const text = `${f.title}\n${f.abstract}`;
        abstracts.set(f.pmid, text);
        writeText(path.join(RAW, "pubmed", "abstracts", `${f.pmid}.txt`), text);
      }
    }
    byGene[symbol] = { symbol, mechanismQuery: mq, mechanismPmids: m.ids, modelQuery: modq, modelCount: d.count, modelTopPmids: d.ids, retrievedAt: m.retrievedAt };
    mechPmidsByGene.set(symbol, m.ids.filter((id) => abstracts.has(id)));
    log("S4", `${symbol}: ${m.count} mechanism papers (using ${m.ids.length}), ${d.count} disease-model papers`);
  }

  // T1
  const models = await confirmModels();
  const jobs = genes.flatMap((symbol) => (mechPmidsByGene.get(symbol) ?? []).map((pmid) => ({ symbol, pmid })));
  const estIn = jobs.reduce((a, j) => a + approxTokens(T1_SYSTEM + (abstracts.get(j.pmid) ?? "")) + 100, 0);
  const estStrong = estimateUsd(models.explain, estIn, jobs.length * 260);
  const ledger = readLedger();
  // SPEC 8.4: if T1 on the stronger model would exceed $4.00, run on the mini model and re-run disagreements on the strong model.
  const useMini = estStrong > 4.0 || ledger.totalUsd + estStrong > BUDGET_USD - 1.0;
  const t1Model = useMini ? models.extract : models.explain;
  log("S4", `T1: ${jobs.length} abstracts; estimate on ${models.explain} $${estStrong.toFixed(2)}; ledger $${ledger.totalUsd.toFixed(2)}; using ${t1Model}${useMini ? " (mini first, disagreements re-run on the stronger model)" : ""}`);

  type Claim = LiteratureFile["claims"][number];
  const claims: Claim[] = existing?.claims.filter((c) => !genes.includes(c.geneSymbol)) ?? [];
  // Discarded counts are tracked per gene so re-runs stay idempotent.
  const discardedByGene: Record<string, number> = { ...(existing?.discardedByGene ?? {}) };
  for (const g of genes) discardedByGene[g] = 0;
  let discarded = 0;
  const condsByGene = new Map<string, Condition[]>();
  for (const c of atlas.conditions) (condsByGene.get(c.geneSymbol) ?? condsByGene.set(c.geneSymbol, []).get(c.geneSymbol)!).push(c);

  const runT1 = async (symbol: string, pmid: string, model: string) => {
    const text = abstracts.get(pmid)!;
    const r = await llmStructured({ task: "T1", stage: "S4", model, schema: T1Schema, schemaName: "mechanism_claims", system: T1_SYSTEM, user: `Gene: ${symbol}\nPMID: ${pmid}\n\nAbstract:\n${text}`, reasoning: "low", maxOutputTokens: 1500 });
    return r.data.claims;
  };

  if (!hasKey()) log("S4", "WARNING: OPENAI_API_KEY not set; skipping T1");
  else {
    const results = await mapLimit(jobs, 4, async (j) => ({ ...j, claims: await runT1(j.symbol, j.pmid, t1Model) }));
    // Disagreements: re-run on the stronger model when mini was used.
    for (const r of results) {
      if (!r) continue;
      const curatedDirs = new Set((condsByGene.get(r.symbol) ?? []).map((c) => directionOfMechanism(c.mechanism)));
      let finalClaims = r.claims;
      if (useMini && models.explain !== models.extract && r.claims.some((c) => c.direction !== "unclear" && !curatedDirs.has(c.direction))) {
        try {
          finalClaims = await runT1(r.symbol, r.pmid, models.explain);
        } catch (e) {
          log("S4", `strong-model re-run failed for ${r.pmid}: ${(e as Error).message.slice(0, 100)}`);
        }
      }
      const text = abstracts.get(r.pmid)!;
      finalClaims.forEach((c, i) => {
        const q = verifyQuote(c.quote, text);
        if (!q) {
          discarded++;
          discardedByGene[r.symbol] = (discardedByGene[r.symbol] ?? 0) + 1;
          return;
        }
        claims.push({ pmid: r.pmid, direction: c.direction, mechanism: c.mechanism, conditionHint: c.conditionHint, evidenceId: `ev:pubmed:${r.pmid}:claim:${i}`, geneSymbol: r.symbol, quote: q.text, verified: true });
      });
    }
  }

  // Evidence records: extracted claims and computed model-literature records.
  const evidence: Evidence[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const c of claims) {
    const text = abstracts.get(c.pmid) ?? readJsonOr<string | null>(path.join(RAW, "pubmed", "abstracts", `${c.pmid}.txt`), null);
    const q = text ? verifyQuote(c.quote, text) : null;
    if (!q) continue;
    evidence.push({
      id: c.evidenceId,
      kind: "extracted",
      source: "pubmed",
      sourceId: c.pmid,
      url: `https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/`,
      retrievedAt: byGene[c.geneSymbol]?.retrievedAt.slice(0, 10) ?? today,
      quote: { ...q, sourceText: `pubmed:${c.pmid}` },
      confidence: "medium",
      title: `${papers[c.pmid]?.title ?? "PMID " + c.pmid}${papers[c.pmid]?.year ? " (" + papers[c.pmid].year + ")" : ""}`,
      note: `Extracted claim about ${c.geneSymbol}: ${c.direction.replace("_", " ")} (${c.mechanism}); context: ${c.conditionHint}.`,
    });
  }
  for (const [symbol, g] of Object.entries(byGene)) {
    evidence.push({
      id: `ev:pubmed:models:${symbol}`,
      kind: "computed",
      source: "pubmed",
      sourceId: `esearch:${symbol}:models`,
      url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(g.modelQuery)}`,
      retrievedAt: g.retrievedAt.slice(0, 10),
      confidence: g.modelCount >= 3 ? "medium" : "low",
      title: `Disease-model literature for ${symbol}`,
      note: `${g.modelCount} PubMed records match the disease-model query. Top records: ${g.modelTopPmids.map((p) => `PMID ${p}${papers[p]?.title ? " (" + papers[p].title.slice(0, 80) + ")" : ""}`).join("; ")}. A count of papers is a proxy for model availability, not a verified list of models.`,
    });
  }

  // Cross-check (SPEC 8.2). A claim is attached to the condition of the gene whose name best matches
  // its conditionHint; otherwise to every condition of the gene with an established mechanism. A
  // condition is contested when at least two independent papers disagree with the curated direction;
  // a single dissenting paper is recorded but does not raise the flag.
  const CONTEST_MIN_PAPERS = 2;
  const tokens = (x: string) => new Set(x.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length > 2 && !/^(related|syndrome|disorder|disorders|disease|and|with|the|type|epilepsy|epileptic|encephalopathy|developmental|neurodevelopmental|intellectual|disability)$/.test(t)));
  const overlap = (x: string, y: string) => {
    const a = tokens(x);
    const b = tokens(y);
    if (!a.size || !b.size) return 0;
    let n = 0;
    for (const t of a) if (b.has(t)) n++;
    return n / Math.min(a.size, b.size);
  };
  // Review file (data/seed/contested_review.json): per-claim keep/reject decisions and per-condition labels from an
  // automated reading of the abstracts. Rejected claims are kept on the condition with their reason, never deleted.
  type Review = { reviewedAt: string; reviewer: string; claims: Record<string, { decision: "keep" | "reject"; reason: string; sameVariantClassDispute?: boolean; inPatients?: boolean }>; conditions?: Record<string, { suggestedLabel?: string; note?: string }> };
  const review = readJsonOr<Review | null>(path.join(SEED, "contested_review.json"), null);
  for (const c of atlas.conditions) {
    c.contested = undefined;
    c.supportingClaims = [];
    c.dissentingClaims = [];
    c.rejectedClaims = [];
  }
  const dissent = new Map<string, MechanismClaimEntry[]>();
  for (const [symbol, conds] of condsByGene) {
    const geneClaims = claims.filter((c) => c.geneSymbol === symbol && c.direction !== "unclear");
    for (const claim of geneClaims) {
      const entry: MechanismClaimEntry = { pmid: claim.pmid, direction: claim.direction, mechanism: claim.mechanism, conditionHint: claim.conditionHint, evidenceId: claim.evidenceId };
      const scored = conds.map((c) => ({ c, s: Math.max(overlap(claim.conditionHint, c.name), ...c.synonyms.map((syn) => overlap(claim.conditionHint, syn))) })).sort((x, y) => y.s - x.s);
      let targets: Condition[];
      if (conds.length > 1 && scored[0].s >= 0.5 && (scored.length === 1 || scored[0].s > scored[1].s)) targets = [scored[0].c];
      else {
        const same = conds.filter((c) => directionOfMechanism(c.mechanism) === claim.direction);
        targets = same.length ? same : conds.filter((c) => c.mechanism !== "undetermined" && c.mechanism !== "undetermined non-loss-of-function");
      }
      const rv = review?.claims[claim.evidenceId];
      for (const c of targets) {
        if (directionOfMechanism(c.mechanism) === claim.direction) c.supportingClaims.push(entry);
        else if (c.mechanism !== "undetermined" && c.mechanism !== "undetermined non-loss-of-function") {
          if (rv?.decision === "reject") c.rejectedClaims.push({ ...entry, reason: rv.reason, reviewer: review!.reviewer });
          else (dissent.get(c.id) ?? dissent.set(c.id, []).get(c.id)!).push(entry);
        }
      }
    }
  }
  for (const c of atlas.conditions) {
    const d = dissent.get(c.id) ?? [];
    const papers = new Set(d.map((x) => x.pmid));
    if (papers.size >= CONTEST_MIN_PAPERS) {
      const dispute = d.some((x) => review?.claims[x.evidenceId]?.sameVariantClassDispute);
      const suggested = review?.conditions?.[c.id]?.suggestedLabel;
      // Dominant-negative claims against a curated loss-of-function record are a refinement ("a different mechanism is
      // also reported"), not an opposite direction; gain claims against loss (or vice versa) are "both directions".
      const onlyDnVsLof = c.mechanism === "loss of function" && d.every((x) => x.direction === "dominant_negative");
      const kind: "contested" | "both_directions" | "different_mechanism" = dispute || suggested === "contested" ? "contested" : onlyDnVsLof ? "different_mechanism" : review ? "both_directions" : "contested";
      const note = kind === "different_mechanism" ? `Published cases report a dominant-negative effect for some ${c.geneSymbol} variants alongside the curated loss of function; a different mechanism is also reported, and which applies depends on the individual variant.` : review?.conditions?.[c.id]?.note ?? (kind === "both_directions" ? `Published cases describe ${c.geneSymbol} variants acting in more than one direction; which applies depends on the individual variant.` : undefined);
      c.contested = { curatedMechanism: c.mechanism, curatedEvidenceId: c.evidenceIds[0], claims: d, kind, note };
    } else c.dissentingClaims = d;
  }
  let contested = 0;
  for (const c of atlas.conditions) if (c.contested) contested++;
  // Attach contradiction links on the curated evidence.
  const curatedContra = new Map<string, string[]>();
  for (const c of atlas.conditions) if (c.contested) curatedContra.set(c.evidenceIds[0], c.contested.claims.map((cl) => cl.evidenceId));

  const totalDiscarded = Object.values(discardedByGene).reduce((a, b) => a + b, 0);
  const out: LiteratureFile = { byGene, papers, claims, discardedClaims: totalDiscarded, discardedByGene };
  writeJson(files.literature, out, { pretty: false });
  writeJson(files.atlas, atlas, { pretty: false });
  const all = writeEvidence(["ev:pubmed:"], evidence);
  for (const [evId, contra] of curatedContra) if (all[evId]) all[evId].contradictedBy = contra;
  writeJson(files.evidence, all, { pretty: false });
  const l = readLedger();
  updateManifest((m) => {
    m.sources.pubmed = { url: EUTILS, retrievedAt: new Date().toISOString() };
    m.counts.papers = Object.keys(papers).length;
    m.counts.t1Abstracts = jobs.length;
    m.counts.t1ClaimsVerified = claims.length;
    m.counts.t1ClaimsDiscarded = totalDiscarded;
    m.counts.contestedMechanisms = contested;
    m.counts.mechanismBothDirections = atlas.conditions.filter((c) => c.contested?.kind === "both_directions").length;
    m.counts.mechanismDifferentReported = atlas.conditions.filter((c) => c.contested?.kind === "different_mechanism").length;
    m.counts.mechanismContestedStrict = atlas.conditions.filter((c) => c.contested?.kind === "contested").length;
    m.counts.claimsRejectedOnReview = atlas.conditions.reduce((a, c) => a + c.rejectedClaims.length, 0);
    m.counts.claimsReviewed = review ? Object.keys(review.claims).length : 0;
    m.counts.genesWithModelPapers = Object.values(byGene).filter((g) => g.modelCount > 0).length;
    m.thresholds.t1AbstractsPerGene = MECH_N;
    m.thresholds.contestedMinPapers = CONTEST_MIN_PAPERS;
    m.counts.conditionsWithSingleDissent = atlas.conditions.filter((c) => c.dissentingClaims.length > 0).length;
    m.llm.spendUsd = l.totalUsd;
    m.llm.byStage = Object.fromEntries(Object.entries(l.byStage).map(([k, v]) => [k, { calls: v.calls, inputTokens: v.inputTokens, outputTokens: v.outputTokens, usd: v.usd }]));
    m.llm.models = { ...m.llm.models, ...l.models, T1: t1Model };
  });
  const dirs: Record<string, number> = {};
  for (const c of claims) dirs[c.direction] = (dirs[c.direction] ?? 0) + 1;
  log("S4", `claims verified ${claims.length} ${JSON.stringify(dirs)}; discarded ${totalDiscarded} (${discarded} this run); contested conditions ${contested}; spend $${l.totalUsd.toFixed(3)}`);
  for (const c of atlas.conditions.filter((c) => c.contested)) log("S4", `  contested: ${c.geneSymbol} ${c.name} (curated ${c.mechanism}) vs ${c.contested!.claims.map((cl) => cl.direction + "@" + cl.pmid).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
