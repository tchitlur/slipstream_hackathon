import { z } from "zod";

// ---------------------------------------------------------------------------
// Evidence (section 7.2)
// ---------------------------------------------------------------------------

export const EvidenceKind = z.enum(["curated", "extracted", "computed", "hypothesis"]);
export const EvidenceSource = z.enum(["g2p", "hpo", "ctgov", "reporter", "pubmed", "seed", "rule"]);
export const Confidence = z.enum(["high", "medium", "low"]);

export const QuoteSchema = z.object({
  text: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  /** Which cached source text the offsets index into, e.g. "ctgov:NCT01234567" or "pubmed:12345". */
  sourceText: z.string().optional(),
});

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  kind: EvidenceKind,
  source: EvidenceSource,
  sourceId: z.string().min(1),
  url: z.string().min(1),
  retrievedAt: z.string().min(1),
  quote: QuoteSchema.optional(),
  confidence: Confidence,
  note: z.string().optional(),
  /** Short label used in the evidence drawer header. */
  title: z.string().optional(),
  /** Evidence IDs that contradict this record (section 10.6). */
  contradictedBy: z.array(z.string()).optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
export const EvidenceFileSchema = z.record(z.string(), EvidenceSchema);

// ---------------------------------------------------------------------------
// Atlas: conditions, genes, roads, clusters (section 7.1)
// ---------------------------------------------------------------------------

export const Mechanism = z.enum([
  "loss of function",
  "gain of function",
  "dominant negative",
  "undetermined non-loss-of-function",
  "undetermined",
]);
export type Mechanism = z.infer<typeof Mechanism>;

export const MechanismSupport = z.enum(["evidence", "inferred"]);
export const G2PConfidence = z.enum(["definitive", "strong", "moderate", "limited", "disputed", "refuted"]);
export const AllelicClass = z.enum(["monoallelic", "biallelic", "other"]);
export const Depth = z.enum(["deep", "shallow"]);
export const Direction = z.enum(["loss", "gain", "dominant_negative", "unclear"]);

export const MechanismClaimSchema = z.object({
  pmid: z.string(),
  direction: Direction,
  mechanism: z.string(),
  conditionHint: z.string(),
  evidenceId: z.string(),
});

export const ContestedSchema = z.object({
  curatedMechanism: Mechanism,
  curatedEvidenceId: z.string(),
  claims: z.array(MechanismClaimSchema),
});

export const PhenotypeMatchMethod = z.enum(["hpoa_xref", "g2p_record", "gene_name", "none"]);

export const ConditionSchema = z.object({
  id: z.string().regex(/^cond:G2P\d+$/),
  g2pId: z.string(),
  name: z.string(),
  synonyms: z.array(z.string()),
  geneId: z.string(),
  geneSymbol: z.string(),
  diseaseMim: z.string().optional(),
  diseaseMondo: z.string().optional(),
  allelicRequirementRaw: z.string(),
  allelicClass: AllelicClass,
  mechanism: Mechanism,
  mechanismSupport: MechanismSupport,
  mechanismCategorisation: z.string().optional(),
  confidence: G2PConfidence,
  roadId: z.string(),
  depth: Depth,
  publications: z.array(z.string()),
  /** HPO terms curated on the G2P record itself (may be empty). */
  curatedPhenotypeIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).min(1),
  phenotypeMatch: z.object({
    method: PhenotypeMatchMethod,
    sourceId: z.string().optional(),
    termCount: z.number().int().nonnegative(),
  }),
  thinAnnotation: z.boolean(),
  contested: ContestedSchema.optional(),
  /** Verified claims in a different direction that did not reach the contested threshold (fewer than two papers). */
  dissentingClaims: z.array(MechanismClaimSchema).default([]),
  /** Other conditions on the same gene with a different mechanism. */
  sameGeneOtherMechanism: z.array(z.string()).default([]),
  /** Verified extracted claims that agree with the curated mechanism. */
  supportingClaims: z.array(MechanismClaimSchema).default([]),
  clusterId: z.string().optional(),
  lastReviewed: z.string().optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const GeneSchema = z.object({
  id: z.string().regex(/^gene:HGNC:\d+$/),
  hgncId: z.string(),
  symbol: z.string(),
  aliases: z.array(z.string()),
  conditionIds: z.array(z.string()),
  depth: Depth,
  /** Disease names annotated to this gene in HPO (used for visible synonym resolution). */
  hpoDiseaseNames: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
});
export type Gene = z.infer<typeof GeneSchema>;

export const RoadSchema = z.object({
  id: z.string().regex(/^road:/),
  label: z.string(),
  description: z.string(),
  allelicClass: z.union([AllelicClass, z.literal("any")]),
  mechanism: Mechanism,
  color: z.string(),
  conditionIds: z.array(z.string()),
});
export type Road = z.infer<typeof RoadSchema>;

export const ClusterSchema = z.object({
  id: z.string().regex(/^cluster:\d+$/),
  label: z.string(),
  memberIds: z.array(z.string()),
  topPhenotypes: z.array(z.object({ id: z.string(), label: z.string(), ic: z.number(), share: z.number() })),
});
export type Cluster = z.infer<typeof ClusterSchema>;

export const AtlasSchema = z.object({
  builtAt: z.string(),
  conditions: z.array(ConditionSchema),
  genes: z.array(GeneSchema),
  roads: z.array(RoadSchema),
  clusters: z.array(ClusterSchema),
});
export type Atlas = z.infer<typeof AtlasSchema>;

// ---------------------------------------------------------------------------
// Phenotypes and similarity (section 7.3, 9.3)
// ---------------------------------------------------------------------------

export const PhenotypeTermSchema = z.object({
  id: z.string().regex(/^HP:\d{7}$/),
  label: z.string(),
  ic: z.number().nonnegative(),
  parents: z.array(z.string()),
});
export type PhenotypeTerm = z.infer<typeof PhenotypeTermSchema>;

export const PhenotypesFileSchema = z.object({
  terms: z.record(z.string(), PhenotypeTermSchema),
  medianIc: z.number(),
  annotatedDiseaseCount: z.number().int(),
  /** Direct (not ancestor-closed) terms per condition. */
  conditionTerms: z.record(z.string(), z.array(z.string())),
});
export type PhenotypesFile = z.infer<typeof PhenotypesFileSchema>;

export const MechanismRelation = z.enum(["same road", "different road", "opposite direction", "unknown", "contested"]);
export type MechanismRelation = z.infer<typeof MechanismRelation>;

export const NeighborSchema = z.object({
  id: z.string(),
  similarity: z.number().min(0).max(1),
  band: z.enum(["high", "medium", "low"]).optional(),
  sharedTop: z.array(z.object({ id: z.string(), label: z.string(), ic: z.number() })),
  /** Share of intersection IC weight from terms below the median IC. */
  lowInfoShare: z.number().min(0).max(1),
  relation: MechanismRelation.optional(),
  /** The relation computed from curated mechanisms alone, ignoring contested flags. */
  curatedRelation: MechanismRelation.optional(),
  aheadOn: z.array(z.number().int()).optional(),
  sharedInvestigatorIds: z.array(z.string()).optional(),
  sameGene: z.boolean().optional(),
  /** Number of terms in the intersection of the ancestor-closed sets. */
  sharedCount: z.number().int().optional(),
  evidenceIds: z.array(z.string()).min(1),
});
export type Neighbor = z.infer<typeof NeighborSchema>;

export const SimilarityFileSchema = z.object({
  cutoffs: z.object({ high: z.number(), medium: z.number(), edge: z.number() }),
  conditionIds: z.array(z.string()),
});
export type SimilarityFile = z.infer<typeof SimilarityFileSchema>;
export const SimilarityConditionFileSchema = z.object({ conditionId: z.string(), neighbors: z.array(NeighborSchema) });

// ---------------------------------------------------------------------------
// Studies, literature, funding, investigators, organizations
// ---------------------------------------------------------------------------

export const StudyRole = z.enum([
  "natural_history",
  "registry",
  "interventional_targeted",
  "interventional_symptomatic",
  "other",
]);
export const StudyModality = z.enum([
  "antisense",
  "gene_therapy",
  "small_molecule",
  "enzyme_or_protein",
  "diet_or_supplement",
  "device_or_behavioral",
  "none",
  "unclear",
]);

export const StudyClassificationSchema = z.object({
  aboutCondition: z.boolean(),
  role: StudyRole,
  modality: StudyModality,
  excludesMechanism: z.string().optional(),
  quote: z.string(),
  quoteVerified: z.boolean(),
  excludesQuote: z.string().optional(),
  excludesQuoteVerified: z.boolean().optional(),
});

export const StudySchema = z.object({
  id: z.string().regex(/^NCT\d{8}$/),
  briefTitle: z.string(),
  officialTitle: z.string().optional(),
  status: z.string(),
  studyType: z.string(),
  phases: z.array(z.string()),
  conditions: z.array(z.string()),
  interventions: z.array(z.object({ name: z.string(), type: z.string() })),
  sponsor: z.string().optional(),
  officials: z.array(z.object({ name: z.string(), affiliation: z.string().optional(), role: z.string().optional() })),
  startDate: z.string().optional(),
  enrollment: z.number().optional(),
  /** First part of the eligibility text, shown for R7 so families can ask the study team. */
  eligibilityExcerpt: z.string().optional(),
  /** Which condition IDs this study was retrieved for and how. */
  hits: z.array(z.object({ conditionId: z.string(), via: z.enum(["cond", "term"]), query: z.string() })),
  conditionIds: z.array(z.string()),
  classification: StudyClassificationSchema.optional(),
  evidenceIds: z.array(z.string()),
  retrievedAt: z.string(),
});
export type Study = z.infer<typeof StudySchema>;
export const StudiesFileSchema = z.object({ genesSearched: z.array(z.string()).default([]), studies: z.record(z.string(), StudySchema) });

export const PaperSchema = z.object({
  pmid: z.string(),
  title: z.string(),
  year: z.string().optional(),
  authors: z.array(z.string()),
  lastAuthor: z.string().optional(),
  hasAbstract: z.boolean(),
});
export type Paper = z.infer<typeof PaperSchema>;

export const LiteratureFileSchema = z.object({
  byGene: z.record(
    z.string(),
    z.object({
      symbol: z.string(),
      mechanismQuery: z.string(),
      mechanismPmids: z.array(z.string()),
      modelQuery: z.string(),
      modelCount: z.number().int(),
      modelTopPmids: z.array(z.string()),
      retrievedAt: z.string(),
    }),
  ),
  papers: z.record(z.string(), PaperSchema),
  claims: z.array(
    MechanismClaimSchema.extend({
      geneSymbol: z.string(),
      quote: z.string(),
      verified: z.boolean(),
    }),
  ),
  discardedClaims: z.number().int(),
  discardedByGene: z.record(z.string(), z.number().int()).default({}),
});
export type LiteratureFile = z.infer<typeof LiteratureFileSchema>;

export const GrantSchema = z.object({
  id: z.string().regex(/^grant:/),
  projectNumber: z.string(),
  title: z.string(),
  fiscalYears: z.array(z.number().int()),
  organization: z.string().optional(),
  piNames: z.array(z.string()),
  abstractExcerpt: z.string().optional(),
  conditionIds: z.array(z.string()),
  queryTerms: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  url: z.string(),
});
export type Grant = z.infer<typeof GrantSchema>;
export const FundingFileSchema = z.object({ genesSearched: z.array(z.string()).default([]), grants: z.record(z.string(), GrantSchema) });

export const InvestigatorSchema = z.object({
  id: z.string().regex(/^inv:/),
  displayName: z.string(),
  organizations: z.array(z.string()),
  records: z.array(
    z.object({
      kind: z.enum(["grant", "study", "paper"]),
      id: z.string(),
      url: z.string(),
      role: z.string(),
      conditionIds: z.array(z.string()),
    }),
  ),
  conditionIds: z.array(z.string()),
  roadIds: z.array(z.string()),
  clusterIds: z.array(z.string()),
  isBridge: z.boolean(),
  bridgeReason: z.string().optional(),
});
export type Investigator = z.infer<typeof InvestigatorSchema>;
export const InvestigatorsFileSchema = z.object({ investigators: z.record(z.string(), InvestigatorSchema) });

export const PatientOrgSeedSchema = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string().url(),
  conditions: z.array(z.string()).describe("Gene symbols or condition IDs served"),
  registry: z.enum(["yes", "no", "unknown"]),
  registryUrl: z.string().url().optional(),
  registryNote: z.string().optional(),
  foundVia: z.string().optional(),
  verified: z.boolean(),
});
export type PatientOrgSeed = z.infer<typeof PatientOrgSeedSchema>;

export const PatientOrgSchema = PatientOrgSeedSchema.extend({
  id: z.string().regex(/^org:/),
  conditionIds: z.array(z.string()),
  evidenceIds: z.array(z.string()).min(1),
});
export type PatientOrg = z.infer<typeof PatientOrgSchema>;
export const OrgsFileSchema = z.object({ orgs: z.record(z.string(), PatientOrgSchema) });

export const ApprovedTherapySeedSchema = z.object({
  condition: z.string(),
  therapy: z.string(),
  regulator: z.string(),
  url: z.string().url(),
  verified: z.boolean(),
});

// ---------------------------------------------------------------------------
// Ladders (section 9.1)
// ---------------------------------------------------------------------------

export const MilestoneStatus = z.enum(["found", "not_found", "not_searched"]);
export type MilestoneStatus = z.infer<typeof MilestoneStatus>;

export const MilestoneSchema = z.object({
  n: z.number().int().min(1).max(8),
  key: z.string(),
  label: z.string(),
  status: MilestoneStatus,
  evidenceIds: z.array(z.string()),
  sourcesSearched: z.array(z.string()),
  detail: z.string().optional(),
  /** Flags surfaced in the UI, e.g. "support: inferred", "unverified". */
  flags: z.array(z.string()).default([]),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const LadderSchema = z.object({
  conditionId: z.string(),
  milestones: z.array(MilestoneSchema).length(8),
});
export type Ladder = z.infer<typeof LadderSchema>;
export const LaddersFileSchema = z.object({ ladders: z.record(z.string(), LadderSchema) });

// ---------------------------------------------------------------------------
// Transfers (section 9.4, 9.5)
// ---------------------------------------------------------------------------

export const Verdict = z.enum(["transferable", "needs_expert_review", "do_not_transfer"]);
export type Verdict = z.infer<typeof Verdict>;
export const RuleId = z.enum(["R1", "R2", "R3", "R4", "R5", "R6", "R7"]);
export type RuleId = z.infer<typeof RuleId>;
export const CounterCode = z.enum(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]);
export type CounterCode = z.infer<typeof CounterCode>;

export const CounterReasonSchema = z.object({
  code: CounterCode,
  text: z.string(),
  evidenceIds: z.array(z.string()).default([]),
});

export const TransferVerdictSchema = z.object({
  ruleId: RuleId,
  asset: z.string(),
  verdict: Verdict.nullable(),
  reason: z.string(),
  /** Specific records from the neighbor that make up this asset. */
  assetRecords: z.array(z.object({ label: z.string(), url: z.string(), evidenceId: z.string() })),
  counterReasons: z.array(CounterReasonSchema).min(1),
  evidenceIds: z.array(z.string()).min(1),
  warning: z.boolean().default(false),
});
export type TransferVerdict = z.infer<typeof TransferVerdictSchema>;

export const TransferPairSchema = z.object({
  focalId: z.string(),
  neighborId: z.string(),
  verdicts: z.array(TransferVerdictSchema),
  expertQuestions: z.array(z.string()),
});
export type TransferPair = z.infer<typeof TransferPairSchema>;
export const TransfersFileSchema = z.object({
  cutoffs: z.object({ high: z.number(), medium: z.number() }),
  focalIds: z.array(z.string()),
  pairCount: z.number().int(),
});
export const TransfersFocalFileSchema = z.object({ focalId: z.string(), pairs: z.record(z.string(), TransferPairSchema) });

// ---------------------------------------------------------------------------
// Layout, search, demo candidates, briefs, manifest
// ---------------------------------------------------------------------------

export const LayoutFileSchema = z.object({
  nodes: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  edges: z.array(z.tuple([z.string(), z.string(), z.number()])),
  threshold: z.number(),
});

export const SearchDocSchema = z.object({
  id: z.string(),
  type: z.enum(["condition", "gene", "phenotype", "org", "road"]),
  title: z.string(),
  subtitle: z.string().optional(),
  text: z.string(),
  href: z.string(),
  weight: z.number().optional(),
});
export type SearchDoc = z.infer<typeof SearchDocSchema>;
export const SearchIndexFileSchema = z.object({
  docs: z.array(SearchDocSchema),
});

export const DemoCandidateSchema = z.object({
  conditionId: z.string(),
  neighborId: z.string(),
  counterexampleId: z.string().optional(),
  score: z.number(),
  reason: z.string(),
});
export const DemoCandidatesFileSchema = z.array(DemoCandidateSchema);

export const BriefSentenceSchema = z.object({
  text: z.string(),
  evidenceIds: z.array(z.string()),
});
export const BriefSectionSchema = z.object({
  heading: z.string(),
  sentences: z.array(BriefSentenceSchema),
});
export const BriefSchema = z.object({
  focalId: z.string(),
  neighborId: z.string(),
  generatedAt: z.string(),
  mode: z.enum(["llm", "template"]),
  model: z.string().optional(),
  sections: z.array(BriefSectionSchema),
  glossary: z.array(z.object({ term: z.string(), meaning: z.string() })),
  droppedSentences: z.number().int().default(0),
});
export type Brief = z.infer<typeof BriefSchema>;

export const BuildManifestSchema = z.object({
  builtAt: z.string(),
  gitCommit: z.string().optional(),
  sources: z.record(z.string(), z.object({ url: z.string(), version: z.string().optional(), retrievedAt: z.string() })),
  counts: z.record(z.string(), z.number()),
  thresholds: z.record(z.string(), z.number()),
  llm: z.object({
    spendUsd: z.number(),
    byStage: z.record(z.string(), z.object({ calls: z.number(), inputTokens: z.number(), outputTokens: z.number(), usd: z.number() })),
    models: z.record(z.string(), z.string()),
  }),
  genesRequested: z.array(z.string()),
  genesDropped: z.array(z.object({ symbol: z.string(), reason: z.string() })),
  notes: z.array(z.string()).default([]),
});
export type BuildManifest = z.infer<typeof BuildManifestSchema>;

export const ProbeFileSchema = z.object({
  ranAt: z.string(),
  openaiKeySet: z.boolean(),
  ncbiKeySet: z.boolean(),
  hosts: z.array(z.object({ host: z.string(), url: z.string(), status: z.number().nullable(), reachable: z.boolean(), error: z.string().optional() })),
});

// Stage intermediate: reconciliation decisions (S6)
export const ReconciliationFileSchema = z.object({
  decisions: z.array(
    z.object({
      name: z.string(),
      source: z.enum(["ctgov", "reporter"]),
      recordId: z.string(),
      conditionId: z.string().nullable(),
      method: z.enum(["exact", "normalized", "gene", "llm", "none"]),
      reason: z.string().optional(),
    }),
  ),
});
