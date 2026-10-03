import Link from "next/link";
import { RoadDot } from "./Badges";

export function VariantNotice({ geneSymbol, mechanism }: { geneSymbol: string; mechanism: string }) {
  return (
    <div className="border-l-2 border-line-2 pl-3 text-sm text-ink-2 max-w-3xl">
      <span className="text-ink font-medium">Before relying on the mechanism: </span>
      {mechanism === "undetermined"
        ? `the curated source has not established how ${geneSymbol} variants cause this condition. `
        : `“${mechanism}” is recorded for the gene and disease as a whole, not for any one family's variant. `}
      An individual variant can act differently (loss of function, gain of function or dominant negative). Ask a clinical geneticist whether your variant&apos;s class has been established before acting on anything that depends on it.
    </div>
  );
}

export function SameGeneNotice({ conditions }: { conditions: { id: string; name: string; roadLabel: string; href: string; roadId: string }[] }) {
  return (
    <div className="text-sm text-ink-2 max-w-3xl">
      <span className="text-ink font-medium">Same gene, different mechanism: </span>
      {conditions.map((c, i) => (
        <span key={c.id}>
          {i > 0 && "; "}
          <Link href={c.href} className="underline">
            {c.name}
          </Link>{" "}
          <span className="whitespace-nowrap">
            (<RoadDot roadId={c.roadId} /> {c.roadLabel})
          </span>
        </span>
      ))}
      . The curated source treats these as separate conditions, and so does Slipstream.
    </div>
  );
}
