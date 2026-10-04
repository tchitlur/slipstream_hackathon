# Patient organization seed check report (2026-10-04)

Automated verification pass over `patient_orgs.json` (55 entries) and `patient_orgs_gaps.md` (11 genes). Every snippet in the JSON was copied verbatim from a page retrieved on 2026-10-04. `verified` remains `false` on every entry; it is reserved for human checks.

## Counts

- Entries: 55
- Passed (check.status = auto): 51
- Failed (check.status = failed): 4
- URL replaced (replacedFrom set): 3
- Registry = yes after check: 30 (confirmed from existing yes: 27; upgraded from unknown: 3)
- Registry downgraded from yes to unknown: 4
- Founding years found: 23
- Gaps filled: 0
- Gaps remaining: 11 (SCN3A, SCN1B, KCNQ3, HCN1, STX1B, SYN1, ARX, ALDH7A1, PNPO, DEPDC5, EEF1A2)

## Per-entry status

Format: slug — check status — registry before → after — founded year (if found) — notes

- dravet-syndrome-foundation — auto — registry unknown → unknown — founded 2009 — gene/condition named on https://dravetfoundation.org/about-dsf/
- familiescn2a-foundation — auto — registry yes → yes — founded 2015
- international-scn8a-alliance — failed — registry unknown → unknown — founded: not found — HTTP 500 Internal Server Error on https://scn8aalliance.org/ (two attempts) and on https://scn8aalliance.org/about/; web search returned only scn8aalliance.org pages and social/directory profiles, no alternate domain.
- cute-syndrome-foundation — auto — registry unknown → unknown — founded: not found
- kcnq2-cure-alliance — auto — registry yes → unknown — founded: not found — registry claim not confirmed on the organization's own site; registryUrl/registryNote removed
- jack-pribaz-foundation — auto — registry unknown → unknown — founded 2011
- kcnt1-epilepsy-foundation — auto — registry yes → yes — founded 2019 — gene/condition named on https://www.kcnt1epilepsy.org/about-the-foundation/
- stxbp1-foundation — auto — registry yes → yes — founded 2017 — gene/condition named on https://www.stxbp1disorders.org/about
- cure-syngap1 — auto — registry yes → yes — founded 2018 — url replaced: https://curesyngap1.org/ → https://curesyngap1.org/mission-and-values/
- slc6a1-connect — auto — registry unknown → unknown — founded 2018 — gene/condition named on https://slc6a1connect.org/who-we-are/
- international-foundation-for-cdkl5-research — auto — registry yes → yes — founded 2009
- international-rett-syndrome-foundation — auto — registry yes → yes — founded 1983
- rett-syndrome-research-trust — auto — registry yes → yes — founded 2008
- angelman-syndrome-foundation — auto — registry yes → yes — founded 1992
- foundation-for-angelman-syndrome-therapeutics — auto — registry unknown → yes — founded: not found — registry upgraded on evidence from https://www.cureangelman.org/about-fast
- tsc-alliance — auto — registry yes → yes — founded: not found
- pitt-hopkins-research-foundation — auto — registry yes → yes — founded 2012
- phelan-mcdermid-syndrome-foundation — auto — registry yes → yes — founded 2002
- glut1-deficiency-foundation — auto — registry yes → yes — founded 2009
- kbg-foundation — auto — registry yes → yes — founded 2015 — gene/condition named on https://kbgfoundation.org/about-the-foundation
- adnp-kids-research-foundation — auto — registry yes → yes — founded 2016
- grin2b-foundation — auto — registry unknown → unknown — founded: not found — gene/condition named on https://grin2b.com/who-we-are/
- curegrin-foundation — auto — registry unknown → unknown — founded: not found — gene/condition named on https://curegrin.org/home/about-us/
- bow-foundation — auto — registry unknown → unknown — founded 2017 — url replaced: https://gnao1.org/ → https://gnao1.org/about-the-foundation/
- foxg1-research-foundation — auto — registry yes → unknown — founded: not found — registry claim not confirmed on the organization's own site; registryUrl/registryNote removed
- ddx3x-foundation — auto — registry yes → yes — founded 2015 — url replaced: https://ddx3x.org/ → https://dfr.ddx3x.org/about-dfr
- pura-syndrome-foundation — auto — registry yes → yes — founded: not found
- cacna1a-foundation — auto — registry yes → yes — founded: not found
- dyrk1a-syndrome-international-association — auto — registry unknown → unknown — founded: not found — gene/condition named on https://www.dyrk1a.org/welcome
- cask-research-foundation — auto — registry yes → yes — founded 2022
- iqsec2-research-and-advocacy-foundation — auto — registry yes → yes — founded: not found — gene/condition named on https://iqsec2.org/what-is-iqsec2/
- pcdh19-alliance — auto — registry unknown → unknown — founded: not found — gene/condition named on https://pcdh19info.org/about/
- tess-research-foundation — failed — registry unknown → unknown — founded: not found — HTTP 403 Forbidden on https://www.tessresearch.org/ (two attempts) and on https://www.tessresearch.org/unlock-the-cure/; web search returned only tessresearch.org pages and directory profiles, no alternate domain.
- coalition-to-cure-chd2 — auto — registry yes → yes — founded 2020 — gene/condition named on https://www.curechd2.org/about
- us-mef2c-foundation — auto — registry unknown → unknown — founded: not found — gene/condition named on https://www.usmef2cfoundation.org/about-us
- mef2c-family-foundation — auto — registry yes → unknown — founded: not found — gene/condition named on https://mef2c.org/who-we-are; registry claim not confirmed on the organization's own site; registryUrl/registryNote removed
- satb2-gene-foundation — auto — registry yes → yes — founded: not found
- yellow-brick-road-project — auto — registry yes → unknown — founded: not found — gene/condition named on https://yellowbrickroadproject.org/pages/our-mission; registry claim not confirmed on the organization's own site; registryUrl/registryNote removed
- hnrnp-family-foundation — auto — registry yes → yes — founded: not found — gene/condition named on https://hnrnp.org/disorders/hnrnpu
- hnrnpu-foundation — auto — registry unknown → unknown — founded: not found
- smc1a-foundation — auto — registry yes → yes — founded: not found — gene/condition named on https://smc1a-epilepsy.org/smc1a-patient-registry/
- alternating-hemiplegia-of-childhood-foundation — auto — registry yes → yes — founded 2001
- cure-ahc — auto — registry unknown → unknown — founded: not found
- wwox-foundation — auto — registry yes → yes — founded: not found
- hope-for-sptan1 — auto — registry unknown → unknown — founded: not found
- kcnb1-org — auto — registry unknown → unknown — founded: not found
- kcna2-epilepsy-global-connection — failed — registry unknown → unknown — founded: not found — https://www.kcna2epilepsy.org/ returned empty page content on two attempts, and https://www.kcna2epilepsy.org/about/ (from web search) also returned empty content; no alternate domain found.
- kcnc1-foundation — auto — registry unknown → unknown — founded: not found
- cure-kcnh1-foundation — auto — registry unknown → yes — founded: not found — registry upgraded on evidence from https://www.curekcnh1.org/research
- cacna1e-international — auto — registry yes → yes — founded: not found
- cure-gaba-a — auto — registry unknown → yes — founded 2023 — registry upgraded on evidence from https://curegabaa.org/about-us/
- rare-dynamos-dnm1-epilepsy — failed — registry unknown → unknown — founded: not found — https://dnm1epilepsy.org/ returned no readable text on two attempts (page body is encoded image data), and https://dnm1epilepsy.org/donate (from web search) likewise; no alternate domain found.
- snap25-foundation — auto — registry unknown → unknown — founded 2020
- prrt2-foundation — auto — registry yes → yes — founded: not found — gene/condition named on https://www.prrt2.org/about-the-foundation/about.md
- nrxn1-network — auto — registry unknown → unknown — founded: not found — gene/condition named on https://www.nrxn1network.org/our-mission

## Registry downgrades (reasons)

- kcnq2-cure-alliance: kcnq2cure.org/kcnq2-epilepsy/registries describes 'Citizen Health is a KCNQ2 digital natural history study...' and a KCNQ2 Portal observational study, but no sentence on that page, the homepage or /our-role/ states that KCNQ2 Cure Alliance runs, hosts or funds a registry or NHS.
- foxg1-research-foundation: Homepage, /research, /our-story, /about and /parents-and-caregivers only urge families to 'register your FOXG1 Child in the official FOXG1 syndrome patient registry' (hosted at foxg1.beneufit.com); no page states the Foundation runs or funds it or an NHS.
- mef2c-family-foundation: Homepage and /who-we-are only link 'Patient Registry' to citizen.health; no sentence states the Foundation runs or supports a registry or NHS.
- yellow-brick-road-project: /pages/hnrnph2-natural-history-study says 'Dr. Bain and her team are actively recruiting HNRNPH2 patients for the crucial Natural History Study' without stating YBRP funds, sponsors or runs it; /pages/our-mission has no registry statement.

## Registry upgrades

- foundation-for-angelman-syndrome-therapeutics: https://www.cureangelman.org/about-fast — "Create the necessary infrastructure outside of drugs and their development, from projects like our global registry and newborn screening"
- cure-kcnh1-foundation: https://www.curekcnh1.org/research — "We recently launched the first-ever international KCNH1 patient registry, and within the first three months had enrolled more than half of all known patient families."
- cure-gaba-a: https://curegabaa.org/about-us/ — "Our non-profit organization, Cure GABA-A Variants, has been focusing on groundbreaking research and the organization of a digital Natural History Study for the various GABA-A Variants."

## Gap searches (2026-10-04, one WebSearch per gene)

Query pattern: `<GENE> patient foundation OR alliance OR family organization official site`. No result on a gene-specific organization's own domain for any of the 11 genes; see `patient_orgs_gaps.md` for per-gene notes. The only candidate fetched was kcnq2cure.org (for KCNQ3), whose homepage names KCNQ3 only in a linked book title.

## Method notes

- Fetch failures were retried once (two attempts on the seed URL), then one WebSearch `<organization name> official site` was run; a search result on the organization's own domain that loaded and named the gene replaced the url (3 cases). For DDX3X Foundation the retrieved page is the foundation's registry subdomain (dfr.ddx3x.org), which was not itself in the search results but is on the organization's own domain; flagged for human review.
- Snippets that would have carried a person's name were trimmed to a verbatim substring without the name (e.g. KCNT1 'The Foundation was launched in 2019'); no email addresses or people's names were recorded.
- Founding years were taken only from explicit statements on the organization's own pages; copyright lines, 'since 20xx' impact lines and 'for ten years' phrasing were not used.
- `registry` was never set to 'no'; no site stated that it has no registry.
