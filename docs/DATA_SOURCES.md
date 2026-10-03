# Data sources

| Source | URL | Retrieved | Version | License / terms |
|---|---|---|---|---|
| Gene2Phenotype, Developmental disorders panel | https://ftp.ebi.ac.uk/pub/databases/gene2phenotype/G2P_data_downloads/2026_09_28/DDG2P_2026-09-28.csv.gz | 2026-10-03 | 2026-09-28 export (panel last updated 2026-10-02 per API) | EMBL-EBI terms of use; G2P data is freely available (https://www.ebi.ac.uk/gene2phenotype/about/terms) |
| Human Phenotype Ontology, `hp.json` | https://purl.obolibrary.org/obo/hp.json | 2026-10-03 | releases/2026-09-01 | HPO license; attribution required (https://hpo.jax.org/license) |
| HPO annotations, `phenotype.hpoa` | https://purl.obolibrary.org/obo/hp/hpoa/phenotype.hpoa | 2026-10-03 | 2026-09-02 | HPO license; attribution required |
| HPO `genes_to_phenotype.txt` | https://purl.obolibrary.org/obo/hp/hpoa/genes_to_phenotype.txt | 2026-10-03 | 2026-09 release | HPO license; attribution required |
| ClinicalTrials.gov API v2 | https://clinicaltrials.gov/api/v2/studies | see build manifest | live API | Public domain (US government); terms at https://clinicaltrials.gov/about-site/terms-conditions |
| NIH RePORTER API v2 | https://api.reporter.nih.gov/v2/projects/search | see build manifest | live API | Public domain (US government) |
| NCBI E-utilities (PubMed) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/ | see build manifest | live API | NCBI terms; `tool=slipstream` sent on each request |
| Patient organizations (seed) | `data/seed/patient_orgs.json` | drafted 2026-10-03 | hand-drafted | Links to organizations' own public sites only; entries unverified until a human checks them |
| Approved therapies (seed) | `data/seed/approved_therapies.json` | n/a | empty | Only entries with a regulator or label URL may be added |

Attribution: this product uses the Human Phenotype Ontology (version 2026-09-01). Find out more at http://www.human-phenotype-ontology.org. Gene2Phenotype is a project of EMBL-EBI; see https://www.ebi.ac.uk/gene2phenotype.
