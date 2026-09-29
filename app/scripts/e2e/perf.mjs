/* THE S23 PROXY, MEASURED (Horizon Run 4) — `node scripts/e2e/perf.mjs`.

   Headless Chrome at the S23 Ultra's real CSS width (384 px), the CPU slowed
   4× (Emulation.setCPUThrottlingRate), the built app served locally — no
   network is involved, as on the phone, where the APK carries every file.

   Three walks, each run several times and reported as medians:

   1. COLD START of Now on Dec 11 (a travel day, the fullest Now screen):
      no HTTP cache and no service worker (the native app has none), so every
      run parses and evaluates the JavaScript afresh. From a trace: the entry
      module's compile + evaluation, and the main thread's scripting and
      rendering time until Now is complete; from the page: first contentful
      paint, the frame Now first appears in, and the frame its LAST state is
      painted in — every state it passes through on the way is recorded (its
      tiles, its sentence, its map), because a Now drawn before its tables
      have all answered says false things ("Tonight's bed is not booked
      yet") until they do. Long tasks (≥ 50 ms, the browser's own
      PerformanceObserver) are counted after first paint; the budget is none
      over 200 ms.
   2. JOURNEY'S PLAY on Dec 11, pressed and left to run to its end: every
      animation frame's interval, the frames slower than 50 and 100 ms, and
      the long tasks while it plays.
   3. AT REST: main-thread busy time per second (Performance.getMetrics
      TaskDuration over 3 s, nothing touched) — Journey scrolled to its
      bottom (the map and its Flow out of view), the Pocket scrolled to its
      bottom (the TODAY card's opal edge out of view), and Now at its top
      (its loops in view — the control).

   `--dist <dir>` (repeatable, `label=dir`) measures other builds too — each
   on its own port, the runs interleaved so a busy machine slows every build
   alike; `--runs N` (default 5). The trip is imported once per build, from
   this checkout's seed, the way the rehearsal imports it. Nothing here
   changes the app, and nothing reaches the internet (https is blocked).
   Plain text is injected into the page: no backticks inside those strings. */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../../', import.meta.url));
const SEED = join(APP, '..', 'seed', 'china-2026.trip.json');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WIDTH = 384;
const HEIGHT = 824;
const THROTTLE = 4;

const args = process.argv.slice(2);
const RUNS = Number(args[args.indexOf('--runs') + 1]) || 5;
const dists = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--dist') continue;
  const v = args[++i] ?? '';
  const eq = v.indexOf('=');
  dists.push(eq > 0 ? { label: v.slice(0, eq), dir: resolve(v.slice(eq + 1)) } : { label: v, dir: resolve(v) });
}
if (!dists.length) dists.push({ label: 'dist', dir: join(APP, 'dist') });
for (const d of dists) {
  if (!existsSync(join(d.dir, 'index.html'))) {
    console.error(`No build at ${d.dir} — run \`npm run build\` first.`);
    process.exit(2);
  }
}

const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const servers = [];
const alive = async (base) => {
  try {
    return (await fetch(base, { cache: 'no-store' })).ok;
  } catch {
    return false;
  }
};
for (const [i, d] of dists.entries()) {
  d.port = 4180 + i;
  d.base = `http://localhost:${d.port}/`;
  if (await alive(d.base)) {
    console.error(`Port ${d.port} is already serving something — stop it, then rerun.`);
    process.exit(2);
  }
  const srv = spawn(
    process.execPath,
    [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(d.port), '--strictPort', '--outDir', d.dir],
    { cwd: APP, stdio: 'ignore' },
  );
  servers.push(srv);
  let up = false;
  for (let k = 0; k < 80 && !up; k++) {
    await nap(250);
    up = await alive(d.base);
  }
  if (!up) {
    console.error(`Could not serve ${d.dir} on ${d.base}`);
    for (const s of servers) s.kill();
    process.exit(2);
  }
}

const PORT = 9250 + Math.floor(Math.random() * 50);
const PROFILE = `${process.env.TEMP || '.'}\\cdp-perf-${PORT}-${Date.now()}`;
const chrome = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, `--window-size=${WIDTH},${HEIGHT}`, 'about:blank'],
  { stdio: 'ignore' },
);
function cleanup() {
  try {
    ws.close();
  } catch {}
  try {
    chrome.kill();
  } catch {}
  for (const s of servers) {
    try {
      s.kill();
    } catch {}
  }
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {}
}

let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await nap(250);
}
if (!wsUrl) {
  console.error('Chrome did not start.');
  cleanup();
  process.exit(2);
}
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let id = 0;
const pending = new Map();
const traceChunks = [];
let traceDone = null;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
  if (m.method === 'Tracing.dataCollected') traceChunks.push(...m.params.value);
  if (m.method === 'Tracing.tracingComplete' && traceDone) traceDone();
};
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    pending.set(++id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
const js = async (x, aw = false, gesture = false) => {
  const r = await S('Runtime.evaluate', { expression: x, awaitPromise: aw, returnByValue: true, userGesture: gesture });
  return r.exceptionDetails ? `ERR ${JSON.stringify(r.exceptionDetails).slice(0, 200)}` : r.result?.value;
};
await S('Page.enable');
await S('Runtime.enable');
await S('Network.enable');
await S('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true });
/* the weather is the app's one sanctioned call; a measurement makes none */
await S('Network.setBlockedURLs', { urls: ['https://*'] });

/* what every measured page records about itself, from its first line: the
   long tasks, the first contentful paint, and every state Now's screen passes
   through — its tiles, its sentence, its map — with the frame each was
   painted in. The first is when Now first appears (whole, or not yet); the
   last is when it is complete. */
const PROBE =
  'window.__perf={long:[],fcp:null,states:[]};' +
  'try{new PerformanceObserver(function(l){for(const e of l.getEntries())window.__perf.long.push([Math.round(e.startTime),Math.round(e.duration)]);}).observe({type:"longtask",buffered:true});}catch(e){}' +
  'try{new PerformanceObserver(function(l){for(const e of l.getEntries())if(e.name==="first-contentful-paint")window.__perf.fcp=Math.round(e.startTime);}).observe({type:"paint",buffered:true});}catch(e){}' +
  'new MutationObserver(function(){var n=document.querySelector(".nowhome");if(!n||!n.querySelector(".sentence")||!n.querySelector(".nh-map svg"))return;' +
  'var snap=[].map.call(n.querySelectorAll(".rail > *"),function(t){return (t.className.match(/t-[a-z]+/)||["?"])[0];}).join(",")+"|"+n.querySelector(".sentence").textContent+"|"+n.querySelectorAll(".nh-map path").length;' +
  'var st=window.__perf.states;if(st.length&&st[st.length-1].snap===snap)return;var e={t:Math.round(performance.now()),snap:snap,paint:null};st.push(e);' +
  'requestAnimationFrame(function(){var c=new MessageChannel();c.port1.onmessage=function(){e.paint=Math.round(performance.now());};c.port2.postMessage(0);});})' +
  '.observe(document,{childList:true,subtree:true,characterData:true});';
await S('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });

async function importTrip(base) {
  await S('Emulation.setCPUThrottlingRate', { rate: 1 });
  await S('Page.navigate', { url: base });
  await nap(2500);
  await js(`window.__seed=${JSON.stringify(readFileSync(SEED, 'utf8'))};'ok'`);
  await js(
    `(async()=>{
    [...document.querySelectorAll('button')].find(b=>/Import a trip/.test(b.textContent)).click();
    await new Promise(r=>setTimeout(r,700));
    const dt=new DataTransfer(); dt.items.add(new File([window.__seed],'s.json',{type:'application/json'}));
    const i=document.querySelector('.filebtn input[type=file]'); i.files=dt.files;
    i.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,2000));
    [...document.querySelectorAll('button')].find(b=>/^(Import|Replace & import)$/.test(b.textContent.trim())).click();
    await new Promise(r=>setTimeout(r,3500));
    return 'ok';
  })()`,
    true,
  );
  const ids = await js(
    `(async()=>{ const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
    const t=await new Promise(r=>{const q=db.transaction('trips').objectStore('trips').getAll();q.onsuccess=()=>r(q.result)}); db.close(); return t.map(x=>x.id).join(','); })()`,
    true,
  );
  if (!String(ids).includes('cn26')) throw new Error(`China did not import on ${base}: ${ids}`);
}

/* ---------- the trace: what the main thread did until Now was drawn ---------- */
const SCRIPT = new Set(['EvaluateScript', 'v8.evaluateModule', 'v8.compile', 'v8.compileModule', 'FunctionCall', 'TimerFire', 'EventDispatch', 'FireAnimationFrame', 'RunMicrotasks', 'V8.Execute', 'v8.run', 'MajorGC', 'MinorGC', 'V8.GCScavenger', 'V8.GCFinalizeMC']);
const RENDER = new Set(['Layout', 'UpdateLayoutTree', 'RecalcStyles', 'PrePaint', 'Paint', 'Layerize', 'UpdateLayer', 'PaintImage', 'ParseAuthorStyleSheet', 'HitTest']);
function readTrace(events, entryName, until) {
  /* the page's main thread: the one that compiled the entry module */
  const urlOf = (e) => String(e.args?.data?.url ?? e.args?.url ?? e.args?.fileName ?? '');
  const compiled = events.find((e) => e.name === 'v8.compileModule' && urlOf(e).includes(entryName));
  const pid = compiled?.pid;
  const tid = compiled?.tid;
  const nav = events.find((e) => e.pid === pid && e.name === 'navigationStart' && e.args?.data?.documentLoaderURL);
  const t0 = nav ? nav.ts : (compiled?.ts ?? 0);
  const end = t0 + until * 1000;
  /* V8 streams the entry's compile on a worker thread; its evaluation — every
     module's top-level code, then main.ts mounting the app — is the first
     module evaluation on the main thread after its compile */
  let entryCompile = events.filter((e) => e.name.includes('RunScriptStreamingTask') && urlOf(e).includes(entryName)).reduce((s, e) => s + (e.dur ?? 0), 0);
  entryCompile += compiled?.dur ?? 0;
  const evaluated = events
    .filter((e) => e.pid === pid && e.tid === tid && e.name === 'v8.evaluateModule' && compiled && e.ts >= compiled.ts)
    .sort((a, b) => a.ts - b.ts)[0];
  const entryEval = evaluated?.dur ?? 0;
  let scripting = 0;
  let rendering = 0;
  /* top-level work only: an event nested inside one already counted is not counted twice */
  const onMain = events.filter((e) => e.pid === pid && e.tid === tid && e.ph === 'X' && e.ts >= t0 && e.ts <= end).sort((a, b) => a.ts - b.ts);
  let sEnd = 0;
  let rEnd = 0;
  for (const e of onMain) {
    if (SCRIPT.has(e.name) && e.ts >= sEnd) {
      scripting += e.dur;
      sEnd = e.ts + e.dur;
    }
    if (RENDER.has(e.name) && e.ts >= rEnd) {
      rendering += e.dur;
      rEnd = e.ts + e.dur;
    }
  }
  return { entryEval: entryEval / 1000, entryCompile: entryCompile / 1000, scripting: scripting / 1000, rendering: rendering / 1000 };
}

async function coldStart(d) {
  await S('Emulation.setCPUThrottlingRate', { rate: 1 });
  await S('Page.navigate', { url: 'about:blank' });
  await nap(400);
  await S('Network.setCacheDisabled', { cacheDisabled: true });
  await S('Network.setBypassServiceWorker', { bypass: true });
  await S('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  traceChunks.length = 0;
  await S('Tracing.start', {
    traceConfig: {
      includedCategories: ['devtools.timeline', 'v8.execute', 'v8', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'loading', '__metadata'],
    },
  });
  await S('Page.navigate', { url: `${d.base}?d=2026-12-11#/trip/cn26/now` });
  let p = null;
  for (let i = 0; i < 300; i++) {
    await nap(100);
    p = await js('window.__perf && window.__perf.states.length && window.__perf.states[0].paint!==null ? "yes" : null');
    if (p === 'yes') break;
  }
  /* what comes after the first paint: the rest of the start-up (the tables
     still landing, weather, ink) — states and long tasks counted 4 s more */
  await nap(4000);
  p = JSON.parse(await js('JSON.stringify(window.__perf)'));
  const first = p.states[0] ?? {};
  const last = p.states[p.states.length - 1] ?? {};
  const entry = String(await js('(document.querySelector(\'script[type=module][src*="assets/index-"]\')||{}).src||""')).split('/').pop();
  const done = new Promise((r) => (traceDone = r));
  await S('Tracing.end');
  await done;
  const t = readTrace(traceChunks, entry, last.paint ?? 10000);
  const after = p.long.filter(([s]) => s >= (p.fcp ?? 0));
  return {
    fcp: p.fcp,
    nowPaint: first.paint,
    nowComplete: last.paint,
    nowStates: p.states.length,
    states: p.states.map((x) => `${x.paint}ms ${x.snap.slice(0, 70)}`),
    entryCompile: t.entryCompile,
    entryEval: t.entryEval,
    scripting: t.scripting,
    rendering: t.rendering,
    longAfterFcp: after.length,
    longMaxAfterFcp: after.reduce((m, [, dur]) => Math.max(m, dur), 0),
    longOver200: after.filter(([, dur]) => dur > 200).length,
    longSumAfterFcp: after.reduce((sum, [, dur]) => sum + dur, 0),
    settled: Math.max(last.paint ?? 0, ...p.long.map(([st, dur]) => st + dur)),
    longAll: p.long,
  };
}

async function journeyPlay(d) {
  await S('Emulation.setCPUThrottlingRate', { rate: 1 });
  await S('Network.setCacheDisabled', { cacheDisabled: false });
  await S('Network.setBypassServiceWorker', { bypass: true });
  await S('Page.navigate', { url: `${d.base}?d=2026-12-11#/trip/cn26/journey` });
  await nap(4500);
  await S('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await nap(1500);
  const r = await js(
    `(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const btn=document.querySelector('.rp-play');
    if(!btn) return 'FAIL no Play button';
    const frames=[]; let stop=false;
    const f=(t)=>{ frames.push(t); if(!stop) requestAnimationFrame(f); };
    requestAnimationFrame(f);
    const t0=performance.now();
    btn.click();
    await sleep(300);
    if(!/Pause/.test(btn.getAttribute('aria-label')||'')) return 'FAIL Play did not start: '+btn.getAttribute('aria-label');
    for(let i=0;i<1800;i++){ await sleep(100); if(/^Replay my trip/.test(btn.getAttribute('aria-label')||'')) break; }
    const t1=performance.now(); stop=true;
    const iv=[]; for(let i=1;i<frames.length;i++) iv.push(frames[i]-frames[i-1]);
    const sorted=iv.slice().sort((a,b)=>a-b); const q=(x)=>sorted[Math.min(sorted.length-1,Math.floor(x*sorted.length))]||0;
    const long=window.__perf.long.filter(([s])=>s>=t0&&s<=t1);
    return JSON.stringify({ ms:Math.round(t1-t0), frames:frames.length, p50:Math.round(q(0.5)), p95:Math.round(q(0.95)), max:Math.round(sorted[sorted.length-1]||0),
      over50:iv.filter(x=>x>50).length, over100:iv.filter(x=>x>100).length, long:long.length, longMax:long.reduce((m,[,d])=>Math.max(m,d),0), longSum:long.reduce((s,[,d])=>s+d,0) });
  })()`,
    true,
    true,
  );
  if (!String(r).startsWith('{')) throw new Error(`Play on ${d.label}: ${r}`);
  return JSON.parse(r);
}

async function atRest(d, hash, where) {
  await S('Emulation.setCPUThrottlingRate', { rate: 1 });
  await S('Network.setCacheDisabled', { cacheDisabled: false });
  await S('Network.setBypassServiceWorker', { bypass: true });
  await S('Page.navigate', { url: 'about:blank' });
  await S('Page.navigate', { url: `${d.base}${hash}` });
  /* Relay's one sweep and Ink's one painting are over by then */
  await nap(6000);
  await js(where === 'bottom' ? 'window.scrollTo(0, document.documentElement.scrollHeight)' : 'window.scrollTo(0, 0)');
  await nap(1200);
  await S('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await S('Performance.enable');
  const read = async () => Object.fromEntries((await S('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const a = await read();
  await nap(3000);
  const b = await read();
  await S('Performance.disable');
  return ((b.TaskDuration - a.TaskDuration) * 1000) / ((b.Timestamp - a.Timestamp) || 3);
}

const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

try {
  for (const d of dists) {
    await importTrip(d.base);
    d.cold = [];
    d.play = [];
    d.rest = [];
  }
  console.log(`S23 proxy: ${WIDTH}×${HEIGHT} CSS px, CPU ×${THROTTLE}, ${RUNS} runs per build, medians.\n`);
  for (let r = 0; r < RUNS; r++) {
    for (const d of dists) d.cold.push(await coldStart(d));
    for (const d of dists) d.play.push(await journeyPlay(d));
    for (const d of dists) {
      d.rest.push({
        journey: await atRest(d, '?d=2026-12-11#/trip/cn26/journey', 'bottom'),
        pocket: await atRest(d, '?d=2026-12-11#/trip/cn26/pocket', 'bottom'),
        now: await atRest(d, '?d=2026-12-11#/trip/cn26/now', 'top'),
      });
    }
    process.stderr.write(`run ${r + 1}/${RUNS} done\n`);
  }
  const rowsCold = [
    ['first contentful paint (ms)', 'fcp'],
    ['Now first painted, whole or not (ms)', 'nowPaint'],
    ['Now complete — its last state painted (ms)', 'nowComplete'],
    ['states Now passes through (1 = drawn once, whole)', 'nowStates'],
    ['entry module compile (ms)', 'entryCompile'],
    ['entry module evaluation (ms)', 'entryEval'],
    ['main-thread scripting until Now is complete (ms)', 'scripting'],
    ['main-thread rendering until Now is complete (ms)', 'rendering'],
    ['long tasks after first paint (count)', 'longAfterFcp'],
    ['longest task after first paint (ms)', 'longMaxAfterFcp'],
    ['long tasks > 200 ms after first paint', 'longOver200'],
    ['long-task time after first paint (ms)', 'longSumAfterFcp'],
    ['settled — the last long task ends (ms)', 'settled'],
  ];
  const rowsPlay = [
    ['Play, pressed to its end (ms)', 'ms'],
    ['frames drawn', 'frames'],
    ['frame interval p50 (ms)', 'p50'],
    ['frame interval p95 (ms)', 'p95'],
    ['slowest frame (ms)', 'max'],
    ['frames slower than 50 ms', 'over50'],
    ['frames slower than 100 ms', 'over100'],
    ['long tasks while playing', 'long'],
    ['longest task while playing (ms)', 'longMax'],
  ];
  const head = `| | ${dists.map((d) => d.label).join(' | ')} |\n|---|${dists.map(() => '---:').join('|')}|`;
  const fmt = (v) => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)) : '—');
  console.log('Cold start of Now (Dec 11)\n');
  console.log(head);
  for (const [label, k] of rowsCold) console.log(`| ${label} | ${dists.map((d) => fmt(median(d.cold.map((x) => x[k])))).join(' | ')} |`);
  console.log('\nJourney · Play (Dec 11)\n');
  console.log(head);
  for (const [label, k] of rowsPlay) console.log(`| ${label} | ${dists.map((d) => fmt(median(d.play.map((x) => x[k])))).join(' | ')} |`);
  console.log('\nAt rest — main-thread busy time (ms per second, nothing touched)\n');
  console.log(head);
  for (const [label, k] of [
    ['Journey, scrolled to the bottom (map out of view)', 'journey'],
    ['Pocket, scrolled to the bottom (TODAY card out of view)', 'pocket'],
    ['Now at the top (its loops in view — control)', 'now'],
  ]) console.log(`| ${label} | ${dists.map((d) => fmt(median(d.rest.map((x) => x[k])))).join(' | ')} |`);
  if (args.includes('--raw')) {
    for (const d of dists) {
      console.log(`\n${d.label} raw cold:`, JSON.stringify(d.cold.map(({ longAll, ...x }) => ({ ...x, longAll: longAll.slice(0, 12) }))));
      console.log(`${d.label} the states Now passed through, first run:\n  ${(d.cold[0]?.states ?? []).join('\n  ')}`);
      console.log(`${d.label} raw play:`, JSON.stringify(d.play));
      console.log(`${d.label} raw rest:`, JSON.stringify(d.rest));
    }
  }
} catch (e) {
  console.error(String(e?.stack ?? e));
  cleanup();
  process.exit(2);
}
cleanup();
process.exit(0);
