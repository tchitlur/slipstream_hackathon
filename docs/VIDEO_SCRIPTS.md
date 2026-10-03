# Video scripts (three videos, 60 seconds each)

Numbers were filled from `data/derived/build-manifest.json` on 2026-10-03; re-check them against the Method page before recording if the data is rebuilt. Speak calmly. No music is needed.

---

## 1. Demo (60 s)

| Time | On screen | Voice |
|---|---|---|
| 0:00 | Home page, cursor in the search box | "Maria leads a patient group for a rare epilepsy with no approved treatment. She has three questions: who shares our disease, what useful work already exists, and what should we do together next." |
| 0:08 | Type the demo gene (first entry in `demo_candidates.json`); pick the condition | "She types her child's gene." |
| 0:12 | Condition page header: road label, curated badge, the variant notice | "Slipstream shows the road her condition is on: how the gene breaks. It reminds her that mechanism is recorded per gene, not per family, and to confirm her child's variant with a geneticist." |
| 0:20 | Scroll to the ladder; hover the focal row, then a same-road neighbor with blue 'ahead' cells | "This is the readiness ladder: eight milestones from public records. Each neighbor shows two separate things: whether it breaks the same way, and whether it looks alike in patients. Here is a community on the same road that is already ahead on a registry and a targeted trial." |
| 0:32 | Click an 'ahead' cell; the evidence drawer opens with a verbatim quote and the ClinicalTrials.gov link | "Every cell opens its evidence: the record, the date, and the exact sentence it rests on." |
| 0:38 | Open the opposite-direction neighbor's borrow view; scroll to the red R4 card | "This neighbor looks just as similar in symptoms. But its mechanism points the opposite way, so the therapeutic strategy is marked do not transfer, with the reason. Registry design and outcome measures can still be shared." |
| 0:48 | Click "Draft a brief for this community"; the brief appears with footnotes | "One click drafts a one-page brief to send ahead. Every factual sentence is footnoted to an evidence record; anything that cannot be grounded is removed." |
| 0:56 | Scroll to a condition with the "No supported route yet" panel (pick one from the atlas) | "And when there is no supported route, Slipstream says so, and says what to test next." |

## 2. Technical (60 s)

| Time | On screen | Voice |
|---|---|---|
| 0:00 | Method page, sources table | "Slipstream is one TypeScript codebase: a pipeline that writes JSON, and a Next.js app that reads only that JSON. No database, no network at build time." |
| 0:07 | Method page, Roads section | "The backbone is curated: 2866 Gene2Phenotype records, each a gene, a disease, an allelic requirement and a mechanism. 83 conditions across 65 genes get every layer; the rest of the panel gets mechanism and symptoms." |
| 0:17 | Method page, 'Four kinds of evidence' | "Four evidence kinds never mix: curated, extracted, computed, hypothesis. Extraction uses OpenAI structured outputs, and every quote must be a verbatim substring of the cached source with stored offsets. 1230 quotes verified, 51 discarded." |
| 0:28 | A condition page with the contested banner, open the evidence drawer showing curated versus the published claim | "We cross-check curated mechanism against verified published claims. Where they disagree, the condition is flagged contested and both sides are shown. 18 conditions carry that flag." |
| 0:37 | The ladder; then the Method page rules table | "The ladder is computed, not generated: milestones from ClinicalTrials.gov, NIH RePORTER, PubMed and a hand-checked organization list, 212 studies and 588 grants in this build. Seven typed transfer rules produce 19992 verdicts, each with the strongest counter-reason." |
| 0:48 | Terminal: `npm run check` passing; the validate line | "A validator enforces the invariants: every claim cites existing evidence, every extracted quote matches its source, every verdict has a counter-reason." |
| 0:54 | Build manifest or ledger | "What did not work: a price-table bug briefly tripled our LLM spend estimate and stalled the strong-model re-checks until we rebuilt the ledger from the cache. Total LLM spend for the pipeline: about $3.33, upper-bound estimate." |

## 3. Team (60 s)

| Time | On screen | Voice |
|---|---|---|
| 0:00 | Tanay on camera | "I'm Tanay Chitlur. My background is computer science and biomedicine." |
| 0:06 | Home page | "I built Slipstream for Hack-Nation's rare-disease atlas challenge because the hardest question for a small patient group is not 'what is known' but 'who is ahead of us, and what can we safely borrow'." |
| 0:18 | The ladder | "The idea that drives it: similar is not one thing. Symptoms decide what registries and outcome measures you can share. Mechanism direction decides what treatment logic you can share. Slipstream keeps the two apart." |
| 0:30 | Borrow view with a do-not-transfer card | "I spent the design effort on the ladder and on being honest: every claim has a source, every verdict has a counter-reason, and when there is no supported route the product says so." |
| 0:42 | `[TEAM: add anything about how the work was split, tools used, or a thank-you]` | `[TEAM: fill in]` |
| 0:52 | Method page footer | "It is a research navigation aid, not medical advice. Thank you." |
