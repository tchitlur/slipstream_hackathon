/**
 * S7 Patient organizations: turn the hand-drafted seed list into PatientOrg nodes linked to
 * conditions, with seed evidence records. Every entry stays unverified until a human flips it.
 * Entries without a URL are rejected (SPEC 11).
 */
import { z } from "zod";
import { readValidated, readJsonOr, writeJson, log, uniq } from "./lib/io";
import { files } from "./lib/paths";
import { writeEvidence } from "./lib/evidence";
import { updateManifest } from "./lib/manifest";
import { AtlasSchema, PatientOrgSeedSchema, type PatientOrg, type Evidence } from "../src/lib/schemas";
import { buildRegistries } from "./lib/registries";

async function main() {
  const atlas = readValidated(files.atlas, AtlasSchema);
  const raw = readJsonOr<unknown[]>(files.seedOrgs, []);
  const seeds: z.infer<typeof PatientOrgSeedSchema>[] = [];
  raw.forEach((r, i) => {
    const p = PatientOrgSeedSchema.safeParse(r);
    if (p.success) seeds.push(p.data);
    else log("S7", `seed entry ${i} rejected: ${p.error.issues.map((x) => x.path.join(".") + " " + x.message).join("; ")}`);
  });
  const today = new Date().toISOString().slice(0, 10);
  const orgs: Record<string, PatientOrg> = {};
  const evidence: Evidence[] = [];
  let linked = 0;
  let failed = 0;
  for (const s of seeds) {
    if (s.check?.status === "failed") {
      failed++;
      log("S7", `${s.slug}: failed automated check (${s.check.reason ?? "no reason"}); not displayed`);
      continue;
    }
    const conditionIds = uniq(
      s.conditions.flatMap((term) => {
        const t = term.trim();
        if (t.startsWith("cond:")) return atlas.conditions.filter((c) => c.id === t).map((c) => c.id);
        return atlas.conditions.filter((c) => c.geneSymbol === t.toUpperCase() && c.depth === "deep").map((c) => c.id);
      }),
    );
    if (!conditionIds.length) log("S7", `${s.slug}: no deep condition matches ${s.conditions.join(", ")}`);
    const evId = `ev:seed:org:${s.slug}`;
    evidence.push({
      id: evId,
      kind: "curated",
      source: "seed",
      sourceId: `patient_orgs.json#${s.slug}`,
      url: s.url,
      retrievedAt: today,
      confidence: s.verified ? "high" : s.check?.status === "auto" ? "medium" : "low",
      title: s.name,
      note: `${s.verified ? "Human-verified" : s.check?.status === "auto" ? `Automatically checked on ${s.check.date}: the organization's own site loaded and names the gene or condition (${s.check.pageUrl ?? s.url}; "${(s.check.snippet ?? "").slice(0, 200)}"). Not human-verified.` : "Unchecked"} seed entry${s.foundVia ? " (" + s.foundVia + ")" : ""}. Registry stated on site: ${s.registry}${s.registryNote ? ". " + s.registryNote : ""}${s.registryUrl ? " See " + s.registryUrl : ""}.`,
    });
    const evIds = [evId];
    if (s.registry === "yes" && s.registryUrl) {
      const rid = `ev:seed:org:${s.slug}:registry`;
      evidence.push({ id: rid, kind: "curated", source: "seed", sourceId: `patient_orgs.json#${s.slug}.registry`, url: s.registryUrl, retrievedAt: today, confidence: s.verified ? "high" : s.check?.status === "auto" ? "medium" : "low", title: `${s.name}: registry or natural history program`, note: s.registryNote ?? "The organization's site states that a registry or natural history study exists." });
      evIds.push(rid);
    }
    orgs[`org:${s.slug}`] = { ...s, id: `org:${s.slug}`, conditionIds, evidenceIds: evIds };
    linked += conditionIds.length;
  }
  writeJson(files.orgs, { orgs }, { pretty: false });
  const reg = buildRegistries(atlas.conditions, Object.fromEntries(Object.values(orgs).map((o) => [o.slug, { conditionIds: o.conditionIds, name: o.name }])));
  writeJson(files.registries, { registries: reg.registries }, { pretty: false });
  writeEvidence(["ev:seed:org:", "ev:seed:registry:", "ev:seed:orgreg:", "ev:seed:extreg:"], [...evidence, ...reg.evidence]);
  log("S7", `registries: ${Object.keys(reg.registries).length} records (${JSON.stringify(reg.counts)})`);
  updateManifest((m) => {
    m.counts.patientOrgs = Object.keys(orgs).length;
    m.counts.patientOrgsVerified = Object.values(orgs).filter((o) => o.verified).length;
    m.counts.patientOrgsAutoChecked = Object.values(orgs).filter((o) => o.check?.status === "auto").length;
    m.counts.patientOrgsFailedCheck = failed;
    m.counts.patientOrgsWithFoundingYear = Object.values(orgs).filter((o) => o.founded).length;
    m.counts.patientOrgsWithRegistry = Object.values(orgs).filter((o) => o.registry === "yes").length;
    m.counts.conditionsWithOrg = uniq(Object.values(orgs).flatMap((o) => o.conditionIds)).length;
    m.counts.registryRecords = Object.keys(reg.registries).length;
    m.counts.sharedRegistries = reg.counts.sharedRegistries;
    m.counts.sharedRegistryGeneLinks = reg.counts.sharedGeneLinks;
    m.counts.orgSharedRegistryLinks = reg.counts.orgParticipationLinks;
    m.counts.externalRegistries = reg.counts.externalRegistries;
    m.counts.conditionsInSharedRegistry = uniq(Object.values(reg.registries).filter((r) => r.kind === "shared_registry").flatMap((r) => r.conditionIds)).length;
  });
  log("S7", `${failed} failed the automated check and are hidden; ${Object.keys(orgs).length} organizations, ${linked} condition links, ${Object.values(orgs).filter((o) => o.registry === "yes").length} state a registry, ${Object.values(orgs).filter((o) => o.verified).length} verified`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
