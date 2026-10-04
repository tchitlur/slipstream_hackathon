# Video scripts and shot lists (three videos, 60 seconds each)

Production site: https://slipstreamhackathon.vercel.app/
Team: Tanay Chitlur (computer science and biomedicine). `[SECOND MEMBER, one-line background: fill in or delete the line in the team script.]`
Deadline: 2026-10-04, 06:00 EST (11:00 UTC).

Numbers in the technical script are from `data/derived/build-manifest.json` of the final build (2026-10-04). Record in a 1280-pixel-wide browser window, light theme, zoom 110%. Speak calmly; no music needed. Each shot gives the exact URL or click, the on-screen target, and the line to say. Timings total under 60 seconds per video.

Demo pair: DYRK1A-related intellectual developmental disorder (`/condition/G2P01160`) with TCF4-related Pitt-Hopkins syndrome as the community ahead (`/condition/G2P01160/with/G2P00140`) and DNM1-related developmental and epileptic encephalopathy as the counterexample (`/condition/G2P01160/with/G2P00371`).

---

## 1. Demo (58 s)

| Time | Open / click | Show | Say |
|---|---|---|---|
| 0:00–0:07 | https://slipstreamhackathon.vercel.app/ | Home page, cursor in the search box | "Maria leads a small patient group for a rare neurodevelopmental disorder with no treatment. She has three questions: who shares our disease, what already exists, and what should we do next." |
| 0:07–0:12 | Type `DYRK1A`, press Enter on the first condition result | Search dropdown grouped by type | "She types her child's gene." |
| 0:12–0:20 | Lands on /condition/G2P01160; pause on the header and the grey "Before relying on the mechanism" notice | Road label "Too little protein: one copy is lost", curated badge | "Slipstream shows the road her condition is on: how the gene breaks. And it says up front that mechanism is recorded per gene, not per family, so her child's variant still needs a geneticist." |
| 0:20–0:31 | Scroll to "Who is ahead on this road, and who looks alike"; hover the TCF4 row (blue-ringed cells) | The ladder: focal row pinned, TCF4 row with blue "ahead" cells under 4 and 7 | "This is the readiness ladder, eight milestones from public records. Each neighbor carries two separate signals: does it break the same way, and does it look alike in patients. Pitt-Hopkins, same road, is ahead on a natural history study and a targeted trial." |
| 0:31–0:37 | Click the TCF4 cell under column 7 "Targeted trial" | Evidence drawer: "Quoted from source" badge, verbatim quote, ClinicalTrials.gov link, retrieval date | "Every cell opens its evidence: the record, the date, and the exact sentence it rests on." Close the drawer. |
| 0:37–0:46 | Open https://slipstreamhackathon.vercel.app/condition/G2P01160/with/G2P00371 ; scroll to the red "R4 Therapeutic strategy" card | "Do not transfer" card with the warning line and the C2 counter-reason | "This neighbor also overlaps in symptoms. But its mechanism points the opposite way, a faulty protein that interferes, so the therapeutic strategy is marked do not transfer, with the reason. Registry design can still be shared." |
| 0:46–0:54 | Open https://slipstreamhackathon.vercel.app/condition/G2P01160/with/G2P00140 ; scroll to the bottom; the brief is pre-generated and already shown | Brief with superscript footnotes and the evidence list | "One click drafts a one-page brief to send to the Pitt-Hopkins community. Every factual sentence is footnoted to an evidence record; anything that could not be grounded was removed." |
| 0:54–0:58 | Open https://slipstreamhackathon.vercel.app/condition/G2P00033 ; show the "No supported route yet" panel | The three rows: what was searched, what is missing, next question worth testing | "And when there is no supported route, Slipstream says so, and says what to test next." |

## 2. Technical (59 s)

| Time | Open / click | Show | Say |
|---|---|---|---|
| 0:00–0:07 | https://slipstreamhackathon.vercel.app/method | Sources table | "One TypeScript codebase: a pipeline that writes JSON, and a Next.js app that reads only that JSON. No database, no network at build time." |
| 0:07–0:16 | Scroll to "Roads" | Road cards with counts | "The backbone is curated: 2,866 Gene2Phenotype records, each one gene, one disease, one mechanism. 83 conditions across 65 genes get every layer; the rest get mechanism and symptoms." |
| 0:16–0:26 | Scroll to "Four kinds of evidence" | The four badges | "Four evidence kinds never mix: curated, extracted, computed, hypothesis. Extraction uses OpenAI structured outputs, and every quote must be a verbatim substring of the cached source with stored offsets: 1,230 quotes verified, 51 discarded." |
| 0:26–0:36 | Open https://slipstreamhackathon.vercel.app/condition/G2P01608 ; show the orange "Mechanism is contested" banner, click one PMID link | Drawer with the curated record and the contradicting published claim side by side | "We cross-check curated mechanism against verified published claims, then re-read every disagreement. Three conditions are genuinely contested, thirteen have both directions documented in patients, and twenty claims were rejected on review and kept for audit." |
| 0:36–0:46 | Back to /method, scroll to "Transfer rules" | The R1 to R7 table and the verdict counts line | "The ladder is computed, not generated: 212 studies, 427 NIH projects and 51 automatically checked patient organizations. Seven typed transfer rules produce 19,992 verdicts, each with the strongest counter-reason." |
| 0:46–0:53 | Terminal: run `npm run check` (or show a recording of it) | The line "all invariants hold" | "A validator enforces the invariants: every claim cites existing evidence, every extracted quote matches its source, every verdict has a counter-reason." |
| 0:53–0:59 | /method, scroll to "Estimated LLM spend" | The stat row | "What did not work: a price-table bug briefly tripled our spend estimate and stalled the strong-model re-checks until we rebuilt the ledger from the cache. Total pipeline spend: about $3.46, upper-bound estimate." |

## 3. Team (55 s)

| Time | Open / click | Show | Say |
|---|---|---|---|
| 0:00–0:07 | Camera | Tanay | "I'm Tanay Chitlur. My background is computer science and biomedicine." `[SECOND MEMBER: "I'm NAME; BACKGROUND." or delete.]` |
| 0:07–0:18 | https://slipstreamhackathon.vercel.app/ | Home page | "I built Slipstream for Hack-Nation's rare-disease atlas challenge because the hardest question for a small patient group is not 'what is known', it is 'who is ahead of us, and what can we safely borrow'." |
| 0:18–0:30 | /condition/G2P01160, the ladder | The ladder | "The idea that drives it: similar is not one thing. Symptoms decide what registries and outcome measures you can share. Mechanism direction decides what treatment logic you can share. Slipstream keeps the two apart." |
| 0:30–0:42 | /condition/G2P01160/with/G2P00371, the red card | Do-not-transfer card | "I spent the design effort on the ladder and on honesty: every claim has a source, every verdict has a counter-reason, and when there is no supported route the product says so." |
| 0:42–0:50 | /method, "Limitations" | Limitations list | "It has limits, and they are on the Method page: mechanism is per gene, not per variant; the ladder only sees what public sources return; organization checks are automated, not human." |
| 0:50–0:55 | Footer | The disclaimer line | "It is a research navigation aid, not medical advice. Thank you." |
