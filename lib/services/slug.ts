/**
 * Node-safe. Immutable kebab-case slugs for catalogue rows (taxonomy + vehicles).
 * Derived once on create; renaming a row changes `name` only, never the slug.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
