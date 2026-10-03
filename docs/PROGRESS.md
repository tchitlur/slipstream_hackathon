# Progress

Session start: 2026-10-03 19:13 UTC. Deadline: 2026-10-04 06:00 EST (10:00 UTC).

| Phase | Status | Notes |
|---|---|---|
| 0 | done | Scaffold, probe (all hosts reachable, key present, Gate A not needed) |
| 1 | done | Ten-gene slice end to end; condition page with ladder and evidence drawer; search; Gate B instructions given to the human (Vercel import pending) |
| 2 | done | Full 65-gene deep slice through every stage: T1 with cross-check and contested flags, T2, T3, organizations (55 drafted, unverified), RePORTER funding, investigators and bridges |
| 3 | done (code) | Borrow view with rule cards and counter-reasons, brief with grounding check and template fallback, no-supported-route state, road page, method page. Pre-generated briefs run in phase 5 after demo candidates settle. |
| 4 | in progress | Atlas-wide shallow layer (`--all`), clusters, map |
| 5 | pending | Design pass, README/docs, video scripts (drafted), demo candidates, final validation, Gate C |

## How to resume
- `npm install`, then `npm run data:build -- --all` rebuilds everything from caches (no LLM cost; all calls are cached in `data/llm/cache.jsonl`).
- `npm run check` must pass before pushing.
- Open problems and decisions are in `docs/DECISIONS.md`; data oddities in `docs/DATA_NOTES.md`.

## Next
- Finish phase 4 run; rebuild the app; screenshot review; pre-generate briefs (T4) for the top 5 demo candidates; fill video-script numbers from the manifest; final `npm run check`; Gate C report.

## Open problems
- Vercel deploy is in the human's hands (Gate B). README still has a placeholder for the production URL.
- `data/seed/patient_orgs.json` is entirely unverified; see HUMAN_TODO.md.
