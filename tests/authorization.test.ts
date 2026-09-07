import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ROLES, PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { canTransition } from "@/modules/approval/workflow";
import {
  LOGIN_THROTTLE,
  checkLoginThrottle,
  clearLoginFailures,
  recordLoginFailure,
  resetLoginThrottle,
} from "@/lib/auth/throttle";

const role = (code: string): Permission[] => DEFAULT_ROLES.find((r) => r.code === code)!.permissions;

describe("role capabilities", () => {
  it("defines the four roles the approval workflow expects", () => {
    expect(DEFAULT_ROLES.map((r) => r.code).sort()).toEqual(
      ["administrator", "data_contributor", "data_reviewer", "me_approver"].sort(),
    );
  });

  it("grants the administrator every permission", () => {
    expect([...role("administrator")].sort()).toEqual([...Object.values(PERMISSIONS)].sort());
  });

  it("withholds approval and publication from contributors", () => {
    const contributor = role("data_contributor");
    expect(contributor).not.toContain(PERMISSIONS.APPROVAL_DECIDE);
    expect(contributor).not.toContain(PERMISSIONS.PUBLICATION_MANAGE);
    expect(contributor).not.toContain(PERMISSIONS.ADMIN_MANAGE);
  });

  it("withholds publication from reviewers, who review but do not decide", () => {
    const reviewer = role("data_reviewer");
    expect(reviewer).toContain(PERMISSIONS.APPROVAL_REVIEW);
    expect(reviewer).not.toContain(PERMISSIONS.APPROVAL_DECIDE);
    expect(reviewer).not.toContain(PERMISSIONS.PUBLICATION_MANAGE);
  });

  it("withholds beneficiary identity from contributors, who need no personal data", () => {
    expect(role("data_contributor")).not.toContain(PERMISSIONS.BENEFICIARY_READ);
    expect(role("data_reviewer")).toContain(PERMISSIONS.BENEFICIARY_READ);
  });

  it("restricts integration credentials and audit logs to senior roles", () => {
    expect(role("data_contributor")).not.toContain(PERMISSIONS.INTEGRATION_WRITE);
    expect(role("data_reviewer")).not.toContain(PERMISSIONS.INTEGRATION_WRITE);
    expect(role("administrator")).toContain(PERMISSIONS.INTEGRATION_WRITE);
    expect(role("data_contributor")).not.toContain(PERMISSIONS.AUDIT_READ);
  });

  it("lets no role except administrator run an integration", () => {
    for (const code of ["data_contributor", "data_reviewer", "me_approver"]) {
      expect(role(code)).not.toContain(PERMISSIONS.INTEGRATION_RUN);
    }
    expect(role("administrator")).toContain(PERMISSIONS.INTEGRATION_RUN);
  });
});

describe("workflow authorisation by role", () => {
  const clean = { unresolvedErrorCount: 0 };

  it("stops a contributor from approving or publishing their own data", () => {
    const permissions = role("data_contributor");
    expect(canTransition({ ...clean, action: "approve", currentStatus: "submitted", permissions }).allowed).toBe(false);
    expect(canTransition({ ...clean, action: "publish", currentStatus: "approved", permissions }).allowed).toBe(false);
  });

  it("stops a reviewer from approving", () => {
    const permissions = role("data_reviewer");
    expect(canTransition({ ...clean, action: "return_for_correction", currentStatus: "submitted", permissions }).allowed).toBe(true);
    expect(canTransition({ ...clean, action: "approve", currentStatus: "submitted", permissions }).allowed).toBe(false);
  });

  it("lets the M&E approver approve and publish", () => {
    const permissions = role("me_approver");
    expect(canTransition({ ...clean, action: "approve", currentStatus: "submitted", permissions }).allowed).toBe(true);
    expect(canTransition({ ...clean, action: "publish", currentStatus: "approved", permissions }).allowed).toBe(true);
  });

  it("blocks even an administrator from publishing data with unresolved errors", () => {
    const permissions = role("administrator");
    const result = canTransition({ action: "publish", currentStatus: "approved", permissions, unresolvedErrorCount: 1 });
    expect(result.allowed).toBe(false);
  });
});

describe("login throttling", () => {
  beforeEach(() => resetLoginThrottle());

  const keys = ["email:user@avdp.local", "ip:203.0.113.5"];

  it("allows sign-in attempts up to the limit", () => {
    for (let i = 0; i < LOGIN_THROTTLE.MAX_FAILURES - 1; i += 1) {
      recordLoginFailure(keys);
      expect(checkLoginThrottle(keys).allowed).toBe(true);
    }
  });

  it("locks out after too many failures and reports when to retry", () => {
    for (let i = 0; i < LOGIN_THROTTLE.MAX_FAILURES; i += 1) recordLoginFailure(keys);
    const state = checkLoginThrottle(keys);
    expect(state.allowed).toBe(false);
    expect(state.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("clears the count on a successful sign-in, so typos are not cumulative", () => {
    recordLoginFailure(keys);
    recordLoginFailure(keys);
    clearLoginFailures(keys);
    expect(checkLoginThrottle(keys).remainingAttempts).toBe(LOGIN_THROTTLE.MAX_FAILURES);
  });

  it("locks the offending address as well as the account", () => {
    for (let i = 0; i < LOGIN_THROTTLE.MAX_FAILURES; i += 1) {
      recordLoginFailure(["email:victim@avdp.local", "ip:203.0.113.9"]);
    }
    // A different account from the same address is still throttled.
    expect(checkLoginThrottle(["email:other@avdp.local", "ip:203.0.113.9"]).allowed).toBe(false);
    // An unrelated address is unaffected, so one attacker cannot lock everyone out.
    expect(checkLoginThrottle(["email:other@avdp.local", "ip:198.51.100.1"]).allowed).toBe(true);
  });
});
