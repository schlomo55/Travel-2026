/* The standing parity guard: extracts the REAL legacy DATA, runs the REAL
   transform, and re-checks every assertion on every `npm test`. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertChinaBundle, EXPECTED_COUNTS } from '../../scripts/china/assert';
import { DAY_DEFAULT_PLACES, DAY_PLACES } from '../../scripts/china/day-places';
import { extractLegacyData } from '../../scripts/china/extract';
import { parseOptions, readExtras, readOptions, readPhotoInputs } from '../../scripts/china/inputs';
import { buildChinaBundle, FLIGHT_FARES, parseLegacyStayDates } from '../../scripts/china/transform';
import { daysBetween } from '../lib/logic/dates';
import { ADDRESS_MAX, QUERY_MAX, isHongKongOrMacau, searchTerms } from '../lib/logic/geo';
import { minorToHome } from '../lib/logic/money';
import { isOpenable, placeIndex, resolvePlaces } from '../lib/logic/places';
import { resolveDay } from '../lib/logic/day';
import { parseBookedNote, parsePrice, priceRange, sumRanges, tripSymbols } from '../lib/logic/prices';

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
    /* SPENT, 2026-07-27 — the owner: "i finish my coupon nothing left". Zero,
       and the balance field must still be PRESENT: "$0" and "we never tracked
       it" are different claims, and only the first one is true. Which bookings
       absorbed it is unknown and stays unknown, so no bed's price or payment
       mode was adjusted for it. */
    const gift = bundle.walletCards.find((c) => c.id === 'cn26-card-giftcard');
    expect(gift?.balance).toEqual({ amountMinor: 0, currency: 'USD' });
    expect(
      JSON.stringify([bundle.walletCards, bundle.tasks, bundle.infoCards]),
      'no screen may still offer the old ~$298 to spend',
    ).not.toMatch(/29[78]\b/);
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
    /* 22 since 2026-07-28, and the two that arrived are the point of that day.
       It was 20: 宝钞胡同 left with the hotel that was in it, and the three cards
       added on 2026-07-26 (后海, 太舞滑雪小镇, 解放碑) were never put through
       verify:places, so none was given a pin — 护国寺中医医院, added the same day
       and name-checked by hand under the same POI_KM gate, was the twentieth.
       The gate run of 2026-07-28 then demoted 后海 and 解放碑 precisely BECAUSE
       they had no pin, and the owner answered with the missing yardstick rather
       than with a missing button: Wikidata Q1136851 什刹海 and Q6683399
       抗战胜利纪功碑暨人民解放纪念碑, both sourced independently of OpenStreetMap.
       太舞滑雪小镇 is still pinless, and still ships nothing at all. */
    expect(withCoord.length).toBe(22);
    expect(places.find((c) => c.id === 'cn26-place-25')?.coord, 'Thaiwoo still has none').toBeUndefined();
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

  it('the five train journeys ship as cards, and not one of them claims to be booked', () => {
    /* Added 2026-07-28 (scripts/china/rail.ts). Nothing was added to the TRIP:
       these five legs have been in its day plans since the first build and had
       simply never become bookings, so the concourse screen showed flights and
       beds and nothing about the train you were standing in front of. */
    const trains = bundle.bookings.filter((b) => b.kind === 'train');
    expect(trains.map((t) => t.id)).toEqual([
      'cn26-train-nov22',
      'cn26-train-dec09',
      'cn26-train-dec11',
      'cn26-train-dec14',
      'cn26-train-dec20',
    ]);
    /* The whole set is unbooked, and each card has to keep saying so. No
       confirmation number, and no `priceNote`: the fares the documents state
       are estimates for tickets nobody owns, and `priceNote` is what the money
       screen totals as committed. They ride as chips instead. */
    for (const t of trains) {
      expect(t.status, t.id).toBe('pending');
      expect(t.code, t.id).toBeUndefined();
      expect(t.priceNote, `${t.id} must not put an unbought fare into the booked total`).toBeUndefined();
      expect(t.meta.some((m) => /fare/i.test(m.k)), `${t.id} still shows the documented fare`).toBe(true);
      expect(t.bookingLinkUrl, `${t.id} offers the one thing an unbooked ticket affords`).toBe(
        'https://www.trip.com/trains/',
      );
    }
  });

  it('a rail end opens the stations the documents name, and nothing they do not', () => {
    const trains = bundle.bookings.filter((b) => b.kind === 'train');
    const leg = (id: string) => trains.find((t) => t.id === id);
    const names = (e: { stations?: { name: string }[] } | undefined) => (e?.stations ?? []).map((s) => s.name);

    /* DEC 9 IS THE TWO-STATION CASE, and the reason `stations` is a list. The
       plan says "Beijing North / Qinghe" — it names both and chooses neither —
       so the card opens both. Collapsing that to one would be inventing a
       decision nobody has made. */
    expect(names(leg('cn26-train-dec09')?.from)).toEqual(['北京北站', '清河站']);
    expect(leg('cn26-train-dec09')?.from.name).toBe('Beijing North / Qinghe');
    expect(names(leg('cn26-train-dec09')?.to)).toEqual(['太子城站']);

    /* Each button is BORROWED from an entity that already passed the gate —
       Phase 2's spots and the driver cards — never composed here. */
    const spots = bundle.stops.flatMap((s) => s.spots ?? []);
    const qinghe = leg('cn26-train-dec09')?.from.stations?.[1];
    expect(qinghe?.mapQuery).toBe(spots.find((s) => s.id === 'cn26-spot-beijing-qinghe')?.mapQuery);
    expect(qinghe?.mapCity).toBe(spots.find((s) => s.id === 'cn26-spot-beijing-qinghe')?.mapCity);
    const taizicheng = leg('cn26-train-dec09')?.to.stations?.[0];
    const card08 = bundle.showCards.find((c) => c.id === 'cn26-place-08');
    expect(taizicheng?.mapQuery).toBe(card08?.mapQuery);
    expect(taizicheng?.coord).toEqual(card08?.coord);

    /* THE FOUR ENDS NO DOCUMENT NAMES. Each ships no button and says why on the
       card — Chongqing because it has two main stations far apart, Dali because
       "the station is in Xiaguan" does not say which station, Dec 11's Beijing
       because the day says only "back to Beijing", and Yantai because the plan
       names the city and no station in it. */
    for (const [id, side] of [
      ['cn26-train-nov22', 'to'],
      ['cn26-train-dec11', 'to'],
      ['cn26-train-dec14', 'to'],
      ['cn26-train-dec20', 'from'],
    ] as const) {
      const end = side === 'to' ? leg(id)?.to : leg(id)?.from;
      expect(end?.stations, `${id} ${side} ships no button`).toBeUndefined();
      expect(end?.why?.trim(), `${id} ${side} says why`).toBeTruthy();
    }
    /* No Chongqing station may be OPENABLE from a rail card. 重庆北 and 重庆西 are
       named once, inside the Dec 14 `why` — that is the card explaining that it
       will not choose between them, which is the opposite of choosing — and
       neither may reach a button or a search. */
    const stationText = trains
      .flatMap((t) => [...(t.from.stations ?? []), ...(t.to.stations ?? [])])
      .flatMap((s) => [s.name, s.mapQuery ?? '', s.mapCity ?? '', s.address ?? ''])
      .join(' ');
    expect(stationText, 'no Chongqing station is guessed at').not.toMatch(/重庆/);
    expect(leg('cn26-train-dec14')?.to.why, 'and the card says why it will not').toMatch(/重庆北/);
    /* And the ends that ARE named are the four the documents give. */
    expect(names(leg('cn26-train-nov22')?.from)).toEqual(['北京大兴国际机场', '北京南站']);
    expect(names(leg('cn26-train-dec11')?.from)).toEqual(['太子城站']);
    expect(names(leg('cn26-train-dec14')?.from)).toEqual(['张家界西站']);
    expect(names(leg('cn26-train-dec20')?.to)).toEqual(['昆明南站']);
  });

  it('a bed only carries a location the owner or OpenStreetMap supplied', () => {
    const stays = bundle.bookings.filter((b) => b.kind === 'hotel');
    /* TEN of eleven open. Eight by a street address off the owner's own
       paperwork — six from the accommodation document, plus Four Points and
       Dali, whose addresses arrived with their confirmations on 2026-07-27 —
       and TWO by a name: the gorge guesthouse, the single bed that did not
       change in the 2026-07-26 swap, and Huatian Grand, promoted on 2026-07-28
       when OpenStreetMap and the accommodation document's own "450 m from the
       Tianmen cableway" were found to agree. No bed carries a NAME this repo
       has not verified, and that did not soften — it took two sources. */
    expect(stays.filter((b) => b.mapQuery || b.address || b.mapUrl).length).toBe(10);
    expect(stays.filter((b) => b.address && !b.mapQuery).length).toBe(8);
    expect(stays.filter((b) => b.mapQuery).length).toBe(2);
    expect(bundle.bookings.find((b) => b.id === 'cn26-stay-00')?.address).toBe(
      'No. 20 Gongti East Road, Chaoyang District, Beijing, China',
    );
    /* Booking Chongli and Hong Kong on 2026-07-27 changed the PROVENANCE of two
       of those seven without changing the count: Element's Agoda page reprinted
       the address this repo already shipped, and the Royal Garden's direct
       booking replaced the document's short line with the hotel's own fuller
       one. Both still open by street and by nothing else. */
    expect(bundle.bookings.find((b) => b.id === 'cn26-stay-10')?.address).toBe(
      '69 Mody Road, Tsimshatsui East, Kowloon, Hong Kong',
    );
    expect(bundle.bookings.find((b) => b.id === 'cn26-stay-02')?.address).toBe(
      'Block I, Thaiwoo Ski Resort & Alpine Park, Sitaizui County',
    );
    for (const id of ['cn26-stay-02', 'cn26-stay-10']) {
      expect(bundle.bookings.find((b) => b.id === id)?.mapQuery, id).toBeUndefined();
      expect(bundle.bookings.find((b) => b.id === id)?.coord, id).toBeUndefined();
    }
    /* DALI joined the addressed beds on 2026-07-27 evening. Its entry had only
       a verified COORDINATE — which a bed never ships — and its Booking.com
       confirmation printed a street, so the confirmation supplied what the
       document never had, exactly as Four Points' did. The line is transcribed
       verbatim, postcode and city included: cutting the postcode would also cut
       "Dali", and the coordinate is still nowhere in the seed. */
    expect(bundle.bookings.find((b) => b.id === 'cn26-stay-08')?.address).toBe(
      'No.133, Yinxian Road, Shuidui Village, 671003 Dali, China',
    );
    expect(JSON.stringify(bundle.bookings)).not.toMatch(/25\.6957|100\.1537/);
    /* The one with nothing ships NOTHING — that is the feature. No paperwork
       addresses it, and the 2026-07-28 re-attempt found only its hutong, which
       is a street and not a door. It is BOOKED: being booked is not the same as
       being locatable. */
    for (const id of ['cn26-stay-01']) {
      const b = bundle.bookings.find((x) => x.id === id);
      expect(b?.mapQuery, id).toBeUndefined();
      expect(b?.coord, id).toBeUndefined();
      expect(b?.mapUrl, id).toBeUndefined();
      expect(b?.address, id).toBeUndefined();
    }
    expect(bundle.bookings.find((b) => b.id === 'cn26-stay-07')?.mapQuery).toBe('中途客栈');
    /* HUATIAN, PROMOTED 2026-07-28 — the second bed on the trip to open by a
       name, and the first ever promoted rather than inherited. It took two
       independent sources: OpenStreetMap knows 华天大酒店, 张家界 as the property,
       and the accommodation document's own "450 m from the Tianmen cableway"
       puts it in the same place, measured from the coordinate this repo had
       already verified for place card 11. It still ships NO coordinate and NO
       address — a bed never ships a dot, and its Trip.com booking prints no
       street. */
    const huatian = bundle.bookings.find((b) => b.id === 'cn26-stay-04');
    expect(huatian?.mapQuery).toBe('华天大酒店');
    expect(huatian?.mapCity).toBe('张家界');
    expect(huatian?.coord, 'a bed never ships a dot').toBeUndefined();
    expect(huatian?.address, 'the booking prints no street').toBeUndefined();
    /* THE IBIS ADDRESS DID NOT MOVE when the bed was booked. Its Trip.com order
       prints a fuller line that is not a superset of this one (district added,
       unit dropped) and is 82 chars, so adopting it would mean a trim that
       deletes "Kunming". One source ships whole; the order's version rides on
       the note. */
    const ibis = bundle.bookings.find((b) => b.id === 'cn26-stay-09');
    expect(ibis?.address).toBe('Unit 1-1, Building 1, Yunlifang, Changshui Hangcheng');
    expect(ibis?.note).toMatch(/Guandu District/);
    expect(ibis?.address).not.toMatch(/Guandu/);
  });

  it('the ten booked beds carry what a check-in desk asks for', () => {
    const stays = bundle.bookings.filter((b) => b.kind === 'hotel');
    expect(stays.filter((b) => b.status === 'booked').map((b) => b.id)).toEqual([
      'cn26-stay-00',
      'cn26-stay-01',
      'cn26-stay-02',
      'cn26-stay-03',
      'cn26-stay-04',
      'cn26-stay-05',
      'cn26-stay-06',
      'cn26-stay-08',
      'cn26-stay-09',
      'cn26-stay-10',
    ]);
    /* NOTHING IS PENDING ANY MORE. The gorge guesthouse is the only unbooked
       bed and it is a deliberate walk-in. */
    expect(stays.filter((b) => b.status === 'pending').length).toBe(0);
    expect(stays.filter((b) => b.status === 'walkin').length).toBe(1);

    /* THE OWNER'S RULE, 2026-07-27: a booked bed shows its price, that it IS
       booked, and a link to the site it was booked on — an honest platform
       entry point where no deep link to the reservation was ever supplied, and
       never a guessed order URL. Element used to be here WITHOUT a confirmation
       number, which was the point: not knowing the number is a different
       admission from not being able to reach the order. Its number arrived on
       29 Jul 2026 and the link rule is unchanged — the link is still Agoda's
       bookings list, not a deep link nobody ever supplied. */
    const links: Record<string, string> = {
      'cn26-stay-00': 'https://www.trip.com/account/orderlist/',
      'cn26-stay-01': 'https://www.trip.com/account/orderlist/',
      'cn26-stay-02': 'https://www.agoda.com/account/bookings.html',
      'cn26-stay-03': 'https://www.agoda.com/account/bookings.html',
      'cn26-stay-04': 'https://www.trip.com/account/orderlist/',
      'cn26-stay-05': 'https://www.trip.com/account/orderlist/',
      'cn26-stay-06': 'https://secure.booking.com/mytrips.html',
      'cn26-stay-08': 'https://secure.booking.com/mytrips.html',
      'cn26-stay-09': 'https://www.trip.com/account/orderlist/',
      'cn26-stay-10': 'https://www.rghk.com.hk/en/index.php',
    };
    for (const b of stays.filter((s) => s.status === 'booked')) {
      expect(b.priceNote, `${b.id} price`).toBeTruthy();
      expect(b.manageUrl, `${b.id} manage link`).toBe(links[b.id]);
    }

    /* FOUR POINTS WAS REBOOKED on 2026-07-27 at a better rate, and a rebooking
       kills the old order's terms. The live Trip.com order states a price, a
       room and a guest name — and no PIN, no payment mode and no cancellation
       deadline. So the card carries the new number with NO secondary line, and
       says "not stated" where it used to reprint the dead order's $144.84 hold
       and its 16:00-Dec-5 window. */
    const fp = stays.find((b) => b.id === 'cn26-stay-00');
    expect(fp?.code).toBe('1653715561783471');
    expect(fp?.codeLabel).toBe('Trip.com booking');
    expect(fp?.codeSub, 'the replacement order showed no PIN, so none is invented').toBeUndefined();
    expect(fp?.priceNote).toBe('$244.74 (2n)');
    expect(fp?.manageUrl).toBe('https://www.trip.com/account/orderlist/');
    expect(fp?.meta.find((m) => m.k === 'Free cancel')?.v).toBe('not stated — ask');
    expect(fp?.meta.find((m) => m.k === 'Payment')?.v).toBe('not stated — ask');
    expect(fp?.meta.map((m) => m.v).join(' '), 'the dead deadline may not survive as a chip').not.toMatch(/16:00/);
    expect(fp?.bookingLinkUrl, 'a held booking does not link to a search').toBeUndefined();
    /* And the superseded credentials are gone from the WHOLE bundle, not just
       from this card. A dead number beside a live booking is what gets read out
       at a desk at 23:00. */
    const whole = JSON.stringify({ ...bundle, documents: bundle.documents.map((d) => d.meta) });
    expect(whole, 'the superseded order number must not survive anywhere').not.toContain('1653715561596848');
    expect(whole, 'nor its PIN').not.toMatch(/9858/);

    /* Blossom House got its two missing facts on 2026-07-27: the platform was
       Trip.com all along and the order number was on the same bookings list.
       The two that can still cost money — payment mode and the cancellation
       cut-off — are still blank, and the card says so rather than guessing.
       The heating question is settled and must read that way. */
    const bh = stays.find((b) => b.id === 'cn26-stay-01');
    expect(bh?.status).toBe('booked');
    expect(bh?.code).toBe('1653715561827302');
    expect(bh?.codeLabel).toBe('Trip.com booking');
    expect(bh?.codeSub, 'no PIN was shown for it').toBeUndefined();
    expect(bh?.manageUrl).toBe('https://www.trip.com/account/orderlist/');
    expect(bh?.bookingLinkUrl, 'a held booking does not link back to a search').toBeUndefined();
    expect(bh?.priceNote).toBe('$299.56 (2n)');
    expect(bh?.meta.find((m) => m.k === 'Payment')?.v).toBe('not stated — ask');
    expect(bh?.meta.find((m) => m.k === 'Free cancel')?.v).toMatch(/no deadline shown/i);
    expect(bh?.note).toMatch(/heating confirmed before booking/i);
    expect(bh?.note, 'the old warning must not survive').not.toMatch(/confirm heating before paying/i);
    expect(bh?.note, 'and neither may the two blanks it no longer has').not.toMatch(/platform.{0,20}unknown/i);

    /* Element Chongli, booked on Agoda the same day, and the LAST bed on the
       trip to get a number — it arrived 29 Jul 2026, two days after booking,
       and until then this test asserted the opposite. It also carries the one
       deadline on this trip that bites BEFORE its own check-in day.
       The `codeSub` is not a PIN: Agoda sold a room allotted from booking.com,
       so the property may know the stay by 5351254076 rather than the Agoda
       ID, and a desk that cannot find one needs the other. */
    const el = stays.find((b) => b.id === 'cn26-stay-02');
    expect(el?.status).toBe('booked');
    expect(el?.priceNote).toBe('$232.95 (2n)');
    expect(el?.code, 'the Agoda booking ID, supplied 29 Jul 2026').toBe('683386279');
    expect(el?.codeSub, 'the booking.com allotment number the hotel files it under').toMatch(/5351254076/);
    expect(el?.bookingLinkUrl, 'a held booking does not link back to a search').toBeUndefined();
    /* No Agoda order URL was ever supplied, and none is invented: the link is
       Agoda's own bookings list, where this order and its number actually live.
       "We were never given the number" and "you cannot reach the order" are
       different admissions, and only the first one is true here. */
    expect(el?.manageUrl).toBe('https://www.agoda.com/account/bookings.html');
    expect(el?.meta.find((m) => m.k === 'Free cancel')?.v).toMatch(/00:00 Dec 9/);
    expect(el?.meta.find((m) => m.k === 'Breakfast')?.v).toBe('included');
    expect(el?.note).toMatch(/1,575\.99/);

    /* The Royal Garden, booked DIRECT with the hotel. Its reservation number is
       the whole credential — no OTA account holds a copy — so it gets the big
       type, with "booked direct" rather than a PIN in the small line. */
    const rg = stays.find((b) => b.id === 'cn26-stay-10');
    expect(rg?.status).toBe('booked');
    expect(rg?.code).toBe('cohTex87hq19CnTh');
    expect(rg?.codeLabel).toBe('Reservation number');
    expect(rg?.codeSub).toMatch(/direct/i);
    expect(rg?.priceNote, 'the TOTAL, not the subtotal that omits tax').toBe('$1,232.01 (5n)');
    expect(rg?.note, 'the subtotal must not be mistaken for the price').toMatch(/1,090\.28/);
    expect(rg?.meta.find((m) => m.k === 'Check-out')?.v).toBe('before 11:00');
    expect(rg?.meta.find((m) => m.k === 'Free cancel')?.v).toMatch(/14:00 Dec 19/);
    expect(rg?.meta.find((m) => m.k === 'Breakfast')?.v).toBe('not included');
    expect(rg?.bookingLinkUrl, 'a held booking does not link back to a search').toBeUndefined();
  });

  it('Yue Tu carries its approved late arrival, its refund cliff and its prepayment', () => {
    /* The trip's designated late-arrival night (3U8011 lands 22:00 at 2,400 m),
       and the first bed that ever took money before departure. Three facts have
       to survive to the card: the arrival window the property APPROVED, the
       14 Dec cliff that prices a cancellation at one night, and the fact that
       the first night is already paid. */
    const b = bundle.bookings.find((x) => x.id === 'cn26-stay-06');
    expect(b?.status).toBe('booked');
    expect(b?.code).toBe('5942328968');
    expect(b?.codeLabel).toBe('Booking.com confirmation');
    expect(b?.codeSub, 'the PIN rides under the number, never in it').toContain('3635');
    expect(b?.code).not.toContain('3635');
    /* No deep link to this reservation was ever captured, and none is invented:
       the link is Booking.com's own My Trips entry point, added 2026-07-27 when
       the owner asked every booked bed for a way back to the site it was booked
       on. It is labelled as the platform, not dressed up as this order. */
    expect(b?.manageUrl).toBe('https://secure.booking.com/mytrips.html');
    expect(b?.bookingLinkUrl, 'a held booking does not link back to a search').toBeUndefined();
    const chips = new Map((b?.meta ?? []).map((m) => [m.k, m.v]));
    expect(chips.get('Late arrival')).toBe('22:00–23:00 APPROVED');
    expect(chips.get('Free cancel')).toBe('to 23:59 Dec 13');
    expect(chips.get('Then')).toBe('US$63 from 00:00 Dec 14');
    expect(chips.get('Payment')).toMatch(/1st night charged at booking/i);
    expect(chips.get('Front desk')).toBe('24 hours');
    /* The postcode arrived with the confirmation and rides in the note, never
       in the address — an address is transcribed from one source, not two. */
    expect(b?.address).toBe('No. 43 Yizheng Jinjia Street, Dayan Ancient Town');
    expect(b?.note).toMatch(/674100/);
    expect(b?.address).not.toMatch(/674100/);
    /* Yue Tu's first night, in the currency the charge is made in — one of the
       two lodging expenses on the trip. The other is the ibis Kunming night,
       prepaid in full and already in the home currency; it has its own test. */
    const lodging = bundle.expenses.filter((e) => e.categoryId === 'cn26-cat-lodging');
    expect(lodging.length, 'exactly two beds have taken money').toBe(2);
    expect(lodging.find((e) => e.id === 'cn26-exp-prepaid-yuetu-night1')).toMatchObject({
      currency: 'CNY',
      amount: 428.65,
      rateToHome: 7.15,
      homeMinor: 5995,
      refund: false,
    });
    /* And the conversion is the app's own arithmetic, not a typed-in number. */
    expect(lodging.find((e) => e.id === 'cn26-exp-prepaid-yuetu-night1')?.homeMinor).toBe(
      Math.round((428.65 / 7.15) * 100),
    );
  });

  it('Dali carries its full-price cliff, its 23:00 desk and an arrival nobody declared', () => {
    /* The second bed on the trip that reaches a 100% loss, and the ONE booked
       bed where the standing "always declare a late arrival" rule is still
       unsatisfied: the desk shuts at 23:00 — an hour before Yue Tu's midnight —
       on the evening the owner arrives by shared car off the gorge road. */
    const b = bundle.bookings.find((x) => x.id === 'cn26-stay-08');
    expect(b?.status).toBe('booked');
    expect(b?.code).toBe('6352597569');
    expect(b?.codeLabel).toBe('Booking.com confirmation');
    expect(b?.codeSub, 'the PIN rides under the number, never in it').toContain('8706');
    expect(b?.code).not.toContain('8706');
    expect(b?.priceNote, 'the page named CNY as the currency of the charge').toBe('¥324.00');
    const chips = new Map((b?.meta ?? []).map((m) => [m.k, m.v]));
    expect(chips.get('Free cancel')).toBe('to 23:59 Dec 15');
    expect(chips.get('Then')).toMatch(/¥324 in full from 00:00 Dec 16/);
    expect(chips.get('Late arrival')).toMatch(/NOT declared/);
    expect(chips.get('Late arrival')).toMatch(/23:00/);
    expect(chips.get('Check-in')).toMatch(/14:00–23:00/);
    expect(chips.get('Payment'), 'the confirmation stated none').toMatch(/not stated/i);
  });

  it('the ibis is booked, paid in full, and confirmed', () => {
    /* THE VISA-EXIT NIGHT. Trip.com had the money and a number on 27 Jul while
       the property had not accepted and the order page offered "Expedite
       Booking"; it accepted on 29 Jul. Recorded as booked throughout because it
       was paid and numbered, with each state carried honestly in turn — first an
       alert-styled note and a chip in the platform's own word, now a plain note
       and CONFIRMED. The old warning must not outlive its truth. Its free
       airport transfer is the operational reason the bed exists at all, so it
       rides on the card, not in prose. */
    const b = bundle.bookings.find((x) => x.id === 'cn26-stay-09');
    expect(b?.status).toBe('booked');
    expect(b?.code).toBe('1653715562519718');
    expect(b?.codeSub).toContain('2284');
    expect(b?.priceNote, 'this order charged US dollars and printed no yuan').toBe('$25.73');
    const chips = new Map((b?.meta ?? []).map((m) => [m.k, m.v]));
    expect(chips.get('Status'), 'the property accepted on 29 Jul 2026').toMatch(/CONFIRMED/);
    expect(chips.get('Status')).not.toMatch(/CONFIRMING/i);
    expect(chips.get('Free cancel')).toBe('to 23:00 Dec 17');
    expect(chips.get('Shuttle')).toMatch(/free airport transfer/i);
    expect(chips.get('Payment')).toMatch(/PREPAID ONLINE/i);
    expect(chips.get('Smoking'), 'recorded as printed — ask at the desk').toMatch(/SMOKING PERMITTED/i);
    /* The note carried the unaccepted state for two days and must not carry it
       now that the order reads Confirmed — on the visa-exit night above all. */
    expect(b?.note).not.toMatch(/still reads "Confirming"|NOT "CONFIRMED"/i);
    expect(b?.alert).not.toBe(true);
    /* Paid, in the home currency, so no rate is involved at all. */
    const paid = bundle.expenses.find((e) => e.id === 'cn26-exp-prepaid-ibis-kunming');
    expect(paid).toMatchObject({
      categoryId: 'cn26-cat-lodging',
      currency: 'USD',
      amount: 25.73,
      rateToHome: 1,
      homeMinor: 2573,
      refund: false,
    });
  });

  it('the five yuan bookings quote yuan, and invent or borrow no dollar price', () => {
    /* Pullman, Huatian and Glenview printed NO USD figure at all — unlike Four
       Points and Element, whose confirmations showed both currencies. So each
       card carries the yuan it was actually quoted in, and the app converts at
       the trip's own stored rate (CNY 7.15 = USD 1). A dollar priceNote here
       would be a number no paperwork ever stated.

       YUE TU is the fourth and got here differently: its Booking.com page
       printed BOTH currencies and then disclaimed the dollar one — the charge
       happens in CNY, the USD is a converted display, the rate may move. Its
       US$126.55 against ¥857.30 is a rate of ≈6.774, which is the OTA display
       rate this repo has refused to mix in since Pullman. So ¥857.30 is the
       price and $119.90 is derived at 7.15 like the others.

       DALI is the fifth, by Yue Tu's road exactly: same platform, both
       currencies, and a cancellation clause that quotes the penalty as
       "CNY 324 (US$47.83)" — yuan first, which is the page naming the currency
       of the charge. US$47.83 ÷ ¥324 is ≈6.774 again, to three decimals.

       THE IBIS IS NOT IN THIS LIST, and that is the rule working rather than an
       exception to it. Its Trip.com order priced the night in US dollars, took
       US dollars and printed no yuan at all, so $25.73 is what it carries. The
       rule is "carry what will actually be charged", never "prefer yuan" — and
       §6 and §7 were Trip.com too, and went the other way for the same reason. */
    const stays = bundle.bookings.filter((b) => b.kind === 'hotel');
    const yuan: [string, string, number][] = [
      ['cn26-stay-03', '¥887.52 (2n)', 12413],
      ['cn26-stay-04', '¥419.00', 5860],
      ['cn26-stay-05', '¥1,166.00 (2n)', 16308],
      ['cn26-stay-06', '¥857.30 (2n)', 11990],
      ['cn26-stay-08', '¥324.00', 4531],
    ];
    const cny = bundle.trip.currencies.find((c) => c.code === 'CNY');
    expect(cny?.rateToHome, 'the rate the conversions below rest on').toBe(7.15);
    for (const [id, note, homeMinor] of yuan) {
      const b = stays.find((s) => s.id === id);
      expect(b?.status, id).toBe('booked');
      expect(b?.priceNote, id).toBe(note);
      const p = parsePrice(note, { $: 'USD', '¥': 'CNY' });
      expect(p?.currency, id).toBe('CNY');
      /* '(2n)' is a total for two nights, not a per-night rate — it must not be
         multiplied by the nights of the stay on its way to the money screen. */
      expect(p?.perNight, id).toBe(false);
      const r = priceRange(p!, daysBetween((b as { checkIn: string }).checkIn, (b as { checkOut: string }).checkOut));
      expect(minorToHome(r.minMinor, 7.15), id).toBe(homeMinor);
    }

    /* Pullman: the only three-tier cancellation on the trip, and the only bed
       that reaches a 100% loss. All three tiers ride on the card. */
    const pl = stays.find((b) => b.id === 'cn26-stay-03');
    expect(pl?.code, 'the other Agoda booking id — Element is 683386279').toBe('682760663');
    expect(pl?.codeLabel).toBe('Agoda booking ID');
    expect(pl?.meta.find((m) => m.k === 'Free cancel')?.v).toBe('to 23:59 Dec 9');
    expect(pl?.meta.find((m) => m.k === 'Then partial')?.v).toBe('from 00:00 Dec 10');
    expect(pl?.meta.find((m) => m.k === 'No refund')?.v).toBe('from 00:00 Dec 11');
    expect(pl?.meta.find((m) => m.k === 'Payment')?.v).toMatch(/8 Dec/);
    expect(pl?.note, 'the charge is 8 Dec — the app used to say the 7th').toMatch(
      /charged automatically on 8 December/i,
    );
    expect(pl?.note, 'and the wrong date may not survive on the card').not.toMatch(/\bDec 7\b/);
    /* Agoda misspells the street as GADYUN. The document's spelling is what the
       BUTTON opens — a search for a street that does not exist is worse than no
       button — but the note names the typo out loud, because the owner will see
       it on the confirmation and needs to know which spelling to trust. So the
       rule is not "the word is absent"; it is "the word is never searchable". */
    expect(pl?.address).toBe('No. 188 Gaoyun Road, Wulingyuan');
    expect(pl?.note, 'the owner is warned about the typo they will see').toMatch(/GADYUN/i);
    const searchable = [...bundle.stops, ...bundle.showCards, ...bundle.bookings, ...bundle.stops.flatMap((s) => s.spots ?? [])]
      .flatMap((e) => [e.address ?? '', e.mapQuery ?? '', e.mapUrl ?? '']);
    expect(searchable.some((s) => /GADYUN/i.test(s)), 'the typo never reaches a map').toBe(false);

    /* Huatian and Glenview: booked on Trip.com a day before the rest, both with
       an order number, and both with NO cancellation terms and NO payment mode
       on the confirmation. They must say so rather than reprinting research. */
    for (const [id, code] of [
      ['cn26-stay-04', '1653715534089209'],
      ['cn26-stay-05', '1653715534121148'],
    ] as const) {
      const b = stays.find((s) => s.id === id);
      expect(b?.code, id).toBe(code);
      expect(b?.codeLabel, id).toBe('Trip.com booking');
      expect(b?.codeSub, `${id} — no PIN was shown, unlike Four Points`).toBeUndefined();
      expect(b?.meta.find((m) => m.k === 'Free cancel')?.v, id).toBe('not stated — ask');
      expect(b?.meta.find((m) => m.k === 'Payment')?.v, id).toBe('not stated — ask');
      expect(b?.bookingLinkUrl, `${id} — a held booking does not link back to a search`).toBeUndefined();
    }
  });

  it('the Dec 26 check-out is 11:00 wherever the trip states it', () => {
    /* It was 12:00 in every earlier version of this plan. The hour lives in
       three places and they have to agree, or the app tells you to be somewhere
       an hour after the hotel wanted the key back. */
    const chip = bundle.bookings
      .find((b) => b.id === 'cn26-stay-10')
      ?.meta.find((m) => m.k === 'Check-out')?.v;
    expect(chip).toBe('before 11:00');
    const day = (bundle.dayPlans.find((d) => d.date === '2026-12-26')?.planItems ?? []).join(' ');
    const run = (bundle.runbooks.find((r) => r.id === 'cn26-run-home')?.steps ?? []).join(' ');
    expect(day).toMatch(/11:00/);
    expect(run).toMatch(/11:00/);
    expect(`${day} ${run}`, 'the old 12:00 must not survive anywhere').not.toMatch(/check.?out.{0,40}12:00/i);
    /* The luggage-storage advice is the thing that makes an 11:00 check-out
       survivable, so it must still be there. */
    expect(`${day} ${run}`).toMatch(/bags/i);
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
    expect(spots.find((s) => s.id === 'cn26-spot-kunyu-sanheyuan')).toBeUndefined();
    expect(spots.find((s) => s.id === 'cn26-spot-chongqing-kuixinglou')).toBeUndefined();
    /* TWO CAME BACK ON 2026-07-28, and the two lines above used to be about
       them. Both were rejected for a reason that turned out to be about the
       QUERY rather than the place: Tina's had been asked for as one literal
       string ("Tina's Guesthouse, Tiger Leaping Gorge") instead of a name plus
       a city, and Renmin Road had been asked for in 大理 rather than in
       大理古城, the walled town it actually runs through. Both now resolve, and
       both carry the old evidence beside the new so neither can quietly go
       back. */
    const tinas = spots.find((s) => s.id === 'cn26-spot-gorge-tinas');
    expect(tinas?.mapQuery).toBe("Tina's");
    expect(tinas?.mapCity).toBe('虎跳峡');
    const renmin = spots.find((s) => s.id === 'cn26-spot-dali-renmin-road');
    expect(renmin?.mapQuery).toBe('人民路');
    expect(renmin?.mapCity, 'never 大理 — that answered 40 km north in 洱源').toBe('大理古城');
    /* MACAU RIDES ON THE HONG KONG STOP — the trip has no Macau stop, and Dec 22
       is a day trip out of Hong Kong. Every one of them must carry a city that
       routes to Google rather than Amap. */
    const macau = spots.filter((s) => s.id.startsWith('cn26-spot-hongkong-') && s.mapCity === 'Macau');
    expect(macau.length, 'six Macau spots').toBe(6);
    /* THE YUANJIAJIE RESCUE, which is the sharpest name lesson in the file: the
       area name does not geocode in any spelling the trip uses, and the pillar
       inside it does. The button must carry the pillar's official name. */
    const yuanjiajie = spots.find((s) => s.id === 'cn26-spot-zhangjiajie-yuanjiajie');
    expect(yuanjiajie?.mapQuery, 'never bare 袁家界 — that answers in Jilin').toBe('阿凡达哈利路亚山');
    expect(yuanjiajie?.mapCity).toBe('张家界');
    for (const s of macau) {
      expect(isHongKongOrMacau({ query: s.mapQuery, city: s.mapCity }), s.id).toBe(true);
    }
  });

  /* ---------------------------------------------------------------------
     📍 Places today — the day→place join (scripts/china/day-places.ts).
     --------------------------------------------------------------------- */

  it('every place a day links to exists in this trip and can be opened', () => {
    const index = placeIndex(bundle);
    const dated = [...bundle.dayPlans, ...bundle.dayDefaults];
    let links = 0;
    for (const d of dated) {
      const where = 'date' in d ? d.date : d.id;
      if (!d.placeIds) continue;
      /* Absent, never empty — the app tests the key before it draws a header,
         so `placeIds: []` would be a header with nothing under it. */
      expect(d.placeIds.length, `${where} placeIds`).toBeGreaterThan(0);
      expect(new Set(d.placeIds).size, `${where} lists nothing twice`).toBe(d.placeIds.length);
      for (const id of d.placeIds) {
        links++;
        const ref = index.get(id);
        expect(ref, `${where} → ${id} resolves`).toBeTruthy();
        expect(isOpenable(ref!), `${where} → ${id} has a map target`).toBe(true);
        expect(ref!.label.trim(), `${where} → ${id} has a chip label`).not.toBe('');
      }
    }
    expect(links).toBe(EXPECTED_COUNTS.dayPlaceLinks);
    expect(dated.filter((d) => d.placeIds?.length).length).toBe(EXPECTED_COUNTS.daysWithPlaces);
    /* None of the SEVEN that deliberately cannot open may sneak in — they are
       the whole reason the openability check above exists. The list shrank on
       2026-07-28: Huatian Grand (cn26-stay-04) left it, promoted on two
       independent sources, while 曲水兰亭 (cn26-place-06) stayed on STRONGER
       evidence — a proven name collision with a housing development in Qingdao.
       Cards 05 (后海) and 26 (解放碑) were on it for part of that day, after the
       gate found neither had a coordinate to certify its name against, and came
       off again the moment the coordinates were sourced. */
    for (const id of ['cn26-place-00', 'cn26-place-06', 'cn26-place-21',
      'cn26-place-22', 'cn26-place-23', 'cn26-place-25', 'cn26-stay-01']) {
      expect(dated.some((d) => d.placeIds?.includes(id)), `${id} ships no button`).toBe(false);
    }
  });

  it('the two cards the gate demoted were restored with a coordinate, not with an exception', () => {
    /* `verify:places`, 2026-07-28. Neither card was ever wrong — OpenStreetMap
       answered 什刹海 and 解放碑 correctly and Wikidata agreed both times. Both
       were demoted because §0's rule is that a name is certified against a
       coordinate verified INDEPENDENTLY, and neither card had one: 05 lost its
       pin when the 宝钞胡同 hotel left, and 26 was borrowing the Chongqing
       stop's. A borrowed certificate is not a certificate.
       THE FIX WAS THE COORDINATE, NOT THE BUTTON. The owner sourced both from
       WIKIDATA — Q1136851 什刹海 and Q6683399 抗战胜利纪功碑暨人民解放纪念碑 — which
       is independent of OSM and therefore exactly the yardstick the rule asks
       for. Nothing was waived: the check that could not run before now runs. */
    const shichahai = bundle.showCards.find((c) => c.id === 'cn26-place-05');
    expect(shichahai?.mapQuery, 'the lake district, not 后海 itself').toBe('什刹海');
    expect(shichahai?.mapCity).toBe('北京');
    expect(shichahai?.coord).toEqual({ lat: 39.938, lng: 116.3871 });
    expect(shichahai?.native?.trim(), 'and it still prints 后海 for a driver').toBeTruthy();

    const jiefangbei = bundle.showCards.find((c) => c.id === 'cn26-place-26');
    expect(jiefangbei?.mapQuery).toBe('解放碑');
    expect(jiefangbei?.mapCity).toBe('重庆');
    /* The card holds the same Wikidata item the STOP is pinned on, which is the
       whole difference between citing a source and borrowing an answer. */
    expect(jiefangbei?.coord).toEqual(bundle.stops.find((s) => s.id === 'cn26-stop-chongqing')?.coord);

    /* And the two names are still alive on the entities that could always
       measure them, which is why the same string now opens from every surface
       it appears on rather than from some of them. */
    const spots = bundle.stops.flatMap((s) => s.spots ?? []);
    expect(spots.find((s) => s.id === 'cn26-spot-beijing-shichahai')?.mapQuery).toBe('什刹海');
    expect(bundle.stops.find((s) => s.id === 'cn26-stop-chongqing')?.mapQuery).toBe('解放碑');
  });

  it('carries the cross-name links a future reader would "correct"', () => {
    const on = (date: string): string[] => bundle.dayPlans.find((d) => d.date === date)?.placeIds ?? [];
    /* "Forbidden City" → the entity is `Palace Museum` 故宫博物院. */
    expect(on('2026-12-06')).toContain('cn26-spot-beijing-palace-museum');
    /* "Eling Park / Testbed 2" is ONE spot; "Liziba train-through-building" is
       the spot called `Liziba station`. */
    expect(on('2026-12-15')).toEqual(
      expect.arrayContaining(['cn26-spot-chongqing-eling', 'cn26-spot-chongqing-liziba']),
    );
    /* "Yat Lok roast goose" and "Star Ferry at night" — on the 24th, the day
       they are open and visited, and NOT on the 23rd, whose last line names Yat
       Lok only to say it is shut on Wednesdays. */
    expect(on('2026-12-24')).toEqual(
      expect.arrayContaining(['cn26-spot-hongkong-yat-lok', 'cn26-spot-hongkong-star-ferry']),
    );
    expect(on('2026-12-23')).not.toContain('cn26-spot-hongkong-yat-lok');
    expect(on('2026-12-24')).not.toContain('cn26-spot-hongkong-australia-dairy');
    /* The rest of the twelve confirmed pairs, one assertion each. */
    expect(on('2026-12-17')).toEqual(
      expect.arrayContaining(['cn26-spot-lijiang-baisha', 'cn26-spot-lijiang-shuhe']),
    );
    expect(on('2026-12-20')).toContain('cn26-spot-kunming-cuihu');
    expect(on('2026-12-23')).toEqual(
      expect.arrayContaining(['cn26-spot-hongkong-dragons-back', 'cn26-spot-hongkong-happy-valley']),
    );
    expect(on('2026-12-25')).toEqual(
      expect.arrayContaining(['cn26-spot-hongkong-big-buddha', 'cn26-spot-hongkong-tai-o']),
    );
    expect(on('2026-12-26')).toContain('cn26-spot-hongkong-mplus');
    /* Ciqikou is a DRIVER CARD, not a Chongqing spot — and it is on both days
       the plan names it. */
    expect(on('2026-12-15')).toContain('cn26-place-14');
    expect(on('2026-12-16')).toContain('cn26-place-14');
  });

  it('the places Phase 2 added reach the days that name them', () => {
    const on = (date: string): string[] => bundle.dayPlans.find((d) => d.date === date)?.placeIds ?? [];
    /* MACAU. Dec 22 drew no row at all before 2026-07-28 — a full day in
       another territory with nothing in the seed. The Sheung Wan pier leads,
       because line 1 is the ferry; then the Historic Centre, which is a UNESCO
       area rather than a place, resolved to Senado Square at its middle. */
    expect(on('2026-12-22')).toEqual([
      'cn26-spot-hongkong-macau-ferry',
      'cn26-spot-hongkong-senado',
      'cn26-spot-hongkong-ruins-st-paul',
      'cn26-spot-hongkong-coloane',
      'cn26-spot-hongkong-lord-stows',
      'cn26-spot-hongkong-hzmb-hk',
    ]);
    /* The three lines that named a place the seed could not open, and now can.
       Each is the example day-places.ts rule 2 quotes as forbidden to
       approximate: Jingshan is not the Palace Museum, Jinshanling is not
       Mutianyu, and 重庆1949's theatre is not the Chongqing Grand Theatre. */
    expect(on('2026-12-06')).toContain('cn26-spot-beijing-jingshan');
    expect(on('2026-12-07')).toContain('cn26-spot-beijing-jinshanling');
    expect(on('2026-12-07')).not.toContain('cn26-spot-beijing-mutianyu');
    /* Dec 7's third chip, in the day's own order: check out of Four Points,
       spend the day on the wall, get dropped at the lakes. 后海 stands in for
       Blossom House, which ships no button — it left this row for part of
       2026-07-28 and came back with a coordinate, not with an exception. */
    expect(on('2026-12-07')).toEqual(['cn26-stay-00', 'cn26-spot-beijing-jinshanling', 'cn26-place-05']);
    expect(on('2026-12-15')).toContain('cn26-spot-chongqing-theatre-1949');
    expect(on('2026-12-15'), 'the wrong theatre must never stand in for the show')
      .not.toContain('cn26-spot-chongqing-grand-theatre');
    /* The bed that opened for the first time, on the evening you move to it. */
    expect(on('2026-12-13')).toContain('cn26-stay-04');
    /* Dec 9 names BOTH departure stations, and the row carries the choice
       rather than making it. */
    expect(on('2026-12-09')).toEqual(
      expect.arrayContaining(['cn26-spot-beijing-beijing-north', 'cn26-spot-beijing-qinghe']),
    );
    /* Tina's is where the BAG goes on the 17th and where YOU go on the 19th. */
    expect(on('2026-12-19')).toContain('cn26-spot-gorge-tinas');
    expect(on('2026-12-17')).not.toContain('cn26-spot-gorge-tinas');
    /* THE SECOND RESEARCH PASS closed the four blanks the first one left, and
       each is a name the trip writes one way and a map answers to another.
       Yuanjiajie is the sharpest: the AREA does not geocode under any spelling
       the trip uses, and only the pillar's post-2010 official name does. */
    const index = placeIndex(bundle);
    const labels = (date: string) => on(date).map((id) => index.get(id)?.label ?? '');
    expect(on('2026-12-12')).toContain('cn26-spot-zhangjiajie-yuanjiajie');
    expect(labels('2026-12-17')).toContain('Naxi Ancient Music concert hall');
    expect(labels('2026-12-20')).toContain('Longkan Wharf');
    expect(on('2026-12-23')).toContain('cn26-spot-hongkong-shau-kei-wan');
    expect(on('2026-12-24')).toContain('cn26-spot-hongkong-winterfest');
    /* AND THE ONE THAT IS STILL BARE, on purpose. Dec 22's fallback bus leaves
       from the HONG KONG end of the HZMB bridge, which is pinned three ways
       over. The MACAU end has no coordinate of its own anywhere — only a
       combined Zhuhai + Macau one — so it has no entity and cannot be linked. */
    expect(on('2026-12-22')).toContain('cn26-spot-hongkong-hzmb-hk');
    const macauPort = bundle.stops
      .flatMap((s) => s.spots ?? [])
      .find((s) => s.mapCity === 'Macau' && /hzmb|港珠澳/i.test(`${s.name} ${s.native ?? ''}`));
    expect(macauPort, 'the Macau side of the bridge has no spot at all').toBeUndefined();
  });

  it('a day that goes nowhere carries no placeIds key at all', () => {
    /* Nov 29 is an errand day in Yantai and Dec 10 is a full day on the Chongli
       greens with no named venue. Both must render nothing: no header, no empty
       row. Same for the Kunyu training week, whose four lines all happen inside
       an academy whose address is officially still pending.
       DEC 22 WAS THE THIRD UNTIL 2026-07-28 — a whole day in Macau with not one
       place in the seed. It has five now, and its own assertion below. */
    for (const date of ['2026-11-29', '2026-12-10']) {
      const d = bundle.dayPlans.find((p) => p.date === date);
      expect(d, date).toBeTruthy();
      expect(d, `${date} has no placeIds key`).not.toHaveProperty('placeIds');
      expect(DAY_PLACES[date], `${date} is absent from the manifest`).toBeUndefined();
    }
    const week = bundle.dayDefaults.find((d) => d.id === 'cn26-daydef-kunyu-week');
    expect(week).not.toHaveProperty('placeIds');
    expect(DAY_DEFAULT_PLACES['cn26-daydef-kunyu-week']).toBeUndefined();
    /* And the Sunday default, which does go somewhere, carries its four. */
    expect(bundle.dayDefaults.find((d) => d.id === 'cn26-daydef-kunyu-sunday')?.placeIds).toEqual([
      'cn26-spot-kunyu-penglai',
      'cn26-spot-kunyu-changyu',
      'cn26-spot-kunyu-yantaishan',
      'cn26-spot-kunyu-suochengli',
    ]);
  });

  it('resolves a day into chips the way the two screens draw them', () => {
    /* Dec 11 is the hardest day to resolve: it leaves Chongli, so its places
       come from a stop the traveller is no longer standing in, and two of the
       three are driver cards rather than spots. */
    const dec11 = resolveDay('2026-12-11', bundle.dayPlans, bundle.dayDefaults, bundle.stops);
    expect(dec11?.placeIds).toEqual(['cn26-place-02', 'cn26-place-09', 'cn26-place-10']);
    const chips = resolvePlaces(dec11?.placeIds, bundle);
    expect(chips.map((c) => c.label)).toEqual(['北京首都国际机场 3号航站楼', '张家界荷花国际机场', '武陵源']);
    /* A driver card wears its native name on the chip and hands its sentence to
       the button; a flight wears the airport it leaves from, not "EY 608". */
    expect(chips[0]?.mapName).toMatch(/Beijing Capital/);
    const departure = resolvePlaces(['cn26-flight-ey608'], bundle);
    expect(departure[0]?.label).toBe('Ben Gurion · Terminal 3');
    /* A Kunyu Sunday resolves through the DEFAULT, not through a dayPlan. */
    const sunday = resolveDay('2026-11-29', [], bundle.dayDefaults, bundle.stops);
    expect(resolvePlaces(sunday?.placeIds, bundle).map((c) => c.label)).toEqual([
      'Penglai Pavilion',
      'Changyu Wine Culture Museum',
      'Yantai Hill Park',
      'Suochengli old quarter',
    ]);
    /* And the app survives data it did not build: an unknown id and a repeat
       are both dropped rather than thrown, because the build already refused to
       ship either. */
    expect(resolvePlaces([], bundle)).toEqual([]);
    expect(resolvePlaces(undefined, bundle)).toEqual([]);
    expect(
      resolvePlaces(['cn26-place-14', 'cn26-place-14', 'cn26-nope', 'cn26-place-00'], bundle).map((c) => c.id),
    ).toEqual(['cn26-place-14']);
  });

  it('carries the addresses OpenStreetMap confirmed, and no others', () => {
    const spots = bundle.stops.flatMap((s) => s.spots ?? []);
    const carriers = [...bundle.stops, ...bundle.showCards, ...bundle.bookings, ...spots];
    const withAddress = carriers.filter((e) => e.address);
    /* Whatever the exact count, the shape of every one of them holds. */
    expect(withAddress.length).toBeGreaterThanOrEqual(61);
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
    /* Nothing the paperwork could not address acquired one on the way through. */
    for (const id of ['cn26-stay-01', 'cn26-stay-04']) {
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
    const symbols = tripSymbols(bundle.trip);
    expect(stays.length).toBe(EXPECTED_COUNTS.stays);
    /* Six beds are quoted in dollars and five in yuan — the currency each
       confirmation actually printed, and for Yue Tu and Dali the one each page
       said it would actually charge. Every one of them still parses, and every
       currency it can come back as is one the trip carries a rate for, or the
       money screen would silently drop the row. */
    const rates = new Map(bundle.trip.currencies.map((c) => [c.code, c.rateToHome]));
    for (const s of stays) {
      const p = parsePrice(s.priceNote, symbols);
      expect(p, `${s.title} — ${s.priceNote}`).not.toBeNull();
      expect(['USD', 'CNY'], `${s.title}`).toContain(p?.currency);
      expect(rates.get(p?.currency ?? ''), `${s.title} — no rate for ${p?.currency}`).toBeGreaterThan(0);
    }
    expect(stays.filter((s) => parsePrice(s.priceNote, symbols)?.currency === 'CNY').length).toBe(5);
    /* What the eleven beds add up to in HOME currency: per-night quotes
       multiplied by their own nights, yuan converted at the trip's own rate —
       exactly what buildBooked does for the money screen. */
    const rolled = sumRanges(
      stays.map((s) => {
        const p = parsePrice(s.priceNote, symbols);
        if (!p || s.kind !== 'hotel') throw new Error(`unparsed: ${s.priceNote}`);
        const r = priceRange(p, daysBetween(s.checkIn, s.checkOut));
        const rate = rates.get(p.currency) ?? 1;
        return { minMinor: minorToHome(r.minMinor, rate), maxMinor: minorToHome(r.maxMinor, rate) };
      }),
    );
    /* $2,566.01 — and that is not a number this test chose. It is what the
       eleven beds come to once the TEN booked ones carry the prices they were
       actually booked at ($244.74, $299.56, $232.95, ¥887.52, ¥419.00,
       ¥1,166.00, ¥857.30, ¥324.00, $25.73 and $1,232.01, in place of the $242,
       $360, $221, $104, $62, $172, $73, $47.24, $26 and $1,209 planned), plus
       the gorge walk-in's ~$20, which is the one estimate left in it. It is
       arrived at here independently, by parsing each bed's own quote and
       converting at the trip's own CNY rate of 7.15.
       It read $2,523.24 with the two Beijing beds booked, $2,558.20 with four,
       $2,566.01 with seven and $2,567.97 with eight; finishing the list on
       2026-07-27 took $1.96 back off — Dali ~$47 → $45.31 and Kunming ~$26 →
       $25.73, both DOWN, and in both cases because the app converts at 7.15
       where the plan quoted an OTA's ≈6.77. Neither room got cheaper.
       The five yuan beds contribute $124.13 + $58.60 + $163.08 + $119.90 +
       $45.31. */
    expect(rolled).toEqual({ minMinor: 256601, maxMinor: 256601 });

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
