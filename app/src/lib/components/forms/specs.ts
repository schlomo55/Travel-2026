/* One spec per entity. Adding a field is a line here, not a new component. */
import { newId } from '../../model/ids';
import type {
  Alarm,
  Booking,
  Checklist,
  ComplianceCounter,
  DayPlan,
  EmergencyContact,
  FlightBooking,
  HotelBooking,
  Id,
  InfoCard,
  PackingItem,
  Runbook,
  ShowCard,
  Stop,
  Task,
  WalletCard,
} from '../../model/types';
import { bool, list, num, opt, pairs, str, type FormSpec, type FormValues } from './types';

const ts = () => Date.now();

export function stopSpec(tripId: Id, order: number): FormSpec<Stop> {
  return {
    title: 'Stop',
    groups: [
      {
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Chongqing' },
          { name: 'emoji', label: 'Emoji', type: 'text', width: 'half', maxlength: 4 },
          { name: 'kind', label: 'Kind', type: 'select', width: 'half', options: [
            { value: 'stop', label: 'Stop (you sleep here)' },
            { value: 'transit', label: 'Transit only' },
          ] },
          { name: 'start', label: 'Arrive', type: 'date', width: 'half', required: true },
          { name: 'end', label: 'Leave', type: 'date', width: 'half', required: true },
          { name: 'nights', label: 'Nights', type: 'number', width: 'half', min: 0 },
          { name: 'hue', label: 'Colour', type: 'hue' },
          { name: 'whenLabel', label: 'Dates label', type: 'text', hint: 'Optional override, e.g. "Mon Dec 14 → Wed Dec 16"' },
          { name: 'costNote', label: 'Budget note', type: 'text', width: 'half' },
          { name: 'warn', label: 'Warning', type: 'mdlite', rows: 2, hint: 'Shown as a red card at the top of the stop' },
          { name: 'detail', label: 'Read more', type: 'mdlite', rows: 8, hint: "Long-form notes shown on the stop's own page" },
          { name: 'mapUrl', label: 'Map link', type: 'text', hint: 'Paste a Google Maps or Amap share link — the map buttons then open exactly it' },
        ],
      },
    ],
    toValues: (e) => ({
      name: e?.name ?? '',
      emoji: e?.emoji ?? '',
      kind: e?.kind ?? 'stop',
      start: e?.start ?? '',
      end: e?.end ?? '',
      nights: e?.nights,
      hue: e?.hue ?? 215,
      whenLabel: e?.whenLabel ?? '',
      costNote: e?.costNote ?? '',
      warn: e?.warn ?? '',
      detail: e?.detail ?? '',
      mapUrl: e?.mapUrl ?? '',
    }),
    validate: (v) => {
      if (!str(v.name).trim()) return 'Give the stop a name.';
      if (!str(v.start) || !str(v.end)) return 'Both dates are needed.';
      if (str(v.end) < str(v.start)) return 'The leaving date cannot be before arrival.';
      return null;
    },
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      kind: str(v.kind) === 'transit' ? 'transit' : 'stop',
      name: str(v.name).trim(),
      emoji: opt(v.emoji),
      hue: num(v.hue),
      start: str(v.start),
      end: str(v.end),
      nights: v.nights === undefined ? undefined : num(v.nights),
      whenLabel: opt(v.whenLabel),
      costNote: opt(v.costNote),
      warn: opt(v.warn),
      detail: opt(v.detail),
      photoDocId: e?.photoDocId,
      coord: e?.coord,
      mapQuery: e?.mapQuery,
      mapCity: e?.mapCity,
      mapUrl: opt(v.mapUrl),
      blocks: e?.blocks ?? [],
      recoBlocks: e?.recoBlocks ?? [],
      order: e?.order ?? order,
    }),
  };
}

export function dayPlanSpec(tripId: Id, defaultDate: string, runbooks: Runbook[]): FormSpec<DayPlan> {
  return {
    title: 'Day',
    groups: [
      {
        fields: [
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'title', label: 'Headline', type: 'text', required: true, placeholder: 'Chongqing → Lijiang' },
          { name: 'planItems', label: 'The plan', type: 'stringList', itemLabel: 'Add step', placeholder: 'What happens…' },
          { name: 'bedEmoji', label: 'Bed emoji', type: 'text', width: 'half', maxlength: 4 },
          { name: 'bedLabel', label: 'Tonight', type: 'text', width: 'half', placeholder: 'Mama Naxi, Lijiang' },
          { name: 'runbookId', label: 'Runbook', type: 'select', hint: 'Shows a tickable checklist on Today for this date',
            options: [{ value: '', label: '— none —' }, ...runbooks.map((r) => ({ value: r.id, label: r.title }))] },
        ],
      },
    ],
    toValues: (e) => ({
      date: e?.date ?? defaultDate,
      title: e?.title ?? '',
      planItems: e?.planItems ?? [],
      bedEmoji: e?.bedEmoji ?? '',
      bedLabel: e?.bedLabel ?? '',
      runbookId: e?.runbookId ?? '',
    }),
    validate: (v) => (!str(v.date) ? 'Pick a date.' : !str(v.title).trim() ? 'Give the day a headline.' : null),
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      date: str(v.date),
      title: str(v.title).trim(),
      bedEmoji: opt(v.bedEmoji),
      bedLabel: opt(v.bedLabel),
      planItems: list(v.planItems).filter((s) => s.trim()),
      runbookId: opt(v.runbookId),
    }),
  };
}

export function runbookSpec(tripId: Id): FormSpec<Runbook> {
  return {
    title: 'Runbook',
    groups: [
      {
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Dec 11 — the monopoly flight' },
          { name: 'severity', label: 'Tone', type: 'select', options: [
            { value: 'info', label: 'Plain' },
            { value: 'warn', label: 'Warning (amber)' },
            { value: 'crit', label: 'Critical (red)' },
          ] },
          { name: 'steps', label: 'Steps', type: 'stringList', itemLabel: 'Add step', placeholder: 'One tickable step…' },
        ],
      },
    ],
    toValues: (e) => ({ title: e?.title ?? '', severity: e?.severity ?? 'warn', steps: e?.steps ?? [] }),
    validate: (v) => (!str(v.title).trim() ? 'Give the runbook a title.' : null),
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      title: str(v.title).trim(),
      severity: (['info', 'warn', 'crit'] as const).find((s) => s === str(v.severity)) ?? 'warn',
      steps: list(v.steps).filter((s) => s.trim()),
    }),
  };
}

const STATUS_OPTIONS = [
  { value: 'booked', label: 'Booked ✓' },
  { value: 'pending', label: 'Pending' },
  { value: 'walkin', label: 'Walk-in' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function flightSpec(tripId: Id): FormSpec<FlightBooking> {
  return {
    title: 'Flight',
    groups: [
      {
        title: 'The leg',
        fields: [
          { name: 'carrier', label: 'Airline', type: 'text', required: true, width: 'half', placeholder: 'Air China' },
          { name: 'flightNo', label: 'Flight', type: 'text', required: true, width: 'half', placeholder: 'CA 1953' },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'fromCode', label: 'From', type: 'text', width: 'half', maxlength: 4, placeholder: 'PEK' },
          { name: 'toCode', label: 'To', type: 'text', width: 'half', maxlength: 4, placeholder: 'DYG' },
          { name: 'fromName', label: 'From airport', type: 'text', width: 'half' },
          { name: 'toName', label: 'To airport', type: 'text', width: 'half' },
          { name: 'dep', label: 'Departs', type: 'time', width: 'half' },
          { name: 'arr', label: 'Arrives', type: 'time', width: 'half' },
          { name: 'arrDayOffset', label: 'Arrives next day?', type: 'select', width: 'half', options: [
            { value: '0', label: 'Same day' },
            { value: '1', label: '+1 day' },
            { value: '2', label: '+2 days' },
          ] },
          { name: 'duration', label: 'Duration', type: 'text', width: 'half', placeholder: '2h 40m' },
          { name: 'priceNote', label: 'Fare', type: 'text', width: 'half', placeholder: '≈$120',
            hint: 'What the seat cost — type it in as fares surface' },
        ],
      },
      {
        title: 'At the counter',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
          { name: 'code', label: 'Confirmation code', type: 'text', hint: 'Shown in the largest type in the app' },
          { name: 'codeLabel', label: 'Code label', type: 'text', width: 'half', placeholder: 'Trip.com booking' },
          { name: 'codeSub', label: 'Secondary line', type: 'text', width: 'half', placeholder: 'Ticket 999-…' },
          { name: 'meta', label: 'Details', type: 'kvPairs', keyLabel: 'Seat', valueLabel: '16K' },
          /* Placeholders are shipped in the bundle — never use a real reference. */
          { name: 'groupLabel', label: 'Group under', type: 'text', placeholder: 'Outbound · one PNR' },
          { name: 'note', label: 'Note', type: 'mdlite', rows: 2 },
          { name: 'alert', label: 'Highlight the note', type: 'toggle' },
          { name: 'gmailQuery', label: 'Gmail search', type: 'text', width: 'half' },
          { name: 'manageUrl', label: 'Manage URL', type: 'text', width: 'half' },
        ],
      },
    ],
    toValues: (e) => ({
      carrier: e?.carrier ?? '',
      flightNo: e?.flightNo ?? '',
      date: e?.date ?? '',
      fromCode: e?.from.code ?? '',
      toCode: e?.to.code ?? '',
      fromName: e?.from.name ?? '',
      toName: e?.to.name ?? '',
      dep: e?.dep ?? '',
      arr: e?.arr ?? '',
      arrDayOffset: String(e?.arrDayOffset ?? 0),
      duration: e?.duration ?? '',
      priceNote: e?.priceNote ?? '',
      status: e?.status ?? 'booked',
      code: e?.code ?? '',
      codeLabel: e?.codeLabel ?? '',
      codeSub: e?.codeSub ?? '',
      meta: e?.meta ?? [],
      groupLabel: e?.groupLabel ?? '',
      note: e?.note ?? '',
      alert: e?.alert ?? false,
      gmailQuery: e?.gmailQuery ?? '',
      manageUrl: e?.manageUrl ?? '',
    }),
    validate: (v) => {
      if (!str(v.carrier).trim() || !str(v.flightNo).trim()) return 'Airline and flight number are needed.';
      if (!str(v.date)) return 'Pick the date.';
      return null;
    },
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      kind: 'flight',
      status: (['booked', 'pending', 'walkin', 'cancelled'] as const).find((s) => s === str(v.status)) ?? 'booked',
      title: `${str(v.carrier).trim()} · ${str(v.flightNo).trim()}`,
      groupLabel: opt(v.groupLabel),
      date: str(v.date),
      code: opt(v.code),
      codeLabel: opt(v.codeLabel),
      codeSub: opt(v.codeSub),
      gmailQuery: opt(v.gmailQuery),
      manageUrl: opt(v.manageUrl),
      meta: pairs(v.meta).filter((p) => p.k.trim() || p.v.trim()),
      note: opt(v.note),
      alert: bool(v.alert),
      carrier: str(v.carrier).trim(),
      flightNo: str(v.flightNo).trim(),
      from: { code: str(v.fromCode).trim().toUpperCase(), name: opt(v.fromName) },
      to: { code: str(v.toCode).trim().toUpperCase(), name: opt(v.toName) },
      dep: str(v.dep),
      arr: str(v.arr),
      arrDayOffset: (num(v.arrDayOffset) === 1 ? 1 : num(v.arrDayOffset) === 2 ? 2 : 0) as 0 | 1 | 2,
      duration: opt(v.duration),
      priceNote: opt(v.priceNote),
      createdAt: e?.createdAt ?? ts(),
      updatedAt: ts(),
    }),
  };
}

export function staySpec(tripId: Id): FormSpec<HotelBooking> {
  return {
    title: 'Stay',
    groups: [
      {
        fields: [
          { name: 'title', label: 'Place', type: 'text', required: true, placeholder: 'Mama Naxi Guesthouse' },
          { name: 'city', label: 'City', type: 'text', width: 'half', placeholder: 'Lijiang' },
          { name: 'status', label: 'Status', type: 'select', width: 'half', options: STATUS_OPTIONS },
          { name: 'checkIn', label: 'Check in', type: 'date', width: 'half', required: true },
          { name: 'checkOut', label: 'Check out', type: 'date', width: 'half', required: true },
          { name: 'priceNote', label: 'Price', type: 'text', width: 'half', placeholder: '$20–30/n' },
          { name: 'code', label: 'Confirmation code', type: 'text' },
          { name: 'codeLabel', label: 'Code label', type: 'text', width: 'half' },
          { name: 'bookingLinkUrl', label: 'Booking link', type: 'text' },
          { name: 'gmailQuery', label: 'Gmail search', type: 'text', width: 'half' },
          { name: 'note', label: 'Note', type: 'mdlite', rows: 2 },
        ],
      },
    ],
    toValues: (e) => ({
      title: e?.title ?? '',
      city: e?.city ?? '',
      status: e?.status ?? 'pending',
      checkIn: e?.checkIn ?? '',
      checkOut: e?.checkOut ?? '',
      priceNote: e?.priceNote ?? '',
      code: e?.code ?? '',
      codeLabel: e?.codeLabel ?? '',
      bookingLinkUrl: e?.bookingLinkUrl ?? '',
      gmailQuery: e?.gmailQuery ?? '',
      note: e?.note ?? '',
    }),
    validate: (v) => {
      if (!str(v.title).trim()) return 'Name the place.';
      if (!str(v.checkIn) || !str(v.checkOut)) return 'Both dates are needed.';
      if (str(v.checkOut) <= str(v.checkIn)) return 'Check-out must be after check-in.';
      return null;
    },
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      kind: 'hotel',
      status: (['booked', 'pending', 'walkin', 'cancelled'] as const).find((s) => s === str(v.status)) ?? 'pending',
      title: str(v.title).trim(),
      date: str(v.checkIn),
      city: str(v.city).trim(),
      checkIn: str(v.checkIn),
      checkOut: str(v.checkOut),
      priceNote: opt(v.priceNote),
      code: opt(v.code),
      codeLabel: opt(v.codeLabel),
      bookingLinkUrl: opt(v.bookingLinkUrl),
      gmailQuery: opt(v.gmailQuery) ?? str(v.title).trim(),
      meta: e?.meta ?? [],
      note: opt(v.note),
      createdAt: e?.createdAt ?? ts(),
      updatedAt: ts(),
    }),
  };
}

/** Trains, ferries, activities and anything else that isn't a flight or a bed. */
export function otherBookingSpec(tripId: Id): FormSpec<Booking> {
  return {
    title: 'Booking',
    groups: [
      {
        fields: [
          { name: 'kind', label: 'Type', type: 'select', options: [
            { value: 'train', label: '🚄 Train' },
            { value: 'activity', label: '🎟 Activity' },
            { value: 'other', label: '📌 Other' },
          ] },
          { name: 'title', label: 'What', type: 'text', required: true, placeholder: 'Dali → Kunming HSR' },
          { name: 'date', label: 'Date', type: 'date', required: true, width: 'half' },
          { name: 'status', label: 'Status', type: 'select', width: 'half', options: STATUS_OPTIONS },
          { name: 'fromName', label: 'From', type: 'text', width: 'half', when: (v) => str(v.kind) === 'train' },
          { name: 'toName', label: 'To', type: 'text', width: 'half', when: (v) => str(v.kind) === 'train' },
          { name: 'dep', label: 'Departs', type: 'time', width: 'half', when: (v) => str(v.kind) === 'train' },
          { name: 'arr', label: 'Arrives', type: 'time', width: 'half', when: (v) => str(v.kind) === 'train' },
          { name: 'venue', label: 'Where', type: 'text', when: (v) => str(v.kind) === 'activity' },
          { name: 'time', label: 'Time', type: 'time', width: 'half', when: (v) => str(v.kind) === 'activity' },
          { name: 'code', label: 'Confirmation code', type: 'text' },
          { name: 'codeLabel', label: 'Code label', type: 'text', width: 'half' },
          { name: 'meta', label: 'Details', type: 'kvPairs' },
          { name: 'bookingLinkUrl', label: 'Booking link', type: 'text' },
          { name: 'note', label: 'Note', type: 'mdlite', rows: 2 },
        ],
      },
    ],
    toValues: (e) => ({
      kind: e?.kind ?? 'train',
      title: e?.title ?? '',
      date: e?.date ?? '',
      status: e?.status ?? 'pending',
      fromName: e && e.kind === 'train' ? e.from.name : '',
      toName: e && e.kind === 'train' ? e.to.name : '',
      dep: e && e.kind === 'train' ? (e.dep ?? '') : '',
      arr: e && e.kind === 'train' ? (e.arr ?? '') : '',
      venue: e && e.kind === 'activity' ? (e.venue ?? '') : '',
      time: e && e.kind === 'activity' ? (e.time ?? '') : '',
      code: e?.code ?? '',
      codeLabel: e?.codeLabel ?? '',
      meta: e?.meta ?? [],
      bookingLinkUrl: e?.bookingLinkUrl ?? '',
      note: e?.note ?? '',
    }),
    validate: (v) => (!str(v.title).trim() ? 'Say what it is.' : !str(v.date) ? 'Pick the date.' : null),
    fromValues: (v, e) => {
      const base = {
        id: e?.id ?? newId(),
        tripId,
        status: (['booked', 'pending', 'walkin', 'cancelled'] as const).find((s) => s === str(v.status)) ?? 'pending',
        title: str(v.title).trim(),
        date: str(v.date),
        code: opt(v.code),
        codeLabel: opt(v.codeLabel),
        meta: pairs(v.meta).filter((p) => p.k.trim() || p.v.trim()),
        bookingLinkUrl: opt(v.bookingLinkUrl),
        note: opt(v.note),
        createdAt: e?.createdAt ?? ts(),
        updatedAt: ts(),
      };
      const kind = str(v.kind);
      if (kind === 'train') {
        return { ...base, kind: 'train', from: { name: str(v.fromName) }, to: { name: str(v.toName) }, dep: opt(v.dep), arr: opt(v.arr) };
      }
      if (kind === 'activity') {
        return { ...base, kind: 'activity', venue: opt(v.venue), time: opt(v.time) };
      }
      return { ...base, kind: 'other' };
    },
  };
}

export function walletCardSpec(tripId: Id, order: number, currency: string): FormSpec<WalletCard> {
  return {
    title: 'Card',
    groups: [
      {
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Travel insurance' },
          { name: 'emoji', label: 'Emoji', type: 'text', width: 'half', maxlength: 4 },
          { name: 'pending', label: 'Not sorted yet', type: 'toggle', width: 'half' },
          { name: 'code', label: 'Number', type: 'text' },
          { name: 'codeLabel', label: 'Number label', type: 'text', width: 'half', placeholder: 'Policy number' },
          { name: 'rows', label: 'Details', type: 'kvPairs' },
          { name: 'balance', label: 'Balance', type: 'money', currency, hint: 'Leave empty if this card has no balance' },
          { name: 'gmailQuery', label: 'Gmail search', type: 'text' },
          { name: 'note', label: 'Note', type: 'mdlite', rows: 2 },
        ],
      },
    ],
    toValues: (e) => ({
      title: e?.title ?? '',
      emoji: e?.emoji ?? '',
      pending: e?.pending ?? false,
      code: e?.code ?? '',
      codeLabel: e?.codeLabel ?? '',
      rows: e?.rows?.map((r) => ({ k: r.k, v: r.v })) ?? [],
      balance: e?.balance ? (e.balance.amountMinor / 100).toFixed(2) : '',
      gmailQuery: e?.gmailQuery ?? '',
      note: e?.note ?? '',
    }),
    validate: (v) => (!str(v.title).trim() ? 'Give the card a title.' : null),
    fromValues: (v, e) => {
      const balStr = str(v.balance).replace(/[^0-9.-]/g, '');
      const bal = balStr === '' ? null : { amountMinor: Math.round(Number(balStr) * 100), currency };
      return {
        id: e?.id ?? newId(),
        tripId,
        emoji: opt(v.emoji),
        title: str(v.title).trim(),
        code: opt(v.code),
        codeLabel: opt(v.codeLabel),
        rows: pairs(v.rows).filter((p) => p.k.trim() || p.v.trim()).map((p) => ({ k: p.k, v: p.v })),
        balance: bal && isFinite(bal.amountMinor) ? bal : null,
        gmailQuery: opt(v.gmailQuery),
        note: opt(v.note),
        pending: bool(v.pending),
        order: e?.order ?? order,
      };
    },
  };
}

export function taskSpec(tripId: Id, order: number): FormSpec<Task> {
  return {
    title: 'Task',
    groups: [
      {
        fields: [
          { name: 'title', label: 'What', type: 'mdlite', rows: 2, required: true, placeholder: 'Book the Macau ferry, both legs' },
          { name: 'due', label: 'Due', type: 'date', width: 'half' },
          { name: 'dueLabel', label: 'Due label', type: 'text', width: 'half', placeholder: 'NOW · mid-Nov' },
          { name: 'priority', label: 'Priority', type: 'select', options: [
            { value: '1', label: '1 — critical' },
            { value: '2', label: '2 — normal' },
            { value: '3', label: '3 — optional' },
          ] },
          { name: 'detail', label: 'Why this matters', type: 'mdlite', rows: 4 },
          { name: 'link', label: 'Link', type: 'text' },
          { name: 'done', label: 'Done', type: 'toggle' },
        ],
      },
    ],
    toValues: (e) => ({
      title: e?.title ?? '',
      due: e?.due ?? '',
      dueLabel: e?.dueLabel ?? '',
      priority: String(e?.priority ?? 2),
      detail: e?.detail ?? '',
      link: e?.link ?? '',
      done: e?.done ?? false,
    }),
    validate: (v) => (!str(v.title).trim() ? 'Say what needs doing.' : null),
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      title: str(v.title).trim(),
      detail: opt(v.detail),
      due: opt(v.due),
      dueLabel: opt(v.dueLabel),
      priority: (num(v.priority) === 1 ? 1 : num(v.priority) === 3 ? 3 : 2) as 1 | 2 | 3,
      link: opt(v.link),
      done: bool(v.done),
      doneAt: bool(v.done) ? (e?.doneAt ?? ts()) : undefined,
      order: e?.order ?? order,
    }),
  };
}

export function alarmSpec(tripId: Id): FormSpec<Alarm> {
  return {
    title: 'Timed moment',
    groups: [
      {
        fields: [
          { name: 'title', label: 'What', type: 'text', required: true, placeholder: 'Forbidden City tickets release' },
          { name: 'date', label: 'Date', type: 'date', width: 'half', required: true },
          { name: 'time', label: 'Time', type: 'time', width: 'half', required: true },
          { name: 'why', label: 'Why it matters', type: 'mdlite', rows: 2 },
        ],
      },
    ],
    toValues: (e) => ({ title: e?.title ?? '', date: e?.date ?? '', time: e?.time ?? '09:00', why: e?.why ?? '' }),
    validate: (v) => (!str(v.title).trim() ? 'Name the moment.' : !str(v.date) || !str(v.time) ? 'Date and time are needed.' : null),
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      date: str(v.date),
      time: str(v.time),
      title: str(v.title).trim(),
      why: opt(v.why),
      done: e?.done ?? false,
    }),
  };
}

export function packingItemSpec(tripId: Id, groups: string[], order: number): FormSpec<PackingItem> {
  return {
    title: 'Packing item',
    groups: [
      {
        fields: [
          { name: 'label', label: 'Item', type: 'mdlite', rows: 2, required: true },
          { name: 'group', label: 'Group', type: 'text', hint: groups.length ? `Existing: ${groups.join(' · ')}` : undefined },
        ],
      },
    ],
    toValues: (e) => ({ label: e?.label ?? '', group: e?.group ?? groups[0] ?? 'General' }),
    validate: (v) => (!str(v.label).trim() ? 'Name the item.' : null),
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      group: str(v.group).trim() || 'General',
      label: str(v.label).trim(),
      done: e?.done ?? false,
      order: e?.order ?? order,
    }),
  };
}

export function checklistSpec(tripId: Id, order: number): FormSpec<Checklist> {
  return {
    title: 'Checklist',
    groups: [
      {
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Before you fly' },
          { name: 'note', label: 'Note', type: 'text' },
          { name: 'items', label: 'Items', type: 'stringList', itemLabel: 'Add item' },
        ],
      },
    ],
    toValues: (e) => ({ title: e?.title ?? '', note: e?.note ?? '', items: e?.items.map((i) => i.label) ?? [] }),
    validate: (v) => (!str(v.title).trim() ? 'Give the list a title.' : null),
    fromValues: (v, e) => {
      const labels = list(v.items).filter((s) => s.trim());
      const prev = e?.items ?? [];
      return {
        id: e?.id ?? newId(),
        tripId,
        title: str(v.title).trim(),
        note: opt(v.note),
        /* Keep ticks when a line is unchanged. */
        items: labels.map((label, i) => {
          const match = prev.find((p) => p.label === label) ?? prev[i];
          return { id: match?.id ?? newId(), label, done: match?.label === label ? match.done : false };
        }),
        order: e?.order ?? order,
      };
    },
  };
}

export function showCardSpec(tripId: Id, order: number): FormSpec<ShowCard> {
  return {
    title: 'Card to show',
    groups: [
      {
        fields: [
          { name: 'native', label: 'What they read', type: 'text', required: true, hint: 'Shown huge, full screen' },
          { name: 'meaning', label: 'What it means', type: 'text', required: true },
          { name: 'kind', label: 'Kind', type: 'select', width: 'half', options: [
            { value: 'place', label: '📍 Place' },
            { value: 'phrase', label: '🗣 Phrase' },
          ] },
          { name: 'verify', label: 'Needs verifying', type: 'toggle', width: 'half' },
          { name: 'pending', label: 'Still to obtain', type: 'toggle', width: 'half' },
          { name: 'note', label: 'Note', type: 'mdlite', rows: 2 },
          { name: 'mapUrl', label: 'Map link', type: 'text', hint: 'Paste a Google Maps or Amap share link — the map buttons then open exactly it' },
        ],
      },
    ],
    toValues: (e) => ({
      native: e?.native ?? '',
      meaning: e?.meaning ?? '',
      kind: e?.kind ?? 'place',
      verify: e?.verify ?? false,
      pending: e?.pending ?? false,
      note: e?.note ?? '',
      mapUrl: e?.mapUrl ?? '',
    }),
    validate: (v) => (!str(v.native).trim() || !str(v.meaning).trim() ? 'Both lines are needed.' : null),
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      kind: str(v.kind) === 'phrase' ? 'phrase' : 'place',
      native: str(v.native).trim(),
      meaning: str(v.meaning).trim(),
      note: opt(v.note),
      verify: bool(v.verify),
      pending: bool(v.pending),
      isKey: e?.isKey ?? false,
      coord: e?.coord,
      mapQuery: e?.mapQuery,
      mapCity: e?.mapCity,
      mapUrl: opt(v.mapUrl),
      order: e?.order ?? order,
    }),
  };
}

export function emergencySpec(tripId: Id, order: number): FormSpec<EmergencyContact> {
  return {
    title: 'Emergency contact',
    groups: [
      {
        fields: [
          { name: 'label', label: 'Who', type: 'text', required: true, placeholder: 'Insurance 24h line' },
          { name: 'value', label: 'Number or address', type: 'text', required: true },
          { name: 'kind', label: 'Kind', type: 'select', width: 'half', options: [
            { value: 'phone', label: '📞 Phone' },
            { value: 'url', label: '🔗 Link' },
            { value: 'text', label: '📝 Text' },
          ] },
          { name: 'verify', label: 'Needs verifying', type: 'toggle', width: 'half' },
          { name: 'pending', label: 'Still to obtain', type: 'toggle', width: 'half' },
        ],
      },
    ],
    toValues: (e) => ({
      label: e?.label ?? '',
      value: e?.value ?? '',
      kind: e?.kind ?? 'phone',
      verify: e?.verify ?? false,
      pending: e?.pending ?? false,
    }),
    validate: (v) => (!str(v.label).trim() || !str(v.value).trim() ? 'Both fields are needed.' : null),
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      label: str(v.label).trim(),
      value: str(v.value).trim(),
      kind: (['phone', 'url', 'text'] as const).find((k) => k === str(v.kind)) ?? 'text',
      verify: bool(v.verify),
      pending: bool(v.pending),
      order: e?.order ?? order,
    }),
  };
}

export function infoCardSpec(tripId: Id, order: number): FormSpec<InfoCard> {
  return {
    title: 'Info card',
    groups: [
      {
        fields: [
          { name: 'heading', label: 'Heading', type: 'text', required: true, placeholder: 'The 20 kg rule' },
          { name: 'emoji', label: 'Emoji', type: 'text', width: 'half', maxlength: 4 },
          { name: 'severity', label: 'Highlight', type: 'select', width: 'half', options: [
            { value: 'normal', label: 'Plain' },
            { value: 'crit', label: 'Important (amber)' },
          ] },
          { name: 'items', label: 'Points', type: 'stringList', itemLabel: 'Add point' },
        ],
      },
    ],
    toValues: (e) => ({
      heading: e?.heading ?? '',
      emoji: e?.emoji ?? '',
      severity: e?.severity ?? 'normal',
      items: e?.items ?? [],
    }),
    validate: (v) => (!str(v.heading).trim() ? 'Give the card a heading.' : null),
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      emoji: opt(v.emoji),
      heading: str(v.heading).trim(),
      items: list(v.items).filter((s) => s.trim()),
      severity: str(v.severity) === 'crit' ? 'crit' : 'normal',
      order: e?.order ?? order,
    }),
  };
}

export function counterSpec(tripId: Id): FormSpec<ComplianceCounter> {
  return {
    title: 'Counter',
    groups: [
      {
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Mainland visa' },
          { name: 'icon', label: 'Emoji', type: 'text', width: 'half', maxlength: 4 },
          { name: 'limitDays', label: 'Days allowed', type: 'number', width: 'half', min: 1, required: true },
          { name: 'startDate', label: 'Entry date', type: 'date', required: true },
          { name: 'countStartsDayAfter', label: 'Count starts the day AFTER entry', type: 'toggle',
            hint: 'China: yes — entry day is day 0 and the day after is day 1' },
          { name: 'hardDeadline', label: 'Hard deadline', type: 'date', width: 'half' },
          { name: 'plannedEndDate', label: 'Planned exit', type: 'date', width: 'half' },
          { name: 'pinned', label: 'Show in the top bar', type: 'toggle' },
          { name: 'note', label: 'Note', type: 'mdlite', rows: 3 },
        ],
      },
    ],
    toValues: (e) => ({
      name: e?.name ?? '',
      icon: e?.icon ?? '🛂',
      limitDays: e?.limitDays ?? 30,
      startDate: e?.startDate ?? '',
      countStartsDayAfter: e?.countStartsDayAfter ?? false,
      hardDeadline: e?.hardDeadline ?? '',
      plannedEndDate: e?.plannedEndDate ?? '',
      pinned: e?.pinned ?? true,
      note: e?.note ?? '',
    }),
    validate: (v) => {
      if (!str(v.name).trim()) return 'Name the counter.';
      if (!str(v.startDate)) return 'The entry date is needed.';
      if (num(v.limitDays) < 1) return 'Days allowed must be at least 1.';
      return null;
    },
    fromValues: (v, e) => ({
      id: e?.id ?? newId(),
      tripId,
      name: str(v.name).trim(),
      icon: opt(v.icon),
      startDate: str(v.startDate),
      countStartsDayAfter: bool(v.countStartsDayAfter),
      limitDays: num(v.limitDays),
      hardDeadline: opt(v.hardDeadline),
      plannedEndDate: opt(v.plannedEndDate),
      note: opt(v.note),
      pinned: bool(v.pinned),
    }),
  };
}

export type AnySpec = FormSpec<never>;
export type { FormValues };
