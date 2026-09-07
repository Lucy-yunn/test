/**
 * Node-safe. The `PartNumber.normalized` match key: uppercase, every non
 * letter-or-digit character stripped (spaces, dots, dashes, slashes, …).
 *
 * Part numbers are semi-structured and brand-specific — v1 does NOT parse or
 * validate them beyond this (research #5). Intake de-dup searches on this value.
 */
export function normalizePartNumber(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
