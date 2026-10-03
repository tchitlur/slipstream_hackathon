# Slipstream: build spec for Claude Code

This document is the full brief for building Slipstream, a hackathon entry. Save it verbatim as `SPEC.md` at the repo root, commit it, then build what it describes. It is the source of truth. Where it is silent, use your judgment and record the choice in `docs/DECISIONS.md`.

---

## 0. Human inputs

The human fills these in before starting. Every field has a default, so a blank field never blocks you.

| Field | Value | If blank |
|---|---|---|
| Submission deadline (date, time, timezone) | Due at 6am EST october 4th | Assume 16 hours from session start and work in the priority order in section 14 |
| Team members and one-line backgrounds | Tanay Chitlur Computer Science & Biomedicine |
| Contact email for NCBI requests | | Omit the `email` parameter |
| NCBI API key (optional, free) | set as `NCBI_API_KEY` in the environment | Stay under 3 requests per second |
| Preferred demo disease or gene | | Choose from the data (section 9.6) |
| Sourced baseline for the 10x claim | | Leave a visible placeholder (section 10.8) |

---

## 1. Context

**The event.** Hack-Nation 7th Global AI Hackathon, Challenge 05, "AI Atlas for the World's Rare Diseases", supported by OpenAI and the Buffalo Initiative. It is a 24-hour build. Entries need a deployed working prototype, a source repo with a README covering architecture and how to reproduce the dataset, and three 60-second videos (demo, technical, team).

**What the challenge asks for.** A knowledge graph of diseases, genes and variants, mechanisms, symptoms, patient groups, papers, studies and research assets, where every edge explains a relationship and cites evidence. The central user is Maria, who leads a patient group for a disease with no approved treatment. She needs three answers: who shares our disease characteristics, what useful work already exists, and what should we do together next. Three secondary users matter: Devon (a newly diagnosed caregiver searching at 2 a.m.), Priya (a biotech scout who holds one therapeutic mechanism and wants every disease it could fit), and Dr. Osei (a researcher who wants to know who else works on his mechanism under other gene names).

**How it is judged.** The track scores graph quality (meaningful node and edge design, defensible clustering, counterexamples, clear treatment of uncertainty), evidence integrity (sourced claims that separate data from hypotheses and clinical proof), patient progress (a family moves from an isolated diagnosis to a justified collaboration, a reusable asset and a next milestone), 10x impact, and product craft. The general rubric adds technical depth, communication and innovation in equal thirds. To be eligible for the track prize, the product must use OpenAI models, so all LLM calls in the pipeline and the app go to the OpenAI API.

**What the brief says about honesty.** If there is no supported route, the product says so, explains what was searched, and names what evidence is missing. Treat this as a first-class state, not an error.

**The human.** They have a biomedical background and can judge biology. They are short on time and want as little intervention as possible. They can supply an OpenAI key and click through Vercel. They cannot debug your code for you.

---

## 2. The product

**One sentence.** Maria types her child's gene, and Slipstream shows which disease community is further along the same road, what she can borrow from them, and what she must not.

**The core idea.** "Similar" is not one thing. Two diseases with similar symptoms can share a registry design and outcome measures. Only diseases with the same mechanism direction (too little protein versus a harmful or overactive protein) can share a treatment strategy. Most atlases draw a single "similar" edge. Slipstream's edges are typed by what they permit.

**The three answers.**

1. **Who is on our road?** Conditions that break the same way (mechanism road) and conditions that look alike in patients (phenotype similarity). These are shown as two separate axes, never blended into one score.
2. **Who is ahead of us?** Every condition gets a readiness ladder computed from public data: gene link confirmed, mechanism established, patient organization, registry or natural history study, disease models, active funding, targeted clinical trial. Each rung links to its evidence.
3. **What can we borrow?** For a chosen neighbor, each asset type gets a verdict (transferable, needs expert review, do not transfer), the rule that produced it, and the strongest reason it might be wrong.

**The output.** A one-page sourced brief Maria can send to the community ahead of her.

**A motivating example, for your understanding only.** Dravet syndrome is caused by too little of one sodium-channel protein (SCN1A, monoallelic loss of function). An antisense therapy in a phase 3 trial is designed to raise output from the healthy copy, and the trial excludes gain-of-function variants. A family with a different monoallelic loss-of-function epilepsy gene therefore has a community years ahead on the same road. A family whose variant is gain-of-function looks similar clinically and could share registry design, but the therapeutic logic is the opposite. The app must derive whatever it shows from fetched data. Never hardcode this paragraph or any other biological claim into the product.

---

## 3. How to work

You are running in a cloud session with edits auto-accepted. The human wants you to keep moving.

**Decide and log.** For any reversible choice (library, threshold, layout, naming, query wording), choose, write one line in `docs/DECISIONS.md` with the reason, and continue. Do not ask.

**Stop only at these gates.** When you stop, put everything the human needs into one message with click-by-click steps.

- **Gate A, network or key missing (start of work).** Run the source probe in section 6.1. If hosts are blocked or `OPENAI_API_KEY` is absent, tell the human exactly what to change (section 13.1). Then keep building everything that does not depend on the missing piece. Do not idle.
- **Gate B, Vercel import (end of phase 1).** Give the human the instructions in section 13.2 and continue working while they do it.
- **Gate C, human review (end of work).** Hand over `HUMAN_TODO.md` (section 12).

**Never fabricate.** No invented organizations, investigators, trials, PMIDs, quotes, counts or timelines. If a source returns nothing, the answer is "not found in the sources searched". The human will be questioned by expert judges, and one invented fact discredits the whole entry.

**The data wins.** If fetched data contradicts an expectation in this spec, keep the data, and write the discrepancy in `docs/DATA_NOTES.md` for the human to review.

**Stay resumable.** Commit and push at the end of every phase and after any substantial step. Keep `docs/PROGRESS.md` current with phase status, what is done, what is next, and any open problem. A fresh session should be able to continue from `SPEC.md` plus `docs/PROGRESS.md` alone.

**Spend limits.** The OpenAI key has about $15 on it. Cap pipeline spend at $7.00 and leave the rest for the live app during judging. Section 8.4 has the mechanics. If the cap is reached, stop LLM stages, keep what is cached, and report it.

**Check your own work.** Before declaring a phase done, run `npm run check` (section 11) and open the built app locally to confirm the phase's acceptance criteria.

---

## 4. Stack and layout

One TypeScript codebase. The pipeline and the app share types and schemas.

- **App:** Next.js (App Router), TypeScript, Tailwind CSS. Use current stable versions; check them rather than assuming.
- **Pipeline:** Node scripts run with `tsx`. No Python.
- **Validation:** `zod` schemas for every external payload and every derived file.
- **Graph:** `graphology` with `graphology-communities-louvain`. Layout is precomputed at build time.
- **LLM:** the official `openai` SDK with structured outputs (JSON schema).
- **Search:** a client-side index (MiniSearch or Fuse.js).
- **Tests:** `vitest`.
- **Storage:** none. The app reads precomputed JSON committed to the repo. The Vercel build makes no network calls.

```
SPEC.md
README.md
HUMAN_TODO.md
docs/            DECISIONS.md  PROGRESS.md  DATA_NOTES.md  DATA_SOURCES.md
                 LIMITATIONS.md  VIDEO_SCRIPTS.md  DEPLOY.md
data/
  seed/          genes.txt  patient_orgs.json  approved_therapies.json
  raw/           cached source responses (commit if small; gzip large files)
  llm/           cache.jsonl  ledger.json   (LLM inputs, outputs, cost: the audit trail)
  derived/       files in section 7.3
pipeline/        one file per stage in section 8, plus lib/
src/app/         routes in section 10
src/components/
src/lib/         shared types, schemas, graph helpers, transfer rules
tests/
```

If the repo already has content, read it first and fit this layout around it. Do not delete the human's files without a logged reason.

---

## 5. Scope

**Deep slice.** About 65 genes in developmental and epileptic encephalopathies and related neurodevelopmental disorders. Seed list for `data/seed/genes.txt`:

```
SCN1A SCN2A SCN3A SCN8A SCN1B KCNQ2 KCNQ3 KCNT1 KCNA2 KCNB1 KCNC1 KCNH1 HCN1 CACNA1A CACNA1E
GRIN1 GRIN2A GRIN2B GRIN2D GABRA1 GABRB2 GABRB3 GABRG2
STXBP1 SYNGAP1 SLC6A1 DNM1 STX1B SYN1 SNAP25 PRRT2 SHANK3 IQSEC2 CASK NRXN1
MECP2 CDKL5 FOXG1 TCF4 UBE3A CHD2 MEF2C SATB2 DYRK1A HNRNPU HNRNPH2 ARX ADNP ANKRD11 DDX3X PURA SMC1A
SLC2A1 SLC13A5 ALDH7A1 PNPO
PCDH19 DEPDC5 TSC1 TSC2 WWOX EEF1A2 GNAO1 ATP1A3 SPTAN1
```

Drop any gene the curated mechanism source does not cover and log it.

**Vertical slice (phase 1).** Ten genes, end to end, deployed: `SCN1A SCN2A SCN8A KCNQ2 KCNT1 STXBP1 SYNGAP1 SLC6A1 CDKL5 MECP2`.

**Atlas-wide shallow layer (phase 4).** Every record in the curated source's developmental disorders panel gets the mechanism and phenotype layers only. This demonstrates how the graph scales. Conditions outside the deep slice are labeled "mechanism and symptoms only; deeper layers not yet built".

---

## 6. Data sources

All sources are public and free. Record each one in `docs/DATA_SOURCES.md` with URL, retrieval date, version or release where available, and license or terms.

| Layer | Source | What to take | Notes |
|---|---|---|---|
| Mechanism (backbone) | Gene2Phenotype (EBI), `ebi.ac.uk/gene2phenotype` | Per record: stable G2P ID, gene and HGNC ID, disease name and cross-references, allelic requirement, confidence, molecular mechanism (loss of function, gain of function, dominant negative, undetermined non-loss-of-function, undetermined), mechanism support (evidence or inferred), mechanism synopsis, publications | Offers bulk download and a REST API. Find the current format yourself. This is curated data, so mechanism does not rest on LLM output. |
| Phenotype | Human Phenotype Ontology | `hp.json` (ontology), `phenotype.hpoa` (disease to phenotype), `genes_to_phenotype.txt` | Try `purl.obolibrary.org/obo/hp.json` and `purl.obolibrary.org/obo/hp/hpoa/...`; fall back to the GitHub releases of `obophenotype/human-phenotype-ontology`. Attribution is required. |
| Studies | ClinicalTrials.gov API v2, `clinicaltrials.gov/api/v2/studies` | NCT ID, titles, status, study type, phase, conditions, interventions and types, brief summary, eligibility text, sponsor, overall officials, start date | Query by disease names with `query.cond` and by gene symbol with `query.term`. Gene-symbol hits are noisy; see stage S5. |
| Funding | NIH RePORTER API v2, `api.reporter.nih.gov/v2/projects/search` | Project number, title, fiscal year, PI names, organization, abstract excerpt | Last four fiscal years. About one request per second. |
| Literature | NCBI E-utilities (PubMed) | PMID, title, abstract, authors, year | 3 requests per second without a key. Send `tool=slipstream`. |
| Patient organizations | `data/seed/patient_orgs.json` | Name, official URL, conditions served, registry stated on site (yes, no, unknown) with the page URL | See stage S7. Draft entries are unverified until the human checks them. |
| Approved therapies | `data/seed/approved_therapies.json` | Condition, therapy, regulator, source URL | Optional rung. Start empty. Only add entries with a regulator or label URL, marked unverified. |

Do not download from or scrape OMIM (licensed), and do not bulk-scrape NORD, Global Genes or other directory sites. Linking to an organization's own public site is fine. OMIM identifiers that appear inside HPO or Gene2Phenotype files may be used as cross-references.

### 6.1 Source probe (first thing you run)

Write `pipeline/00_probe.ts`. For each host in the table plus `api.openai.com`, make one small request and print reachable or blocked, with the HTTP status. Also print whether `OPENAI_API_KEY` is set (never print its value). Save the result to `data/derived/probe.json`. If anything is blocked, go to Gate A.

Hosts: `www.ebi.ac.uk`, `ftp.ebi.ac.uk`, `purl.obolibrary.org`, `github.com`, `raw.githubusercontent.com`, `clinicaltrials.gov`, `api.reporter.nih.gov`, `eutils.ncbi.nlm.nih.gov`, `api.openai.com`.

---

## 7. Data model

### 7.1 Entities

The focal entity is a **Condition**: one gene, one disease, one mechanism, as curated (one Gene2Phenotype record). This matters because the same gene can have a loss-of-function condition and a gain-of-function condition, and they must be separate nodes.

| Node | ID pattern | Key fields |
|---|---|---|
| Condition | `cond:<G2P id>` | name, synonyms, geneId, allelicRequirement, mechanism, mechanismSupport, confidence, roadId, depth (`deep` or `shallow`) |
| Gene | `gene:<HGNC id>` | symbol, aliases |
| Road | `road:<allelic class>:<mechanism>` | plain-language label, description |
| Phenotype | `HP:...` | label, information content |
| Study | `NCT...` | type, phase, status, classification from S5 |
| Grant | `grant:<project number>` | title, fiscal years, organization |
| Paper | `PMID:...` | title, year |
| Investigator | `inv:<slug>` | display name, organizations, linked records |
| PatientOrg | `org:<slug>` | name, URL, registry flag, verified flag |
| Cluster | `cluster:<n>` | member conditions, top informative phenotypes |

**Roads and their plain-language labels.** Simplify the allelic requirement to monoallelic (including X-linked dominant and hemizygous cases, with the raw value kept) or biallelic.

| Road | Label shown to families |
|---|---|
| monoallelic, loss of function | Too little protein: one copy is lost |
| biallelic, loss of function | Protein missing: both copies are lost |
| gain of function | Protein is overactive or does something new |
| dominant negative | A faulty protein interferes with the normal one |
| undetermined non-loss-of-function | Not a simple loss; exact mechanism unsettled |
| undetermined | Mechanism not established |

### 7.2 Evidence

Every edge and every claim shown in the UI carries one or more evidence records.

```ts
type Evidence = {
  id: string;                 // stable, e.g. "ev:ctgov:NCT01234567:phase"
  kind: "curated" | "extracted" | "computed" | "hypothesis";
  source: "g2p" | "hpo" | "ctgov" | "reporter" | "pubmed" | "seed" | "rule";
  sourceId: string;           // G2P id, HP id, NCT id, project number, PMID, rule id
  url: string;                // public record
  retrievedAt: string;        // ISO date
  quote?: { text: string; start: number; end: number };  // verbatim, with offsets into the source text
  confidence: "high" | "medium" | "low";
  note?: string;
};
```

The four kinds map to the badges users see, and to the brief's demand to separate data from hypotheses:

- **curated**: stated by an expert-curated database. Badge: "Curated record".
- **extracted**: an LLM pulled it from a document and the quote was verified verbatim. Badge: "Quoted from source".
- **computed**: a deterministic calculation over data. Badge: "Calculated".
- **hypothesis**: produced by a transfer rule. Badge: "Hypothesis, needs expert review".

A study existing is not clinical proof. Never present trial existence as evidence that a therapy works.

### 7.3 Derived files (`data/derived/`)

`atlas.json` (conditions, genes, roads, clusters), `phenotypes.json` (term labels and information content for terms in use), `similarity.json` (top 20 neighbors per condition with shared informative terms), `ladders.json`, `transfers.json`, `investigators.json`, `orgs.json`, `evidence.json` (id to record), `layout.json` (x, y per condition), `search-index.json`, `demo_candidates.json`, `briefs/<focal>__<neighbor>.json`, `build-manifest.json` (source versions and dates, row counts per stage, thresholds chosen, LLM spend, git commit).

Define a zod schema for each file in `src/lib/schemas.ts`. `pipeline/99_validate.ts` checks every file against its schema and enforces the invariants in section 11.

---

## 8. Pipeline

Each stage is a script, `npm run data:<stage>`, and `npm run data:build` runs them in order. Stages cache raw responses under `data/raw/` and skip work that is already cached. Take a `--genes` argument so phase 1 can run on ten genes.

**S1 Mechanism.** Load Gene2Phenotype records for the seed genes (and, in phase 4, the whole developmental disorders panel). Create Condition, Gene and Road nodes with curated evidence. Keep the raw allelic requirement and mechanism strings.

**S2 Phenotypes.** Parse the ontology into parent links. For each condition, find its phenotype set: match the condition's disease cross-references to `phenotype.hpoa` disease IDs first; if there is no cross-reference, match by gene and disease name through `genes_to_phenotype.txt`; leave ambiguous matches for S6. Record how each condition was matched. A condition with fewer than five terms is flagged `thinAnnotation`.

**S3 Similarity.** Compute information content per term as `-log(p)`, where `p` is the share of annotated diseases carrying the term or any descendant. Similarity between two conditions is simGIC: the summed information content of the intersection of their ancestor-closed term sets, divided by that of the union. Store each condition's top 20 neighbors with the five highest-information shared terms. Also store, per pair, what share of the intersection weight comes from low-information terms (below the median), for the counter-reasons in section 9.5.

**S4 Literature.** For each deep-slice gene, fetch up to 15 abstracts for a mechanism query (gene symbol in title or abstract, with loss of function, gain of function, haploinsufficiency or dominant negative) and record counts and the top five PMIDs for a disease-model query (gene symbol with mouse model, knockout, knock-in, iPSC, organoid or zebrafish). Then run LLM task T1 on the mechanism abstracts.

**S5 Studies.** Query ClinicalTrials.gov for each deep-slice condition by disease names and by gene symbol. Deduplicate by NCT ID. Run LLM task T2 to classify each study. Discard studies classified as not about the condition (for example, gene-panel studies that list hundreds of genes).

**S6 Reconciliation.** Map free-text condition names from ClinicalTrials.gov and RePORTER to Condition IDs. Do it deterministically first: exact and normalized matches on disease names, synonyms and gene symbols. Send only the unresolved remainder to LLM task T3. Keep every mapping decision with its method (`exact`, `normalized`, `llm`) so the synonym resolution is inspectable.

**S7 Patient organizations.** Draft `data/seed/patient_orgs.json` for the deep slice. If you have a web search tool, find each organization's own official site and record the name, URL, the conditions it serves, and whether the site states that a registry or natural history study exists (with the page URL). Mark every entry `verified: false`. If you have no web search, create entries only for organizations you can confirm from a ClinicalTrials.gov or RePORTER record, and list the gaps in `HUMAN_TODO.md`. Never guess a URL.

**S8 Funding and investigators.** Query RePORTER by gene symbol and disease name for the last four fiscal years. Build Investigator nodes from RePORTER principal investigators, ClinicalTrials.gov overall officials, and last authors of S4 papers. Merge names conservatively (same normalized surname, same first initial, and same organization, or the same linked record); when unsure, keep them separate. Link only to public records. Do not collect email addresses.

**S9 Analytics.** Ladders, clusters, layout, transfer verdicts, bridges and demo candidates, as defined in section 9.

**S10 Briefs and search.** Pre-generate briefs for the top five demo candidates with their best neighbor (LLM task T4), so the demo works even if the live key is exhausted. Build the search index.

**S99 Validate.** Section 11.

### LLM tasks used by the pipeline and the app

All tasks use structured outputs and temperature 0 where the model allows it.

**T1 Mechanism claims from abstracts.** Input: gene, abstract text, PMID. Output: a list of `{ conditionHint, mechanism, direction: "loss" | "gain" | "dominant_negative" | "unclear", quote }`. The quote must be copied verbatim from the abstract.

**T2 Study classification.** Input: study fields. Output: `{ aboutCondition: boolean, role: "natural_history" | "registry" | "interventional_targeted" | "interventional_symptomatic" | "other", modality: "antisense" | "gene_therapy" | "small_molecule" | "enzyme_or_protein" | "diet_or_supplement" | "device_or_behavioral" | "none" | "unclear", excludesMechanism?: string, quote }`. "Targeted" means the intervention addresses the genetic cause. `excludesMechanism` captures eligibility text that excludes a variant class, which is direct evidence that mechanism direction governs who a therapy fits.

**T3 Name reconciliation.** Input: one unresolved name and a short list of candidate conditions. Output: the matching Condition ID or `none`, with a one-line reason.

**T4 Brief and connection explanations.** Input: an evidence pack (the focal condition, the neighbor, ladder differences, transfer verdicts, counter-reasons, and the evidence records behind them). Output: sections of sentences, each sentence carrying `evidenceIds`. Written at a reading level a parent without medical training can follow, with a short glossary for unavoidable terms.

### 8.1 Quote verification

For T1 and T2, normalize whitespace and Unicode quotes and dashes in both the quote and the source text, then require the quote to be an exact substring. Store character offsets. A claim whose quote fails is discarded and counted in the build manifest. This rule is what lets the product say that no extracted claim is shown without its source sentence.

### 8.2 Cross-checking curated against extracted

For each condition, compare the curated mechanism with T1 claims that survived verification. Agreement raises nothing. A verified claim of a different direction for the same gene creates a `contested` flag on the condition's mechanism, listing both sides with their evidence. If the curated source has a separate condition for that other direction, attach the claim there instead and link the two conditions as "same gene, different mechanism".

### 8.3 Grounding check for T4

After generation, drop any sentence whose `evidenceIds` are empty or not present in the evidence pack. If more than a fifth of sentences are dropped, regenerate once, then fall back to the deterministic template in section 10.5.

### 8.4 Models, budget and cache

- Use two models. `OPENAI_MODEL_EXPLAIN` (default `gpt-5.4`) runs T1 and T4, where judgment matters: deciding the direction of a mechanism claim, and writing the brief families and judges will read. `OPENAI_MODEL_EXTRACT` (default `gpt-5.4-mini`) runs T2 and T3, which are classification and matching.
- Before first use, list models through the API and confirm each ID exists and supports structured outputs. If one does not, pick the nearest current equivalent in the same price tier and log it.
- If the cost estimate for T1 on the stronger model exceeds $4.00, run T1 on the mini model instead, then re-run only the claims that disagree with the curated mechanism on the stronger model, since those are the ones that create a contested flag.
- Cache every call in `data/llm/cache.jsonl`, keyed by a hash of model, schema and input. Re-runs must cost nothing.
- Keep `data/llm/ledger.json` with token counts and estimated cost per stage. Estimate cost before each stage. Stop LLM work at $7.00 total.
- If the key is missing, skip LLM stages with a clear warning, build everything else, and note it at Gate A. The app must still build and run on curated and computed layers alone.

---

## 9. Analytics

### 9.1 Readiness ladder

Each condition gets these milestones. Status is `found`, `not_found` (searched, nothing returned) or `not_searched` (shallow conditions). The UI wording for `not_found` is "Not found in the sources we searched", with the sources listed.

| # | Milestone | Found when | Evidence |
|---|---|---|---|
| 1 | Gene link confirmed | Curated confidence is definitive or strong | curated |
| 2 | Mechanism established | Curated mechanism is not undetermined; show whether support is evidence or inferred | curated |
| 3 | Patient organization | A seed organization serves the condition | seed, with verified flag |
| 4 | Registry or natural history study | A T2 study with role `natural_history` or `registry`, or an organization site stating one | extracted or seed |
| 5 | Disease models reported | The disease-model literature query returned papers; show count and top PMIDs | computed |
| 6 | Active NIH-funded research | RePORTER projects in the last two fiscal years | curated |
| 7 | Targeted clinical trial | A T2 study with role `interventional_targeted`; show highest phase and modality | extracted |
| 8 | Approved disease-specific therapy | An entry in `approved_therapies.json` | seed, with verified flag |

Real progress is not strictly linear, so present these as milestones in a conventional order. A neighbor is "ahead" on a milestone when it has `found` and the focal condition has `not_found`.

### 9.2 Clusters and layout

Build a graph of conditions with edges to each condition's nearest neighbors by phenotype similarity above a threshold. Choose the threshold from the observed distribution (start with the 90th percentile of pairwise similarity), log it in the manifest, and run Louvain. Name each cluster by its most informative shared phenotypes. Precompute a 2D force layout and save coordinates. Roads are a separate categorical grouping, shown by color.

### 9.3 Neighbors

For a focal condition, show its top neighbors by phenotype similarity, each with: the similarity value, the top shared informative phenotypes, the mechanism relation (`same road`, `different road`, `opposite direction`, `unknown`, `contested`), and milestones on which the neighbor is ahead. "Opposite direction" means one is loss of function and the other is gain of function or dominant negative.

### 9.4 Transfer rules

Verdicts are `transferable`, `needs_expert_review` or `do_not_transfer`. Each verdict is a `hypothesis` evidence record citing its rule ID. Define `high` and `medium` phenotype similarity as percentile cutoffs from the observed distribution and log them.

| Rule | Asset from the neighbor | Verdict logic |
|---|---|---|
| R1 | Registry design and natural history protocol | High phenotype similarity: transferable. Medium: needs expert review. Mechanism does not matter. |
| R2 | Outcome measures and endpoints | Same as R1, and always flag age of onset and severity for review. |
| R3 | Clinical network, sites and investigators | Medium or higher phenotype similarity, or a shared investigator: transferable. |
| R4 | Therapeutic strategy and modality | Same road: needs expert review, with the modality named. Opposite direction: do not transfer, shown as an explicit warning. Unknown or contested: needs expert review, stating what must be established first. |
| R5 | Disease models and assays | The model itself is gene-specific: do not transfer. The assay design is reusable on the same road: needs expert review. |
| R6 | Trial design | Same road and high phenotype similarity: needs expert review. Otherwise: do not transfer. |
| R7 | Enrolment in the neighbor's trial | Never asserted. Show the trial's eligibility excerpt and tell the family to ask the study team. |

Keep the rules as data in `src/lib/transferRules.ts`, with unit tests, and render the rule table on the Method page so judges can read the logic.

### 9.5 Counter-reasons

Every verdict displays the strongest applicable reason it might be wrong. This is the "counterexamples and clear treatment of uncertainty" the judges score.

| Code | Shown when |
|---|---|
| C1 | Most of the phenotype overlap comes from common, low-information symptoms |
| C2 | Mechanism is recorded per gene and disease; an individual's variant may act differently. Shown on every R4, R5 and R6 verdict, with advice to confirm the variant's class with a clinical geneticist. |
| C3 | The mechanism is contested (section 8.2) |
| C4 | Curated mechanism support is inferred, not based on functional evidence |
| C5 | Allelic requirement differs |
| C6 | Either condition has thin phenotype annotation, so similarity is unreliable |
| C7 | The neighbor's asset rests on a single study, or one that is terminated, withdrawn or not yet recruiting |
| C8 | The organization listing is unverified |

### 9.6 Demo candidates

Rank deep-slice conditions by how well they show the product: the condition lacks milestones 4 to 7, has a same-road neighbor with high phenotype similarity that is ahead on at least two of them, and also has a high-similarity neighbor in the opposite direction (the counterexample). Write the top ten to `demo_candidates.json` with a one-line reason each. Use the first as the default demo unless the human named one.

### 9.7 Bridges

An investigator linked to two or more conditions on different roads or in different clusters is a bridge. List bridges per condition with the public records that link them.

---

## 10. The app

### 10.1 Routes

| Route | Purpose |
|---|---|
| `/` | One search box and three example entries drawn from the demo candidates. A short line stating what the atlas covers and when it was built. |
| `/condition/[id]` | The main page: "Your road". |
| `/condition/[id]/with/[neighborId]` | Borrow view and brief. |
| `/road/[roadId]` | Every condition on one mechanism road, ranked by readiness, with organizations and assets. This is Priya's view. |
| `/map` | Cluster map of all conditions. |
| `/method` | Sources, dates, coverage, transfer rules, limitations, the 10x case. |
| `/api/brief` | Live brief generation (T4). |

### 10.2 Search

One box accepts a disease name, gene symbol, symptom, patient organization, or mechanism phrase. Results are grouped by type. When a synonym resolved the query, say so ("Showing STXBP1-related disorder for 'Ohtahara syndrome'"), because visible synonym resolution is something the brief asks for. A symptom query lists conditions carrying that phenotype, ordered by how informative the term is.

### 10.3 Condition page

Top to bottom:

1. **Header.** Condition name, gene, the road's plain-language label, and badges for the mechanism evidence (curated, support type, contested if so). Directly beneath, the C2 notice about confirming the individual variant's class.
2. **Community.** For Devon: the patient organization for this exact condition if one is known. If none is known, say so plainly, show the closest related communities, and explain what would change that.
3. **The ladder (signature component).** Rows are the focal condition and its top neighbors. Columns are the eight milestones. Each cell is found, not found, or not searched. The focal row is pinned and highlighted. Cells where a neighbor is ahead are emphasized. Each neighbor row shows the mechanism relation and phenotype similarity as two separate indicators. Clicking any cell opens the evidence drawer.
4. **Who works on this mechanism.** For Dr. Osei: investigators on the same road across gene names, with bridges marked and links to public records.
5. **No supported route.** If no neighbor clears the medium similarity cutoff, replace the neighbor rows with a clear statement of what was searched, what is missing, and the next question worth testing.

### 10.4 Borrow view

For the chosen neighbor: a side-by-side header (roads, shared informative phenotypes, what differs), then one card per asset type from section 9.4 showing the verdict, the specific asset with its record link, the rule in one sentence, and the counter-reason. "Do not transfer" cards are visually distinct and explain why. End with "Questions to take to an expert", generated from the counter-reasons that fired.

### 10.5 Brief

A "Draft a brief for this community" action produces a one-page document: who we are (placeholder for Maria to fill), why we are writing to you, what we share (with evidence), what we would like to learn from or reuse, what we know differs, and questions for expert review. Every factual sentence has a footnote to an evidence record. Provide copy and print actions. Serve a pre-generated brief when one exists; otherwise call `/api/brief`. If the API fails or the grounding check fails twice, render the deterministic template built from the same evidence pack, labeled as such. Rate-limit the route and cache results in memory.

### 10.6 Evidence drawer

One reusable component. For any claim it shows the badge for the evidence kind, the source and record ID with a link, the retrieval date, the verbatim quote highlighted where there is one, the confidence, and any contradicting evidence beside it.

### 10.7 Map

Conditions at their precomputed coordinates, colored by road, with cluster labels. Shallow conditions are drawn lighter. Hover shows the name; click opens the condition page. Render on canvas if there are more than a few hundred nodes. This is the secondary view; the ladder is the primary one.

### 10.8 Method page and the 10x case

State the milestone: a fundable natural history study plan for a condition that has none. Show the proposed route (adapt a same-cluster neighbor's protocol and outcome measures instead of designing from scratch) and list the assumptions. The baseline timeline must come from the human with a source. Until it is supplied, show "Baseline timeline: to be supplied with a source" and do not display any multiplier. Also list limitations honestly, drawn from `docs/LIMITATIONS.md`.

### 10.9 Design

The brief asks for low ink and high signal, color that carries meaning, progressive reveal (summary first, depth on click), and every edge explained. Follow that.

- The audience includes frightened parents. The tone is calm, plain and respectful. No hype, no exclamation marks, no stock imagery.
- Give each road one color and use it consistently everywhere. Verdict colors are separate from road colors. Never rely on color alone; pair it with a label or icon.
- The ladder should be the thing people remember. Spend your design effort there.
- Make deliberate typographic and layout choices so the result does not look like a default template. If a frontend design skill is available to you, use it.
- Works on a phone. Supports keyboard navigation. Meets normal contrast standards.
- Every page carries a footer line: "A research navigation aid. Not medical advice. Confirm anything here with a clinician or genetic counselor."

---

## 11. Integrity checks and tests

`npm run check` runs type checking, lint, unit tests and `pipeline/99_validate.ts`. It must pass before each push.

**Invariants enforced by validation:**

- Every edge and every displayed claim references at least one evidence ID that exists.
- Every `extracted` evidence record has a quote whose offsets match the cached source text.
- Every transfer verdict cites a rule ID and at least one counter-reason code.
- No condition appears without a road.
- Every `found` milestone has evidence; every `not_found` milestone lists the sources searched.
- No organization or approved therapy without a URL.

**Unit tests:** information content and simGIC on a tiny hand-built ontology, quote normalization and verification, each transfer rule, ladder status logic, the brief grounding check, investigator merge rules.

**Expectations to report, not enforce.** After the build, check these and write the results in `docs/DATA_NOTES.md`. If any is false, do not change data to make it true.

- SCN1A has a monoallelic loss-of-function condition.
- At least one ion-channel gene in the slice has a condition that is not loss of function.
- At least one gene in the slice has conditions or verified claims in both directions.
- At least one ClinicalTrials.gov study in the slice has eligibility text that excludes a variant class.

---

## 12. Documents to produce

- **`README.md`**: what Slipstream is, a diagram of the architecture, how to reproduce the dataset (`npm run data:build` and the environment variables), how to run and deploy, data sources with attribution, limitations.
- **`docs/LIMITATIONS.md`**: mechanism is per gene and disease, not per variant; the ladder is a proxy and misses anything absent from the sources; organization listings are partly hand-checked; phenotype similarity depends on annotation depth; investigator name matching is imperfect; nothing here is clinical advice.
- **`docs/VIDEO_SCRIPTS.md`**: three scripts of at most 60 seconds each, with on-screen actions timed. Demo: Maria searches, the ladder shows a community ahead, a "do not transfer" card shows the counterexample, the brief is generated. Technical: the curated mechanism backbone, quote-verified extraction and the contested flag, the computed ladder, typed transfer rules, with real numbers from the build manifest and an honest note on what did not work during the build. Team: placeholders from section 0.
- **`docs/DEPLOY.md`**: section 13.2, updated with anything specific to the final repo.
- **`HUMAN_TODO.md`**: a checklist with time estimates. Verify each patient organization entry (open the URL, confirm it serves the condition, flip `verified`). Review `docs/DATA_NOTES.md`. Confirm or change the demo condition. Supply the sourced 10x baseline. Fill team placeholders. Record the videos.

---

## 13. Instructions to give the human

### 13.1 Gate A: cloud environment

Give these steps if hosts are blocked or the key is missing, listing the exact blocked hosts from the probe:

1. At claude.ai/code, open the environment selector and edit the environment this session uses.
2. Set **Network access** to **Full**. If they prefer **Custom**, give them the blocked hosts to add.
3. In **Environment variables**, add one per line in `.env` format with no quotes: `OPENAI_API_KEY=...`, and optionally `NCBI_API_KEY=...`.
4. Save, then start a new session on the same repo and branch with the message: "Read SPEC.md and docs/PROGRESS.md and continue."

Tell them that environment variables are visible to anyone who can use that environment.

### 13.2 Gate B: Vercel

Before giving these steps, confirm `npm run build` passes in your sandbox with no network access at build time, and that `package.json` declares the Node version. Then tell the human:

1. In Vercel, choose Add New, then Project, and import this GitHub repository.
2. Accept the detected Next.js preset. State the root directory if it is not the repo root.
3. Under Environment Variables, add `OPENAI_API_KEY`, `OPENAI_MODEL_EXPLAIN` and `OPENAI_MODEL_EXTRACT` with the values you specify, for all environments.
4. Deploy.
5. Merge the pull request from your working branch into the production branch so the production URL updates. State the branch name and the pull request link, or how to create it.
6. Paste back the production URL, and the build log if the build fails.

Mention that preview deployments may require a Vercel login, so judges should be given the production URL. When you receive the URL, fetch the home page and one condition page to confirm they respond, and add the URL to the README.

---

## 14. Phases and priorities

Finish each phase, run `npm run check`, commit, push, update `docs/PROGRESS.md`, then move on. Time boxes are guides for a 16-hour budget; scale them to the real deadline.

| Phase | Outcome | Guide |
|---|---|---|
| 0 | Repo read, scaffold in place, probe run, Gate A raised if needed | 30 min |
| 1 | Vertical slice on ten genes: S1 to S3, S5 and the ladder, condition page with ladder and evidence drawer, search. Builds cleanly. Gate B raised. | 3 h |
| 2 | Full deep slice through every pipeline stage, including LLM tasks, cross-checking, organizations, funding and investigators | 3 h |
| 3 | Borrow view, transfer rules and counter-reasons, brief with grounding check and fallback, no-supported-route state, road page, method page | 3.5 h |
| 4 | Atlas-wide shallow layer, clusters, map | 2 h |
| 5 | Design pass on the ladder and borrow view, README and docs, video scripts, demo candidates, final validation, Gate C | 2 h |

**If time runs short, cut in this order:** the atlas-wide layer and map, then bridges, then the road page, then live brief generation (keep pre-generated briefs). Never cut the ladder, the borrow view with counter-reasons, the evidence drawer, the no-supported-route state, or the validation step. Those are what the judges score.

**Definition of done.** A judge can open the production URL, search a gene, see a ladder with a community ahead, open the evidence behind any cell, see at least one "do not transfer" verdict with its reason, generate a brief whose every sentence is footnoted, and find a condition where the product states that no supported route exists. `npm run check` passes. The README lets someone reproduce the dataset.

---

## 15. Final report

When you reach Gate C, reply with: the production URL if known, what was built against each phase, what was cut and why, build manifest numbers (conditions, studies, verified quotes, discarded quotes, contested mechanisms, LLM spend), the results of the reported expectations in section 11, known weaknesses a judge might probe, and the contents of `HUMAN_TODO.md`.
