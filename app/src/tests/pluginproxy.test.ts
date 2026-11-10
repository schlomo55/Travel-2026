/* A CAPACITOR PLUGIN IS NEVER THE VALUE OF A PROMISE (10 Nov 2026, the phone
   test: reminders could neither be switched on nor planned).

   A plugin object is a Proxy whose every property — `then` too — is a
   native-method wrapper. A promise resolved WITH one (`import(…).then((m) =>
   m.LocalNotifications)`, or an async function that returns it) makes the
   promise machinery call that `then`, which never calls back: the promise
   never settles and everything awaiting it hangs. The unit suite never saw
   it because a real plugin only exists on the phone, so here a stand-in plays
   one — and the source is scanned for the shape, so it cannot come back. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/* what a plugin does on the phone when asked for a method it does not have:
   hands back a wrapper that never answers. checkPermissions is real. */
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: new Proxy(
    {},
    { get: (_t, prop) => (prop === 'checkPermissions' ? async () => ({ display: 'granted' }) : () => new Promise(() => {})) },
  ),
}));
vi.mock('../lib/platform/files', () => ({ isNative: () => true }));
vi.mock('../lib/db/db', () => ({ db: {} }));
vi.mock('../lib/data/repo', () => ({
  addMutationHook: () => {},
  mutate: async () => {},
  updateSettings: async () => {},
  getSettings: async () => ({ reminders: { on: true } }),
}));
vi.mock('../lib/state/router.svelte', () => ({ router: { go: () => {} } }));
vi.mock('../lib/state/toast.svelte', () => ({ toast: { show: () => {} } }));

/** the answer, or 'hung' when nothing came back soon */
const soon = <T>(p: Promise<T>, ms = 300): Promise<T | 'hung'> => Promise.race([p, new Promise<'hung'>((r) => setTimeout(() => r('hung'), ms))]);

describe('a plugin proxy as the value of a promise', () => {
  it('the trap is real: a promise resolved with one never settles', async () => {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    expect(await soon(Promise.resolve(LocalNotifications))).toBe('hung');
    expect(await soon(import('@capacitor/local-notifications').then((m) => m.LocalNotifications))).toBe('hung');
  });

  it('the module is not the trap: awaiting it answers at once', async () => {
    const m = await soon(import('@capacitor/local-notifications'));
    expect(m).not.toBe('hung');
  });

  it('platform/reminders reads the status through it — notificationsAllowed and the banner answer', async () => {
    const r = await import('../lib/platform/reminders');
    expect(await soon(r.notificationsAllowed())).toBe('granted');
    expect(await soon(r.reminderBanner())).toBeNull(); /* on + allowed: a reminder can ring */
  });
});

/* ---------- the source ---------- */

const SRC = join(__dirname, '..');
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (f !== 'tests') walk(p, out);
    } else if (/\.(ts|svelte)$/.test(f)) out.push(p);
  }
  return out;
}
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every place a plugin could be handed to a promise, in source text:
    · `import('@capacitor/<plugin>').then((m) => m.Plugin)` — the statement from the import to its `;`;
    · `.then(({ Plugin }) => Plugin)`;
    · an arrow or `return` whose value is a name taken from a plugin module (`App`, `L`…);
    · `Promise.resolve(Plugin)`. */
function proxyHandedToPromise(raw: string): string[] {
  const src = strip(raw);
  const hits: string[] = [];
  for (const m of src.matchAll(/import\(\s*['"]@capacitor\/(?!core\b)[\w-]+['"]\s*\)[^;]*/g)) {
    const stmt = m[0];
    if (/\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\(?\s*\1\s*\.\s*[A-Z]\w*/.test(stmt)) hits.push(stmt.split('\n')[0]!.trim());
    if (/\.then\(\s*\(\s*\{\s*(?:\w+\s*:\s*)?([A-Z]\w*)[^}]*\}\s*\)\s*=>\s*\(?\s*\1\s*\)?\s*\)/.test(stmt)) hits.push(stmt.split('\n')[0]!.trim());
  }
  /* the names a file takes out of a plugin module (and what it renames them to) */
  const names = new Set<string>();
  const take = (list: string): void => {
    for (const part of list.split(',')) {
      const m = /^\s*(\w+)(?:\s*(?:as|:)\s*(\w+))?\s*$/.exec(part);
      if (m) names.add(m[2] ?? m[1]!);
    }
  };
  for (const m of src.matchAll(/\{([^{}]+)\}\s*=\s*await\s+import\(\s*['"](@capacitor\/(?!core\b)[\w-]+)['"]\s*\)/g)) take(m[1]!);
  for (const m of src.matchAll(/import\s*\{([^{}]+)\}\s*from\s*['"](@capacitor\/(?!core\b)[\w-]+)['"]/g)) take(m[1]!);
  for (const n of names) {
    const re = new RegExp(`(?:\\breturn\\s+(?:await\\s+)?|=>\\s*\\(?\\s*(?:await\\s+)?|Promise\\.resolve\\(\\s*)${n}\\s*[;,)\\n}]`);
    const hit = re.exec(src);
    if (hit) hits.push(src.slice(Math.max(0, hit.index - 30), hit.index + hit[0].length).replace(/\s+/g, ' ').trim());
  }
  return hits;
}

describe('the app never hands a Capacitor plugin to a promise', () => {
  it('the scan itself bites: the shape that hung on the phone, and its cousins, are found', () => {
    const was = "const ln = () => (plugin ??= import('@capacitor/local-notifications').then((m) => m.LocalNotifications));";
    expect(proxyHandedToPromise(was)).toHaveLength(1);
    expect(proxyHandedToPromise("import('@capacitor/share').then(({ Share }) => Share)")).toHaveLength(1);
    expect(proxyHandedToPromise("async function p() { const { App } = await import('@capacitor/app'); return App; }")).toHaveLength(1);
    expect(proxyHandedToPromise("async function p() { const { LocalNotifications: L } = await mod(); return L; }")).toHaveLength(0);
    expect(proxyHandedToPromise("const { LocalNotifications: L } = await import('@capacitor/local-notifications'); const q = async () => L;")).toHaveLength(1);
  });

  it('and the app has none: every plugin is used where it is read, never returned or resolved', () => {
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(100);
    const found = files.flatMap((f) => proxyHandedToPromise(readFileSync(f, 'utf8')).map((h) => `${f.slice(SRC.length + 1)}: ${h}`));
    expect(found).toEqual([]);
  });

  it('what is allowed stays allowed: a plugin read from the module and called in place', () => {
    const ok = [
      "const { App } = await import('@capacitor/app'); await App.addListener('x', () => {});",
      "const [{ Filesystem }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]); await Share.share({});",
      "const reminders = () => import('../platform/reminders');",
      "once(() => import('./routes/occasional').then((m) => m.Settings));",
    ];
    for (const s of ok) expect(proxyHandedToPromise(s)).toEqual([]);
  });
});
