/* THE DEMO SEED (seed/demo-2027.trip.json) — the made-up trip every test,
   gate and the offline rehearsal run against since the real China trip left
   this repository (Nov 2026). Built by scripts/build-demo-seed.ts from
   scripts/demo-trip/*; its gate is scripts/demo-trip/assert.ts.

   What this file holds it to is what the China seed's own test held THAT
   trip to, wherever the rule was about the app rather than about one trip's
   documents: the gate passes, the file on disk is exactly what the builder
   makes, the hard travel days carry their runbooks, a bed never ships a dot,
   every price parses, every day's places open, the cross-name links and the
   closed-day negatives are explicit, and the map layer's fields obey their
   contract (types.ts, "THE MAP TAB'S THREE FIELDS"). */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking, ShowCard, Spot, TripBundle } from '../lib/model/types';
import { assertDemoBundle } from '../../scripts/demo-trip/assert';
import { buildDemoBundle } from '../../scripts/demo-trip/bundle';
import { buildImages, buildTicketPdf } from '../../scripts/demo-trip/images';
import { SEED_TS } from '../../scripts/demo-trip/base';
import { resolveDay } from '../lib/logic/day';
import { resolvePlaces } from '../lib/logic/places';
import { parsePrice, tripSymbols } from '../lib/logic/prices';
import { counterState } from '../lib/logic/counters';
import { stayCard } from '../lib/logic/pocket';
import { CATEGORIES } from '../lib/logic/mapplaces';

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, '..', '..', '..', 'seed', 'demo-2027.trip.json');
const raw = readFileSync(seedPath, 'utf8');
const seed = JSON.parse(raw) as AppBackup;
const bundle = seed.trips[0] as TripBundle;
const byId = <T extends { id: string }>(xs: T[], id: string): T => xs.find((x) => x.id === id)!;
const on = (date: string): string[] => bundle.dayPlans.find((d) => d.date === date)?.placeIds ?? [];

describe('demo seed', () => {
  it('passes every structural, coverage and privacy assertion', () => {
    const report = assertDemoBundle(bundle, seed);
    expect(report.lines.filter((l) => l.startsWith('✗'))).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('the seed on disk is exactly what the builder makes — never hand-edited', async () => {
    const rebuilt: AppBackup = { ...seed, exportedAt: new Date(SEED_TS).toISOString(), trips: [buildDemoBundle(await buildImages(), buildTicketPdf())] };
    expect(JSON.stringify(rebuilt, null, 1) + '\n').toBe(raw);
  });

  it('is marked as a sample everywhere a reader looks', () => {
    expect(bundle.trip.title).toMatch(/^TEST — /);
    expect(bundle.trip.subtitle).toBe('Sample trip · not real data');
    expect(bundle.trip.emoji).toBe('🧪');
    /* every bed is a Sample business and every code a DEMO one */
    expect(bundle.bookings.filter((b) => b.kind === 'hotel').every((b) => /^Sample /.test(b.title))).toBe(true);
    expect(bundle.bookings.filter((b) => b.code).every((b) => b.code!.startsWith('DEMO'))).toBe(true);
  });

  it('keeps the passport card, with no number and no name stored', () => {
    const card = byId(bundle.walletCards, 'dm27-card-passport');
    expect(card.rows.find((r) => r.k === 'Passport №')?.v).toMatch(/not stored/);
    expect(card.rows.find((r) => r.k === 'Name')?.v).toMatch(/as printed/);
    expect(card.code).toBeUndefined();
  });

  it('keeps the hard travel days runbook-linked', () => {
    const run = (d: string) => bundle.dayPlans.find((x) => x.date === d)?.runbookId;
    expect(run('2027-03-19')).toBe('dm27-run-dep');
    expect(run('2027-03-20')).toBe('dm27-run-arrive');
    expect(run('2027-04-04')).toBe('dm27-run-apr04');
    expect(run('2027-04-09')).toBe('dm27-run-apr09');
    expect(run('2027-04-12')).toBe('dm27-run-apr12');
    expect(run('2027-04-13')).toBe('dm27-run-exit');
    expect(run('2027-04-17')).toBe('dm27-run-home');
    const crit = bundle.runbooks.filter((r) => r.severity === 'crit').map((r) => r.id).sort();
    expect(crit).toEqual(['dm27-run-apr04', 'dm27-run-apr12', 'dm27-run-exit']);
  });

  it('is md-lite throughout — no raw HTML tag anywhere in the text', () => {
    const { documents: _d, ...text } = bundle;
    expect(JSON.stringify(text)).not.toMatch(/<\/?(?:b|i|br|p|div|span|strong|em|a)\b[^>]*>/i);
  });

  it('every real stop carries its options with a ⭐ pick, and a coordinate — Suzhou its options and, named, none', () => {
    for (const s of bundle.stops.filter((x) => x.kind === 'stop')) {
      expect(s.options?.length, s.id).toBeGreaterThanOrEqual(3);
      s.options!.forEach((b, i) => expect(b.id).toBe(`${s.id}-o${i}`));
      if (s.id !== 'dm27-stop-suzhou') expect(s.options!.some((b) => b.heading.startsWith('⭐') || b.items.some((x) => x.startsWith('⭐'))), s.id).toBe(true);
    }
    const noCoord = bundle.stops.filter((s) => s.kind === 'stop' && !s.coord).map((s) => s.id);
    expect(noCoord).toEqual(['dm27-stop-suzhou']);
  });

  it('every flight opens the airport it leaves from', () => {
    const cards = bundle.showCards.filter((c) => c.kind === 'place' && c.coord);
    for (const f of bundle.bookings.filter((b) => b.kind === 'flight')) {
      expect(f.coord, f.id).toBeDefined();
      const card = cards.find((c) => c.meaning.includes(`(${f.from.code})`));
      if (card) expect(f.coord, `${f.id} leaves from ${f.from.code}`).toEqual(card.coord);
    }
  });

  it('the trains and road legs: only one is booked per day, and a pending one claims no booking', () => {
    const moving = bundle.bookings.filter((b) => b.kind === 'train' || b.kind === 'other');
    for (const b of moving.filter((x) => x.status === 'pending')) expect(b.code, b.id).toBeUndefined();
    /* a rail end opens the stations the plan names, or says why it opens none */
    for (const b of moving) {
      for (const end of [b.from, b.to]) {
        if (!end) continue;
        expect((end.stations?.length ?? 0) > 0 || !!end.why, `${b.id} ${end.name}`).toBe(true);
      }
    }
    expect(byId(bundle.bookings, 'dm27-train-mar20-late').alternative).toBe(true);
  });

  it('the experiences ship as cards, and exactly one of them is bought', () => {
    const acts = bundle.bookings.filter((b) => b.kind === 'activity');
    expect(acts.length).toBe(12);
    const bought = acts.filter((b) => b.status === 'booked');
    expect(bought.map((b) => b.id)).toEqual(['dm27-ticket-concert']);
    /* the concert carries what a door asks for */
    expect(bought[0]).toMatchObject({ code: 'DEMO-TIX-0001', time: '19:30', venue: 'Hong Kong Cultural Centre Concert Hall' });
  });

  it('a bed never carries a coordinate — a pin at most — and a stay with its own name gets its own driver card', () => {
    const beds = bundle.bookings.filter((b) => b.kind === 'hotel');
    expect(beds.every((b) => !b.coord)).toBe(true);
    expect(beds.filter((b) => b.pin).length).toBeGreaterThan(0);
    const teahouse = stayCard(byId(bundle.bookings, 'dm27-stay-09'))!;
    expect(teahouse).toMatchObject({ native: '样本茶馆酒店', address: '四川省成都市锦江区样本街9号', phone: '+86 28 0000 0009', category: 'hotel' });
    /* a cancelled bed has no card */
    expect(stayCard(byId(bundle.bookings, 'dm27-stay-06'))).toBeNull();
  });

  it('every place a day links to exists in this trip and can be opened', () => {
    for (const d of bundle.dayPlans) {
      if (!d.placeIds) continue;
      expect(resolvePlaces(d.placeIds, bundle).map((r) => r.id), d.date).toEqual(d.placeIds);
    }
  });

  it('carries the cross-name links a future reader would "correct", and the closed-day negatives', () => {
    /* "Yu Garden" → the entity `Yuyuan Garden` 豫园; "the big museum" → Shanghai Museum East */
    expect(on('2027-04-01')).toContain('dm27-spot-shanghai-yuyuan');
    expect(on('2027-03-30')).toContain('dm27-spot-shanghai-museum-east');
    /* "The Peak by bus, not the tram queue" → `The Peak`, never `Peak Tram` */
    expect(on('2027-04-16')).toContain('dm27-spot-hongkong-the-peak');
    expect(on('2027-04-16')).not.toContain('dm27-spot-hongkong-peak-tram');
    /* the roast goose is named on Wednesday only to say it is shut, and is
       visited on Friday; the dairy café is named on Friday only to say it is shut */
    expect(on('2027-04-14')).not.toContain('dm27-spot-hongkong-roast-goose');
    expect(on('2027-04-16')).toContain('dm27-spot-hongkong-roast-goose');
    expect(on('2027-04-16')).not.toContain('dm27-spot-hongkong-dairy-cafe');
    /* Macau's places hang off the Hong Kong stop */
    expect(on('2027-04-15')).toEqual(expect.arrayContaining(['dm27-spot-hongkong-ruins-st-paul', 'dm27-spot-hongkong-senado', 'dm27-spot-hongkong-coloane', 'dm27-spot-hongkong-lord-stows']));
  });

  it('a day that goes nowhere carries no placeIds key at all', () => {
    for (const d of ['2027-03-21', '2027-04-02', '2027-04-03']) {
      const plan = bundle.dayPlans.find((x) => x.date === d)!;
      expect(plan, d).toBeDefined();
      expect('placeIds' in plan, d).toBe(false);
    }
    /* the school's Sunday default links the lake, its weekday default nothing */
    const sunday = resolveDay('2027-03-28', bundle.dayPlans, bundle.dayDefaults, bundle.stops)!;
    expect(sunday.placeIds).toEqual(['dm27-spot-hangzhou-west-lake', 'dm27-spot-hangzhou-lingyin', 'dm27-spot-hangzhou-longjing', 'dm27-spot-hangzhou-hefang']);
    expect(resolveDay('2027-03-24', bundle.dayPlans, bundle.dayDefaults, bundle.stops)!.placeIds).toBeUndefined();
  });

  it('every price in the seed can be read by the price parser, in a currency the trip carries', () => {
    const symbols = tripSymbols(bundle.trip);
    const rates = new Map(bundle.trip.currencies.map((x) => [x.code, x.rateToHome]));
    const priced = bundle.bookings.filter((b) => b.priceNote);
    expect(priced.length).toBeGreaterThanOrEqual(20);
    for (const b of priced) {
      const p = parsePrice(b.priceNote, symbols);
      if (b.kind === 'activity' && /~|optional/i.test(b.priceNote! + b.title)) continue;
      expect(p, `${b.id} — ${b.priceNote}`).not.toBeNull();
      expect(rates.get(p!.currency) ?? 0, `${b.id} — ${p!.currency}`).toBeGreaterThan(0);
    }
    /* the only bed with no price is the cancelled one */
    expect(bundle.bookings.filter((b) => b.kind === 'hotel' && !b.priceNote).map((b) => b.id)).toEqual(['dm27-stay-06']);
  });

  it('the pinned visa counter: entry day, then day 24 of 25 on the exit day', () => {
    const c = bundle.counters[0]!;
    expect(c).toMatchObject({ startDate: '2027-03-20', countStartsDayAfter: true, limitDays: 25, hardDeadline: '2027-04-14', plannedEndDate: '2027-04-13', pinned: true });
    expect(counterState(c, '2027-03-20').phase).toBe('entryDay');
    expect(counterState(c, '2027-03-21').day).toBe(1);
    expect(counterState(c, '2027-04-13')).toMatchObject({ phase: 'counting', day: 24, remaining: 1 });
    expect(counterState(c, '2027-04-14').phase).toBe('complete');
  });

  it('the map layer obeys its contract: eight categories, a pin only where there is no coord, details within 90 characters', () => {
    type Placed = { id: string; e: Spot | ShowCard | Booking };
    const placed: Placed[] = [
      ...bundle.stops.flatMap((s) => (s.spots ?? []).map((sp) => ({ id: sp.id, e: sp as Spot }))),
      ...bundle.showCards.filter((x) => x.kind === 'place').map((x) => ({ id: x.id, e: x as ShowCard })),
      ...bundle.bookings.map((x) => ({ id: x.id, e: x as Booking })),
    ];
    for (const { id, e } of placed) {
      expect(CATEGORIES, id).toContain(e.category);
      if (e.pin) expect(e.coord, `${id}: a pin only where there is no coord`).toBeUndefined();
      if (e.detail) expect(e.detail.length, id).toBeLessThanOrEqual(90);
    }
    expect(bundle.bookings.filter((b) => b.kind === 'hotel').every((b) => b.category === 'hotel')).toBe(true);
    /* the trip's own words win: the blind massage is a spa, the clinic medical */
    expect(byId(bundle.showCards, 'dm27-place-06').category).toBe('spa');
    expect(byId(bundle.showCards, 'dm27-place-07').category).toBe('medical');
  });
});
