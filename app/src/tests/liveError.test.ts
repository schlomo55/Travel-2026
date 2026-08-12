import { describe, expect, it } from 'vitest';
import { errorText, firstError } from '../lib/logic/liveError';

/* The failure path of the liveQuery bridge. It existed as a console.error and
   nothing else, so a database that would not read rendered a calm, plausible,
   entirely EMPTY trip: no bookings, no tasks, no bed — the app quietly saying
   "nothing is booked tonight" in the same voice it says the truth. These are
   the two pure pieces that turn that silence into a state TripShell can draw. */
describe('errorText', () => {
  it('takes an Error at its word', () => {
    expect(errorText(new Error('QuotaExceededError: storage is full'))).toBe(
      'QuotaExceededError: storage is full',
    );
  });

  it('accepts a bare string', () => {
    expect(errorText('  UnknownError  ')).toBe('UnknownError');
  });

  /* Dexie and IndexedDB both throw DOMExceptions, which are not Errors in
     every engine — the name is all some of them carry. */
  it('falls back to a DOM-style object’s message, then its name', () => {
    expect(errorText({ name: 'InvalidStateError', message: 'The database is closed' })).toBe(
      'The database is closed',
    );
    expect(errorText({ name: 'VersionError' })).toBe('VersionError');
  });

  /* NEVER EMPTY. An unnameable failure is still a failure, and a blank banner
     would be one more silence. */
  it('never answers with nothing', () => {
    for (const junk of [null, undefined, 0, '', '   ', {}, new Error('')]) {
      expect(errorText(junk).length).toBeGreaterThan(0);
    }
  });
});

describe('firstError', () => {
  it('is null while every table is healthy', () => {
    expect(firstError([null, null, undefined])).toBeNull();
  });

  it('reports the first table that failed', () => {
    expect(firstError([null, 'QuotaExceededError', 'AbortError'])).toBe('QuotaExceededError');
  });

  /* One broken table is enough to make the whole screen a lie. */
  it('does not need every table to fail before it speaks', () => {
    expect(firstError([null, null, null, null, 'DataError'])).toBe('DataError');
  });

  it('ignores an empty string, which is not an error', () => {
    expect(firstError(['', null])).toBeNull();
  });
});
