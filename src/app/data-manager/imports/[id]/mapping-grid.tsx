"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface MappingRow {
  sourceColumn: string;
  canonicalField: string | null;
  isRequired: boolean;
  detectedType: string;
  sampleValues: string[];
  completenessPercent: number | null;
  status: string;
}

interface Props {
  importJobId: string;
  canEdit: boolean;
  canonicalFields: Array<{ key: string; label: string; required: boolean }>;
  rows: MappingRow[];
}

/** Data Mapping screen: source column → canonical AVDP field, with the
 *  declarative transformation defaults applied by the engine. */
export function MappingGrid({ importJobId, canEdit, canonicalFields, rows }: Props) {
  const router = useRouter();
  const [mappings, setMappings] = useState<MappingRow[]>(rows);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "validate" | null>(null);
  const [templateCode, setTemplateCode] = useState("");

  function update(column: string, patch: Partial<MappingRow>) {
    setMappings((prev) => prev.map((m) => (m.sourceColumn === column ? { ...m, ...patch } : m)));
  }

  async function save() {
    setBusy("save");
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/admin/imports/${importJobId}/mappings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mappings: mappings.map((m) => ({
          sourceColumn: m.sourceColumn,
          canonicalField: m.canonicalField,
          isRequired: m.isRequired,
          transformations: [],
        })),
        ...(templateCode
          ? { saveAsTemplate: { code: templateCode.toUpperCase(), name: `${templateCode} mapping template` } }
          : {}),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(body?.error?.message ?? "Mappings could not be saved.");
      return;
    }
    setMessage(`Saved ${body.data.updated} column mappings.`);
    router.refresh();
  }

  async function validate() {
    setBusy("validate");
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/admin/imports/${importJobId}/validate`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(body?.error?.message ?? "Validation could not be run.");
      return;
    }
    const outcome = body.data;
    setMessage(
      outcome.status === "mapping_required"
        ? `Mapping incomplete: ${(outcome.mappingIssues ?? []).join("; ")}`
        : `Validation complete — ${outcome.errorCount} error(s), ${outcome.warningCount} warning(s), ${outcome.validRows} valid rows.`,
    );
    router.refresh();
  }

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Data mapping</h2>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              placeholder="Save as template code (optional)"
              className="input w-64 text-xs"
            />
            <button type="button" onClick={save} disabled={busy !== null} className="btn-secondary">
              {busy === "save" ? "Saving…" : "Save mapping"}
            </button>
            <button type="button" onClick={validate} disabled={busy !== null} className="btn-primary">
              {busy === "validate" ? "Validating…" : "Validate"}
            </button>
          </div>
        ) : (
          <span className="text-xs text-[color:var(--color-ink-400)]">Mappings are locked after approval.</span>
        )}
      </div>

      {message ? <p className="mb-3 rounded bg-[color:var(--color-avdp-50)] px-3 py-2 text-sm">{message}</p> : null}
      {error ? <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Source column</th>
              <th>Sample values</th>
              <th>Detected type</th>
              <th className="text-right">Complete</th>
              <th>Canonical field</th>
              <th>Required</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((row) => (
              <tr key={row.sourceColumn}>
                <td className="font-mono text-xs">{row.sourceColumn}</td>
                <td className="max-w-xs truncate text-xs text-[color:var(--color-ink-600)]">
                  {row.sampleValues.slice(0, 3).join(", ") || "—"}
                </td>
                <td className="text-xs capitalize">{row.detectedType}</td>
                <td className="text-right text-xs tabular-nums">
                  {row.completenessPercent === null ? "—" : `${row.completenessPercent}%`}
                </td>
                <td>
                  <select
                    disabled={!canEdit}
                    value={row.canonicalField ?? ""}
                    onChange={(e) => update(row.sourceColumn, { canonicalField: e.target.value || null })}
                    className="input min-w-56 text-xs"
                  >
                    <option value="">— not mapped —</option>
                    {canonicalFields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label} ({field.key})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    disabled={!canEdit || !row.canonicalField}
                    checked={row.isRequired}
                    onChange={(e) => update(row.sourceColumn, { isRequired: e.target.checked })}
                    className="h-4 w-4"
                  />
                </td>
                <td className="text-xs capitalize">{row.canonicalField ? row.status : "unmapped"}</td>
              </tr>
            ))}
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-[color:var(--color-ink-400)]">
                  No columns detected in this file.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
