# Slipstream

**Maria types her child's gene, and Slipstream shows which disease community is further along the same road, what she can borrow from them, and what she must not.**

A hackathon entry for Hack-Nation Challenge 05, "AI Atlas for the World's Rare Diseases". Deep slice: 65 genes in developmental and epileptic encephalopathies and related neurodevelopmental disorders. Atlas-wide layer: the full Gene2Phenotype developmental disorders panel at mechanism-and-symptoms depth.

Production URL: **https://slipstreamhackathon.vercel.app/** (Vercel; smoke-tested 2026-10-04: home page and `/condition/G2P00797` respond with HTTP 200 and render).

## The idea in one paragraph

"Similar" is not one thing. Two diseases with similar symptoms can share a registry design and outcome measures. Only diseases with the same mechanism direction (too little protein versus a harmful or overactive protein) can share a treatment strategy. Most atlases draw a single "similar" edge; Slipstream's edges are typed by what they permit. Every condition gets a readiness ladder computed from public records (gene link, mechanism, patient organization, registry or natural history study, disease models, NIH funding, targeted trial, approved therapy), each rung linked to its evidence. For any neighbor, seven transfer rules give a verdict per asset type (transferable, needs expert review, do not transfer), the rule that produced it, and the strongest reason it might be wrong. The output is a one-page sourced brief a family can send to the community ahead of them.

## Architecture

```
                 public sources (no OMIM downloads, no directory scraping)
  ┌──────────────┬──────────────┬───────────────────┬────────────────┬──────────────┐
  │ Gene2Pheno-  │ Human Pheno- │ ClinicalTrials.gov│ NIH RePORTER   │ PubMed       │
  │ type (DD)    │ type Ontology│ API v2            │ API v2         │ E-utilities  │
  └──────┬───────┴──────┬───────┴────────┬──────────┴───────┬────────┴──────┬───────┘
         │ S1 mechanism │ S2 phenotypes  │ S5 studies + T2  │ S8 funding    │ S4 literature + T1
         ▼              ▼                ▼                  ▼               ▼
   Condition / Gene / Road nodes   Study nodes        Grant + Investigator  Paper nodes, mechanism
   (curated evidence)              (quote-verified)   nodes (merged         claims (quote-verified),
         │              │                │             conservatively)      contested flags (8.2)
         │   S3 simGIC similarity, top-20 neighbors    │               │
         │              │                │  S6 name reconciliation (deterministic, then T3)
         │              │                │  S7 patient organizations (seed, unverified)
         └──────────────┴────────────────┴──────────────────┴───────────────┘
                                         │ S9 analytics
                                         ▼
        ladders · neighbor relations · transfer verdicts + counter-reasons · Louvain clusters ·
        force layout · bridges · demo candidates
                                         │ S10 briefs (T4, grounding-checked) + search index
                                         ▼ S99 validate (schemas + invariants)
                     data/derived/*.json  (committed; the app reads only these)
                                         │
                                         ▼
   Next.js app:  /  /condition/[id]  /condition/[id]/with/[neighborId]  /road/[roadId]  /map  /method  /api/brief
```

One TypeScript codebase. `src/lib/schemas.ts` holds the zod schema for every derived file and is shared by the pipeline and the app. Four evidence kinds are kept apart everywhere: curated records, extracted claims (verbatim-verified quotes with offsets), computed values, and rule-produced hypotheses.

LLM use is narrow and audited: T1 (mechanism claims from abstracts), T2 (study classification), T3 (name reconciliation), T4 (brief). All calls go to the OpenAI API with structured outputs, are cached in `data/llm/cache.jsonl` with inputs and outputs, and are priced in `data/llm/ledger.json`. Quotes that are not verbatim substrings of the cached source are discarded and counted. Brief sentences without a valid evidence id are dropped; a brief that loses more than a fifth is regenerated once, then replaced by a deterministic template.

## Reproduce the dataset

```bash
npm install
export OPENAI_API_KEY=...            # required for T1-T4; without it the curated and computed layers still build
export OPENAI_MODEL_EXPLAIN=gpt-5.4  # T1 and T4 (default)
export OPENAI_MODEL_EXTRACT=gpt-5.4-mini  # T2 and T3 (default)
export NCBI_API_KEY=...              # optional; raises the PubMed rate limit
export SLIPSTREAM_LLM_BUDGET_USD=7   # optional; the pipeline stops LLM work at this estimate

npm run data:probe                   # reachability of every source host, writes data/derived/probe.json
npm run data:build                   # all stages in order for the seed genes (data/seed/genes.txt)
npm run data:build -- --all          # also add the whole Gene2Phenotype DD panel as the shallow layer
npm run data:build -- --genes "SCN1A SCN2A"   # a smaller slice
```

Stages can be run one at a time (`npm run data:mechanism`, `data:phenotypes`, `data:similarity`, `data:literature`, `data:studies`, `data:reconcile`, `data:orgs`, `data:funding`, `data:analytics`, `data:briefs`, `data:validate`). Every stage caches raw responses under `data/raw/` and skips work that is already cached; LLM re-runs cost nothing because of the content-addressed cache. `data/derived/build-manifest.json` records source versions, row counts, thresholds, LLM spend and the git commit.

Hand-maintained inputs: `data/seed/genes.txt`, `data/seed/patient_orgs.json` (every entry is `verified: false` until a human opens the URL and flips it), `data/seed/approved_therapies.json` (empty; only entries with a regulator or label URL may be added).

## Run and deploy

```bash
npm run dev          # http://localhost:3000
npm run check        # typecheck, lint, unit tests, data validation
npm run build && npm start
```

The app reads the committed JSON under `data/derived/`; the Vercel build makes no network calls. Only `/api/brief` uses the OpenAI key at runtime, and it falls back to the deterministic template when the key is absent, the rate limit is hit or the grounding check fails. Deployment steps are in `docs/DEPLOY.md`.

## Data sources and attribution

| Source | Used for | Terms |
|---|---|---|
| [Gene2Phenotype](https://www.ebi.ac.uk/gene2phenotype) (EMBL-EBI), DD panel export | Conditions, genes, allelic requirement, mechanism and support, confidence, curated HPO terms, publications | EMBL-EBI terms of use |
| [Human Phenotype Ontology](https://hpo.jax.org) (`hp.json`, `phenotype.hpoa`, `genes_to_phenotype.txt`) | Phenotype sets, information content, similarity, synonym resolution | HPO license, attribution required: this product uses the Human Phenotype Ontology (2026-09-01). Find out more at http://www.human-phenotype-ontology.org |
| [ClinicalTrials.gov API v2](https://clinicaltrials.gov/data-api/api) | Studies, roles, modalities, eligibility exclusions, overall officials | US government work |
| [NIH RePORTER API v2](https://api.reporter.nih.gov) | Projects in the last four fiscal years, principal investigators | US government work |
| [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) (PubMed) | Mechanism abstracts, disease-model counts, last authors | NCBI terms; `tool=slipstream` on every request |

Versions and retrieval dates are in `docs/DATA_SOURCES.md` and in the build manifest shown on the Method page. OMIM identifiers appear only as cross-references inside HPO and Gene2Phenotype files; nothing is downloaded from OMIM, NORD, Global Genes or other directory sites.

## Limitations

See `docs/LIMITATIONS.md` (also rendered on the Method page). In short: mechanism is per gene and disease, not per variant; the ladder is a proxy that misses anything absent from the sources; organization listings are drafted from official sites but unverified; phenotype similarity depends on annotation depth; investigator matching is conservative and imperfect; nothing here is clinical advice.

## Repository map

```
SPEC.md              the build brief (source of truth)
HUMAN_TODO.md        what a human must check before submission
docs/                DECISIONS, PROGRESS, DATA_NOTES, DATA_SOURCES, LIMITATIONS, VIDEO_SCRIPTS, DEPLOY
data/seed            genes.txt, patient_orgs.json, approved_therapies.json
data/raw             cached source responses (gzipped) and the source texts quotes are verified against
data/llm             cache.jsonl and ledger.json (LLM audit trail)
data/derived         everything the app reads
pipeline/            one script per stage, plus lib/
src/lib              schemas, roads, similarity, ladder, transfer rules, quotes, brief, investigators
src/app              routes;  src/components  the ladder, evidence drawer, borrow cards, brief, map
tests/               vitest unit tests
```

A research navigation aid. Not medical advice. Confirm anything here with a clinician or genetic counselor.
