"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  integrationId: string;
  canRun: boolean;
  implemented: boolean;
  datasets: Array<{ id: string; name: string }>;
  periods: Array<{ id: string; code: string }>;
}

/**
 * Test Connection and Run Now. A run lands data in the raw layer and validates
 * it; approval and publication remain separate human decisions.
 */
export function IntegrationActions({ integrationId, canRun, implemented, datasets, periods }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"test" | "run" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");

  async function test() {
    setBusy("test");
    setMessage(null);
    const response = await fetch(`/api/admin/integrations/${integrationId}/test`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    setMessage(
      response.ok
        ? { tone: body.data?.ok ? "ok" : "error", text: body.data?.message ?? "" }
        : { tone: "error", text: body?.error?.message ?? "The connection test could not be run." },
    );
    router.refresh();
  }

  async function run() {
    if (!datasetId || !periodId) {
      setMessage({ tone: "error", text: "Choose a dataset and reporting period first." });
      return;
    }
    setBusy("run");
    setMessage(null);
    const response = await fetch(`/api/admin/integrations/${integrationId}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ datasetId, reportingPeriodId: periodId }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    setMessage(
      response.ok
        ? { tone: body.data?.status === "failed" ? "error" : "ok", text: body.data?.message ?? "" }
        : { tone: "error", text: body?.error?.message ?? "The run could not be started." },
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={test} disabled={busy !== null} className="btn-secondary">
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>

        {canRun && implemented ? (
          <>
            <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} className="input w-48 text-xs">
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="input w-32 text-xs">
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
            <button type="button" onClick={run} disabled={busy !== null || datasets.length === 0} className="btn-primary">
              {busy === "run" ? "Running…" : "Run now"}
            </button>
          </>
        ) : null}
      </div>

      {!implemented ? (
        <p className="text-xs text-[color:var(--color-ink-400)]">
          This connector type is framework-only; no adapter is registered yet.
        </p>
      ) : null}

      {message ? (
        <p className={`text-xs ${message.tone === "ok" ? "text-[color:var(--color-avdp-700)]" : "text-red-700"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
