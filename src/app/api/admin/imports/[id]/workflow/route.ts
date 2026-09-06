import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { performWorkflowAction, WorkflowError } from "@/modules/approval/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  action: z.enum(["submit", "start_review", "return_for_correction", "approve", "reject", "publish", "unpublish", "withdraw"]),
  comment: z.string().trim().max(2000).optional(),
});

/**
 * Every workflow action funnels through here. The permission check below is
 * the coarse gate; the workflow state machine enforces the per-action
 * capability and the "no unresolved errors" rule.
 */
export const POST = withPermission(PERMISSIONS.APPROVAL_SUBMIT, async (user, request, params) => {
  const id = params.id;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return ApiError.badRequest("Invalid workflow action.", parsed.error.flatten().fieldErrors);

  try {
    const outcome = await performWorkflowAction(user, id, parsed.data.action, parsed.data.comment ?? null, request);
    return NextResponse.json({ data: outcome });
  } catch (error) {
    if (error instanceof WorkflowError) {
      return error.status === 403
        ? ApiError.forbidden(error.message)
        : error.status === 404
          ? ApiError.notFound(error.message)
          : ApiError.conflict(error.message);
    }
    throw error;
  }
});
