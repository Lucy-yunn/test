import type { Actor, Role } from "./actor";
import { isSeller } from "./actor";

/**
 * Pure role decision — the outcome lib/dal/session.ts turns into a redirect or a
 * 403 (docs/auth-and-permissions.md §10):
 *  - "login"     → not authenticated → /login
 *  - "forbidden" → authenticated, wrong role → plain 403 page
 *  - "ok"        → proceed
 *
 * The `seller` role additionally requires a linked `Seller` profile (a
 * provisioned login) — the matrix's "Seller WITH a login".
 */
export function checkRole(
  actor: Actor | null,
  required: Role,
): "ok" | "login" | "forbidden" {
  if (!actor) return "login";
  if (required === "seller") return isSeller(actor) ? "ok" : "forbidden";
  return actor.role === required ? "ok" : "forbidden";
}
