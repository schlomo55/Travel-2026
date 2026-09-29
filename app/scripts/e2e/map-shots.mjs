/* THE MAP TAB, PHOTOGRAPHED (Map 5c) — the built app in headless Chrome with
   WebGL (SwiftShader) and EVERY non-localhost request refused, at the boards'
   412 px and the S23's 384 px, for comparing with docs/design/horizon/boards/
   map4-*.dc.html. A dev tool, run by hand; the rehearsal is the gate.

   Run (from app/, after `npm run build`):
     node scripts/e2e/map-shots.mjs [--pack <file.pmtiles>] [--out <dir>]
   The pack defaults to the real one (app/.cache/maps/china-2026-map.pmtiles,
   `npm run map:pack`), else the committed test pack. Screenshots go to
   app/.cache/shots/map5c/ (git-ignored). The moment is the boards': Tue 8 Dec,
   you by the Houhai lakes (39.9380 N, 116.3871 E, ±25 m), facing west. */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const PACK = arg('--pack', existsSync(join(APP, '.cache', 'maps', 'china-2026-map.pmtiles')) ? join(APP, '.cache', 'maps', 'china-2026-map.pmtiles') : join(APP, 'scripts', 'e2e', 'fixtures', 'houhai-test.pmtiles'));
const OUT = arg('--out', join(APP, '.cache', 'shots', 'map5c'));
/* another build to photograph — the engine-v5 fallback, say: vite build --mode engine-v5 --outDir <dir> */
const DIST = arg('--dist', 'dist');
const SEED = join(APP, '..', 'seed', 'china-2026.trip.json');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

async function freePort() {
  for (;;) {
    const port = await new Promise((res, rej) => {
      const s = net.createServer().once('error', rej).listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => res(p));
      });
    });
    if (![4173, 4177, 4178].includes(port)) return port;
  }
}

/* the build, served */
const webPort = await freePort();
const BASE = `http://localhost:${webPort}/`;
const preview = spawn(process.execPath, [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--outDir', DIST, '--port', String(webPort), '--strictPort'], { cwd: APP, stdio: 'ignore' });
for (let i = 0; i < 80; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* not yet */
  }
  await nap(250);
}

/* Chrome: WebGL through SwiftShader, nothing but localhost */
const cdpPort = await freePort();
const PROFILE = join(APP, '.cache', 'profiles', `shots-${Date.now()}`);
rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${PROFILE}`,
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-background-networking',
    '--disable-component-update',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    '--window-size=412,915',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
let wsUrl;
for (let i = 0; i < 120 && !wsUrl; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
    if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl;
  } catch {
    /* not yet */
  }
  if (!wsUrl) await nap(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
let id = 0;
const pending = new Map();
const blocked = [];
const errors = [];
const allowed = (u) => /^(data|blob|about|chrome-extension|devtools):/.test(u) || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u);
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    pending.set(++id, { res, rej, method });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej, method } = pending.get(m.id);
    pending.delete(m.id);
    return m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result);
  }
  if (m.method === 'Fetch.requestPaused') {
    const u = m.params.request.url;
    if (allowed(u)) send('Fetch.continueRequest', { requestId: m.params.requestId }, m.sessionId).catch(() => {});
    else {
      blocked.push(u);
      send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }, m.sessionId).catch(() => {});
    }
  } else if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description ?? '').slice(0, 200));
  else if (m.method === 'Target.attachedToTarget') {
    const s2 = m.params.sessionId;
    void (async () => {
      try {
        await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, s2);
      } catch {
        /* not every target takes it */
      }
      await send('Runtime.runIfWaitingForDebugger', {}, s2).catch(() => {});
    })();
  }
};
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable');
await S('Runtime.enable');
await S('DOM.enable');
await S('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
await S('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
const js = async (x, aw = true) => {
  const r = await S('Runtime.evaluate', { expression: x, awaitPromise: aw, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.value;
};
const size = async (w, h) => S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
const go = async (url) => {
  await S('Page.navigate', { url: 'about:blank' });
  await S('Page.navigate', { url });
  await nap(1500);
};
const idle = async (ms = 30000) => {
  const t0 = Date.now();
  for (;;) {
    const ok = await js("!!document.querySelector('.m-canvas[data-idle]')").catch(() => false);
    if (ok) return true;
    if (Date.now() - t0 > ms) return false;
    await nap(250);
  }
};
const shot = async (name) => {
  await nap(400);
  const { data } = await S('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log('  shot', join(OUT, `${name}.png`));
};

try {
  await size(412, 915);
  /* the trip, through the app's own import sheet */
  await go(BASE);
  await nap(1500);
  await js(`window.__seed=${JSON.stringify(readFileSync(SEED, 'utf8'))};'ok'`);
  await js(`(async()=>{
    [...document.querySelectorAll('button')].find(b=>/Import a trip/.test(b.textContent)).click();
    await new Promise(r=>setTimeout(r,700));
    const dt=new DataTransfer(); dt.items.add(new File([window.__seed],'s.json',{type:'application/json'}));
    const i=document.querySelector('.filebtn input[type=file]'); i.files=dt.files; i.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,2000));
    [...document.querySelectorAll('button')].find(b=>/^(Import|Replace & import)$/.test(b.textContent.trim())).click();
    await new Promise(r=>setTimeout(r,3000)); return 'ok';
  })()`);

  /* no pack yet: the night canvas */
  await S('Browser.grantPermissions', { permissions: ['geolocation'], origin: BASE.replace(/\/$/, '') });
  await S('Emulation.setGeolocationOverride', { latitude: 39.938, longitude: 116.3871, accuracy: 25 });
  await go(`${BASE}?d=2026-12-08#/trip/cn26/map`);
  await idle(20000);
  await js("(async()=>{ const b=document.querySelector('.m-locate'); b&&b.click(); await new Promise(r=>setTimeout(r,2500)); return 'ok'; })()");
  await idle(20000);
  await shot('412-nopack');

  /* the pack, through the empty state's own file input */
  const { root } = await S('DOM.getDocument', { depth: -1 });
  const { nodeId } = await S('DOM.querySelector', { nodeId: root.nodeId, selector: '.m-nopack input[type=file]' });
  if (!nodeId) throw new Error('no pack input on the empty state');
  await S('DOM.setFileInputFiles', { nodeId, files: [PACK] });
  for (let i = 0; i < 120; i++) {
    await nap(500);
    if (!(await js("!!document.querySelector('.m-nopack')"))) break;
  }
  console.log('pack imported:', PACK);

  for (const [w, h] of [
    [412, 915],
    [384, 824],
  ]) {
    await size(w, h);
    await go(`${BASE}?d=2026-12-08#/trip/cn26/map`);
    await idle();
    /* the phone remembers you asked for your position: it comes back by itself */
    await js("(async()=>{ for(let i=0;i<40&&document.querySelector('.m-you.off');i++) await new Promise(r=>setTimeout(r,250)); await new Promise(r=>setTimeout(r,1500)); return 'ok'; })()");
    await idle();
    console.log('  state', await js("JSON.stringify({pressed: document.querySelector('.m-locate')?.getAttribute('aria-pressed'), label: document.querySelector('.m-locate')?.getAttribute('aria-label'), youOff: !!document.querySelector('.m-you.off')})"));
    await shot(`${w}-map`);

    await go(`${BASE}?d=2026-12-08#/trip/cn26/map/cn26-place-07`);
    await idle();
    await nap(1200);
    await idle();
    await shot(`${w}-place`);

    await go(`${BASE}?d=2026-12-08#/trip/cn26/map/cn26-place-07/go`);
    await idle();
    await js("window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute',{alpha:90,beta:60,gamma:0,absolute:true})); 'ok'");
    await nap(1500);
    await idle();
    await shot(`${w}-go`);

    await go(`${BASE}?d=2026-12-08#/trip/cn26/map`);
    await idle();
    await js("(async()=>{ document.querySelector('.m-toprow .m-round').click(); await new Promise(r=>setTimeout(r,900)); return 'ok'; })()");
    await shot(`${w}-filters`);

    /* the list (every place of the city, for reading) and a search */
    await go(`${BASE}?d=2026-12-08#/trip/cn26/map`);
    await idle();
    await js("(async()=>{ document.querySelector('.m-listbtn').click(); await new Promise(r=>setTimeout(r,900)); return 'ok'; })()");
    await shot(`${w}-list`);

    await go(`${BASE}?d=2026-12-08#/trip/cn26/map`);
    await idle();
    await js("(async()=>{ const i=document.querySelector('.m-search input'); i.focus(); i.value='hospital'; i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,900)); return 'ok'; })()");
    await shot(`${w}-search`);

    /* a doorway: the city guide's places, each with "Show on map" */
    await go(`${BASE}?d=2026-12-08#/trip/cn26/journey/cn26-stop-beijing/guide`);
    await nap(1200);
    await js("(async()=>{ const u=document.querySelector('ul.spots'); if(u) u.scrollIntoView({block:'start'}); await new Promise(r=>setTimeout(r,600)); return 'ok'; })()");
    await shot(`${w}-guide-places`);
  }
  console.log(`blocked off-localhost: ${blocked.length}${blocked.length ? ' — ' + [...new Set(blocked)].slice(0, 5).join(' ') : ''}`);
  if (errors.length) console.log('page exceptions:\n  ' + errors.slice(0, 8).join('\n  '));
} finally {
  try {
    ws.close();
  } catch {
    /* gone */
  }
  chrome.kill();
  preview.kill();
  await nap(500);
  rmSync(PROFILE, { recursive: true, force: true });
}
