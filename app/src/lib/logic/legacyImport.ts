/* Reading the old China app's data. Three shapes are accepted:
   1. the app's full backup blob  { app:'china2026', data:{ key -> rawString } }
   2. the trip-guide's bare expense array
   3. a raw localStorage-style map of china2026.* keys
   Everything maps onto the deterministic cn26-* ids the seed builder emits, so
   ticks land back on the same tasks, packing items, alarms and runbook steps. */
import type { CheckState, Expense, ExpenseCategory, Id, PackingItem } from '../model/types';
import { newId } from '../model/ids';

export interface LegacyExpense {
  id: string;
  date: string;
  cat: string;
  desc?: string;
  amt: number;
  cur: string;
  rate: number;
  usd: number; // integer cents, USD
  pay?: 'cash' | 'card';
  refund?: boolean;
  ts?: number;
}

export interface LegacyImportResult {
  expenses: Expense[];
  taskIdsDone: Id[];
  packingIdsDone: Id[];
  checklistItemIdsDone: Id[];
  alarmIdsDone: Id[];
  checkState: CheckState[];
  customPacking: PackingItem[];
  notes?: string;
  giftBalanceMinor?: number;
  /** Ticks whose target could not be resolved (reported, never silently dropped). */
  unmatched: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function isLegacyExpense(v: unknown): v is LegacyExpense {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    typeof v.cat === 'string' &&
    typeof v.usd === 'number' &&
    isFinite(v.usd)
  );
}

/** Legacy blobs stored every value as a JSON string. */
function parseMaybe<T>(raw: unknown): T | null {
  if (typeof raw !== 'string') return isRecord(raw) || Array.isArray(raw) ? (raw as T) : null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Pull the china2026.* map out of whichever wrapper we were handed. */
export function extractLegacyData(input: unknown): Record<string, unknown> | null {
  if (Array.isArray(input)) {
    return input.every(isLegacyExpense) ? { 'expenses.v1': input } : null;
  }
  if (!isRecord(input)) return null;
  if (input.app === 'china2026' && isRecord(input.data)) return input.data;
  /* a raw localStorage dump, keys still namespaced */
  const keys = Object.keys(input);
  if (keys.some((k) => k.startsWith('china2026.'))) {
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k.replace(/^china2026\./, '')] = input[k];
    return out;
  }
  if (keys.some((k) => /^(expenses|checklist|packing|packCustom|notes|giftBalance)\.v1$/.test(k))) {
    return input;
  }
  return null;
}

export interface LegacyMappingTargets {
  tripId: Id;
  categories: ExpenseCategory[];
  taskIds: Set<Id>;
  packingIds: Set<Id>;
  checklistItemIds: Set<Id>;
  alarmIdsByIndex: Id[];
  runbookIds: Set<Id>;
}

export function importLegacy(input: unknown, t: LegacyMappingTargets): LegacyImportResult | null {
  const data = extractLegacyData(input);
  if (!data) return null;

  const unmatched: string[] = [];
  const byLegacyKey = new Map(t.categories.filter((c) => c.legacyKey).map((c) => [c.legacyKey as string, c]));
  const fallbackCat = t.categories.find((c) => c.legacyKey === 'other') ?? t.categories[0];

  /* --- expenses --- */
  const rawExpenses = parseMaybe<unknown[]>(data['expenses.v1']) ?? [];
  const expenses: Expense[] = [];
  for (const raw of Array.isArray(rawExpenses) ? rawExpenses : []) {
    if (!isLegacyExpense(raw)) continue;
    const cat = byLegacyKey.get(raw.cat) ?? fallbackCat;
    if (!cat) continue;
    expenses.push({
      id: raw.id,
      tripId: t.tripId,
      date: raw.date,
      categoryId: cat.id,
      desc: typeof raw.desc === 'string' ? raw.desc : '',
      amount: raw.amt,
      currency: raw.cur,
      rateToHome: raw.rate,
      homeMinor: raw.usd, // already integer cents in USD, the trip's home currency
      payment: raw.pay === 'cash' ? 'cash' : 'card',
      refund: raw.refund === true,
      ts: typeof raw.ts === 'number' ? raw.ts : Date.now(),
    });
  }

  /* --- ticks --- */
  const checks = parseMaybe<Record<string, unknown>>(data['checklist.v1']) ?? {};
  const taskIdsDone: Id[] = [];
  const packingIdsDone: Id[] = [];
  const checklistItemIdsDone: Id[] = [];
  const alarmIdsDone: Id[] = [];
  const checkState: CheckState[] = [];

  for (const key of Object.keys(isRecord(checks) ? checks : {})) {
    if (!checks[key]) continue;
    let m: RegExpExecArray | null;
    if ((m = /^task-(.+)$/.exec(key))) {
      const id = `cn26-task-${m[1]}`;
      if (t.taskIds.has(id)) taskIdsDone.push(id);
      else unmatched.push(key);
    } else if ((m = /^pk-(.+)$/.exec(key))) {
      const id = `cn26-pack-${m[1]}`;
      if (t.packingIds.has(id)) packingIdsDone.push(id);
      else unmatched.push(key); // custom items are restored separately
    } else if ((m = /^app-(.+)$/.exec(key))) {
      const id = `cn26-app-${m[1]}`;
      if (t.checklistItemIds.has(id)) checklistItemIdsDone.push(id);
      else unmatched.push(key);
    } else if ((m = /^alarm-(\d+)$/.exec(key))) {
      const id = t.alarmIdsByIndex[Number(m[1])];
      if (id) alarmIdsDone.push(id);
      else unmatched.push(key);
    } else if ((m = /^run-([a-z0-9]+)-(\d{4}-\d{2}-\d{2})-(\d+)$/.exec(key))) {
      const runbookId = `cn26-run-${m[1]}`;
      if (t.runbookIds.has(runbookId)) {
        checkState.push({ key: `${t.tripId}:run:${runbookId}:${m[2]}:${m[3]}`, tripId: t.tripId, at: Date.now() });
      } else unmatched.push(key);
    } else {
      unmatched.push(key);
    }
  }

  /* --- custom packing items the user added in the old app --- */
  const custom = parseMaybe<{ id: string; t: string }[]>(data['packCustom.v1']) ?? [];
  const customPacking: PackingItem[] = (Array.isArray(custom) ? custom : [])
    .filter((c) => isRecord(c) && typeof c.t === 'string')
    .map((c, i) => ({
      id: newId(),
      tripId: t.tripId,
      group: 'Your own items',
      label: String(c.t),
      done: !!(isRecord(checks) && checks[`pk-${c.id}`]),
      order: 900 + i,
    }));

  const notesRaw = data['notes.v1'];
  const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw : undefined;

  const giftRaw = parseMaybe<number>(data['giftBalance.v1']);
  const giftBalanceMinor = typeof giftRaw === 'number' && isFinite(giftRaw) ? Math.round(giftRaw * 100) : undefined;

  return {
    expenses,
    taskIdsDone,
    packingIdsDone,
    checklistItemIdsDone,
    alarmIdsDone,
    checkState,
    customPacking,
    notes,
    giftBalanceMinor,
    unmatched,
  };
}
