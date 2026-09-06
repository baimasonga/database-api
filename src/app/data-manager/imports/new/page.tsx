import Link from "next/link";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { NewImportForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewImportPage() {
  const [sources, datasets, periods] = await Promise.all([
    prisma.dataSource.findMany({ where: { archivedAt: null, status: { not: "inactive" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.dataset.findMany({ where: { archivedAt: null, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, dataSourceId: true, domain: true } }),
    prisma.reportingPeriod.findMany({ where: { status: { in: ["open", "planned"] } }, orderBy: { startDate: "desc" }, select: { id: true, code: true, name: true } }),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/data-manager/imports" className="text-xs text-[color:var(--color-avdp-700)] hover:underline">
          ← Imports
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">New import</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Choose a source, dataset and reporting period, then upload the file. The file is profiled on upload; you map
          columns and validate before anything can be approved.
        </p>
      </div>

      <NewImportForm
        sources={sources}
        datasets={datasets}
        periods={periods}
        maxBytes={env.uploadMaxBytes()}
        allowedExtensions={env.uploadAllowedExtensions()}
      />
    </div>
  );
}
