/* THE PASS, AS DATA. The warning line is the trip file's own flagged
   sentence; the code keeps every character it was stored with. */
import { describe, expect, it } from 'vitest';
import type { FlightBooking, HotelBooking, TrainBooking } from '../lib/model/types';
import {
  bookingDateLabel,
  bookingLine,
  codeGroups,
  counterSubject,
  legState,
  momentOf,
  passDocs,
  passKind,
  passTitle,
  splitWarning,
  walletSectionOf,
  warningLine,
  whenWord,
} from '../lib/logic/pass';

const base = { tripId: 't', status: 'booked' as const, meta: [], createdAt: 0, updatedAt: 0 };
const flight: FlightBooking = {
  ...base,
  id: 'f1',
  kind: 'flight',
  title: 'Airline · XY 12',
  date: '2027-03-04',
  carrier: 'Airline',
  flightNo: 'XY 12',
  from: { code: 'AAA', name: 'Alpha' },
  to: { code: 'BBB', name: 'Beta' },
  dep: '21:20',
  arr: '08:45',
  arrDayOffset: 1,
};
const stay: HotelBooking = {
  ...base,
  id: 'h1',
  kind: 'hotel',
  title: 'Hotel **One**',
  date: '2027-03-04',
  city: 'Somewhere',
  checkIn: '2027-03-04',
  checkOut: '2027-03-07',
};
const train: TrainBooking = {
  ...base,
  id: 'r1',
  kind: 'train',
  status: 'pending',
  title: 'HSR · North → South',
  date: '2027-03-05',
  from: { name: 'North' },
  to: { name: 'South' },
  duration: '~1 h',
};

describe('pass · the trip file’s own warning', () => {
  it('lifts the first sentence of a note that opens with ⚠️', () => {
    expect(warningLine('⚠️ **Departs GATE-B — NOT Gate A.** This is the rebooking.\nMore below.')).toBe(
      'Departs GATE-B — NOT Gate A',
    );
    expect(warningLine('⚠️ **THE EMAIL IS NOT A TICKET.** The office says so.')).toBe('THE EMAIL IS NOT A TICKET');
  });

  it('works with the bare glyph and with no sentence end', () => {
    expect(warningLine('⚠ Bring cash')).toBe('Bring cash');
    expect(warningLine('⚠️ Two things: one! Two.')).toBe('Two things: one');
  });

  it('says nothing when the note does not flag one', () => {
    expect(warningLine(undefined)).toBeNull();
    expect(warningLine('')).toBeNull();
    expect(warningLine('🛂 The visa exit — day 29 of 30.')).toBeNull();
    expect(warningLine('Fine.\n⚠️ a warning on line two is not the lead')).toBeNull();
    expect(warningLine('⚠️')).toBeNull();
  });
});

describe('pass · codes keep every character', () => {
  it('reads a long code in fours', () => {
    expect(codeGroups('1234567812345678')).toEqual(['1234', '5678', '1234', '5678']);
    expect(codeGroups('12345678901234567890')).toEqual(['1234', '5678', '9012', '3456', '7890']);
  });

  it('never strands a single character at the end', () => {
    expect(codeGroups('1234567890123')).toEqual(['1234', '5678', '90123']);
  });

  it('a short code is read whole, and a spaced code keeps its spacing', () => {
    expect(codeGroups('PLF8S9')).toEqual(['PLF8S9']);
    expect(codeGroups('ABC 123 XYZ')).toEqual(['ABC', '123', 'XYZ']);
    expect(codeGroups('   ')).toEqual([]);
  });

  it('the groups always rebuild the stored code', () => {
    for (const c of ['abcDEF0123456789x', 'cohTex87hq19CnTh', '5942328968', 'Q']) {
      expect(codeGroups(c).join('')).toBe(c);
    }
  });
});

describe('pass · kinds, sections and lines', () => {
  it('files each booking in its Pocket list', () => {
    expect(walletSectionOf(flight)).toBe('travel');
    expect(walletSectionOf(train)).toBe('travel');
    expect(walletSectionOf(stay)).toBe('stays');
    expect(walletSectionOf({ kind: 'activity' })).toBe('experiences');
    expect(walletSectionOf({ kind: 'other' })).toBe('travel');
  });

  it('names the pass kind', () => {
    expect(passKind(flight)).toBe('flight');
    expect(passKind(train)).toBe('train');
    expect(passKind(stay)).toBe('stay');
  });

  it('prints only what the booking states', () => {
    expect(bookingLine(flight)).toBe('AAA 21:20 → BBB 08:45+1');
    expect(bookingLine(train)).toBe('North → South · ~1 h');
    expect(bookingLine(stay)).toBe('Somewhere · 4 Mar → 7 Mar · 3 nights');
    expect(bookingDateLabel(stay)).toBe('Thu 4 Mar');
  });

  it('titles the pass', () => {
    expect(passTitle(flight)).toEqual({ caps: 'Airline · flight', title: 'XY 12' });
    expect(passTitle(stay)).toEqual({ caps: 'Stay · Somewhere', title: 'Hotel One' });
    expect(passTitle(train).caps).toBe('Train');
  });

  it('says today and tomorrow, and a date otherwise', () => {
    expect(whenWord('2027-03-04', '2027-03-04').word).toBe('today');
    expect(whenWord('2027-03-05', '2027-03-04').word).toBe('tomorrow');
    expect(whenWord('2027-03-09', '2027-03-04').word).toBe('date');
  });

  it('finds a booking’s own documents', () => {
    const doc = (id: string, bookingId?: string) => ({ id, name: 'Confirmation', tag: 'confirmation', ...(bookingId ? { bookingId } : {}) });
    const docs = [doc('a', 'f1'), doc('b'), doc('c', 'h1')];
    expect(passDocs(docs, flight).map((d) => d.id)).toEqual(['a']);
    expect(passDocs(docs, stay).map((d) => d.id)).toEqual(['c']);
  });

  /* Run 3b: the flight pass had no way to the flight manifest in the vault */
  it('offers a flight the trip’s own flight e-tickets, by the vault’s tag and name', () => {
    const manifest = { id: 'm', name: 'Flight manifest — all seats, e-tickets, terminals', tag: 'ticket' };
    const other = { id: 'o', name: 'Concert e-ticket', tag: 'ticket' };
    const photo = { id: 'p', name: 'Flight deck photo', tag: 'photo' };
    expect(passDocs([manifest, other, photo], flight).map((d) => d.id)).toEqual(['m']);
    /* never on a stay, a train or a ticket */
    expect(passDocs([manifest], stay)).toEqual([]);
    expect(passDocs([manifest], train)).toEqual([]);
    /* one that belongs to another booking stays with that booking */
    expect(passDocs([{ ...manifest, bookingId: 'x' }], flight)).toEqual([]);
  });

  /* Run 3c: every unattached flight document showed on every flight pass */
  it('gives a document that names flights to those flights only', () => {
    const manifest = { id: 'm', name: 'Flight manifest — all seats, e-tickets, terminals', tag: 'ticket' };
    const ca = { id: 'ca', name: 'Flight CA 8609 e-ticket', tag: 'ticket' };
    const u3 = { id: 'u3', name: 'Flight 3U8011 + MU 733 e-tickets', tag: 'ticket' };
    const docs = [manifest, ca, u3];
    const f = (flightNo: string) => ({ ...flight, id: flightNo, flightNo });
    expect(passDocs(docs, f('CA 8609')).map((d) => d.id)).toEqual(['m', 'ca']);
    expect(passDocs(docs, f('3U 8011')).map((d) => d.id)).toEqual(['m', 'u3']);
    expect(passDocs(docs, f('MU 733')).map((d) => d.id)).toEqual(['m', 'u3']);
    /* a flight no document names still gets the manifest, and only it */
    expect(passDocs(docs, f('EY 871')).map((d) => d.id)).toEqual(['m']);
  });
});

describe('pass · Counter mode shows only what can be read out', () => {
  it('a flight: carrier, number, both ends, the day and the clock', () => {
    const s = counterSubject({ ...flight, code: '1234567812345678', codeSub: 'PIN 0000' });
    expect(s).toEqual({
      caps: 'Airline',
      title: 'XY 12',
      lines: ['Alpha (AAA)', '→ Beta (BBB)'],
      when: 'Thu 4 Mar · 21:20',
      codeLabel: 'Booking no.',
      code: '1234567812345678',
      codeSub: 'PIN 0000',
    });
  });

  it('a stay: its name, its city, its nights, and its own code label', () => {
    const s = counterSubject({ ...stay, code: 'ABC123', codeLabel: 'Hotel ref' });
    expect(s?.title).toBe('Hotel One');
    expect(s?.lines).toEqual(['Somewhere']);
    expect(s?.when).toBe('Thu 4 Mar → Sun 7 Mar · 3 nights');
    expect(s?.codeLabel).toBe('Hotel ref');
  });

  it('a wallet card with a number', () => {
    expect(counterSubject({ kind: 'card', title: 'The **card**', code: 'N0', codeLabel: 'Policy' })).toMatchObject({
      caps: 'Card',
      title: 'The card',
      code: 'N0',
      codeLabel: 'Policy',
    });
  });

  it('nothing to read out, no Counter mode', () => {
    expect(counterSubject(flight)).toBeNull();
    expect(counterSubject({ ...flight, code: '   ' })).toBeNull();
    expect(counterSubject({ kind: 'card', title: 'x' })).toBeNull();
  });
});

describe('pass · a card’s own warning', () => {
  it('splits at the ⚠️ the card itself carries', () => {
    expect(splitWarning('Airport West (AAW) — ⚠️ NOT the Monday airport any more: XY12 leaves from East')).toEqual({
      main: 'Airport West (AAW)',
      warning: 'NOT the Monday airport any more: XY12 leaves from East',
    });
  });

  it('a card with no glyph has no warning', () => {
    expect(splitWarning('Old Town (NOT the new town) — Friday')).toEqual({
      main: 'Old Town (NOT the new town) — Friday',
      warning: null,
    });
  });

  it('a card that is only a warning keeps its text as the name', () => {
    expect(splitWarning('⚠️ Closed')).toEqual({ main: '⚠️ Closed', warning: 'Closed' });
  });
});

describe('pass · the moment and the leg', () => {
  it('counts from the real clock on the real day, and from 00:00 on a previewed one', () => {
    const wall = new Date(2027, 2, 4, 13, 2);
    expect(momentOf('2027-03-04', wall)).toBe(wall);
    const other = momentOf('2027-03-09', wall);
    expect([other.getFullYear(), other.getMonth(), other.getDate(), other.getHours(), other.getMinutes()]).toEqual([
      2027, 2, 9, 0, 0,
    ]);
  });

  it('flows only for the next booked leg; paints the past; dots the future; unlit when not booked', () => {
    expect(legState({ status: 'booked', date: '2027-03-04' }, '2027-03-04', true)).toBe('flow');
    expect(legState({ status: 'booked', date: '2027-03-01' }, '2027-03-04', false)).toBe('done');
    expect(legState({ status: 'booked', date: '2027-03-09' }, '2027-03-04', false)).toBe('ahead');
    expect(legState({ status: 'pending', date: '2027-03-04' }, '2027-03-04', true)).toBe('unlit');
  });
});
