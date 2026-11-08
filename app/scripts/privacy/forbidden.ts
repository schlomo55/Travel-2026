/* What the privacy gate greps for. Two kinds of check, and only one of them is
   written in this (public) repository:

   1. SHAPES — generic forms of a credential that reveal nothing about anyone:
      an airline e-ticket number, a passport-shaped token, a card number, a
      booking PIN beside its label. Every trip in seed/ is made up, so none of
      them may carry a real-looking one, and neither may dist/.

   2. PRIVATE VALUES — the literal names, booking numbers, PNRs, PINs, ticket
      references and loyalty numbers of a real traveller. They are written
      NOWHERE in this repository, not even as a pattern: a public list of
      "values that must never appear" is itself the leak. They are read from a
      file OUTSIDE the repo, on the owner's own machine,

        ~/.ltd-private/privacy/forbidden.json   (override: LTD_PRIVATE_FORBIDDEN_FILE)

      shaped as
        { "patterns": [ { "label": "airline PNR", "regex": "\\bABC123\\b", "flags": "i" },
                        { "label": "traveller name", "literal": "SOMEONE" } ] }
      A `literal` is matched case-insensitively as a plain substring; a `regex`
      is compiled with its `flags` (default none). Labels are printed, values
      never are. A missing file makes these checks report SKIPPED — like the
      passport checks in private-ids.ts — and the gate still passes on the
      shapes alone. A file that exists but does not parse FAILS the gate: a
      broken private list must never read as a clean one. */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ForbiddenPattern {
  /** Human label for messages — never the value. */
  label: string;
  re: RegExp;
}

/** Generic credential shapes. Safe to publish: they name no one. */
export const SHAPES: ForbiddenPattern[] = [
  /* IATA e-ticket: a 3-digit airline prefix and a 10-digit serial. A bare
     13-digit run is not enough (a millisecond timestamp has that shape), so the
     separator is required. */
  { label: 'e-ticket-shaped number', re: /\b\d{3}[- ]\d{10}\b/ },
  /* The French passport format: two digits, two letters, five digits. */
  { label: 'passport-shaped token', re: /\b\d{2}[A-Z]{2}\d{5}\b/ },
  /* A grouped 16-digit card number. */
  { label: 'card-number-shaped token', re: /\b(?:\d{4}[ -]){3}\d{4}\b/ },
  /* A grouped 12-digit gift-card or voucher number. */
  { label: 'gift-card-shaped number', re: /\b\d{4}[ -]\d{4}[ -]\d{4}\b/ },
  /* A booking PIN beside its label. PIN 0000 is the form placeholder. */
  { label: 'booking PIN beside its label', re: /\bPIN\b[^0-9\n]{0,4}(?!0000\b)\d{4,6}\b/ },
  /* A personal webmail address. */
  { label: 'personal webmail address', re: /[\w.+-]+@(?:gmail|hotmail|outlook|yahoo|icloud)\.com\b/i },
  /* An Israeli mobile number. */
  { label: 'mobile-number-shaped token', re: /(?:\+972[ -]?|\b0)5\d[ -]?\d{3}[ -]?\d{4}\b/ },
];

export const FORBIDDEN_FILE =
  process.env.LTD_PRIVATE_FORBIDDEN_FILE ?? join(homedir(), '.ltd-private', 'privacy', 'forbidden.json');

export interface PrivateForbidden {
  /** Where the values are read from, for the SKIPPED message. */
  file: string;
  /** The private patterns, or null when the file is missing (checks SKIPPED). */
  patterns: ForbiddenPattern[] | null;
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The private value list. Throws when the file exists but is malformed. */
export function loadPrivateForbidden(): PrivateForbidden {
  if (!existsSync(FORBIDDEN_FILE)) return { file: FORBIDDEN_FILE, patterns: null };
  const raw = JSON.parse(readFileSync(FORBIDDEN_FILE, 'utf8')) as {
    patterns?: { label?: unknown; regex?: unknown; literal?: unknown; flags?: unknown }[];
  };
  if (!Array.isArray(raw.patterns)) throw new Error(`${FORBIDDEN_FILE}: no "patterns" array`);
  const patterns = raw.patterns.map((p, i): ForbiddenPattern => {
    const label = typeof p.label === 'string' && p.label ? p.label : `private pattern #${i + 1}`;
    if (typeof p.regex === 'string' && p.regex) {
      /* never 'g' or 'y': a stateful RegExp would skip matches in .test() */
      const flags = typeof p.flags === 'string' ? p.flags.replace(/[gy]/g, '') : '';
      return { label, re: new RegExp(p.regex, flags) };
    }
    if (typeof p.literal === 'string' && p.literal) return { label, re: new RegExp(escape(p.literal), 'i') };
    throw new Error(`${FORBIDDEN_FILE}: entry #${i + 1} (${label}) has neither "regex" nor "literal"`);
  });
  return { file: FORBIDDEN_FILE, patterns };
}

/** Every pattern to check: the shapes, plus the private values when present. */
export function loadForbidden(): { patterns: ForbiddenPattern[]; privateFile: string; privateCount: number | null } {
  const priv = loadPrivateForbidden();
  return {
    patterns: [...SHAPES, ...(priv.patterns ?? [])],
    privateFile: priv.file,
    privateCount: priv.patterns ? priv.patterns.length : null,
  };
}
