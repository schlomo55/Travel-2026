import Dexie, { type EntityTable } from 'dexie';
import type {
  Alarm,
  Booking,
  CheckState,
  Checklist,
  ComplianceCounter,
  DayDefault,
  DayPick,
  DayPlan,
  DocumentBlob,
  DocumentFile,
  EmergencyContact,
  Expense,
  ExpenseCategory,
  InfoCard,
  MetaKV,
  PackingItem,
  PackingTemplate,
  Runbook,
  Settings,
  ShowCard,
  Stop,
  Task,
  Trip,
  TripNote,
  WalletCard,
} from '../model/types';

export type AppDB = Dexie & {
  trips: EntityTable<Trip, 'id'>;
  counters: EntityTable<ComplianceCounter, 'id'>;
  stops: EntityTable<Stop, 'id'>;
  dayPlans: EntityTable<DayPlan, 'id'>;
  dayDefaults: EntityTable<DayDefault, 'id'>;
  dayPicks: EntityTable<DayPick, 'id'>;
  runbooks: EntityTable<Runbook, 'id'>;
  bookings: EntityTable<Booking, 'id'>;
  walletCards: EntityTable<WalletCard, 'id'>;
  documents: EntityTable<DocumentFile, 'id'>;
  documentBlobs: EntityTable<DocumentBlob, 'id'>;
  tasks: EntityTable<Task, 'id'>;
  alarms: EntityTable<Alarm, 'id'>;
  packingItems: EntityTable<PackingItem, 'id'>;
  packingTemplates: EntityTable<PackingTemplate, 'id'>;
  checklists: EntityTable<Checklist, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  categories: EntityTable<ExpenseCategory, 'id'>;
  showCards: EntityTable<ShowCard, 'id'>;
  emergency: EntityTable<EmergencyContact, 'id'>;
  infoCards: EntityTable<InfoCard, 'id'>;
  notes: EntityTable<TripNote, 'tripId'>;
  checkState: EntityTable<CheckState, 'key'>;
  settings: EntityTable<Settings, 'id'>;
  meta: EntityTable<MetaKV, 'key'>;
};

export const db = new Dexie('livingthedream') as AppDB;

/* Schema evolution rule (docs/ARCHITECTURE.md §4): only ADD version blocks,
   never edit or delete old ones; upgrades must be idempotent. */
db.version(1).stores({
  trips: 'id, archived, start',
  counters: 'id, tripId',
  stops: 'id, tripId, [tripId+order]',
  dayPlans: 'id, &[tripId+date], tripId',
  dayDefaults: 'id, tripId',
  runbooks: 'id, tripId',
  bookings: 'id, tripId, [tripId+date], [tripId+kind]',
  walletCards: 'id, tripId, [tripId+order]',
  documents: 'id, tripId, bookingId, walletCardId, addedAt',
  documentBlobs: 'id',
  tasks: 'id, tripId, [tripId+due]',
  alarms: 'id, tripId, [tripId+date]',
  packingItems: 'id, tripId, [tripId+group]',
  packingTemplates: 'id',
  checklists: 'id, tripId, [tripId+order]',
  expenses: 'id, tripId, [tripId+date], [tripId+categoryId]',
  categories: 'id, tripId, [tripId+order]',
  showCards: 'id, tripId, [tripId+kind]',
  emergency: 'id, tripId, [tripId+order]',
  infoCards: 'id, tripId, [tripId+order]',
  notes: 'tripId',
  checkState: 'key, tripId',
  settings: 'id',
  meta: 'key',
});

/* v2 — 2026-08-12, Gap B. The ONE table the app writes plan items into: the
   candidates picked out of a free block on Home (types.ts → DayPick). Purely
   additive, per §4's schema rule; nothing in v1 is touched, so an install that
   never picks anything upgrades to an empty table and behaves identically. */
db.version(2).stores({
  dayPicks: 'id, tripId, [tripId+date]',
});

/** Every per-trip table, for cascade delete / per-trip export sweeps. */
export const TRIP_TABLES = [
  'counters',
  'stops',
  'dayPlans',
  'dayDefaults',
  'dayPicks',
  'runbooks',
  'bookings',
  'walletCards',
  'documents',
  'tasks',
  'alarms',
  'packingItems',
  'checklists',
  'expenses',
  'categories',
  'showCards',
  'emergency',
  'infoCards',
  'notes',
  'checkState',
] as const;
