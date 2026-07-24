export interface ToastAction {
  label: string;
  fn: () => void;
}
export interface ToastItem {
  id: number;
  msg: string;
  action?: ToastAction;
}

let nextId = 1;

class Toasts {
  list = $state<ToastItem[]>([]);

  show(msg: string, action?: ToastAction, ms?: number): void {
    const id = nextId++;
    this.list = [...this.list, { id, msg, action }];
    setTimeout(() => this.dismiss(id), ms ?? (action ? 6000 : 2400));
  }

  dismiss(id: number): void {
    this.list = this.list.filter((t) => t.id !== id);
  }
}

export const toast = new Toasts();

/** Clipboard with haptic + toast — the counter-facing copy action. */
export async function copyText(text: string, label = ''): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* no haptics */
    }
    toast.show(`Copied ✓ ${label}`.trim());
  } catch {
    toast.show('Copy failed — long-press to select');
  }
}
