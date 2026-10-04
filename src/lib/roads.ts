import type { Mechanism } from "./schemas";

export type AllelicClass = "monoallelic" | "biallelic" | "other";

/** Simplify a Gene2Phenotype allelic requirement to the two classes used for roads. The raw value is kept on the condition. */
export function allelicClassOf(raw: string): AllelicClass {
  const r = raw.toLowerCase();
  if (r.startsWith("monoallelic")) return "monoallelic";
  if (r.startsWith("biallelic")) return "biallelic";
  return "other";
}

export const MECHANISM_KEY: Record<Mechanism, string> = {
  "loss of function": "lof",
  "gain of function": "gof",
  "dominant negative": "dn",
  "undetermined non-loss-of-function": "nonlof",
  undetermined: "undetermined",
};

export type RoadDef = {
  id: string;
  label: string;
  description: string;
  allelicClass: AllelicClass | "any";
  mechanism: Mechanism;
  color: string;
};

/** Road definitions from SPEC section 7.1. Colors are used consistently everywhere (section 10.9). */
export const ROADS: RoadDef[] = [
  {
    id: "road:monoallelic:lof",
    label: "Too little protein: one copy is lost",
    description: "One of the two gene copies no longer makes working protein, and the remaining copy is not enough (haploinsufficiency).",
    allelicClass: "monoallelic",
    mechanism: "loss of function",
    color: "#2563eb",
  },
  {
    id: "road:biallelic:lof",
    label: "Protein missing: both copies are lost",
    description: "Both gene copies are affected, so little or no working protein is made (recessive loss of function).",
    allelicClass: "biallelic",
    mechanism: "loss of function",
    color: "#0f766e",
  },
  {
    id: "road:other:lof",
    label: "Too little protein: unusual inheritance",
    description: "Loss of function with an inheritance pattern that is neither simple monoallelic nor biallelic (for example mitochondrial).",
    allelicClass: "other",
    mechanism: "loss of function",
    color: "#64748b",
  },
  {
    id: "road:any:gof",
    label: "Protein is overactive or does something new",
    description: "The altered protein works too much or in a new way (gain of function). Treatments that raise protein output would point the wrong way.",
    allelicClass: "any",
    mechanism: "gain of function",
    color: "#dc2626",
  },
  {
    id: "road:any:dn",
    label: "A faulty protein interferes with the normal one",
    description: "The altered protein is made, and it disrupts the working protein from the other copy (dominant negative).",
    allelicClass: "any",
    mechanism: "dominant negative",
    color: "#d97706",
  },
  {
    id: "road:any:nonlof",
    label: "Not a simple loss; exact mechanism unsettled",
    description: "Curators are confident the mechanism is not simple loss of function, but have not settled which other mechanism applies.",
    allelicClass: "any",
    mechanism: "undetermined non-loss-of-function",
    color: "#7c3aed",
  },
  {
    id: "road:any:undetermined",
    label: "Mechanism not established",
    description: "The curated source does not yet state how variants in this gene cause this condition.",
    allelicClass: "any",
    mechanism: "undetermined",
    color: "#9ca3af",
  },
];

export function roadIdFor(allelicRaw: string, mechanism: Mechanism): string {
  const cls = allelicClassOf(allelicRaw);
  if (mechanism === "loss of function") return `road:${cls}:lof`;
  return `road:any:${MECHANISM_KEY[mechanism]}`;
}

export function roadById(id: string): RoadDef | undefined {
  return ROADS.find((r) => r.id === id);
}

/** Direction class used for the mechanism relation and transfer rules. */
export type DirectionClass = "loss" | "gain_like" | "unknown";
export function directionOf(m: Mechanism): DirectionClass {
  if (m === "loss of function") return "loss";
  if (m === "gain of function" || m === "dominant negative") return "gain_like";
  return "unknown";
}

export type MechanismRelation = "same road" | "different road" | "opposite direction" | "unknown" | "contested";

/** Section 9.3: opposite direction means one is loss of function and the other is gain of function or dominant negative. */
type Flagged = { roadId: string; mechanism: Mechanism; contested?: { kind?: "contested" | "both_directions" | "different_mechanism" } | null };
/** Only a genuine same-variant-class dispute makes the relation "contested"; "both directions reported" keeps the curated relation and is surfaced as a counter-reason instead. */
export function isContested(c: Flagged) {
  return Boolean(c.contested && (c.contested.kind ?? "contested") === "contested");
}
export function mechanismRelation(a: Flagged, b: Flagged, opts: { ignoreContested?: boolean } = {}): MechanismRelation {
  const da = directionOf(a.mechanism);
  const db = directionOf(b.mechanism);
  // Two conditions with no established mechanism share a road label but not a therapeutic logic.
  if (da === "unknown" || db === "unknown") return "unknown";
  if (!opts.ignoreContested && (isContested(a) || isContested(b))) return "contested";
  if (a.roadId === b.roadId) return "same road";
  if (da !== db) return "opposite direction";
  return "different road";
}
