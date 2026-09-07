/**
 * Node-safe typed errors for the DAL / service layer. The Next-coupled entry
 * points (lib/dal/session.ts, Server Actions) translate these into redirects /
 * 403 pages / form errors; the service functions just throw them.
 */

/** Authenticated but not allowed to do this (wrong role, not the owner). */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** The target row does not exist (or the caller may not know that it does). */
export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** A behavioural invariant would be violated (bad state transition, FK mismatch,
 *  deleting a Category with Parts, …). A bug or a stale client — not user error. */
export class InvariantError extends Error {
  readonly code = "INVARIANT";
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}
