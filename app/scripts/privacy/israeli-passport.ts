/* The owner's standing rule: the Israeli passport number is written NOWHERE in
   this repo — not in code, not in a source document, and not as a hash either
   (a 9-digit number's hash is brute-forced in seconds). The privacy gates read
   it from a file OUTSIDE the repo, on the owner's own PC:

     ~/.ltd-private/israeli-passport.txt   (override: LTD_PRIVATE_FILE)

   A missing file makes the check report itself as SKIPPED. It is never
   silently passed. Until 28 Sep 2026 the gates read the number from
   sources/china-2026/china-2026-handoff-prompt.md; that line was redacted. */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const ISRAELI_PASSPORT_FILE =
  process.env.LTD_PRIVATE_FILE ?? join(homedir(), '.ltd-private', 'israeli-passport.txt');

/** The number, or null when this machine has no private file. */
export function loadIsraeliPassport(): string | null {
  if (!existsSync(ISRAELI_PASSPORT_FILE)) return null;
  const value = readFileSync(ISRAELI_PASSPORT_FILE, 'utf8').trim();
  return value.length > 0 ? value : null;
}
