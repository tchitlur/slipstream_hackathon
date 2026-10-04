# Data notes

Observations for the human to review. Where fetched data contradicts an expectation in SPEC.md, the data was kept and the discrepancy is recorded here.

## Reported expectations (SPEC section 11)

<!-- generated:start (npm run data:notes, 2026-10-04) -->

| Expectation | Result | Detail |
|---|---|---|
| SCN1A has a monoallelic loss-of-function condition | true | G2P00251 SCN1A-related seizure disorders |
| At least one ion-channel gene in the slice has a condition that is not loss of function | true | KCNC1 (gain of function); KCNT1 (gain of function); KCNH1 (gain of function); KCNQ2 (gain of function); SCN8A (dominant negative); GRIN2D (gain of function); CACNA1E (gain of function); KCNA2 (gain of function); SCN1B (undetermined non-loss-of-function) |
| At least one gene has conditions or verified claims in both directions | true | SCN2A, SCN1A, KCNA2, DNM1, KCNC1, SPTAN1, GNAO1, GRIN2A, GRIN2B, KCNQ2, GRIN1, GABRG2, EEF1A2, SCN8A, CACNA1E |
| At least one ClinicalTrials.gov study has eligibility text that excludes a variant class | true | NCT06872125 excludes gain-of-function variants; NCT05818553 excludes loss-of-function variants; NCT06615206 excludes MECP2 gene triplication; NCT06430385 excludes terminal duplication, translocation, or MECP2 triplication; NCT06856759 excludes functional loss mutations other than MECP2; NCT07675746 excludes SCN1A gain-of-function mutations; NCT07293546 excludes FOXG1 gene duplication and FOXG1 gene deletions outside the coding region; NCT07377032 excludes variants without a clear loss-of-function effect; NCT07135050 excludes large TCF4 deletions over 12 Mbp; NCT05630066 excludes non-deletion genotypes; NCT05127226 excludes paternal uniparental disomy or imprinting defect; NCT05432349 excludes gain of function alteration of MECP2; NCT05932589 excludes MECP2 duplication |

## Observations from the build

- Deep slice: 83 conditions, 65 genes; seed genes dropped: none.
- Mechanism support is "inferred" for 81 of 83 deep conditions; only 2 rest on functional evidence in Gene2Phenotype.
- Mechanism flags after the claim-by-claim review (verified claims from at least 2 papers in another direction): 4 contested (same variant class disputed): KCNC1 G2P00467 (curated gain of function; claims loss/dominant_negative from 6 papers); KCNQ2 G2P01456 (curated gain of function; claims dominant_negative/loss from 2 papers); EEF1A2 G2P01600 (curated gain of function; claims loss from 3 papers); SCN8A G2P01608 (curated dominant negative; claims gain/loss from 4 papers); 9 both directions reported in patients: SCN2A G2P00033, SCN1A G2P00251, SPTAN1 G2P00546, GNAO1 G2P00548, GRIN2A G2P00566, GRIN2B G2P00586, GABRG2 G2P01473, CACNA1E G2P02574, GRIN1 G2P03206.
- Claims rejected on review and kept for audit: 31 (reasons: model-system manipulation, cancer or dosage context, speculative statements, wrong gene, direction not asserted). Reviewer: automated review (gpt-5.4), not a biomedical expert review.
- Single-paper dissent (recorded, not flagged): 9 conditions: KCNA2, KCNQ2, GABRA1, ADNP, UBE3A, STXBP1, GRIN2D, SMC1A, KCNA2.
- Several of these contests reflect genuine mixed-direction biology rather than curation error (sodium and NMDA-receptor channel genes commonly carry both loss- and gain-of-function variants); the product shows both sides and does not adjudicate.
- Gene2Phenotype curates SCN8A-related epileptic encephalopathy as dominant negative rather than gain of function, and KCNQ2-related epileptic encephalopathy as gain of function; both differ from how some of the literature describes them. The data was kept as curated, and the contested flags record the disagreement where it reached the threshold.
- Phenotype match methods: none 187, hpoa_xref 2457, g2p_record 129, gene_name 93; thin annotation (<5 terms): 312.
- Shared registries (added 2026-10-04): 6 multi-gene registries confirmed from their own sites, covering 61 deep conditions; 54 organization pages state participation; 14 registries found outside ClinicalTrials.gov. Milestone 4 "partly" = included in a shared registry only.
- Targeted trials by level: 45 act on the gene or its product (count as milestone 7), 9 act on a downstream pathway (shown as partly), 11 symptomatic or mechanism not established.
- Studies: 1044 retrieved, 212 classified as about a condition, 357 discarded as not about it (gene panels, broad epilepsy studies). 13 studies exclude a variant class in their eligibility text.
- Quotes: 1230 verified verbatim, 51 discarded.
- Disease-model literature returned at least one paper for every deep gene, so milestone 5 does not discriminate within this slice; the count and top PMIDs are shown so a reader can judge depth.
- Demo candidates (section 9.6): 4; top: CHD2 -> SCN1A, GRIN1 -> SLC13A5, HNRNPU -> SLC6A1.
- Mechanism flags: 4 contested plus 9 both directions reported plus 0 different mechanism also reported.
- LLM spend (upper-bound price estimate): $5.88.

<!-- generated:end -->

## Study label re-check (2026-10-04)

For the demo condition DYRK1A and its displayed neighbors (TCF4, SHANK3, HNRNPH2, SATB2, DNM1), every ClinicalTrials.gov record in `studies.json` was re-fetched from the API and its labels re-read: 25 checked, 6 changed (three Phelan-McDermid growth-hormone or vorinostat trials moved from symptomatic to targeted on the record's own mechanism rationale; one case-control genotype study moved from natural history to other; one gene-therapy long-term follow-up counted as a targeted gene-therapy study; one proposed exclusion was not surfaced because no verbatim exclusion sentence was verified). Each change is recorded on the study with its reason and shown in the evidence drawer. No records are tagged to DYRK1A, HNRNPH2, SATB2 or DNM1 in this build. Open questions: whether growth hormone chosen to raise IGF-1 counts as SHANK3-targeted, AMO-01 (Ras-ERK inhibitor, record silent on mechanism) kept symptomatic, the NNZ-2591 series kept symptomatic as a multi-disease platform.

## Shared registries and target levels (2026-10-04, second pass)

Milestone 4 changed for 22 of 83 deep conditions once shared multi-gene registries and registries outside ClinicalTrials.gov were included: 13 moved from not found to found (KCNA2 x2 via the Heidelberg/Leipzig registry; GRIN1 x2, GRIN2A x2, GRIN2B x2 and GRIN2D via the GRIN Variant Patient Registry; NRXN1 x2, KCNB1 and PCDH19 via organization or registry pages) and 9 from not found to partly (included in a shared registry only: ARX, DNM1 x2, HCN1, KCNC1, DYRK1A, SCN1B x2, SNAP25). Seven deep conditions still have no registry of any kind: DEPDC5, STX1B, EEF1A2, SCN3A, KCNQ3, PNPO, SPTAN1. The CoRDS entry for DNM1 rests on a partner logo and is marked weak in the seed file.

Milestone 7 changed for 7 conditions under the three-level target rule: KCNT1 x2, KCNQ2 (gain of function) and SCN8A lost "found" because their only targeted trials are record-silent small molecules now read as symptomatic or unknown; TSC1, TSC2 and PNPO moved to partly because their trials act on a pathway (mTOR inhibitors, pyridoxal phosphate). Of 65 targeted trials, 42 act on the gene or its product, 13 on a pathway, 10 are symptomatic or unknown.

Needs a biomedical eye: radiprodil (NCT05818943) is an NR2B modulator, i.e. the GRIN2B product, but the atlas maps that study to GRIN2D as well; L-serine and red-cell exchange for GLUT1 deficiency were called gene-product level and could be argued as pathway; lithium for SHANK3 is gene-product on the record's own claim of restoring SHANK3 expression; XEN496 (ezogabine) for KCNQ2 is level three only because its record is silent.

## Needs a biomedical eye (from the 2026-10-04 automated review of contested claims)

- KCNC1 p.Arg320His (G2P00467): curated gain of function, but PMIDs 25401298, 33735526 and 28145425 report this progressive-myoclonus-epilepsy variant as dominant-negative loss of function. Possibly a curation issue rather than a scientific dispute.
- SCN8A epileptic encephalopathy (G2P01608): curated dominant negative; PMID 34431999 (392 patients) and reviews 31904118 and 34353676 describe DEE variants as gain of function.
- EEF1A2 (G2P01600), PMID 32196822: haploinsufficiency argued for the same de novo missense class curated as gain of function; genuinely unsettled.
- GNAO1 G203R: PMID 40229422 calls it dominant negative, PMID 28747448 gain of function; both kept, not resolved.
- Dominant-negative claims against curated loss of function (KCNA2, GABRG2, GRIN2A, GNAO1, KCNQ2 BFNE): counted as "another direction" because Gene2Phenotype treats dominant negative as a distinct category; a curator may read DN as refining LoF rather than opposing it.
- SATB2 PMID 17377962 (dominant-negative effect only predicted), ADNP PMID 41174994 (overexpression assays), GRIN2D PMID 28212175 (precision-medicine review list): kept at low confidence.
- GABRA1 PMID 39642202: literature.json attributes the paper to GABRG2 but the cohort includes GABRA1 variants.
- Trofinetide (Daybue) is labelled as treating symptoms because its label states the mechanism is unknown; "mechanism" is arguable. Sirolimus gel (Hyftor) is labelled mechanism on the basis of mTOR inhibition although its label calls the mechanism in angiofibroma unknown.

## Final pass (2026-10-04)

- Registry evidence: the KCNA2 Heidelberg registry URL contains `kcnb1-register`, but the fetched page is titled "KCNA2 Registry: Heidelberg University Hospital" and names KCNA2; kept. Dropped as not naming the gene on the cited page: DNM1 at CoRDS (logo only), GRIN1 and GRIN2D at grin2b.com and the GRIN Portal (the Portal names them only in a publication list). GRIN2A and GRIN2B keep the GRIN Variant Patient Registry, whose page names both genes.
- Baseline mispairings caught and removed: CURE GABA-A was paired with a MEHMO natural history study and the Snap25 Foundation with a generic neonatal seizure registry because a reverse containment test let a one-word study condition ("Epilepsy") match a longer disease name; the Dravet Syndrome Foundation was paired first with a 2017 gait-treatment observational study and Pitt Hopkins with a newborn screening study because a prospective-cohort design counted as natural history. All four are gone under the title-only rule. CDKL5 (IFCR) remains paired with "Natural History of Rett Syndrome & Related Disorders" (NCT02738281), whose record names CDKL5 deficiency disorder; a reviewer may prefer a CDKL5-only study.
- Of 23 organizations with a founding year, 9 have no observational study on ClinicalTrials.gov whose record names their condition and whose title reads as a registry or natural history study; they are absent from the baseline rather than paired with a gene-only match.

## T5 and T6 replace the earlier agent review (2026-10-04, last pass)

The contested-claim review and the three-level target labels are now produced by pipeline tasks that call gpt-5.4 with structured outputs (T5 inside stage 04, T6 inside stages 05 and 09); the earlier agent-written files `data/seed/contested_review.json` and `data/seed/study_target_levels.json` are no longer displayed. Differences are written to `data/derived/contested_review_diff.json` and `data/derived/target_levels_diff.json`.

- T5 reviewed 122 dissenting claims (the earlier review covered 93). Of the 93 in common, 40 decisions flipped, every one from keep to reject, and 10 more changed only the same-variant-class dispute flag. Genes most affected: GABRG2 (6 rejections), SPTAN1 (5), SCN8A, GRIN2A and KCNC1 (4 each), GNAO1 (3), SCN2A, KCNA2, GRIN2B and UBE3A (2 each). The model rejects a claim when the abstract reports the other direction for a different variant subset or in a review without primary data; the earlier review kept such claims as "both directions documented in patients".
- Net effect on the atlas: 4 conditions are strictly contested (KCNC1, SPTAN1, SCN8A, CACNA1E) and 1 carries "both directions reported" (GRIN1 G2P03206), against 3 and 13 before; 67 claims are shown as rejected on automated review (20 before). SCN1A and KCNA2 no longer carry a mechanism flag, so the SCN1A header chip on the demo page no longer reads "both directions reported" and the KCNA2 counterexample is not flagged either.
- Needs a biomedical eye: several rejections look over-strict. PMID 38651838 (81 SCN2A patients, gain-of-function variants predominate in neonatal onset), PMID 25751627 (de novo KCNA2 variants, two with near-complete loss and others with gain of function) and PMID 34431999 (SCN8A carriers with both gain- and loss-of-function variants) were rejected although they describe mixed-direction human variants. The T5 instruction asks whether the claim asserts "a direction different from the curated one for this gene's patient variants", and the model treated mixed findings for other variant subsets as not meeting that. A reviewer may want to relax that rule; the earlier decisions remain in the seed file for comparison.
- T6 relabelled 13 of 65 targeted trials. Confident changes: FRF-001 (NCT07293546) and MZ-1866 (NCT07135050) are AAV9 gene therapies and moved to "acts on the gene or its product"; the NMDA-receptor trial NCT07224581 for GRIN gain-of-function variants moved to gene product; L-serine for GRIN hypofunction (NCT04646447) moved from gene product to pathway. Low-confidence changes (vorinostat in Rett and Pitt-Hopkins, triheptanoin, lactate infusion, PNPO) moved to "symptoms or mechanism not established" because the record does not state what the intervention acts on; the two zorevunersen records were read as low-confidence symptomatic but the modality rule keeps antisense trials at the gene-product level. Targeted trials now split 45 gene product, 9 pathway, 11 symptomatic (42/13/10 before); milestone 7 is found for 16 deep conditions (20 before).
- T6 labelled all 11 approved therapies and agreed with the earlier seed labels on every one.

## T5 rule narrowed (2026-10-04, final re-run)

The T5 instruction now keeps a claim when the abstract reports patient variants in the same gene whose functional effect is in a different direction from the curated record (patient cohorts with mixed directions; functional characterization of patient variants in cell systems or in animals carrying the patient variant; other patient-variant reports), and rejects only a different gene, a non-variant manipulation (knockout, overexpression of the normal gene, a drug), a therapy's mechanism, a cancer or chromosomal-dosage context, or no asserted direction. Claims whose direction matches a sibling curated condition of the same gene are attached there as support and the two conditions are linked as "same gene, different mechanism" instead of being flagged. Against the earlier agent review, 20 of 102 shared decisions now differ (50 of 122 under the first T5 prompt). Labels that changed in this run:

| Gene (condition) | Before this run | Now | Deciding papers (PMIDs) |
|---|---|---|---|
| SCN1A (G2P00251) | none | both directions reported | 35696452, 31904117 |
| SCN2A (G2P00033) | none | both directions reported | 31904120, 38651838 |
| SPTAN1 (G2P00546) | contested | both directions reported | 39371122, 39988451, 40023774, 31332438 |
| GNAO1 (G2P00548) | none | both directions reported | 40229422, 28747448 |
| GRIN2A (G2P00566) | none | both directions reported | 30544257, 30870728 |
| GRIN2B (G2P00586) | none | both directions reported | 40994429, 24272827 |
| KCNQ2 (G2P01456, gain of function) | none | contested | 18238816, 40998073 |
| GABRG2 (G2P01473) | none | both directions reported | 39642202, 40570274 |
| EEF1A2 (G2P01600) | none | contested | 32196822, 28911200, 38179821 |
| CACNA1E (G2P02574) | contested | both directions reported | 42123681, 42098868 |

Unchanged: KCNC1, SCN8A and GRIN1 (G2P03206) keep their flags. The five genes asked about: SCN1A both directions reported (kept 35696452, 31904117); SCN2A both directions reported on the loss-of-function condition, linked to its undetermined sibling; SCN8A contested (kept 34431999, 31904118, 34353676, 30870728; rejected 28212175, 29991598, 20530479 and one 31904118 sentence); KCNA2 no flag, its loss- and gain-of-function conditions linked as same gene, different mechanism, with one dominant-negative paper (25751627) shown as a single dissent below the two-paper threshold; KCNQ2 gain-of-function condition contested on 18238816 and 40998073, the loss-of-function sibling unflagged and linked. Totals: 4 contested, 9 both directions reported, 31 claims rejected on automated review.

`data/seed/human_review.json` is the place for a named reviewer to override one claim's keep or reject with a PMID and a reason; overrides are shown as "reviewed by a team member", never as automated. It is empty.
