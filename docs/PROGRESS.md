# Progress

Session start: 2026-10-03 19:13 UTC. Deadline: 2026-10-04 06:00 EST (10:00 UTC).

| Phase | Status | Notes |
|---|---|---|
| 0 | done | Scaffold, probe (all hosts reachable, key present, Gate A not needed) |
| 1 | done | Ten-gene slice end to end; condition page with ladder and evidence drawer; search; Gate B instructions given to the human (Vercel import pending) |
| 2 | done | Full 65-gene deep slice through every stage: T1 with cross-check and contested flags, T2, T3, organizations (55 drafted, unverified), RePORTER funding, investigators and bridges |
| 3 | done (code) | Borrow view with rule cards and counter-reasons, brief with grounding check and template fallback, no-supported-route state, road page, method page. Pre-generated briefs run in phase 5 after demo candidates settle. |
| 4 | done | Atlas-wide shallow layer: 2,866 conditions, 351 Louvain clusters, force layout, map; similarity and transfers split per condition |
| 5 | done | Screenshot-driven design pass, README, docs, video scripts with manifest numbers, 3 pre-generated briefs (LLM, grounding-checked), live brief route verified, `npm run check` green, Gate C report delivered |

## How to resume
- `npm install`, then `npm run data:build -- --all` rebuilds everything from caches (no LLM cost; all calls are cached in `data/llm/cache.jsonl`).
- `npm run check` must pass before pushing.
- Open problems and decisions are in `docs/DECISIONS.md`; data oddities in `docs/DATA_NOTES.md`.

## Delegated review pass (2026-10-04)
- Automated organization check (51 passed, 4 failed and hidden, 3 URLs replaced), contested-claim review (3 contested, 13 both directions, 20 rejected), grant relevance tightened (413 kept), 11 FDA-labelled therapies with target class, baseline from data (15 pairs, median 6.8 years), demo re-ranked to DYRK1A with TCF4, 25 trial labels re-checked (6 changed), shot lists written.

## Second review pass (2026-10-04)
- Shared-registry layer (6 registries, 74 gene links, 54 organization-page links, 26 external registries), three-state milestones 4 and 7, three-level target labels for 65 trials and 11 therapies, "different mechanism also reported" flag, demo re-selected to CHD2 with SCN1A (counterexample KCNA2 gain of function), briefs regenerated, shot lists rewritten.

## Final pass before recording (2026-10-04)
- Registry evidence re-check (3 web-search entries dropped, KCNA2 kept with note), C2/C3/C4 restricted to R4 to R7 with new C9 on R1/R2, inline exclusion evidence on R4/R7 cards, "What to do this week" box on every borrow page, expert-question wording, baseline by condition name with disease-name search (14 pairs, median 6.7 years), Method page text, investigator merge/title/fellowship rules, shot lists refreshed.

## Last fixes before recording (2026-10-04)
- Brief voice (letter between parent groups, no tool internals, three footnote markers per sentence with "+n"), T5 contested-claim review and T6 target levels as cached OpenAI pipeline tasks on gpt-5.4 replacing the agent-written seed files, investigator chip "linked to this gene" vs "works on this condition", three-decimal similarity values, PubMed entity decoding, shared registry named in the Community block.

## Next (for the human)
- See `HUMAN_TODO.md`: Vercel deploy and production URL, verify patient organizations, review `docs/DATA_NOTES.md`, confirm the demo condition, supply the sourced 10x baseline, record the videos.

## Open problems
- Vercel deploy is in the human's hands (Gate B). README still has a placeholder for the production URL.
- `data/seed/patient_orgs.json` is entirely unverified; see HUMAN_TODO.md.
