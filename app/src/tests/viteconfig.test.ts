/* THE BUILD'S CONFIGURATION, AS IT DECIDES THE ONLINE MAP (7 Nov 2026,
   vite.config.ts). The dev server serves on http://localhost:8080 — the one
   dev origin the Protomaps key's CORS list allows — or not at all; the key is
   built in only for the Android build (into dist-android/) and the dev
   server, never into the committed dist/. The key file here is a made-up one
   (LTD_PROTOMAPS_KEY_FILE); the real key is never read by a test. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'ltd-key-'));
const KEY = 'made-up-key-for-the-test';
writeFileSync(join(dir, 'protomaps.key'), `${KEY}\n`);
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

type Conf = { define: Record<string, string>; server: { port: number; strictPort: boolean }; build: { outDir: string } };
async function config(command: 'serve' | 'build', mode: string): Promise<Conf> {
  vi.resetModules();
  vi.stubEnv('LTD_PROTOMAPS_KEY_FILE', join(dir, 'protomaps.key'));
  const make = (await import('../../vite.config')).default as unknown as (e: { command: string; mode: string }) => Conf;
  return make({ command, mode });
}

describe('vite.config.ts', () => {
  it('the dev server: http://localhost:8080, the key’s dev origin, or not at all — with the key', async () => {
    const c = await config('serve', 'development');
    expect(c.server).toEqual({ port: 8080, strictPort: true });
    expect(c.define.__LTD_MAP_KEY__).toBe(JSON.stringify(KEY));
  });

  it('`npm run build` (the committed, public dist/): no key, whatever the machine holds', async () => {
    const c = await config('build', 'production');
    expect(c.define.__LTD_MAP_KEY__).toBe('""');
    expect(c.build.outDir).toBe('dist');
  });

  it('`npm run build:android`: the key, into dist-android/ (git-ignored)', async () => {
    for (const mode of ['android', 'android-engine-v5']) {
      const c = await config('build', mode);
      expect(c.define.__LTD_MAP_KEY__).toBe(JSON.stringify(KEY));
      expect(c.build.outDir).toBe('dist-android');
    }
  });
});
