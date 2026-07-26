/* The standing parity guard: extracts the REAL legacy DATA, runs the REAL
   transform, and re-checks every assertion on every `npm test`. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertChinaBundle, EXPECTED_COUNTS } from '../../scripts/china/assert';
import { extractLegacyData } from '../../scripts/china/extract';
import { parseOptions, readExtras, readOptions, readPhotoInputs } from '../../scripts/china/inputs';
import { buildChinaBundle, FLIGHT_FARES, parseLegacyStayDates } from '../../scripts/china/transform';
import { daysBetween } from '../lib/logic/dates';
import { ADDRESS_MAX, QUERY_MAX, searchTerms } from '../lib/logic/geo';
import { parseBookedNote, parsePrice, priceRange, sumRanges } from '../lib/logic/prices';

const repo = join(__dirname, '..', '..', '..');
const legacy = extractLegacyData(join(repo, 'legacy', 'index.html'));
const pdf = readFileSync(join(repo, 'sources', 'china-2026', 'China-2026-Flights.pdf'));
const bundle = buildChinaBundle({
  legacy,
  flightsPdf: { base64: pdf.toString('base64'), size: pdf.byteLength },
  photos: readPhotoInputs(repo),
  extras: readExtras(repo),
  options: readOptions(repo),
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

  it('every real stop carries its options and a coordinate', () => {
    for (const s of bundle.stops.filter((st) => st.kind === 'stop')) {
      expect(s.options?.length, `${s.id} options`).toBeGreaterThanOrEqual(2);
      expect(s.coord, `${s.id} coord`).toBeTruthy();
      /* WGS-84, and inside the China/HK box the trip actually stays in. */
      expect(s.coord?.lat).toBeGreaterThan(20);
      expect(s.coord?.lat).toBeLessThan(45);
      expect(s.coord?.lng).toBeGreaterThan(95);
      expect(s.coord?.lng).toBeLessThan(125);
    }
  });

  it('options blocks keep deterministic ids and at least one ⭐ pick per stop', () => {
    const beijing = bundle.stops.find((s) => s.id === 'cn26-stop-beijing');
    expect(beijing?.options?.[0]?.id).toBe('cn26-stop-beijing-o0');
    for (const s of bundle.stops.filter((st) => st.kind === 'stop')) {
      const items = (s.options ?? []).flatMap((b) => b.items);
      expect(items.some((i) => i.startsWith('⭐ ')), `${s.id} has a pick`).toBe(true);
    }
  });

  it('parses the authored options format', () => {
    const blocks = parseOptions('## ⭐ Our picks\n- ⭐ **A** — one\n- B\n\n## ➕ More\n- C\n');
    expect(blocks).toEqual([
      { heading: '⭐ Our picks', items: ['⭐ **A** — one', 'B'] },
      { heading: '➕ More', items: ['C'] },
    ]);
    expect(parseOptions('## Empty\n')).toEqual([]);
    expect(() => parseOptions('- orphan')).toThrow();
  });

  it('place-card coordinates are only where they were verified', () => {
    const places = bundle.showCards.filter((c) => c.kind === 'place');
    const withCoord = places.filter((c) => c.coord);
    expect(places.length).toBe(28);
    /* 20, not 21: 宝钞胡同 left with the hotel that was in it, and the three
       cards added on 2026-07-26 (后海, 太舞滑雪小镇, 解放碑) were never put
       through verify:places, so none of them was given a pin. 护国寺中医医院,
       added the same day for the Dec 8 appointment, WAS name-checked against
       Nominatim under the same POI_KM gate, so it is the twentieth. */
    expect(withCoord.length).toBe(20);
    /* Never for the academy: its address is officially still pending. */
    expect(places.find((c) => c.pending)?.coord).toBeUndefined();
    /* And never for a bed — no hotel address is in the sources. A flight may
       carry one, because it is the airport's, not the hotel's. */
    expect(bundle.bookings.filter((b) => b.kind === 'hotel').every((b) => !b.coord)).toBe(true);
  });

  it('every flight opens the airport it leaves from', () => {
    const flights = bundle.bookings.filter((b) => b.kind === 'flight');
    const by = (no: string) => flights.find((f) => f.kind === 'flight' && f.flightNo === no);
    /* The six mainland airports borrow the driver card's verified name… */
    expect(by('CA 1953')?.mapQuery).toBe('北京首都国际机场'); // departs PEK, not Daxing
    expect(by('MU 733')?.mapQuery).toBe('昆明长水国际机场');
    /* …and the three with no card have their own verified entries. */
    expect(by('EY 608')?.mapQuery).toBe('Ben Gurion Airport');
    expect(by('EY 871')?.mapQuery).toBe('Hong Kong International Airport');
    /* Every one of them resolves to something openable. */
    expect(flights.every((f) => !!f.mapQuery || !!f.coord)).toBe(true);
  });

  it('a bed only carries a location the owner or OpenStreetMap supplied', () => {
    const stays = bundle.bookings.filter((b) => b.kind === 'hotel');
    /* Seven of eleven open. Six by the street address the owner's own
       accommodation document prints; one — the gorge guesthouse, the single
       bed that did not change in the 2026-07-26 swap — by the name that
       verified. No bed carries a NAME this repo has not verified. */
    expect(stays.filter((b) => b.mapQuery || b.address || b.mapUrl).length).toBe(7);
    expect(stays.filter((b) => b.address && !b.mapQuery).length).toBe(6);
    expect(stays.filter((b) => b.mapQuery).length).toBe(1);
    /* The four with nothing ship NOTHING — that is the feature. The document
       gives them no address, and Dali's verified COORDINATE is deliberately
       not used: a bed never ships a coordinate. */
    for (const id of ['cn26-stay-00', 'cn26-stay-01', 'cn26-stay-04', 'cn26-stay-08']) {
      const b = bundle.bookings.find((x) => x.id === id);
      expect(b?.mapQuery, id).toBeUndefined();
      expect(b?.coord, id).toBeUndefined();
      expect(b?.mapUrl, id).toBeUndefined();
      expect(b?.address, id).toBeUndefined();
    }
    expect(bundle.bookings.find((b) => b.id === 'cn26-stay-07')?.mapQuery).toBe('中途客栈');
    expect(bundle.bookings.find((b) => b.id === 'cn26-stay-09')?.address).toBe(
      'Unit 1-1, Building 1, Yunlifang, Changshui Hangcheng',
    );
  });

  it('spots are attached to every real stop, and every one of them opens', () => {
    const spots = bundle.stops.flatMap((s) => s.spots ?? []);
    expect(spots.length).toBeGreaterThanOrEqual(100);
    expect(new Set(spots.map((s) => s.id)).size).toBe(spots.length);
    for (const s of bundle.stops.filter((st) => st.kind === 'stop')) {
      expect(s.spots?.length, `${s.id} spots`).toBeGreaterThanOrEqual(1);
    }
    /* Deterministic ids, and nothing listed that cannot be tapped. */
    const beihai = spots.find((s) => s.id === 'cn26-spot-beijing-beihai');
    expect(beihai).toMatchObject({ name: 'Beihai Park', native: '北海公园', mapQuery: '北海公园', mapCity: '北京' });
    expect(spots.every((s) => !!s.mapQuery || !!s.coord || !!s.mapUrl)).toBe(true);
    /* Rejected candidates stay in the manifest and never reach the seed. */
    expect(spots.find((s) => s.id === 'cn26-spot-dali-renmin-road')).toBeUndefined();
    expect(spots.find((s) => s.id === 'cn26-spot-gorge-tinas')).toBeUndefined();
  });

  it('carries the addresses OpenStreetMap confirmed, and no others', () => {
    const spots = bundle.stops.flatMap((s) => s.spots ?? []);
    const carriers = [...bundle.stops, ...bundle.showCards, ...bundle.bookings, ...spots];
    const withAddress = carriers.filter((e) => e.address);
    /* Whatever the exact count, the shape of every one of them holds. */
    expect(withAddress.length).toBeGreaterThanOrEqual(60);
    for (const e of withAddress) {
      expect(e.address?.trim(), `${e.id} address`).toBe(e.address);
      expect(e.address?.length, `${e.id} address length`).toBeLessThanOrEqual(ADDRESS_MAX);
      /* An address in the seed is the byproduct of a name that verified, so
         there is always something to open beside it — except on a bed, where
         the address transcribed from the owner's accommodation document IS the
         location, exactly as if they had typed it in themselves. */
      const isBed = 'kind' in e && e.kind === 'hotel';
      expect(!!(e.mapQuery || e.mapUrl || e.coord || isBed), `${e.id} has something to open`).toBe(true);
    }
    /* Nothing the document could not address acquired one on the way through. */
    for (const id of ['cn26-stay-00', 'cn26-stay-01', 'cn26-stay-04', 'cn26-stay-08']) {
      expect(bundle.bookings.find((b) => b.id === id)?.address, id).toBeUndefined();
    }
    expect(bundle.showCards.find((c) => c.pending)?.address).toBeUndefined();
  });

  it('an address rides all the way through the bundle, on every kind of carrier', () => {
    /* One worked example per carrier type — a field that silently stops being
       copied in transform.ts would show up here and nowhere else. */
    const hongyadong = bundle.showCards.find((c) => c.id === 'cn26-place-13');
    expect(hongyadong?.mapQuery).toBe('洪崖洞');
    expect(hongyadong?.address, 'the driver card keeps its address').toBeTruthy();
    expect(hongyadong?.address).toContain('渝中区');

    const lijiang = bundle.stops.find((s) => s.id === 'cn26-stop-lijiang');
    expect(lijiang?.address, 'the stop keeps its address').toBe('云南省古城区丽江古城');

    /* A flight borrows the driver card's address along with its name, so the
       button on the ticket and the button on the card search the same string. */
    const ca = bundle.bookings.find((b) => b.kind === 'flight' && b.id === 'cn26-flight-ca1953');
    const pek = bundle.showCards.find((c) => c.id === 'cn26-place-02');
    expect(ca?.address).toBe(pek?.address);
    expect(ca?.address).toBeTruthy();

    const spots = bundle.stops.flatMap((s) => s.spots ?? []);
    expect(spots.filter((s) => s.address).length, 'spots keep theirs').toBeGreaterThanOrEqual(50);
    /* …and every spot still keeps the fields it had before addresses existed. */
    expect(spots.find((s) => s.id === 'cn26-spot-beijing-beihai')).toMatchObject({
      name: 'Beihai Park',
      native: '北海公园',
      mapQuery: '北海公园',
      mapCity: '北京',
    });

    /* A bed rides through with its address and NOTHING else — no name it never
       verified, and no coordinate even where the document prints one. */
    const yuetu = bundle.bookings.find((b) => b.id === 'cn26-stay-06');
    expect(yuetu?.address).toBe('No. 43 Yizheng Jinjia Street, Dayan Ancient Town');
    expect(yuetu?.mapQuery, 'no unverified hotel name goes to a map').toBeUndefined();
    expect(yuetu?.coord, 'still no hotel coordinate, address or not').toBeUndefined();
    /* …and that address alone is what a map search receives. */
    expect(searchTerms({ query: yuetu?.mapQuery, address: yuetu?.address, city: yuetu?.mapCity })).toBe(
      'No. 43 Yizheng Jinjia Street, Dayan Ancient Town',
    );
  });

  it('sends the NAME to a map, and the street only where a chain needs it', () => {
    /* Measured on the phone 2026-07-25: `北京南站 …南站幸福路 北京` buried the
       station under road segments, `北京南站 北京` opened it. The address is
       for the driver card; only an entry that opts in puts it in the search. */
    const station = bundle.showCards.find((x) => x.id === 'cn26-place-03');
    expect(station?.address).toBeTruthy();
    const stationTerms = searchTerms({
      query: station?.mapQuery,
      address: station?.address,
      addressInSearch: station?.addressInSearch,
      city: station?.mapCity,
    });
    expect(stationTerms).toBe('北京南站 北京');

    /* 东来顺 is a chain, so it opts in and the street picks the branch. */
    const spots = bundle.stops.flatMap((s) => s.spots ?? []);
    const chain = spots.find((s) => s.mapQuery === '东来顺');
    expect(chain?.addressInSearch).toBe(true);
    expect(
      searchTerms({ query: chain?.mapQuery, address: chain?.address, addressInSearch: true, city: chain?.mapCity }),
    ).toContain(chain?.address ?? '');

    /* Whatever an entry opts into, every shipped search stays inside the cap. */
    for (const e of [...bundle.stops, ...bundle.showCards, ...bundle.bookings, ...spots]) {
      const terms = searchTerms({
        query: e.mapQuery,
        address: e.address,
        addressInSearch: e.addressInSearch,
        city: e.mapCity,
      });
      expect(terms.length, `${e.id} search length`).toBeLessThanOrEqual(QUERY_MAX);
    }
  });

  it('carries the fares that are actually documented, and invents none', () => {
    /* The guide's booked-flights line: ~$2,026 + $241 + $230 + $293 ≈ $2,790. */
    expect(FLIGHT_FARES).toEqual({ 'CA 1953': '$241', '3U 8011': '$230', 'MU 733': '$293' });
    const flights = bundle.bookings.filter((b) => b.kind === 'flight');
    expect(flights.filter((f) => f.priceNote).length).toBe(3);
    expect(flights.find((f) => f.flightNo === 'CA 1953')?.priceNote).toBe('$241');
    /* The four Etihad legs are one booking at one price; it stays on the stop. */
    expect(flights.filter((f) => f.flightNo.startsWith('EY')).every((f) => !f.priceNote)).toBe(true);
    expect(bundle.stops.find((s) => s.kind === 'transit')?.costNote).toBe('≈$1,050 (booked ~$2,026)');
  });

  it('every price in the seed can be read by the price parser', () => {
    const stays = bundle.bookings.filter((b) => b.kind === 'hotel');
    expect(stays.length).toBe(EXPECTED_COUNTS.stays);
    for (const s of stays) {
      const p = parsePrice(s.priceNote);
      expect(p, `${s.title} — ${s.priceNote}`).not.toBeNull();
      expect(p?.currency).toBe('USD');
    }
    /* what the eleven beds add up to, per-night quotes multiplied by their own nights */
    const rolled = sumRanges(
      stays.map((s) => {
        const p = parsePrice(s.priceNote);
        if (!p || s.kind !== 'hotel') throw new Error(`unparsed: ${s.priceNote}`);
        return priceRange(p, daysBetween(s.checkIn, s.checkOut));
      }),
    );
    /* $2,536 — and that is not a number this test chose. It is what the
       owner's accommodation document totals the eleven refundable rates at,
       arrived at here independently by parsing each bed's own quote. */
    expect(rolled).toEqual({ minMinor: 253600, maxMinor: 253600 });

    const fares = bundle.bookings.filter((b) => b.kind === 'flight' && b.priceNote);
    expect(sumRanges(fares.map((f) => priceRange(parsePrice(f.priceNote)!)))).toEqual({
      minMinor: 76400,
      maxMinor: 76400,
    });
    expect(parseBookedNote(bundle.stops.find((s) => s.kind === 'transit')?.costNote)).toMatchObject({
      minMinor: 202600,
    });
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
