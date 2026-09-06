import { prisma } from "@/lib/db";
import { Badge, formatDate, formatNumber, statusTone } from "@/components/ui";
import { CONNECTORS } from "@/modules/integrations/registry";

export const dynamic = "force-dynamic";

/**
 * Phase 16 foundation. Connector configuration and run history are modelled and
 * visible; concrete adapters are registered as external API specifications
 * become available. All connector output enters the same ingestion pipeline.
 */
export default async function IntegrationsPage() {
  const [integrations, runs] = await Promise.all([
    prisma.integration.findMany({
      orderBy: { name: "asc" },
      include: { dataSource: { select: { name: true } } },
    }),
    prisma.integrationRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 25,
      include: { integration: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Integrations</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Scheduled and API-based sources. Connector credentials are encrypted at rest and never returned by any API.
          Integrations cannot bypass validation, approval or publication.
        </p>
      </div>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Available connector types</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONNECTORS.map((connector) => (
            <div key={connector.type} className="rounded border border-[color:var(--color-line)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{connector.label}</span>
                <Badge tone={connector.implemented ? "success" : "neutral"}>
                  {connector.implemented ? "available" : "framework only"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-[color:var(--color-ink-600)]">{connector.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Configured integrations</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Data source</th>
              <th>Connector</th>
              <th>Auth</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Last attempt</th>
              <th>Last success</th>
              <th>Last failure</th>
            </tr>
          </thead>
          <tbody>
            {integrations.map((integration) => (
              <tr key={integration.id}>
                <td className="font-medium">{integration.name}</td>
                <td>{integration.dataSource.name}</td>
                <td className="capitalize">{integration.connectorType.replace(/_/g, " ")}</td>
                <td>{integration.authType ?? "—"}</td>
                <td className="font-mono text-xs">{integration.scheduleCron ?? "—"}</td>
                <td>
                  <Badge tone={statusTone(integration.status)}>{integration.status}</Badge>
                </td>
                <td className="whitespace-nowrap">{formatDate(integration.lastAttemptAt)}</td>
                <td className="whitespace-nowrap">{formatDate(integration.lastSuccessAt)}</td>
                <td className="max-w-xs truncate text-xs">{integration.failureMessage ?? "—"}</td>
              </tr>
            ))}
            {integrations.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-[color:var(--color-ink-400)]">
                  No integrations configured. All data currently arrives by manual upload.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Integration runs</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Integration</th>
              <th>Status</th>
              <th className="text-right">Received</th>
              <th className="text-right">Processed</th>
              <th className="text-right">Rejected</th>
              <th>Started</th>
              <th>Completed</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.integration.name}</td>
                <td>
                  <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                </td>
                <td className="text-right tabular-nums">{formatNumber(run.recordsReceived)}</td>
                <td className="text-right tabular-nums">{formatNumber(run.recordsProcessed)}</td>
                <td className="text-right tabular-nums">{formatNumber(run.recordsRejected)}</td>
                <td className="whitespace-nowrap">{formatDate(run.startedAt)}</td>
                <td className="whitespace-nowrap">{formatDate(run.completedAt)}</td>
                <td className="max-w-xs truncate text-xs">{run.errorSummary ?? "—"}</td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[color:var(--color-ink-400)]">
                  No integration runs recorded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
