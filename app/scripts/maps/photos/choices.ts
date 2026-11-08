/* THE PHOTO CHOICES (Map 5e) — made by LOOKING at every candidate on the
   contact sheets (fetch.ts sheets; app/.cache/photos/sheets/), place by
   place. A photo is chosen only when it shows THIS place — the building, the
   lake, the street the trip means — not a namesake, not a generic street, not
   a sign; when in doubt it is refused, and the place keeps its colour and
   icon ("No free photo of this place"). Every refusal is written down with
   its reason. Licences are checked again by manifest.ts (rules.ts licenceOf):
   a choice on a file whose licence is not on the owner's list fails the
   build of the manifest.

   `shows` says what the photo shows — the check, in words. `fy` moves the
   crops' focal point (0 top … 1 bottom) where the middle of the photo would
   cut its subject in the 16:9 card, the rail's banner or the round pin.

   THE DECISIONS ARE DATA (8 Nov 2026): they are one trip's — keyed by its
   place ids — so they live in choices.json beside this file, read when it is
   there. A checkout without it (a trip's own files leave this repo) has none:
   every table below is empty, and the scripts and tests still run — a pack
   is then built with no photos. The types stay here. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Rejected {
  file: string;
  why: string;
}
export type Choice = ({ photo: string; shows: string; fy?: number } | { none: string }) & { rejected?: Rejected[] };

export interface Choices {
  /** the trip whose place ids these are */
  trip?: string;
  ITEM_FIX?: Record<string, { wd: string; why: string }>;
  ABOUT_SKIP?: Record<string, string>;
  OFFICIAL_SKIP?: Record<string, string>;
  /** Map 5a's evidence: the Wikidata item that CONFIRMED an entity's position (places.ts) */
  MAP5A_ITEMS?: Record<string, { wd: string; from: string }>;
  /** extra.ts's hand-written second (and third) look: per place, the Commons and Openverse searches to ask */
  EXTRA_ASK?: Record<string, Questions>;
  EXTRA_THIRD?: Record<string, Questions>;
  CHOICES?: Record<string, Choice>;
}
export interface Questions {
  commons?: string[];
  openverse?: string[];
}

export const CHOICES_FILE = join(dirname(fileURLToPath(import.meta.url)), 'choices.json');

/** The decisions on disk, or none at all. */
export function readChoices(file = CHOICES_FILE): Choices {
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8')) as Choices;
}
const data = readChoices();

/** The trip the choices were made for ('' when there are none). */
export const CHOICES_TRIP: string = data.trip ?? '';

/** Where Map 5a's evidence tied a place to the WRONG Wikidata item — a
    namesake its coordinate check happened to match — the item that is the
    place. (Map 5a's pins were verified by OpenStreetMap; these items only
    confirmed a coordinate, and are not the place.) */
export const ITEM_FIX: Record<string, { wd: string; why: string }> = data.ITEM_FIX ?? {};

/** An About left out, and why (Wikipedia's text is used only when the article is about THIS place). */
export const ABOUT_SKIP: Record<string, string> = data.ABOUT_SKIP ?? {};

/** An official site left out, and why. */
export const OFFICIAL_SKIP: Record<string, string> = data.OFFICIAL_SKIP ?? {};

/** The Wikidata item Map 5a's evidence confirmed for an entity (none for a trip without that evidence). */
export const MAP5A_ITEMS: Record<string, { wd: string; from: string }> = data.MAP5A_ITEMS ?? {};

export const CHOICES: Record<string, Choice> = data.CHOICES ?? {};

/** extra.ts's questions, place by place (none without the data). */
export const EXTRA_ASK: Record<string, Questions> = data.EXTRA_ASK ?? {};
export const EXTRA_THIRD: Record<string, Questions> = data.EXTRA_THIRD ?? {};
