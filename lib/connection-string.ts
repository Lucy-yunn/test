/**
 * Node-safe (NO `server-only`, NO Next imports — used by lib/db.ts and the seed's
 * sibling tooling). Validates that an env var holds ONE well-formed PostgreSQL
 * connection string.
 *
 * Why this exists: a `.env` value pasted more than once into a hidden prompt
 * becomes `postgres://a@h/db` × N concatenated. `new URL()` still parses that
 * (the second `://` lands in the path), so `z.string().url()` passes and the app
 * "works by luck" until it doesn't. This check fails loudly instead.
 */
export function assertPostgresUrl(
  name: string,
  value: string | undefined,
): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is not set.`);
  }
  const v = value.trim();

  const schemeCount = (v.match(/:\/\//g) ?? []).length;
  if (schemeCount !== 1) {
    throw new Error(
      `${name} contains ${schemeCount} "://" (length ${v.length}) — it looks ` +
        `like the connection string was pasted more than once. Re-run ` +
        `scripts/setup-neon.sh (paste it ONCE).`,
    );
  }
  if (!/^postgres(?:ql)?:\/\//.test(v)) {
    throw new Error(
      `${name} must start with postgres:// or postgresql://.`,
    );
  }
  if (/\s/.test(v)) {
    throw new Error(`${name} contains whitespace.`);
  }

  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new Error(`${name} is not a valid URL.`);
  }
  if (!url.hostname) {
    throw new Error(`${name} has no host.`);
  }
  return v;
}
