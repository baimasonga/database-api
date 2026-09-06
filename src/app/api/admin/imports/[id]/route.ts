import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export const GET = withPermission(PERMISSIONS.IMPORT_READ, async (_user, _request, params) => {
  const id = params.id;
  const job = await prisma.importJob.findUnique({
    where: { id },
    include: {
      dataSource: true,
      dataset: true,
      reportingPeriod: true,
      file: true,
      fieldMappings: { orderBy: { sourceColumn: "asc" } },
      approvalRequests: { orderBy: { createdAt: "desc" }, include: { actions: { orderBy: { createdAt: "desc" } } } },
      publications: { orderBy: { publishedAt: "desc" } },
    },
  });
  if (!job) return ApiError.notFound("Import job not found.");

  const [findings, severityCounts] = await Promise.all([
    prisma.validationResult.findMany({
      where: { importJobId: id },
      orderBy: [{ severity: "asc" }, { rowNumber: "asc" }],
      take: 200,
    }),
    prisma.validationResult.groupBy({
      by: ["severity", "resolved"],
      where: { importJobId: id },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({ data: { job, findings, severityCounts } });
});
