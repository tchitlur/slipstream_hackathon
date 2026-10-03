# Data notes

Observations for the human to review. Where fetched data contradicts an expectation in SPEC.md, the data was kept and the discrepancy is recorded here.

## Reported expectations (SPEC section 11)

<!-- generated:start (npm run data:notes, 2026-10-03) -->

| Expectation | Result | Detail |
|---|---|---|
| SCN1A has a monoallelic loss-of-function condition | true | G2P00251 SCN1A-related seizure disorders |
| At least one ion-channel gene in the slice has a condition that is not loss of function | true | KCNC1 (gain of function); KCNT1 (gain of function); KCNH1 (gain of function); KCNQ2 (gain of function); SCN8A (dominant negative); GRIN2D (gain of function); CACNA1E (gain of function); KCNA2 (gain of function); SCN1B (undetermined non-loss-of-function) |
| At least one gene has conditions or verified claims in both directions | true | SCN2A, SCN1A, WWOX, KCNA2, DNM1, KCNC1, SPTAN1, GNAO1, GRIN2A, GRIN2B, KCNQ2, UBE3A, GRIN1, DYRK1A, GABRG2, EEF1A2, SCN8A, CACNA1E |
| At least one ClinicalTrials.gov study has eligibility text that excludes a variant class | true | NCT06872125 excludes gain-of-function variants; NCT05818553 excludes loss-of-function variants; NCT06615206 excludes MECP2 gene triplication; NCT06430385 excludes terminal duplication, translocation, or MECP2 triplication; NCT06856759 excludes functional loss mutations other than MECP2; NCT07675746 excludes SCN1A gain-of-function mutations; NCT07293546 excludes FOXG1 gene duplication and FOXG1 gene deletions outside the coding region; NCT07377032 excludes variants without a clear loss-of-function effect; NCT07135050 excludes large TCF4 deletions over 12 Mbp; NCT05630066 excludes non-deletion genotypes; NCT05127226 excludes paternal uniparental disomy or imprinting defect; NCT05432349 excludes gain of function alteration of MECP2; NCT05932589 excludes MECP2 duplication |

## Observations from the build

- Deep slice: 83 conditions, 65 genes; seed genes dropped: none.
- Mechanism support is "inferred" for 81 of 83 deep conditions; only 2 rest on functional evidence in Gene2Phenotype.
- Contested mechanisms (verified claims from at least 2 papers disagree with the curated direction): 18: SCN2A G2P00033 (curated loss of function; claims gain from 3 papers); SCN1A G2P00251 (curated loss of function; claims gain from 2 papers); KCNA2 G2P00366 (curated loss of function; claims dominant_negative from 2 papers); KCNC1 G2P00467 (curated gain of function; claims loss/dominant_negative from 6 papers); SPTAN1 G2P00546 (curated dominant negative; claims loss from 5 papers); GNAO1 G2P00548 (curated loss of function; claims gain/dominant_negative from 6 papers); GRIN2A G2P00566 (curated loss of function; claims gain/dominant_negative from 4 papers); GRIN2B G2P00586 (curated loss of function; claims gain from 2 papers); WWOX G2P00594 (curated loss of function; claims gain/dominant_negative from 2 papers); UBE3A G2P01058 (curated loss of function; claims gain from 2 papers); DYRK1A G2P01160 (curated loss of function; claims gain from 3 papers); KCNQ2 G2P01456 (curated gain of function; claims dominant_negative/loss from 2 papers); GABRG2 G2P01473 (curated loss of function; claims gain/dominant_negative from 5 papers); EEF1A2 G2P01600 (curated gain of function; claims loss from 4 papers); SCN8A G2P01608 (curated dominant negative; claims gain/loss from 7 papers); CACNA1E G2P02574 (curated gain of function; claims loss from 2 papers); KCNA2 G2P02582 (curated gain of function; claims dominant_negative from 2 papers); GRIN1 G2P03206 (curated loss of function; claims gain from 3 papers).
- Single-paper dissent (recorded, not flagged): 11 conditions: SATB2, NRXN1, KCNQ2, GABRA1, FOXG1, ADNP, KCNH1, STXBP1, GRIN2D, SMC1A, PNPO.
- Several of these contests reflect genuine mixed-direction biology rather than curation error (sodium and NMDA-receptor channel genes commonly carry both loss- and gain-of-function variants); the product shows both sides and does not adjudicate.
- Gene2Phenotype curates SCN8A-related epileptic encephalopathy as dominant negative rather than gain of function, and KCNQ2-related epileptic encephalopathy as gain of function; both differ from how some of the literature describes them. The data was kept as curated, and the contested flags record the disagreement where it reached the threshold.
- Phenotype match methods: none 187, hpoa_xref 2457, g2p_record 129, gene_name 93; thin annotation (<5 terms): 312.
- Studies: 1044 retrieved, 212 classified as about a condition, 357 discarded as not about it (gene panels, broad epilepsy studies). 13 studies exclude a variant class in their eligibility text.
- Quotes: 1646 verified verbatim, 72 discarded.
- Disease-model literature returned at least one paper for every deep gene, so milestone 5 does not discriminate within this slice; the count and top PMIDs are shown so a reader can judge depth.
- Demo candidates (section 9.6): 3; top: STX1B -> SLC6A1, PCDH19 -> SLC6A1, IQSEC2 -> SLC6A1.
- LLM spend (upper-bound price estimate): $3.07.

<!-- generated:end -->

## Observations
