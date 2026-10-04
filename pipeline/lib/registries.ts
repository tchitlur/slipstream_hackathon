/**
 * Shared and external registries (added 2026-10-04): multi-gene registries such as Simons Searchlight that include a
 * condition's gene, organization pages stating participation in a shared registry, and registries or natural history
 * studies found outside ClinicalTrials.gov. Each becomes a RegistryRecord with seed evidence carrying the verbatim snippet.
 */
import { z } from "zod";
import { files } from "./paths";
import { readJsonOr, uniq, slugify } from "./io";
import { SharedRegistrySeedSchema, type Condition, type Evidence, type RegistryRecord } from "../../src/lib/schemas";

const OrgParticipationSchema = z.object({
  checkedAt: z.string(),
  reviewer: z.string(),
  items: z.array(
    z.object({
      slug: z.string(),
      sharedRegistries: z.array(z.object({ name: z.string(), pageUrl: z.string(), snippet: z.string() })).default([]),
      ownRegistry: z.object({ pageUrl: z.string(), snippet: z.string() }).nullable().optional(),
      /** Condition-specific registries run by a third party (a university lab, a hospital), stated on the organization's page. */
      otherRegistries: z.array(z.object({ name: z.string(), pageUrl: z.string(), snippet: z.string(), operator: z.string().optional() })).default([]),
      checkedPages: z.array(z.string()).default([]),
    }),
  ),
});
const ExternalSchema = z.object({
  checkedAt: z.string(),
  reviewer: z.string(),
  items: z.array(
    z.object({
      gene: z.string(),
      g2pId: z.string(),
      found: z.boolean(),
      registries: z.array(z.object({ name: z.string(), url: z.string(), snippet: z.string(), kind: z.enum(["registry", "natural_history", "shared_registry"]), operator: z.string().optional() })).default([]),
      searchQuery: z.string().optional(),
    }),
  ),
});

export function buildRegistries(conditions: Condition[], orgsBySlug: Record<string, { conditionIds: string[]; name: string }>): { registries: Record<string, RegistryRecord>; evidence: Evidence[]; counts: Record<string, number> } {
  const registries: Record<string, RegistryRecord> = {};
  const evidence: Evidence[] = [];
  const deep = conditions.filter((c) => c.depth === "deep");
  const byGene = new Map<string, Condition[]>();
  for (const c of deep) (byGene.get(c.geneSymbol) ?? byGene.set(c.geneSymbol, []).get(c.geneSymbol)!).push(c);
  const counts: Record<string, number> = { sharedRegistries: 0, sharedGeneLinks: 0, orgParticipationLinks: 0, externalRegistries: 0 };

  // 1. Shared registries from their own sites.
  const sharedRaw = readJsonOr<unknown[]>(files.seedSharedRegistries, []);
  for (const raw of sharedRaw) {
    const p = SharedRegistrySeedSchema.safeParse(raw);
    if (!p.success) continue;
    const r = p.data;
    const date = r.check?.date ?? "2026-10-04";
    const condIds: string[] = [];
    for (const g of r.genes) {
      const conds = byGene.get(g.symbol.toUpperCase()) ?? [];
      if (!conds.length) continue;
      const evId = `ev:seed:registry:${r.id}:${g.symbol}`;
      evidence.push({
        id: evId,
        kind: "curated",
        source: "seed",
        sourceId: `shared_registries.json#${r.id}/${g.symbol}`,
        url: g.pageUrl,
        retrievedAt: date,
        confidence: "medium",
        title: `${r.name} includes ${g.symbol}`,
        quote: { text: g.snippet, start: 0, end: g.snippet.length },
        note: `${r.name}${r.operator ? " (" + r.operator + ")" : ""} is a shared, multi-gene ${r.type.replace(/_/g, " ")}. Its own site lists ${g.symbol}${g.conditionNameOnPage ? " as " + g.conditionNameOnPage : ""}. Automatically checked on ${date}; inclusion in a shared registry is a weaker milestone than a condition-specific study.`,
      });
      counts.sharedGeneLinks++;
      for (const c of conds) {
        condIds.push(c.id);
        const id = `reg:${r.id}:${c.g2pId}`;
        registries[id] = { id, kind: "shared_registry", name: r.name, operator: r.operator, url: r.url, conditionIds: [c.id], evidenceIds: [evId], source: "shared_registries" };
      }
    }
    if (r.description && r.descriptionUrl) {
      evidence.push({ id: `ev:seed:registry:${r.id}`, kind: "curated", source: "seed", sourceId: `shared_registries.json#${r.id}`, url: r.descriptionUrl, retrievedAt: date, confidence: "medium", title: r.name, quote: { text: r.description, start: 0, end: r.description.length }, note: `Shared registry description from its own site. Genes from this atlas listed: ${uniq(condIds.map((id) => conditions.find((c) => c.id === id)?.geneSymbol)).filter(Boolean).join(", ") || "none"}.` });
    }
    counts.sharedRegistries++;
  }

  // 2. Organization pages stating participation in a shared registry (or their own registry).
  const partRaw = readJsonOr<unknown>(files.seedOrgRegistryParticipation, null);
  const part = partRaw ? OrgParticipationSchema.safeParse(partRaw) : null;
  if (part?.success) {
    for (const item of part.data.items) {
      const org = orgsBySlug[item.slug];
      if (!org) continue;
      for (const sr of item.sharedRegistries) {
        const rid = slugify(sr.name);
        const evId = `ev:seed:orgreg:${item.slug}:${rid}`;
        evidence.push({ id: evId, kind: "curated", source: "seed", sourceId: `org_registry_participation.json#${item.slug}/${rid}`, url: sr.pageUrl, retrievedAt: part.data.checkedAt, confidence: "medium", title: `${org.name} points families to ${sr.name}`, quote: { text: sr.snippet, start: 0, end: sr.snippet.length }, note: `Stated on the organization's own page. ${part.data.reviewer}.` });
        counts.orgParticipationLinks++;
        for (const cid of org.conditionIds) {
          const c = conditions.find((x) => x.id === cid)!;
          const id = `reg:${rid}:${c.g2pId}`;
          if (registries[id]) {
            registries[id].evidenceIds = uniq([...registries[id].evidenceIds, evId]);
          } else registries[id] = { id, kind: "shared_registry", name: sr.name, url: sr.pageUrl, conditionIds: [cid], evidenceIds: [evId], source: "org_page" };
        }
      }
      for (const r of item.otherRegistries) {
        const rid = slugify(r.name);
        const evId = `ev:seed:orgreg:${item.slug}:other-${rid}`;
        evidence.push({ id: evId, kind: "curated", source: "seed", sourceId: `org_registry_participation.json#${item.slug}/other/${rid}`, url: r.pageUrl, retrievedAt: part.data.checkedAt, confidence: "medium", title: `${r.name}${r.operator ? " (" + r.operator + ")" : ""}`, quote: { text: r.snippet, start: 0, end: r.snippet.length }, note: `A condition-specific registry or natural history study run by ${r.operator ?? "a third party"}, as stated on ${org.name}'s page. ${part.data.reviewer}.` });
        counts.orgParticipationLinks++;
        for (const cid of org.conditionIds) {
          const c = conditions.find((x) => x.id === cid)!;
          const id = `reg:${rid}:${c.g2pId}`;
          if (!registries[id]) registries[id] = { id, kind: "registry", name: r.name, operator: r.operator, url: r.pageUrl, conditionIds: [cid], evidenceIds: [evId], source: "org_page" };
        }
      }
      if (item.ownRegistry) {
        const evId = `ev:seed:orgreg:${item.slug}:own`;
        evidence.push({ id: evId, kind: "curated", source: "seed", sourceId: `org_registry_participation.json#${item.slug}/own`, url: item.ownRegistry.pageUrl, retrievedAt: part.data.checkedAt, confidence: "medium", title: `${org.name}: registry or natural history program`, quote: { text: item.ownRegistry.snippet, start: 0, end: item.ownRegistry.snippet.length }, note: `Stated on the organization's own page. ${part.data.reviewer}.` });
        for (const cid of org.conditionIds) {
          const c = conditions.find((x) => x.id === cid)!;
          const id = `reg:org-${item.slug}:${c.g2pId}`;
          registries[id] = { id, kind: "registry", name: `${org.name} registry`, operator: org.name, url: item.ownRegistry.pageUrl, conditionIds: [cid], evidenceIds: [evId], source: "org_page" };
        }
      }
    }
  }

  // 3. Registries found outside ClinicalTrials.gov for conditions that had none.
  const extRaw = readJsonOr<unknown>(files.seedExternalRegistries, null);
  const ext = extRaw ? ExternalSchema.safeParse(extRaw) : null;
  if (ext?.success) {
    for (const item of ext.data.items) {
      if (!item.found) continue;
      const c = conditions.find((x) => x.g2pId === item.g2pId) ?? byGene.get(item.gene.toUpperCase())?.[0];
      if (!c) continue;
      item.registries.forEach((r, i) => {
        const rid = slugify(r.name) || `ext-${i}`;
        const evId = `ev:seed:extreg:${c.g2pId}:${rid}`;
        evidence.push({ id: evId, kind: "curated", source: "seed", sourceId: `external_registries.json#${c.g2pId}/${rid}`, url: r.url, retrievedAt: ext.data.checkedAt, confidence: "medium", title: `${r.name}${r.operator ? " (" + r.operator + ")" : ""}`, quote: { text: r.snippet, start: 0, end: r.snippet.length }, note: `Found by one web search (${item.searchQuery ?? "registry or natural history study"}) outside ClinicalTrials.gov. ${ext.data.reviewer}.` });
        const id = `reg:${rid}:${c.g2pId}`;
        registries[id] = { id, kind: r.kind, name: r.name, operator: r.operator, url: r.url, conditionIds: [c.id], evidenceIds: [evId], source: "web_search" };
        counts.externalRegistries++;
      });
    }
  }
  return { registries, evidence, counts };
}
