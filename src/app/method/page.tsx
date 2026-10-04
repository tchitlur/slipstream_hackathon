import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { getStore } from "@/lib/data";
import { RULES, COUNTER_REASONS } from "@/lib/transferRules";
import { ROADS } from "@/lib/roads";
import { MILESTONES } from "@/lib/ladder";
import { RoadDot, KindBadge } from "@/components/Badges";

export const dynamic = "force-static";

type TherapySeed = { condition: string; conditionName?: string; therapy: string; regulator: string; source?: string; url: string; indicationQuote?: string; approvalYear?: number; targets?: string; targetsNote?: string; verified: boolean; check?: { status: string; date: string } };
function readTherapies(): TherapySeed[] {
  const p = path.join(process.cwd(), "data", "seed", "approved_therapies.json");
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as TherapySeed[];
  } catch {
    return [];
  }
}

function readLimitations(): string[] {
  const p = path.join(process.cwd(), "docs", "LIMITATIONS.md");
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

export default function MethodPage() {
  const store = getStore();
  const m = store.manifest;
  const c = m?.counts ?? {};
  const t = m?.thresholds ?? {};
  const limitations = readLimitations();
  const therapies = readTherapies();
  const baseline = store.baseline;
  const enoughPairs = Boolean(baseline && baseline.pairs.length >= 4 && baseline.medianYears !== null);
  const deep = store.atlas.conditions.filter((x) => x.depth === "deep").length;
  return (
    <article className="space-y-12 max-w-4xl">
      <header className="space-y-3">
        <h1 className="text-3xl sm:text-4xl">Method</h1>
        <p className="text-ink-2 max-w-3xl">
          Slipstream is a research navigation aid built from public data. Every claim on every page points at an evidence record you can open. This page lists the sources, the computed layers, the transfer rules and their counter-reasons, the honest limits, and the case for impact.
        </p>
        <nav className="text-sm flex flex-wrap gap-x-4 gap-y-1">
          {[
            ["#sources", "Sources"],
            ["#evidence", "Evidence kinds"],
            ["#roads", "Roads"],
            ["#similarity", "Similarity and clusters"],
            ["#ladder", "Ladder"],
            ["#rules", "Transfer rules"],
            ["#counter", "Counter-reasons"],
            ["#llm", "Language-model use"],
            ["#tenx", "The 10x case"],
            ["#therapies", "Approved therapies"],
            ["#limits", "Limitations"],
          ].map(([h, l]) => (
            <a key={h} href={h} className="underline">
              {l}
            </a>
          ))}
        </nav>
      </header>

      <section id="sources" className="space-y-3">
        <h2 className="text-2xl">Sources, dates and coverage</h2>
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1 border-b border-line font-normal">Source</th>
              <th className="py-1 border-b border-line font-normal">Version</th>
              <th className="py-1 border-b border-line font-normal">Retrieved</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(m?.sources ?? {}).map(([k, s]) => (
              <tr key={k}>
                <td className="py-1 border-b border-line">
                  <a href={s.url} className="underline" target="_blank" rel="noopener noreferrer">
                    {k}
                  </a>
                </td>
                <td className="py-1 border-b border-line">{s.version ?? "live API"}</td>
                <td className="py-1 border-b border-line">{s.retrievedAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Stat k="Conditions (deep slice, every layer)" v={deep} />
          <Stat k="Conditions (atlas-wide, mechanism and symptoms only)" v={store.atlas.conditions.length - deep} />
          <Stat k="Genes in the deep slice" v={store.atlas.genes.filter((g) => g.depth === "deep").length} />
          <Stat k="Seed genes dropped (no Gene2Phenotype DD record)" v={m?.genesDropped.length ?? 0} />
          <Stat k="Studies retrieved from ClinicalTrials.gov" v={c.studiesRetrieved} />
          <Stat k="Studies classified as about a condition" v={c.studiesAboutCondition} />
          <Stat k="Studies discarded as not about the condition" v={c.studiesDiscardedNotAbout} />
          <Stat k="Studies whose eligibility excludes a variant class" v={c.studiesWithMechanismExclusion} />
          <Stat k="Quotes verified verbatim (T1 + T2)" v={(c.t2QuotesVerified ?? 0) + (c.t1ClaimsVerified ?? 0)} />
          <Stat k="Quotes discarded (failed verification)" v={(c.t2QuotesDiscarded ?? 0) + (c.t1ClaimsDiscarded ?? 0)} />
          <Stat k="Mechanism flags" v={`${c.mechanismContestedStrict ?? 0} contested, ${c.mechanismBothDirections ?? 0} both directions reported, ${c.mechanismDifferentReported ?? 0} different mechanism also reported`} />
          <Stat k="NIH RePORTER projects" v={c.grants} />
          <Stat k="Investigators (after conservative merge)" v={c.investigators} />
          <Stat k="Bridges" v={c.bridges} />
          <Stat k="Patient organizations (automatically checked / human-verified)" v={`${c.patientOrgsAutoChecked ?? 0} / ${c.patientOrgsVerified ?? 0}`} />
          <Stat k="Shared registries confirmed from their own sites" v={c.sharedRegistries} />
          <Stat k="Registries found outside ClinicalTrials.gov" v={c.externalRegistries} />
          <Stat k="Transfer verdicts" v={c.transferVerdicts} />
          <Stat k="Estimated LLM spend (upper bound)" v={m ? `$${m.llm.spendUsd.toFixed(2)}` : "—"} />
          <Stat k="Build commit" v={m?.gitCommit ?? "—"} />
        </dl>
        <p className="text-sm text-muted">Not used: OMIM downloads (licensed) and directory sites such as NORD or Global Genes. OMIM identifiers appear only as cross-references inside HPO and Gene2Phenotype files. Attribution: Human Phenotype Ontology ({m?.sources?.hpo?.version?.replace(/.*releases\//, "") ?? ""}), Gene2Phenotype (EMBL-EBI).</p>
      </section>

      <section id="evidence" className="space-y-3">
        <h2 className="text-2xl">Four kinds of evidence</h2>
        <p className="text-sm text-ink-2">Every edge and claim carries one or more evidence records. The badge tells you how much to trust it and where it came from. Data, extracted claims, calculations and hypotheses are never blended.</p>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-3 items-start">
            <KindBadge kind="curated" /> <span>Stated by an expert-curated database (Gene2Phenotype, HPO, a ClinicalTrials.gov or RePORTER record, or the hand-drafted seed list).</span>
          </li>
          <li className="flex gap-3 items-start">
            <KindBadge kind="extracted" /> <span>A language model pulled it from a document, and the quote was verified to be a verbatim substring of the cached source text with stored character offsets. Claims whose quote fails are discarded and counted.</span>
          </li>
          <li className="flex gap-3 items-start">
            <KindBadge kind="computed" /> <span>A deterministic calculation over data (similarity, information content, literature counts).</span>
          </li>
          <li className="flex gap-3 items-start">
            <KindBadge kind="hypothesis" /> <span>Produced by a transfer rule. Shown with the rule and the strongest counter-reason. Never a conclusion.</span>
          </li>
        </ul>
        <p className="text-sm text-ink-2">A study existing is not clinical proof. Slipstream never presents trial existence as evidence that a therapy works.</p>
      </section>

      <section id="roads" className="space-y-3">
        <h2 className="text-2xl">Roads: mechanism as a typed grouping</h2>
        <p className="text-sm text-ink-2">The focal entity is a condition: one gene, one disease, one curated mechanism (one Gene2Phenotype record). The same gene can have a loss-of-function condition and a gain-of-function condition, and they are separate nodes. Roads simplify the allelic requirement to monoallelic or biallelic and keep the raw value.</p>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {ROADS.map((r) => {
            const n = store.atlas.roads.find((x) => x.id === r.id)?.conditionIds.length ?? 0;
            return (
              <li key={r.id} className="border border-line rounded-md p-3 bg-white/50">
                <div className="flex items-center gap-2 font-medium">
                  <RoadDot roadId={r.id} /> <Link href={`/road/${r.id.replace(/^road:/, "").replace(/:/g, "-")}`} className="hover:underline">{r.label}</Link>
                </div>
                <div className="text-ink-2 text-xs mt-1">
                  {r.mechanism}; {r.allelicClass} · {n} condition{n === 1 ? "" : "s"}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="similarity" className="space-y-3">
        <h2 className="text-2xl">Phenotype similarity and clusters</h2>
        <p className="text-sm text-ink-2">
          Each condition&apos;s phenotype set comes from HPO annotations of the cross-referenced disease, unioned with the HPO terms on the Gene2Phenotype record; gene-plus-name matching is the fallback, and ambiguous matches are left unmatched ({c.phenotypeMatch_none ?? 0} conditions). Information content per term is −log(p), where p is the share of annotated diseases ({c.annotatedDiseaseCorpus}) carrying the term or a descendant. Similarity between two conditions is simGIC: the summed information content of the shared ancestor-closed terms divided by that of the union.
        </p>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <Stat k={`High similarity cutoff (percentile ${(t.similarityHighPercentile ?? 0) * 100})`} v={t.similarityHigh} />
          <Stat k={`Medium similarity cutoff (percentile ${(t.similarityMediumPercentile ?? 0) * 100})`} v={t.similarityMedium} />
          <Stat k="Cluster-edge threshold" v={t.similarityEdge} />
          <Stat k="Median information content (low-information line for C1)" v={t.medianIc} />
          <Stat k="Thin annotation flag (fewer terms than)" v={t.thinAnnotationTerms} />
          <Stat k="Louvain clusters" v={c.clusters} />
        </dl>
        <p className="text-sm text-ink-2">Clusters are Louvain communities on the graph of nearest neighbors above the edge threshold, named by their most informative shared phenotypes. Roads are a separate categorical grouping shown by color. The <Link href="/map" className="underline">map</Link> uses a precomputed force layout.</p>
      </section>

      <section id="ladder" className="space-y-3">
        <h2 className="text-2xl">The readiness ladder</h2>
        <p className="text-sm text-ink-2">Eight milestones in a conventional order; real progress is not linear. Status is found (with evidence), partly (a weaker form is present), not found (searched, nothing returned, with the sources listed) or not searched (atlas-wide conditions). Milestone 4 distinguishes a condition-specific registry or natural history study (found) from inclusion in a shared multi-gene registry such as Simons Searchlight (partly, named on the cell). Milestone 7 counts only trials whose intervention acts on the gene or its product; pathway-level trials (mTOR inhibitors, growth hormone or IGF-1 approaches) show as partly. A neighbor is ahead when its status ranks higher (found above partly above not found).</p>
        <ol className="text-sm space-y-1 list-decimal pl-5">
          {MILESTONES.map((ms) => (
            <li key={ms.n}>
              <span className="font-medium">{ms.label}.</span> <span className="text-ink-2">Sources: {ms.sources.join("; ")}.</span> <span className="text-muted">Found for {c[`milestone${ms.n}_found_deep`] ?? 0} of {deep} deep conditions.</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="rules" className="space-y-3">
        <h2 className="text-2xl">Transfer rules</h2>
        <p className="text-sm text-ink-2">
          &quot;Similar&quot; is not one thing. Conditions that look alike in patients can share registry design and outcome measures; only conditions on the same mechanism road can share a treatment strategy. Each asset type has a rule. Verdicts are hypotheses for expert review. &quot;High&quot; and &quot;medium&quot; similarity are the percentile cutoffs above.
        </p>
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1 pr-2 border-b border-line font-normal">Rule</th>
              <th className="py-1 pr-2 border-b border-line font-normal">Asset from the neighbor</th>
              <th className="py-1 border-b border-line font-normal">Verdict logic</th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((r) => (
              <tr key={r.id} id={r.id} className="align-top">
                <td className="py-2 pr-2 border-b border-line font-medium">{r.id}</td>
                <td className="py-2 pr-2 border-b border-line">{r.asset}</td>
                <td className="py-2 border-b border-line text-ink-2">{r.logic}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-ink-2">
          Verdicts in this build: {c.verdictTransferable ?? 0} transferable, {c.verdictNeedsExpertReview ?? 0} needs expert review, {c.verdictDoNotTransfer ?? 0} do not transfer.
        </p>
      </section>

      <section id="counter" className="space-y-3">
        <h2 className="text-2xl">Counter-reasons</h2>
        <p className="text-sm text-ink-2">Every verdict shows the strongest applicable reason it might be wrong.</p>
        <table className="w-full text-sm border-separate border-spacing-0">
          <tbody>
            {(Object.keys(COUNTER_REASONS) as (keyof typeof COUNTER_REASONS)[]).map((code) => (
              <tr key={code} className="align-top">
                <td className="py-1.5 pr-3 border-b border-line font-medium whitespace-nowrap">
                  {code} · {COUNTER_REASONS[code].title}
                </td>
                <td className="py-1.5 border-b border-line text-ink-2">{COUNTER_REASONS[code].appliesTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted">C1 fires when at least {Math.round((t.lowInfoShareC1 ?? 0.8) * 100)}% of the shared phenotype weight comes from terms below the median information content.</p>
      </section>

      <section id="llm" className="space-y-3">
        <h2 className="text-2xl">Where language models are used, and where they are not</h2>
        <p className="text-sm text-ink-2">
          The mechanism backbone, phenotype sets, similarity, ladder statuses and transfer verdicts are curated or computed; no language model touches them. OpenAI models are used for six narrow tasks with structured outputs, every one a pipeline stage that re-runs with the build and is cached with its input and output: T1 pulls mechanism claims from PubMed abstracts ({m?.llm.models?.T1 ?? "—"}); T2 classifies ClinicalTrials.gov records ({m?.llm.models?.T2 ?? "—"}); T3 reconciles unresolved disease names ({m?.llm.models?.T3 ?? "—"}); T4 writes the brief ({m?.llm.models?.T4 ?? "—"}); T5 reviews each verified claim that disagrees with the curated mechanism against its full abstract and decides keep or reject and whether it is a same-variant-class dispute ({m?.llm.models?.T5 ?? "—"}); T6 assigns the three-level target label to targeted trials and approved therapies from the record text ({m?.llm.models?.T6 ?? "—"}). T5 and T6 are automated reviews by a language model, not a biomedical expert review, and are labelled that way wherever their result appears. Organization and registry listings are seed data checked once by an automated agent, with the page snippet stored as evidence. T1 and T2 quotes must be verbatim or the claim is discarded. T4 output is checked sentence by sentence; sentences without a valid evidence id are dropped, and if more than a fifth fail the brief is regenerated once and then replaced by a deterministic template. Every call is cached with its input and output as an audit trail.
        </p>
      </section>

      <section id="tenx" className="space-y-3">
        <h2 className="text-2xl">The 10x case</h2>
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">Milestone:</span> a fundable natural history study plan for a condition that has none.
        </p>
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">Proposed route:</span> instead of designing from scratch, adapt the registry protocol and outcome measures of a same-cluster neighbor that already runs one (rules R1 and R2), reach its clinical network through shared investigators (R3), and take the counter-reasons that fired as the agenda for one expert review meeting. The brief Slipstream drafts is the first email of that process.
        </p>
        <ul className="text-sm text-ink-2 list-disc pl-5 space-y-1">
          <li>Assumption: a protocol adapted from a high-similarity neighbor needs expert revision for age of onset and severity, not redesign.</li>
          <li>Assumption: the neighbor community is willing to share its protocol; Slipstream can only show that it exists and who runs it.</li>
          <li>Assumption: phenotype annotation depth is adequate for both conditions (C6 flags when it is not).</li>
          <li>Assumption: readiness milestones are a reasonable proxy for a community&apos;s distance from a natural history study.</li>
        </ul>
        {enoughPairs ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink">Baseline computed from this atlas&apos;s own data:</span> for patient organizations that passed the automated site check and state a founding year on their own site, the time from founding to the start of the earliest registry or natural history study of the <em>same condition</em>. A study counts only if its ClinicalTrials.gov record names the disease (matched by disease name, not merely by gene symbol); it is drawn from the classified studies in this atlas plus a ClinicalTrials.gov search of observational studies by each condition&apos;s disease names (Gene2Phenotype names and synonyms, and names such as “Dravet Syndrome” that records matched to the condition during reconciliation), keeping studies whose title reads as a registry or natural history study.
            </p>
            <dl className="grid sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
              <Stat k="Pairs" v={baseline!.pairs.length} />
              <Stat k="Median, years" v={baseline!.medianYears!.toFixed(1)} />
              <Stat k="Range, years" v={`${baseline!.minYears!.toFixed(1)} to ${baseline!.maxYears!.toFixed(1)}`} />
            </dl>
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-1 pr-2 border-b border-line font-normal">Organization (founded)</th>
                  <th className="py-1 pr-2 border-b border-line font-normal">Earliest registry / NHS study (start)</th>
                  <th className="py-1 border-b border-line font-normal">Years</th>
                </tr>
              </thead>
              <tbody>
                {baseline!.pairs
                  .slice()
                  .sort((a, b) => a.years - b.years)
                  .map((p) => (
                    <tr key={p.orgId} className="align-top">
                      <td className="py-1.5 pr-2 border-b border-line">
                        <a href={p.foundedUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          {p.orgName}
                        </a>{" "}
                        ({p.foundedYear})
                        <div className="text-xs text-muted">“{p.foundedSnippet.slice(0, 140)}{p.foundedSnippet.length > 140 ? "…" : ""}”</div>
                      </td>
                      <td className="py-1.5 pr-2 border-b border-line">
                        <a href={`https://clinicaltrials.gov/study/${p.studyId}`} target="_blank" rel="noopener noreferrer" className="underline">
                          {p.studyId}
                        </a>{" "}
                        <span className="text-ink-2">{p.studyTitle.slice(0, 80)}</span> <span className="text-muted">({p.studyRole.replace(/_/g, " ")}, {p.studyStartDate})</span>
                        <div className="text-xs text-muted">{p.conditionIds.map((cid) => store.conditions.get(cid)?.geneSymbol).filter(Boolean).join(", ")}</div>
                      </td>
                      <td className="py-1.5 border-b border-line tabular-nums">{p.years.toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p className="text-xs text-muted">
              This counts only groups that did launch a study and whose site states a founding year ({baseline!.orgsWithFoundingYear} of {baseline!.orgsPassed} checked organizations); groups that never reached a study are invisible to it, so the median is a floor, not a typical wait. Study start dates come from ClinicalTrials.gov; a registry run outside that database is not counted, and a study is paired with an organization only when its record names the organization&apos;s condition, so an organization whose condition appears in no observational record is also absent. Studies found by the disease-name search are read as registry or natural history studies from their titles, not by the T2 classifier; each row links to its record.
            </p>
            <p className="text-sm border border-line rounded-md p-3 bg-paper-2">
              <span className="font-medium">Target, not a measured result:</span> if a community adapts a same-cluster neighbor&apos;s protocol and outcome measures instead of designing from scratch, the aim is a fundable natural history study plan within one year of forming, against a median of {baseline!.medianYears!.toFixed(1)} years in the pairs above. That would be roughly a {Math.max(1, Math.round(baseline!.medianYears! / 1))}x shortening <em>under the assumptions listed</em>; nothing in this atlas measures whether any group has achieved it.
            </p>
          </div>
        ) : (
          <p className="text-sm border border-line rounded-md p-3 bg-paper-2">
            Baseline timeline: to be supplied with a source. The atlas tried to compute one from organization founding years and earliest registry study start dates, but found {baseline?.pairs.length ?? 0} usable pair{(baseline?.pairs.length ?? 0) === 1 ? "" : "s"} (at least four are required). No multiplier is shown.
          </p>
        )}
      </section>

      <section id="therapies" className="space-y-3">
        <h2 className="text-2xl">Approved disease-specific therapies (rung 8)</h2>
        <p className="text-sm text-ink-2">Only entries whose regulator page names the condition in the indication text. Each is labelled with the same three levels used for trials: acts on the gene or its product; acts on a downstream pathway; treats symptoms or the mechanism is not established. Approval is not evidence of benefit for any individual.</p>
        {therapies.length ? (
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1 pr-2 border-b border-line font-normal">Condition</th>
                <th className="py-1 pr-2 border-b border-line font-normal">Therapy</th>
                <th className="py-1 pr-2 border-b border-line font-normal">Acts on</th>
                <th className="py-1 border-b border-line font-normal">Indication text (source)</th>
              </tr>
            </thead>
            <tbody>
              {therapies.map((t, i) => (
                <tr key={i} className="align-top">
                  <td className="py-1.5 pr-2 border-b border-line">
                    {t.conditionName ?? t.condition} <span className="text-muted">({t.condition})</span>
                  </td>
                  <td className="py-1.5 pr-2 border-b border-line">
                    {t.therapy}
                    {t.approvalYear ? <span className="text-muted"> · {t.regulator} {t.approvalYear}</span> : <span className="text-muted"> · {t.regulator}</span>}
                  </td>
                  <td className="py-1.5 pr-2 border-b border-line">
                    {t.targets === "gene_product" ? "gene or its product" : t.targets === "pathway" ? "downstream pathway" : "symptoms, or mechanism not established"}
                    {t.targetsNote && <div className="text-xs text-muted">{t.targetsNote}</div>}
                  </td>
                  <td className="py-1.5 border-b border-line text-ink-2">
                    {t.indicationQuote && <>“{t.indicationQuote.slice(0, 220)}{t.indicationQuote.length > 220 ? "…" : ""}” </>}
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {t.source ?? t.regulator}
                    </a>
                    {t.check?.status === "auto" && <span className="text-muted"> · automatically checked {t.check.date}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">None recorded in this build.</p>
        )}
      </section>

      <section id="limits" className="space-y-3">
        <h2 className="text-2xl">Limitations</h2>
        <ul className="text-sm text-ink-2 list-disc pl-5 space-y-1">
          {limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">A research navigation aid. Not medical advice. Confirm anything here with a clinician or genetic counselor.</p>
      </section>
    </article>
  );
}

function Stat({ k, v }: { k: string; v: string | number | undefined }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/60 py-0.5">
      <dt className="text-ink-2">{k}</dt>
      <dd className="font-medium tabular-nums">{v ?? "—"}</dd>
    </div>
  );
}
