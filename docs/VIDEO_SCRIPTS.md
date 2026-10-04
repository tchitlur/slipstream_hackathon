# Video scripts and shot lists (three videos, 60 seconds each)

Production site: https://slipstreamhackathon.vercel.app/
Team: Tanay Chitlur, Computer Science student at Carnegie Mellon with a previous background in AI for biomedicine and signal synthesis (solo entry).
Deadline: 2026-10-04, 06:00 EST (11:00 UTC).

Numbers in the technical script are from `data/derived/build-manifest.json` of the final build (2026-10-04). Record in a 1280-pixel-wide browser window, light theme, zoom 110%. Speak calmly; no music needed. Each shot gives the exact URL or click, the on-screen target, and the line to say. Timings total under 60 seconds per video.

Demo pair: CHD2-related epileptic encephalopathy (`/condition/G2P01420`) with SCN1A-related seizure disorders as the community ahead (`/condition/G2P01420/with/G2P00251`) and KCNA2-related epileptic encephalopathy, gain of function, as the counterexample (`/condition/G2P01420/with/G2P02582`).

---

## 1. Demo (58 s)

| Time | Open / click | Show | Say |
|---|---|---|---|
| 0:00–0:07 | https://slipstreamhackathon.vercel.app/ | Home page, cursor in the search box | "Maria leads a small patient group for a rare epilepsy with no treatment. She has three questions: who shares our disease, what already exists, and what should we do next." |
| 0:07–0:12 | Type `CHD2`, press Enter on the first condition result | Search dropdown grouped by type | "She types her child's gene." |
| 0:12–0:20 | Lands on https://slipstreamhackathon.vercel.app/condition/G2P01420 ; pause on the header and the grey "Before relying on the mechanism" notice | Road label "Too little protein: one copy is lost", curated badge | "Slipstream shows the road her condition is on: how the gene breaks. And it says up front that mechanism is recorded per gene, not per family, so her child's variant still needs a geneticist." |
| 0:20–0:31 | Scroll to "Who is ahead on this road, and who looks alike"; hover the SCN1A row (blue-ringed cells) | The ladder: focal row pinned; SCN1A row with blue "ahead" cells under 7 and 8; amber half-cells elsewhere in the table mark shared registries or pathway-level trials | "This is the readiness ladder, eight milestones from public records. Each neighbor carries two separate signals: does it break the same way, and does it look alike in patients. The SCN1A community, same road, is ahead on a gene-level trial and an approved therapy. Half cells mean a weaker form: a shared registry, or a pathway-level trial." |
| 0:31–0:37 | Click the SCN1A cell under column 7 "Targeted trial" | Evidence drawer: "Quoted from source" badge, verbatim quote, ClinicalTrials.gov link, retrieval date | "Every cell opens its evidence: the record, the date, and the exact sentence it rests on. This antisense trial excludes gain-of-function variants, which is why direction matters." Close the drawer. |
| 0:37–0:46 | Open https://slipstreamhackathon.vercel.app/condition/G2P01420/with/G2P02582 ; pause on the red-bordered "What to do this week" box under the title, then scroll to the red "R4 Therapeutic strategy" card | Box: first step in red, "Do not pursue the therapeutic strategy used for KCNA2", then one registry step and the line "Only two steps are supported"; card: "Do not transfer" with the warning line and the mechanism counter-reasons | "This neighbor, KCNA2, also overlaps in symptoms. But its curated mechanism is gain of function, the opposite direction, so the first thing to do this week is not to pursue its treatment logic, and the card says why. Registry design can still be shared. When the records support only two steps, it says two." |
| 0:46–0:54 | Open https://slipstreamhackathon.vercel.app/condition/G2P01420/with/G2P00251 ; pause on the blue "What to do this week" box (three steps: send the brief to the Dravet Syndrome Foundation, ask the geneticist which variant class, ask the SCN1A Horizons team); scroll to the amber "Eligibility that depends on the variant class" block inside the R4 card, then to the bottom brief | Box with three linked steps; R4 card showing NCT06872125 "excludes gain-of-function variants" with the highlighted verbatim quote; brief with superscript footnotes | "For the community ahead, three concrete steps, each linked to its record. The trial card quotes the eligibility line that excludes gain-of-function variants, so the geneticist's answer comes first. And one click drafts a one-page brief to send to the SCN1A community, every sentence footnoted; anything that could not be grounded was removed." |
| 0:54–0:58 | Open https://slipstreamhackathon.vercel.app/condition/G2P00033 ; show the "No supported route yet" panel | The three rows: what was searched, what is missing, next question worth testing | "And when there is no supported route, Slipstream says so, and says what to test next." |

## 2. Technical (59 s)

| Time | Open / click | Show | Say |
|---|---|---|---|
| 0:00–0:07 | https://slipstreamhackathon.vercel.app/method | Sources table | "One TypeScript codebase: a pipeline that writes JSON, and a Next.js app that reads only that JSON. No database, no network at build time." |
| 0:07–0:16 | Scroll to "Roads" | Road cards with counts | "The backbone is curated: 2,866 Gene2Phenotype records, each one gene, one disease, one mechanism. 83 conditions across 65 genes get every layer; the rest get mechanism and symptoms." |
| 0:16–0:26 | Scroll to "Four kinds of evidence" | The four badges | "Four evidence kinds never mix: curated, extracted, computed, hypothesis. Extraction uses OpenAI structured outputs, and every quote must be a verbatim substring of the cached source with stored offsets: 1,230 quotes verified, 51 discarded." |
| 0:26–0:36 | Open https://slipstreamhackathon.vercel.app/condition/G2P01608 ; show the orange "Mechanism is contested" banner, click one PMID link | Drawer with the curated record and the contradicting published claim side by side | "We cross-check curated mechanism against verified published claims, then re-read every disagreement. Three conditions are genuinely contested, thirteen have both directions documented in patients, and twenty claims were rejected on review and kept for audit." |
| 0:36–0:46 | Back to /method, scroll to "Transfer rules" | The R1 to R7 table and the verdict counts line | "The ladder is computed, not generated: 212 studies, 413 NIH projects, 51 automatically checked patient organizations and 6 shared registries confirmed from their own sites. Seven typed transfer rules produce 19,992 verdicts, each with the strongest counter-reason." |
| 0:46–0:53 | Terminal: run `npm run check` (or show a recording of it) | The line "all invariants hold" | "A validator enforces the invariants: every claim cites existing evidence, every extracted quote matches its source, every verdict has a counter-reason." |
| 0:53–0:59 | /method, scroll to "Estimated LLM spend" | The stat row | "What did not work: a price-table bug briefly tripled our spend estimate and stalled the strong-model re-checks until we rebuilt the ledger from the cache. Total pipeline spend: about $3.73, upper-bound estimate." |

## 3. Team (55 s)

| Time | Open / click | Show | Say |
|---|---|---|---|
| 0:00–0:08 | Camera | Tanay | "I'm Tanay Chitlur, a computer science student at Carnegie Mellon. Before this I worked on AI for biomedicine and signal synthesis. Slipstream is a solo entry." |
| 0:07–0:18 | https://slipstreamhackathon.vercel.app/ | Home page | "I built Slipstream for Hack-Nation's rare-disease atlas challenge because the hardest question for a small patient group is not 'what is known', it is 'who is ahead of us, and what can we safely borrow'." |
| 0:18–0:30 | https://slipstreamhackathon.vercel.app/condition/G2P01420 , the ladder | The ladder | "The idea that drives it: similar is not one thing. Symptoms decide what registries and outcome measures you can share. Mechanism direction decides what treatment logic you can share. Slipstream keeps the two apart." |
| 0:30–0:42 | https://slipstreamhackathon.vercel.app/condition/G2P01420/with/G2P02582 , the red card | Do-not-transfer card | "I spent the design effort on the ladder and on honesty: every claim has a source, every verdict has a counter-reason, and when there is no supported route the product says so." |
| 0:42–0:50 | /method, "Limitations" | Limitations list | "It has limits, and they are on the Method page: mechanism is per gene, not per variant; the ladder only sees what public sources return; organization checks are automated, not human." |
| 0:50–0:55 | Footer | The disclaimer line | "It is a research navigation aid, not medical advice. Thank you." |
