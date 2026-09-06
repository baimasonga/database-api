"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";

interface Finding {
  id: string;
  rowNumber: number | null;
  fieldName: string | null;
  ruleCode: string;
  category: string;
  severity: string;
  message: string;
  rawValue: string | null;
  suggestedValue: string | null;
  resolved: boolean;
}

const RESOLUTIONS = [
  { value: "corrected_at_source", label: "Corrected at source" },
  { value: "accepted_with_warning", label: "Accepted with warning" },
  { value: "not_an_issue", label: "Not an issue" },
  { value: "record_excluded", label: "Record excluded" },
];

/** Issue review interface. Resolving records a decision; it never rewrites the
 *  underlying raw value. */
export function FindingsTable({ findings, canResolve }: { findings: Finding[]; canResolve: boolean }) {
  const router = useRouter();
  const [severity, setSeverity] = useState("all");
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = findings.filter(
    (f) => (severity === "all" || f.severity === severity) && (showResolved || !f.resolved),
  );

  async function resolve(id: string, resolution: string) {
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/admin/validation/${id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.error?.message ?? "The finding could not be resolved.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Validation findings</h2>
        <div className="flex items-center gap-3 text-xs">
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="input w-36 text-xs">
            <option value="all">All severities</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
          </select>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="h-4 w-4" />
            Show resolved
          </label>
        </div>
      </div>

      {error ? <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Row</th>
              <th>Field</th>
              <th>Rule</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Message</th>
              <th>Value</th>
              <th>Suggested</th>
              {canResolve ? <th>Resolve</th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((finding) => (
              <tr key={finding.id} className={finding.resolved ? "opacity-50" : undefined}>
                <td className="tabular-nums">{finding.rowNumber ?? "—"}</td>
                <td className="font-mono text-xs">{finding.fieldName ?? "—"}</td>
                <td className="font-mono text-xs">{finding.ruleCode}</td>
                <td className="text-xs capitalize">{finding.category.replace(/_/g, " ")}</td>
                <td>
                  <Badge tone={finding.severity === "error" ? "danger" : finding.severity === "warning" ? "warning" : "info"}>
                    {finding.severity}
                  </Badge>
                </td>
                <td className="max-w-md">{finding.message}</td>
                <td className="max-w-32 truncate font-mono text-xs">{finding.rawValue ?? "—"}</td>
                <td className="font-mono text-xs">{finding.suggestedValue ?? "—"}</td>
                {canResolve ? (
                  <td>
                    {finding.resolved ? (
                      <span className="text-xs text-[color:var(--color-ink-400)]">resolved</span>
                    ) : (
                      <select
                        defaultValue=""
                        disabled={busyId === finding.id}
                        onChange={(e) => e.target.value && resolve(finding.id, e.target.value)}
                        className="input w-44 text-xs"
                      >
                        <option value="">Choose…</option>
                        {RESOLUTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={canResolve ? 9 : 8} className="text-[color:var(--color-ink-400)]">
                  No findings for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
