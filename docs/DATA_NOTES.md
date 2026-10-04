# Data notes

Observations for the human to review. Where fetched data contradicts an expectation in SPEC.md, the data was kept and the discrepancy is recorded here.

## Reported expectations (SPEC section 11)

<!-- generated:start (npm run data:notes, 2026-10-04) -->

| Expectation | Result | Detail |
|---|---|---|
| SCN1A has a monoallelic loss-of-function condition | true | G2P00251 SCN1A-related seizure disorders |
| At least one ion-channel gene in the slice has a condition that is not loss of function | true | KCNC1 (gain of function); KCNT1 (gain of function); KCNH1 (gain of function); KCNQ2 (gain of function); SCN8A (dominant negative); GRIN2D (gain of function); CACNA1E (gain of function); KCNA2 (gain of function); SCN1B (undetermined non-loss-of-function) |
| At least one gene has conditions or verified claims in both directions | true | SCN2A, SCN1A, KCNA2, DNM1, KCNC1, SPTAN1, GNAO1, GRIN2A, GRIN2B, KCNQ2, UBE3A, GRIN1, GABRG2, EEF1A2, SCN8A, CACNA1E |
| At least one ClinicalTrials.gov study has eligibility text that excludes a variant class | true | NCT06872125 excludes gain-of-function variants; NCT05818553 excludes loss-of-function variants; NCT06615206 excludes MECP2 gene triplication; NCT06430385 excludes terminal duplication, translocation, or MECP2 triplication; NCT06856759 excludes functional loss mutations other than MECP2; NCT07675746 excludes SCN1A gain-of-function mutations; NCT07293546 excludes FOXG1 gene duplication and FOXG1 gene deletions outside the coding region; NCT07377032 excludes variants without a clear loss-of-function effect; NCT07135050 excludes large TCF4 deletions over 12 Mbp; NCT05630066 excludes non-deletion genotypes; NCT05127226 excludes paternal uniparental disomy or imprinting defect; NCT05432349 excludes gain of function alteration of MECP2; NCT05932589 excludes MECP2 duplication |

## Observations from the build

- Deep slice: 83 conditions, 65 genes; seed genes dropped: none.
- Mechanism support is "inferred" for 81 of 83 deep conditions; only 2 rest on functional evidence in Gene2Phenotype.
- Mechanism flags after the claim-by-claim review (verified claims from at least 2 papers in another direction): 3 contested (same variant class disputed): KCNC1 G2P00467 (curated gain of function; claims loss/dominant_negative from 6 papers); EEF1A2 G2P01600 (curated gain of function; claims loss from 2 papers); SCN8A G2P01608 (curated dominant negative; claims gain/loss from 5 papers); 13 both directions reported in patients: SCN2A G2P00033, SCN1A G2P00251, KCNA2 G2P00366, SPTAN1 G2P00546, GNAO1 G2P00548, GRIN2A G2P00566, GRIN2B G2P00586, UBE3A G2P01058, KCNQ2 G2P01456, GABRG2 G2P01473, CACNA1E G2P02574, KCNA2 G2P02582, GRIN1 G2P03206.
- Claims rejected on review and kept for audit: 20 (reasons: model-system manipulation, cancer or dosage context, speculative statements, wrong gene, direction not asserted). Reviewer: automated review (Claude reading the cached abstracts); not a biomedical expert review.
- Single-paper dissent (recorded, not flagged): 6 conditions: SATB2, KCNQ2, GABRA1, ADNP, STXBP1, SMC1A.
- Several of these contests reflect genuine mixed-direction biology rather than curation error (sodium and NMDA-receptor channel genes commonly carry both loss- and gain-of-function variants); the product shows both sides and does not adjudicate.
- Gene2Phenotype curates SCN8A-related epileptic encephalopathy as dominant negative rather than gain of function, and KCNQ2-related epileptic encephalopathy as gain of function; both differ from how some of the literature describes them. The data was kept as curated, and the contested flags record the disagreement where it reached the threshold.
- Phenotype match methods: none 187, hpoa_xref 2457, g2p_record 129, gene_name 93; thin annotation (<5 terms): 312.
- Studies: 1044 retrieved, 212 classified as about a condition, 357 discarded as not about it (gene panels, broad epilepsy studies). 13 studies exclude a variant class in their eligibility text.
- Quotes: 1230 verified verbatim, 51 discarded.
- Disease-model literature returned at least one paper for every deep gene, so milestone 5 does not discriminate within this slice; the count and top PMIDs are shown so a reader can judge depth.
- Demo candidates (section 9.6): 4; top: DYRK1A -> TCF4, STX1B -> SLC6A1, PCDH19 -> SLC6A1.
- LLM spend (upper-bound price estimate): $3.56.

<!-- generated:end -->

## Study label re-check (2026-10-04)

For the demo condition DYRK1A and its displayed neighbors (TCF4, SHANK3, HNRNPH2, SATB2, DNM1), every ClinicalTrials.gov record in `studies.json` was re-fetched from the API and its labels re-read: 25 checked, 6 changed (three Phelan-McDermid growth-hormone or vorinostat trials moved from symptomatic to targeted on the record's own mechanism rationale; one case-control genotype study moved from natural history to other; one gene-therapy long-term follow-up counted as a targeted gene-therapy study; one proposed exclusion was not surfaced because no verbatim exclusion sentence was verified). Each change is recorded on the study with its reason and shown in the evidence drawer. No records are tagged to DYRK1A, HNRNPH2, SATB2 or DNM1 in this build. Open questions: whether growth hormone chosen to raise IGF-1 counts as SHANK3-targeted, AMO-01 (Ras-ERK inhibitor, record silent on mechanism) kept symptomatic, the NNZ-2591 series kept symptomatic as a multi-disease platform.

## Needs a biomedical eye (from the 2026-10-04 automated review of contested claims)

- KCNC1 p.Arg320His (G2P00467): curated gain of function, but PMIDs 25401298, 33735526 and 28145425 report this progressive-myoclonus-epilepsy variant as dominant-negative loss of function. Possibly a curation issue rather than a scientific dispute.
- SCN8A epileptic encephalopathy (G2P01608): curated dominant negative; PMID 34431999 (392 patients) and reviews 31904118 and 34353676 describe DEE variants as gain of function.
- EEF1A2 (G2P01600), PMID 32196822: haploinsufficiency argued for the same de novo missense class curated as gain of function; genuinely unsettled.
- GNAO1 G203R: PMID 40229422 calls it dominant negative, PMID 28747448 gain of function; both kept, not resolved.
- Dominant-negative claims against curated loss of function (KCNA2, GABRG2, GRIN2A, GNAO1, KCNQ2 BFNE): counted as "another direction" because Gene2Phenotype treats dominant negative as a distinct category; a curator may read DN as refining LoF rather than opposing it.
- SATB2 PMID 17377962 (dominant-negative effect only predicted), ADNP PMID 41174994 (overexpression assays), GRIN2D PMID 28212175 (precision-medicine review list): kept at low confidence.
- GABRA1 PMID 39642202: literature.json attributes the paper to GABRG2 but the cohort includes GABRA1 variants.
- Trofinetide (Daybue) is labelled as treating symptoms because its label states the mechanism is unknown; "mechanism" is arguable. Sirolimus gel (Hyftor) is labelled mechanism on the basis of mTOR inhibition although its label calls the mechanism in angiofibroma unknown.
