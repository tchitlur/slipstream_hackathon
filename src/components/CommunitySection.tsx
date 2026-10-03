"use client";

import Link from "next/link";
import type { PatientOrg, MechanismRelation } from "@/lib/schemas";
import { EvidenceLink } from "./EvidenceDrawer";
import { Chip } from "./Badges";
import { RelationChip, SimilarityBar } from "./Ladder";

type Related = { condition: { id: string; name: string; geneSymbol: string; href: string }; similarity: number; relation?: MechanismRelation; orgs: PatientOrg[] };

export function CommunitySection({ condition, orgs, related, orgsSearched }: { condition: { id: string; name: string; geneSymbol: string; depth: "deep" | "shallow" }; orgs: PatientOrg[]; related: Related[]; orgsSearched: boolean }) {
  return (
    <section aria-labelledby="community-h">
      <h2 id="community-h" className="text-2xl mb-1">Community</h2>
      {orgs.length > 0 ? (
        <ul className="space-y-2">
          {orgs.map((o) => (
            <li key={o.id} className="border border-line rounded-md p-3 bg-white/50 flex flex-wrap items-start justify-between gap-2">
              <div>
                <a href={o.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                  {o.name}
                </a>
                <div className="text-sm text-ink-2">
                  {o.registry === "yes" ? "States a registry or natural history study on its site" : o.registry === "no" ? "No registry stated on its site" : "Registry: unknown"}
                  {o.registryUrl && (
                    <>
                      {" "}
                      (<a href={o.registryUrl} target="_blank" rel="noopener noreferrer" className="underline">page</a>)
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <EvidenceLink ids={o.evidenceIds} title={o.name} className="inline-flex">
                  <Chip tone={o.verified ? "ok" : "warn"}>{o.verified ? "verified listing" : "unverified listing"}</Chip>
                </EvidenceLink>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border border-line rounded-md p-3 bg-white/50 text-sm space-y-2">
          <p className="text-ink">
            {condition.depth === "shallow" || !orgsSearched ? `Patient organizations were not searched for ${condition.name} (deeper layers not yet built).` : `No patient organization for ${condition.name} is in Slipstream's seed list.`}
          </p>
          {condition.depth === "deep" && orgsSearched && (
            <p className="text-ink-2">
              That means none was found when the seed list was drafted from ClinicalTrials.gov sponsors and a web check, or it has not been verified yet. What would change this: a public site for a {condition.geneSymbol} group, added to the seed list with its URL and checked by a human.
            </p>
          )}
          {related.length > 0 && (
            <div>
              <div className="text-ink font-medium mb-1">Closest communities that do have an organization</div>
              <ul className="space-y-1">
                {related.map((r) => (
                  <li key={r.condition.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={r.condition.href} className="underline">
                      {r.condition.geneSymbol} · {r.condition.name}
                    </Link>
                    <RelationChip relation={r.relation} />
                    <SimilarityBar value={r.similarity} />
                    <span className="text-ink-2">
                      {r.orgs.map((o) => (
                        <a key={o.id} href={o.url} target="_blank" rel="noopener noreferrer" className="underline mr-2">
                          {o.name}
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
