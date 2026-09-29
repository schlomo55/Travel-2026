/* THE MAP-PACK IMPORT, ONE FOR THE WHOLE APP (Map 5d) — started from the Map
   tab's empty state or from Settings, it is the same one job: its progress,
   its words and the pack it lands live here, not in the control that started
   it. The control's own busy flag died with it: leave the tab mid-copy, come
   back, and the picker was offered again — a second copy racing the first.
   Now every control shows the one import under way, and whichever is on
   screen when it lands takes the new pack up (the Map rebuilds its streets,
   Settings its row). lib/map/pack.ts refuses a second import besides. */
import { importPack, PackError, packSize, type PackInfo } from './pack';
import { toast } from '../state/toast.svelte';
import { S } from '../i18n/strings';

/** What a failed import says — only what is true of what is left on the phone. */
export function problemWords(err: unknown): string {
  if (!(err instanceof PackError)) return S.mapTab.importFailedNone;
  switch (err.problem) {
    case 'notAPack':
      return S.mapTab.notAPack;
    case 'tooSmall':
      return S.mapTab.tooSmall;
    case 'incomplete':
      return err.kept ? S.mapTab.incomplete : S.mapTab.incompleteNone;
    case 'noRoom':
      return S.mapTab.noRoom(packSize(Number(err.detail) || 0));
    case 'noOpfs':
      return S.mapTab.noOpfs;
    case 'busy':
      return S.mapTab.importBusy;
    case 'notPlaced':
      return S.mapTab.notPlaced;
    case 'unreadable':
      return S.mapTab.unreadable;
    default:
      return err.kept ? S.mapTab.importFailed : S.mapTab.importFailedNone;
  }
}

class PackImporter {
  /** how far the copy is, 0–100, while one runs; null when none does */
  pct = $state<number | null>(null);
  /** why the last import did not land — cleared when the next one starts */
  problem = $state<string | null>(null);
  /** the last pack that landed, numbered, so a control mounted later knows it is new */
  landed = $state<{ n: number; info: PackInfo } | null>(null);

  get busy(): boolean {
    return this.pct !== null;
  }

  async run(file: File): Promise<void> {
    if (this.busy) return;
    this.problem = null;
    this.pct = 0;
    try {
      const info = await importPack(file, (done, total) => (this.pct = total ? Math.floor((done / total) * 100) : 0));
      toast.show(S.mapTab.ready);
      this.landed = { n: (this.landed?.n ?? 0) + 1, info };
    } catch (err) {
      this.problem = problemWords(err);
    } finally {
      this.pct = null;
    }
  }
}

export const packImporter = new PackImporter();
