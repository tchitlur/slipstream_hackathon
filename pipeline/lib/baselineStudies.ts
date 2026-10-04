/**
 * Earlier registry or natural history studies for the baseline (2026-10-04): for each organization that passed the
 * automated check and states a founding year, query ClinicalTrials.gov by the condition's disease names (not the gene)
 * for observational studies and keep those whose title or design reads as a registry or natural history study.
 * Classification here is a title/design heuristic, not the T2 classifier, and the records are labelled as such.
 *
 * Disease names come from the atlas (Gene2Phenotype name and synonyms) and from the reconciliation layer: names that
 * ClinicalTrials.gov records used for this condition and that were matched to it by exact, normalized or reviewed
 * matching (for SCN1A that adds "Dravet Syndrome"). Generic names such as "epilepsy and intellectual disability" are
 * dropped, and a study counts only when one of its listed conditions contains the whole name.
 */
import { fetchJsonCached } from "./http";
import { log } from "./io";
import type { Condition, PatientOrg } from "../../src/lib/schemas";

export type BaselineStudy = { id: string; title: string; startDate: string; conditionId: string; orgId: string; matchedName: string; via: "title" | "design"; retrievedAt: string };

const NHS_TITLE = /natural history|registry|longitudinal|prospective (cohort|observational)|observational (cohort|study)|clinical (course|spectrum|characteri)|phenotyp/i;

/** Words that do not make a disease name specific on their own. */
const GENERIC_WORDS = new Set(["epilepsy", "epilepsies", "epileptic", "encephalopathy", "encephalopathies", "developmental", "and", "or", "with", "of", "the", "intellectual", "disability", "disorder", "disorders", "seizure", "seizures", "syndrome", "syndromes", "related", "childhood", "infantile", "neonatal", "early", "late", "onset", "generalized", "focal", "febrile", "plus", "type", "neurodevelopmental", "autism", "spectrum", "severe", "benign", "familial", "susceptibility", "to", "developmental", "delay", "in", "disease", "diseases", "genetic", "pediatric", "paediatric", "infancy"]);

export function isDistinctiveName(name: string, geneSymbol: string): boolean {
  const n = name.trim();
  if (n.length < 6) return false;
  if (new RegExp(`\\b${geneSymbol}\\b`, "i").test(n)) return true;
  if (/\d/.test(n)) return true; // numbered OMIM-style entity ("Developmental and epileptic encephalopathy 19")
  const words = n.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
  return words.some((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
}

export function distinctiveNames(c: Condition, extra: string[] = []): string[] {
  const names = [c.name.replace(new RegExp(`^${c.geneSymbol}-related\\s+`, "i"), ""), ...c.synonyms, ...extra];
  return Array.from(new Set(names.map((n) => n.trim()).filter((n) => isDistinctiveName(n, c.geneSymbol)))).slice(0, 6);
}

type Raw = { protocolSection: { identificationModule: { nctId: string; briefTitle?: string; officialTitle?: string }; statusModule?: { startDateStruct?: { date?: string } }; designModule?: { studyType?: string; designInfo?: { observationalModel?: string; timePerspective?: string } }; conditionsModule?: { conditions?: string[] } } };

export async function findBaselineStudies(orgs: PatientOrg[], conditions: Condition[], extraNames: Map<string, string[]> = new Map()): Promise<BaselineStudy[]> {
  const out: BaselineStudy[] = [];
  const condById = new Map(conditions.map((c) => [c.id, c]));
  for (const o of orgs) {
    if (!o.founded) continue;
    for (const cid of o.conditionIds) {
      const c = condById.get(cid);
      if (!c) continue;
      for (const name of distinctiveNames(c, extraNames.get(cid) ?? [])) {
        const params = new URLSearchParams({ "query.cond": name, pageSize: "50", fields: "NCTId,BriefTitle,OfficialTitle,StartDate,StudyType,DesignObservationalModel,DesignTimePerspective,Condition", sort: "StartDate" });
        const url = `https://clinicaltrials.gov/api/v2/studies?${params}&aggFilters=studyType:obs`;
        let res;
        try {
          res = await fetchJsonCached<{ studies: Raw[] }>(url, { cacheDir: "ctgov/baseline", cacheKey: `obs:${name}`, gzip: true });
        } catch (e) {
          log("baseline", `query failed (${name}): ${(e as Error).message.slice(0, 100)}`);
          continue;
        }
        for (const s of res.data.studies ?? []) {
          const p = s.protocolSection;
          const start = p.statusModule?.startDateStruct?.date;
          if (!start || p.designModule?.studyType !== "OBSERVATIONAL") continue;
          const title = `${p.identificationModule.briefTitle ?? ""} ${p.identificationModule.officialTitle ?? ""}`;
          // The study must list the disease by (at least) this whole name; a shorter study condition such as "Epilepsy" does not count.
          const condHit = (p.conditionsModule?.conditions ?? []).some((x) => x.toLowerCase().includes(name.toLowerCase()));
          if (!condHit) continue;
          // The title must read as a registry or natural history study. A prospective cohort design alone is not enough:
          // it admitted a gait-treatment study and a newborn screening study on the first run.
          if (!NHS_TITLE.test(title)) continue;
          if (Number(start.slice(0, 4)) < o.founded.year) continue;
          out.push({ id: p.identificationModule.nctId, title: (p.identificationModule.briefTitle ?? "").slice(0, 160), startDate: start, conditionId: cid, orgId: o.id, matchedName: name, via: "title", retrievedAt: res.retrievedAt.slice(0, 10) });
        }
      }
    }
  }
  return out;
}
