import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { CANONICAL_FIELDS, fieldsForDomain } from "@/modules/mapping/canonical-fields";
import { availableActions, type ImportStatus } from "@/modules/approval/workflow";
import { Badge, KpiCard, formatDate, formatNumber, statusTone } from "@/components/ui";
import { MappingGrid } from "./mapping-grid";
import { WorkflowPanel } from "./workflow-panel";
import { FindingsTable } from "./findings-table";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

interface ColumnProfile {
  name: string;
  detectedType: string;
  nullCount: number;
  completenessPercent: number;
  distinctCount: number;
  sampleValues: string[];
}

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.IMPORT_READ);
  const { id } = await params;
  const [user, job] = await Promise.all([
    getCurrentUser(),
    prisma.importJob.findUnique({
      where: { id },
      include: {
        dataSource: true,
        dataset: true,
        reportingPeriod: true,
        file: true,
        fieldMappings: { orderBy: { sourceColumn: "asc" } },
        approvalRequests: { orderBy: { createdAt: "desc" }, take: 1, include: { actions: { orderBy: { createdAt: "desc" }, include: { actor: { select: { fullName: true } } } } } },
        publications: { orderBy: { publishedAt: "desc" } },
      },
    }),
  ]);
  if (!job) notFound();

  const [findings, unresolvedErrors, unresolvedWarnings] = await Promise.all([
    prisma.validationResult.findMany({
      where: { importJobId: id },
      orderBy: [{ severity: "asc" }, { rowNumber: "asc" }],
      take: 200,
    }),
    prisma.validationResult.count({ where: { importJobId: id, severity: "error", resolved: false } }),
    prisma.validationResult.count({ where: { importJobId: id, severity: "warning", resolved: false } }),
  ]);

  const profileColumns = ((job.profile as { columns?: ColumnProfile[] } | null)?.columns ?? []) as ColumnProfile[];
  const profileByColumn = new Map(profileColumns.map((c) => [c.name, c]));
  const canonicalOptions = fieldsForDomain(job.dataset.domain).length > 0 ? fieldsForDomain(job.dataset.domain) : CANONICAL_FIELDS;

  const actions = user
    ? availableActions({
        currentStatus: job.status as ImportStatus,
        permissions: user.permissions,
        unresolvedErrorCount: unresolvedErrors,
      })
    : [];

  const mappedCount = job.fieldMappings.filter((m) => m.canonicalField).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/data-manager/imports" className="text-xs text-[color:var(--color-avdp-700)] hover:underline">
          ← Imports
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">
            {job.file?.fileName ?? "Import"}
          </h1>
          <Badge tone={statusTone(job.status)}>{job.status.replace(/_/g, " ")}</Badge>
        </div>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          {job.dataSource.name} · {job.dataset.name} · {job.reportingPeriod.code}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Rows" value={formatNumber(job.rowCount)} sub={`${formatNumber(job.columnCount)} columns`} />
        <KpiCard label="Valid rows" value={formatNumber(job.validRowCount)} />
        <KpiCard label="Rows with errors" value={formatNumber(job.errorRowCount)} sub={`${formatNumber(unresolvedErrors)} unresolved findings`} />
        <KpiCard label="Rows with warnings" value={formatNumber(job.warningRowCount)} sub={`${formatNumber(unresolvedWarnings)} unresolved findings`} />
        <KpiCard label="Quality score" value={job.qualityScore ? formatNumber(Number(job.qualityScore), 1) : "—"} unit={job.qualityScore ? "/ 100" : undefined} />
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">File</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
          {[
            ["File name", job.file?.fileName ?? "—"],
            ["Size", job.file ? `${(job.file.sizeBytes / 1024).toFixed(1)} KB` : "—"],
            ["Type", job.file?.mimeType ?? "—"],
            ["Checksum (SHA-256)", job.file ? `${job.file.checksumSha256.slice(0, 16)}…` : "—"],
            ["Uploaded", formatDate(job.file?.uploadedAt)],
            ["Reporting period", `${job.reportingPeriod.code} (${formatDate(job.reportingPeriod.startDate)} – ${formatDate(job.reportingPeriod.endDate)})`],
            ["Duplicate rows in file", formatNumber(job.duplicateRowCount)],
            ["Mapped columns", `${mappedCount} / ${job.fieldMappings.length}`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="label">{label}</dt>
              <dd className="mt-0.5 break-words font-mono text-xs">{value}</dd>
            </div>
          ))}
        </dl>
        {job.file ? (
          <a href={`/api/admin/imports/${job.id}/file`} className="btn-secondary mt-4">
            Download original file
          </a>
        ) : null}
      </section>

      <MappingGrid
        importJobId={job.id}
        canEdit={!["approved", "published"].includes(job.status)}
        canonicalFields={canonicalOptions.map((f) => ({ key: f.key, label: f.label, required: f.required }))}
        rows={job.fieldMappings.map((m) => ({
          sourceColumn: m.sourceColumn,
          canonicalField: m.canonicalField,
          isRequired: m.isRequired,
          detectedType: m.detectedType ?? profileByColumn.get(m.sourceColumn)?.detectedType ?? "string",
          sampleValues: (m.sampleValues as string[] | null) ?? profileByColumn.get(m.sourceColumn)?.sampleValues ?? [],
          completenessPercent: profileByColumn.get(m.sourceColumn)?.completenessPercent ?? null,
          status: m.status,
        }))}
      />

      <FindingsTable
        findings={findings.map((f) => ({
          id: f.id,
          rowNumber: f.rowNumber,
          fieldName: f.fieldName,
          ruleCode: f.ruleCode,
          category: f.category,
          severity: f.severity,
          message: f.message,
          rawValue: f.rawValue,
          suggestedValue: f.suggestedValue,
          resolved: f.resolved,
        }))}
        canResolve={user?.permissions.includes("quality.resolve") ?? false}
      />

      <WorkflowPanel
        importJobId={job.id}
        status={job.status}
        actions={actions}
        unresolvedErrors={unresolvedErrors}
        history={(job.approvalRequests[0]?.actions ?? []).map((a) => ({
          id: a.id,
          action: a.action,
          actor: a.actor?.fullName ?? "system",
          previousStatus: a.previousStatus,
          newStatus: a.newStatus,
          comment: a.comment,
          createdAt: a.createdAt.toISOString(),
        }))}
        publications={job.publications.map((p) => ({
          id: p.id,
          status: p.status,
          publishedAt: p.publishedAt.toISOString(),
          rows: p.publishedRowCount,
        }))}
      />
    </div>
  );
}
