/* THE NATIVE BUILD RUNS NO SERVICE WORKER (Horizon Run 4 — "keep that branch
   intact"). The APK carries every file inside the app package; a service
   worker there is a second, staler copy that keeps serving the old build
   after an update, so the app looks as if it never updated. main.ts decides
   this before the app mounts, and nothing on a screen can show it — so the
   branch itself is read here: on Capacitor, unregister every worker, drop
   every cache, remove the update banner, and register nothing; the worker
   and its banner (whose ids index.html and main.ts share) are the browser's
   alone. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appDir = join(__dirname, '..', '..');
const main = readFileSync(join(appDir, 'src', 'main.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const html = readFileSync(join(appDir, 'index.html'), 'utf8');

const nativeAt = main.indexOf('if (Capacitor.isNativePlatform()) {');
const elseAt = main.indexOf('} else {', nativeAt);
const native = main.slice(nativeAt, elseAt);
const browser = main.slice(elseAt);

describe('native · no service worker in the APK', () => {
  it('decides it once, before the app mounts', () => {
    expect(nativeAt).toBeGreaterThan(0);
    expect(elseAt).toBeGreaterThan(nativeAt);
    expect(main.indexOf('mount(App')).toBeGreaterThan(elseAt);
  });

  it('on Capacitor: every worker unregistered, every cache dropped, the banner removed', () => {
    expect(native).toMatch(/navigator\.serviceWorker\?\.getRegistrations\(\)/);
    expect(native).toMatch(/r\.unregister\(\)/);
    expect(native).toMatch(/caches\?\.keys\(\)/);
    expect(native).toMatch(/caches\.delete\(k\)/);
    expect(native).toContain("document.getElementById('sw-update')?.remove()");
    expect(native).not.toContain('registerSW');
  });

  it('only the browser registers the worker, and its banner keeps the ids index.html gives it', () => {
    expect(main.match(/registerSW\(/g)).toHaveLength(1);
    expect(browser).toContain('registerSW(');
    for (const id of ['sw-update', 'sw-reload', 'sw-dismiss']) {
      expect(html).toContain(`id="${id}"`);
      expect(main).toContain(`getElementById('${id}')`);
    }
  });
});
