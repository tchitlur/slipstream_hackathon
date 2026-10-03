export function fmtStatus(s: string) {
  return s.toLowerCase().replace(/_/g, " ");
}
export function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}
export function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}
export function humanAllelic(raw: string) {
  return raw.replace(/_/g, " ").replace("monoallelic autosomal", "one copy affected (autosomal)").replace("biallelic autosomal", "both copies affected (autosomal)").replace("monoallelic X hemizygous", "one copy affected (X-linked, typically males)").replace("monoallelic X heterozygous", "one copy affected (X-linked, typically females)").replace("monoallelic X", "one copy affected (X-linked)");
}
