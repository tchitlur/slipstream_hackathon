"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type MapNode = { id: string; x: number; y: number; name: string; gene: string; roadId: string; color: string; depth: "deep" | "shallow"; clusterId?: string; href: string };
export type MapCluster = { id: string; label: string; x: number; y: number; size: number };

export function MapCanvas({ nodes, edges, clusters }: { nodes: MapNode[]; edges: [string, string, number][]; clusters: MapCluster[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [hover, setHover] = useState<MapNode | null>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [focusIdx, setFocusIdx] = useState(-1);

  const bounds = useMemo(() => {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [nodes]);
  const pad = 40;
  const proj = (x: number, y: number) => ({
    px: pad + ((x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * (size.w - 2 * pad),
    py: pad + ((y - bounds.minY) / (bounds.maxY - bounds.minY || 1)) * (size.h - 2 * pad),
  });
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: Math.max(420, Math.min(720, el.clientWidth * 0.66)) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = "rgba(28,26,23,0.10)";
    for (const [a, b] of edges) {
      const na = byId.get(a);
      const nb = byId.get(b);
      if (!na || !nb) continue;
      const pa = proj(na.x, na.y);
      const pb = proj(nb.x, nb.y);
      ctx.beginPath();
      ctx.moveTo(pa.px, pa.py);
      ctx.lineTo(pb.px, pb.py);
      ctx.stroke();
    }
    for (const n of nodes) {
      const { px, py } = proj(n.x, n.y);
      const r = n.depth === "deep" ? 5 : 3;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.globalAlpha = n.depth === "deep" ? 0.95 : 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (hover?.id === n.id || nodes[focusIdx]?.id === n.id) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#1c1a17";
        ctx.stroke();
      }
    }
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(28,26,23,0.75)";
    for (const c of clusters) {
      const { px, py } = proj(c.x, c.y);
      ctx.fillText(c.label, px + 6, py - 6);
    }
    if (nodes.length <= 400) {
      ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "rgba(28,26,23,0.65)";
      for (const n of nodes.filter((n) => n.depth === "deep")) {
        const { px, py } = proj(n.x, n.y);
        ctx.fillText(n.gene, px + 6, py + 3);
      }
    }
  });

  const pick = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: MapNode | null = null;
    let bd = 10;
    for (const n of nodes) {
      const { px, py } = proj(n.x, n.y);
      const d = Math.hypot(px - x, py - y);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  };

  const active = hover ?? nodes[focusIdx] ?? null;
  return (
    <div ref={wrap} className="relative">
      <canvas
        ref={ref}
        style={{ width: size.w, height: size.h }}
        className="border border-line rounded-md bg-white/60 cursor-crosshair focus:outline-2 focus:outline-accent"
        tabIndex={0}
        role="img"
        aria-label={`Cluster map of ${nodes.length} conditions. Use arrow keys to move between conditions and Enter to open one.`}
        onMouseMove={(e) => setHover(pick(e.clientX, e.clientY))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const n = pick(e.clientX, e.clientY);
          if (n) router.push(n.href);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            setFocusIdx((i) => Math.min(nodes.length - 1, i + 1));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            setFocusIdx((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter" && nodes[focusIdx]) router.push(nodes[focusIdx].href);
        }}
      />
      {active && (
        <div className="absolute left-2 bottom-2 bg-paper border border-line-2 rounded px-3 py-2 text-sm shadow pointer-events-none max-w-xs">
          <div className="font-medium flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: active.color }} /> {active.gene}
          </div>
          <div className="text-ink-2 text-xs">{active.name}</div>
          <div className="text-muted text-xs">{active.depth === "shallow" ? "mechanism and symptoms only" : "deep slice"} · click to open</div>
        </div>
      )}
    </div>
  );
}
