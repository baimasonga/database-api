"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for unexpected dashboard failures. Data-availability
 * problems are handled per section; anything reaching here is a defect, so the
 * page says so plainly rather than showing figures of unknown provenance.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="card max-w-lg text-center">
        <h1 className="text-lg font-semibold text-[color:var(--color-avdp-900)]">The dashboard could not be loaded</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-600)]">
          An unexpected error occurred. No figures are shown, because their accuracy cannot be confirmed.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-[color:var(--color-ink-400)]">Reference: {error.digest}</p>
        ) : null}
        <button type="button" onClick={reset} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    </div>
  );
}
