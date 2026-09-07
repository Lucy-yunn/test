/**
 * Data Access Layer — the real authorization boundary + the home of the
 * behavioural invariants (ADR-0001, docs/domain-model.md §4,
 * docs/auth-and-permissions.md §10).
 *
 *   session.ts     Next-coupled: getActor / verifySession / requireBuyer|Seller|Staff
 *   guards.ts      pure role decision (checkRole)
 *   ownership.ts   pure data-scoping (assertOwnsSellerData / assertOwnsBuyerData)
 *   actor.ts       Actor type + role predicates
 *   errors.ts      ForbiddenError / NotFoundError / InvariantError
 *   transitions.ts order / listing / part status machines
 *   part-number.ts normalizePartNumber (the de-dup match key)
 *   invariants.ts  DB-backed: sellerId==donorVehicle.sellerId, category-delete,
 *                  intake de-dup
 *
 * `session.ts` is re-exported from `@/lib/dal/session` (server-only). Everything
 * else is node-safe and re-exported here.
 */
export * from "./actor";
export * from "./guards";
export * from "./ownership";
export * from "./role-home";
export * from "./errors";
export * from "./transitions";
export * from "./part-number";
export * from "./invariants";
