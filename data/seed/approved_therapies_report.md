# Approved disease-specific therapies: search report

Date: 2026-10-04. Scope: the 65 genes in `data/seed/genes.txt` and their 83 `depth: "deep"` conditions in `data/derived/atlas.json`.

Accepted sources: FDA prescribing information (accessdata.fda.gov), DailyMed (dailymed.nlm.nih.gov), FDA approval notices (fda.gov). EMA was not needed because every qualifying therapy had an FDA/DailyMed page. An entry qualifies only if the regulator's indication text names the condition explicitly.

Result: **11 entries** in `approved_therapies.json`, covering 7 distinct products and 5 genes (SCN1A, MECP2, CDKL5, TSC1, TSC2). All other genes: nothing found.

## Method

1. For the hinted conditions (Dravet/SCN1A, Rett/MECP2, CDD/CDKL5, TSC/TSC1+TSC2) I searched DailyMed/accessdata/fda.gov for each candidate product, then fetched the DailyMed label page and copied section 1 INDICATIONS AND USAGE verbatim.
2. For every other condition I ran one web search of the form `<condition name> FDA label indication` (using the atlas condition name or its OMIM/common synonym). None surfaced a regulator page whose indication names the condition.
3. `approvalYear` is populated only where the retrieved page states an "Initial U.S. Approval" year that is also the year of the condition-specific indication (Epidiolex/Dravet 2018, Diacomit 2018, Daybue 2023, Ztalmy 2022). Where the page's "Initial U.S. Approval" is the molecule's first approval for something else (Fintepla 1973, Afinitor 2009, Hyftor 1999) or predates the indication (Epidiolex/TSC, added 2020), the year is omitted.

## Qualifying therapies (pages retrieved)

| Gene | Condition as labelled | Therapy | Page retrieved | Note |
|---|---|---|---|---|
| SCN1A | Dravet syndrome (DS) | cannabidiol (Epidiolex) | DailyMed setid 8bf27097-4870-43fb-94f0-f3d0871d1eec | Initial U.S. Approval 2018; FDA press release (June 25, 2018) also confirmed the Dravet approval via search; TSC indication added 2020 (search result, not on page). |
| SCN1A | Dravet syndrome (DS) | fenfluramine (Fintepla) | DailyMed setid e88f360e-33ad-4cd6-b2de-5ef885857c5d | Page says Initial U.S. Approval 1973 (fenfluramine as anorectic); Dravet approval was June 25, 2020 per FDA review documents found in search, so `approvalYear` omitted. |
| SCN1A | Dravet syndrome (DS) | stiripentol (Diacomit) | DailyMed setid 58304ba8-9779-4658-811e-94ffe08c3f16 | Initial U.S. Approval 2018. Indication restricted to patients taking clobazam. |
| MECP2 | Rett syndrome | trofinetide (Daybue) | DailyMed setid 67e6f2d9-21f6-466f-9def-826c6a4b8257 | Initial U.S. Approval 2023. Also retrieved fda.gov notice "FDA approves first treatment for Rett Syndrome" (03/13/2023): "Daybue is approved for the treatment of Rett syndrome in adults and children 2 years of age and older." |
| CDKL5 | cyclin-dependent kinase-like 5 (CDKL5) deficiency disorder (CDD) | ganaxolone (Ztalmy) | DailyMed setid d91612c4-b03a-4be4-a1ee-6a13e3b83d4e | Initial U.S. Approval 2022. Also retrieved fda.gov notice (03/18/2022): "FDA has approved Ztalmy (ganaxolone) to treat seizures associated with cyclin-dependent kinase-like 5 (CDKL5) deficiency disorder (CDD) in patients 2 years of age and older." |
| TSC1, TSC2 | TSC / tuberous sclerosis complex (TSC) | everolimus (Afinitor / Afinitor Disperz) | DailyMed setid 2150f73a-179b-4afc-b8ce-67c85cc72f04 | Three TSC indications on the label: 1.4 renal angiomyolipoma ("adult patients with renal angiomyolipoma and TSC, not requiring immediate surgery"), 1.5 SEGA, 1.6 TSC-associated partial-onset seizures. The 400-char quote holds 1.5 and 1.6; 1.4 is recorded here. |
| TSC1, TSC2 | tuberous sclerosis complex (TSC) | cannabidiol (Epidiolex) | same Epidiolex page | Same indication sentence as the Dravet entry. |
| TSC1, TSC2 | tuberous sclerosis | sirolimus topical gel (Hyftor) | DailyMed setid edb3ea90-5adc-48ec-99f5-ab963e302f18 | Indication is facial angiofibroma associated with tuberous sclerosis. FDA approval letter (NDA 213478, 2022) was found but the PDF could not be text-extracted, so `approvalYear` omitted. |

`targets` classification:
- `mechanism`: everolimus and topical sirolimus (mTOR inhibitors; the Afinitor label states "The mTOR pathway is dysregulated in several human cancers and in tuberous sclerosis complex (TSC)"). Hyftor's own label says the mechanism in angiofibroma is unknown, but sirolimus is an mTOR inhibitor, so classified as mechanism.
- `symptoms`: cannabidiol, fenfluramine, stiripentol, ganaxolone (anti-seizure medicines whose labels state the mechanism is unknown or is GABA-A modulation; none act on the gene defect or its pathway).
- `symptoms` (uncertain): trofinetide for Rett. It is an IGF-1-derived tripeptide analog; the label says the mechanism is unknown. It does not act on MECP2, its transcript or protein, so it is not `genetic_cause`; whether IGF-1 signalling counts as "the pathway MECP2 loss disrupts" is arguable, so per the instructions it is marked `symptoms` with the uncertainty stated in `targetsNote`.
- No entry qualifies as `genetic_cause`: no gene therapy, antisense or enzyme-replacement product is FDA-approved for any condition in this slice.

## Conditions searched with nothing found

Each line: query term used -> outcome. "No regulator page" means the search returned only literature, trial registrations, patient-organisation pages or designation news (orphan/breakthrough/rare-pediatric designations are not approvals and were not used).

- SCN2A (nonspecific severe ID; infantile epileptic encephalopathy) — "SCN2A developmental and epileptic encephalopathy" -> no regulator page; only investigational agents (relutrigine, elsunersen) with designations.
- SCN3A (focal epilepsy / FFEVF4) — no regulator page.
- SCN8A (DEE 13) — no regulator page; NBI-921352 investigational.
- SCN1B (GEFS+ type 1; DEE 52) — "SCN1B generalized epilepsy with febrile seizures plus" -> no regulator page.
- KCNQ2 (benign familial neonatal seizures; DEE 7) — no regulator page; XEN496 (ezogabine) trials only.
- KCNQ3 (KCNQ3 syndrome) — no regulator page.
- KCNT1 (EIMFS; DEE 14) — no regulator page.
- KCNA2 (DEE 32, two atlas entries) — no regulator page; fampridine off-label reports only.
- KCNB1 (DEE 26) — no regulator page.
- KCNC1 (progressive myoclonic epilepsy 7) — no regulator page.
- KCNH1 (Temple-Baraitser syndrome) — no regulator page.
- HCN1 (DEE 24) — no regulator page.
- CACNA1A (DEE 42) — no regulator page.
- CACNA1E (DEE 69) — no regulator page.
- GRIN1 (DEE / NDD with or without hyperkinetic movements, two atlas entries) — no regulator page; radiprodil investigational.
- GRIN2A (epilepsy with speech disorder; GRIN2A NDD) — no regulator page.
- GRIN2B (ID AD6; DEE 27) — no regulator page.
- GRIN2D (DEE 46, "treatable with NMDA receptor channel blockers") — no regulator page; memantine/ketamine use is off-label and their labels do not name GRIN2D.
- GABRA1 (JME; DEE 19) — no regulator page.
- GABRB2 (epilepsy and ID) — no regulator page.
- GABRB3 (childhood absence epilepsy susceptibility 5) — no regulator page naming GABRB3 or the atlas condition; generic absence-epilepsy drugs (e.g. ethosuximide) are labelled for "absence seizures" without a gene/condition name, which does not qualify.
- GABRG2 (GEFS+ / familial febrile seizures 8) — no regulator page.
- STXBP1 (DEE 4) — no regulator page; CAP-002 gene therapy is IND-stage only.
- SYNGAP1 (ID AD5) — no regulator page.
- SLC6A1 (epilepsy with myoclonic-atonic seizures) — no regulator page.
- DNM1 (DEE 31A/31B, two atlas entries) — no regulator page.
- STX1B (GEFS+ 9) — no regulator page.
- SYN1 (X-linked epilepsy with learning disabilities) — no regulator page.
- SNAP25 (SNAP25-DEE / congenital myasthenic syndrome 18) — no regulator page.
- PRRT2 (PKD with or without infantile seizures; NDD and movement disorder, two atlas entries) — no regulator page; carbamazepine/oxcarbazepine are used off-label and their labels do not name PKD or PRRT2.
- SHANK3 (Phelan-McDermid syndrome) — no regulator page; NNZ-2591 investigational.
- IQSEC2 (XLID1) — no regulator page.
- CASK (MICPCH; XLID with or without nystagmus, two atlas entries) — no regulator page.
- NRXN1 (autism susceptibility 1; Pitt-Hopkins-like syndrome 2) — no regulator page.
- MECP2 duplication syndrome and MECP2 neonatal severe encephalopathy — no regulator page (Daybue's indication is "Rett syndrome" only; not extended to these two MECP2 conditions).
- FOXG1 (congenital variant of Rett syndrome) — no regulator page. Daybue's indication says "Rett syndrome" without "congenital variant"; FOXG1 syndrome was deliberately NOT mapped onto the Daybue label.
- TCF4 (Pitt-Hopkins syndrome) — no regulator page; MZ-1866 gene therapy has designations only.
- UBE3A (Angelman syndrome) — no regulator page; ION582, GTX-102 investigational.
- CHD2 (DEE 94) — no regulator page.
- MEF2C (MEF2C haploinsufficiency) — no regulator page.
- SATB2 (Glass syndrome) — no regulator page.
- DYRK1A (ID AD7) — no regulator page.
- HNRNPU (DEE 54) — no regulator page.
- HNRNPH2 (Bain type XLID) — no regulator page.
- ARX (lissencephaly X-linked 2 / DEE 1 spectrum) — no regulator page.
- ADNP (Helsmoortel-Van der Aa syndrome) — no regulator page.
- ANKRD11 (KBG syndrome) — no regulator page.
- DDX3X (Snijders Blok type XLID, two atlas entries) — no regulator page.
- PURA (PURA syndrome) — no regulator page.
- SMC1A (Cornelia de Lange syndrome 2; DEE 85) — no regulator page.
- SLC2A1 (GLUT1 deficiency syndrome) — no regulator page; ketogenic diet is standard of care, triheptanoin was trialled but its FDA label (Dojolvi) is for LC-FAOD, not GLUT1 DS.
- SLC13A5 (DEE 25 / citrate transporter disorder) — no regulator page; gene therapy has designations only.
- ALDH7A1 (pyridoxine-dependent epilepsy) — no regulator page; pyridoxine products are not labelled for this condition.
- PNPO (PNPO deficiency) — pyridoxal 5'-phosphate has an FDA orphan designation (accessdata OOPD record) but is designated, not approved; no label.
- PCDH19 (DEE 9) — no regulator page; ganaxolone's label is CDD only (PCDH19 trials did not lead to a labelled indication).
- DEPDC5 (FFEVF) — no regulator page.
- WWOX (SCAR12; DEE 28, two atlas entries) — no regulator page.
- EEF1A2 (DEE 33) — no regulator page.
- GNAO1 (DEE 17) — no regulator page; zinc case report and ASO trial only.
- ATP1A3 (alternating hemiplegia of childhood) — no regulator page; flunarizine is not approved in the US.
- SPTAN1 (DEE 5) — no regulator page.

## Candidates considered and rejected

- Rapamune (sirolimus) oral: FDA indication is lymphangioleiomyomatosis; the indication text does not name tuberous sclerosis, so it does not qualify.
- Generic broad-indication anti-seizure medicines (vigabatrin/infantile spasms, ethosuximide/absence seizures, carbamazepine/focal seizures, etc.): indications do not name any condition in the slice.
- Everolimus generics (Biocon, Amneal "everolimus tablet, for suspension") appear on DailyMed with the same TSC indications; only the reference product (Afinitor) is recorded to avoid duplicate entries.
- EMA pages were not consulted since every qualifying therapy had an FDA source.

## Open points for human verification

1. `targets` for trofinetide (Daybue) — marked `symptoms` but could be argued `mechanism`.
2. `targets` for Hyftor — marked `mechanism` on pharmacological class even though its label says the mechanism in angiofibroma is unknown.
3. Fintepla, Afinitor, Hyftor and Epidiolex/TSC have no `approvalYear` because the retrieved page does not state the condition-specific approval year (external evidence: Fintepla/Dravet 2020-06-25; Afinitor TSC-SEGA 2010, renal AML 2012, TSC seizures 2018; Hyftor 2022-03-22; Epidiolex TSC 2020-07).
4. The Afinitor quote omits subsection 1.4 (TSC-associated renal angiomyolipoma) to respect the 400-character limit; the text is reproduced in the table above.
