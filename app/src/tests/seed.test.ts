/* The standing parity guard: extracts the REAL legacy DATA, runs the REAL
   transform, and re-checks every assertion on every `npm test`. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertChinaBundle, EXPECTED_COUNTS } from '../../scripts/china/assert';
import { extractLegacyData } from '../../scripts/china/extract';
import { readExtras, readPhotoInputs } from '../../scripts/china/inputs';
import { buildChinaBundle, parseLegacyStayDates } from '../../scripts/china/transform';

const repo = join(__dirname, '..', '..', '..');
const legacy = extractLegacyData(join(repo, 'legacy', 'index.html'));
const pdf = readFileSync(join(repo, 'sources', 'china-2026', 'China-2026-Flights.pdf'));
const bundle = buildChinaBundle({
  legacy,
  flightsPdf: { base64: pdf.toString('base64'), size: pdf.byteLength },
  photos: readPhotoInputs(repo),
  extras: readExtras(repo),
});

describe('china seed', () => {
  it('extracts the legacy DATA object intact', () => {
    expect(legacy.trip.start).toBe('2026-11-21');
    expect(legacy.trip.visaDeadline).toBe('2026-12-22');
    expect(legacy.stops.length).toBe(EXPECTED_COUNTS.stops);
  });

  it('passes every structural, value and privacy assertion', () => {
    const report = assertChinaBundle(bundle, join(repo, 'sources', 'china-2026', 'china-2026-handoff-prompt.md'));
    const failures = report.lines.filter((l) => l.startsWith('✗'));
    expect(failures).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('keeps the six hard travel days runbook-linked', () => {
    const byDate = new Map(bundle.dayPlans.map((d) => [d.date, d]));
    expect(byDate.get('2026-11-21')?.runbookId).toBe('cn26-run-dep');
    expect(byDate.get('2026-11-22')?.runbookId).toBe('cn26-run-arrive');
    expect(byDate.get('2026-12-11')?.runbookId).toBe('cn26-run-dec11');
    expect(byDate.get('2026-12-16')?.runbookId).toBe('cn26-run-dec16');
    expect(byDate.get('2026-12-21')?.runbookId).toBe('cn26-run-exit');
    expect(byDate.get('2026-12-26')?.runbookId).toBe('cn26-run-home');
  });

  it('converts legacy HTML to md-lite (no raw tags in the seed)', () => {
    const text = JSON.stringify({ ...bundle, documents: [] });
    expect(text).not.toMatch(/<b>|<a |<br>|&amp;|&lt;/);
  });

  it('keeps legacy tick-key mappings derivable (task-*, pk-*, app-*, alarm-<i>)', () => {
    expect(bundle.tasks.find((t) => t.id === 'cn26-task-insurance')).toBeTruthy();
    expect(bundle.packingItems.find((p) => p.id === 'cn26-pack-p-passport')).toBeTruthy();
    expect(bundle.checklists[0]?.items.find((i) => i.id === 'cn26-app-a-vpn')).toBeTruthy();
    expect(bundle.alarms[4]?.id).toBe('cn26-alarm-04'); // Forbidden City release, 5th alarm
  });

  it('parses legacy stay dates', () => {
    expect(parseLegacyStayDates('Dec 5 – 7')).toEqual(['2026-12-05', '2026-12-07']);
    expect(parseLegacyStayDates('Dec 21 – 26')).toEqual(['2026-12-21', '2026-12-26']);
    expect(() => parseLegacyStayDates('Nov 5 – 7')).toThrow();
  });

  it('gift-card balance arrives as integer minor units', () => {
    const gift = bundle.walletCards.find((c) => c.id === 'cn26-card-giftcard');
    expect(gift?.balance).toEqual({ amountMinor: 29770, currency: 'USD' });
  });

  it('the pinned visa counter matches the legacy math', () => {
    const c = bundle.counters[0];
    expect(c).toMatchObject({
      startDate: '2026-11-22',
      countStartsDayAfter: true,
      limitDays: 30,
      hardDeadline: '2026-12-22',
      plannedEndDate: '2026-12-21',
      pinned: true,
    });
  });
});
