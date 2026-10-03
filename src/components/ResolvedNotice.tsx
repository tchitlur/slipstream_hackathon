export function ResolvedNotice({ via, q, shown }: { via?: string; q?: string; shown: string }) {
  if (!via) return null;
  return (
    <div className="border border-[#93c5fd] bg-ahead-bg text-ahead rounded-md px-3 py-2 text-sm">
      Showing <strong>{shown}</strong> for “{q ?? via}”: the search matched the recorded name “{via}”.
    </div>
  );
}
