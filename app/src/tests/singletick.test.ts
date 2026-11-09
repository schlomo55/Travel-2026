/* ONE TICK, NOT TWO (QA 9 Nov 2026). The storage line in Settings and Backup
   draws a check icon before its text, so the text itself must not end in ✓
   too — "Installed app — its own protected storage ✓" showed two. */
import { describe, expect, it } from 'vitest';
import { S } from '../lib/i18n/strings';

describe('storage line · one tick', () => {
  it('the strings drawn beside the check icon carry no ✓ of their own', () => {
    for (const s of [S.settings.nativeStore, S.settings.persisted, S.backup.protected]) expect(s).not.toContain('✓');
  });
});
