# Deploying Slipstream on Vercel

Production: https://slipstreamhackathon.vercel.app/ (deployed 2026-10-04 from branch `claude/eager-mayer-klnhjy`; home page and a condition page confirmed responding).

The app reads precomputed JSON from `data/derived/` that is committed to the repo. The Vercel build makes no network calls; the only runtime network call is `/api/brief`, which uses the OpenAI key for live brief generation and falls back to a deterministic template if the key or the API is unavailable.

Checked before handing over: `npm run build` passes in the sandbox with no network access at build time, and `package.json` declares `"engines": { "node": ">=20 <23" }`.

## Steps

1. In Vercel, choose **Add New**, then **Project**, and import the GitHub repository `tchitlur/slipstream_hackathon`.
2. Accept the detected **Next.js** preset. The root directory is the repository root (leave it blank).
3. Under **Environment Variables**, add these for all environments (Production, Preview, Development):
   - `OPENAI_API_KEY` = your OpenAI key
   - `OPENAI_MODEL_EXPLAIN` = `gpt-5.4`
   - `OPENAI_MODEL_EXTRACT` = `gpt-5.4-mini`
4. Click **Deploy**.
5. Production deploys follow the repository's production branch (`main`). The work is on the branch `claude/eager-mayer-klnhjy`. Open a pull request from `claude/eager-mayer-klnhjy` into `main` at https://github.com/tchitlur/slipstream_hackathon/compare/main...claude/eager-mayer-klnhjy and merge it, so the production URL updates. Alternatively, in the Vercel project settings under **Git**, set the production branch to `claude/eager-mayer-klnhjy`.
6. Paste the production URL back into the session. If the build fails, paste the build log.

Preview deployments may require a Vercel login, so give judges the **production** URL.

## Environment notes

- Environment variables are visible to anyone who can use the Vercel project or the Claude Code environment.
- No database or storage is needed. Rebuilding the dataset is `npm run data:build` (see README) and is never run by Vercel.
