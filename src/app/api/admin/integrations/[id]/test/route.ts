import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { IntegrationRunError, testConnection } from "@/modules/integrations/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Test Connection: verifies reachability without ingesting anything. */
export const POST = withPermission(PERMISSIONS.INTEGRATION_WRITE, async (user, request, params) => {
  try {
    const result = await testConnection(params.id);
    await recordAudit(
      user,
      {
        action: "integration.test_connection",
        entityType: "integration",
        entityId: params.id,
        summary: result.ok ? "Connection succeeded" : `Connection failed: ${result.message}`,
      },
      request,
    );
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof IntegrationRunError) {
      return error.status === 404 ? ApiError.notFound(error.message) : ApiError.conflict(error.message);
    }
    throw error;
  }
});
