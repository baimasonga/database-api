import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]{2,49}$/, "Code must be upper-case letters, digits and hyphens."),
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  ownerUnit: z.string().trim().max(120).optional(),
  sourceType: z.enum(["excel", "csv", "database", "api", "odk", "kobo", "manual", "gis", "other"]),
  connectionType: z.enum(["upload", "api", "database", "scheduled", "manual"]),
  frequency: z.enum(["ad_hoc", "daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]).default("ad_hoc"),
  status: z.enum(["active", "inactive", "attention_required"]).default("active"),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
  contactPerson: z.string().trim().max(160).optional(),
  contactEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  containsPersonalData: z.boolean().default(false),
  repositoryLocation: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const GET = withPermission(PERMISSIONS.SOURCE_READ, async (_user, request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const sources = await prisma.dataSource.findMany({
    where: {
      archivedAt: null,
      ...(status && ["active", "inactive", "attention_required"].includes(status)
        ? { status: status as "active" | "inactive" | "attention_required" }
        : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { datasets: true, importJobs: true } } },
  });
  return NextResponse.json({ data: sources });
});

export const POST = withPermission(PERMISSIONS.SOURCE_WRITE, async (user, request) => {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return ApiError.badRequest("Invalid data source.", parsed.error.flatten().fieldErrors);

  const existing = await prisma.dataSource.findUnique({ where: { code: parsed.data.code } });
  if (existing) return ApiError.conflict(`Data source code "${parsed.data.code}" is already in use.`);

  const source = await prisma.dataSource.create({
    data: {
      ...parsed.data,
      contactEmail: parsed.data.contactEmail || null,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });
  await recordAudit(user, { action: "source.create", entityType: "data_source", entityId: source.id, summary: source.name }, request);
  return NextResponse.json({ data: source }, { status: 201 });
});
