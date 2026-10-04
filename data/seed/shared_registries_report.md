# Shared (multi-gene) registries report

Date: 2026-10-04. Slice: `data/seed/genes.txt` (65 genes). Output: `data/seed/shared_registries.json`.

Method: every page was downloaded with curl (raw HTML, scripts/styles stripped, whitespace collapsed) and
each gene snippet in the JSON was asserted to be a literal substring of that page text. Gene matches used a
whole-token regex, so e.g. `SCN1A` does not match `SCN10A` and `DYRK1` does not match `DYRK1A`.
Snippets are verbatim apart from whitespace normalisation (newlines/tabs collapsed to single spaces).
No OpenAI calls were used.

## Included registries

### 1. Simons Searchlight (simonssearchlight.org) - 24 genes from the slice
- Gene list page: https://www.simonssearchlight.org/research/what-we-study/ ("Genetic Disorders We Study",
  an A-C / D-F / ... / V-Z index on a single page, plus a CNV list). The page also offers a downloadable
  gene list; the on-page list was sufficient.
- Description (homepage): "Simons Searchlight is building an ever growing natural history database,
  biorepository, and resource network."
- Genes found: SCN1A, SCN2A, SCN1B, KCNB1, GRIN1, GRIN2A, GRIN2B, GRIN2D, STXBP1, SYNGAP1, SLC6A1, SNAP25,
  IQSEC2, CASK, NRXN1, CHD2, MEF2C, DYRK1A, HNRNPU, HNRNPH2, ARX, ADNP, ANKRD11, DDX3X.
- Not on the Simons list (41 slice genes), notably: SCN3A, SCN8A, KCNQ2/3, KCNT1, KCNA2, KCNC1, KCNH1, HCN1,
  CACNA1A/E, GABRA1/B2/B3/G2, DNM1, STX1B, SYN1, PRRT2, SHANK3, MECP2, CDKL5, FOXG1, TCF4, UBE3A, SATB2, PURA,
  SMC1A, SLC2A1, SLC13A5, ALDH7A1, PNPO, PCDH19, DEPDC5, TSC1/2, WWOX, EEF1A2, GNAO1, ATP1A3, SPTAN1.
  (Simons lists only genes, no condition names, so no condition mapping was needed.)

### 2. RARE-X Data Collection Program (rare-x.org, Global Genes) - 6 genes
- Page: https://rare-x.org/participating-rare-communities/ ("Rare Disease Communities Currently Collaborating
  with RARE-X"). Found in the list: CACNA1A, "CASK Gene Mutations" (CASK), CHD2, STXBP1, SYNGAP1.
- DYRK1A: the communities list spells it "DYRK1"; the linked community page https://rare-x.org/dyrk1a/ names
  "DYRK1A - Data Collection Program" verbatim, so DYRK1A is recorded with that page URL and a note.
- Description (homepage, https://rare-x.org/): "RARE-X, a research program of Global Genes, provides a
  collaborative platform for global data sharing and analysis to accelerate treatments for rare disease."
- Not mapped: "AHC (Alternating Hemiplegia of Childhood)" - the AHC community page (https://rare-x.org/ahc/)
  does not name ATP1A3. "Lennox-Gastaut syndrome (LGS)" is not gene-specific.
- Dead links on the site: https://rare-x.org/?page_id=5659 and https://rare-x.org/rare-disease-communities/
  both return 404.

### 3. Citizen Health (formerly Ciitizen; ciitizen.com 301-redirects to citizen.health) - 19 genes
- Page: https://www.citizen.health/communities ("Our advocacy partners ... focus on 100+ rare diseases and
  conditions including..."). Found verbatim: SCN2A, SCN8A, "KCNT1 Epilepsy" (KCNT1), KCNH1, CACNA1A, GABRA1,
  STXBP1, SLC6A1, "DNM1-related epilepsy" (DNM1), CASK, CHD2, MEF2C, HNRNPH2, "PURA syndrome" (PURA), SMC1A,
  SLC13A5, WWOX.
- Condition-to-gene mappings (allowed because the site names the gene):
  - "Rett syndrome" -> MECP2: https://www.citizen.health/caregiver-guide/rett-syndrome-newly-diagnosed
    says "It is caused by a change (variant) in the MECP2 gene on the X chromosome." The same page says
    "Citizen Health runs a natural history study for families affected by Rett syndrome."
  - "Pitt Hopkins syndrome (PTHS)" -> TCF4: https://www.citizen.health/caregiver-guide/pitt-hopkins-syndrome-newly-diagnosed
    says "...caused by a change (variant) in the TCF4 gene".
  - "Angelman syndrome" is listed, but no fetched citizen.health page names UBE3A, so it is NOT mapped.
- Description: "Citizen Health collects, organizes and harmonizes clinical data from patient medical records to
  deliver a cost-effective natural history dataset without burdening patients with clinic visits."

### 4. CoRDS - Coordination of Rare Diseases at Sanford (research.sanfordhealth.org) - 20 genes
- Page: https://research.sanfordhealth.org/rare-disease-registry/represented-diseases. Caveat (verbatim from
  the page): "The conditions listed below represent diagnoses that have been reported by participants in the
  CoRDS registry." CoRDS "is a general rare disease registry" accepting any rare disease, so this is a list of
  represented diagnoses, not an eligibility list.
- Found verbatim: SCN2A, "KCNB1 gene", KCNC1, "HCN1 Disorder", "CACNA1A gene mutation", GRIN2A (in
  "Early-onset epileptic encephalopathy and intellectual disability due to GRIN2A mutation"),
  "STXBP1-related encephalopathy", DNM1 / "DNM1 Gene Mutation", "NRXN1-related severe neurodevelopmental
  disorder...", "MECP2 duplication syndrome", "CDKL5-related epileptic encephalopathy", "FOXG1 syndrome",
  "DYRK1A syndrome", "ADNP syndrome", ANKRD11, "PURA syndrome", "SMC1A DEE", "PCDH19-Related Epilepsy",
  "WWOX developmental and epileptic encephalopathy (WWOX-DEE)", "ATP1A3 related disorders".
- Condition names on the page that were NOT mapped because the gene symbol does not appear on the page:
  Dravet syndrome (SCN1A), Angelman syndrome (UBE3A), Pitt-Hopkins syndrome (TCF4), Phelan-McDermid syndrome
  (SHANK3), Tuberous sclerosis complex (TSC1/TSC2). "Rett syndrome" is also listed; MECP2 is recorded via the
  "MECP2 duplication syndrome" entry rather than by mapping.

### 5. ENDD Natural History Studies (endd.med.upenn.edu, Penn Medicine / CHOP) - 2 genes
- Page: https://endd.med.upenn.edu/research/natural-history-study/. Verbatim: "Dr. Ingo Helbig of CHOP leads
  the NHS for both STXBP1 and SYNGAP1." Only these two genes are named. The STXBP1 NHS is "also known as the
  STARR study".

### 6. RDCRN Rett Syndrome, MECP2 Duplications, and Rett-related Disorders Consortium (RTT) - 3 genes
- Page: https://www.rarediseasesnetwork.org/research-groups. Verbatim: "Rett Syndrome, MECP2 Duplications, and
  Rett-related Disorders Consortium (RTT) Diseases Researched CDKL5 mutation FOXG1 mutation MECP2 Duplications
  MECP2 mutations not associated with Rett syndrome (non-RTT MECP2 mutations) Rett Syndrome - Typical/Classic".
  Genes: MECP2, CDKL5, FOXG1.
- The natural-history study page https://www1.rarediseasesnetwork.org/cms/rett/Get-Involved/Studies/5211 (from
  search results) now redirects to the generic https://www.rarediseasesnetwork.org/research-studies list, which
  does not name genes. ClinicalTrials.gov (NCT02738281) was not used because it is not the registry's own site.
- The same page also lists the older "Angelman, Rett, & Prader-Willi Syndromes Consortium (ARPWSC)" with
  "Angelman syndrome"; UBE3A is not named on the page, so not mapped.

## Checked but NOT included

- Epilepsy Genetics Initiative (CURE Epilepsy): https://www.cureepilepsy.org/our-research/epilepsy-genetics-initiative/
  describes a 2015-2020 exome re-analysis database for people WITHOUT a genetic diagnosis; it publishes no
  eligible-gene list. The only slice gene in the fetched page text is SLC13A5, inside an unrelated news teaser
  ("Comprehensive Study Maps Genetic Mutations in SLC13A5 Linked to Epilepsy"). A WebFetch summary claimed the
  page lists re-analysis result genes (ATP1A3, SCN8A, GRIN2B, HNRNPU, SNAP25, SMC1A, EEF1A2...), but none of
  these strings exist in the raw page text, so that summary was discarded as unverifiable.
- DEE-P Connections / Decoding Developmental Epilepsies: deepconnections.net 301-redirects to dee-p.org, which
  served only a captcha/bot-check page (meta refresh to /.well-known/sgcaptcha/) on two attempts; no content
  retrievable. ddecoding.org was not fetched (one fetch budget per candidate).
- RARE-X homepage, Clinical Research Program page, and RARE-X AHC page: fetched; see notes above.
- Simons Searchlight homepage: no gene symbols, used only for the description.

## Files fetched (raw HTML saved to scratchpad during the run)
simonssearchlight.org (home, /research/what-we-study/); rare-x.org (home, /participating-rare-communities/,
/clinicalresearchprogram/, /ahc/, /dyrk1a/, /?page_id=5659 [404], /rare-disease-communities/ [404]);
citizen.health (home, /communities, Rett and Pitt-Hopkins caregiver guides, /ai-advocate/angelman-foundation);
research.sanfordhealth.org (/rare-disease-registry, /rare-disease-registry/represented-diseases);
endd.med.upenn.edu (/research/natural-history-study/); rarediseasesnetwork.org (/research-groups,
/research-studies); cureepilepsy.org (EGI page); dee-p.org (captcha).
