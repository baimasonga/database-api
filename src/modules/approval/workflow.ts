import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

export type ImportStatus =
  | "uploaded"
  | "profiling"
  | "mapping_required"
  | "validating"
  | "validation_failed"
  | "ready_for_review"
  | "submitted"
  | "approved"
  | "published"
  | "rejected"
  | "failed";

export type WorkflowAction =
  | "submit"
  | "start_review"
  | "return_for_correction"
  | "approve"
  | "reject"
  | "publish"
  | "unpublish"
  | "withdraw";

interface TransitionRule {
  from: ImportStatus[];
  to: ImportStatus;
  permission: Permission;
  /** Blocks the transition while unresolved error-severity findings remain. */
  requiresNoErrors: boolean;
  label: string;
}

export const TRANSITIONS: Record<WorkflowAction, TransitionRule> = {
  submit: {
    from: ["ready_for_review", "validation_failed"],
    to: "submitted",
    permission: PERMISSIONS.APPROVAL_SUBMIT,
    requiresNoErrors: true,
    label: "Submit for Review",
  },
  start_review: {
    from: ["submitted"],
    to: "submitted",
    permission: PERMISSIONS.APPROVAL_REVIEW,
    requiresNoErrors: false,
    label: "Start Review",
  },
  return_for_correction: {
    from: ["submitted"],
    to: "validation_failed",
    permission: PERMISSIONS.APPROVAL_REVIEW,
    requiresNoErrors: false,
    label: "Return for Correction",
  },
  approve: {
    from: ["submitted"],
    to: "approved",
    permission: PERMISSIONS.APPROVAL_DECIDE,
    requiresNoErrors: true,
    label: "Approve",
  },
  reject: {
    from: ["submitted", "approved"],
    to: "rejected",
    permission: PERMISSIONS.APPROVAL_DECIDE,
    requiresNoErrors: false,
    label: "Reject",
  },
  publish: {
    from: ["approved"],
    to: "published",
    permission: PERMISSIONS.PUBLICATION_MANAGE,
    requiresNoErrors: true,
    label: "Publish",
  },
  unpublish: {
    from: ["published"],
    to: "approved",
    permission: PERMISSIONS.PUBLICATION_MANAGE,
    requiresNoErrors: false,
    label: "Unpublish",
  },
  withdraw: {
    from: ["submitted"],
    to: "ready_for_review",
    permission: PERMISSIONS.APPROVAL_SUBMIT,
    requiresNoErrors: false,
    label: "Withdraw",
  },
};

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
  nextStatus?: ImportStatus;
}

export interface TransitionInput {
  action: WorkflowAction;
  currentStatus: ImportStatus;
  permissions: Permission[];
  unresolvedErrorCount: number;
}

/**
 * Single authority on workflow legality. Datasets carrying unresolved
 * error-severity findings can never reach approval or publication.
 */
export function canTransition(input: TransitionInput): TransitionCheck {
  const rule = TRANSITIONS[input.action];
  if (!rule) return { allowed: false, reason: `Unknown action "${input.action}".` };
  if (!input.permissions.includes(rule.permission)) {
    return { allowed: false, reason: `Requires the "${rule.permission}" permission.` };
  }
  if (!rule.from.includes(input.currentStatus)) {
    return {
      allowed: false,
      reason: `"${rule.label}" is not available from status "${input.currentStatus}".`,
    };
  }
  if (rule.requiresNoErrors && input.unresolvedErrorCount > 0) {
    return {
      allowed: false,
      reason: `${input.unresolvedErrorCount} unresolved validation error(s) must be resolved first.`,
    };
  }
  return { allowed: true, nextStatus: rule.to };
}

export function availableActions(input: Omit<TransitionInput, "action">): WorkflowAction[] {
  return (Object.keys(TRANSITIONS) as WorkflowAction[]).filter(
    (action) => canTransition({ ...input, action }).allowed,
  );
}
