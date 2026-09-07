import { randomBytes } from "node:crypto";

/**
 * Node-safe. A random initial password shown once to staff to relay to a seller
 * by phone/message (docs/auth-and-permissions.md §4.2 / §6 — no transactional
 * email in v1). Alphanumeric only, no ambiguous punctuation.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no 0/O/1/l/I

export function generateInitialPassword(length = 20): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
