/* A 24-HOUR TIME, AS TYPED (lib/logic/clock24.ts) — every time field goes
   through it since the phone's own time picker asked a 12-hour phone for AM/PM
   and turned "20:00" into "02:00 --". */
import { describe, expect, it } from 'vitest';
import { parseClock24, shapeClock24 } from '../lib/logic/clock24';
import type { HHMM } from '../lib/model/types';

describe('clock24 · reading what was typed', () => {
  it('reads a 24-hour time in the shapes people type it', () => {
    expect(parseClock24('20:00')).toBe('20:00');
    expect(parseClock24('2000')).toBe('20:00');
    expect(parseClock24('20.00')).toBe('20:00');
    expect(parseClock24('20h00')).toBe('20:00');
    expect(parseClock24(' 8:5 ')).toBe('08:05');
    expect(parseClock24('800')).toBe('08:00');
    expect(parseClock24('20')).toBe('20:00');
    expect(parseClock24('8')).toBe('08:00');
    expect(parseClock24('0000')).toBe('00:00');
    expect(parseClock24('23:59')).toBe('23:59');
  });
  it('an empty field is empty, never midnight', () => {
    expect(parseClock24('')).toBe('');
    expect(parseClock24('   ')).toBe('');
  });
  it('refuses what is not a 24-hour time — no AM/PM, no 24:00, no 60 minutes', () => {
    for (const t of ['24:00', '2400', '12:60', '8pm', '8:00 PM', 'abc', '12345', '1:2:3', '-1']) {
      expect(parseClock24(t), t).toBeNull();
    }
  });
});

describe('clock24 · shaping while typing', () => {
  it('puts the colon in after a two-digit hour once four digits are in, and stops at HH:MM', () => {
    expect(shapeClock24('2')).toBe('2');
    expect(shapeClock24('20')).toBe('20');
    expect(shapeClock24('2000')).toBe('20:00');
    expect(shapeClock24('0930')).toBe('09:30');
    expect(shapeClock24('200000')).toBe('20:00');
  });
  it('puts it after a one-digit hour as soon as two digits cannot be an hour', () => {
    expect(shapeClock24('9')).toBe('9');
    expect(shapeClock24('93')).toBe('9:3');
    expect(shapeClock24('930')).toBe('9:30');
    expect(shapeClock24('9300')).toBe('9:30');
    expect(shapeClock24('800')).toBe('8:00');
  });
  it('leaves three digits that could go either way as digits, read as H:MM', () => {
    expect(shapeClock24('200')).toBe('200');
    expect(shapeClock24('130')).toBe('130');
    expect(parseClock24(shapeClock24('130'))).toBe('01:30');
  });
  it('every time typed digit by digit ends as the time meant', () => {
    const typed = (digits: string): HHMM | '' | null => {
      let v = '';
      for (const c of digits) v = shapeClock24(v + c);
      return parseClock24(v);
    };
    expect(typed('930')).toBe('09:30');
    expect(typed('0930')).toBe('09:30');
    expect(typed('2000')).toBe('20:00');
    expect(typed('800')).toBe('08:00');
    expect(typed('130')).toBe('01:30');
    expect(typed('1300')).toBe('13:00');
    expect(typed('2359')).toBe('23:59');
    expect(typed('20')).toBe('20:00');
    expect(typed('9')).toBe('09:00');
  });
  it('leaves a typed separator alone', () => {
    expect(shapeClock24('8:30')).toBe('8:30');
    expect(shapeClock24('20:00')).toBe('20:00');
  });
});
