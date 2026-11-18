/* A PDF OPENS IN A VIEWER, NOT THE SHARE SHEET (18 Nov 2026, the offline phone
   test: tapping a PDF in Documents offered WhatsApp and Quick Share — the wrong
   gesture at an airline counter). platform/files hands the cached file to the
   app's own FileViewer plugin (ACTION_VIEW), which itself falls back to the
   share sheet when no app on the phone can view it. Saving a backup still shares. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const view = vi.fn();
const share = vi.fn(async (_o: unknown) => ({}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({ view: (o: unknown) => view(o) }),
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: async () => ({}), getUri: async ({ path }: { path: string }) => ({ uri: 'file:///cache/' + path }) },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: (o: unknown) => share(o) } }));

const pdf = (): Blob => new Blob(['%PDF-1.4'], { type: 'application/pdf' });

describe('opening a stored PDF on the phone', () => {
  beforeEach(() => {
    view.mockReset();
    share.mockClear();
  });

  it('goes to a viewer with its type, and never to the share sheet', async () => {
    view.mockResolvedValue({ opened: true });
    const { openFile } = await import('../lib/platform/files');
    await openFile('ticket.pdf', pdf(), 'application/pdf');
    expect(view).toHaveBeenCalledWith({ path: 'ticket.pdf', mimeType: 'application/pdf' });
    expect(share).not.toHaveBeenCalled();
  });

  it('a backup is still shared, never viewed', async () => {
    const { saveFile } = await import('../lib/platform/files');
    expect(await saveFile('backup.json', new Blob(['{}']))).toBe('shared');
    expect(view).not.toHaveBeenCalled();
    expect(share).toHaveBeenCalledOnce();
  });
});
