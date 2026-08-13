/* Health & insurance (Lantern Run C, C2.2).
 *
 * This section invents nothing. Every line it can show already exists in the
 * trip data — the insurance wallet card, the 24-hour emergency line, the
 * local emergency numbers, the medicine note, the documents tagged
 * `insurance`. What was missing was that they lived on four different screens,
 * and the moment you need them is the one moment you cannot go looking.
 *
 * The selectors are deliberately generic (they match on kind, tag and word,
 * not on "Phoenix" or any other fact from this one trip), so a second trip
 * with different providers gets the same section for free — and a trip that
 * carries none of it gets no section at all rather than an empty promise.
 */
import type { DocumentFile, EmergencyContact, InfoCard, WalletCard } from '../model/types';

const INSURANCE_RE = /insurance|insurer|policy|assurance|cover(age)?\b/i;
const EMERGENCY_LINE_RE = /24\s*h|24-hour|emergency line|assistance/i;
const LOCAL_EMERGENCY_RE = /police|ambulance|fire\b|medical|emergenc/i;
const MEDICINE_RE = /medicat|medicine|pharmac|prescription|health/i;

/** The wallet card(s) that are a policy — matched on the card's own words. */
export function insuranceCards(cards: WalletCard[]): WalletCard[] {
  return cards.filter((c) => INSURANCE_RE.test(c.title) || INSURANCE_RE.test(c.note ?? ''));
}

/** The number you call from a hospital corridor: an insurance contact that
    also names itself as a 24-hour or assistance line. */
export function assistanceLines(contacts: EmergencyContact[]): EmergencyContact[] {
  return contacts.filter((c) => INSURANCE_RE.test(c.label) && (EMERGENCY_LINE_RE.test(c.label) || c.kind === 'phone'));
}

/** Police / ambulance / fire, in the order the trip stored them. */
export function localEmergencyNumbers(contacts: EmergencyContact[]): EmergencyContact[] {
  return contacts.filter(
    (c) => c.kind === 'phone' && LOCAL_EMERGENCY_RE.test(c.label) && !INSURANCE_RE.test(c.label),
  );
}

/** The trip's own note about carrying medicine — rules differ per country and
    this app is not qualified to write them, only to put the trip's own words
    where they can be found. */
export function medicineCards(cards: InfoCard[]): InfoCard[] {
  return cards.filter((c) => MEDICINE_RE.test(c.heading));
}

export function insuranceDocs(docs: DocumentFile[]): DocumentFile[] {
  return docs.filter((d) => d.tag === 'insurance');
}

export interface HealthSection {
  policies: WalletCard[];
  assistance: EmergencyContact[];
  local: EmergencyContact[];
  medicine: InfoCard[];
  docs: DocumentFile[];
}

export function buildHealth(input: {
  walletCards: WalletCard[];
  emergency: EmergencyContact[];
  infoCards: InfoCard[];
  documents: DocumentFile[];
}): HealthSection {
  return {
    policies: insuranceCards(input.walletCards),
    assistance: assistanceLines(input.emergency),
    local: localEmergencyNumbers(input.emergency),
    medicine: medicineCards(input.infoCards),
    docs: insuranceDocs(input.documents),
  };
}

/** Nothing to say → no section. An empty card here would read as "you have no
    insurance", which is a claim, not an absence of data. */
export function hasHealth(h: HealthSection): boolean {
  return h.policies.length + h.assistance.length + h.local.length + h.medicine.length > 0;
}

/**
 * The nudge. A policy reachable only through an email is a policy you do not
 * have in a hospital with no signal — but it is only worth saying when there
 * IS a policy and there is NO file for it.
 */
export function needsOfflineDoc(h: HealthSection): boolean {
  return h.policies.length > 0 && h.docs.length === 0;
}
