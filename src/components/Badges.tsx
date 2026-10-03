import type { Evidence } from "@/lib/schemas";
import { roadById } from "@/lib/roads";

export const KIND_LABEL: Record<Evidence["kind"], string> = {
  curated: "Curated record",
  extracted: "Quoted from source",
  computed: "Calculated",
  hypothesis: "Hypothesis, needs expert review",
};

const KIND_STYLE: Record<Evidence["kind"], string> = {
  curated: "bg-paper-2 text-ink-2 border-line-2",
  extracted: "bg-[#eef4ff] text-[#1e3a8a] border-[#c7d7fe]",
  computed: "bg-[#f3f0ff] text-[#4c1d95] border-[#ddd6fe]",
  hypothesis: "bg-warn-bg text-warn border-[#fdba74]",
};

const KIND_GLYPH: Record<Evidence["kind"], string> = { curated: "▣", extracted: "❝", computed: "∑", hypothesis: "?" };

export function KindBadge({ kind, small }: { kind: Evidence["kind"]; small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 ${small ? "text-[11px] py-0" : "text-xs py-0.5"} ${KIND_STYLE[kind]}`}>
      <span aria-hidden>{KIND_GLYPH[kind]}</span>
      {KIND_LABEL[kind]}
    </span>
  );
}

export function RoadBadge({ roadId, size = "md" }: { roadId: string; size?: "sm" | "md" }) {
  const road = roadById(roadId);
  if (!road) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${size === "sm" ? "text-xs" : "text-sm"} text-ink-2`}>
      <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: road.color }} />
      <span>{road.label}</span>
    </span>
  );
}

export function RoadDot({ roadId, title }: { roadId: string; title?: string }) {
  const road = roadById(roadId);
  return <span aria-label={title ?? road?.label} title={title ?? road?.label} className="inline-block w-3 h-3 rounded-full shrink-0 align-middle" style={{ background: road?.color ?? "#999" }} />;
}

export function Chip({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "stop" | "info"; title?: string }) {
  const cls = {
    neutral: "bg-paper-2 text-ink-2 border-line-2",
    ok: "bg-ok-bg text-ok border-[#86efac]",
    warn: "bg-warn-bg text-warn border-[#fdba74]",
    stop: "bg-stop-bg text-stop border-[#fca5a5]",
    info: "bg-ahead-bg text-ahead border-[#93c5fd]",
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
  );
}
