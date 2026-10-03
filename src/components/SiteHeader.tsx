import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="serif text-xl text-ink no-underline hover:underline">
          Slipstream
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm text-ink-2">
          <Link href="/map" className="hover:underline">Map</Link>
          <Link href="/method" className="hover:underline">Method</Link>
        </nav>
      </div>
    </header>
  );
}
