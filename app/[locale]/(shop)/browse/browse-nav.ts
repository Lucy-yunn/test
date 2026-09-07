/** Query-string helpers for the Browse facet links (server-rendered). */

export type SP = Record<string, string | string[] | undefined>;

export function spToParams(sp: SP): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v !== "") p.set(k, v);
  }
  return p;
}

/** A new `/browse?…` href with `changes` applied (null clears a key). Resets `page`. */
export function browseHref(sp: SP, changes: Record<string, string | null>): string {
  const p = spToParams(sp);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  p.delete("page");
  const s = p.toString();
  return s ? `/browse?${s}` : "/browse";
}

/** Toggle a single-value facet: same value clears it, otherwise sets it. */
export function toggleHref(sp: SP, key: string, value: string): string {
  const current = typeof sp[key] === "string" ? (sp[key] as string) : undefined;
  return browseHref(sp, { [key]: current === value ? null : value });
}

/** Same query but a specific page (page 1 drops the param). */
export function pageHref(sp: SP, page: number): string {
  const p = spToParams(sp);
  p.delete("page");
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `/browse?${s}` : "/browse";
}
