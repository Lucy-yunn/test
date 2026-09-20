/**
 * Small text rules used wherever an optional field comes from a form or a spreadsheet.
 * One definition, so "blank means unknown" cannot drift between services (it once did:
 * decimal columns rejected an empty string that text columns accepted).
 */

/** Trim; blank, whitespace-only, undefined and null all become null. `"0"` stays `"0"`. */
export function blankToNull(value?: string | null): string | null {
  return value?.trim() || null;
}

/** The first line of a possibly multi-line text, trimmed; null when there is none. */
export function firstLine(text?: string | null): string | null {
  return text?.split(/\r?\n/, 1)[0]?.trim() || null;
}
