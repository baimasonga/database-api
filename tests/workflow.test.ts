import { describe, expect, it } from "vitest";
import { availableActions, canTransition } from "@/modules/approval/workflow";
import { PERMISSIONS, DEFAULT_ROLES } from "@/lib/auth/permissions";

const contributor = DEFAULT_ROLES.find((r) => r.code === "data_contributor")!.permissions;
const approver = DEFAULT_ROLES.find((r) => r.code === "me_approver")!.permissions;

describe("approval workflow", () => {
  it("lets a contributor submit a clean, reviewed import", () => {
    const result = canTransition({
      action: "submit",
      currentStatus: "ready_for_review",
      permissions: contributor,
      unresolvedErrorCount: 0,
    });
    expect(result.allowed).toBe(true);
    expect(result.nextStatus).toBe("submitted");
  });

  it("blocks submission while validation errors remain unresolved", () => {
    const result = canTransition({
      action: "submit",
      currentStatus: "ready_for_review",
      permissions: contributor,
      unresolvedErrorCount: 3,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/3 unresolved validation error/);
  });

  it("blocks approval and publication with unresolved errors", () => {
    expect(canTransition({ action: "approve", currentStatus: "submitted", permissions: approver, unresolvedErrorCount: 1 }).allowed).toBe(false);
    expect(canTransition({ action: "publish", currentStatus: "approved", permissions: approver, unresolvedErrorCount: 1 }).allowed).toBe(false);
  });

  it("refuses actions the role lacks permission for", () => {
    const result = canTransition({ action: "approve", currentStatus: "submitted", permissions: contributor, unresolvedErrorCount: 0 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(new RegExp(PERMISSIONS.APPROVAL_DECIDE));
  });

  it("refuses transitions that are illegal from the current status", () => {
    const result = canTransition({ action: "publish", currentStatus: "uploaded", permissions: approver, unresolvedErrorCount: 0 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not available from status "uploaded"/);
  });

  it("drives the full happy path uploaded → published", () => {
    let status: Parameters<typeof canTransition>[0]["currentStatus"] = "ready_for_review";
    for (const action of ["submit", "approve", "publish"] as const) {
      const permissions = action === "submit" ? contributor : approver;
      const result = canTransition({ action, currentStatus: status, permissions, unresolvedErrorCount: 0 });
      expect(result.allowed, `${action} from ${status}`).toBe(true);
      status = result.nextStatus!;
    }
    expect(status).toBe("published");
  });

  it("lists only the actions currently available", () => {
    expect(availableActions({ currentStatus: "approved", permissions: approver, unresolvedErrorCount: 0 })).toContain("publish");
    expect(availableActions({ currentStatus: "approved", permissions: contributor, unresolvedErrorCount: 0 })).toEqual([]);
    expect(availableActions({ currentStatus: "published", permissions: approver, unresolvedErrorCount: 0 })).toEqual(["unpublish"]);
  });
});
