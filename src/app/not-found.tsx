import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-20 text-center space-y-3">
      <h1 className="text-3xl">Not in the atlas</h1>
      <p className="text-ink-2">That page does not exist or the condition is not in this build.</p>
      <Link href="/" className="underline">Back to search</Link>
    </div>
  );
}
