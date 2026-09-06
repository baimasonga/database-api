"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/ui";

const ACTION_LABELS: Record<string, string> = {
  submit: "Submit for Review",
  start_review: "Start Review",
  return_for_correction: "Return for Correction",
  approve: "Approve",
  reject: "Reject",
  publish: "Publish",
  unpublish: "Unpublish",
  withdraw: "Withdraw",
};

interface Props {
  importJobId: string;
  status: string;
  actions: string[];
  unresolvedErrors: number;
  history: Array<{
    id: string;
    action: string;
    actor: string;
    previousStatus: string | null;
    newStatus: string | null;
    comment: string | null;
    createdAt: string;
  }>;
  publications: Array<{ id: string; status: string; publishedAt: string; rows: number }>;
}

export function WorkflowPanel({ importJobId, status, actions, unresolvedErrors, history, publications }: Props) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(action);
    setError(null);
    const response = await fetch(`/api/admin/imports/${importJobId}/workflow`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, comment: comment || undefined }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(body?.error?.message ?? "The action could not be completed.");
      return;
    }
    setComment("");
    router.refresh();
  }

  return (
    <section className="card">
      <h2 className="mb-3 text-sm font-semibold">Approval workflow</h2>

      <p className="mb-3 text-sm text-[color:var(--color-ink-600)]">
        Current status <Badge tone={statusTone(status)}>{status.replace(/_/g, " ")}</Badge>
        {unresolvedErrors > 0 ? (
          <span className="ml-2 text-red-700">
            {unresolvedErrors} unresolved error(s) block approval and publication.
          </span>
        ) : null}
      </p>

      {actions.length > 0 ? (
        <div className="mb-4 flex flex-col gap-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Comment (recorded in the audit trail)"
            className="input"
          />
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => run(action)}
                disabled={busy !== null}
                className={["reject", "return_for_correction", "unpublish"].includes(action) ? "btn-danger" : "btn-primary"}
              >
                {busy === action ? "Working…" : (ACTION_LABELS[action] ?? action)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mb-4 text-sm text-[color:var(--color-ink-400)]">
          No workflow actions are available to you at this status.
        </p>
      )}

      {error ? <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="label mb-2">Action history</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="border-b border-[color:var(--color-line)] pb-2 last:border-0">
                <span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>{" "}
                <span className="text-xs text-[color:var(--color-ink-600)]">
                  by {entry.actor} · {entry.previousStatus} → {entry.newStatus} ·{" "}
                  {new Date(entry.createdAt).toLocaleString("en-GB")}
                </span>
                {entry.comment ? <p className="mt-0.5 text-xs italic text-[color:var(--color-ink-600)]">“{entry.comment}”</p> : null}
              </li>
            ))}
            {history.length === 0 ? <li className="text-[color:var(--color-ink-400)]">Not yet submitted for review.</li> : null}
          </ul>
        </div>

        <div>
          <h3 className="label mb-2">Publication history</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {publications.map((publication) => (
              <li key={publication.id} className="flex items-baseline justify-between gap-2">
                <Badge tone={statusTone(publication.status)}>{publication.status}</Badge>
                <span className="text-xs text-[color:var(--color-ink-600)]">
                  {publication.rows.toLocaleString("en-GB")} rows ·{" "}
                  {new Date(publication.publishedAt).toLocaleString("en-GB")}
                </span>
              </li>
            ))}
            {publications.length === 0 ? <li className="text-[color:var(--color-ink-400)]">Never published.</li> : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
