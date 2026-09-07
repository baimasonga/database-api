import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { IntegrationRunError, runIntegration } from "@/modules/integrations/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  datasetId: z.string().uuid(),
  reportingPeriodId: z.string().uuid(),
});

/**
 * Run Now, for authorised administrators.
 *
 * The run lands data in the raw layer and validates it. It cannot approve or
 * publish: those remain human decisions taken through the approval workflow.
 */
export const POST = withPermission(PERMISSIONS.INTEGRATION_RUN, async (user, request, params) => {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return ApiError.badRequest("Select a dataset and reporting period.", parsed.error.flatten().fieldErrors);
  }

  try {
    const outcome = await runIntegration({
      integrationId: params.id,
      datasetId: parsed.data.datasetId,
      reportingPeriodId: parsed.data.reportingPeriodId,
      actor: user,
      request,
    });
    return NextResponse.json({ data: outcome });
  } catch (error) {
    if (error instanceof IntegrationRunError) {
      return error.status === 404 ? ApiError.notFound(error.message) : ApiError.conflict(error.message);
    }
    throw error;
  }
});
