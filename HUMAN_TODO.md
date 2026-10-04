# Human to-do before submission

Estimated total: about 3 to 4 hours, most of it the videos and the organization check. Items are in priority order.

Status 2026-10-04: item 1 is done (https://slipstreamhackathon.vercel.app/). Items 2 to 6 were run as automated checks at the human's request and are labelled as such in the product; what remains for a human is listed under "Needs a biomedical eye" in the final report and in `docs/DATA_NOTES.md`. Item 7 (recording) remains.

## 1. Deploy (15 min)
- [x] Follow `docs/DEPLOY.md`: import the repo in Vercel, set `OPENAI_API_KEY`, `OPENAI_MODEL_EXPLAIN=gpt-5.4`, `OPENAI_MODEL_EXTRACT=gpt-5.4-mini`, deploy, and point production at this branch (or merge the PR into `main`).
- [ ] Paste the production URL into `README.md` (line "Production URL") and open `/`, one condition page and `/method` to confirm they respond.

## 2. Verify patient organizations (60 to 90 min, 55 entries)
Automated pass done 2026-10-04: 51 passed an automated check of their own site (`check.status: "auto"`), 4 failed and are hidden, 3 URLs replaced, 30 registry claims confirmed from a page on the site, 4 downgraded to unknown; see `data/seed/patient_orgs_check_report.md`. A human check would flip `verified` to true. For each one:
- [ ] Open `url`. Confirm it is the organization's own site and that it serves families with disorders of the listed gene(s).
- [ ] If `registry` is `yes`, open `registryUrl` and confirm the page states a registry or natural history study. If it only points to a registry run by someone else, change `registry` to `unknown` and adjust `registryNote`.
- [ ] Flip `verified` to `true`, or delete the entry if it is wrong.
- [ ] Weakest entries flagged by the drafting pass (fetch failed, confirmed from search results only): International SCN8A Alliance, CureGRIN, Bow Foundation, KCNA2 Epilepsy Global Connection, TESS Research Foundation, DDX3X Foundation. Check these first.
- [ ] Gaps with no confirmed organization are listed in `data/seed/patient_orgs_gaps.md` (SCN3A, SCN1B, KCNQ3, HCN1, STX1B, SYN1, ARX, ALDH7A1, PNPO, DEPDC5, EEF1A2). Add any you know, with the URL you actually opened.
- [ ] Then re-run `npm run data:orgs && npm run data:analytics && npm run data:briefs -- --search-only && npm run data:validate`, commit and push. (Briefs do not need regeneration; the brief footnotes point at the same evidence ids.)

## 3. Review `docs/DATA_NOTES.md` (20 min)
- [ ] Read the reported expectations and the observations. In particular: the contested-mechanism flags (a verified published sentence disagrees with the Gene2Phenotype mechanism). Decide whether any should be mentioned in the technical video as a feature (they are data-driven) or need a caveat.
- [ ] Spot-check five T2 study classifications on the condition pages by opening the evidence drawer and reading the quote against the role label.

## 4. Confirm or change the demo condition (10 min)
- [ ] Open `data/derived/demo_candidates.json`. The first entry is the default demo and the home page examples come from the top three. If you prefer another focal condition, reorder the file (or set the condition you want first) and re-run `npm run data:briefs` so a brief is pre-generated for it.

## 5. Supply the sourced 10x baseline (15 min)
- [ ] Find a citable figure for how long a small patient group typically needs to reach a funded natural history study (for example a published review or a foundation's own timeline). Put the number, the source title and the URL into `src/app/method/page.tsx` in the "The 10x case" section, replacing the "Baseline timeline: to be supplied with a source" line. Only then does a multiplier belong on the page.

## 6. Approved therapies (optional, 10 min)
- [ ] `data/seed/approved_therapies.json` is empty. If you add entries, each needs `condition` (gene symbol or condition id), `therapy`, `regulator`, a regulator or label `url`, and `verified: false` until you have opened the URL. Re-run `npm run data:analytics`.

## 7. Team placeholders and videos (90 min)
- [ ] `docs/VIDEO_SCRIPTS.md`: fill the team script and record the three 60-second videos (demo, technical, team). The demo script follows the path: search a gene, the ladder shows a community ahead, a "do not transfer" card shows the counterexample, the brief is generated.
- [ ] Check the numbers quoted in the technical script against `data/derived/build-manifest.json` (they were copied from the final build).

## 8. Final check (10 min)
- [ ] `npm run check` passes locally.
- [ ] Submission form: production URL, repository URL, the three videos.
