/**
 * Rewrites named variables in the text of a .env file and leaves everything else exactly
 * as it was: comments, other variables, blank lines, odd lines and the line endings.
 * Pure text in, text out: it never reads or writes a file, and never logs a value.
 */

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function setEnvValues(text: string, updates: Record<string, string>): string {
  for (const [name, value] of Object.entries(updates)) {
    if (!NAME.test(name)) throw new Error("An environment variable name is not valid.");
    if (/["\r\n]/.test(value)) {
      throw new Error(`The value for ${name} contains a character that cannot be stored in an env file.`);
    }
  }

  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const endsWithEol = text.endsWith(eol);
  const lines = text === "" ? [] : text.split(eol);
  if (endsWithEol) lines.pop();

  const written = new Set<string>();
  const out = lines.map((line) => {
    const name = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)?.[1];
    if (name !== undefined && Object.hasOwn(updates, name)) {
      written.add(name);
      return `${name}="${updates[name]}"`;
    }
    return line;
  });

  for (const [name, value] of Object.entries(updates)) {
    if (!written.has(name)) out.push(`${name}="${value}"`);
  }

  return out.length === 0 ? "" : out.join(eol) + eol;
}
