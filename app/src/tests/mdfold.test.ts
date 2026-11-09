/* "DETAILS ▸" (owner's decision, 9 Nov 2026). In a text, a line of only
   `---` ends the short version: everything after the FIRST such line is
   folded under one closed "Details" toggle. In a list, items that start with
   "▸ " are folded together under one toggle at the list's end, mark removed.
   Search reads the plain text, which keeps every word. */
import { describe, expect, it } from 'vitest';
import { foldItems, mdliteToText, renderMdlite } from '../lib/logic/mdlite';
import { buildIndex, search, type FindInput } from '../lib/logic/find';
import { resolveDay } from '../lib/logic/day';
import type { DayPlan, InfoCard } from '../lib/model/types';

const FOLDED = (inner: string): string => `<details class="md-more"><summary>Details</summary>${inner}</details>`;

describe('md-lite fold · text', () => {
  it('folds what follows the first --- line, closed', () => {
    expect(renderMdlite('Pickup **15:00** at the inn\n---\nThe driver waits at gate 2.\nCash only.')).toBe(
      'Pickup <b>15:00</b> at the inn' + FOLDED('The driver waits at gate 2.<br>Cash only.'),
    );
    expect(renderMdlite('a\n---\nb')).not.toContain('open');
  });
  it('a later --- inside the fold is plain text; spaces around it are fine', () => {
    expect(renderMdlite('a\n  ---  \nb\n---\nc')).toBe('a' + FOLDED('b<br>---<br>c'));
  });
  it('an empty fold folds nothing; a longer rule or inline dashes are not a fold', () => {
    expect(renderMdlite('a\n---\n  ')).toBe('a');
    expect(renderMdlite('a\n----\nb')).toBe('a<br>----<br>b');
    expect(renderMdlite('a --- b')).toBe('a --- b');
  });
  it('the fold is escaped like everything else', () => {
    expect(renderMdlite('a\n---\n<script>')).toContain('&lt;script&gt;');
  });
  it('the plain text keeps every word and drops the line', () => {
    expect(mdliteToText('short\n---\nlong')).toBe('short\nlong');
  });
});

describe('md-lite fold · lists', () => {
  it('▸ items move, without the mark, into one fold after the last plain item', () => {
    expect(foldItems(['a', '▸ x', 'b', '▸ y'])).toEqual(['a', 'b\n---\nx\ny']);
    const items = foldItems(['a', '▸ x', 'b', '▸ y']);
    expect(renderMdlite(items[1]!)).toBe('b' + FOLDED('x<br>y'));
  });
  it('a list without ▸ items is untouched; "▸" without its space is plain', () => {
    const l = ['a', '▸b'];
    expect(foldItems(l)).toBe(l);
  });
  it('a day plan: steps count only the plain items', () => {
    const plan = { id: 'd', tripId: 't', date: '2027-01-02', title: 'Day', planItems: ['09:00 Train', '▸ Platform 3, car 5'] } as DayPlan;
    expect(resolveDay('2027-01-02', [plan], [], [])!.planItems).toEqual(['09:00 Train\n---\nPlatform 3, car 5']);
  });
  it('Find still finds the folded words', () => {
    const empty: FindInput = { bookings: [], showCards: [], runbooks: [], dayPlans: [], stops: [], tasks: [], infoCards: [], emergency: [], walletCards: [], documents: [] };
    const card = { id: 'i', tripId: 't', title: 'Money', heading: 'Money', items: ['Cash first', '▸ the hidden ATM by gate 4'] } as unknown as InfoCard;
    const note = { tripId: 't', text: 'Short\n---\nthe secret teahouse' } as never;
    const idx = buildIndex({ ...empty, infoCards: [card], note });
    expect(search(idx, 'hidden atm').counts.all).toBeGreaterThan(0);
    expect(search(idx, 'secret teahouse').counts.all).toBeGreaterThan(0);
  });
});
