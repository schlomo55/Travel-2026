/* Private identifiers the repo must never carry — in code, in a source
   document, in the seed, in dist, and not as a hash either (a short number's
   hash is brute-forced in seconds). The privacy gates read each one from a file
   OUTSIDE the repo, on the owner's own PC:

     ~/.ltd-private/israeli-passport.txt   (override: LTD_PRIVATE_FILE)
     ~/.ltd-private/french-passport.txt    (override: LTD_PRIVATE_FR_FILE)

   A missing file makes the check report itself as SKIPPED. It is never
   silently passed.

   The Israeli number was redacted on 28 Sep 2026 (see israeli-passport.ts,
   whose exports are unchanged and re-exported here). The FRENCH number went
   the same day, by the owner's decision: it is the passport the trip travels
   on, but the app does not need it written down — it is on the physical
   passport, and the owner knows it. Every gate that used to require it now
   requires its ABSENCE. */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ISRAELI_PASSPORT_FILE, loadIsraeliPassport } from './israeli-passport';

export { ISRAELI_PASSPORT_FILE, loadIsraeliPassport };

export const FRENCH_PASSPORT_FILE =
  process.env.LTD_PRIVATE_FR_FILE ?? join(homedir(), '.ltd-private', 'french-passport.txt');

/** The French number, or null when this machine has no private file. */
export function loadFrenchPassport(): string | null {
  if (!existsSync(FRENCH_PASSPORT_FILE)) return null;
  const value = readFileSync(FRENCH_PASSPORT_FILE, 'utf8').trim();
  return value.length > 0 ? value : null;
}

export interface PrivateId {
  /** Human label for messages — never the value. */
  label: string;
  /** Where the value is read from, for the SKIPPED message. */
  file: string;
  /** The value, or null when the private file is missing (check SKIPPED). */
  value: string | null;
}

/** Every private identifier, loaded. A null value means SKIPPED, never passed. */
export function loadPrivateIds(): PrivateId[] {
  return [
    { label: 'Israeli passport number', file: ISRAELI_PASSPORT_FILE, value: loadIsraeliPassport() },
    { label: 'French passport number', file: FRENCH_PASSPORT_FILE, value: loadFrenchPassport() },
  ];
}
