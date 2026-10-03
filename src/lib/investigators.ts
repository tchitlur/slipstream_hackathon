/**
 * Investigator name normalization and the conservative merge rule (SPEC S8): same normalized
 * surname, same first initial, and the same organization or the same linked public record.
 */
import type { Investigator } from "./schemas";
import { slugify, uniq } from "./text";

export function normalizeName(full: string): { surname: string; initial: string; display: string } {
  const s = full
    .replace(/\s+/g, " ")
    .replace(/,?\s*\b(MD|PhD|M\.D\.|Ph\.D\.|DO|MBBS|MBChB|FRCP|FRCPC|FAAN|FAAP|MPH|MSc|MS|BSc|RN|PharmD|DrPH|Prof\.?|Professor|Dr\.?)\b\.?/gi, "")
    .replace(/\s+,/g, ",")
    .trim();
  let first = "";
  let last = "";
  if (s.includes(",")) {
    const [l, f] = s.split(",").map((x) => x.trim());
    last = l;
    first = f ?? "";
  } else {
    const parts = s.split(" ").filter(Boolean);
    last = parts[parts.length - 1] ?? s;
    first = parts.slice(0, -1).join(" ");
  }
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const display = `${first.split(" ").filter(Boolean).map(cap).join(" ")} ${last.split(/(-| )/).map((w) => (/^[a-zA-Z]/.test(w) ? cap(w) : w)).join("")}`.trim();
  return { surname: last.toLowerCase().replace(/[^a-z]/g, ""), initial: (first[0] ?? "").toLowerCase(), display };
}

export type RawMention = { name: string; org?: string; record: Investigator["records"][number] };

/** Merge rule (SPEC S8): same normalized surname, same first initial, and same organization or the same linked record. */
const NON_PERSON = /\b(cares|monitor|director|study|trial|team|department|dept|clinical|medical|office|center|centre|hospital|university|institute|pharma|inc|ltd|llc|research|group|contact|coordinator|nurse|site|sponsor|unit|laboratory|services?)\b/i;

/** Heuristic: a string is a person's name when it has 2-5 word tokens and no organizational words. */
export function looksLikePerson(name: string): boolean {
  const n = name.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = n.split(" ").filter(Boolean);
  if (tokens.length < 2 || tokens.length > 6) return false;
  if (NON_PERSON.test(n)) return false;
  if (/\d/.test(n)) return false;
  return true;
}

export function mergeInvestigators(raws: RawMention[]): Investigator[] {
  const groups: { key: string; surname: string; initial: string; display: string; orgs: Set<string>; records: Investigator["records"]; recordKeys: Set<string> }[] = [];
  for (const r of raws) {
    if (!looksLikePerson(r.name)) continue;
    const n = normalizeName(r.name);
    if (!n.surname || n.surname.length < 2) continue;
    const org = (r.org ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    const recKey = `${r.record.kind}:${r.record.id}`;
    const g = groups.find((g) => g.surname === n.surname && g.initial === n.initial && ((org && g.orgs.has(org)) || g.recordKeys.has(recKey)));
    if (g) {
      if (org) g.orgs.add(org);
      g.recordKeys.add(recKey);
      if (r.org && !g.records.some((x) => x.kind === r.record.kind && x.id === r.record.id)) g.records.push(r.record);
      else if (!g.records.some((x) => x.kind === r.record.kind && x.id === r.record.id)) g.records.push(r.record);
      if (r.org) g.display = g.display.length >= n.display.length ? g.display : n.display;
    } else {
      groups.push({ key: `${n.surname}-${n.initial}-${groups.length}`, surname: n.surname, initial: n.initial, display: n.display, orgs: new Set(org ? [org] : []), records: [r.record], recordKeys: new Set([recKey]) });
    }
  }
  const orgDisplay = new Map<string, string>();
  for (const r of raws) if (r.org) orgDisplay.set(r.org.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40), r.org);
  return groups.map((g, i) => ({
    id: `inv:${slugify(g.display) || g.surname}-${i + 1}`,
    displayName: g.display,
    organizations: [...g.orgs].map((o) => orgDisplay.get(o) ?? o),
    records: g.records,
    conditionIds: uniq(g.records.flatMap((r) => r.conditionIds)),
    roadIds: [],
    clusterIds: [],
    isBridge: false,
  }));
}

