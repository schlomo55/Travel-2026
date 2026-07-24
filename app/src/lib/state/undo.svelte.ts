/* Single-slot undo for destructive actions. Callers capture what they are about
   to destroy and hand back a restore function; the toast offers it for 6 s. */
import { toast } from './toast.svelte';

export interface Undoable {
  label: string;
  undo: () => Promise<void> | void;
}

export function offerUndo({ label, undo }: Undoable): void {
  toast.show(label, {
    label: 'Undo',
    fn: () => {
      void Promise.resolve(undo()).then(() => toast.show('Restored'));
    },
  });
}
