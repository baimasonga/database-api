"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  sources: Array<{ id: string; name: string }>;
  datasets: Array<{ id: string; name: string; dataSourceId: string; domain: string }>;
  periods: Array<{ id: string; code: string; name: string }>;
  maxBytes: number;
  allowedExtensions: string[];
}

export function NewImportForm({ sources, datasets, periods, maxBytes, allowedExtensions }: Props) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const availableDatasets = useMemo(
    () => datasets.filter((d) => d.dataSourceId === sourceId),
    [datasets, sourceId],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a CSV or Excel file to upload.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`File exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB limit.`);
      return;
    }

    setBusy(true);
    const response = await fetch("/api/admin/imports", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(body?.error?.message ?? "The upload could not be processed.");
      return;
    }
    router.push(`/data-manager/imports/${body.data.importJobId}`);
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4">
      <label className="block">
        <span className="label">Data source</span>
        <select name="dataSourceId" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="input mt-1" required>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label">Dataset</span>
        <select name="datasetId" className="input mt-1" required>
          {availableDatasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name} ({dataset.domain})
            </option>
          ))}
        </select>
        {availableDatasets.length === 0 ? (
          <span className="mt-1 block text-xs text-amber-700">
            This source has no registered datasets yet. Register one before importing.
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="label">Reporting period</span>
        <select name="reportingPeriodId" className="input mt-1" required>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.code} — {period.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label">File</span>
        <input
          name="file"
          type="file"
          accept={allowedExtensions.map((e) => `.${e}`).join(",")}
          required
          className="input mt-1 file:mr-3 file:rounded file:border-0 file:bg-[color:var(--color-avdp-100)] file:px-3 file:py-1 file:text-sm"
        />
        <span className="mt-1 block text-xs text-[color:var(--color-ink-400)]">
          {allowedExtensions.join(", ")} · up to {Math.floor(maxBytes / (1024 * 1024))} MB. Executable files are rejected.
        </span>
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div>
        <button type="submit" disabled={busy || availableDatasets.length === 0} className="btn-primary">
          {busy ? "Uploading and profiling…" : "Upload and profile"}
        </button>
      </div>
    </form>
  );
}
