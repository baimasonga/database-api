import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { encryptSecret, redactIntegration, secretsConfigured, SecretKeyMissing } from "@/modules/integrations/secrets";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  dataSourceId: z.string().uuid(),
  code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]{2,49}$/, "Code must be upper-case letters, digits and hyphens."),
  name: z.string().trim().min(3).max(160),
  connectorType: z.enum(["rest_api", "database", "odk", "webhook", "scheduled_file"]),
  authType: z.string().trim().max(40).optional(),
  baseUrl: z.string().trim().url().max(500).optional(),
  scheduleCron: z.string().trim().max(120).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  /** Credentials, encrypted before storage and never returned. */
  secret: z.record(z.string(), z.unknown()).optional(),
});

export const GET = withPermission(PERMISSIONS.INTEGRATION_READ, async () => {
  const integrations = await prisma.integration.findMany({
    orderBy: { name: "asc" },
    include: { dataSource: { select: { id: true, name: true } } },
  });
  // Redaction happens here, at the single point where a credential could leak.
  return NextResponse.json({ data: integrations.map(redactIntegration) });
});

export const POST = withPermission(PERMISSIONS.INTEGRATION_WRITE, async (user, request) => {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return ApiError.badRequest("Invalid integration.", parsed.error.flatten().fieldErrors);

  const { secret, ...rest } = parsed.data;
  if (secret && !secretsConfigured()) {
    return ApiError.badRequest(
      "INTEGRATION_SECRET_KEY is not configured, so credentials cannot be stored securely. Generate one with `openssl rand -base64 32`.",
    );
  }

  const existing = await prisma.integration.findUnique({ where: { code: rest.code } });
  if (existing) return ApiError.conflict(`Integration code "${rest.code}" is already in use.`);

  const source = await prisma.dataSource.findUnique({ where: { id: rest.dataSourceId } });
  if (!source) return ApiError.badRequest("Unknown data source.");

  try {
    const integration = await prisma.integration.create({
      data: {
        ...rest,
        config: rest.config as object,
        secretCiphertext: secret ? encryptSecret(secret) : null,
        status: "draft",
        createdBy: user.id,
      },
    });
    await recordAudit(
      user,
      {
        action: "integration.create",
        entityType: "integration",
        entityId: integration.id,
        summary: `${integration.name} (${integration.connectorType})`,
      },
      request,
    );
    return NextResponse.json({ data: redactIntegration(integration) }, { status: 201 });
  } catch (error) {
    if (error instanceof SecretKeyMissing) return ApiError.badRequest(error.message);
    throw error;
  }
});
