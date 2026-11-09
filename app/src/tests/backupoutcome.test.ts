/* "LAST BACKUP" MEANS A COPY REALLY LEFT (QA 9 Nov 2026).
 *
 * On the phone the backup leaves through Android's share sheet. The stamp used
 * to be written the moment the sheet opened, so dismissing it still said
 * "Last backup: now" and silenced the reminder. These tests hold the rule:
 * a dismissed sheet writes nothing; a sheet that came back with an app is
 * recorded as `shared` (worded "Last shared"); a browser download as `saved`.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const outcome = { next: 'saved' as 'saved' | 'shared' | 'cancelled' };
vi.mock('../lib/platform/files', async (orig) => {
  const real = await orig<typeof import('../lib/platform/files')>();
  return { ...real, saveFile: vi.fn(async () => outcome.next) };
});

import { db } from '../lib/db/db';
import { exportVault, markCopied } from '../lib/data/export';
import { getSettings } from '../lib/data/repo';
import { isShareCancel } from '../lib/platform/files';
import { fmtStamp } from '../lib/logic/dates';

beforeEach(async () => {
  await db.settings.clear();
});

describe('backup · the stamp waits for the outcome', () => {
  it('a dismissed share sheet records no backup', async () => {
    outcome.next = 'cancelled';
    expect(await exportVault()).toBe('cancelled');
    expect((await getSettings()).lastBackupAt).toBeNull();
  });

  it('a share sheet that came back with an app is recorded as shared, not as a backup', async () => {
    outcome.next = 'shared';
    expect(await exportVault()).toBe('shared');
    const s = await getSettings();
    expect(s.lastBackupAt).toBeTypeOf('number');
    expect(s.lastBackupVia).toBe('shared');
  });

  it('a browser download is recorded as saved', async () => {
    outcome.next = 'saved';
    await exportVault();
    expect((await getSettings()).lastBackupVia).toBe('saved');
  });

  it('a cancel after a real backup leaves the earlier stamp alone', async () => {
    outcome.next = 'saved';
    await exportVault();
    const before = (await getSettings()).lastBackupAt;
    outcome.next = 'cancelled';
    await exportVault();
    expect((await getSettings()).lastBackupAt).toBe(before);
    expect((await getSettings()).lastBackupVia).toBe('saved');
  });

  it('copy-as-text is recorded as copied', async () => {
    await markCopied();
    expect((await getSettings()).lastBackupVia).toBe('copied');
  });

  it('only the share plugin\'s cancel counts as a cancel', () => {
    expect(isShareCancel(new Error('Share canceled'))).toBe(true);
    expect(isShareCancel(new Error('Share cancelled'))).toBe(true);
    expect(isShareCancel(new Error('Unsupported url'))).toBe(false);
    expect(isShareCancel(undefined)).toBe(false);
  });
});

describe('backup · the date reads in the app\'s own format', () => {
  it('weekday, day, month, year and a 24-hour clock — never 11/9/2026, 11:06:14 PM', () => {
    const t = new Date(2026, 10, 9, 23, 6, 14).getTime();
    expect(fmtStamp(t)).toBe('Mon 9 Nov 2026, 23:06');
  });
  it('pads the clock', () => {
    expect(fmtStamp(new Date(2026, 0, 5, 7, 3).getTime())).toBe('Mon 5 Jan 2026, 07:03');
  });
});
