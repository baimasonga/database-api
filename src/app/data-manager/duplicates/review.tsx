"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";

interface Person {
  id: string;
  avdpReference: string | null;
  fullName: string;
  sex: string;
  phone: string | null;
}

interface Candidate {
  id: string;
  matchType: string;
  ruleCode: string;
  score: number;
  primary: Person;
  candidate: Person;
}

export function DuplicateReview({ candidates, canMerge }: { candidates: Candidate[]; canMerge: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(id: string, decision: "merge" | "reject", survivor: "primary" | "candidate" = "primary") {
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/admin/duplicates/${id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, survivor }),
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.error?.message ?? "The review could not be recorded.");
      return;
    }
    router.refresh();
  }

  const describe = (person: Person) =>
    `${person.fullName} · ${person.sex}${person.phone ? ` · ${person.phone}` : ""}${person.avdpReference ? ` · ${person.avdpReference}` : ""}`;

  return (
    <section className="card">
      <h2 className="mb-3 text-sm font-semibold">Potential duplicates</h2>
      {error ? <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <ul className="flex flex-col gap-3">
        {candidates.map((candidate) => (
          <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-line)] pb-3 last:border-0">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{describe(candidate.primary)}</p>
              <p className="text-[color:var(--color-ink-600)]">{describe(candidate.candidate)}</p>
              <p className="mt-1 flex items-center gap-2 text-xs">
                <Badge tone={candidate.matchType === "deterministic" ? "success" : "warning"}>{candidate.matchType}</Badge>
                <span className="font-mono">{candidate.ruleCode}</span>
                <span>similarity {(candidate.score * 100).toFixed(0)}%</span>
              </p>
            </div>
            {canMerge ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busyId === candidate.id} onClick={() => review(candidate.id, "merge", "primary")} className="btn-primary">
                  Merge into first
                </button>
                <button type="button" disabled={busyId === candidate.id} onClick={() => review(candidate.id, "merge", "candidate")} className="btn-secondary">
                  Merge into second
                </button>
                <button type="button" disabled={busyId === candidate.id} onClick={() => review(candidate.id, "reject")} className="btn-danger">
                  Not a duplicate
                </button>
              </div>
            ) : (
              <span className="text-xs text-[color:var(--color-ink-400)]">Review requires the beneficiary.merge permission.</span>
            )}
          </li>
        ))}
        {candidates.length === 0 ? (
          <li className="text-sm text-[color:var(--color-ink-400)]">No potential duplicates awaiting review.</li>
        ) : null}
      </ul>
    </section>
  );
}
