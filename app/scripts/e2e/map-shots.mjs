/* THE MAP TAB, PHOTOGRAPHED (Map 5c) — the built app in headless Chrome with
   WebGL (SwiftShader) and EVERY non-localhost request refused, at the boards'
   412 px and the S23's 384 px, for comparing with docs/design/horizon/boards/
   map4-*.dc.html. A dev tool, run by hand; the rehearsal is the gate.

   Run (from app/, after `npm run build`):
     node scripts/e2e/map-shots.mjs [--pack <file.pmtiles>] [--out <dir>]
   The pack defaults to the real one (app/.cache/maps/china-2026-map.pmtiles,
   `npm run map:pack`), else the committed test pack. Screenshots go to
   app/.cache/shots/map5c/ (git-ignored). The moment is the boards': Tue 8 Dec,
   you by the Houhai lakes (39.9380 N, 116.3871 E, ±25 m), facing west.
   Map 5d added: the map with your heading (the phone near flat, rolled — the
   board's beam), Guide me in Hong Kong (Google first; you in Central), and the
   map that cannot start (no WebGL: the fallback). */
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
/* the pack: the owner's with its photos (Map 5e), else the tiles alone, else the committed test pack */
const PACK = arg(
  '--pack',
  [join(APP, '.cache', 'maps', 'china-2026-map-photos.pmtiles'), join(APP, '.cache', 'maps', 'china-2026-map.pmtiles'), join(APP, 'scripts', 'e2e', 'fixtures', 'houhai-test.pmtiles')].find((f) => existsSync(f)),
);
const OUT = arg('--out', join(APP, '.cache', 'shots', 'map5c'));
/* --only 5e: just the places' photos (Map 5e): A, A2, B, E at several zooms, F, full screen, the credits */
const ONLY = arg('--only', '');
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

  /* ---------- Map 5e, --perf: do photo pins cost frames? ----------
     The same drag, at the same cameras close in (SPOTS), with the tiles
     alone and then with the photo bundle, twice over — rAF intervals under
     the perf tool's 4× CPU throttle, three drags each, medians. The first
     drag after a load paints the photo pins that come into view. */
  if (process.argv.includes('--perf')) {
    const TILES = join(APP, '.cache', 'maps', 'china-2026-map.pmtiles');
    const drag = async () => {
      await S('Emulation.setCPUThrottlingRate', { rate: 4 });
      await js("(()=>{ window.__fr=[]; window.__stop=false; const f=(t)=>{ window.__fr.push(t); if(!window.__stop) requestAnimationFrame(f); }; requestAnimationFrame(f); return 'ok'; })()");
      const [x0, y0] = [200, 300];
      await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
      for (let i = 1; i <= 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + Math.sin(a) * 90, y: y0 + (1 - Math.cos(a)) * 60, button: 'left', buttons: 1 });
        await nap(40);
      }
      await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0, y: y0, button: 'left', clickCount: 1 });
      await nap(300);
      const r = JSON.parse(await js("(()=>{ window.__stop=true; const f=window.__fr; const d=[]; for(let i=1;i<f.length;i++) d.push(f[i]-f[i-1]); d.sort((a,b)=>a-b); const q=(p)=>d[Math.min(d.length-1,Math.floor(p*d.length))]||0; return JSON.stringify({ n:d.length, med:Math.round(q(0.5)*10)/10, p95:Math.round(q(0.95)*10)/10, slow:d.filter(x=>x>50).length, worst:Math.round((d[d.length-1]||0)*10)/10 }); })()"));
      await S('Emulation.setCPUThrottlingRate', { rate: 1 });
      return r;
    };
    /* where: by Houhai two steps in (z15.5, five photos in view), three (z16.5,
       one), and Central, Hong Kong, two steps in (six, the densest) */
    const SPOTS = [
      { name: 'Houhai', lat: 39.938, lng: 116.3871, d: '2026-12-08', ins: 2 },
      { name: 'Houhai', lat: 39.938, lng: 116.3871, d: '2026-12-08', ins: 3 },
      { name: 'Central HK', lat: 22.2838, lng: 114.1535, d: '2026-12-23', ins: 2 },
    ];
    const measure = async (label, spot) => {
      await S('Emulation.setGeolocationOverride', { latitude: spot.lat, longitude: spot.lng, accuracy: 20 });
      await go(`${BASE}?d=${spot.d}#/trip/cn26/map`);
      await idle();
      await js("(async()=>{ for(let i=0;i<40&&document.querySelector('.m-you.off');i++) await new Promise(r=>setTimeout(r,250)); await new Promise(r=>setTimeout(r,1500)); return 'ok'; })()");
      await idle();
      for (let i = 0; i < spot.ins; i++) {
        await js(`document.querySelector('.m-zoom button[aria-label="Zoom in"]').click(); 'ok'`);
        await nap(700);
      }
      await idle();
      await nap(1500);
      await idle();
      const at = await js("JSON.stringify(Object.assign({}, document.querySelector('.m-canvas').dataset))");
      const runs = [];
      for (let i = 0; i < 3; i++) {
        runs.push(await drag());
        await idle();
        await nap(800);
      }
      const med = (k) => [...runs.map((x) => x[k])].sort((a, b) => a - b)[1];
      const d = JSON.parse(at);
      console.log(`  ${label} · ${spot.name}: z${String(d.center).split(',')[2]} · ${d.photos ?? 0} photo pins · frames/run ${runs.map((x) => x.n).join('/')} · median ${med('med')} ms · p95 ${med('p95')} ms · >50 ms ${runs.map((x) => x.slow).join('/')} · worst ${Math.max(...runs.map((x) => x.worst))} ms`);
    };
    await size(384, 824);
    const input = async (sel, file) => {
      const { root: r } = await S('DOM.getDocument', { depth: -1 });
      const { nodeId: n } = await S('DOM.querySelector', { nodeId: r.nodeId, selector: sel });
      if (!n) throw new Error(`no input ${sel}`);
      await S('DOM.setFileInputFiles', { nodeId: n, files: [file] });
    };
    /* the photo bundle is in already (imported above): swap packs through
       Settings' own importer, tiles → photos → tiles → photos, so warm caches
       favour neither side */
    const packText = () => js("([...document.querySelectorAll('section.group')].find(s=>s.getAttribute('aria-label')==='Map pack')||{}).innerText||''");
    const swap = async (file, done) => {
      await go(`${BASE}#/settings`);
      await nap(1500);
      await input('section.mappack input[type=file]', file);
      for (let i = 0; i < 480 && !done(await packText()); i++) await nap(500);
      await nap(1000);
    };
    const tilesIn = (t) => /MB/.test(t) && !/photos/.test(t);
    const photosIn = (t) => /photos/.test(t);
    for (const round of [1, 2]) {
      await swap(TILES, tilesIn);
      for (const spot of SPOTS) await measure(`round ${round} · tiles alone (icons)`, spot);
      await swap(PACK, photosIn);
      for (const spot of SPOTS) await measure(`round ${round} · with the photos (photo pins)`, spot);
    }
    throw new Error('perf-done');
  }

  /* ---------- Map 5e: the places' photos (the owner's A, A2, B, E, F), beside the mockup ---------- */
  const settle = async () => {
    await nap(900);
    await idle();
    await nap(700);
    await idle();
  };
  /* to a zoom by the map's own + and − (a whole step each), then at rest */
  const camera = async (z) => {
    const cur = (await js("document.querySelector('.m-canvas').dataset.center")).split(',').map(Number);
    const steps = Math.round((z - cur[2]) * 1);
    for (let i = 0; i < Math.abs(steps); i++) {
      await js(`document.querySelector('.m-zoom button[aria-label="${steps > 0 ? 'Zoom in' : 'Zoom out'}"]').click(); 'ok'`);
      await nap(450);
    }
    await settle();
    return (await js("document.querySelector('.m-canvas').dataset.center")) + ` photos=${await js("document.querySelector('.m-canvas').dataset.photos||'0'")}`;
  };
  for (const [w, h] of [
    [412, 915],
    [384, 824],
  ]) {
    await size(w, h);
    /* A: the Temple of Heaven, as the mockup draws it — its photo, credit, About, links */
    await go(`${BASE}?d=2026-12-08#/trip/cn26/map/cn26-spot-beijing-temple-heaven`);
    await settle();
    await js("(async()=>{ for(let i=0;i<60&&!(document.querySelector('.ps-hero img')||{}).naturalWidth;i++) await new Promise(r=>setTimeout(r,100)); return 'ok'; })()");
    await shot(`${w}-5e-A`);
    await js("(async()=>{ const s=document.querySelector('.m-sheet'); s.scrollTop=s.scrollHeight; await new Promise(r=>setTimeout(r,500)); return 'ok'; })()");
    await shot(`${w}-5e-A-end`);
    /* the photo, full screen */
    await js("(async()=>{ const h=document.querySelector('button.ps-hero'); if(!h) return 'no photo (not in this pack)'; h.click(); for(let i=0;i<40&&!(document.querySelector('.pv img')||{}).naturalWidth;i++) await new Promise(r=>setTimeout(r,100)); return 'ok'; })()");
    await shot(`${w}-5e-viewer`);
    /* A with the longest credit the pack carries (Senado Square's, Commons' own words, 75 characters): all of it
       on the card, the licence too — the chip says whether it had to cut */
    await go(`${BASE}?d=2026-12-23#/trip/cn26/map/cn26-spot-hongkong-senado`);
    await settle();
    await js("(async()=>{ for(let i=0;i<60&&!(document.querySelector('.ps-hero img')||{}).naturalWidth;i++) await new Promise(r=>setTimeout(r,100)); return 'ok'; })()");
    console.log(`  A long credit at ${w}:`, await js("(()=>{ const c=document.querySelector('.ps-credit'); return c ? `${Math.round(c.getBoundingClientRect().height)} px, ${c.scrollHeight>c.clientHeight+1||c.scrollWidth>c.clientWidth+1?'CUT':'whole'} — ${c.textContent.trim()}` : 'no credit'; })()"));
    await shot(`${w}-5e-A-longcredit`);
    /* …and in Guide me's Look for this */
    await go(`${BASE}?d=2026-12-23#/trip/cn26/map/cn26-spot-hongkong-senado/go`);
    await settle();
    await js("(async()=>{ for(let i=0;i<60&&!(document.querySelector('.gm-look img')||{}).naturalWidth;i++) await new Promise(r=>setTimeout(r,100)); return 'ok'; })()");
    console.log(`  F long credit at ${w}:`, await js("(()=>{ const c=document.querySelector('.gm-look3'); return c ? `${Math.round(c.getBoundingClientRect().height)} px, ${c.scrollHeight>c.clientHeight+1||c.scrollWidth>c.clientWidth+1?'CUT':'whole'} — ${c.textContent.trim()}` : 'no credit'; })()"));
    await shot(`${w}-5e-F-longcredit`);
    /* A2: the Massage Hospital — no free photo */
    await go(`${BASE}?d=2026-12-08#/trip/cn26/map/cn26-place-07`);
    await settle();
    await shot(`${w}-5e-A2`);
    /* B: the rail near you, a photo on each card */
    await go(`${BASE}?d=2026-12-08#/trip/cn26/map`);
    await settle();
    await js("(async()=>{ for(let i=0;i<60&&[...document.querySelectorAll('.rail .rc-ph img')].filter(x=>x.naturalWidth).length<2;i++) await new Promise(r=>setTimeout(r,100)); return 'ok'; })()");
    await shot(`${w}-5e-B`);
    /* the owner's fold: "Near you" open, folded to its bar by the chevron, open again */
    await shot(`${w}-5e-peek-shown`);
    console.log(`  the head at ${w}:`, await js("(()=>{ const s=document.querySelector('.m-peeksub'); return s ? `\"${s.textContent.trim()}\" ${s.scrollWidth>s.clientWidth+1?'CUT':'whole'}` : 'no head'; })()"));
    const fold = async () => {
      await js("(async()=>{ document.querySelector('.m-peekbtn').click(); await new Promise(r=>setTimeout(r,700)); return 'ok'; })()");
      await settle();
      return js("(()=>{ const p=document.querySelector('.m-peek'), b=document.querySelector('.m-peekbtn'); return Math.round(p.getBoundingClientRect().height)+' px, aria-expanded '+b.getAttribute('aria-expanded'); })()");
    };
    console.log(`  fold at ${w}:`, await fold());
    await shot(`${w}-5e-peek-folded`);
    console.log(`  unfold at ${w}:`, await fold());
    /* E: the pins close in (photos) and one step out (icons), round Houhai */
    for (const z of [14.5, 15.5, 16.5]) {
      console.log(`  E z${z}:`, await camera(z));
      await shot(`${w}-5e-E-z${String(z).replace('.', '_')}`);
    }
    /* E where places crowd: Central, Hong Kong (you in Central) */
    await S('Emulation.setGeolocationOverride', { latitude: 22.2838, longitude: 114.1535, accuracy: 20 });
    await go(`${BASE}?d=2026-12-23#/trip/cn26/map`);
    await settle();
    for (const z of [15.5, 16.5]) {
      console.log(`  E HK z${z}:`, await camera(z));
      await shot(`${w}-5e-E-hk-z${String(z).replace('.', '_')}`);
    }
    await S('Emulation.setGeolocationOverride', { latitude: 39.938, longitude: 116.3871, accuracy: 25 });
    /* F: Guide me to the Temple of Heaven — Look for this */
    await go(`${BASE}?d=2026-12-08#/trip/cn26/map/cn26-spot-beijing-temple-heaven/go`);
    await js("window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute',{alpha:180,beta:20,gamma:-8,absolute:true})); 'ok'");
    await settle();
    await js("(async()=>{ for(let i=0;i<60&&!(document.querySelector('.gm-look img')||{}).naturalWidth;i++) await new Promise(r=>setTimeout(r,100)); return 'ok'; })()");
    await shot(`${w}-5e-F`);
    /* Settings › Photo credits */
    await go(`${BASE}#/settings`);
    await nap(1200);
    await js("(async()=>{ for(let i=0;i<50&&!document.querySelector('.mp-credits');i++) await new Promise(r=>setTimeout(r,100)); document.querySelector('.mp-credits').scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,300)); return 'ok'; })()");
    await shot(`${w}-5e-settings`);
    await js("(async()=>{ document.querySelector('.mp-credits').click(); await new Promise(r=>setTimeout(r,1200)); return 'ok'; })()");
    await shot(`${w}-5e-credits`);
  }
  for (const [w, h] of ONLY === '5e'
    ? []
    : [
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
    /* one step out: pins round the foot of the map — the scale and the attribution keep off them */
    await js(`(async()=>{ document.querySelector('.m-zoom button[aria-label="Zoom out"]').click(); return 'ok'; })()`);
    await nap(900);
    await idle();
    await nap(600);
    await shot(`${w}-map-out`);
    await js(`(async()=>{ document.querySelector('.m-zoom button[aria-label="Zoom in"]').click(); return 'ok'; })()`);
    await nap(900);
    await idle();
    /* facing west, the phone near flat and rolled a little (β 20°, γ −8°): the board's beam */
    await js("window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute',{alpha:90,beta:20,gamma:-8,absolute:true})); 'ok'");
    await nap(900);
    await shot(`${w}-map-heading`);

    await go(`${BASE}?d=2026-12-08#/trip/cn26/map/cn26-place-07`);
    await idle();
    await nap(1200);
    await idle();
    await shot(`${w}-place`);

    await go(`${BASE}?d=2026-12-08#/trip/cn26/map/cn26-place-07/go`);
    await idle();
    await js("window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute',{alpha:90,beta:20,gamma:-8,absolute:true})); 'ok'");
    await nap(1500);
    await idle();
    await shot(`${w}-go`);

    /* Guide me in Hong Kong: Google Maps first, no Amap, no VPN line — you in Central, 500 m from Tai Kwun */
    await S('Emulation.setGeolocationOverride', { latitude: 22.2838, longitude: 114.1583, accuracy: 20 });
    await go(`${BASE}?d=2026-12-23#/trip/cn26/map/cn26-spot-hongkong-tai-kwun/go`);
    await idle();
    await js("window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute',{alpha:120,beta:15,gamma:4,absolute:true})); 'ok'");
    await nap(1500);
    await idle();
    await shot(`${w}-go-hongkong`);
    await S('Emulation.setGeolocationOverride', { latitude: 39.938, longitude: 116.3871, accuracy: 25 });

    /* the map that cannot start (no WebGL): the fallback, the rail still there */
    await go(`${BASE}?d=2026-12-08#/trip/cn26/now`);
    await js("(async()=>{ const real=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(t,...a){ return /webgl/i.test(String(t))?null:real.call(this,t,...a); }; [...document.querySelectorAll('.navbar .navitem')].find(x=>x.dataset.place==='map').click(); for(let i=0;i<80&&!document.querySelector('.m-fail');i++) await new Promise(r=>setTimeout(r,100)); await new Promise(r=>setTimeout(r,1200)); return 'ok'; })()");
    await shot(`${w}-fail`);

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
} catch (e) {
  /* --perf ends its walk here, on purpose */
  if (!/perf-done/.test(String(e?.message))) throw e;
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
