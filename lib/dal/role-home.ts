import type { Role } from "./actor";

/**
 * Post-authentication destination (docs/auth-and-permissions.md §10).
 * `staff → /admin`, `seller → /seller`, `buyer → the redirect param or /`.
 *
 * `redirectTo` is honoured only for a buyer and only when it is a safe
 * same-origin path (leading single "/", no "//", no scheme) — otherwise "/".
 */
export function roleHomePath(role: Role, redirectTo?: string | null): string {
  if (role === "staff") return "/admin";
  if (role === "seller") return "/seller";
  return isSafePath(redirectTo) ? redirectTo : "/";
}

function isSafePath(p: string | null | undefined): p is string {
  return (
    typeof p === "string" &&
    p.startsWith("/") &&
    !p.startsWith("//") &&
    !p.includes("\\")
  );
}
