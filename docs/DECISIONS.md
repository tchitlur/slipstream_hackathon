# Decisions

One line per reversible choice, with the reason. Newest at the bottom.

- Renamed `SLIPSTREAM_SPEC.md` to `SPEC.md` (git mv, content preserved, section 0 filled in) because the spec names `SPEC.md` as the source of truth and two copies would drift.
- Next.js 16.3 (App Router, Turbopack), React 19, Tailwind 4, zod 4, openai SDK 6, vitest 3: current stable versions as checked with `npm view` on 2026-10-03.
- Node engine pinned to `>=20 <23` in package.json; the sandbox runs Node 22 and Vercel supports it.
- Gene2Phenotype is read from the monthly FTP CSV export (release 2026_09_28, DD panel) rather than the REST API: one file, versioned, and it already carries HPO phenotypes and publications per record.
- HPO files are fetched through `purl.obolibrary.org`, which redirects to the GitHub release assets; raw files are gzipped under `data/raw/` and committed (about 8 MB total) so a rebuild without network still works.
- Raw HTTP caches live under `data/raw/<source>/` as JSON wrapped with `retrievedAt` and `url`, keyed by a SHA-1 of the request when the key is long, so every stage skips work that is already cached.
- Roads: allelic requirement is simplified to monoallelic (any `monoallelic_*`), biallelic (`biallelic_*`) or other (mitochondrial, Y-linked, 2 records in the DD panel). Loss-of-function roads are split by allelic class; the other mechanisms are one road each, as in SPEC 7.1. The "other" loss-of-function road is labelled "Too little protein: unusual inheritance".
- Road colors: monoallelic LoF blue, biallelic LoF teal, GoF red, dominant negative amber, undetermined non-LoF violet, undetermined grey. Verdict colors (green, amber, red) are only used on verdict chips, never on roads.
- LLM calls use the Responses API with `text.format` JSON schema (strict), `store: false`, and a `reasoning.effort` hint; GPT-5 models do not accept `temperature`, so determinism comes from the content-addressed cache instead.
- LLM price table is an upper-bound estimate (gpt-5.4 $2.50/$15 per 1M tokens, gpt-5.4-mini $0.75/$4.50) because pricing is not exposed by the API; the ledger therefore overstates spend slightly, which errs on the safe side of the $7 cap.
- Phenotype set per condition = HPOA terms of the cross-referenced disease (OMIM via G2P `disease mim`) unioned with the HPO terms curated on the G2P record itself; both are curated. The match method records which source supplied the terms.
- Studies capped at 30 per gene (interventional first, then cond-query hits, then most recent) and T1 at 12 abstracts per gene, to keep T2 plus T1 under about $4.5 of the $7 cap; phase-1 genes already classified at the earlier cap of 40 keep their results.
- LLM price lookup matched gpt-5.4-mini to the gpt-5.4 price row by prefix, inflating the ledger threefold ($6.99 vs $2.34 recomputed from the cache). Fixed to exact-then-longest-prefix matching; the ledger is rebuilt from data/llm/cache.jsonl, which is the audit trail of record.
- Similarity cutoffs (edge, high, medium) are percentiles over deep-slice pairs only, so adding the 2,800-condition shallow layer does not drag them down and relabel every DEE neighbor as "high".
- Investigator mentions that do not look like a person (e.g. "UCB Cares", "Medical Monitor", "Study Director") are dropped before merging; degree titles (MD, PhD, Prof) are stripped from names.
