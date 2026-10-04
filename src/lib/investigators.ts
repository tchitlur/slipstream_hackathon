/**
 * Investigator name normalization and the conservative merge rule (SPEC S8): same normalized
 * surname, same first initial, and the same organization or the same linked public record.
 */
import type { Investigator } from "./schemas";
import { slugify, uniq } from "./text";

export function normalizeName(full: string): { surname: string; initial: string; display: string } {
  const s = full
    .replace(/\s+/g, " ")
    .replace(/\b(M\.\s?D\.|Ph\.\s?D\.|D\.\s?O\.|M\.\s?P\.\s?H\.|M\.\s?Sc\.|B\.\s?Sc\.)/gi, " ")
    .replace(/,?\s*\b(MD|PhD|DO|MBBS|MBChB|FRCP|FRCPC|FRCPCH|FAAN|FAAP|FACMG|MPH|MSc|MS|MA|BSc|RN|NP|PharmD|DrPH|DSc|Prof\.?|Professor|Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\b\.?/gi, " ")
    .replace(/\s*,\s*$/, "")
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
  const cap = (w: string) => {
    if (!w) return w;
    if (/^[a-z]+$/.test(w) && /^(de|del|della|der|van|von|da|di|du|la|le|dos|das|el|al|bin|ibn|ter|ten)$/.test(w)) return w;
    const base = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return base.replace(/^(Mc|Mac|O')([a-z])/, (_, p, c) => p + c.toUpperCase());
  };
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

const TITLE_AS_ORG = /\b(director|monitor|professor|investigator|physician|student|chair|president|officer|chief|coordinator|manager|fellow|scientist|consultant|nurse|lead|head|md|phd)\b/i;
/** Organization strings that are really job titles (e.g. "Medical Director", "Principal Investigator") are dropped. */
export function isJobTitle(org: string): boolean {
  const o = org.trim();
  if (!o) return true;
  if (/\b(university|hospital|institute|college|center|centre|clinic|foundation|school|inc\b|ltd|llc|laborator|medical center|health|pharma|therapeutics|biosciences|research|trust|children|department|dept)/i.test(o)) return false;
  return TITLE_AS_ORG.test(o) && o.split(/\s+/).length <= 4;
}

export function mergeInvestigators(raws: RawMention[]): Investigator[] {
  const groups: { key: string; surname: string; initial: string; display: string; orgs: Set<string>; records: Investigator["records"]; recordKeys: Set<string> }[] = [];
  for (const raw of raws) {
    if (!looksLikePerson(raw.name)) continue;
    const n = normalizeName(raw.name);
    if (!n.surname || n.surname.length < 2) continue;
    // A job title ("Professor", "Principal Investigator") is never shown as an organization.
    const r: RawMention = raw.org && isJobTitle(raw.org) ? { ...raw, org: undefined } : raw;
    const org = (r.org ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    const recKey = `${r.record.kind}:${r.record.id}`;
    // Merge on the same surname and initial when the organization matches, the record is shared, or the full name is
    // identical and the two mentions are linked to the same condition.
    const fullKey = n.display.toLowerCase();
    const g = groups.find((g) => g.surname === n.surname && g.initial === n.initial && ((org && g.orgs.has(org)) || g.recordKeys.has(recKey) || (g.display.toLowerCase() === fullKey && g.records.some((x) => x.conditionIds.some((c) => r.record.conditionIds.includes(c))))));
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
  const fellowshipOnly = (g: (typeof groups)[number]) => g.records.length > 0 && g.records.every((r) => r.kind === "grant" && /^[FK]\d\d/.test(r.id));
  // Investigators whose only links are fellowship or career awards (F- and K-series) list after the others.
  groups.sort((a, b) => Number(fellowshipOnly(a)) - Number(fellowshipOnly(b)));
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

