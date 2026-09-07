import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Data Access Layer — the real authorization boundary (ADR-0001,
 * docs/auth-and-permissions.md §10). `proxy.ts` only does an optimistic
 * cookie redirect; every data function AND every Server Action must call one
 * of these guards. Never guard in a layout (layouts don't re-run on navigation).
 *
 * This is the step-0/step-2 skeleton: session + role gates + the shape of the
 * ownership helpers. Per-surface queries and the full permission matrix land in
 * steps 3+.
 */

export type Role = "buyer" | "seller" | "staff";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  messagingBlocked: boolean;
}

/** Memoised for the render pass — safe to call from many components per request. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as typeof session.user & {
    role?: string;
    messagingBlockedAt?: Date | string | null;
  };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role as Role) ?? "buyer",
    messagingBlocked: Boolean(u.messagingBlockedAt),
  };
});

export const verifySession = cache(async (): Promise<SessionUser> => {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
});

async function requireRole(role: Role): Promise<SessionUser> {
  const user = await verifySession();
  if (user.role !== role) {
    // Authenticated but wrong role → plain 403 (docs/auth-and-permissions.md §10).
    redirect("/forbidden");
  }
  return user;
}

export const requireBuyer = cache(() => requireRole("buyer"));
export const requireSeller = cache(() => requireRole("seller"));
export const requireStaff = cache(() => requireRole("staff"));
