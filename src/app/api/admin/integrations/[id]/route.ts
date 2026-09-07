import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { encryptSecret, redactIntegration, secretsConfigured, SecretKeyMissing } from "@/modules/integrations/secrets";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().min(3).max(160).optional(),
  status: z.enum(["draft", "active", "paused", "failing"]).optional(),
  authType: z.string().trim().max(40).nullable().optional(),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  scheduleCron: z.string().trim().max(120).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  /** Replaces the stored credentials; null clears them. */
  secret: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const GET = withPermission(PERMISSIONS.INTEGRATION_READ, async (_user, _request, params) => {
  const integration = await prisma.integration.findUnique({
    where: { id: params.id },
    include: {
      dataSource: { select: { id: true, name: true } },
      runs: { orderBy: { startedAt: "desc" }, take: 20 },
    },
  });
  if (!integration) return ApiError.notFound("Integration not found.");
  return NextResponse.json({ data: redactIntegration(integration) });
});

export const PATCH = withPermission(PERMISSIONS.INTEGRATION_WRITE, async (user, request, params) => {
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return ApiError.badRequest("Invalid update.", parsed.error.flatten().fieldErrors);

  const existing = await prisma.integration.findUnique({ where: { id: params.id } });
  if (!existing) return ApiError.notFound("Integration not found.");

  const { secret, config, ...rest } = parsed.data;
  if (secret && !secretsConfigured()) {
    return ApiError.badRequest("INTEGRATION_SECRET_KEY is not configured, so credentials cannot be stored securely.");
  }

  try {
    const integration = await prisma.integration.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(config ? { config: config as object } : {}),
        ...(secret === undefined ? {} : { secretCiphertext: secret === null ? null : encryptSecret(secret) }),
      },
    });
    await recordAudit(
      user,
      {
        action: "integration.update",
        entityType: "integration",
        entityId: integration.id,
        // The audit trail records that credentials changed, never their value.
        summary: secret === undefined ? "Configuration updated" : "Configuration and credentials updated",
        changes: { ...rest, configChanged: !!config, secretChanged: secret !== undefined },
      },
      request,
    );
    return NextResponse.json({ data: redactIntegration(integration) });
  } catch (error) {
    if (error instanceof SecretKeyMissing) return ApiError.badRequest(error.message);
    throw error;
  }
});
