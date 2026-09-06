"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshAnalyticsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/analytics/refresh", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    const failed = Array.isArray(body?.data) ? body.data.filter((o: { status: string }) => o.status === "failed") : [];
    setMessage(response.ok ? `Refreshed ${body.data.length - failed.length}/${body.data.length} views.` : "Refresh failed.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {message ? <span className="text-xs text-[color:var(--color-ink-600)]">{message}</span> : null}
      <button type="button" onClick={refresh} disabled={busy} className="btn-secondary">
        {busy ? "Refreshing…" : "Refresh analytics"}
      </button>
    </div>
  );
}
