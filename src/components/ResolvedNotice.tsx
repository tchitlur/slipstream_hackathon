"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Inner({ shown }: { shown: string }) {
  const sp = useSearchParams();
  const via = sp.get("via");
  const q = sp.get("q");
  if (!via) return null;
  return (
    <div className="border border-[#93c5fd] bg-ahead-bg text-ahead rounded-md px-3 py-2 text-sm">
      Showing <strong>{shown}</strong> for “{q ?? via}”: the search matched the recorded name “{via}”.
    </div>
  );
}

/** "Showing X for 'query'": visible synonym resolution (SPEC 10.2). Reads ?via= and ?q= on the client so pages stay static. */
export function ResolvedNotice({ shown }: { shown: string }) {
  return (
    <Suspense fallback={null}>
      <Inner shown={shown} />
    </Suspense>
  );
}
