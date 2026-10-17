/* A PLACE'S NAME WHERE THE ROOM IS TIGHT (Run 3b) — the Pocket's driver
   chips clamped "Beijing Daxing International Airport (PKX)" to "Beijing
   Daxing International…", the pass wrapped its date between two long
   airport names and Counter mode's route ran to three lines. One helper
   shortens them, by whole words only, from the trip file's own names. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, FlightBooking } from '../lib/model/types';
import { shortPlaceName } from '../lib/logic/places';
import { counterSubject } from '../lib/logic/pass';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup).trips[0]!;
const card = (id: string) => china.showCards.find((c) => c.id === id)!.meaning;

describe('shortPlaceName', () => {
  it('keeps an airport’s code and drops the words the code already says', () => {
    expect(shortPlaceName(card('cn26-place-01'))).toBe('Beijing Daxing (PKX)');
    expect(shortPlaceName(card('cn26-place-09'))).toBe('Zhangjiajie Hehua (DYG)');
    expect(shortPlaceName(card('cn26-place-12'))).toBe('Chongqing Jiangbei T3 (CKG)');
    expect(shortPlaceName(card('cn26-place-20'))).toBe('Kunming Changshui (KMG)');
  });

  it('drops the trip file’s own aside and shortens a station, by whole words', () => {
    expect(shortPlaceName(card('cn26-place-19'))).toBe('Kunming South Station');
    expect(shortPlaceName(card('cn26-place-03'))).toBe('Beijing South Station');
    /* 太子城站's card left with skiing on 2026-10-17; its words still prove the rule */
    expect(shortPlaceName('Taizicheng Station — Chongli ski, in Dec 9 · out Dec 11')).toBe('Taizicheng Station');
    expect(shortPlaceName(card('cn26-place-04'))).toBe('Sanlitun, Beijing');
    /* nothing to shorten: the name as written */
    expect(shortPlaceName(card('cn26-place-11'))).toBe('Tianmen Mountain cableway, Dec 14');
  });

  it('shortens an airport with no code beside it to "Intl", and a terminal to T2', () => {
    expect(shortPlaceName('Hong Kong International Airport')).toBe('Hong Kong Intl');
    expect(shortPlaceName('Zhangjiajie Hehua · Terminal 2')).toBe('Zhangjiajie Hehua · T2');
    /* a lettered terminal stays a word */
    expect(shortPlaceName('Zayed Intl · Terminal A')).toBe('Zayed Intl · Terminal A');
    /* where a code is shown with it, the "Intl" goes too */
    expect(shortPlaceName('Beijing Daxing Intl', true)).toBe('Beijing Daxing');
    expect(shortPlaceName('Hong Kong Intl · Terminal 1', true)).toBe('Hong Kong · T1');
  });

  /* Run 3c: "Airport" went wherever a code appeared — "Airport Express (AEL)"
     lost its first word, a bare "Airport" became nothing (Counter mode then
     printed " (XXX)"), and a code in the aside counted as shown */
  it('drops only the airport words that end the name, and never shortens to nothing', () => {
    expect(shortPlaceName('Airport Express (AEL)')).toBe('Airport Express (AEL)');
    expect(shortPlaceName('Airport Express · Hong Kong Station (AEL)')).toBe('Airport Express · Hong Kong Station (AEL)');
    expect(shortPlaceName('Airport', true)).toBe('Airport');
    expect(shortPlaceName('International Airport', true)).toBe('International Airport');
    expect(shortPlaceName('Beijing Capital Airport Terminal 3 (PEK) — ⚠️ NOT the Dec 11 airport')).toBe('Beijing Capital T3 (PEK)');
    /* a code in the aside is not a code beside the name */
    expect(shortPlaceName('Hong Kong International Airport — see the HKG (HKG) page')).toBe('Hong Kong Intl');
    expect(shortPlaceName('Lijiang Sanyi Intl', true)).toBe('Lijiang Sanyi');
    expect(shortPlaceName('Yantai Penglai Intl · Terminal 2', true)).toBe('Yantai Penglai · T2');
  });

  it('never cuts inside a word: every word it keeps is a whole word of the name', () => {
    for (const c of china.showCards.filter((x) => x.kind === 'place')) {
      const words = new Set(c.meaning.split(/[\s()]+/));
      for (const w of shortPlaceName(c.meaning).split(/[\s()]+/)) {
        if (w && !/^T\d{1,2}$/.test(w) && w !== 'Intl') expect(words.has(w), `${w} ← ${c.meaning}`).toBe(true);
      }
    }
  });
});

describe('Counter mode reads the route short', () => {
  it('CA 8609: two lines a desk reads at a glance', () => {
    const f = china.bookings.find((b): b is FlightBooking => b.kind === 'flight' && b.flightNo === 'CA 8609')!;
    expect(counterSubject(f)?.lines).toEqual(['Beijing Daxing (PKX)', '→ Zhangjiajie Hehua · T2 (DYG)']);
  });
});
