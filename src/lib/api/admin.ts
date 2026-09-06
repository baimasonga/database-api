import "server-only";
import type { NextResponse } from "next/server";
import { ApiError } from "./envelope";
import { getCurrentUser, type AuthenticatedUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";

type RouteParams = Record<string, string>;

/**
 * Guards a Data Manager route handler: authenticated session plus an explicit
 * permission. Handlers never see an unauthenticated or under-privileged caller.
 *
 * The context argument is typed `unknown` so the wrapper is assignable to
 * Next's RouteContext for both static and dynamic segments.
 */
export function withPermission(
  permission: Permission,
  handler: (user: AuthenticatedUser, request: Request, params: RouteParams) => Promise<NextResponse | Response>,
) {
  return async (request: Request, context?: unknown): Promise<NextResponse | Response> => {
    const user = await getCurrentUser();
    if (!user) return ApiError.unauthorized();
    if (!user.permissions.includes(permission)) return ApiError.forbidden();

    const raw = (context as { params?: Promise<RouteParams> } | undefined)?.params;
    const params = raw ? await raw : {};

    try {
      return await handler(user, request, params);
    } catch (error) {
      console.error("[api/admin]", new URL(request.url).pathname, error);
      const status = (error as { status?: number }).status;
      if (typeof status === "number" && status >= 400 && status < 500) {
        return ApiError.conflict(error instanceof Error ? error.message : "Request could not be completed.");
      }
      return ApiError.server();
    }
  };
}
