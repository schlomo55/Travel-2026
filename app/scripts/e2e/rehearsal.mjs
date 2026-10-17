/* The dress rehearsal, scripted: install, import China, then go hard-offline and
   walk every screen and every date that matters. */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* 4173 unless REHEARSAL_PORT says otherwise: both checkouts rehearse on this
   machine, and one may be serving its own build on 4173 while the other runs
   (the served-build check below refuses to walk someone else's app). */
const PREVIEW_PORT = String(Number(process.env.REHEARSAL_PORT) || 4173);
const BASE = `http://localhost:${PREVIEW_PORT}/`;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = fileURLToPath(new URL('../../', import.meta.url));
/* The seed of THIS checkout — a worktree rehearses its own data, never the
   main repo's (which another session may be editing). */
const SEED = join(APP, '..', 'seed', 'china-2026.trip.json');
const PORT = 9150 + Math.floor(Math.random() * 50);
/* A THROWAWAY profile per run, and it must be unique. A reused directory keeps
   the service worker from the last run, which precached the PREVIOUS build —
   the rehearsal then walks an app that is one deploy old and lies to you. */
const PROFILE = `${process.env.TEMP || '.'}\\cdp-reh-${PORT}-${Date.now()}`;
const nap = (ms) => new Promise((r) => setTimeout(r, ms));

/* THE SERVER IS A PRECONDITION, NOT AN ASSUMPTION.
   This walk needs the BUILT app on localhost:4173 — the service worker exists
   only in a preview build, and it is the worker that answers once we go
   offline. With nothing listening, every navigation lands on Chrome's own
   error page: the suite then reports forty invented failures, and two checks
   go GREEN on the blank page ("0 map buttons", "0 network calls"). So the
   rehearsal serves the build itself rather than trusting someone to. */
const alive = async () => {
  try { return (await fetch(BASE, { cache: 'no-store' })).ok; } catch { return false; }
};
let preview = null;
if (!(await alive())) {
  if (!existsSync(join(APP, 'dist', 'index.html'))) {
    console.error('No dist/ to rehearse — the dress rehearsal walks the BUILT app.');
    console.error('Run `npm run build` first.');
    process.exit(2);
  }
  preview = spawn(process.execPath,
    [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', PREVIEW_PORT, '--strictPort'],
    { cwd: APP, stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80 && !up; i++) { await nap(250); up = await alive(); }
  if (!up) {
    console.error(`Could not serve the build on ${BASE} — is port ${PREVIEW_PORT} taken by something else?`);
    preview.kill();
    process.exit(2);
  }
  console.log('Preview server started for this run.');
}
/* …AND IT MUST BE THIS BUILD. Two checkouts of this repo exist (the main one
   and the Horizon worktree), and either may leave a preview running on 4173:
   walking the other one's app would grade screens this dist does not have. */
{
  const served = await (await fetch(BASE, { cache: 'no-store' })).text();
  const built = readFileSync(join(APP, 'dist', 'index.html'), 'utf8');
  const script = (h) => (/assets\/index-[\w-]+\.js/.exec(h) || [''])[0];
  if (script(served) !== script(built)) {
    console.error(`The server on ${BASE} is serving a different build (${script(served) || 'no bundle'}),`);
    console.error(`not this checkout's dist/ (${script(built)}). Stop it, then rerun.`);
    preview?.kill();
    process.exit(2);
  }
}

/* WebGL through SwiftShader (Map 5c): the Map tab draws its streets with
   WebGL, and a headless Chrome has no GPU — ANGLE's software renderer stands
   in, as the map spike measured it. */
const chrome = spawn(CHROME, ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=412,915', 'about:blank'], { stdio: 'ignore' });

async function devtools() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('no devtools');
}
const ws = new WebSocket(await devtools());
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const p = new Map(); const errs = [];
/* Every request the page attempts. Cleared the moment we go offline, so what
   remains is proof the app touched the network when it promised not to. */
let netlog = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data);
  if (m.id && p.has(m.id)) { const { res, rej } = p.get(m.id); p.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 180));
  if (m.method === 'Network.requestWillBeSent') netlog.push(m.params.request.url);
  /* a worker (the map engine's, the service worker) is attached too, so what
     it asks for is logged. It waits for us as it starts
     (waitForDebuggerOnStart, Map 5d): the network watch goes in BEFORE it runs
     a line, then it is let go — attached running, a worker's first requests
     could go out before the log began, and "nothing asked off this machine"
     would not be the whole story. The two commands go together, in order (a
     session takes its commands in turn): a paused service worker does not
     ANSWER Network.enable until it runs, so waiting for that answer before
     resuming it would leave it paused for good — never installed, and the
     offline walk would have no worker to answer it (probed, Map 5d). */
  if (m.method === 'Target.attachedToTarget') {
    const s2 = m.params.sessionId;
    send('Network.enable', {}, s2).catch(() => {});
    send('Runtime.runIfWaitingForDebugger', {}, s2).catch(() => {});
  }
};
const send = (me, pa = {}, s) => new Promise((res, rej) => { p.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method: me, params: pa, sessionId: s })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, pa) => send(m, pa, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');
await S('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
/* `gesture`: run the check as a tap would (transient user activation). Chrome
   marks history entries made WITHOUT one as skippable, and once a tab's
   history is full (50 entries — this walk makes far more) it prunes the
   oldest skippable entry first: a walk that steps back through its own
   entries needs them to be kept, as a thumb's taps keep them. */
const js = async (x, aw = false, gesture = false) => {
  let r;
  try {
    r = await S('Runtime.evaluate', { expression: x, awaitPromise: aw, returnByValue: true, userGesture: gesture });
  } catch (e) {
    /* The page left its document while a check ran (a back press past the
       app's own entries, a reload): that is the check's failure, not the
       harness's — report it on that row and walk on (Run 3c). */
    console.error(`A check's page navigated away mid-check: ${String(e?.message ?? e).slice(0, 80)} — in: ${x.replace(/\s+/g, ' ').slice(0, 140)}`);
    return 'FAIL the page navigated away during the check';
  }
  return r.exceptionDetails ? 'ERR' : r.result?.value;
};
const wait = nap;

/* THE PASS, OPENED THE WAY A THUMB OPENS IT. The Wallet drew every card of a
   segment at once; Horizon gives every booking its own screen — the pass, at
   pocket/<id>, wrapped in `id="bk-<id>"` — so a check that reads many bookings
   walks them inside the app: set the hash, wait for that booking's pass, read
   it. `snapPass` takes what the checks read while the pass is live (sizes and
   clipboard need the rendered element). Injected as plain text into checks:
   no backticks in here, ever. */
const PASS_HELPERS =
  "const __sleep=(ms)=>new Promise(r=>setTimeout(r,ms));" +
  "const openPass=async(id)=>{ const h='#/trip/cn26/pocket/'+id; if(location.hash!==h) location.hash=h;" +
  " for(let i=0;i<40;i++){ await __sleep(100); const el=document.getElementById('bk-'+id); if(el&&el.isConnected) return el; } return null; };" +
  "const snapPass=(el)=>el?{ stamp:(el.querySelector('.tk-stamp')?.textContent||'').trim()," +
  " hasStrip:!!el.querySelector('.codestrip'), text:el.innerText," +
  " geos:[...el.querySelectorAll('.maps button')].map(b=>b.getAttribute('data-geo')||'') }:null;";

function cleanup() {
  try { ws.close(); } catch {}
  try { chrome.kill(); } catch {}
  try { preview?.kill(); } catch {}
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
}
/* Every abort below exits 2, never 1: a broken rehearsal is a different animal
   from a failing one, and it must never print a table of verdicts it did not
   earn. */
function bail(...lines) {
  for (const l of lines) console.error(l);
  cleanup();
  process.exit(2);
}

/* The import lands ON the trip since Run 4b (it landed on the shelf, by the
   race Run 4b fixed), and a trip screen refreshes its forecast — so the
   forecast service is blocked while the app is online for its install: the
   harness makes no request to it, and nothing is cached that the offline walk
   did not have before. Lifted again just before the network goes. */
await S('Network.setBlockedURLs', { urls: ['*open-meteo*'] });
await S('Page.navigate', { url: BASE });
await wait(2500);
await js(`window.__seed=${JSON.stringify(readFileSync(SEED, 'utf8'))};'ok'`);
/* IMPORT LANDS ON THE TRIP IT IMPORTED (Run 4b), and one back press is the
   shelf it was imported from: read here, reported with the walk below */
const importLanded = await js(`(async()=>{
  [...document.querySelectorAll('button')].find(b=>/Import a trip/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,700));
  const dt=new DataTransfer(); dt.items.add(new File([window.__seed],'s.json',{type:'application/json'}));
  const i=document.querySelector('.filebtn input[type=file]'); i.files=dt.files;
  i.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,2000));
  [...document.querySelectorAll('button')].find(b=>/^(Import|Replace & import)$/.test(b.textContent.trim())).click();
  await new Promise(r=>setTimeout(r,3500));
  const landed=location.hash, sheet=!!document.querySelector('.sheet');
  history.back(); await new Promise(r=>setTimeout(r,1200));
  return JSON.stringify({ landed, sheet, back: location.hash });
})()`, true);
/* Did the import actually land? The click sequence above swallows its own
   failures, and an empty vault fails every check below for a reason that has
   nothing to do with the screens. */
const installed = await js(`(async()=>{
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const trips=await new Promise(r=>{const q=db.transaction('trips').objectStore('trips').getAll();q.onsuccess=()=>r(q.result)});
  db.close();
  return trips.map(t=>t.id).join(',');
})()`, true);
if (!String(installed).includes('cn26')) {
  bail('China never imported — the vault holds: ' + (installed || '(nothing)'),
    'Nothing below would mean anything. Check the import sheet and the seed at:',
    '  ' + SEED);
}
console.log('Installed and China imported. Going offline…\n');

await S('Network.setBlockedURLs', { urls: [] });
await S('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
netlog = [];

/* One probe before the walk. If the shell does not come back from the service
   worker's precache, what follows is not a test of anything — it is Chrome's
   offline error page, forty times over. */
await S('Page.navigate', { url: `${BASE}#/trips` });
await wait(2200);
const shell = await js(`!!document.querySelector('#app')?.children.length`);
if (shell !== true) {
  bail('THE OFFLINE SHELL DID NOT LOAD — no service worker answered once the network went away.',
    'Every check below would have failed for that one reason, so none were run.',
    'Rebuild (`npm run build`) so dist/sw.js precaches this build, then rerun.');
}

const rows = [];
async function check(label, url, mustContain) {
  await S('Page.navigate', { url });
  await wait(2200);
  /* innerText applies CSS text-transform, so headings come back uppercased —
     compare case-insensitively. */
  const text = String(await js(`document.body.innerText`)).toLowerCase();
  const want = mustContain.map((s) => s.toLowerCase());
  const ok = want.every((s) => text.includes(s));
  rows.push([ok ? 'PASS' : 'FAIL', label, ok ? '' : `missing: ${mustContain.filter((_, i) => !text.includes(want[i])).join(', ')}`]);
}

/* IMPORT LANDS ON THE TRIP (Run 4b). The import sheet closed with a step back
   that landed after the app had gone to the trip — on the shelf. Read from the
   install's own import, above: on China 2026's Now, no sheet, and one back
   press is the shelf. */
{
  let r = null;
  try { r = JSON.parse(importLanded); } catch {}
  const ok = r && r.landed === '#/trip/cn26/now' && !r.sheet && r.back === '#/trips';
  rows.push([ok ? 'PASS' : 'FAIL', 'Import · lands on the trip it imported', ok ? 'China 2026 · Now; one back press → the shelf'
    : r ? `landed on ${r.landed}${r.sheet ? ' with the sheet open' : ''}, back → ${r.back}` : String(importLanded).slice(0, 60)]);
}

/* the six hard days from ABOUT.md, plus each tab.
   HORIZON RUN 2: Now is two screens. The home (now) is the map, the one
   sentence and the glance tiles; the day's own facts — its runbook, its plan,
   its places, tonight's bed — live on the day screen (now/day, the ?d= date).
   Every fact below is still asserted, on the screen that now holds it. */
await check('Nov 21 · departure runbook', `${BASE}?d=2026-11-21#/trip/cn26/now/day`, ['Departure runbook', 'NordWhisper', 'Day 1 of 37']);
/* Nov 22's runbook used to end on "No Sunday academy pickup → taxi ~$50", which
   was true of an itinerary that arrived at the academy on the Sunday and of a
   school that had never offered to collect anyone. Both facts died: the stay
   moved to Monday on 12 Aug, and on 13 Aug the school agreed to collect from the
   hotel at 11:00. The check moves with them rather than being dropped — the
   runbook still has to say what happens next, it just says a different thing.
   AND AGAIN ON 2026-09-28: the school asked for the night in MUPING and moved
   the pickup to "earliest 10:30, wait in the lobby"; the Muping bed was booked
   the same morning, so the runbook names tonight's hotel too. */
await check('Nov 22 · arrival, the Monday pickup is set', `${BASE}?d=2026-11-22#/trip/cn26/now/day`, ['Arrival runbook', 'the academy collects you from the lobby', 'from 10:30 tomorrow', 'Jinjiang Inn Select, Muping']);
/* …and the visa count that starts tomorrow: the VISA tile on Now's home says
   it on the day you cross in (Today's visa card said it until Run 2). */
await check('Nov 22 · the visa tile says entry day', `${BASE}?d=2026-11-22#/trip/cn26/now`, ['entry day']);
await check('Nov 25 · Kunyu default day', `${BASE}?d=2026-11-25#/trip/cn26/now/day`, ['Kunyu Academy', 'usual day']);
/* Dec 11 moved to DAXING on 2026-09-27, and on 2026-10-17 it left Beijing
   altogether: skiing was dropped, Dec 9–11 is Shanghai + Disneyland, and the
   day is the Hi Cozy hostel → Line 2 → Pudong → MU394 (booked the same day).
   The runbook must show the airport, its NOT, the flight and its booking. */
await check('Dec 11 · the Pudong flight', `${BASE}?d=2026-12-11#/trip/cn26/now/day`, ['Pudong flight', 'Pudong (PVG)', 'NOT Hongqiao', 'MU394', 'NXBE5C']);
const dec11NotPek = await js(`(()=>{
  const t=document.body.innerText;
  if(/NOT Daxing/i.test(t)) return 'FAIL Dec 11 says NOT Daxing';
  if(/Taizicheng|Qinghe|Element Chongli/i.test(t)) return 'FAIL Dec 11 still runs the Chongli day';
  if(/PEK T3|PEK Terminal 3|Capital Airport/i.test(t)) return 'FAIL Dec 11 sends you to Capital';
  return 'ok Pudong, no Chongli and no Beijing airport';
})()`);
rows.push([String(dec11NotPek).startsWith('ok') ? 'PASS' : 'FAIL', 'Dec 11 · no surface still runs the Chongli day', String(dec11NotPek).slice(0, 56)]);
/* RUN 3b — THE WARNING ON THE STATION IT IS ABOUT. The board put "NOT
   Capital" on the Daxing row; since 2026-10-17 the day's one NOT is "NOT
   Hongqiao" on the Pudong row, lifted from the crossing's own runbook step
   ("taxi to Pudong (PVG) — NOT Hongqiao"), word for word, in warn amber — and
   on no other station. */
const pkxWarn = await js(`(()=>{
  const rows=[...document.querySelectorAll('.metro .m-st')];
  const pvg=rows.find(r=>/Pudong/.test(r.querySelector('.m-name')?.textContent||''));
  if(!pvg) return 'FAIL no Pudong station on the Dec 11 line';
  const w=pvg.querySelector('.m-warn');
  if(!w||w.textContent.trim()!=='NOT Hongqiao') return 'FAIL the Pudong row carries no NOT Hongqiao: '+pvg.innerText.replace(/\\s+/g,' ').slice(0,60);
  const want=getComputedStyle(document.documentElement).getPropertyValue('--warn-ink').trim();
  const probe=document.createElement('i'); probe.style.color=want; document.body.appendChild(probe);
  const amber=getComputedStyle(probe).color; probe.remove();
  if(getComputedStyle(w).color!==amber) return 'FAIL the warning is not warn amber: '+getComputedStyle(w).color;
  if(rows.filter(r=>r.querySelector('.m-warn')).length!==1) return 'FAIL a warning on another station';
  return 'ok '+w.textContent.trim();
})()`);
rows.push([String(pkxWarn).startsWith('ok') ? 'PASS' : 'FAIL', 'Dec 11 · NOT Hongqiao on the Pudong row', String(pkxWarn).slice(0, 56)]);
/* PLACES TODAY — the day→place join, on the screen (scripts/china/day-places.ts).
   Three days, chosen because all three are CROSS-NAME links: the day text and
   the entity disagree, so a chip appearing under the written name would mean
   the manifest had been "corrected" into a text match. Dec 6 says "Forbidden
   City" and must show the Palace Museum; Dec 15 says "Liziba" and "Eling Park /
   Testbed 2"; Dec 24 says "Yat Lok roast goose" and "Star Ferry".
   Dec 24 also proves the negative that the whole explicit manifest exists for:
   Australia Dairy is named on that day ONLY to say it is shut on Thursdays, and
   it must not have a chip. */
await check('Dec 6 · places today, under the museum’s real name', `${BASE}?d=2026-12-06#/trip/cn26/now/day`,
  ['Places today', 'Palace Museum', '三里屯']);
await check('Dec 15 · places today, three of them', `${BASE}?d=2026-12-15#/trip/cn26/now/day`,
  ['Places today', '磁器口', 'Liziba station', 'Eling Park & Testbed 2']);
await check('Dec 24 · places today, and the one that is shut', `${BASE}?d=2026-12-24#/trip/cn26/now/day`,
  ['Places today', 'Yat Lok · roast goose', 'Star Ferry · Tsim Sha Tsui pier']);
const shut = await js(`(()=>{
  const row=[...document.querySelectorAll('.dayplaces')][0];
  if(!row) return 'FAIL no places row on Dec 24';
  if(/australia dairy/i.test(row.innerText)) return 'FAIL Australia Dairy got a chip on the day it is closed';
  const geo=row.querySelector('.maps button')?.getAttribute('data-geo')||'';
  return geo.startsWith('geo:') ? 'ok '+row.querySelectorAll('.maps button').length+' chips' : 'FAIL no geo: on the first chip';
})()`);
rows.push([String(shut).startsWith('ok') ? 'PASS' : 'FAIL', 'Places today · chips open, closed places excluded', String(shut).slice(0, 56)]);
/* DEC 22 DREW NOTHING AT ALL UNTIL 2026-07-28 — a full day in Macau, another
   territory, with not one place in the seed. Phase 2 gave it five, and they are
   the only spots on the trip that hang off a stop in a different jurisdiction
   (the Hong Kong stop, because the trip has no Macau one). This is the check
   that notices if Macau ever silently falls back out. */
await check('Dec 22 · Macau, the day that used to show nothing', `${BASE}?d=2026-12-22#/trip/cn26/now/day`,
  ['Places today', 'Ruins of St. Paul', 'Senado Square', 'Coloane village', 'Lord Stow', 'HZMB Hong Kong Port']);
const macauDay = await js(`(()=>{
  const row=[...document.querySelectorAll('.dayplaces')][0];
  if(!row) return 'FAIL no places row on Dec 22';
  const b=[...row.querySelectorAll('.maps button')];
  if(b.length!==6) return 'FAIL '+b.length+' chips on Dec 22, expected 6';
  const dead=b.filter(x=>!(x.getAttribute('data-geo')||'').startsWith('geo:'));
  if(dead.length) return 'FAIL '+dead.length+' Dec 22 chip(s) open nothing';
  /* The ferry pier is the SHEUNG WAN end, which is the one the day names. */
  const first=b[0].getAttribute('data-geo')||'';
  if(!/Ferry%20Terminal/.test(first)) return 'FAIL the day does not lead with the pier: '+first.slice(0,60);
  /* The bridge fallback is the HONG KONG port. The MACAU end of the same bridge
     has never been pinnable, and must not appear here or anywhere. */
  const all=row.innerText;
  if(/澳門邊檢|Macau Port/i.test(all)) return 'FAIL the unpinnable Macau bridge port got a chip';
  return 'ok 6 chips, 5 in Macau';
})()`);
rows.push([String(macauDay).startsWith('ok') ? 'PASS' : 'FAIL', 'Places today · the Macau day opens six places', String(macauDay).slice(0, 56)]);
/* The late arrival stopped being a thing to chase on 2026-07-27: Yue Tu Inn
   APPROVED a 22:00–23:00 window when the bed was booked, so the day must say so
   rather than telling you to message them. */
await check('Dec 16 · the late arrival', `${BASE}?d=2026-12-16#/trip/cn26/now/day`,
  ['late arrival', 'Yue Tu Inn', '2,400m', 'approved']);
/* Dec 19 is the OTHER evening arrival. Until 2026-09-27 this check demanded
   "NO late arrival was declared" — and the arrival HAD been declared and
   APPROVED on 27 Jul (Booking.com, 22:00–23:00); the email sat unread. What
   survives is the door: the Yanyuan desk still shuts at 23:00 after a 4–5 h
   shared car, so the day must say APPROVED, say 23:00, and carry the one job
   left — WhatsApp the ETA to the number, as you leave Tina's.
   IT HAD TO BECOME A RUNBOOK DAY TO SAY IT. Home replaces the timeline with the
   runbook on a runbook day, and Dec 19 was on the generic "Travel-day basics",
   so the warning sat in plan items the screen never drew. Dec 16 solved the
   same problem the same way, which is why `cn26-run-dec16` exists at all. */
await check('Dec 19 · Dali, arrival approved, send the ETA', `${BASE}?d=2026-12-19#/trip/cn26/now/day`,
  ['Dali Yanyuan', '23:00', '+86 189 8708 1208', 'late arrival is APPROVED', 'WhatsApp']);
await check('Dec 21 · VISA EXIT DAY', `${BASE}?d=2026-12-21#/trip/cn26/now/day`, ['VISA EXIT DAY', 'MU733', 'day 29']);
/* 11:00, not the 12:00 this trip assumed until the Royal Garden was booked
   direct on 2026-07-27 — an hour that decides whether the last morning is a
   slow one or a late-check-out charge. */
await check('Dec 26 · flying home', `${BASE}?d=2026-12-26#/trip/cn26/now/day`, ['flying home', 'HKG Terminal 1', '11:00']);
await check('Dec 28 · trip complete', `${BASE}?d=2026-12-28#/trip/cn26/now`, ['Trip complete', '37 days']);
/* ---------------------------------------------------------------------
   FREE BLOCKS, 2026-08-12 (Gap B). The gaps between the things that already
   carry a clock become objects, each offering 2-4 of the trip's OWN researched
   options. Three days are walked, because three different shapes of the same
   model have to hold:
     · Dec 13 — Zhangjiajie, not one clock anywhere in the day, so the whole
       waking window is one open block;
     · Dec 22 — Macau, with a BOOKED concert at 19:30, so the block stops dead
       at the ticket and nothing is offered behind it;
     · Dec 21 — the visa exit runbook, which must offer NOTHING at all.
   --------------------------------------------------------------------- */
await S('Page.navigate', { url: `${BASE}?d=2026-12-13#/trip/cn26/now/day` });
await wait(2200);
const freeOpen = await js(`(()=>{
  const b=document.querySelector('.freeblock');
  if(!b) return 'FAIL no free block on Dec 13';
  const head=b.querySelector('.fbdur')?.textContent||'';
  if(!/free/i.test(head)||!/08:00.22:00/.test(head)) return 'FAIL header reads '+head;
  const after=b.querySelector('.fbafter')?.textContent||'';
  if(!/nothing timed/i.test(after)) return 'FAIL nothing-timed line reads '+after;
  const cands=[...b.querySelectorAll('.cand')];
  if(cands.length<2||cands.length>5) return 'FAIL '+cands.length+' candidate rows';
  /* Horizon's add control is an icon button that says what it does */
  const adds=cands.filter(c=>{const b=c.querySelector('.cadd'); return b&&/add/i.test(b.getAttribute('aria-label')||'')&&b.getAttribute('aria-pressed')==='false';});
  if(adds.length!==cands.length) return 'FAIL '+(cands.length-adds.length)+' row(s) with no add control';
  return 'ok '+head+' | '+cands.length+' rows';
})()`);
rows.push([String(freeOpen).startsWith('ok') ? 'PASS' : 'FAIL', 'Dec 13 · a whole open day, with options', String(freeOpen).slice(0, 56)]);

/* ONLY WHAT THE LINE ITSELF SAYS. Those rows are read out of the Zhangjiajie
   guide's own prose, so the facts on them must be the trip's words and nothing
   else — a straight-line distance that says it is a straight line, and never a
   travel time nobody has driven. */
const freeFacts = await js(`(()=>{
  const b=document.querySelector('.freeblock');
  if(!b) return 'FAIL no block';
  if(/minutes away|min walk|walking distance/i.test(b.innerText)) return 'FAIL a travel time was invented';
  const km=[...b.querySelectorAll('.cfact')].map(e=>e.textContent).filter(t=>/km/.test(t));
  if(km.length&&!km.every(t=>t.trim().startsWith('\u2248'))) return 'FAIL a distance without the approx mark: '+km[0];
  const fall=b.querySelector('.fbfall .cand');
  if(!fall) return 'FAIL no rain / too tired row';
  const lbl=b.querySelector('.fblabel')?.textContent||'';
  if(!/rain/i.test(lbl)) return 'FAIL fallback label reads '+lbl;
  const more=b.querySelector('.fbmore')?.textContent||'';
  /* NOTE the doubled backslash: this whole check is injected through a
     template literal, which eats a lone \d before the regex ever sees it. */
  if(!/all \\d+ options/i.test(more)) return 'FAIL no doorway into the guide: '+more;
  return 'ok '+km.length+' straight lines | '+more.trim();
})()`);
rows.push([String(freeFacts).startsWith('ok') ? 'PASS' : 'FAIL', 'Free block · recorded facts only', String(freeFacts).slice(0, 56)]);

/* PICK, THEN UN-PICK. The whole point of a pick is that it is a WRITE: it must
   land in IndexedDB with its provenance marker, join the day under its own
   heading, flip the block row in place — and leave the trip's AUTHORED day
   byte-identical throughout, in both directions. */
const pick = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const authored=()=>[...document.querySelectorAll('.timeline .tcard b, .anylist .tcard:not(.mine) b')].map(e=>e.textContent).join('|');
  const dayRows=async()=>{
    const o=indexedDB.open('livingthedream'); const d=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
    const all=await new Promise(r=>{const q=d.transaction('dayPicks').objectStore('dayPicks').getAll();q.onsuccess=()=>r(q.result)});
    d.close(); return all;
  };
  if((await dayRows()).length) return 'FAIL the day started with picks already in it';
  const before=authored();
  const b=document.querySelector('.freeblock');
  const row=b.querySelector('.cand');
  const name=row.querySelector('.cname').textContent.trim();
  row.querySelector('.cadd').click();
  await sleep(900);
  const saved=await dayRows();
  if(saved.length!==1) return 'FAIL '+saved.length+' rows written';
  if(saved[0].origin!=='picked') return 'FAIL origin is '+saved[0].origin;
  if(saved[0].date!=='2026-12-13') return 'FAIL written onto '+saved[0].date;
  const mine=[...document.querySelectorAll('.tcard.mine')];
  if(mine.length!==1) return 'FAIL '+mine.length+' cards in the day';
  if(!/you picked this/i.test(mine[0].innerText)) return 'FAIL no provenance tag on the card';
  const flipped=document.querySelector('.cand.planned');
  if(!flipped) return 'FAIL the candidate row did not flip in place';
  if(!/in the day/i.test(flipped.innerText)) return 'FAIL flipped row reads '+flipped.innerText.slice(0,40);
  if(authored()!==before) return 'FAIL the authored day changed when a pick was added';
  mine[0].querySelector('.mineout').click();
  await sleep(900);
  if((await dayRows()).length) return 'FAIL un-pick left a row behind';
  if(document.querySelector('.tcard.mine')) return 'FAIL the card stayed in the day';
  if(!document.querySelector('.freeblock .cand')) return 'FAIL the block did not re-open';
  if(document.querySelector('.cand.planned')) return 'FAIL a row is still marked planned';
  if(authored()!==before) return 'FAIL the authored day changed';
  return 'ok picked+unpicked '+name.slice(0,22);
})()`, true);
rows.push([String(pick).startsWith('ok') ? 'PASS' : 'FAIL', 'Free block · pick persists, un-pick restores', String(pick).slice(0, 56)]);

/* THE DOORWAY INTO THE GUIDE. Four rows is the cap; the rest live in the city
   guide's "All the options", ~11,800 px down the longest page in the app — so
   the link has to land ON that section, not at the top of the page. */
const guideJump = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('.freeblock .fbmore').click();
  await sleep(1600);
  if(!/journey.cn26-stop-zhangjiajie.guide$/.test(location.hash)) return 'FAIL landed on '+location.hash;
  const sec=document.getElementById('g-options');
  if(!sec) return 'FAIL the options section has no anchor';
  const top=sec.getBoundingClientRect().top;
  if(top>window.innerHeight) return 'FAIL the page did not scroll to it ('+Math.round(top)+'px)';
  return 'ok scrolled to All the options';
})()`, true);
rows.push([String(guideJump).startsWith('ok') ? 'PASS' : 'FAIL', 'Free block · all options opens the guide there', String(guideJump).slice(0, 56)]);

/* DEC 22 — the block stops at a booked ticket. The HK Phil concert states
   19:30 and no finish, so there is exactly one block, it ends at 19:30, and
   nothing is offered for the evening the traveller is in a concert hall. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-22#/trip/cn26/now/day` });
await wait(2200);
const bounded = await js(`(()=>{
  const b=[...document.querySelectorAll('.freeblock')];
  if(b.length!==1) return 'FAIL '+b.length+' blocks on Dec 22';
  const head=b[0].querySelector('.fbdur')?.textContent||'';
  if(!/19:30/.test(head)) return 'FAIL block does not stop at the concert: '+head;
  if(!/11 h 30 m/.test(head)) return 'FAIL duration reads '+head;
  return 'ok '+head;
})()`);
rows.push([String(bounded).startsWith('ok') ? 'PASS' : 'FAIL', 'Dec 22 · the block stops at the ticket', String(bounded).slice(0, 56)]);

/* RUN 3b — DEC 12 SAYS WHEN IT HAPPENS. "First entry ~07:30 · …" and "Sunset
   ~17:45 — …" carry their clocks after a word, with the file's own "~": the
   day read neither and drew fourteen free hours, "nothing timed yet today".
   Now the morning is a station, the block runs from it to the sunset, and
   the sunset closes the day's offers. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-12#/trip/cn26/now/day` });
await wait(2200);
const dec12 = await js(`(()=>{
  const cards=[...document.querySelectorAll('.timeline .tcard')].map(c=>c.innerText.replace(/\\s+/g,' ').trim());
  const first=cards.find(t=>/First entry/.test(t));
  if(!first) return 'FAIL no timed First entry: '+cards.join(' | ').slice(0,70);
  if(!/~07:30/.test(first)||!/Golden Whip Stream/.test(first)) return 'FAIL the morning reads '+first.slice(0,60);
  const sunset=cards.find(t=>/Sunset/.test(t));
  if(!sunset||!/~17:45/.test(sunset)) return 'FAIL Sunset ~17:45 is not on the line';
  const blocks=[...document.querySelectorAll('.freeblock')];
  if(blocks.length!==1) return 'FAIL '+blocks.length+' free blocks on Dec 12';
  const head=blocks[0].querySelector('.fbdur')?.textContent||'';
  if(!/08:00.17:45/.test(head)||!/9 h 45 m/.test(head)) return 'FAIL the block reads '+head;
  const after=blocks[0].querySelector('.fbafter')?.textContent||'';
  if(!/after First entry/.test(after)) return 'FAIL the block opens '+after;
  if(/nothing timed yet/i.test(document.body.innerText)) return 'FAIL it still says nothing is timed';
  const order=[...document.querySelectorAll('.timeline > .titem')].map(r=>r.classList.contains('freerow')?'free':/Sunset/.test(r.innerText)?'sunset':'morning').join(',');
  if(order!=='morning,free,sunset') return 'FAIL the line runs '+order;
  if(!/Stone-step ascent/.test(document.querySelector('.anylist')?.innerText||'')) return 'FAIL the 2h ascent became a clock';
  return 'ok ~07:30 · '+head.trim()+' · ~17:45';
})()`);
rows.push([String(dec12).startsWith('ok') ? 'PASS' : 'FAIL', 'Dec 12 · the timed morning + its free block', String(dec12).slice(0, 56)]);

/* AND NOT ONE WORD ON A RUNBOOK DAY. Dec 21 is the visa exit; the checklist IS
   the day, and an app offering a cave to visit while a border crossing is
   being counted down would be reading the room badly. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/now/day` });
await wait(2200);
const runbookQuiet = await js(`document.querySelectorAll('.freeblock').length===0 && document.querySelectorAll('.steps li').length>0 ? 'ok silent on the exit runbook' : 'FAIL a free block on the visa exit day'`);
rows.push([String(runbookQuiet).startsWith('ok') ? 'PASS' : 'FAIL', 'Runbook day · no free blocks at all', String(runbookQuiet).slice(0, 56)]);

/* THE LONG JUMP. The chevrons step one day; twenty-seven of them is not a long
   jump. The day's own title opens the trip as a list, marks the real today,
   names the place each date is spent in, and lands on any of them in one tap. */
const dateJump = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('.dayttl button, button.dayttl').click();
  await sleep(800);
  const list=document.querySelector('.jumplist');
  if(!list) return 'FAIL the date sheet did not open';
  const all=[...list.querySelectorAll('.jumprow')];
  if(all.length!==37) return 'FAIL '+all.length+' dates listed, expected 37';
  const showing=list.querySelector('.jumprow.on');
  if(!showing||!/exit day/i.test(showing.innerText)) return 'FAIL the shown day is not marked';
  const named=all.filter(r=>r.querySelector('.jplace'));
  if(named.length<30) return 'FAIL only '+named.length+' dates name their stop';
  const target=all.find(r=>/zhangjiajie/i.test(r.querySelector('.jplace')?.textContent||''));
  if(!target) return 'FAIL no Zhangjiajie day in the list';
  target.click();
  await sleep(1400);
  if(!/d=2026-12-1[1234]/.test(location.search)) return 'FAIL landed on '+location.search;
  return 'ok 37 dates, jumped to '+location.search.slice(1);
})()`, true);
rows.push([String(dateJump).startsWith('ok') ? 'PASS' : 'FAIL', 'Day title · the long jump to any date', String(dateJump).slice(0, 56)]);
/* THE LONG JUMP LEAVES NO LAYER BEHIND (Run 4b). Its sheet was closed by
   clearing the flag that showed it: the sheet went, its layer stayed — the
   next back press closed nothing anyone could see, and the ?d= it wrote went
   onto the sheet's entry. The day opened from Now, a date picked: the page
   is on the day's own entry, with the date, and ONE back press is Now. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/now` });
await wait(2200);
const jumpBack = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  location.hash='#/trip/cn26/now/day'; await sleep(1200);
  const title=document.querySelector('button.dayttl');
  if(!title) return 'FAIL no day title to jump from';
  title.click(); await sleep(800);
  const target=[...document.querySelectorAll('.jumplist .jumprow')].find(r=>/zhangjiajie/i.test(r.querySelector('.jplace')?.textContent||''));
  if(!target) return 'FAIL no Zhangjiajie day in the list';
  target.click(); await sleep(1400);
  if(document.querySelector('.sheet')) return 'FAIL the date sheet is still open';
  const d=new URLSearchParams(location.search).get('d')||'';
  if(!/^2026-12-1[1234]$/.test(d)) return 'FAIL the date was not written: '+location.search;
  if(history.state&&history.state.layer) return 'FAIL the page is left on the sheet’s entry (layer '+history.state.layer+')';
  history.back(); await sleep(1200);
  if(location.hash!=='#/trip/cn26/now') return 'FAIL one back press after the jump stayed on '+location.hash;
  return 'ok jumped to '+d+' on the day’s own entry; one back press → Now';
})()`, true, true);
rows.push([String(jumpBack).startsWith('ok') ? 'PASS' : 'FAIL', 'Day title · the long jump leaves no layer', String(jumpBack).replace(/^ok /, '').slice(0, 70)]);
/* ---------------------------------------------------------------------
   THE THREE SILENCES, 2026-08-12. Each of these is a state the app could
   reach and said NOTHING about, which is worse than saying it badly: a blank
   line and a missing stamp both read as "fine".
   --------------------------------------------------------------------- */

/* ① THE VISA CLOCK HAS NO EMPTY BRANCHES LEFT. It handled counting, entryDay
   and complete and rendered an EMPTY DIV for `before` and `overLimit` — so on
   departure day, and on the day the limit is passed, the one legally binding
   number on a 37-day trip printed nothing at all. Nov 21 is the live `before`
   case: the trip has started, the visa clock has not. The 13.5 px line became
   a card on 2026-08-12 (Gap A item 2); the STATE it has to speak in did not
   change, so the assertions did not either — only the selector. */
await S('Page.navigate', { url: `${BASE}?d=2026-11-21#/trip/cn26/now` });
await wait(2200);
const counterline = await js(`(()=>{
  const el=document.querySelector('.visacard');
  if(!el) return 'FAIL no visa card on departure day';
  const txt=el.innerText.replace(/\\s+/g,' ').trim();
  if(!txt) return 'FAIL the visa card is EMPTY on departure day — the silence is back';
  if(!/mainland visa/i.test(txt)) return 'FAIL the card does not name the counter: "'+txt+'"';
  if(!/22 nov/i.test(txt)) return 'FAIL it does not say when the count starts: "'+txt+'"';
  return 'ok '+txt.slice(0,44);
})()`);
rows.push([String(counterline).startsWith('ok') ? 'PASS' : 'FAIL', 'Visa card speaks before the clock starts', String(counterline).slice(3, 56)]);

/* AND ON VISA EXIT DAY IT IS LOUD AND IT IS A DOORWAY. Dec 21 is day 29 of 30
   with the hard deadline one day later: the card must say the day, say the exit
   date, wear the crit treatment (remaining ≤ 2), and open the Pocket's Visa
   screen — the same place the app bar's pill goes, which is why they share
   router.goCompliance. HORIZON RUN 2: the card is Now's VISA glance tile
   (f-now) — the day in its ring at card-title size, the exit date under it,
   the whole tile a link; the facts asserted are the same. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/now` });
await wait(2200);
const visacard = await js(`(async()=>{
  const el=document.querySelector('.visacard');
  if(!el) return 'FAIL no visa tile on VISA EXIT DAY';
  const txt=el.innerText.replace(/\\s+/g,' ').trim();
  const name=el.getAttribute('aria-label')||'';
  if(!/day 29 of 30/i.test(name)) return 'FAIL the day is not said: "'+name+'"';
  if(!/exit by 22 dec/i.test(txt)) return 'FAIL the tile does not say when to leave: "'+txt+'"';
  if(!el.classList.contains('crit')) return 'FAIL one day of buffer is not drawn as danger';
  const big=parseFloat(getComputedStyle(el.querySelector('.tv-day')).fontSize);
  if(!(big>=18)) return 'FAIL the day number is '+big+' px — still a caption';
  if(!/^29$/.test(el.querySelector('.tv-day').textContent.trim())) return 'FAIL the ring does not hold the day';
  if(el.tagName!=='A'||!el.getAttribute('href')) return 'FAIL the tile is a dead '+el.tagName;
  el.click(); await new Promise(r=>setTimeout(r,1200));
  if(!/\\/pocket\\/visa$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  if(!document.getElementById('compliance')) return 'FAIL the Visa screen has no compliance anchor to land on';
  return 'ok day 29 of 30, crit, opens Pocket › Visa';
})()`, true);
rows.push([String(visacard).startsWith('ok') ? 'PASS' : 'FAIL', 'Visa tile · loud on exit day, and a door', String(visacard).slice(3, 56)]);

/* ①b THE NEXT HARD COMMITMENT. It was a 14.5 px row two thirds down the
   screen, drawn quieter than the weather; Horizon makes it the ONE opal tile
   on Now (f-now's NEXT: the sun on its arc, the countdown, the route, the
   status). Dec 21 is the case the trip provides: MU 733 out of Kunming at
   13:50. The booking's reference is not on the tile — it is the first thing
   the Pocket shows ("Pocket · today's code first" asserts it in full, and
   copyable, on the pass); the tile is the door to it. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/now` });
await wait(2200);
const hero = await js(`(async()=>{
  const el=document.querySelector('.nexthero');
  if(!el) return 'FAIL no next-commitment tile on VISA EXIT DAY';
  if(!el.classList.contains('opal-edge')) return 'FAIL NEXT is not the one opal card';
  const txt=el.innerText.replace(/\\s+/g,' ').trim();
  if(!/MU ?733/i.test(txt)) return 'FAIL the flight number is not on it: "'+txt+'"';
  if(!/KMG/.test(txt)||!/HKG/.test(txt)) return 'FAIL the route is not on it: "'+txt+'"';
  if(!/13:50/.test(txt)) return 'FAIL the departure clock is not on it: "'+txt+'"';
  if(!/booked/i.test(txt)) return 'FAIL the tile does not say it is held';
  if(document.querySelectorAll('.opal-edge').length!==1) return 'FAIL more than one opal edge on Now';
  el.click(); await new Promise(r=>setTimeout(r,1000));
  if(!/\\/pocket\\/cn26-flight-mu733$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  /* The booking's OWN reference, matched by shape rather than reprinted here:
     a Trip.com order is a 16-digit serial — on the pass the tile opens, and
     copyable (a button), exactly as the old hero printed it. */
  const code=document.querySelector('#bk-cn26-flight-mu733 .codestrip .code');
  if(!code) return 'FAIL the pass the tile opens shows no reference';
  if(!/^\\d{16}$/.test(code.textContent.trim())) return 'FAIL the reference reads "'+code.textContent.trim()+'"';
  if(code.tagName!=='BUTTON') return 'FAIL the reference is not copyable';
  return 'ok MU 733 · KMG → HKG · opens the pass, ref copyable';
})()`, true);
rows.push([String(hero).startsWith('ok') ? 'PASS' : 'FAIL', 'Next commitment · the NEXT tile says it all', String(hero).slice(3, 56)]);

/* THE COUNTDOWN, AND THE SHAPE OF IT. Minute granularity, no seconds, the
   loudest number on the screen and tabular so the digits do not shuffle the
   line sideways every sixty seconds. A previewed day counts from ITS OWN 00:00
   — a day you are not living has no "now" inside it — so on Dec 21 the 13:50
   departure is exactly 13h 50m out, every time this runs, at any hour of the
   real day. (Horizon writes it the board's way: "13h 50m".) */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/now` });
await wait(2200);
const countdown = await js(`(()=>{
  const el=document.querySelector('.nexthero .tn-count');
  if(!el) return 'FAIL the next commitment carries no countdown';
  const txt=el.innerText.trim();
  if(!/^13h 50m$/.test(txt)) return 'FAIL the countdown reads "'+txt+'"';
  if(/\\d+ ?s\\b/.test(txt)) return 'FAIL it is counting seconds';
  const cs=getComputedStyle(el);
  if(parseFloat(cs.fontSize)<24) return 'FAIL the countdown is '+cs.fontSize+' — not the loudest number';
  if(!/tabular-nums/.test(cs.fontVariantNumeric)) return 'FAIL the digits are not tabular';
  return 'ok '+txt;
})()`);
rows.push([String(countdown).startsWith('ok') ? 'PASS' : 'FAIL', 'Countdown · minutes, never seconds', String(countdown).slice(3, 56)]);

/* THE RUNBOOK ROW IS THE TARGET NOW, not a 30 px square with dead text beside
   it — on the two days it matters most, departure and VISA EXIT DAY, in a
   queue, one-handed, with cold fingers. The box is a real checkbox inside a
   <label>, so the step text toggles it; this ticks by clicking the TEXT, which
   is the half that used to do nothing, and puts it back. The runbook lives on
   the day screen (Run 2). */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/now/day` });
await wait(2200);
const runbox = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const li=document.querySelector('.steps li');
  if(!li) return 'FAIL no runbook steps on departure day';
  const box=li.querySelector('.cbox');
  const txt=li.querySelector('.stx');
  if(!box||!txt) return 'FAIL the step has no box or no text';
  const r=box.getBoundingClientRect();
  const after=getComputedStyle(box,'::after');
  if(parseFloat(after.inset||'0')>-6) return 'FAIL the box has no 44 px hit ring: inset '+after.inset;
  if(r.height+14>48||r.height+14<40) return 'FAIL the drawn box plus its ring is '+(r.height+14)+' px';
  if(li.querySelector('label')===null) return 'FAIL the row is not a label — the step text is still dead';
  if(box.checked) return 'FAIL the step is already ticked';
  txt.click(); await sleep(900);
  const on=document.querySelector('.steps li .cbox')?.checked;
  if(!on) return 'FAIL tapping the step TEXT did not tick it';
  document.querySelector('.steps li .stx').click(); await sleep(900);
  if(document.querySelector('.steps li .cbox')?.checked) return 'FAIL it would not untick';
  return 'ok the text toggles the step';
})()`, true);
rows.push([String(runbox).startsWith('ok') ? 'PASS' : 'FAIL', 'Runbook · the row is the tap target', String(runbox).slice(3, 56)]);

/* ② A NIGHT WITH NO RESERVATION LOOKED EXACTLY LIKE A BOOKED ONE. The stamp
   was rendered only inside `{#if tonightBooking}`, and absence of a stamp is
   not a state the eye reads — it reads as fine. Nov 22 was the acceptance case
   the trip itself provided: the Yantai arrival night, deliberately unbooked.
   ON 2026-09-28 IT WAS BOOKED — the Muping night, cn26-stay-12 — so the real
   trip no longer has a bedless night to show. It now asserts the booked state
   here, and the no-bed state is proved further down on the trip as it stood
   before 28 Sep (the two bookings taken out of IndexedDB, then put back). */
await S('Page.navigate', { url: `${BASE}?d=2026-11-22#/trip/cn26/now/day` });
await wait(2200);
const nobed = await js(`(async()=>{
  const row=document.querySelector('.bedrow');
  if(!row) return 'FAIL no tonight row on the Yantai night';
  const stamp=row.querySelector('.stamp');
  if(!stamp) return 'FAIL the Muping night carries NO stamp at all';
  if(/no booking on file/i.test(stamp.textContent)) return 'FAIL the booked Muping night still shouts NO BOOKING ON FILE';
  if(!/booked/i.test(stamp.textContent)) return 'FAIL stamp reads "'+stamp.textContent.trim()+'"';
  if(stamp.classList.contains('crit')) return 'FAIL a booked bed is drawn as danger';
  const btn=row.querySelector('button.rowmain');
  if(!btn) return 'FAIL the Muping night opens nothing';
  btn.click(); await new Promise(r=>setTimeout(r,900));
  if(!/\\/pocket\\/cn26-stay-12$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  return 'ok '+stamp.textContent.trim()+', opens the Muping card';
})()`, true);
rows.push([String(nobed).startsWith('ok') ? 'PASS' : 'FAIL', 'Tonight on Nov 22 is the booked Muping night', String(nobed).slice(3, 56)]);

/* …AND THE TWELVE NIGHTS BEHIND THAT ONE STOPPED SHOUTING (owner decision
   2026-08-12). Nov 23 – Dec 4 are the Kunyu academy fortnight: a day plan, a
   bed label, twelve real nights — and, until the stay was written down, no
   booking, so every one of them wore the same crit NO BOOKING ON FILE that
   Nov 22 wears for a genuine reason. The slot has been held since the deposit
   was acknowledged on 11 Aug, so the record was missing, not the reservation.
   Nov 27 is checked because it is deep inside the fortnight, drawn by the
   training-day template rather than by a written day — and A BEDLESS NIGHT
   MUST STAY CRIT (Nov 22 was that night until 28 Sep; it is proved on the
   pre-28 Sep trip below), which is what proves the app can still tell a held
   bed from an unbooked night rather than having simply gone quiet. */
await S('Page.navigate', { url: `${BASE}?d=2026-11-27#/trip/cn26/now/day` });
await wait(2200);
const academy = await js(`(async()=>{
  const row=document.querySelector('.bedrow');
  if(!row) return 'FAIL no tonight row inside the academy fortnight';
  const stamp=row.querySelector('.stamp');
  if(!stamp) return 'FAIL the academy night carries NO stamp at all';
  if(/no booking on file/i.test(stamp.textContent)) return 'FAIL a held bed still shouts NO BOOKING ON FILE';
  if(!/booked/i.test(stamp.textContent)) return 'FAIL stamp reads "'+stamp.textContent.trim()+'"';
  if(stamp.classList.contains('crit')) return 'FAIL a held bed is still drawn as danger';
  if(row.classList.contains('crit')) return 'FAIL the row itself still shouts';
  const bed=row.querySelector('.rx b');
  if(!/kunyu/i.test(bed?.innerText||'')) return 'FAIL the bed row reads "'+(bed?.innerText||'').trim()+'"';
  const btn=row.querySelector('button.rowmain');
  if(!btn) return 'FAIL the academy night opens nothing';
  btn.click(); await new Promise(r=>setTimeout(r,900));
  if(!/\\/pocket\\/cn26-stay-11$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  return 'ok '+stamp.textContent.trim()+', opens the academy card';
})()`, true);
rows.push([String(academy).startsWith('ok') ? 'PASS' : 'FAIL', 'An academy night reads as booked', String(academy).slice(3, 56)]);

/* …AND A NIGHT SPENT MOVING IS NOT A MISSING BED (owner decision 2026-08-12).
   Nov 21 is EY 888, Abu Dhabi 21:20 to Beijing 08:45 the next morning: there is
   no reservation to hold, so the crit NO BOOKING ON FILE was the app crying
   wolf on a night nobody could act on. It takes a neutral stamp and opens the
   leg the night is spent aboard. The check above is the other half of the same
   rule — a bedless night must stay loud (proved on the pre-28 Sep trip below,
   since Nov 22 was booked on 2026-09-28) — and the pair is what proves the two
   states are still told apart. */
await S('Page.navigate', { url: `${BASE}?d=2026-11-21#/trip/cn26/now/day` });
await wait(2200);
const airbed = await js(`(async()=>{
  const row=document.querySelector('.bedrow');
  if(!row) return 'FAIL no tonight row on the night in the air';
  const stamp=row.querySelector('.stamp');
  if(!stamp) return 'FAIL the airborne night carries NO stamp at all';
  if(!/night in transit/i.test(stamp.textContent)) return 'FAIL stamp reads "'+stamp.textContent.trim()+'"';
  if(stamp.classList.contains('crit')) return 'FAIL a night in the air is still drawn as danger';
  if(row.classList.contains('crit')) return 'FAIL the row itself still shouts';
  const btn=row.querySelector('button.rowmain');
  if(!btn) return 'FAIL the transit night opens nothing';
  btn.click(); await new Promise(r=>setTimeout(r,900));
  if(!/\\/pocket\\/cn26-flight-ey888$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  return 'ok '+stamp.textContent.trim()+', opens EY 888';
})()`, true);
rows.push([String(airbed).startsWith('ok') ? 'PASS' : 'FAIL', 'A night in the air reads as transit', String(airbed).slice(3, 56)]);

/* And the same row on a night that IS booked still wears its real stamp and
   opens the card — the negative would pass vacuously otherwise. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-06#/trip/cn26/now/day` });
await wait(2200);
const bedlink = await js(`(async()=>{
  const row=document.querySelector('.bedrow');
  if(!row) return 'FAIL no tonight row on Dec 6';
  const stamp=row.querySelector('.stamp');
  if(!/booked/i.test(stamp?.textContent||'')) return 'FAIL Dec 6 stamp: "'+(stamp?.textContent||'').trim()+'"';
  const btn=row.querySelector('button.rowmain');
  if(!btn) return 'FAIL the booked bed row is still a dead div';
  btn.click(); await new Promise(r=>setTimeout(r,900));
  if(!/\\/pocket\\/cn26-stay-00$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  return 'ok opens its own card';
})()`, true);
rows.push([String(bedlink).startsWith('ok') ? 'PASS' : 'FAIL', 'Tonight opens the bed it names', String(bedlink).slice(3, 56)]);

/* THE PHOTO CAPTION CARRIES THE DAY AND NOTHING ELSE. It used to read
   "DAY 29 OF 37 · TONIGHT: DALI YANYUAN MOUNTAIN RETREAT (BOOKED, ¥324)" —
   12.5 px of uppercase wrapping into the scrim at the bottom edge of the
   picture. Where you sleep is a row of its own, further down, at a size a bed
   name can be read at and with the stamp that says whether it is held. Dec 19
   is the longest bed label on the trip, which is why it is the day checked. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-19#/trip/cn26/now/day` });
await wait(2200);
const caption = await js(`(()=>{
  const tag=document.querySelector('.daytag');
  if(!tag) return 'FAIL no day caption on the photo';
  const txt=tag.innerText.replace(/\\s+/g,' ').trim();
  if(!/day \\d+ of 37/i.test(txt)) return 'FAIL the caption lost the day number: "'+txt+'"';
  if(/tonight/i.test(txt)) return 'FAIL tonight is still crammed into the photo caption';
  const h=tag.getBoundingClientRect().height;
  if(h>26) return 'FAIL the caption is '+Math.round(h)+' px tall — it wrapped';
  const bed=document.querySelector('.bedrow .rx b');
  if(!bed) return 'FAIL the tonight row does not name the bed';
  if(!/yanyuan/i.test(bed.innerText)) return 'FAIL the bed row reads "'+bed.innerText.trim()+'"';
  const size=parseFloat(getComputedStyle(bed).fontSize);
  if(size<15) return 'FAIL the bed name is '+size+' px, below the floor';
  return 'ok '+txt+' · bed at '+size+' px below';
})()`);
rows.push([String(caption).startsWith('ok') ? 'PASS' : 'FAIL', 'Day caption · the day, and only the day', String(caption).slice(3, 56)]);

/* ③ DAY STEPPING. "What does tomorrow look like?" cost six taps through both
   top corners of a 6.8" phone. Two 44 px chevrons beside the day title now
   step the previewed date; Settings keeps the long jump. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-06#/trip/cn26/now/day` });
await wait(2200);
const stepping = await js(`(async()=>{
  const steps=[...document.querySelectorAll('.daystep')];
  if(steps.length!==2) return 'FAIL '+steps.length+' day chevrons, expected 2';
  const small=steps.filter(b=>{const r=b.getBoundingClientRect(); return r.width<44||r.height<44;});
  if(small.length) return 'FAIL a chevron is under 44 px';
  const before=document.querySelector('.dayttl')?.innerText.trim()||'';
  steps[1].click(); await new Promise(r=>setTimeout(r,1200));
  if(!/d=2026-12-07/.test(location.search)) return 'FAIL › did not step the day: '+location.search;
  const after=document.querySelector('.dayttl')?.innerText.trim()||'';
  if(!after||after===before) return 'FAIL the day did not change: "'+before+'"';
  [...document.querySelectorAll('.daystep')][0].click(); await new Promise(r=>setTimeout(r,1200));
  if(!/d=2026-12-06/.test(location.search)) return 'FAIL ‹ did not step back: '+location.search;
  return 'ok '+before.replace(/\\s+/g,' ')+' → '+after.replace(/\\s+/g,' ');
})()`, true);
rows.push([String(stepping).startsWith('ok') ? 'PASS' : 'FAIL', 'Day stepping · ‹ › beside the title', String(stepping).slice(3, 56)]);

/* HORIZON'S PLACES (Run 1). Plans became Journey — the route drawn above every
   stop, so the old "the route map lives in Info" doorway has nowhere left to
   point; the Wallet became the Pocket, whose Travel list carries the Etihad
   order under its own PNR; Lists became Now › To do; Info split between the
   Journey (route, coverage, statistics) and the Pocket (everything else).
   HORIZON RUN 3 (f-journey): the route is Replay — the trip's map for any
   day, above a scrubber — and every stop is a row of the route check. */
await check('Journey · the replay above every stop', `${BASE}?d=2026-12-15#/trip/cn26/journey`,
  ['Replay the trip', 'Route check', 'Kunyu Academy', 'Tiger Leaping Gorge']);
await check('Pocket · Travel, the Etihad order', `${BASE}?d=2026-12-15#/trip/cn26/pocket/travel`, ['8CR7MR', 'Etihad', 'BOOKED']);
/* To do (f-todo) folds the to-dos, the phone alarms and the bookings still to
   buy into days; what is past folds into Earlier. The Forbidden City ticket
   window (Nov 29) is Earlier on Dec 15 — opened here the way a thumb opens it —
   and the alarms still say where they have to go: the phone's calendar. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/now/todo` });
await wait(2200);
const todoPage = await js(`(async()=>{
  const t0=document.body.innerText;
  if(!/To do/.test(t0)) return 'FAIL To do has no title';
  if(!/phone calendar/i.test(t0)) return 'FAIL the alarms no longer say where they must go';
  if(!/Add \\d+ to the calendar/i.test(t0)) return 'FAIL no .ics export for the alarms';
  const earlier=document.querySelector('details.earlier');
  if(!earlier) return 'FAIL nothing past is kept — no Earlier group';
  earlier.querySelector('summary').click(); await new Promise(r=>setTimeout(r,500));
  if(!/Forbidden City/.test(document.body.innerText)) return 'FAIL the Forbidden City task is gone';
  return 'ok To do · phone calendar · Forbidden City in Earlier';
})()`, true);
rows.push([String(todoPage).startsWith('ok') ? 'PASS' : 'FAIL', 'To do · deadlines + alarms', String(todoPage).slice(3, 56)]);
/* Run 3b: the app bar's pill says the counter's word ("VISA 23/30", as the
   boards draw it) — "Mainland visa" is its accessible name, asserted with
   the Pocket's names further down. */
await check('Pocket · visa clock + driver cards', `${BASE}?d=2026-12-15#/trip/cn26/pocket`, ['VISA', '23/30', '北京大兴国际机场', 'Emergency']);
/* Info's hub split in two: route and statistics on the Journey, the vault in
   the Pocket. Both halves are asserted, with the same facts as before. */
await check('Journey · route, coverage and statistics', `${BASE}?d=2026-12-15#/trip/cn26/journey`,
  ['Route check', '10 stops', 'TRIP STATISTICS', 'Distance, stop to stop']);
await check('Pocket · the document vault', `${BASE}?d=2026-12-15#/trip/cn26/pocket/docs`,
  ['Documents', 'Flight manifest']);

/* EVERY LINK EVER WRITTEN STILL RESOLVES (logic/routes.ts). Five tabs and three
   retired Info routes live in backups, in the owner's memory and in this file's
   own history; each must land on the place that now holds its content, and the
   address bar must be rewritten to the new name so a back-press never meets
   the old one. Walked through the real app, one old link at a time. */
const ALIASES = [
  ['#/trip/cn26/today', '#/trip/cn26/now'],
  ['#/trip/cn26/itinerary', '#/trip/cn26/journey'],
  ['#/trip/cn26/itinerary/cn26-stop-beijing', '#/trip/cn26/journey/cn26-stop-beijing'],
  ['#/trip/cn26/wallet', '#/trip/cn26/pocket'],
  ['#/trip/cn26/wallet/cn26-flight-ey888', '#/trip/cn26/pocket/cn26-flight-ey888'],
  ['#/trip/cn26/wallet/spend', '#/trip/cn26/pocket/money'],
  ['#/trip/cn26/tasks', '#/trip/cn26/now/todo'],
  ['#/trip/cn26/tasks/packing', '#/trip/cn26/now/todo/packing'],
  ['#/trip/cn26/info', '#/trip/cn26/pocket'],
  ['#/trip/cn26/stats', '#/trip/cn26/journey'],
  ['#/trip/cn26/docs', '#/trip/cn26/pocket/docs'],
];
const aliasBad = [];
for (const [from, to] of ALIASES) {
  await S('Page.navigate', { url: `${BASE}?d=2026-12-15${from}` });
  await wait(1600);
  const got = await js(`location.hash`);
  if (got !== to) aliasBad.push(`${from} → ${got}`);
}
rows.push([aliasBad.length === 0 ? 'PASS' : 'FAIL', 'Old links · every one lands, renamed',
  aliasBad.length === 0 ? `${ALIASES.length} old links, all canonical` : aliasBad.slice(0, 2).join(' ; ').slice(0, 60)]);
/* The two that carry a section to land on: stats and the map scroll to it. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/stats` });
await wait(2200);
const statsLand = await js(`(()=>{
  const sec=document.getElementById('stats');
  if(!sec) return 'FAIL the Journey has no statistics section';
  const top=sec.getBoundingClientRect().top;
  if(top>window.innerHeight||top<-40) return 'FAIL the old stats link did not land on the statistics: '+Math.round(top)+' px';
  return /trip statistics/i.test(sec.innerText) ? 'ok landed on the statistics' : 'FAIL the section is not the statistics';
})()`);
rows.push([String(statsLand).startsWith('ok') ? 'PASS' : 'FAIL', 'Old #/stats link lands on the statistics', String(statsLand).slice(3, 56)]);
await check('Shelf', `${BASE}?d=2026-12-15#/trips`, ['China 2026', 'ACTIVE']);
await check('Backup screen', `${BASE}#/backup`, ['Save a copy', 'Storage', 'Restore']);

/* THE NAV (Horizon): four places since Map 5c — Now, Journey, Map, Pocket —
   each an icon and a word, and the round Find beside them; every one arriving
   where it says. The labels live in strings.ts — this walk keeps them honest. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/now` });
await wait(2200);
const tabwalk = await js(`(async()=>{
  const items=[...document.querySelectorAll('.navbar .navitem')];
  const labels=items.map(a=>a.querySelector('.lb')?.textContent.trim()||'');
  const want=['Now','Journey','Map','Pocket'];
  if(labels.join('|')!==want.join('|')) return 'FAIL labels '+labels.join('|');
  if(items.some(a=>!a.querySelector('svg'))) return 'FAIL a place has no icon';
  const find=document.querySelector('.findbtn');
  if(!find) return 'FAIL there is no Find button';
  if(!/find/i.test(find.getAttribute('aria-label')||'')) return 'FAIL the Find button has no name';
  const small=[...items,find].filter(e=>{const r=e.getBoundingClientRect(); return r.width<44||r.height<44;});
  if(small.length) return 'FAIL '+small.length+' nav target(s) under 44 px';
  const seen=[];
  for(const el of [...items,find]){
    el.click(); await new Promise(r=>setTimeout(r,900));
    seen.push(location.hash.split('/').pop());
  }
  const expect=['now','journey','map','pocket','find'];
  if(seen.join('|')!==expect.join('|')) return 'FAIL routes '+seen.join('|');
  const cur=document.querySelector('.findbtn[aria-current="page"]');
  if(!cur) return 'FAIL the place you are in is not marked current';
  return 'ok '+labels.join(' · ')+' + Find';
})()`, true);
rows.push([String(tabwalk).startsWith('ok') ? 'PASS' : 'FAIL', 'Nav · four places and Find', String(tabwalk).slice(3, 56)]);

/* THE UPDATE BANNER USED TO EAT THREE OF THOSE FIVE TABS — and not only when
   it was showing. `translateY(120%)` is 120 % of the banner's OWN height, ~77
   px, nowhere near the ~160 px needed to leave the screen, so the HIDDEN
   banner parked itself on the tab pill at z-index 90 and swallowed taps for a
   state it was not even in. And `left: 50%` with no width made its box 50vw,
   which wrapped one line of text into two and doubled the height it did not
   clear. Both are asserted here: invisible when hidden, clear of the pill when
   shown, one line either way. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/now` });
await wait(2200);
const banner = await js(`(async()=>{
  const b=document.getElementById('sw-update');
  if(!b) return 'FAIL no update banner in the shell';
  const pill=document.querySelector('.navbar');
  if(!pill) return 'FAIL no nav bar to measure against';
  /* hidden means HIDDEN — it may not take a tap it was never offered */
  if(b.classList.contains('show')) return 'FAIL the banner is showing with no update waiting';
  const cs=getComputedStyle(b);
  if(cs.visibility!=='hidden') return 'FAIL a banner nobody asked for is visible';
  if(cs.pointerEvents!=='none') return 'FAIL a hidden banner still takes taps';
  /* and when it IS shown it clears the pill, on one line */
  b.classList.add('show');
  await new Promise(r=>setTimeout(r,500));
  const rb=b.getBoundingClientRect(), rp=pill.getBoundingClientRect();
  if(rb.bottom>rp.top) return 'FAIL the banner overlaps the tab bar: '+Math.round(rb.bottom)+' > '+Math.round(rp.top);
  if(rb.right>window.innerWidth+1||rb.left<-1) return 'FAIL the banner runs off the screen';
  if(rb.height>56) return 'FAIL the banner wrapped to '+Math.round(rb.height)+' px — it must stay one line';
  /* dismissable, and it stays dismissed */
  const x=document.getElementById('sw-dismiss');
  if(!x) return 'FAIL there is no way to dismiss it';
  if(x.getBoundingClientRect().height<44) return 'FAIL the dismiss ✕ is under 44 px';
  b.classList.remove('show');
  return 'ok clears the pill by '+Math.round(rp.top-rb.bottom)+' px, '+Math.round(rb.height)+' px tall';
})()`, true);
rows.push([String(banner).startsWith('ok') ? 'PASS' : 'FAIL', 'Update banner never covers the tabs', String(banner).slice(3, 56)]);

/* THE DATE-PREVIEW WARNING moved out of the content it was faking. It used to
   be a pill fixed at nav-h + 58 px — mid-card — covering the CHECK-IN row of
   the very stay card whose dates it was warning about. Every check in this
   walk runs under ?d=, so the strip is on screen for all of them. */
const previewStrip = await js(`(()=>{
  const strip=document.querySelector('.previewstrip');
  if(!strip) return 'FAIL nothing says the date on screen is fake';
  const r=strip.getBoundingClientRect();
  if(r.top>2) return 'FAIL the strip is not at the head of the page: top '+Math.round(r.top);
  if(r.width<window.innerWidth-2) return 'FAIL the strip is not full width';
  /* it takes real layout space, so it cannot be ON anything */
  const bar=document.querySelector('.appbar')?.getBoundingClientRect();
  if(!bar) return 'FAIL no app bar';
  if(bar.top<r.bottom-1) return 'FAIL the strip is printing over the app bar';
  /* and the app-bar pill wears the warning for as long as the preview lasts */
  const pill=document.querySelector('.statuspill');
  if(!pill||!pill.classList.contains('preview')) return 'FAIL the status pill does not say the date is previewed';
  if(pill.tagName!=='BUTTON') return 'FAIL the status pill is still not tappable';
  return 'ok '+strip.innerText.trim().slice(0,40);
})()`);
rows.push([String(previewStrip).startsWith('ok') ? 'PASS' : 'FAIL', 'Date preview · a strip, never over a card', String(previewStrip).slice(3, 56)]);

/* the packing ring is real arithmetic, not a decorative arc. HORIZON RUN 2:
   the ring is the sun arc — Horizon's progress indicator — on To do › Packing;
   the percentage and the count must still agree, and there is still a way to
   add to the list from the list.
     30 → 34 on 2026-09-28: the school envelope (US$1,000), the two passport
     photos the academy asked for, the reserve envelope (US$400) and the Hong
     Kong cash (~US$50 → HKD) — the cash plan's envelopes and the school's
     answers, checked line by line in the next row. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/now/todo/packing` });
await wait(2200);
const ring = await js(`(async()=>{
  const pct=document.querySelector('.sunarc .pct')?.textContent||'';
  const count=document.querySelector('.sunarc .pcount')?.textContent||'';
  const m=/^([0-9]+)[/]([0-9]+)$/.exec(count);
  if(!m) return 'FAIL count '+count;
  /* 34 → 33 on 2026-10-17: the ski goggles + gloves item went with skiing */
  if(Number(m[2])!==33) return 'FAIL '+m[2]+' packing items, China seeds 33';
  const want=Math.round(Number(m[1])/Number(m[2])*100)+'%';
  if(pct!==want) return 'FAIL '+pct+' vs '+want;
  const add=[...document.querySelectorAll('button')].find(b=>/Add an item/.test(b.textContent));
  return add ? 'ok '+pct+' of '+count : 'FAIL no add button';
})()`, true);
rows.push([String(ring).startsWith('ok') ? 'PASS' : 'FAIL', 'Packing ring · counts what is packed', String(ring).slice(3, 56)]);

/* THE CASH PLAN AND THE GORGE BAG, AS PACKED (2026-09-27/28). The owner will
   not withdraw cash anywhere in China: US$1,700 more (ordered Oct 17 since the
   owner's 15 Oct plan — it was "bought on Oct 12" until then — and collected
   at the Ben Gurion T3 exchange counter on Nov 21, 12:00) brings the
   dollars to $2,000, packed as three envelopes — the school (US$1,000, $940 of
   it to the academy), the exchange (US$600, changed to ≈¥4,200 at the Daxing
   arrivals counter on Nov 22) and a reserve (US$400) — and the old "~¥1,000
   cash backup" line is gone. The inn has no contact for Tina's either, so the
   big bag rides the public bus to Qiaotou and waits at Jane's while you hike
   with the day pack. The Packing list is where both are packed. */
const cashPlan = await js(`(()=>{
  const lines=[...document.querySelectorAll('.litem .llabel')].map(e=>e.textContent.replace(/\\s+/g,' ').trim());
  const find=(re)=>lines.find(t=>re.test(t));
  const school=find(/^School envelope — US\\$1,000/), exch=find(/^Exchange envelope — US\\$600/), reserve=find(/^Reserve envelope — US\\$400/);
  if(!school||!exch||!reserve) return 'FAIL an envelope is missing: school '+!!school+', exchange '+!!exch+', reserve '+!!reserve;
  if(!/\\$940 to the academy/.test(school)) return 'FAIL the school envelope does not say what the academy is paid';
  if(!/≈¥4,200/.test(exch)||!/Daxing/.test(exch)) return 'FAIL the exchange envelope does not say where it becomes yuan';
  if(!/no ATM withdrawal anywhere/i.test(exch)) return 'FAIL the packing list does not rule out the ATM';
  if(find(/cash backup/i)) return 'FAIL the old ~¥1,000 cash backup survived the cash plan';
  const bag=find(/^Gorge:/);
  if(!bag||!/everything else stays at Jane.s/.test(bag)) return 'FAIL the gorge bag does not wait at Jane’s: '+String(bag).slice(0,40);
  if(/transfer/i.test(bag)) return 'FAIL the gorge line still transfers the bag';
  return 'ok US$1,000 + 600 + 400 = $2,000, no ATM · the bag at Jane’s';
})()`);
rows.push([String(cashPlan).startsWith('ok') ? 'PASS' : 'FAIL', 'Packing · $2,000 in envelopes, the bag at Jane’s', String(cashPlan).slice(3, 60)]);

/* THE TO-DO LIST MUST COUNT TASKS — the seed ships 24 of them. Horizon folds
   them into days (and Earlier), so the count is taken the way the list shows
   them: every to-do row, Earlier opened, and the ticked ones must be the ones
   the database says are done. Counting the rows is what stops the list
   quietly reporting the rucksack's 30.
     25 → 24 on 2026-08-06: the insurance task closed once the policy was
     bought. 24 → 25 on 2026-08-11: the kunyu-arrival task. 25 → 26 on
     2026-08-12: the yantai-bed task. 27 → 28 on 2026-09-27, the review run:
     four closed (hotel-beijing, hotels-mainland, hkjc, hk-xmas) and five
     opened (late-arrivals, esim, tianmen-recheck, psb, ngong-ping). 28 → 27
     later the same evening: lijiang-bagtransfer closed (Yue Tu has no contact
     for Tina's Inn either; the owner arranges the gorge bag himself, Option B —
     a packing note, not a task). 27 → 23 on 2026-09-28: the academy answered
     and four closed — yantai-flights (CA1560 booked), yantai-bed (the Muping
     night booked), psb (the school registers you) and late-arrivals (both
     hotels told 27 Sep). 23 → 24 later the same day: cash-plan — the owner's
     decision against any ATM withdrawal in China, due 2026-10-12.
     24 → 25 on 2026-09-29: muping-late-arrival opened (kunyu-email is
     reworded, not closed). 25 → 24 later the same day: muping-late-arrival
     CLOSED — Trip.com confirmed at 11:09 that the request reached the hotel. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/now/todo` });
await wait(2200);
const todoring = await js(`(async()=>{
  const e=document.querySelector('details.earlier');
  if(e&&!e.open){ e.querySelector('summary').click(); await new Promise(r=>setTimeout(r,500)); }
  const rows=document.querySelectorAll('.trow[data-kind="task"]').length;
  const ticked=document.querySelectorAll('.trow[data-kind="task"].done').length;
  /* 24 → 30 on 2026-10-17: − the ski lesson, + the seven Shanghai to-dos ·
     30 → 28 the same evening: the bed booked (Hi Cozy), Element cancelled ·
     28 → 27: MU394 booked · 27 → 26: the Dec 9 train reserved ·
     26 → 28 in the 17 Oct follow-up: + reserve-permit, + hicozy-arrival */
  if(rows!==28) return 'FAIL '+rows+' tasks, China seeds 28';
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const all=await new Promise(r=>{const q=db.transaction('tasks').objectStore('tasks').getAll();q.onsuccess=()=>r(q.result)});
  db.close();
  const done=all.filter(t=>t.tripId==='cn26'&&t.done).length;
  if(ticked!==done) return 'FAIL '+ticked+' rows ticked, '+done+' done in the database';
  const up=Number((document.querySelector('.td-count .num')||{}).textContent);
  if(!(up>0)) return 'FAIL the coming-up count is missing';
  return 'ok '+rows+' tasks, '+ticked+' done, '+up+' coming up';
})()`, true);
rows.push([String(todoring).startsWith('ok') ? 'PASS' : 'FAIL', 'To do · counts tasks, not packing', String(todoring).slice(3, 56)]);

/* A ticked checklist item has to survive the write, or the arc above it is a
   decoration on a lie: the items come off liveQuery as $state proxies and
   IndexedDB refuses to clone one, so the tick used to throw into a floating
   promise and the box un-ticked itself on the next render. Tick, watch the
   arc move, untick, and leave the seed as we found it. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/now/todo/lists` });
await wait(2200);
const checkring = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const read=()=>document.querySelector('.sunarc .pcount')?.textContent||'';
  const before=read();
  const m=/^([0-9]+)[/]([0-9]+)$/.exec(before);
  if(!m) return 'FAIL count '+before;
  if(Number(m[2])!==11) return 'FAIL '+m[2]+' items, China seeds 11';
  const box=document.querySelector('.ltick');
  if(!box) return 'FAIL no checkbox';
  box.click(); await sleep(1200);
  const ticked=read();
  if(Number(/^([0-9]+)/.exec(ticked)[1])!==Number(m[1])+1) return 'FAIL tick did not stick: '+before+' → '+ticked;
  const pct=document.querySelector('.sunarc .pct').textContent;
  const want=Math.round((Number(m[1])+1)/Number(m[2])*100)+'%';
  if(pct!==want) return 'FAIL '+pct+' vs '+want;
  document.querySelector('.ltick').click(); await sleep(1200);
  return read()===before ? 'ok '+before+' → '+ticked+' ('+want+') → '+read() : 'FAIL untick '+read();
})()`, true);
rows.push([String(checkring).startsWith('ok') ? 'PASS' : 'FAIL', 'Checklist tick survives the write', String(checkring).slice(3, 56)]);

/* the counter-facing actions — the driver cards live in the Pocket now */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/driver` });
await wait(2200);
const driver = await js(`(async()=>{
  const btn=[...document.querySelectorAll('.zhlist .txt')].find(b=>/Daxing/.test(b.textContent));
  if(!btn) return 'FAIL no Daxing card in the driver list';
  btn.click(); await new Promise(r=>setTimeout(r,700));
  const d=document.querySelector('.driver');
  return d ? d.innerText.replace(/\\n/g,' | ') : 'FAIL';
})()`, true);
rows.push([String(driver).includes('请带我去这里') ? 'PASS' : 'FAIL', 'Driver card full-screen', String(driver).slice(0, 60)]);
/* A full-screen card is a LAYER: Android back closes it and leaves you where
   you were, never one screen further back. */
const driverBack = await js(`(async()=>{
  if(!document.querySelector('.driver')) return 'FAIL the driver card is not open';
  const before=location.hash;
  history.back(); await new Promise(r=>setTimeout(r,800));
  if(document.querySelector('.driver')) return 'FAIL back did not close the driver card';
  if(location.hash!==before) return 'FAIL back left the screen: '+location.hash;
  return 'ok back closes the card, the list stays';
})()`, true);
rows.push([String(driverBack).startsWith('ok') ? 'PASS' : 'FAIL', 'Driver card · Android back closes it', String(driverBack).slice(3, 56)]);

const pdf = await js(`(async()=>{
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const all=await new Promise(r=>{const q=db.transaction('documentBlobs').objectStore('documentBlobs').getAll();q.onsuccess=()=>r(q.result)});
  db.close();
  const b=all[0]; if(!b) return 'FAIL';
  const head=new Uint8Array(await b.blob.slice(0,5).arrayBuffer());
  return String.fromCharCode(...head);
})()`, true);
rows.push([pdf === '%PDF-' ? 'PASS' : 'FAIL', 'Flight PDF readable offline', pdf]);

/* place photos: bytes really in IndexedDB (RIFF....WEBP), offline */
const webps = await js(`(async()=>{
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const all=await new Promise(r=>{const q=db.transaction('documentBlobs').objectStore('documentBlobs').getAll();q.onsuccess=()=>r(q.result)});
  db.close();
  let n=0;
  for (const rec of all) {
    const h=new Uint8Array(await rec.blob.slice(0,12).arrayBuffer());
    const s=String.fromCharCode(...h);
    if (s.startsWith('RIFF') && s.slice(8,12)==='WEBP') n++;
  }
  return n;
})()`, true);
/* NINE since 2026-10-17: the Chongli photo left with the stop, and Shanghai has none yet */
rows.push([webps === 9 ? 'PASS' : 'FAIL', 'Nine place photos stored offline', `webp blobs: ${webps}`]);

/* THE PHOTOS AND THE STOP PILLS LIVE ON THE GUIDES since Horizon Run 3. The
   Journey became Replay and the route check (f-journey), so the ten photo
   bands it used to draw are the ten guides' hero photos now, and the "Open in
   Maps" pill each stop band carried is the guide's own, in its Getting there
   chapter (f-guide). Both are walked guide by guide, the way a thumb reaches
   them: Journey › the city › Read the guide. (innerText cannot see a broken
   image, so the hero is asserted loaded, from its blob, offline.) */
/* Shanghai replaced Chongli on 2026-10-17 (skiing dropped). It has no curated
   photo and no verified map target yet, so its guide draws no hero and no pill
   — the honest empty, asserted below rather than skipped. */
const STOP_IDS = ['kunyu', 'beijing', 'shanghai', 'zhangjiajie', 'chongqing', 'lijiang', 'gorge', 'dali', 'kunming', 'hongkong']
  .map((s) => `cn26-stop-${s}`);
const guideWalk = [];
for (const sid of STOP_IDS) {
  await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey/${sid}/guide` });
  await wait(1500);
  guideWalk.push(await js(`(async()=>{
    let hero=false;
    for(let i=0;i<24&&!hero;i++){
      const im=document.querySelector('.gd-hero img');
      hero=!!(im&&im.src.startsWith('blob:')&&im.complete&&im.naturalWidth>0);
      if(!hero) await new Promise(r=>setTimeout(r,150));
    }
    const groups=[...document.querySelectorAll('#g-there .maps.pill')];
    return { sid:'${sid}', hash:location.hash, hero, groups:groups.length,
      buttons:groups.map(g=>g.querySelectorAll('button').length),
      labels:groups.map(g=>(g.querySelector('button')?.textContent||'').trim()),
      geo:groups.map(g=>g.querySelector('button')?.getAttribute('data-geo')||'') };
  })()`, true));
}
const heroes = guideWalk.filter((g) => g && g.hero).length;
const heroless = guideWalk.filter((g) => !g?.hero).map((g) => String(g?.sid).replace('cn26-stop-', ''));
rows.push([heroes === 9 && heroless.join() === 'shanghai' ? 'PASS' : 'FAIL', 'Photo heroes render offline (9 guides; Shanghai has none)',
  heroes === 9 ? `loaded hero photos: 9; none on ${heroless.join(', ')}`
    : `loaded ${heroes}; none on ${heroless.join(', ')}`.slice(0, 60)]);

/* THE STOP PILL, 2026-07-28. Until then the one screen that listed every city
   you are going to was the only place-bearing surface in the app with no way
   to open one. Ten pills, one per real stop — and the eleventh "stop",
   cn26-stop-flights ("International flights"), is a phase of the trip, not a
   place: it has no guide and no row (asserted on the route check below). */
const planmaps = (() => {
  if (guideWalk.some((g) => !g || typeof g !== 'object')) return 'FAIL a guide did not answer';
  const lost = guideWalk.filter((g) => !g.hash.endsWith(`${g.sid}/guide`));
  if (lost.length) return `FAIL ${lost[0].sid} landed on ${lost[0].hash}`;
  /* Shanghai (since 2026-10-17) has no verified map target, so no pill at all. */
  const off = guideWalk.filter((g) => g.groups !== (g.sid === 'cn26-stop-shanghai' ? 0 : 1));
  if (off.length) return `FAIL ${off.map((g) => `${g.sid.replace('cn26-stop-', '')}:${g.groups}`).join(' ')} pill group(s), expected 1 each and none on Shanghai`;
  const pilled = guideWalk.filter((g) => g.groups === 1);
  /* One button per group, exactly as everywhere else — never the old pair. */
  if (pilled.some((g) => g.buttons[0] !== 1)) return 'FAIL a stop pill holds more than one button';
  /* It is the gold "Open in Maps" pill, not a second dialect for the same action. */
  if (!pilled.every((g) => /Open in Maps/i.test(g.labels[0]))) return 'FAIL a stop pill is not the guide pill';
  /* And it opens the STOP's own verified search — Beijing by name and city. */
  const geos = pilled.map((g) => g.geo[0]);
  if (!geos.some((g) => g.includes(encodeURIComponent('Beijing China')))) return 'FAIL no stop pill opens Beijing by name';
  /* Eight send a geo: search (nine until Chongli left, 2026-10-17); the gorge
     sends the owner's saved share link, and a share link is not a geo: URI —
     geo.ts returns null for it on purpose. */
  const n = geos.filter((g) => g.startsWith('geo:')).length;
  if (n !== 8) return `FAIL ${n} pills fire a geo: intent, expected 8 + the gorge share link`;
  if (guideWalk.find((g) => g.sid === 'cn26-stop-gorge').geo[0] !== '') return 'FAIL the gorge pill is a geo: search, not the share link';
  return 'ok 9 pills + none on Shanghai, 8 geo: + the gorge link';
})();
rows.push([String(planmaps).startsWith('ok') ? 'PASS' : 'FAIL', 'Guides · a map pill per city, none on transit', String(planmaps).slice(0, 56)]);

/* HOW YOU GET FROM ONE CITY TO THE NEXT — the connectors, new 2026-08-12, and
   since Horizon Run 3 the MOVE rows of Journey's route check: each move is a
   row between the two stops it joins, and it opens to its legs. Three things
   have to hold: every join draws, a join with NOTHING booked says so rather
   than rendering blank (the real trip has had no such join since CA1560 was
   booked on 2026-09-28 — that half is proved on the pre-28 Sep trip below),
   and a two-part move prints its parts in the order you travel them — the
   first build put "fly, then take the train to the airport".
   The legs sit folded under their row, so they are read from the DOM
   (textContent), not from the layout. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey` });
await wait(2200);
const conns = await js(`(async()=>{
  const rows=[...document.querySelectorAll('li.ck-leg')];
  if(rows.length<10) return 'FAIL only '+rows.length+' moves in the route check';
  const legsOf=(r)=>((r.querySelector('.ck-legs')||{}).textContent||'').replace(/\\s+/g,' ');
  const wordOf=(r)=>((r.querySelector('summary .chip')||{}).textContent||'').trim();
  /* Dec 5 Yantai → Beijing WAS the one join with neither a flight nor a train.
     CA1560 was booked on 2026-09-28, so no move on the trip is a gap any more;
     the gap rendering is proved on the pre-28 Sep trip further down. */
  const gap=rows.filter(r=>r.querySelector('.ck-gap'));
  if(gap.length!==0) return 'FAIL '+gap.length+' gap moves, expected none since CA1560 was booked';
  const dec5=rows.find(r=>/CA ?1560/.test(legsOf(r)));
  if(!dec5) return 'FAIL the Dec 5 move does not carry CA1560';
  if(!/^Booked$/i.test(wordOf(dec5))) return 'FAIL the Dec 5 move reads "'+wordOf(dec5)+'"';
  /* Dec 11 was a train to Qinghe THEN CA8609 until 2026-10-17. Skiing was
     dropped: the move into Zhangjiajie is MU394 from Pudong — booked the same
     day — and CA8609, cancelled and refunded that day too, is no longer
     offered at all: a cancelled booking is no OR. */
  const d11=rows.find(r=>/MU ?394/.test(legsOf(r)));
  if(!d11) return 'FAIL no move carries MU394';
  if(/Taizicheng|Qinghe/.test(d11.textContent)) return 'FAIL Dec 11 still carries the Chongli train';
  if(!/^Booked$/i.test(wordOf(d11))) return 'FAIL the Dec 11 move reads "'+wordOf(d11)+'"';
  if(/CA ?8609/.test(d11.textContent)) return 'FAIL the cancelled CA8609 is still offered on Dec 11';
  /* Nov 22 is a flight OR the HSR — offered, never counted as a second hop.
     CA8683 was retimed free onto CA8641 (PKX 15:00 -> YNT 16:20) on
     2026-09-29; same Trip.com order and booking id, so the move now carries CA8641. */
  const arr=rows.find(r=>/CA ?8641/.test(legsOf(r)));
  if(!arr) return 'FAIL no move carries CA8641';
  const alt=arr.querySelector('.ck-lg.alt');
  if(!alt||!/or instead/i.test(alt.textContent)) return 'FAIL the Nov 22 fallback is not offered as an alternative';
  /* Three legs, in the order you fly them: TLV, Abu Dhabi, then Yantai. */
  const first=[...arr.querySelectorAll('.ck-lg:not(.alt)')].map(e=>e.textContent.trim());
  if(first.length!==3) return 'FAIL arrival move has '+first.length+' legs, expected 3';
  if(!/EY ?608/.test(first[0])||!/CA ?8641/.test(first[2])) return 'FAIL arrival legs out of order';
  /* The two road legs finally have somewhere to appear. */
  const txt=rows.map(r=>r.textContent);
  const bus=txt.find(t=>/Qiaotou/.test(t));
  if(!bus) return 'FAIL the gorge bus is still invisible';
  /* …and since 27 Sep it is the public bus, and the big bag rides it with you
     to wait at Jane's: the inn has no contact for Tina's (no "Tina's bus"). */
  if(!/Public bus/.test(bus)||!/bag rides with you/.test(bus)||/Tina.s bus/.test(bus)) return 'FAIL the Dec 18 bus is not the public bus the bag rides: '+bus.replace(/\\s+/g,' ').slice(0,50);
  if(!txt.some(t=>/Shared car/i.test(t))) return 'FAIL the shared car is still invisible';
  /* and every leg is a door to its own pass */
  const doors=[...document.querySelectorAll('.ck-lg')];
  if(doors.some(a=>!/^#\\/trip\\/cn26\\/pocket\\/./.test(a.getAttribute('href')||''))) return 'FAIL a leg does not open its pass';
  return 'ok '+rows.length+' moves, 0 gaps, MU394 booked, no CA8609';
})()`, true);
rows.push([String(conns).startsWith('ok') ? 'PASS' : 'FAIL', 'Route check · how you get between cities', String(conns).slice(3, 56)]);

/* IS ANY OF IT ACTUALLY BOOKED? — the coverage chips, new 2026-08-12, and since
   Horizon Run 3 the STOP rows of the route check: a bed chip on every stop,
   green when the nights are held, amber when a bed is chosen but not held or
   a missing bed is already behind you, red while a missing bed is still ahead.
   A bedless night was once drawn as nothing at all, and a blank is the one
   thing a traveller cannot check.

   THE CASE THIS EXISTS FOR IS NOV 22. The academy takes arrivals Mon/Tue/Wed
   only, so the Kunyu stop starts on the 23rd and the night on the ground in
   Yantai belonged to no stop window at all — a coverage model that walked stop
   windows would have called the one truly bedless night on the trip fine.
   ON 2026-09-28 THAT NIGHT WAS BOOKED — the Muping night — and CA1560 the same
   morning, so no stop on the real trip is short of a bed any more and the
   Dec 5 move is held. The amber "Bed missing · 22 Nov" chip and the "Nothing
   booked" move are proved on the pre-28 Sep trip further down.
   textContent, not innerText: the chips are uppercased in CSS. */
const covers = await js(`(()=>{
  const all=[...document.querySelectorAll('li.ck-row')];
  const stops=all.filter(r=>r.classList.contains('ck-stop'));
  if(stops.length!==10) return 'FAIL '+stops.length+' stop rows, expected 10';
  /* the transit pseudo-stop is a move, never a place */
  if(document.querySelector('[data-stop="cn26-stop-flights"]')) return 'FAIL the transit pseudo-stop is drawn as a stop';
  const chipOf=(r)=>r.querySelector('.ck-main > .chip');
  if(stops.some(r=>!chipOf(r))) return 'FAIL a stop row carries no bed chip';
  const find=(id)=>stops.find(r=>r.dataset.stop===id);
  /* Nov 22 WAS the one night on this trip with no bed of any kind; the Muping
     night was booked on 2026-09-28, so the Kunyu row now reads the way Hong
     Kong's does — and the missing bed and its date are gone from it. */
  const kunyu=find('cn26-stop-kunyu');
  if(!kunyu) return 'FAIL no Kunyu row';
  const kt=chipOf(kunyu).textContent.trim();
  if(!/^booked$/i.test(kt)) return 'FAIL Kunyu chip reads "'+kt+'", expected Booked since 28 Sep';
  if(!chipOf(kunyu).classList.contains('ok')) return 'FAIL the fully booked Kunyu stop is not drawn ok';
  /* The academy fortnight IS booked since 12 Aug — twelve nights that must
     never be counted as holes just because the card carries no price. */
  if(/12 beds|13 beds/i.test(kt)) return 'FAIL the held fortnight is being counted as missing';
  /* Hong Kong: five booked nights, a booked flight in and a booked flight out. */
  const hk=find('cn26-stop-hongkong');
  const ht=chipOf(hk).textContent.trim();
  if(!/^booked$/i.test(ht)) return 'FAIL Hong Kong chip reads "'+ht+'"';
  if(!chipOf(hk).classList.contains('ok')) return 'FAIL Hong Kong is fully booked and not drawn ok';
  const legBefore=(r)=>{ const p=all[all.indexOf(r)-1]; return p&&p.classList.contains('ck-leg')?p:null; };
  const legAfter=(r)=>{ const n=all[all.indexOf(r)+1]; return n&&n.classList.contains('ck-leg')?n:null; };
  const wordOf=(r)=>((r.querySelector('summary .chip')||{}).textContent||'').trim();
  /* Dec 5, Yantai to Beijing: CA1560, booked 28 Sep — the move into Beijing is
     its own row, and it no longer says nothing is booked. */
  const bj=legBefore(find('cn26-stop-beijing'));
  if(!bj) return 'FAIL no move row into Beijing';
  if(!/^booked$/i.test(wordOf(bj))) return 'FAIL the Dec 5 move reads "'+wordOf(bj)+'"';
  if(bj.querySelector('.ck-gap')) return 'FAIL the Dec 5 move still says no flight and no train is booked';
  /* THE WALK-UP LEGS ARE NOT GAPS. The early bus into the gorge and the shared
     car out of it are walk-up, no advance sale — their own cards say so. The
     gorge's bed is the walk-in, which is covered; its two moves are "Not
     booked" (a card and no reservation), never "Nothing booked". */
  const gorge=find('cn26-stop-gorge');
  const gt=chipOf(gorge).textContent.trim();
  if(!/^walk-in$/i.test(gt)) return 'FAIL the gorge chip reads "'+gt+'", expected Walk-in';
  for(const leg of [legBefore(gorge),legAfter(gorge)]){
    if(!leg) return 'FAIL the gorge is not between two moves';
    if(leg.querySelector('.ck-gap')||/nothing/i.test(wordOf(leg))) return 'FAIL a walk-up road leg is being called a gap';
    if(!/^not booked$/i.test(wordOf(leg))) return 'FAIL a gorge road leg reads "'+wordOf(leg)+'"';
  }
  /* THE ROW HOLDS ITS CHIP on a 412 px phone: inside the row and on one line. */
  const main=kunyu.querySelector('.ck-main').getBoundingClientRect();
  const c=chipOf(kunyu).getBoundingClientRect();
  if(c.left<main.left||c.right>main.right+1) return 'FAIL the Kunyu chip overflows its row';
  if(c.height>30) return 'FAIL the Kunyu chip wrapped to '+Math.round(c.height)+' px';
  /* and the count the sweep ends on: what is still to do from today — the
     gorge's two walk-up legs and the Dec 20 HSR, nothing else */
  const sum=((document.querySelector('.ck-sum')||{}).textContent||'').replace(/\\s+/g,' ').trim();
  if(!/3 legs to book/.test(sum)) return 'FAIL the count reads "'+sum+'", expected 3 legs to book on Dec 15';
  if(/missing/i.test(sum)) return 'FAIL a bed is counted as missing: "'+sum+'"';
  return 'ok '+kt+' / HK '+ht+' / gorge '+gt+' · '+sum;
})()`);
rows.push([String(covers).startsWith('ok') ? 'PASS' : 'FAIL', 'Route check · is each stop actually booked', String(covers).slice(3, 56)]);

/* THE RELAY SWEEP (f-journey): the rows light one after another, in trip
   order — the sweep pauses on amber (and longer on red) — and it ends on the
   count. Walked on 1 Nov, before the trip: everything that is not booked is
   still a job. Since 2026-09-28 every bed ahead is booked, so the real trip
   has no red row and the map rings no station — the sweep still pauses on
   the six legs nothing holds yet. The red pause, the ringed station and
   "1 bed missing" are walked on the pre-28 Sep trip, next. */
await S('Page.navigate', { url: `${BASE}?d=2026-11-01#/trip/cn26/journey` });
await wait(2200);
const sweep = await js(`(()=>{
  const all=[...document.querySelectorAll('li.ck-row')];
  if(all.length!==21) return 'FAIL '+all.length+' rows, expected 10 stops and the 11 moves around them';
  if(all.some(r=>!r.classList.contains('relay'))) return 'FAIL '+all.filter(r=>!r.classList.contains('relay')).length+' row(s) outside the sweep';
  const at=(r,v)=>parseFloat(r.style.getPropertyValue(v));
  const d=all.map(r=>at(r,'--rd'));
  if(d.some(isNaN)) return 'FAIL a row has no moment in the sweep';
  for(let i=1;i<d.length;i++) if(!(d[i]>d[i-1])) return 'FAIL the sweep is out of order at row '+(i+1);
  const tone=(r)=>['ok','warn','crit'].find(t=>r.classList.contains('t-'+t));
  if(all.some(r=>!tone(r))) return 'FAIL a row is lit with no colour';
  const red=all.filter(r=>tone(r)==='crit');
  if(red.length) return 'FAIL '+red.length+' red row(s) on a trip with every bed ahead booked';
  const kunyu=all.find(r=>r.dataset.stop==='cn26-stop-kunyu');
  if(tone(kunyu)!=='ok') return 'FAIL the Kunyu stop is lit '+tone(kunyu)+', not green, since the Muping night was booked';
  const hold=(t)=>Math.max(...all.filter(r=>tone(r)===t).map(r=>at(r,'--rt')));
  if(!(hold('warn')>hold('ok'))) return 'FAIL the sweep does not pause longer on amber';
  /* the map rings only the stops the check flags — none, now */
  const rings=document.querySelectorAll('.rp-map circle.flag').length;
  if(rings) return 'FAIL the map rings '+rings+' station(s) on a trip with every bed booked';
  const end=document.querySelector('.ck-sum.relay-end');
  if(!end) return 'FAIL the count is not the end of the sweep';
  if(!(at(end,'--rd')>=d[d.length-1])) return 'FAIL the count shows before the sweep ends';
  const sum=end.textContent.replace(/\\s+/g,' ').trim();
  /* 6 → 5 on 2026-10-17: MU394 was booked the same day it was planned */
  if(!/^5 legs to book$/.test(sum)) return 'FAIL the count reads "'+sum+'", expected 5 legs to book and no bed missing';
  return 'ok 21 rows in order, no red, ends on '+sum;
})()`);
rows.push([String(sweep).startsWith('ok') ? 'PASS' : 'FAIL', 'Relay · the sweep lights in order, ends on a count', String(sweep).slice(3, 60)]);

/* THE TRIP AS IT STOOD BEFORE 28 SEP 2026 — the states the real trip no longer
   has. Nov 22 had no bed and Dec 5 no move until the Muping night
   (cn26-stay-12) and CA1560 (cn26-flight-ca1560) were booked that morning, and
   the renderings built for those holes — the crit NO BOOKING ON FILE stamp on
   the day, the amber "Bed missing · 22 Nov" row and its ringed station, the
   "Nothing booked" move that says why, and the Relay's red pause — would
   otherwise go untested. So: take the two records out of IndexedDB, reload,
   check them all, put them back byte-for-byte, reload, and prove the trip
   reads booked again. Each step changes the ?d= date, so each is a reload.
   (The Replay's rings are walked the same way further down.) */
const BOOKED_28_SEP = ['cn26-stay-12', 'cn26-flight-ca1560'];
const SET_ASIDE_28_SEP = `(async()=>{
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const st=db.transaction('bookings','readwrite').objectStore('bookings');
  const out=[];
  for(const id of ${JSON.stringify(BOOKED_28_SEP)}){
    const rec=await new Promise(r=>{const q=st.get(id);q.onsuccess=()=>r(q.result)});
    if(!rec) { db.close(); return 'FAIL '+id+' is not in the vault'; }
    out.push(rec);
    await new Promise(r=>{const q=st.delete(id);q.onsuccess=()=>r()});
  }
  db.close();
  return JSON.stringify(out);
})()`;
const putBack28Sep = (recs) => `(async()=>{
  const recs=${recs};
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const st=db.transaction('bookings','readwrite').objectStore('bookings');
  for(const rec of recs) await new Promise(r=>{const q=st.put(rec);q.onsuccess=()=>r()});
  const back=await Promise.all(${JSON.stringify(BOOKED_28_SEP)}.map(id=>new Promise(r=>{const q=st.get(id);q.onsuccess=()=>r(q.result)})));
  db.close();
  return back.every(Boolean) ? 'ok' : 'FAIL a booking did not come back';
})()`;
const held = await js(SET_ASIDE_28_SEP, true);
if (!String(held).startsWith('[')) {
  rows.push(['FAIL', 'Before 28 Sep · the two bookings could be set aside', String(held).slice(0, 56)]);
} else {
  await S('Page.navigate', { url: `${BASE}?d=2026-11-22#/trip/cn26/now/day` });
  await wait(2200);
  const wasBedless = await js(`(()=>{
    const row=document.querySelector('.bedrow');
    if(!row) return 'FAIL no tonight row on the Yantai night';
    const stamp=row.querySelector('.stamp');
    if(!stamp) return 'FAIL the unbooked night carries NO stamp at all';
    if(!/no booking on file/i.test(stamp.textContent)) return 'FAIL stamp reads "'+stamp.textContent.trim()+'"';
    if(!stamp.classList.contains('crit')) return 'FAIL the missing bed is not drawn as danger';
    return 'ok '+stamp.textContent.trim();
  })()`);
  rows.push([String(wasBedless).startsWith('ok') ? 'PASS' : 'FAIL', 'Before 28 Sep · tonight with no bed says so', String(wasBedless).slice(3, 56)]);
  /* Dec 14: the missing bed is behind you — amber, dated, ringed on the map,
     and not a job any more; the Dec 5 move says nothing was booked. */
  await S('Page.navigate', { url: `${BASE}?d=2026-12-14#/trip/cn26/journey` });
  await wait(2200);
  const wasGap = await js(`(()=>{
    const all=[...document.querySelectorAll('li.ck-row')];
    const stops=all.filter(r=>r.classList.contains('ck-stop'));
    const chipOf=(r)=>r.querySelector('.ck-main > .chip');
    const wordOf=(r)=>((r.querySelector('summary .chip')||{}).textContent||'').trim();
    const kunyu=stops.find(r=>r.dataset.stop==='cn26-stop-kunyu');
    if(!kunyu) return 'FAIL no Kunyu row';
    const kt=chipOf(kunyu).textContent.trim();
    if(!/bed missing/i.test(kt)) return 'FAIL Kunyu chip reads "'+kt+'", expected the missing bed';
    if(!/22 Nov/.test(kt)) return 'FAIL the bedless night is not dated: "'+kt+'"';
    if(!chipOf(kunyu).classList.contains('warn')) return 'FAIL the Yantai chip is not amber';
    if(/12 beds|13 beds/i.test(kt)) return 'FAIL the held fortnight is being counted as missing';
    const p=all[all.indexOf(stops.find(r=>r.dataset.stop==='cn26-stop-beijing'))-1];
    const bj=p&&p.classList.contains('ck-leg')?p:null;
    if(!bj) return 'FAIL no move row into Beijing';
    if(!/^nothing booked$/i.test(wordOf(bj))) return 'FAIL the Dec 5 move reads "'+wordOf(bj)+'"';
    if(!/No flight and no train booked/i.test((bj.querySelector('.ck-gap')||{}).textContent||'')) return 'FAIL the gap does not say it is a gap';
    const gaps=all.filter(r=>r.querySelector('.ck-gap')).length;
    if(gaps!==1) return 'FAIL '+gaps+' gap moves, expected exactly 1 (Dec 5)';
    /* the map rings exactly the stops the rows flag — here, Kunyu alone */
    const svg=document.querySelector('.rp-map svg.tmap');
    const flagged=svg?svg.querySelectorAll('circle.flag').length:0;
    /* Shanghai was amber for part of 2026-10-17 (its bed not booked); the Hi
       Cozy hostel was booked that evening, so its row is green again and Kunyu
       is the only stop flagged. */
    const amber=stops.filter(r=>r.dataset.tone!=='ok').length;
    if(flagged!==1||amber!==1) return 'FAIL the map rings '+flagged+' and the rows flag '+amber+', expected Kunyu alone';
    const sh=stops.find(r=>r.dataset.stop==='cn26-stop-shanghai');
    if(!sh||sh.dataset.tone!=='ok') return 'FAIL the Shanghai row is not green — its bed is booked';
    if(!svg.querySelector('circle.flag[data-stop="cn26-stop-kunyu"]')) return 'FAIL the station ringed is not Kunyu';
    if(!/\\b1 not fully booked/.test(document.querySelector('.rp-map')?.getAttribute('aria-label')||'')) return 'FAIL the map does not say which stops are not fully booked: '+(document.querySelector('.rp-map')?.getAttribute('aria-label')||'');
    /* a bed behind you is still true, and no longer a job */
    const sum=((document.querySelector('.ck-sum')||{}).textContent||'').replace(/\\s+/g,' ').trim();
    if(!/^4 legs to book$/.test(sum)) return 'FAIL the count reads "'+sum+'", expected 4 legs to book and no bed';
    return 'ok '+kt+' / Dec 5 nothing booked / 1 ring';
  })()`);
  rows.push([String(wasGap).startsWith('ok') ? 'PASS' : 'FAIL', 'Before 28 Sep · the hole and the gap are drawn', String(wasGap).slice(3, 56)]);
  /* Nov 1: the missing bed is still ahead — red, the sweep's longest pause,
     its ring lit with its row, and the count ends on it. */
  await S('Page.navigate', { url: `${BASE}?d=2026-11-01#/trip/cn26/journey` });
  await wait(2200);
  const wasRed = await js(`(()=>{
    const all=[...document.querySelectorAll('li.ck-row')];
    if(all.length!==21) return 'FAIL '+all.length+' rows, expected 21';
    if(all.some(r=>!r.classList.contains('relay'))) return 'FAIL a row is outside the sweep';
    const at=(r,v)=>parseFloat(r.style.getPropertyValue(v));
    const tone=(r)=>['ok','warn','crit'].find(t=>r.classList.contains('t-'+t));
    const kunyu=all.find(r=>r.dataset.stop==='cn26-stop-kunyu');
    if(tone(kunyu)!=='crit') return 'FAIL the bed still ahead is not red';
    const hold=(t)=>Math.max(...all.filter(r=>tone(r)===t).map(r=>at(r,'--rt')));
    if(!(hold('crit')>hold('warn')&&hold('warn')>hold('ok'))) return 'FAIL the sweep does not pause longer on amber and longest on red';
    const ring=document.querySelector('.rp-map circle.flag[data-stop="cn26-stop-kunyu"]');
    if(!ring||!ring.classList.contains('relay')||at(ring,'--rd')!==at(kunyu,'--rd')) return 'FAIL the Kunyu ring does not light with its row';
    const sum=((document.querySelector('.ck-sum.relay-end')||{}).textContent||'').replace(/\\s+/g,' ').trim();
    /* 7 → 6 on 2026-10-17: this "before" trip is today's seed minus the 28 Sep bookings, and MU394 is booked in it too */
    if(!/6 legs to book/.test(sum)||!/1 bed missing/.test(sum)) return 'FAIL the count reads "'+sum+'"';
    return 'ok red on Kunyu, longest pause, ends on '+sum;
  })()`);
  rows.push([String(wasRed).startsWith('ok') ? 'PASS' : 'FAIL', 'Before 28 Sep · the sweep stops longest on red', String(wasRed).slice(3, 60)]);
  const restored = await js(putBack28Sep(held), true);
  await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey` });
  await wait(2200);
  const booked28 = await js(`(()=>{
    const all=[...document.querySelectorAll('li.ck-row')];
    const kunyu=all.find(r=>r.dataset.stop==='cn26-stop-kunyu');
    const kt=(kunyu?.querySelector('.ck-main > .chip')?.textContent||'').trim();
    if(!/^booked$/i.test(kt)) return 'FAIL Kunyu reads "'+kt+'" after the restore';
    if(all.some(r=>r.querySelector('.ck-gap'))) return 'FAIL a move still says nothing is booked after the restore';
    return 'ok '+kt;
  })()`);
  const ok = String(restored).startsWith('ok') && String(booked28).startsWith('ok');
  rows.push([ok ? 'PASS' : 'FAIL', 'Before 28 Sep · both bookings restored', ok ? '' : (String(restored) + ' / ' + String(booked28)).slice(0, 56)]);
}

/* the read-more place page — the city's guide since Horizon Run 3
   (journey/:stop/guide): route, text and hero, offline */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey/cn26-stop-beijing/guide` });
await wait(2200);
const place = await js(`(()=>{
  const t=document.body.innerText.toLowerCase();
  const hero=[...document.images].some(im=>im.src.startsWith('blob:')&&im.complete&&im.naturalWidth>0);
  return (t.includes('palace museum') && t.includes('mutianyu') && t.includes('day by day') && hero) ? 'ok' : 'FAIL '+t.slice(0,40);
})()`);
rows.push([place === 'ok' ? 'PASS' : 'FAIL', 'Place page · read more + hero', place === 'ok' ? '' : String(place).slice(0, 50)]);

/* the restructured city guide: the five parts, and map buttons that RENDER
   offline because they are pure link builders (still on the Beijing page) */
const guide = await js(`(()=>{
  const t=document.body.innerText.toLowerCase();
  const want=['getting there & money','budget for this stop','all the options','⭐ = recommended','our picks'];
  const missing=want.filter(w=>!t.includes(w));
  const maps=document.querySelectorAll('.maps button').length;
  return missing.length ? 'FAIL missing: '+missing.join(', ') : (maps>=1 ? 'ok '+maps : 'FAIL map buttons: '+maps);
})()`);
rows.push([String(guide).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · 5 parts + map buttons', String(guide).slice(0, 56)]);

/* RUN 3b — THE FALLBACK GETS ITS OWN BOX. f-guide sets "If CA 8609 is
   cancelled" apart in an amber callout (since 2026-10-17 it is MU394's: the
   morning MU354 — skiing dropped, Dec 11 leaves Pudong); the guide had left the fallbacks as
   the tail of the Getting-there paragraph. The clause is split out in the
   file's own words (its verify flag still a flag), and the guide opens in its
   own voice with only the trip's facts. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/journey/cn26-stop-zhangjiajie/guide` });
await wait(2400);
const fallback = await js(`(()=>{
  const ch=document.getElementById('g-there');
  if(!ch) return 'FAIL no Getting there chapter on the Zhangjiajie guide';
  const box=ch.querySelector('.gd-fall');
  if(!box) return 'FAIL the fallbacks are not in a callout';
  if(box.getAttribute('role')!=='note') return 'FAIL the callout is not a note';
  const label=(box.querySelector('.caps')?.textContent||'').trim();
  if(label!=='fallback') return 'FAIL the callout is labelled '+label;
  const t=box.innerText.replace(/\\s+/g,' ');
  if(!/a morning MU354, PVG 07:55 → 10:50/.test(t)) return 'FAIL the callout reads '+t.slice(0,70);
  if(!box.querySelector('.md-vfy')) return 'FAIL the verify flag inside it is gone';
  const before=box.previousElementSibling;
  if(!before||!/cancelled the same day$/.test(before.textContent.trim())) return 'FAIL the line before it does not end where the clause starts';
  if(!/MU394, Shanghai Pudong \\(PVG\\) T1 19:10 → Zhangjiajie T2 21:40/.test(before.textContent)) return 'FAIL the line before it is not the Pudong flight';
  if(/fallback:/i.test(before.textContent)) return 'FAIL the fallback is still in the paragraph too';
  const stand=(document.querySelector('.gd-stand')?.textContent||'').trim();
  if(stand!=='Three nights · Fri 11 → Mon 14 Dec · two in the park, one in the city') return 'FAIL the standfirst reads '+stand;
  return 'ok '+label+' · '+t.slice(0,30);
})()`);
rows.push([String(fallback).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · the fallback in its own callout', String(fallback).slice(0, 56)]);
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/journey/cn26-stop-kunming/guide` });
await wait(2400);
const fallbackKm = await js(`(()=>{
  const box=document.querySelector('#g-there .gd-fall');
  if(!box) return 'FAIL no fallback callout on the Kunming guide';
  const t=box.innerText.replace(/\\s+/g,' ').trim();
  if(!/^fallback Kunming South → straight to the airport ibis$/i.test(t)) return 'FAIL the callout reads '+t.slice(0,60);
  const after=box.nextElementSibling?.textContent||'';
  if(!/^trains and times verify when sales open/.test(after.trim())) return 'FAIL the line does not go on after the callout';
  return 'ok '+t;
})()`);
rows.push([String(fallbackKm).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · a fallback mid-line stays in order', String(fallbackKm).slice(0, 56)]);

/* THE GUIDE'S JUMP BAR, new 2026-08-12. This is the longest page in the app —
   Zhangjiajie runs to ~11,800 px — and the Dead-hour question ("three free
   hours, what is worth doing?") is answered by the spot grid roughly fourteen
   thumb flicks down it. Info's own 44 px chips already solved this on an even
   longer page, so this is that pattern reused, plus a thumb-zone way back up.
   HORIZON RUN 3 (f-city): the chips moved to the city's half-height guide
   sheet — a chip per chapter, each opening the guide AT that chapter — and the
   spot grid is the "Places" chapter (it was "Eat & see"). Walked from Beijing's
   city, which leaves this walk standing on the Beijing guide again. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey/cn26-stop-beijing` });
await wait(2200);
const guidejump = await js(`(async()=>{
  const chips=[...document.querySelectorAll('.ct-chips .ct-chip')];
  if(chips.length<4) return 'FAIL only '+chips.length+' chapter chips for the longest page in the app';
  const small=chips.filter(c=>c.getBoundingClientRect().height<44);
  if(small.length) return 'FAIL '+small.length+' chapter chip(s) under 44 px';
  const labels=chips.map(c=>c.textContent.replace(/^\\s*\\d+\\s*/,'').trim());
  for(const want of ['Getting there','Day by day','Places']){
    if(!labels.includes(want)) return 'FAIL no "'+want+'" chip — saw ['+labels.join('|')+']';
  }
  /* it opens the guide, and it moves it to the chapter it names */
  chips[chips.length-1].click(); await new Promise(r=>setTimeout(r,1600));
  if(!/cn26-stop-beijing\\/guide$/.test(location.hash)) return 'FAIL the chip did not open the guide: '+location.hash;
  if(window.scrollY<400) return 'FAIL the last chip barely moved the page: '+Math.round(window.scrollY);
  const eat=document.getElementById('g-eat');
  if(!eat) return 'FAIL there is no places chapter to land on';
  const et=eat.getBoundingClientRect().top;
  if(et<-40||et>window.innerHeight/2) return 'FAIL the page did not land on the places chapter ('+Math.round(et)+' px)';
  /* and the way back up is in the thumb zone, not the far corner */
  const top=document.querySelector('.totop');
  if(!top) return 'FAIL no back-to-top';
  const r=top.getBoundingClientRect();
  if(r.height<44||r.width<44) return 'FAIL back-to-top is under 44 px';
  if(r.bottom>window.innerHeight||r.top<window.innerHeight*0.6) return 'FAIL back-to-top is not in the thumb zone';
  top.click(); await new Promise(r=>setTimeout(r,1400));
  if(window.scrollY>60) return 'FAIL back-to-top left the page at '+Math.round(window.scrollY);
  return 'ok '+chips.length+' chips · '+labels.join(' · ');
})()`, true);
rows.push([String(guidejump).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · jump bar + back to top', String(guidejump).slice(3, 56)]);

/* THE GUIDE READS AT NIGHT, new 2026-08-12 (Gap D item 3, owner decision).
   The Kyoto mockup put every word of the longest page in the app into a
   distressed typewriter face, and the story of a city onto a cream sheet that
   flashbangs a dark-adapted eye at 22:00. The long read moved to the app's own
   face on dark ground, and that half of the rule is asserted unchanged.
   HORIZON (Run 1) RETIRED THE PAPER FURNITURE: the typewriter and script faces
   left the app with the Lantern fonts, and the cream stock became the night
   sky's second card. What the old second half protected — a heading that reads
   as a heading, and a short block that stands apart from the story — is still
   asserted, in Horizon's terms; Run 3 rebuilds the guide as a long read. */
const guideprose = await js(`(async()=>{
  window.scrollTo(0,0); await new Promise(r=>setTimeout(r,300));
  const story=document.querySelector('#g-about .gd-story');
  if(!story) return 'FAIL no story on the Beijing guide';
  const cs=getComputedStyle(story);
  if(/Special Elite/i.test(cs.fontFamily)) return 'FAIL the long read is still typewriter';
  if(!/Figtree/i.test(cs.fontFamily)) return 'FAIL the long read is in '+cs.fontFamily;
  if(parseFloat(cs.fontSize)<16) return 'FAIL the long read is '+cs.fontSize;
  if(parseFloat(cs.lineHeight)/parseFloat(cs.fontSize)<1.5) return 'FAIL leading is '+cs.lineHeight;
  /* dark ground: a near-white sheet is the thing that was fixed. The words sit
     on whatever is painted behind them, so the ground is the first opaque
     background up the tree. */
  const ground=(el)=>{ for(let e=el;e;e=e.parentElement){ const b=getComputedStyle(e).backgroundColor; if(b&&b!=='transparent'&&!/rgba\\(\\d+, \\d+, \\d+, 0\\)/.test(b)) return b; } return 'rgb(0, 0, 0)'; };
  const g=ground(story);
  const bg=(g.match(/\\d+/g)||['0','0','0']).map(Number);
  if(bg[0]>120) return 'FAIL the long read is on a light sheet: '+g;
  /* the heading still reads as a heading, not as more prose */
  const h=document.querySelector('#g-about h2');
  if(!h) return 'FAIL the story has no heading';
  const hs=getComputedStyle(h);
  if(hs.textTransform!=='uppercase'&&!/Unbounded/i.test(hs.fontFamily)) return 'FAIL the story heading is set like the prose';
  /* THE EDITION LONG READ (f-guide, Horizon Run 3): the story opens on a drop
     cap and carries a pull quote in the stop's OWN words — never a new line. */
  const lead=document.querySelector('#g-about .gd-story.lead');
  if(!lead) return 'FAIL the story has no lead paragraph';
  const fl=getComputedStyle(lead,'::first-letter');
  const rules=[...document.styleSheets].flatMap(s=>{ try{ return [...s.cssRules]; }catch(e){ return []; } });
  const capRule=rules.find(r=>r.selectorText&&/::first-letter/.test(r.selectorText)&&r.style.float==='left'&&(()=>{ try{ return lead.matches(r.selectorText.replace(/::first-letter/g,'')); }catch(e){ return false; } })());
  const capped=(fl.float==='left'&&parseFloat(fl.fontSize)>=parseFloat(cs.fontSize)*2)||!!capRule;
  if(!capped) return 'FAIL the story has no drop cap';
  const q=document.querySelector('#g-about .gd-quote blockquote');
  if(!q) return 'FAIL the story has no pull quote';
  const qt=q.textContent.trim();
  if(qt.length<40||qt.length>110) return 'FAIL the pull quote is '+qt.length+' characters';
  /* (a quote lifted from after a colon starts on a capital the story does not
     have, so the words are compared, not the case) */
  const told=[...document.querySelectorAll('#g-about .gd-story')].map(p=>p.textContent).join(' ').replace(/\\s+/g,' ').toLowerCase();
  if(!told.includes(qt.slice(0,24).toLowerCase())) return 'FAIL the pull quote is not in the story: '+qt.slice(0,40);
  /* and each chapter stands apart from the next — its number, a display
     heading and a rule — without a light sheet anywhere */
  const chs=[...document.querySelectorAll('article .gd-ch')];
  if(chs.length<5) return 'FAIL only '+chs.length+' chapters';
  if(chs.some(c=>!c.querySelector('.gd-n')||!c.querySelector('.gd-rule')||!c.querySelector('h2'))) return 'FAIL a chapter has no number, heading or rule';
  const there=document.getElementById('g-there');
  if(!there) return 'FAIL no getting-there chapter';
  const tb=(ground(there).match(/\\d+/g)||['0','0','0']).map(Number);
  if(tb[0]>160) return 'FAIL the getting-there chapter flashbangs at night: '+ground(there);
  return 'ok story '+cs.fontSize+' Figtree on rgb('+bg.slice(0,3).join(',')+'), drop cap, quote '+qt.length+' ch';
})()`, true);
rows.push([String(guideprose).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · the long read is legible at night', String(guideprose).slice(3, 56)]);

/* THE VERIFY FLAG (f-guide). The trip's prose marks what must be checked on
   the day as *(verify …)*; the guide sets every one of them as a flag of its
   own rather than as more italic, so a traveller skimming for the facts to
   re-check finds them. Beijing's prose carries several. */
const verifyFlag = await js(`(()=>{
  const f=[...document.querySelectorAll('.gd-body .md-vfy')];
  if(!f.length) return 'FAIL no verify flag on the Beijing guide';
  if(f.some(e=>!/^\\(?verify/i.test(e.textContent.trim()))) return 'FAIL a flag does not say verify';
  if([...document.querySelectorAll('.gd-body i')].some(e=>/^\\(verify/i.test(e.textContent.trim()))) return 'FAIL a verify note is still plain italic';
  return 'ok '+f.length+' verify flags';
})()`);
rows.push([String(verifyFlag).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · every "verify" is a flag', String(verifyFlag).slice(3, 56)]);

/* THE TYPE LADDER HOLDS, new 2026-08-12 (Gap D item 2). Before that run the
   app rendered 45 distinct sizes, 192 of them crowded between 8.5 and 15.5 px,
   and text as small as 8.5 px. HORIZON'S LADDER (system/tokens.json, Run 1) is
   the design system's own type scale — display 56/40/34/22/18, text
   16/15/14/13/12/11, numbers 52/28/15/13, plus the 20 px code line and the
   28 px screen size — and nothing between them; 11 px is still the floor. The
   walk sweeps real screens rather than reading the CSS, so a size that creeps
   back in through an inline style or a third-party node is caught too. The
   named off-ladder sizes are the driver card (§RULES 4: it is read at arm's
   length by a stranger) and the decorative scene glyphs. */
const LADDER_SWEEP = [
  ['Now', '?d=2026-12-19#/trip/cn26/now'],
  ['the day', '?d=2026-12-11#/trip/cn26/now/day'],
  ['an ordinary day', '?d=2026-12-13#/trip/cn26/now/day'],
  ['To do', '?d=2026-12-11#/trip/cn26/now/todo'],
  ['Journey', '?d=2026-12-15#/trip/cn26/journey'],
  ['a city', '?d=2026-12-15#/trip/cn26/journey/cn26-stop-zhangjiajie'],
  ['the guide', '#/trip/cn26/journey/cn26-stop-beijing/guide'],
  ['the Pocket', '?d=2026-12-11#/trip/cn26/pocket'],
  ['a pass', '?d=2026-12-11#/trip/cn26/pocket/cn26-flight-mu394'],
  ['Money', '?d=2026-12-15#/trip/cn26/pocket/money'],
  ['Find', '?d=2026-12-11#/trip/cn26/find'],
  ['the shelf', '?d=2026-12-11#/trips'],
  ['Settings', '#/settings'],
];
const offenders = [];
for (const [name, route] of LADDER_SWEEP) {
  await S('Page.navigate', { url: `${BASE}${route}` });
  await wait(2000);
  const bad = await js(`(()=>{
    const RUNGS=[11,12,13,14,15,16,18,20,22,28,34,40,52,56];
    const OFF=[46,74];            /* --glyph-scene, --glyph-scene-lg */
    /* Fluid display type is named and off the ladder on purpose: a stop name
       and a confirmation code must not push a 360 px phone sideways. */
    const FLUID='.city,.code,.code-big';
    const seen=new Map();
    for(const el of document.querySelectorAll('body *')){
      if(el.closest('.driver')) continue;             /* §RULES 4 */
      if(el.closest(FLUID)) continue;   /* Md wraps its text in a bare span */
      if(!el.textContent || !el.textContent.trim()) continue;
      const r=el.getBoundingClientRect();
      if(!r.width || !r.height) continue;
      const s=Math.round(parseFloat(getComputedStyle(el).fontSize)*100)/100;
      if(RUNGS.includes(s)||OFF.includes(s)) continue;
      const k=s+' '+(String(el.className).split(' ')[0]||el.tagName);
      if(!seen.has(k)) seen.set(k,(el.textContent||'').trim().slice(0,18));
    }
    return [...seen.entries()].map(([k,v])=>k+' "'+v+'"');
  })()`);
  if (Array.isArray(bad) && bad.length) offenders.push(name + ': ' + bad.slice(0, 4).join(' | '));
}
const ladder = offenders.length
  ? 'FAIL off the ladder — ' + offenders.join(' ;; ')
  : `ok ${LADDER_SWEEP.length} screens, every size on the Horizon scale`;
rows.push([ladder.startsWith('ok') ? 'PASS' : 'FAIL', 'Type ladder · Horizon scale, nothing between', String(ladder).slice(3, 120)]);
/* THE SWEEP WALKED AWAY FROM THE GUIDE, and the next four checks are still
   standing on it. Put the page back before handing it on — a check that
   silently inherits the wrong route is how "0 spots" gets read as a defect in
   the spot grid instead of a defect in this file. */
await S('Page.navigate', { url: `${BASE}#/trip/cn26/journey/cn26-stop-beijing/guide` });
await wait(2400);

/* ONE button per place, everywhere. The old Google+Amap pair is gone, so no
   group of map buttons anywhere on this page may hold more than one. */
const single = await js(`(()=>{
  const groups=[...document.querySelectorAll('.maps')];
  /* A page with no map buttons satisfies "at most one each" trivially. It used
     to score a PASS on a blank page — never again. */
  if(!groups.length) return 'FAIL no map buttons on the page at all';
  const bad=groups.filter(g=>g.querySelectorAll('button').length!==1).length;
  const labels=new Set(groups.map(g=>g.querySelector('button')?.textContent.trim()));
  return bad ? 'FAIL '+bad+' group(s) with the old pair' : 'ok '+groups.length+' × '+[...labels].join('/');
})()`);
rows.push([String(single).startsWith('ok') ? 'PASS' : 'FAIL', 'One map button per place', String(single).slice(0, 56)]);

/* "Places here": the options prose, turned into things you can tap. Each row
   publishes the geo: intent a tap would fire on the phone — a headless browser
   has no map app, so the URI itself is what can be proved offline. */
const spots = await js(`(()=>{
  const rows=[...document.querySelectorAll('.spots li')];
  if(rows.length<20) return 'FAIL only '+rows.length+' spots';
  const beihai=rows.find(r=>/北海公园/.test(r.textContent));
  if(!beihai) return 'FAIL no Beihai row';
  const b=beihai.querySelector('.maps button');
  if(!b) return 'FAIL no button on the row';
  const geo=b.getAttribute('data-geo')||'';
  /* The NAME still leads the search and the city still ends it; whatever
     address rides between them is allowed to change without failing this. */
  if(!geo.startsWith('geo:0,0?q='+encodeURIComponent('北海公园'))) return 'FAIL geo='+geo.slice(0,50);
  if(!geo.endsWith(encodeURIComponent('北京'))) return 'FAIL city not last: '+geo.slice(-30);
  return 'ok '+rows.length+' spots';
})()`);
rows.push([String(spots).startsWith('ok') ? 'PASS' : 'FAIL', 'Places here · spot opens a geo: URI', String(spots).slice(0, 50)]);

/* the flight fare chip lands on the stop it belongs to (Zhangjiajie, CA 8609 —
   CA 1953 until the free change of 2026-09-27, same $241),
   with the beds booked there and the itemised money block beside it.
   $124, not the $104 that was planned: Pullman was booked on 2026-07-27 for
   ¥887.52, and the stop page converts at the trip's own rate rather than
   inventing a dollar price the confirmation never printed. */
/* CA 8609 left this list on 2026-10-17: it was the OR to MU394, then was
   cancelled and refunded, and the guide's Booked chapter lists what you hold
   for this stop. */
await check('City guide · booked items + prices', `${BASE}?d=2026-12-15#/trip/cn26/journey/cn26-stop-zhangjiajie/guide`,
  ['Pullman Zhangjiajie', '$124',
   'Huatian Grand Hotel', '$59', 'Park pass', '¥165', 'hotels', '$183 (both booked)']);
/* …and the flight, the two beds and the pass are in the guide's BOOKED
   chapter ("Booked for this stop" until Run 3), each a door to its pass. */
const bookedHere = await js(`(()=>{
  const sec=document.getElementById('g-booked');
  if(!sec) return 'FAIL the guide has no Booked chapter';
  if(!/^booked$/i.test((sec.querySelector('h2')||{}).textContent||'')) return 'FAIL the chapter is not called Booked';
  const t=sec.textContent.toLowerCase();
  const missing=['Pullman Zhangjiajie','Huatian Grand Hotel','Park pass'].filter(w=>!t.includes(w.toLowerCase()));
  if(missing.length) return 'FAIL not in the Booked chapter: '+missing.join(', ');
  /* the OR is never listed as held for the stop */
  if(t.includes('ca 8609')) return 'FAIL CA 8609 (cancelled) is listed as booked for Zhangjiajie';
  const items=[...sec.querySelectorAll('a.gd-item')];
  if(items.some(a=>!/^#\\/trip\\/cn26\\/pocket\\/./.test(a.getAttribute('href')||''))) return 'FAIL a booked item does not open its pass';
  return 'ok '+items.length+' items, each a door to its pass';
})()`);
rows.push([String(bookedHere).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · the Booked chapter', String(bookedHere).slice(3, 56)]);

/* THE VISA-EXIT STOP. Dec 20 is a runbook day, so Home draws "Travel-day
   basics" instead of the plan items — this page is where the exit night is
   actually read. Three facts have to be on it: the bed is booked and PAID, the
   free airport transfer that puts you at the terminal is itemised on the order,
   and the order reads CONFIRMED — it was accepted on 29 Jul after two days
   paid-but-unaccepted, and the old warning must not survive the fact. */
await check('City guide · the exit night, paid and confirmed', `${BASE}?d=2026-12-15#/trip/cn26/journey/cn26-stop-kunming/guide`,
  ['Ibis Kunming Changshui', '$25.73', 'free airport transfer', 'CONFIRMED', '23:00 Dec 17']);
/* THE ACADEMY'S OWN CITY PAGE, the second screen this record has to be true on
   (2026-08-12). "Booked for this stop" listed the Yantai flight and NO bed for
   the twelve nights the whole stop exists for. The bed is there now, stamped —
   and PRICED since 2026-08-13, where for a month the guide said in its own
   words that no price was recorded. It said that because none existed; it says
   $840 now because the school wrote one. The check follows the fact both ways:
   the figure has to be on the page AND the honest placeholder has to be gone,
   or a stale "price not recorded" would sit beside a real price. */
await check('City guide · the academy fortnight is held, and priced', `${BASE}?d=2026-11-27#/trip/cn26/journey/cn26-stop-kunyu/guide`,
  ['Kunyu Mountain Shaolin Kung Fu Academy', 'Booked', '$840']);
const guidePriceless = await js(`document.body.innerText.toLowerCase().includes('price not recorded')`);
rows.push([guidePriceless === false ? 'PASS' : 'FAIL', 'City guide · no bed on this stop is priceless any more', guidePriceless === false ? '' : 'a "price not recorded" line survived the $840']);
/* And the Dali page carries the cliff and the desk that shuts at 23:00. */
await check('City guide · Dali booked, arrival undeclared', `${BASE}?d=2026-12-15#/trip/cn26/journey/cn26-stop-dali/guide`,
  ['Dali Yanyuan Mountain Retreat', '¥324', '23:59 Dec 15', '23:00', '+86 189 8708 1208']);

/* the money screen: what is booked, what each one costs, and a total that is
   honest about the legs it cannot price. Horizon: the Wallet's Money segment and
   the Spending screen became one Pocket screen, pocket/money. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/money` });
await wait(2200);
const money = await js(`(async()=>{
  await new Promise(r=>setTimeout(r,300));
  /* THE LEDGER IS BEHIND A DISCLOSURE SINCE 2026-08-12, closed by default: it
     is ~45 rows and it used to be the FIRST thing on the segment, so "am I on
     budget?" was answered about seven viewport-heights below the screen built
     to answer it. The budget meter and the category chips come first now and
     this walk opens the ledger, exactly as a thumb would. Nothing below has
     been relaxed — every figure it ever checked is still checked. */
  const bk=document.querySelector('details.bk');
  if(!bk) return 'FAIL no committed-costs disclosure on the Money segment';
  if(bk.open) return 'FAIL the committed ledger is open before it is asked for';
  const sum=bk.querySelector('summary');
  if(!/already committed \\(\\d+\\)/i.test(sum?.innerText||'')) return 'FAIL the disclosure does not count what it hides: '+(sum?.innerText||'').slice(0,50);
  sum.click();
  await new Promise(r=>setTimeout(r,500));
  if(!bk.open) return 'FAIL the ledger would not open';
  const t=document.body.innerText.toLowerCase();
  /* Every bed is priced now, so the quoted-text hints are the "(2n)" forms and
     the total is a single number rather than a range. The four unpriced rows
     are still the four Etihad legs, which share one booking and one price.

     The total moved four times on 2026-07-27 and this is the arithmetic, not a
     fudge. EIGHT beds stopped being plans: Four Points ~$242 → $289.68, Blossom
     House ~$360 → $299.56, Element ~$221 → $232.95, The Royal Garden ~$1,209 →
     $1,232.01, then Pullman ~$104 → ¥887.52, Huatian ~$62 → ¥419.00,
     Glenview ~$172 → ¥1,166.00, and finally Yue Tu ~$73 → ¥857.30. Beds went
     $2,523.24 → $2,558.20 → $2,566.01 → $2,567.97, so the whole card went
     $5,326 → $5,313.24 → $5,348.20 → $5,356.01 → $5,357.97, printed rounded as
     $5,358. Flights ($764) and the Etihad line ($2,026) did not move.

     THE LAST STEP IS TWO MOVEMENTS, NOT ONE. Lijiang added $119.90 and FOUR
     POINTS GAVE $44.94 BACK: that bed was rebooked at a better rate, $289.68 →
     $244.74, and everything the dead order said went with it. If this card ever
     shows $289.68 or $290 again, the seed has reverted to a booking that no
     longer exists — which is why the next check exists at all.

     THEN BOOKING FINISHED, THE SAME EVENING. The last two beds stopped being
     estimates: DALI ~$47 → ¥324.00 (≈$45.31) and KUNMING ~$26 → $25.73. Beds
     went $2,567.97 → $2,566.01 and the whole card $5,357.97 → $5,356.01,
     printed rounded as $5,356. Both moves are DOWNWARD by a couple of dollars,
     which is the shape to remember: neither room got cheaper, the rate did.
     Flights ($764) and the Etihad line ($2,026) still have not moved.

     THE FIVE YUAN ROWS ARE THE POINT OF THIS CHECK. Three of those
     confirmations printed no dollar figure at all; Yue Tu's and Dali's printed
     both and then said the CNY one is what gets charged. So the card shows the
     yuan each was quoted in with the app's own conversion beside it — ¥887.52 →
     $124, ¥419.00 → $59, ¥1,166.00 → $163, ¥857.30 → $120, ¥324.00 → $45, at
     the trip's stored rate of 7.15. If anyone ever replaces one of those quotes
     with a dollar string, the ¥ line disappears and this fails. THE IBIS IS THE
     OTHER SIDE OF THE SAME RULE: its Trip.com order charged US dollars and
     printed no yuan, so $25.73 is what it must show — the rule is "carry what
     was actually charged", never "prefer yuan". */
  const want=['what’s already committed','four points by sheraton','$245','$244.74 (2n)',
    'blossom house','$300','$299.56 (2n)',
    /* Element Chongli ($232.95) left on 2026-10-17 — cancelled on Agoda —
       and the Hi Cozy hostel came, quoted in the shekels it was paid in. */
    'hi cozy international hostel','$40','₪136.40 (2n)',
    'pullman zhangjiajie','$124','¥887.52 (2n)',
    'huatian grand hotel','$59','¥419.00',
    'glenview itc plaza','$163','¥1,166.00 (2n)',
    'yue tu inn','$120','¥857.30 (2n)',
    'dali yanyuan mountain retreat','$45','¥324.00',
    'ibis kunming changshui','$26','$25.73',
    'the royal garden','$1,232','$1,232.01 (5n)',
    'halfway guesthouse','$20',
    /* THE ACADEMY, on the money card from 2026-08-12 — for one month a row with
       a name, its twelve nights and NO figure of any kind, because a held bed
       whose price was never confirmed in writing has to be present (so nobody
       wonders where the fortnight went) and priceless (so nothing about it can
       be added up).
       ON 2026-08-13 IT GREW ITS FIGURE, and the figure is checked here rather
       than only the row: "you can pay 840 USD to stay for 12 days or two weeks",
       and Nov 23 → Dec 5 is twelve nights, so the school's own sentence covers
       this booking either way. $840 is a LUMP SUM and not a nightly rate, so it
       appears exactly once and is never multiplied by the twelve. */
    'kunyu mountain shaolin kung fu academy','12 nights','$840',
    /* THE TWELFTH BED, 2026-09-28 — the Muping night, quoted in the yuan the
       desk will take in cash, with the app's own conversion beside it. */
    'jinjiang inn select','$23','¥164.00',
    /* 'mu 394' — the Dec 11 flight since 2026-10-17, $200.20 (CA 8609, $241,
       was it until then; cancelled and refunded that day, it is in no total).
       'ca 8641' — the Nov 22 flight, CA 8683 until the free retime of
       2026-09-29. Same order, same $117.30. */
    'ca 8641','$117','ca 1560','$110','mu 394','$200','3u 8011','$230','mu 733','$293',
    'international flights','booked ~$2,026','price not recorded',
    /* THE EXPERIENCES GROUP, new 2026-08-06. Eleven rows for the things this
       trip goes TO, kept out of the Travel total on purpose — a concert inside
       a "Travel" figure reads as a fare. TEN OF THEM CARRY NO PRICE AT ALL:
       the documents do quote HK$194–242 for the ferry and ¥300 for Tianmen, but
       for tickets nobody has bought, and this card answers "what am I already
       committed to". The ELEVENTH is the only one that moves the total. */
    'experiences','hk phil','festive cadenza','$88','hk$689',
    'jade dragon','macau ferry','lung king heen',
    /* $5,356 → $5,444, and the whole of that $88 is the concert: HK$689 at the
       trip's own 7.8. If this number ever moves again without a bed, a flight or
       a ticket actually being bought, an asking price has been promoted to a
       cost. */
    /* $5,562 → $6,402 ON 2026-08-13, AND THE WHOLE OF THAT $840 IS THE ACADEMY.
       This is the first time this total has moved for a reason that is not a
       purchase: nothing was bought, a price was finally put in writing. The
       exact arithmetic is $5,561.64 + $840.00 = $6,401.64, printed to the
       dollar. Every other figure on this card is unchanged, which is the half
       of the change worth guarding — the four documented fares, the ~$2,026
       Etihad line and the concert's $88 all still read what they read
       yesterday, and "Logged so far" did not move at all, because a price is
       not a payment. */
    /* $6,402 → $6,535 ON 2026-09-28: CA1560 $110.30 + the Muping night ¥164 ≈
       $22.94 = $6,534.88, printed to the dollar. Both were booked that morning;
       nothing else on this card moved. */
    /* → $6,061 ON 2026-10-17: Element ($232.95) and CA8609 ($241) are still
       booked but are the OR now — under "Or instead", outside the total — and
       the Meliá and MU394 that replace them are not booked and carry no price.
       → $6,101 THE SAME EVENING: the Hi Cozy hostel booked, ₪136.40 ≈ $40.12;
       Element cancelled (already outside the total, so it moved nothing).
       → $6,301: MU394 booked, $200.20; CA8609 cancelled (already outside). */
    'counted so far','$6,301',
    /* UNPRICED WENT 4 → 9 ON 2026-07-28, AND THE TOTAL DID NOT MOVE. That is
       the whole point of the change: the five rail legs became cards, and not
       one of them carries a priceNote. The documents do quote fares — ~¥90,
       ~$13, ~$35, ~$15, ~$60–70 — but for tickets nobody has bought, and this
       card answers "what am I already committed to". Five plans added to a
       committed total would be the invention. They ride as chips on their own
       cards instead and are counted here as what they are: nine rows with no
       price, the four Etihad legs that share one booking plus five unbought
       tickets. If $5,356 ever moves without a bed or a flight changing, a fare
       has been promoted to a cost.
       THEN 9 → 19 ON 2026-08-06, and again the priced total moved by exactly one
       item. The eleven experiences arrived and TEN of them are unbought, so the
       Travel group still says "9 not priced" (the four Etihad legs plus the five
       rail tickets), the Experiences group says "10 not priced", and the footer
       adds them up. The concert is the one that is priced, because it is the one
       that was paid for.
       THEN 9 → 11 ON 2026-08-12, and the total did not move again. The two ROAD
       legs — the gorge bus and the shared car out of it — became cards, and
       they follow the trains' rule exactly: the documents quote ¥65 entry and
       ~$25 for the car, but for journeys nobody has bought, so the figures ride
       as chips and neither reaches the committed total. 19 → 21.
       THEN 21 → 20 ON 2026-08-12, and the money did not move by a cent. The
       Nov 22 HSR fallback carries the alternative flag: it is the OTHER WAY of making
       a journey the CA8683 flight already makes, and only one of them will
       happen. It was being counted as an eleventh unpriced commitment on a
       trip that is committed to ten. It has its own uncounted group now.
       THEN 20 → 21 ON 2026-08-12, AND THE MONEY DID NOT MOVE A CENT. The Kunyu
       academy fortnight was written down as the stay it has been since its
       deposit was acknowledged, and it arrived with NO price: its rate had
       never been confirmed in writing, and an unconfirmed figure may not join a
       total. So the count of rows this card could not price went up by one and
       "Counted so far" stayed exactly $5,562 — which was the whole shape of
       that change.
       THEN 21 → 20 ON 2026-08-13, AND THIS TIME THE MONEY MOVED — by $840 and
       by nothing else. The school put the rate in writing ("you can pay 840 USD
       to stay for 12 days or two weeks"), so the one bed this card could not
       price became the twelfth bed it can. The two halves of that are checked
       separately and both matter: the count drops by exactly one, and the total
       rises by exactly the quoted figure. If the count drops without the total
       rising, a price was invented; if the total rises by more than $840, the
       $50 uniform or the $50 refundable room-keeping fee has been counted as
       what the bed costs, and neither is. */
    /* 20 → 21 on 2026-10-17: + the Meliá, + MU394 (both pending), − the Chongli train ·
       21 → 20 the same evening: the Meliá gave way to the booked, priced Hi Cozy ·
       20 → 19: MU394 booked at $200.20 */
    'of a $9,000 budget','19 items have no price yet',
    /* THE EITHER/OR LEG, shown and never added up. */
    'or instead','hsr fallback','only one of these will happen'];
  /* The superseded Four Points price, as a regression guard on the money card
     rather than only on the ticket. $289.68 is unambiguous: no other row on
     this trip carries it, and it is exactly what a reverted seed would print. */
  if(t.includes('289.68')) return 'FAIL the superseded Four Points price is back on the money card';
  const missing=want.filter(w=>!t.includes(w.toLowerCase()));
  if(missing.length) return 'FAIL missing: '+missing.join(', ');
  /* The per-group unpriced tallies, read off the group HEADERS. "10 not
     priced" became true of two groups at once when the alternative left the
     Travel tally, and a substring match can no longer tell them apart. */
  const glabels=[...document.querySelectorAll('.bk .glabel')].map(g=>g.innerText.replace(/\\s+/g,' ').trim());
  const row=(re)=>glabels.find(g=>re.test(g))||'';
  const travelRow=row(/^(flights|travel)\\b/i);
  const expRow=row(/^experiences\\b/i);
  const altRow=row(/^or instead\\b/i);
  const stayRow=row(/^stays\\b/i);
  /* THE STAYS GROUP GREW ITS FIRST UNPRICED ROW ON 2026-08-12 — exactly one,
     the academy — AND LOST IT AGAIN ON 2026-08-13, when the school put $840 in
     writing. Twelve beds, twelve figures, so the header must carry NO unpriced
     tally at all: the component only renders one when the count is non-zero, so
     "0 not priced" appearing here would itself be a bug. The check is kept and
     inverted rather than deleted — a bed that silently loses its price puts the
     tally straight back. */
  /* ONE unpriced bed for part of 2026-10-17 (the unbooked Meliá); none again
     since the Hi Cozy hostel was booked that evening, at ₪136.40. */
  if(/not priced/i.test(stayRow)) return 'FAIL the stays group is reporting an unpriced bed — tally: "'+stayRow+'"';
  if(!/^stays\\b/i.test(stayRow)) return 'FAIL no stays group on the money card';
  /* And the academy's own row carries the figure, in the place the money screen
     reads. A group total that is right while the row is blank would mean the
     $840 came from somewhere other than the bed. */
  const acRow=[...document.querySelectorAll('.bk .row')].map(r=>r.innerText.replace(/\\s+/g,' ').trim())
    .find(x=>/Kunyu Mountain Shaolin Kung Fu Academy/i.test(x));
  if(!acRow) return 'FAIL the academy has no row on the money card';
  if(!/\\$840/.test(acRow)) return 'FAIL the academy row shows no price: "'+acRow+'"';
  if(/price not recorded/i.test(acRow)) return 'FAIL the academy row still says its price is unrecorded: "'+acRow+'"';
  /* Nine Etihad-and-rail rows plus the two road legs — the alternative is no
     longer among them, and the flight it stands in for still is. */
  /* 10 → 9 on 2026-10-17: MU394 was booked at $200.20 the day it was planned */
  if(!/\\b9 not priced/i.test(travelRow)) return 'FAIL travel group tally: "'+travelRow+'"';
  if(!/10 not priced/i.test(expRow)) return 'FAIL experiences group tally: "'+expRow+'"';
  if(!altRow) return 'FAIL the either/or leg has no group of its own';
  /* 1 → 3 on 2026-10-17: the HSR fallback, and Element and CA8609 — booked, to undo ·
     3 → 1 the same day: both were cancelled, and a cancelled booking is no OR */
  if(!/\\b1\\b/.test(altRow)) return 'FAIL the alternatives group count: "'+altRow+'"';
  /* And it may never acquire an unpriced tally — it is outside every total. */
  if(/not priced/i.test(altRow)) return 'FAIL an uncounted group is reporting into the tally: "'+altRow+'"';
  return 'ok';
})()`, true);
rows.push([money === 'ok' ? 'PASS' : 'FAIL', 'Money · booked & committed card', String(money).slice(0, 70)]);

/* THE BUDGET CHIPS ARE ALSO THE CATEGORY FILTERS, and the right-hand column of
   them used to run off the screen: `1fr 1fr` is minmax(auto, 1fr), so
   un-wrappable labels blew each track out to ~228 px inside a 362 px box. With
   body { overflow-x: hidden } there was no way to scroll them back, so half
   the weekly budget answer and half the filters were unreachable. */
const chipsfit = await js(`(()=>{
  const grid=document.querySelector('.chips');
  if(!grid) return 'FAIL no budget chips on the Money segment';
  const chips=[...grid.children];
  if(chips.length<6) return 'FAIL only '+chips.length+' chips';
  const box=grid.getBoundingClientRect();
  const over=chips.filter(c=>{const r=c.getBoundingClientRect(); return r.right>box.right+1||r.right>window.innerWidth+1;});
  if(over.length) return 'FAIL '+over.length+' chip(s) run off the screen';
  if(grid.scrollWidth>grid.clientWidth+1){
    /* name the offender — "it is 14 px too wide" is not an actionable verdict */
    const wide=[...grid.querySelectorAll('*')].map(e=>[String(e.className).split(' ')[0]||e.tagName,Math.round(e.getBoundingClientRect().width),(e.textContent||'').trim().slice(0,14)])
      .sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x.join('=')).join(' ');
    return 'FAIL the chip grid is wider than its box: '+grid.scrollWidth+' > '+grid.clientWidth+' ['+wide+']';
  }
  /* TWO columns, still. One would be a stack; eight — which is what
     repeat(auto-fit, minmax(0,1fr)) actually produces on this phone — trades
     off-screen chips for 38 px ones, which is not a fix. */
  const cols=new Set(chips.map(c=>Math.round(c.getBoundingClientRect().left)));
  if(cols.size!==2) return 'FAIL the chips laid out in '+cols.size+' column(s), expected 2';
  const narrow=chips.filter(c=>c.getBoundingClientRect().width<120);
  if(narrow.length) return 'FAIL '+narrow.length+' chip(s) squeezed under 120 px';
  /* and every one of them is a tappable filter */
  const small=chips.filter(c=>c.getBoundingClientRect().height<44);
  if(small.length) return 'FAIL '+small.length+' chip(s) under 44 px';
  return 'ok '+chips.length+' chips · '+cols.size+' columns, all on screen';
})()`);
rows.push([String(chipsfit).startsWith('ok') ? 'PASS' : 'FAIL', 'Money · every budget chip is on screen', String(chipsfit).slice(3, 120)]);

/* a row of that card opens the real ticket — in Horizon, the booking's pass */
const jump = await js(`(async()=>{
  /* the ledger closes itself when the screen is re-entered — open it again */
  const bk=document.querySelector('details.bk');
  if(bk && !bk.open){ bk.querySelector('summary').click(); await new Promise(r=>setTimeout(r,400)); }
  const row=[...document.querySelectorAll('.bk .what')].find(b=>/Four Points by Sheraton/.test(b.textContent));
  if(!row) return 'FAIL no row';
  row.click(); await new Promise(r=>setTimeout(r,900));
  if(!/\\/pocket\\/cn26-stay-00$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  const card=document.getElementById('bk-cn26-stay-00');
  if(!card) return 'FAIL the pass did not draw';
  return /Four Points/.test(card.innerText) ? 'ok' : 'FAIL the pass is not the Four Points bed';
})()`, true);
rows.push([jump === 'ok' ? 'PASS' : 'FAIL', 'Money row opens its own ticket', String(jump).slice(0, 40)]);

/* the tracker starts from what was already paid, not from zero — and LODGING
   STOPPED BEING $0 on 2026-07-27. EIGHT of the ten booked beds still cost
   nothing yet, because a booking is not a payment: Four Points' live order
   states no payment mode at all, Blossom House never said which it was, Element
   is due at the property, Pullman is charged on 8 Dec, Huatian, Glenview and
   Dali state nothing, and the Royal Garden took US$0 online. TWO are exceptions
   and the difference is tense. Yue Tu's terms charge a prepayment of the first
   night AT RESERVATION, ¥428.65 of ¥857.30, ≈$60 at the trip's own rate; the
   ibis Kunming order is stamped "Prepay Online ✓ Paid" for the whole US$25.73,
   already in the home currency. $59.95 + $25.73 = $85.68, shown as $86 — and
   the total spent goes $2,949.95 → $2,975.68, shown as $2,976. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/money` });
await wait(2200);
const prepaid = await js(`(async()=>{
  await new Promise(r=>setTimeout(r,300));
  const t=document.body.innerText.replace(/\\s+/g,' ');
  const chip=(label)=>{ const m=t.match(new RegExp(label+'\\\\s+(\\\\$[0-9,]+)','i')); return m?m[1]:'?'; };
  /* LODGING $86 -> $1,318 and TOTAL $2,976 -> $4,208 on 2026-08-01: The Royal
     Garden was paid in full, US$1,232.01, to answer a credit-card ultimatum —
     93% of all lodging money spent, in one line, and it took the trip's last
     cancellation window with it.
     Then +$88 on 2026-08-06: the HK Phil concert, HK$689 at 7.8 — the trip's
     first ticket, and the first thing it has bought purely to enjoy. It is the
     WHOLE of the Tickets+shows line, and it must stay the whole of it: ten more
     experiences became cards on the same day and not one of them has been paid
     for, so a Tickets figure above $88 means something pending has been counted
     as spent. */
  /* LODGING $1,562 -> $1,862 and TOTAL $4,806 -> $5,106 on 2026-09-27: Blossom
     House had been prepaid in full ($299.56 — Google Pay + a $52.96 gift card)
     since 27 Jul, and only its Trip.com confirmation email said so. The Four
     Points correction a second time; no money moved that day. */
  /* TRAINS+FLIGHTS $881 -> $992 and TOTAL $5,106 -> $5,216 on 2026-09-28:
     CA1560, $110.30, paid on Trip.com. The Muping night booked the same
     morning is pay-at-hotel and moves LODGING by nothing. */
  /* LODGING $1,862 -> $1,902 and TOTAL $5,216 -> $5,256 on 2026-10-17: the
     Hi Cozy hostel, ₪136.40 prepaid online ≈ $40.12 at the trip's ILS 3.4. */
  /* TRAINS+FLIGHTS $992 -> $972 and TOTAL $5,256 -> $5,236, later on
     2026-10-17: + MU394 $200.20, and CA8609 $241 -> the $20.80 fee kept
     (cancelled, $220.20 refunded). */
  const want={"INT'L FLIGHTS":'$2,026','TRAINS\\\\+FLIGHTS':'$972','KUNYU TRAINING':'$100','LODGING':'$1,902','TICKETS\\\\+SHOWS':'$88','TOTAL SPENT':'$5,236'};
  const bad=Object.entries(want).filter(([k,v])=>chip(k)!==v).map(([k])=>k+'='+chip(k));
  return bad.length ? 'FAIL '+bad.join(' ') : 'ok';
})()`, true);
rows.push([prepaid === 'ok' ? 'PASS' : 'FAIL', 'Money · prepaid already counted', String(prepaid).slice(0, 60)]);

/* place cards carry map buttons, and the maps hint card explains Amap — the
   driver cards and the hint moved from Info to the Pocket's driver list */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/driver` });
await wait(2200);
const infomaps = await js(`(()=>{
  const t=document.body.innerText.toLowerCase();
  const groups=[...document.querySelectorAll('.zhlist .maps')];
  const pairs=groups.filter(g=>g.querySelectorAll('button').length!==1).length;
  const ok=t.includes('maps in china') && t.includes('高德地图') && groups.length>=17 && pairs===0;
  return ok ? 'ok '+groups.length+' cards, 1 button each' : 'FAIL hint/'+groups.length+'/'+pairs;
})()`);
rows.push([String(infomaps).startsWith('ok') ? 'PASS' : 'FAIL', 'Pocket · one map button per driver card', String(infomaps).slice(0, 40)]);

/* THE ACADEMY'S DRIVER CARD, new 2026-08-13 — and it is the school's own text,
   not this app's. For three weeks card cn26-place-00 read "⏳ pending — ask the
   academy", because nobody had said where the school was. The school then sent
   a taxi card: navigate to 昆嵛山武校, use the meter, take the normal route, give
   a receipt, because a previous driver went a long way round. The protective
   clauses are checked individually — a card trimmed to its destination would
   look right and would have thrown away the reason the school wrote it.
   AND IT STILL SHOWS NO MAP BUTTON. Neither 昆嵛山武校 nor the website's longer
   昆嵛山少林武术学校 has been through verify:places, and a conservation district
   is an area rather than a door. The answer arriving did not earn a pin. */
const driverKunyu = await js(`(()=>{
  const rows=[...document.querySelectorAll('.zhlist li')];
  const li=rows.find(r=>r.textContent.includes('昆嵛山武校'));
  if(!li) return 'FAIL the academy driver card is not on the Key info page';
  const t=li.innerText;
  if(!t.includes('师傅您好')) return 'FAIL the card does not open in the school own words';
  if(!t.includes('打表')) return 'FAIL the "use the meter" instruction was trimmed';
  if(!t.includes('发票')) return 'FAIL the "give a receipt" instruction was trimmed';
  if(!/Kunyu Mountain Martial Arts School/i.test(t)) return 'FAIL their English rendering is missing';
  /* Pending is a STATE, not a word — the note is allowed to say the card spent
     three weeks as a placeholder, and it does. What must be gone is the
     placeholder itself: the dimmed .pend Chinese, the disabled row, and the
     missing copy button that made it untappable. This is a driver card now. */
  if(li.querySelector('.zh.pend')) return 'FAIL the Chinese is still drawn as a pending placeholder';
  if(li.querySelector('button.txt[disabled]')) return 'FAIL the card cannot be opened full screen for a driver';
  if(!li.querySelector('button.rowbtn')) return 'FAIL the card cannot be copied';
  if(li.querySelector('.maps button')) return 'FAIL an unverified school name grew a map button';
  return 'ok the school own taxi card, no button';
})()`);
rows.push([String(driverKunyu).startsWith('ok') ? 'PASS' : 'FAIL', 'Pocket · the academy driver card, and no pin', String(driverKunyu).slice(0, 60)]);

/* THE JOURNEY'S ROWS CARRY THE SAME CHIPS as the map above them rings — one
   derivation (logic/coverage.ts, through routecheck.ts) so the diagram and the
   list cannot disagree about what is held. The invariant is asserted rather
   than a count: whatever the owner books next, the number of ringed stations
   must keep matching the number of stop rows that are not green. Horizon Run 3:
   the rows are the route check's stop rows and the map is Replay's, resting on
   today. Since 2026-09-28 no stop row on the real trip is short of anything,
   so the two sides agree at zero and the map's own label says all booked; the
   invariant with a ring in it (Kunyu, amber) is walked on the pre-28 Sep trip
   above. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey` });
await wait(2200);
const infocover = await js(`(()=>{
  const rows=[...document.querySelectorAll('li.ck-stop')];
  if(rows.length!==10) return 'FAIL '+rows.length+' journey rows, expected 10';
  const chips=rows.map(r=>r.querySelector('.ck-main > .chip'));
  if(chips.some(c=>!c)) return 'FAIL a journey row carries no chip';
  const textOf=(r)=>((r.querySelector('.ck-nm')||{}).textContent||'')+' :: '+r.querySelector('.ck-main > .chip').textContent;
  /* The Yantai row carried "bed missing" until the Muping night and CA1560 were booked on 2026-09-28. */
  const kunyuRow=rows.find(r=>/Kunyu/.test(textOf(r)));
  if(!kunyuRow||/missing/i.test(textOf(kunyuRow))||!kunyuRow.querySelector('.ck-main > .chip.ok')) return 'FAIL the Kunyu row is not booked since 28 Sep: '+(kunyuRow?textOf(kunyuRow):'none');
  const hkRow=rows.find(r=>/Hong Kong/.test(textOf(r)));
  if(!hkRow||!/booked/i.test(textOf(hkRow))||!hkRow.querySelector('.ck-main > .chip.ok')) return 'FAIL the Hong Kong row is not booked: '+(hkRow?textOf(hkRow):'none');
  /* HORIZON RUN 2: the diagram is the constellation (lib/map) — each stop at
     its real coordinates — and a stop not fully booked wears Relay's ring. */
  const svg=document.querySelector('.rp-map svg.tmap');
  if(!svg) return 'FAIL the Journey has no route map';
  const flagged=svg.querySelectorAll('circle.flag').length;
  /* FOR PART OF 2026-10-17 ONE ROW WAS AMBER: Shanghai, its bed (the Meliá)
     not booked. The Hi Cozy hostel was booked that evening, so the row is
     green and booked — and it still has no coordinate, so no star. */
  const sh=rows.find(r=>r.dataset.stop==='cn26-stop-shanghai');
  if(!sh||sh.dataset.tone!=='ok'||!/booked/i.test(textOf(sh))) return 'FAIL the Shanghai row is not green and booked: '+(sh?textOf(sh):'none');
  const amber=rows.filter(r=>r.dataset.tone!=='ok').length;
  if(flagged!==amber) return 'FAIL the map rings '+flagged+' stations and the rows flag '+amber;
  const aria=document.querySelector('.rp-map')?.getAttribute('aria-label')||'';
  if(svg.querySelector('circle.flag[data-stop="cn26-stop-kunyu"]')) return 'FAIL Kunyu is fully booked since 28 Sep and still ringed';
  const labels=[...svg.querySelectorAll('text')].map(t=>t.textContent).join('|');
  if(!/HONG KONG/.test(labels)) return 'FAIL Hong Kong is not on the map';
  if(svg.querySelector('circle.flag[data-stop="cn26-stop-hongkong"]')) return 'FAIL Hong Kong is fully booked and still ringed';
  if(svg.querySelectorAll('.here-dot, .done-dot, .ahead-dot').length!==9) return 'FAIL the map does not place the nine located stops (Shanghai has no coordinate)';
  /* each stop row opens its city */
  const doors=rows.map(r=>r.querySelector('a.ck-main')?.getAttribute('href')||'');
  if(doors.some((h,i)=>h!=='#/trip/cn26/journey/'+rows[i].dataset.stop)) return 'FAIL a stop row does not open its city';
  return 'ok 10 rows, '+flagged+' ringed, Shanghai booked with no star';
})()`);
rows.push([String(infocover).startsWith('ok') ? 'PASS' : 'FAIL', 'Journey · rows + ringed stations', String(infocover).slice(3, 56)]);

/* REPLAY THE TRIP (f-journey, Horizon Run 3). The trip's map for any day of
   it: the playhead rests on today; ‹ › step a day and the scrubber drags
   through all thirty-seven; the map is always the playhead's own day (the road
   so far inked, the stops behind you done); PLAY walks the days and, on a day
   a leg is walked, a COMET flies it and paints it behind itself; "Back to
   today" comes home. Under it the visa window, read from counters.ts — on Dec
   11 it is day 19 of 30, and the exit it must be out by is ticked. Walked on
   Dec 11, the Pudong flight day (the Daxing flight until 2026-10-17), which is
   a move: Shanghai + Disneyland → Zhangjiajie. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/journey` });
await wait(2200);
const replay = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const wl=()=>((document.querySelector('.rp-wl')||{}).textContent||'').trim();
  const wh=()=>((document.querySelector('.rp-wh')||{}).textContent||'').trim();
  const done=()=>document.querySelectorAll('.rp-map svg.tmap .done-dot').length;
  if(!/11 Dec/.test(wl())||!/day 21 of 37/.test(wl())) return 'FAIL the playhead does not rest on today: '+wl();
  /* Chongli → Zhangjiajie until 2026-10-17 (skiing dropped) */
  if(!/Shanghai \\+ Disneyland.*Zhangjiajie/.test(wh())) return 'FAIL Dec 11 does not read as the move Shanghai to Zhangjiajie: '+wh();
  const v=document.querySelector('a.rp-visa');
  if(!v) return 'FAIL no visa bar under the scrubber';
  const vv=(v.querySelector('.vval')||{}).textContent?.trim(), ve=(v.querySelector('.vexit')||{}).textContent?.trim();
  if(vv!=='19 / 30') return 'FAIL the visa reads '+vv+' on Dec 11, expected 19 / 30';
  if(ve!=='Exit by 22 Dec') return 'FAIL the exit reads '+ve;
  if(!/^#\\/trip\\/cn26\\/pocket\\/visa$/.test(v.getAttribute('href')||'')) return 'FAIL the visa bar does not open the visa';
  const vbar=document.querySelector('.rp-track .vbar');
  if(!vbar||vbar.style.getPropertyValue('--tick').trim()!=='1') return 'FAIL the visa window has no exit tick';
  const today=done();
  /* › steps one day, and the way back to today is named */
  document.querySelector('.rp-ctl button[aria-label="Next day"]').click(); await sleep(400);
  if(!/12 Dec/.test(wl())||!/day 22 of 37/.test(wl())) return 'FAIL › did not step the day: '+wl();
  if(!document.querySelector('.jback')) return 'FAIL no way back to today';
  /* the scrubber drags to any day, and the map and the visa go with it */
  const r=document.querySelector('input.rp-range');
  if(!r) return 'FAIL no scrubber';
  r.value='0'; r.dispatchEvent(new Event('input',{bubbles:true})); await sleep(350);
  if(!/day 1 of 37/.test(wl())||!/Flights in/.test(wh())) return 'FAIL day 1 reads '+wl()+' / '+wh();
  if(done()!==0) return 'FAIL on day 1 the map already has '+done()+' stops behind you';
  const v1=(document.querySelector('a.rp-visa .vval')||{}).textContent?.trim()||'';
  if(!/starts/.test(v1)) return 'FAIL on day 1 the visa reads '+v1;
  r.value='36'; r.dispatchEvent(new Event('input',{bubbles:true})); await sleep(350);
  if(!/day 37 of 37/.test(wl())) return 'FAIL the scrubber does not reach the last day: '+wl();
  if(!(done()>today)) return 'FAIL the road so far did not grow from Dec 11 ('+today+') to the last day ('+done()+')';
  /* PLAY: from day 1 — the playhead walks, and a comet flies a leg and paints it */
  const play=document.querySelector('.rp-play');
  play.click(); await sleep(150);
  if(!/pause/i.test(play.getAttribute('aria-label')||'')) return 'FAIL Play did not start';
  const seen=new Set(); let comet=false, ink=false;
  for(let i=0;i<70&&!(comet&&ink&&seen.size>4);i++){
    await sleep(100); seen.add(wl());
    if(document.querySelector('.rp-map .comet')) comet=true;
    if(document.querySelector('.rp-map .comet .comet-ink')) ink=true;
  }
  play.click(); await sleep(250);
  if(/pause/i.test(play.getAttribute('aria-label')||'')) return 'FAIL Pause did not stop it';
  if(seen.size<4) return 'FAIL the playhead did not walk ('+seen.size+' days seen)';
  if(!comet||!ink) return 'FAIL no comet flew and painted a leg while playing (comet '+comet+', ink '+ink+')';
  const paused=wl();
  await sleep(500);
  if(wl()!==paused) return 'FAIL the replay kept going after Pause';
  document.querySelector('.jback').click(); await sleep(450);
  if(!/11 Dec/.test(wl())) return 'FAIL Back to today did not come home: '+wl();
  if(document.querySelector('.jback')) return 'FAIL Back to today is still offered on today';
  return 'ok visa '+vv+' · '+ve+' · played '+seen.size+' days, comet painted';
})()`, true);
rows.push([String(replay).startsWith('ok') ? 'PASS' : 'FAIL', 'Replay · today, step, scrub, play, visa window', String(replay).slice(3, 60)]);

/* A CITY (f-city, Horizon Run 3): journey/:stopId. The stop at its real
   positions — a pin ONLY where the trip file stores a coordinate, and every
   place without one named under the map ("No pin yet"), never pinned where it
   might be: Zhangjiajie's park spots and its West station have no coordinate.
   The way on points out of the map, amber while it is not booked. The stay
   replays itself (a comet per hop); the half-height sheet opens the guide,
   and Android back closes it again. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey/cn26-stop-zhangjiajie` });
await wait(2400);
const city = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  if(!document.querySelector('main.city')) return 'FAIL the stop does not open its city';
  if(!document.querySelector('.ct-map svg.tmap')) return 'FAIL the city has no map';
  const pins=[...document.querySelectorAll('.ct-lbl')].map(l=>l.textContent).join('|');
  for(const want of ['武陵源','张家界荷花国际机场','天门山']) if(!pins.includes(want)) return 'FAIL no pin named '+want+' — pins: '+pins.slice(0,60);
  if(/张家界西|Zhangjiajie West/i.test(pins)) return 'FAIL Zhangjiajie West is pinned and has no coordinate';
  if(!/DYG airport/.test(pins)) return 'FAIL the airport is not named by its code, as the board draws it';
  /* the words are laid out so none covers another, or the way on */
  const boxes=[...document.querySelectorAll('.ct-lbl, .ct-exit')].map(e=>e.getBoundingClientRect());
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i], b=boxes[j];
    if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1) return 'FAIL two of the map\\u2019s labels overlap';
  }
  /* and none sits under the guide sheet that laps the map's foot */
  const sheetTop=document.querySelector('.ct-sheet').getBoundingClientRect().top;
  if(boxes.some(b=>b.bottom>sheetTop+1)) return 'FAIL a label runs under the guide sheet';
  const np=((document.querySelector('.ct-nopin')||{}).textContent||'').replace(/\\s+/g,' ');
  if(!/No pin yet/.test(np)) return 'FAIL nothing is listed as unpinned';
  if(!/Yuanjiajie/.test(np)) return 'FAIL Yuanjiajie is not named under No pin yet: '+np.slice(0,60);
  const ex=((document.querySelector('.ct-exit')||{}).textContent||'').replace(/\\s+/g,' ');
  if(!/Mon 14/.test(ex)||!/Not booked/i.test(ex)) return 'FAIL the way on reads "'+ex.slice(0,60)+'"';
  const seg=[...document.querySelectorAll('.ct-seg a')];
  if(seg.length!==3||seg[2].getAttribute('aria-current')!=='page') return 'FAIL the scale switch is not Trip · Today · City';
  const chips=[...document.querySelectorAll('.ct-chip')];
  if(chips.length<5) return 'FAIL '+chips.length+' chapter chips on the sheet';
  /* the stay replays itself on request: a comet at a time, and then none */
  const rp=document.querySelector('.ct-replay');
  if(!rp||rp.disabled) return 'FAIL no replay for the stay';
  rp.click();
  let flew=false;
  for(let i=0;i<20&&!flew;i++){ await sleep(50); flew=!!document.querySelector('.ct-map .comet'); }
  if(!flew) return 'FAIL the stay did not replay';
  if(document.querySelectorAll('.ct-map .comet').length>1) return 'FAIL two comets at once';
  let gone=false;
  for(let i=0;i<120&&!gone;i++){ await sleep(100); gone=!document.querySelector('.ct-map .comet'); }
  if(!gone) return 'FAIL the stay replay never landed';
  /* Read the guide — and Android back closes it, back onto the map */
  const read=document.querySelector('a.ct-read');
  if(!read||!/Read the guide/.test(read.textContent)) return 'FAIL no Read the guide';
  read.click(); await sleep(1200);
  if(!/cn26-stop-zhangjiajie\\/guide$/.test(location.hash)||!document.querySelector('main.guide')) return 'FAIL Read the guide landed on '+location.hash;
  if(document.querySelector('.navbar')) return 'FAIL the nav bar stays over the long read';
  history.back(); await sleep(1200);
  if(!/cn26-stop-zhangjiajie$/.test(location.hash)||!document.querySelector('main.city')) return 'FAIL back did not close the guide: '+location.hash;
  return 'ok 3 pins named, West unpinned, exit Mon 14 not booked, guide opens + closes';
})()`, true);
rows.push([String(city).startsWith('ok') ? 'PASS' : 'FAIL', 'City · pins, no pin yet, the way on, the guide', String(city).slice(3, 60)]);

/* RUN 3b — A PIN'S LINE SAYS WHOSE STATUS IT IS. The park gate holds its
   driver card and the PENDING park pass; on the night the booked, paid
   Pullman is the bed, the gate read "Sat 12 · Pending" — as if the stay
   were. The line now names its booking ("ticket pending"), the Pullman —
   which has no coordinate — is no pin's line, and the guide still shows it
   Booked. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/journey/cn26-stop-zhangjiajie` });
await wait(2400);
const pinLine = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const lbls=[...document.querySelectorAll('.ct-lbl')];
  const gate=lbls.find(l=>/武陵源/.test(l.textContent));
  if(!gate) return 'FAIL no Wulingyuan pin on Dec 11';
  const line=(gate.querySelector('.warn, .ok')?.innerText||'').replace(/\\s+/g,' ').trim();
  if(line!=='Sat 12 ticket pending') return 'FAIL the gate line reads "'+line+'"';
  if(!gate.querySelector('.warn')) return 'FAIL the pending ticket is not amber';
  if(/stay|Pullman/i.test(lbls.map(l=>l.textContent).join('|'))) return 'FAIL a stay speaks from a pin';
  const tm=lbls.find(l=>/天门山/.test(l.textContent));
  if(!/Mon 14 · 08:00 ticket pending/.test((tm?.querySelector('.warn')?.innerText||'').replace(/\\s+/g,' '))) return 'FAIL the Tianmen line lost its words';
  document.querySelector('a.ct-read').click(); await sleep(1400);
  const booked=document.getElementById('g-booked');
  const pull=[...(booked?booked.querySelectorAll('.gd-item'):[])].find(a=>/Pullman Zhangjiajie/.test(a.textContent));
  if(!pull) return 'FAIL the Pullman is not in the Booked chapter';
  if(!/Booked/.test(pull.querySelector('.chip')?.textContent||'')) return 'FAIL the Pullman does not read Booked';
  history.back(); await sleep(1000);
  return 'ok gate: '+line+' · Pullman Booked in the guide';
})()`, true);
rows.push([String(pinLine).startsWith('ok') ? 'PASS' : 'FAIL', 'City · the gate’s line is its own ticket’s', String(pinLine).slice(3, 60)]);

/* ---------------------------------------------------------------------
   RUN 3c — the code review's fixes, each walked where it shows.
   --------------------------------------------------------------------- */

/* BACK TO TODAY WHILE PLAYING. It did nothing: the next animation frame put
   the playhead back. Play, Back to today, and the replay must be home and
   stopped. And the Play button now says what a press will do — Resume after
   a pause, "Play from <day>" after a step. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/journey` });
await wait(2200);
const homeWhilePlaying = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const wl=()=>((document.querySelector('.rp-wl')||{}).textContent||'').trim();
  const play=document.querySelector('.rp-play');
  const name=()=>play.getAttribute('aria-label')||'';
  if(!play) return 'FAIL no Play';
  if(!/^Replay my trip from 21 Nov$/.test(name())) return 'FAIL Play is named '+name();
  play.click(); await sleep(450);
  if(!/pause/i.test(name())) return 'FAIL Play did not start';
  const back=document.querySelector('.jback');
  if(!back) return 'FAIL no Back to today while playing';
  back.click(); await sleep(800);
  if(/pause/i.test(name())) return 'FAIL still playing after Back to today';
  if(!/11 Dec/.test(wl())||!/day 21 of 37/.test(wl())) return 'FAIL Back to today did not come home: '+wl();
  if(document.querySelector('.jback')) return 'FAIL Back to today is still offered on today';
  play.click(); await sleep(350); play.click(); await sleep(150);
  if(!/^Resume/.test(name())) return 'FAIL after a pause Play is named '+name();
  document.querySelector('.rp-ctl button[aria-label="Next day"]').click(); await sleep(250);
  const stepped=name();
  if(!/^Play from \\d+ \\w+$/.test(stepped)) return 'FAIL after a step Play is named '+stepped;
  document.querySelector('.jback').click(); await sleep(300);
  return 'ok home and stopped · then '+stepped;
})()`, true);
rows.push([String(homeWhilePlaying).startsWith('ok') ? 'PASS' : 'FAIL', 'Replay · Back to today while playing', String(homeWhilePlaying).slice(3, 60)]);

/* THE RINGS RIGHT AFTER PLAY. They left the map while Play ran and were
   drawn again after it — replaying their sweep delays, so amber and red
   stayed dark for seconds. They now stay, hidden, and are lit the moment
   Play stops. (Waits for the sweep that runs when Journey opens.)
   SINCE 2026-09-28 THE REAL TRIP RINGS NO STOP AT ALL — every bed is booked,
   and a ring is a stop short of a bed — so the rings are walked on the trip
   as it stood before 28 Sep, as the route check's block does: the Muping
   night and CA1560 set aside, a reload, Kunyu's missing bed ringed amber on
   Dec 11, then both put back. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/journey` });
await wait(1200);
const heldForRings = await js(SET_ASIDE_28_SEP, true);
let ringsAfterPlay = 'FAIL the bookings of 28 Sep could not be set aside: ' + String(heldForRings).slice(0, 30);
let ringsBack = 'not needed';
if (String(heldForRings).startsWith('[')) {
  await js(`window.__beforeReload = true`);
  await S('Page.reload', {});
  for (let i = 0; i < 40; i++) {
    await wait(300);
    if ((await js(`!window.__beforeReload&&document.readyState==='complete'&&!!document.querySelector('.rp-map svg.tmap')`)) === true) break;
  }
  ringsAfterPlay = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const rings=()=>[...document.querySelectorAll('.rp-map svg.tmap circle.flag')];
  const total=parseFloat(getComputedStyle(document.querySelector('.ck-sum')).getPropertyValue('--rd'))||0;
  await sleep(Math.min(total,9000)+600);
  const before=rings();
  if(!before.length) return 'FAIL no ringed stop on Dec 11';
  const lit=(els)=>els.every(c=>getComputedStyle(c).visibility!=='hidden'&&Number(getComputedStyle(c).opacity)>0.95);
  if(!lit(before)) return 'FAIL the rings are not lit once the sweep is over';
  const play=document.querySelector('.rp-play');
  play.click(); await sleep(600);
  const during=rings();
  if(during.length!==before.length) return 'FAIL the rings left the map while playing ('+during.length+' of '+before.length+')';
  if(!during.every(c=>getComputedStyle(c).visibility==='hidden')) return 'FAIL the rings show while Play runs';
  play.click(); await sleep(120);
  const after=rings();
  if(after.length!==before.length||!after.every((c,i)=>c===before[i])) return 'FAIL the rings were drawn again after Play';
  if(!lit(after)) return 'FAIL right after Play the rings are dark';
  document.querySelector('.jback')?.click(); await sleep(200);
  return 'ok '+before.length+' ring(s) stay and are lit at once';
})()`, true);
  ringsBack = await js(putBack28Sep(heldForRings), true);
}
{
  const ok = String(ringsAfterPlay).startsWith('ok') && ringsBack === 'ok';
  rows.push([ok ? 'PASS' : 'FAIL', 'Replay · the rings right after Play',
    ok ? ('pre-28 Sep trip · ' + String(ringsAfterPlay).slice(3)).slice(0, 60) : (String(ringsAfterPlay).slice(0, 40) + ' / put back: ' + String(ringsBack)).slice(0, 60)]);
}

/* A CHIP OPENS ITS CHAPTER. The city's chips and "+N" handed the guide its
   chapter before the view changed, and the city took it and scrolled on a
   160 ms timer. The guide now takes it, and scrolls once it is drawn. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-12#/trip/cn26/journey/cn26-stop-zhangjiajie` });
await wait(2200);
const chipLands = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const near=(id)=>{ const el=document.getElementById(id); if(!el) return 'missing'; const t=el.getBoundingClientRect().top; return t>-8&&t<90 ? 'ok' : Math.round(t)+' px'; };
  const chip=[...document.querySelectorAll('.ct-chips .ct-chip')].find(c=>/Booked/.test(c.textContent));
  if(!chip) return 'FAIL no Booked chip on the city';
  chip.click(); await sleep(900);
  if(!/cn26-stop-zhangjiajie\\/guide$/.test(location.hash)) return 'FAIL the chip did not open the guide: '+location.hash;
  if(near('g-booked')!=='ok') return 'FAIL the guide did not open at Booked ('+near('g-booked')+')';
  history.back(); await sleep(1100);
  if(!document.querySelector('main.city')) return 'FAIL back did not come to the city';
  const more=document.querySelector('.ct-npc.more');
  if(!more) return 'FAIL no +N under No pin yet';
  more.click(); await sleep(900);
  if(near('g-eat')!=='ok') return 'FAIL +N did not open the guide at Places ('+near('g-eat')+')';
  return 'ok Booked and +N each land on their chapter';
})()`, true);
rows.push([String(chipLands).startsWith('ok') ? 'PASS' : 'FAIL', 'City · a chip opens the guide at its chapter', String(chipLands).slice(3, 60)]);

/* NEVER "PRICE NOT RECORDED" FOR A PRICE THE FILE HAS. EY 871's fare is part
   of the flights in and home, recorded on the International Flights stop
   (Money counts it); the Hong Kong guide said "price not recorded" beside
   it. A flight with no fare of its own now shows no price line. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey/cn26-stop-hongkong/guide` });
await wait(2200);
const hkFare = await js(`(()=>{
  const booked=document.getElementById('g-booked');
  if(!booked) return 'FAIL no Booked chapter in the Hong Kong guide';
  const items=[...booked.querySelectorAll('.gd-item')];
  const ey=items.find(a=>/EY 871/.test(a.textContent));
  if(!ey) return 'FAIL EY 871 is not in the Booked chapter';
  if(ey.querySelector('.gd-price')) return 'FAIL EY 871 carries a price line: '+ey.querySelector('.gd-price').textContent;
  if(/price not recorded/i.test(booked.textContent)) return 'FAIL the Booked chapter says price not recorded';
  const mu=items.find(a=>/MU 733/.test(a.textContent));
  if(!/[$]293/.test((mu&&mu.querySelector('.gd-price')||{}).textContent||'')) return 'FAIL MU 733 lost its own fare';
  const close=document.querySelector('.gd-close');
  if(!/go back to the map$/.test(close.getAttribute('aria-label')||'')) return 'FAIL opened cold, the close button says '+close.getAttribute('aria-label');
  return 'ok EY 871 no price line · MU 733 $293';
})()`);
rows.push([String(hkFare).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · Hong Kong, no false "price not recorded"', String(hkFare).slice(3, 60)]);

/* A NOT NAMES A PLACE, WHOLE. The metro line lifted one word after a
   capital NOT ("NOT Beijing South" → "NOT Beijing") and would have lifted a
   shouted status ("NOT BOOKED"). Every warning on the travel days is a
   Title-case name, and Dec 11's is "NOT Hongqiao" since 2026-10-17 (it was
   "NOT Capital" while Dec 11 left from Daxing). */
const warnDays = [];
for (const d of ['2026-12-05', '2026-12-09', '2026-12-11', '2026-12-14', '2026-12-16', '2026-12-20', '2026-12-21']) {
  await S('Page.navigate', { url: `${BASE}?d=${d}#/trip/cn26/now/day` });
  await wait(1800);
  warnDays.push([d, String(await js(`[...document.querySelectorAll('.m-warn')].map(b=>b.textContent.trim()).join('|')`))]);
}
const badWarn = warnDays.flatMap(([d, w]) => (w ? w.split('|') : []).filter((x) => !/^NOT \p{Lu}\p{Ll}[\p{L}-]*(?: \p{Lu}\p{Ll}[\p{L}-]*)*$/u.test(x)).map((x) => `${d} ${x}`));
const dec11Warn = warnDays.find(([d]) => d === '2026-12-11')?.[1] ?? '';
rows.push([badWarn.length === 0 && dec11Warn.split('|').includes('NOT Hongqiao') ? 'PASS' : 'FAIL', 'Travel days · every NOT names a place, whole',
  badWarn.length ? `not a name: ${badWarn.join(', ').slice(0, 50)}` : dec11Warn.split('|').includes('NOT Hongqiao') ? '' : `Dec 11 reads "${dec11Warn}"`]);

/* THE CITY UNDER CALM MOTION. The ↻ replay stayed and did nothing; the
   guide's way back up still glided. Under Calm motion nothing moves, the ↻
   is not offered, the city is still whole — and read out to a screen
   reader, pins and the way on included (the map was one image). */
const flipCalm = async () => {
  await S('Page.navigate', { url: `${BASE}#/settings` });
  await wait(2000);
  /* Settings loads lazily: wait for its row, flip it, and wait for <html> to follow */
  return js(`(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    let row=null;
    for(let i=0;i<30&&!row;i++){ row=[...document.querySelectorAll('label.row')].find(l=>/Calm motion/.test(l.textContent)); if(!row) await sleep(100); }
    if(!row) return 'no row';
    const was=document.documentElement.classList.contains('calm');
    row.querySelector('input').click();
    for(let i=0;i<30&&document.documentElement.classList.contains('calm')===was;i++) await sleep(100);
    return 'ok';
  })()`, true);
};
await flipCalm();
await S('Page.navigate', { url: `${BASE}?d=2026-12-12#/trip/cn26/journey/cn26-stop-zhangjiajie` });
await wait(2400);
const cityCalm = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  if(!document.documentElement.classList.contains('calm')) return 'FAIL Calm motion is not on';
  if(!document.querySelector('main.city .ct-map svg.tmap')) return 'FAIL no city map under Calm motion';
  if(document.querySelector('.ct-replay')) return 'FAIL the replay is offered where nothing may move';
  if(document.querySelector('.ct-map .comet')) return 'FAIL a comet flies under Calm motion';
  const f=document.querySelector('.ct-map .fl-line');
  if(f&&getComputedStyle(f).animationName!=='none') return 'FAIL the live hop still flows';
  const labels=document.querySelectorAll('.ct-lbl').length;
  if(labels<3) return 'FAIL only '+labels+' pin labels';
  if(document.querySelector('.ct-map[role="img"]')) return 'FAIL the map is still one image to a screen reader';
  const list=document.querySelector('main.city ul.sr-only');
  const said=list?list.textContent:'';
  if(!/ticket pending/.test(said)||!/The way on, Mon 14: Not booked/.test(said)) return 'FAIL the map is not read out: '+said.slice(0,60);
  location.hash='#/trip/cn26/journey/cn26-stop-zhangjiajie/guide'; await sleep(1200);
  window.scrollTo(0,3000); await sleep(200);
  document.querySelector('.totop').click(); await sleep(60);
  if(window.scrollY>2) return 'FAIL back to the top glides under Calm motion ('+Math.round(window.scrollY)+' px after 60 ms)';
  return 'ok no replay, nothing moves, '+labels+' labels, the map read out';
})()`, true);
await flipCalm();
const calmOff = await js(`document.documentElement.classList.contains('calm') ? 'FAIL' : 'ok'`);
rows.push([String(cityCalm).startsWith('ok') && calmOff === 'ok' ? 'PASS' : 'FAIL', 'City · under Calm motion', calmOff === 'ok' ? String(cityCalm).slice(3, 60) : 'Calm motion did not switch back off']);

/* DELETING A STOP FROM ITS GUIDE. It ended on "Stop not found" with the
   sheet's back handler stuck: the delete pushed the Journey on top of the
   sheet, and closing the sheet went back onto the deleted guide. Walked on a
   throwaway stop written straight into the vault (the trip is untouched):
   Pocket → Journey → its city → its guide → edit → delete. It must land on
   the Journey, and one back press go where you were before it. */
/* the vault's own store, from the page — written behind Dexie's back, so the
   app reads it only after a reload */
const STOPS_IDB = "const idb=async(mode,fn)=>{" +
  " const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});" +
  " try { const tx=db.transaction('stops',mode); const q=fn(tx.objectStore('stops'));" +
  " const out=await new Promise((res,rej)=>{ q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); });" +
  " await new Promise(r=>{ tx.oncomplete=r; tx.onerror=r; }); return out; } finally { db.close(); } };";
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket` });
await wait(2200);
await js(`(async()=>{ ${STOPS_IDB}
  await idb('readwrite', st=>st.put({ id:'cn26-stop-rehearsal-delete', tripId:'cn26', kind:'stop', name:'Rehearsal stop', hue:30, start:'2026-12-27', end:'2026-12-27', blocks:[], recoBlocks:[], order:99 }));
  window.__beforeReload = true;
  return 'ok';
})()`, true);
await S('Page.reload', {});
/* the reload must have landed before the walk starts in it (a check that
   began in the old document would be cut off when the new one arrives) */
for (let i = 0; i < 40; i++) {
  await wait(300);
  if ((await js(`!window.__beforeReload&&document.readyState==='complete'&&!!document.querySelector('main.pocket')`)) === true) break;
}
await wait(800);
/* the walk, a step per tap — each step with the activation a tap gives */
const walk = (steps) =>
  js(`(async()=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ID='cn26-stop-rehearsal-delete'; ${STOPS_IDB} ${steps} })()`, true, true);
let stopDelete = await walk(`
  location.hash='#/trip/cn26/journey'; await sleep(900);
  location.hash='#/trip/cn26/journey/'+ID; await sleep(900);
  return document.querySelector('main.city') ? 'ok' : 'FAIL the throwaway stop has no city';`);
if (String(stopDelete).startsWith('ok')) stopDelete = await walk(`
  location.hash='#/trip/cn26/journey/'+ID+'/guide'; await sleep(900);
  if(!document.querySelector('main.guide')) return 'FAIL no guide for the throwaway stop';
  const toggle=document.querySelector('.gd-acts button[aria-pressed]');
  if(toggle.getAttribute('aria-pressed')!=='true'){ toggle.click(); await sleep(300); }
  const edit=[...document.querySelectorAll('.gd-edit button')].find(b=>/Edit Rehearsal stop/.test(b.textContent));
  if(!edit) return 'FAIL no Edit Rehearsal stop in edit mode';
  edit.click(); await sleep(800);
  return [...document.querySelectorAll('.sheet button')].some(b=>/^Delete/.test(b.textContent.trim())) ? 'ok' : 'FAIL no Delete in the stop editor';`);
if (String(stopDelete).startsWith('ok')) stopDelete = await walk(`
  const del=()=>[...document.querySelectorAll('.sheet button')].find(b=>/^(Delete|Tap again to delete)/.test(b.textContent.trim()));
  del().click(); await sleep(250); del().click();
  await sleep(2600);
  if(location.hash!=='#/trip/cn26/journey') return 'FAIL the delete landed on '+location.hash;
  if(/Stop not found/i.test(document.body.innerText)) return 'FAIL Stop not found after the delete';
  if(!document.querySelector('main.journey')) return 'FAIL the Journey is not drawn';
  if(document.querySelector('.sheet')) return 'FAIL the editor is still open';
  if(await idb('readonly', st=>st.get(ID))) return 'FAIL the stop is still in the vault';
  window.__walked = true;
  return 'ok landed';`);
/* one back press, in its own step: if it left the app's document, the page
   that answers next is a new one, and says so */
let stopBack = stopDelete;
if (String(stopDelete).startsWith('ok')) {
  await js(`history.back(); 'ok'`, false, true);
  await wait(1600);
  stopBack = await js(`(()=>{
    if(!window.__walked) return 'FAIL one back press left the page (a new document answered)';
    if(location.hash!=='#/trip/cn26/pocket') return 'FAIL one back press from the Journey went to '+location.hash;
    if(/Stop not found/i.test(document.body.innerText)) return 'FAIL a back press found the deleted stop';
    if(!document.querySelector('main.pocket')) return 'FAIL the Pocket is not drawn after back';
    return 'ok lands on the Journey, one back press → the Pocket';
  })()`);
}
await js(`(async()=>{ ${STOPS_IDB} await idb('readwrite', st=>st.delete('cn26-stop-rehearsal-delete')).catch(()=>{}); return 'ok'; })()`, true);
/* the walk turned edit mode on (in memory): leave the app as a fresh open
   finds it, for the checks after this one */
await S('Page.reload', {});
await wait(2400);
rows.push([String(stopBack).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · deleting its stop lands on the Journey', String(stopBack).slice(3, 60)]);

/* DELETING A BOOKING FROM ITS OWN PASS (Run 4b). It ended on "Not on this
   phone": the delete rewrote the address from inside the sheet — the SHEET's
   entry — and closing the sheet went back onto the pass. Walked the way the
   stop's delete is, on a throwaway booking written straight into the vault
   (the trip is untouched): Pocket → Travel → its pass → edit → delete. It
   must land on Travel, and one back press go to the Pocket. */
const BOOKINGS_IDB = STOPS_IDB.replace(/'stops'/g, "'bookings'");
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket` });
await wait(2200);
await js(`(async()=>{ ${BOOKINGS_IDB}
  await idb('readwrite', st=>st.put({ id:'cn26-rehearsal-booking', tripId:'cn26', kind:'other', status:'pending', title:'Rehearsal booking', date:'2026-12-26', meta:[], createdAt:0, updatedAt:0 }));
  window.__beforeReload = true;
  return 'ok';
})()`, true);
await S('Page.reload', {});
for (let i = 0; i < 40; i++) {
  await wait(300);
  if ((await js(`!window.__beforeReload&&document.readyState==='complete'&&!!document.querySelector('main.pocket')`)) === true) break;
}
await wait(800);
const passWalk = (steps) =>
  js(`(async()=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ID='cn26-rehearsal-booking'; ${BOOKINGS_IDB} ${steps} })()`, true, true);
let passDelete = await passWalk(`
  location.hash='#/trip/cn26/pocket/travel'; await sleep(900);
  location.hash='#/trip/cn26/pocket/'+ID; await sleep(900);
  return document.getElementById('bk-'+ID) ? 'ok' : 'FAIL the throwaway booking has no pass';`);
if (String(passDelete).startsWith('ok')) passDelete = await passWalk(`
  const sw=[...document.querySelectorAll('button')].find(b=>/^Edit$/.test(b.getAttribute('aria-label')||''));
  if(!sw) return 'FAIL no edit switch on the pass';
  sw.click(); await sleep(400);
  const edit=[...document.querySelectorAll('.ps-actions button')].find(b=>/^Edit$/.test(b.textContent.trim()));
  if(!edit) return 'FAIL no Edit on the pass in edit mode';
  edit.click(); await sleep(900);
  return [...document.querySelectorAll('.sheet button')].some(b=>/^Delete$/.test(b.textContent.trim())) ? 'ok' : 'FAIL no Delete in the booking editor';`);
if (String(passDelete).startsWith('ok')) passDelete = await passWalk(`
  const del=()=>[...document.querySelectorAll('.sheet button')].find(b=>/^(Delete|Tap again to delete)$/.test(b.textContent.trim()));
  del().click(); await sleep(250); del().click();
  await sleep(2600);
  if(location.hash!=='#/trip/cn26/pocket/travel') return 'FAIL the delete landed on '+location.hash;
  if(/Not on this phone/i.test(document.body.innerText)) return 'FAIL "Not on this phone" after the delete';
  if(!document.querySelector('main.psec[data-section="travel"]')) return 'FAIL Travel is not drawn';
  if(document.querySelector('.sheet')) return 'FAIL the editor is still open';
  if(await idb('readonly', st=>st.get(ID))) return 'FAIL the booking is still in the vault';
  window.__walked = true;
  return 'ok landed';`);
let passBack = passDelete;
if (String(passDelete).startsWith('ok')) {
  await js(`history.back(); 'ok'`, false, true);
  await wait(1600);
  passBack = await js(`(()=>{
    if(!window.__walked) return 'FAIL one back press left the page (a new document answered)';
    if(location.hash!=='#/trip/cn26/pocket') return 'FAIL one back press from Travel went to '+location.hash;
    if(/Not on this phone/i.test(document.body.innerText)) return 'FAIL a back press found the deleted booking';
    if(!document.querySelector('main.pocket')) return 'FAIL the Pocket is not drawn after back';
    return 'ok lands on Travel, one back press → the Pocket';
  })()`);
}
await js(`(async()=>{ ${BOOKINGS_IDB} await idb('readwrite', st=>st.delete('cn26-rehearsal-booking')).catch(()=>{}); return 'ok'; })()`, true);
/* edit mode is in memory: leave the app as a fresh open finds it */
await S('Page.reload', {});
await wait(2400);
rows.push([String(passBack).startsWith('ok') ? 'PASS' : 'FAIL', 'Pocket · deleting a booking from its pass lands on its list', String(passBack).replace(/^ok /, '').slice(0, 60)]);

/* ICONS ARE DRAWN, NOT NAMED. Since Run 3 a Horizon icon is its markup set
   inside the <svg> — an unknown name would draw an empty box that no text
   check can see — so every icon on the Journey must have a drawing in it. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey` });
await wait(2000);
const drawn = await js(`(()=>{
  const icons=[...document.querySelectorAll('svg.hicon')];
  if(icons.length<10) return 'FAIL only '+icons.length+' icons on the Journey';
  const empty=icons.filter(s=>!s.querySelector('path,circle,rect,line,polyline,polygon'));
  return empty.length ? 'FAIL '+empty.length+' empty icon(s)' : 'ok '+icons.length+' icons, all drawn';
})()`);
rows.push([String(drawn).startsWith('ok') ? 'PASS' : 'FAIL', 'Icons · every one has a drawing', String(drawn).slice(3, 56)]);

/* THE THREE CLOCKS FIT WITHOUT A SWIPE, new 2026-08-12 (Gap D). The rail has
   always scrolled, but the trip's own three zones overflowed it by four pixels,
   so ABU DHABI read as cut off rather than as swipeable — and the type ladder
   would have widened that to twenty-two. It is padding, not point size: the
   dial is as wide as its LABEL. Asserted against the rail, not a magic number,
   so a fourth zone is allowed to scroll and these three are not. The clocks
   are a Pocket screen now. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/clocks` });
await wait(2200);
const clocks = await js(`(()=>{
  const rail=document.querySelector('#clocks .clocks');
  if(!rail) return 'FAIL no clock rail in the Pocket';
  const dials=[...rail.querySelectorAll('.clock')];
  if(dials.length!==3) return 'FAIL '+dials.length+' dials, expected 3';
  if(rail.scrollWidth>rail.clientWidth+1)
    return 'FAIL the three clocks need a swipe: '+rail.scrollWidth+' in '+rail.clientWidth;
  const num=parseFloat(getComputedStyle(dials[0].querySelector('.clocknum')).fontSize);
  if(num<20) return 'FAIL the clock face shrank to '+num+' px to make room';
  return 'ok 3 dials in '+rail.clientWidth+' px, faces at '+num+' px';
})()`);
rows.push([String(clocks).startsWith('ok') ? 'PASS' : 'FAIL', 'Pocket · three clocks, no swipe needed', String(clocks).slice(3, 56)]);

/* the button must open the PLACE, not a nameless coordinate. Two proofs:
   the geo: intent the phone would fire (a name search, Chinese encoded), and
   the https link a browser falls back to — neither is a coordinate. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/driver` });
await wait(2200);
const names = await js(`(async()=>{
  const seen=[];
  window.open=(u)=>{ seen.push(String(u)); return null; };
  const row=[...document.querySelectorAll('.zhlist li')].find(r=>/洪崖洞/.test(r.textContent));
  if(!row) return 'FAIL no Hongyadong row';
  const btns=row.querySelectorAll('.maps button');
  if(btns.length!==1) return 'FAIL buttons '+btns.length;
  const geo=btns[0].getAttribute('data-geo')||'';
  if(!geo.startsWith('geo:0,0?q='+encodeURIComponent('洪崖洞'))) return 'FAIL geo '+geo.slice(0,60);
  if(!geo.endsWith(encodeURIComponent('重庆'))) return 'FAIL city not last '+geo.slice(-30);
  btns[0].click();
  await new Promise(r=>setTimeout(r,400));
  const g=seen.find(u=>u.includes('google.com/maps'))||'';
  if(!g.includes(encodeURIComponent('洪崖洞'))) return 'FAIL web not by name: '+g.slice(0,60);
  if(/query=\\d/.test(g)) return 'FAIL web fallback still a coordinate';
  return 'ok';
})()`, true);
rows.push([names === 'ok' ? 'PASS' : 'FAIL', 'Maps open the place, not a dot', String(names).slice(0, 55)]);

/* a booking carries its own location now: the beds whose address the owner's
   own paperwork prints open on that address, the flight opens the airport it
   LEAVES from, and the beds with nothing verified carry no button at all */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/stays` });
await wait(2200);
const bookmaps = await js(`(async()=>{
  ${PASS_HELPERS}
  /* each booking's pass, walked once; its map buttons read as the geo: intents */
  const G={};
  for(const id of ['cn26-stay-06','cn26-stay-00','cn26-stay-10','cn26-stay-02','cn26-stay-03','cn26-stay-05',
                   'cn26-stay-08','cn26-stay-09','cn26-stay-01','cn26-stay-11','cn26-stay-04','cn26-stay-13','cn26-flight-ca1953']){
    const el=await openPass(id);
    if(!el) return 'FAIL no pass for '+id;
    G[id]=snapPass(el).geos;
  }
  const btns=(id)=>G[id]||[];
  const yuetu=btns('cn26-stay-06');
  if(yuetu.length!==1) return 'FAIL Yue Tu Inn buttons '+yuetu.length;
  const ngeo=yuetu[0]||'';
  /* The address IS the search — no hotel name this repo never verified goes
     to a map, and no coordinate ever does. */
  if(ngeo!=='geo:0,0?q='+encodeURIComponent('No. 43 Yizheng Jinjia Street, Dayan Ancient Town')) return 'FAIL geo '+ngeo.slice(0,70);
  /* Four Points was in the mute list until 2026-07-27. Booking it produced the
     address the accommodation document had told us to go and get, so it now
     opens on that address — and the check follows the fact instead of being
     deleted. Its name is still nowhere near a map: Four Points is a chain. */
  const fp=btns('cn26-stay-00');
  if(fp.length!==1) return 'FAIL Four Points buttons '+fp.length;
  const fgeo=fp[0]||'';
  if(fgeo!=='geo:0,0?q='+encodeURIComponent('No. 20 Gongti East Road, Chaoyang District, Beijing, China')) return 'FAIL Four Points geo '+fgeo.slice(0,80);
  if(/Sheraton|Four%20Points/i.test(fgeo)) return 'FAIL the chain name reached the map: '+fgeo.slice(0,60);
  /* Booked 2026-07-27 as well. The Royal Garden's direct booking printed a
     FULLER address than the accommodation document had, so the button follows
     the confirmation; Element's Agoda page reprinted the address the repo
     already shipped, so its button must be unchanged. Neither may acquire a
     hotel name: "Element" alone is a Marriott brand and "The Royal Garden"
     collides with hotels in three other cities. */
  const rg=btns('cn26-stay-10');
  if(rg.length!==1) return 'FAIL Royal Garden buttons '+rg.length;
  const rgeo=rg[0]||'';
  if(rgeo!=='geo:0,0?q='+encodeURIComponent('69 Mody Road, Tsimshatsui East, Kowloon, Hong Kong')) return 'FAIL Royal Garden geo '+rgeo.slice(0,90);
  /* Element opened by its street until 2026-10-17, when the owner CANCELLED
     it on Agoda: a cancelled bed is nowhere to go, so it opens nothing. */
  if(btns('cn26-stay-02').length!==0) return 'FAIL the cancelled Element still opens a map: '+btns('cn26-stay-02').length;
  if(/Royal%20Garden|Element|Marriott/i.test(rgeo)) return 'FAIL a hotel name reached the map';
  /* Pullman was booked 2026-07-27 and its Agoda confirmation MISSPELLS the
     street — "GADYUN ROAD" for Gaoyun Road. The button keeps the accommodation
     document's spelling, because a search for a street that does not exist is
     worse than no button at all, and the typo must never reach a map. */
  const pl=btns('cn26-stay-03');
  if(pl.length!==1) return 'FAIL Pullman buttons '+pl.length;
  const pgeo=pl[0]||'';
  if(pgeo!=='geo:0,0?q='+encodeURIComponent('No. 188 Gaoyun Road, Wulingyuan')) return 'FAIL Pullman geo '+pgeo.slice(0,90);
  if(/GADYUN/i.test(pgeo)) return 'FAIL the confirmation typo reached the map';
  if(/Pullman|Accor/i.test(pgeo)) return 'FAIL the chain name reached the map: '+pgeo.slice(0,60);
  /* Glenview kept the document's address too — its Trip.com booking printed
     none of its own to compare with. */
  const gv=btns('cn26-stay-05');
  if(gv.length!==1) return 'FAIL Glenview buttons '+gv.length;
  const ggeo=gv[0]||'';
  if(ggeo!=='geo:0,0?q='+encodeURIComponent('No. 66 Qingnian Road, Yuzhong District')) return 'FAIL Glenview geo '+ggeo.slice(0,90);
  /* DALI joined the addressed beds on 2026-07-27 evening: its document entry
     had only a COORDINATE, which a bed never ships, and its Booking.com
     confirmation printed a street. The postcode rides inside that verbatim line
     rather than being appended to another source's — and cutting it out would
     also cut out "Dali", the city. The coordinate must still be nowhere near
     the button. */
  const dl=btns('cn26-stay-08');
  if(dl.length!==1) return 'FAIL Dali buttons '+dl.length;
  const dgeo=dl[0]||'';
  if(dgeo!=='geo:0,0?q='+encodeURIComponent('No.133, Yinxian Road, Shuidui Village, 671003 Dali, China')) return 'FAIL Dali geo '+dgeo.slice(0,90);
  if(/25\.6957|100\.1537|Yanyuan/i.test(dgeo)) return 'FAIL a coordinate or the hotel name reached the map: '+dgeo.slice(0,60);
  /* The ibis kept the address that names its UNIT. Its Trip.com order prints a
     fuller line that is not a superset of this one, and adopting it would cost
     the word "Kunming" at the address cap — so the shipped line did not move,
     and the order's version lives on the note instead. */
  const ib=btns('cn26-stay-09');
  if(ib.length!==1) return 'FAIL ibis buttons '+ib.length;
  const igeo=ib[0]||'';
  if(igeo!=='geo:0,0?q='+encodeURIComponent('Unit 1-1, Building 1, Yunlifang, Changshui Hangcheng')) return 'FAIL ibis geo '+igeo.slice(0,90);
  if(/ibis|Accor/i.test(igeo)) return 'FAIL the chain name reached the map: '+igeo.slice(0,60);
  /* Blossom House ships no button. A missing button here is the feature — and
     it is a BOOKED bed: its bookings-list row named a district, its 2026-07-28
     re-attempt found only its hutong, and neither is a door. On 2026-09-27 its
     confirmation EMAIL turned out to print one (No. 9 Yangfang Hutong /
     羊房胡同9号); it rides on the note, and it is still no button, because every
     address the app opens was fired at Amap on the phone first and this one
     has not been. Booked is not the same as locatable, and neither is printed.
     HUATIAN LEFT THIS LIST on 2026-07-28 and is checked the other way below:
     it is the first bed on the trip promoted to a NAME, so it must now have
     exactly one button, searching 华天大酒店 — and still no coordinate.
     THE ACADEMY JOINED THIS LIST on 2026-08-12, when its own arrival message
     said nothing at all about where to go. On 2026-08-13 it gained BOTH a
     postal address and the school's own taxi text — and it stays on this list,
     which is the interesting part. An address you can read is not a name a map
     service will resolve: 昆嵛山自然保护区 is a conservation district and neither
     name has been through verify:places. Getting the answer did not earn the
     button, and this check is what says so. */
  /* THE MUPING NIGHT JOINED THIS LIST on 2026-09-28 by Blossom House's road —
     a street on the confirmation, not yet checked in Amap on the phone — and
     CA1560 with it: YNT has no verified card, so the flight opens nothing.
     THE HI COZY HOSTEL JOINED IT on 2026-10-17 by the same road: its Trip.com
     order prints a street (No. 350 Shanxi South Road) nobody has checked in a
     map, so it rides on the note and opens nothing. */
  const mute=['cn26-stay-01','cn26-stay-11','cn26-stay-12','cn26-stay-13','cn26-flight-ca1560'].filter(id=>btns(id).length!==0);
  if(mute.length) return 'FAIL unverified bed or airport has a button: '+mute.join(',');
  const hu=btns('cn26-stay-04');
  if(hu.length!==1) return 'FAIL Huatian buttons '+hu.length;
  const hgeo=hu[0]||'';
  if(hgeo!=='geo:0,0?q='+encodeURIComponent('华天大酒店 张家界')) return 'FAIL Huatian geo '+hgeo.slice(0,90);
  if(/29\.11|110\.47/.test(hgeo)) return 'FAIL a coordinate reached the map for a bed: '+hgeo.slice(0,60);
  /* The old Dec 11 flight keeps its order's id (cn26-flight-ca1953) but is
     CA8609 from DAXING since 2026-09-27 — cancelled on 2026-10-17, its card
     still opens PKX and never Capital. */
  const ca=btns('cn26-flight-ca1953');
  if(ca.length!==1) return 'FAIL CA8609 buttons '+ca.length;
  const ageo=ca[0]||'';
  if(!ageo.startsWith('geo:0,0?q='+encodeURIComponent('北京大兴国际机场'))) return 'FAIL flight geo '+ageo.slice(0,50);
  return 'ok';
})()`, true);
rows.push([bookmaps === 'ok' ? 'PASS' : 'FAIL', 'Bookings · one button, right place', String(bookmaps).slice(0, 55)]);

/* THE FIVE RAIL CARDS, new on 2026-07-28 — and the check is as much about the
   buttons that are NOT there as the ones that are. (FOUR since 2026-10-17:
   skiing was dropped, Dec 9 is Beijing South → Shanghai Hongqiao and the
   Dec 11 leg is gone. The shapes below are the history; the code checks
   today's four cards, five buttons and four ends that say why.)

   A flight has one place at each end because an airport code IS a place. A
   train does not: of these ten ends, three are named nowhere in the trip's
   documents (four until Dec 11 named Qinghe on 2026-09-27) and one is named
   twice without being decided. So the card has three
   shapes to get right, and all three are asserted here —
     TWO buttons  Dec 9's "Beijing North / Qinghe", where the plan names both
                  stations and chooses neither, so the card refuses to choose
                  either. This is the one that would quietly become one button
                  if someone ever "tidied" the manifest.
     ONE button   the ordinary case, borrowed whole from an entity that already
                  passed the gate (太子城站 is a driver card, 张家界西站 a Phase 2
                  spot) — same string, same city, same search.
     NO button    and the reason printed in its place. Dec 14 is the sharpest:
                  no document names which Chongqing station this arrives at, and
                  the two candidates are on opposite sides of a municipality the
                  size of Austria, so a guess there is not a near miss.
   And every one of them stamps PENDING, because not one ticket is booked. */
const railcards = await js(`(async()=>{
  ${PASS_HELPERS}
  const ids=['nov22','dec09','dec14','dec20']; // dec11 left with skiing, 2026-10-17
  /* each leg's pass, walked once */
  const P={};
  for(const i of ids) P[i]=snapPass(await openPass('cn26-train-'+i));
  const missing=ids.filter(i=>!P[i]);
  if(missing.length) return 'FAIL no card for: '+missing.join(',');
  /* Nothing is booked, and every card has to keep saying so. */
  const notPending=ids.filter(i=>!/Pending/i.test(P[i].stamp));
  if(notPending.length) return 'FAIL not stamped pending: '+notPending.join(',');
  const geos=(i)=>P[i].geos;
  /* Dec 9 · Beijing South opens (its own driver card); Shanghai Hongqiao has
     never been through the gate, so it says why it has no button. (It was the
     two-station "Beijing North / Qinghe" → Taizicheng until 2026-10-17.) */
  const d9=geos('dec09');
  if(d9.length!==1) return 'FAIL Dec 9 buttons '+d9.length+', expected 1';
  if(d9[0]!=='geo:0,0?q='+encodeURIComponent('北京南站 北京')) return 'FAIL Dec 9 geo '+d9[0].slice(0,60);
  if(!/no Shanghai station/i.test(P.dec09.text)) return 'FAIL Dec 9 does not say why Hongqiao has no button';
  /* Dec 14 · one button (张家界西站) and an arrival that says why it has none. */
  const d14=geos('dec14');
  if(d14.length!==1) return 'FAIL Dec 14 buttons '+d14.length+', expected 1';
  if(d14[0]!=='geo:0,0?q='+encodeURIComponent('张家界西站 张家界')) return 'FAIL Dec 14 geo '+d14[0].slice(0,60);
  const t14=P.dec14.text;
  if(!/重庆北/.test(t14)||!/重庆西/.test(t14)) return 'FAIL Dec 14 does not name the two it refuses to choose between';
  /* …and neither of them may be openable from the card. */
  if(d14.some(g=>/%E9%87%8D%E5%BA%86/.test(g))) return 'FAIL a Chongqing station got a button after all';
  /* Dec 20 · the visa-critical one: Kunming South opens, Dali does not. */
  const d20=geos('dec20');
  if(d20.length!==1) return 'FAIL Dec 20 buttons '+d20.length+', expected 1';
  if(d20[0]!=='geo:0,0?q='+encodeURIComponent('昆明南站 昆明')) return 'FAIL Dec 20 geo '+d20[0].slice(0,60);
  if(!/Xiaguan/i.test(P.dec20.text)) return 'FAIL Dec 20 does not say why the Dali end has no button';
  /* Five buttons across the four cards, and not one more (nine across five
     until 2026-10-17: the Chongli trains took four with them). */
  const total=ids.reduce((n,i)=>n+geos(i).length,0);
  if(total!==5) return 'FAIL '+total+' station buttons across the four legs, expected 5';
  /* The documented fares stay ON the card, as chips — they are estimates for
     tickets nobody has bought, so they must be visible here and absent from the
     money screen's committed total (which the Money check holds at $5,356). */
  /* Since 2026-10-17 the Dec 9 card is a RESERVATION (G11, Trip.com): still
     stamped pending — it is not a ticket until Nov 25 — with its number, its
     ILS 330.22 and the words that say so. */
  if(!/ILS 330\.22/.test(P.dec09.text)) return 'FAIL the reserved fare is not on the Dec 9 card';
  if(!/not yet a ticket/i.test(P.dec09.text)||!P.dec09.text.replace(/\\s+/g,'').includes('1653718542268674')) return 'FAIL the Dec 9 card does not say it is a reservation, with its number: '+P.dec09.text.replace(/\\s+/g,' ').slice(0,80);
  /* And the one that must not slip: Dec 20 is the visa exit leg. */
  if(!/visa/i.test(P.dec20.text)) return 'FAIL Dec 20 does not say it is the visa leg';
  return 'ok 4 legs, 5 buttons, 4 ends that say why they have none';
})()`, true);
rows.push([String(railcards).startsWith('ok') ? 'PASS' : 'FAIL', 'Rail · both ends, or the reason there is none', String(railcards).slice(0, 60)]);

/* THE WALLET'S FIFTH SEGMENT, new 2026-08-06 — the things this trip goes TO.

   It exists because of one ticket. The owner bought the HK Phil concert on the
   morning of 6 Aug, and it turned out to have nowhere to live: it was in the
   Dec 22 day plan and in the money, and absent from the one screen you hold up
   at a counter. Ten more bookable things were in the same position, written down
   in the trip's own to-do list for months and never a booking.

   TWO PROMISES, and the second is the one that matters more —
     1. THE CONCERT SHOWS ITS REFERENCE. It is an e-Ticket bought through URBTIX,
        who state plainly that the confirmation email is not a ticket, in the last
        week of a trip that spends five weeks somewhere Gmail does not open. If
        the number is not on this card, offline, the card is decoration.
     2. NOTHING PENDING PRETENDS TO BE BOUGHT. Ten of the eleven are still to
        buy, so ten wear PENDING and not one of them carries a reference — a
        plausible number on an unbought ticket is what gets read out at a door.
        The money half of the same promise is checked on the Money card, which
        holds Tickets+shows at $88: the concert alone. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/experiences` });
await wait(2200);
const experiences = await js(`(async()=>{
  ${PASS_HELPERS}
  const sleep=__sleep;
  const ids=['forbidden-city','wall-guide','disney','forest-park','tianmen','cq1949',
             'jade-dragon','hkphil','macau-ferry','ngong-ping','lung-king-heen'];
  /* THE LIST FIRST. Eleven rows, what you already hold on top — the one ticket
     you can be turned away at a door for not having must not sit under ten
     to-buys — and nothing running off the right edge of the phone. (The five
     Wallet segments this used to measure became the Pocket's own lists.) */
  const rowsOnList=[...document.querySelectorAll('.passrow')].map(a=>a.getAttribute('data-id'));
  const unlisted=ids.filter(k=>!rowsOnList.includes('cn26-ticket-'+k));
  if(unlisted.length) return 'FAIL the Experiences list is missing '+unlisted.join(',');
  if(rowsOnList[0]!=='cn26-ticket-hkphil') return 'FAIL the bought ticket is not first: '+rowsOnList[0];
  if(document.documentElement.scrollWidth>window.innerWidth+1) return 'FAIL the list runs off the phone: '+document.documentElement.scrollWidth;
  /* THEN EACH PASS, walked once. */
  const P={};
  const copied=[];
  navigator.clipboard.writeText=(t)=>{copied.push(t); return Promise.resolve();};
  let concertCopied=null;
  for(const k of ids){
    const el=await openPass('cn26-ticket-'+k);
    if(!el) return 'FAIL no card for: '+k;
    P[k]=el.cloneNode(true);
    /* ① the reference, big, on a plain strip, and copyable with one thumb */
    if(k==='hkphil'){
      const code=el.querySelector('.codestrip .code');
      if(code){ code.click(); await sleep(400); concertCopied=copied[0]??null; }
    }
  }
  const card=(k)=>P[k];
  const stamp=(k)=>(card(k).querySelector('.tk-stamp')?.textContent||'').trim();
  if(!/^Booked/.test(stamp('hkphil'))) return 'FAIL the concert is not stamped booked: "'+stamp('hkphil')+'"';
  const notPending=ids.filter(k=>k!=='hkphil').filter(k=>!/Pending/i.test(stamp(k)));
  if(notPending.length) return 'FAIL not stamped pending: '+notPending.join(',');

  const code=card('hkphil').querySelector('.codestrip .code');
  if(!code) return 'FAIL the concert has no reference to show at the door';
  if(code.textContent.trim()!=='26080616302422701001') return 'FAIL concert reference '+code.textContent.trim();
  if(concertCopied!=='26080616302422701001') return 'FAIL the reference did not copy: '+String(concertCopied).slice(0,30);
  const sub=card('hkphil').querySelector('.codestrip .codesub');
  if(!sub||!/26080616302422701\\b/.test(sub.textContent)) return 'FAIL no transaction number under the reference';
  const t=card('hkphil').innerText;
  for(const s of ['STAL2','Row DD','Seat 44','19:30','HK$689','Hong Kong Cultural Centre']){
    if(!t.includes(s)) return 'FAIL the concert card does not show '+s;
  }
  if(!/valid ticket only/i.test(t)) return 'FAIL the URBTIX warning is gone from the concert card';

  /* ② nothing pending carries a reference */
  const numbered=ids.filter(k=>k!=='hkphil').filter(k=>card(k).querySelector('.codestrip'));
  if(numbered.length) return 'FAIL an unbought ticket carries a reference: '+numbered.join(',');
  /* JADE DRAGON IS THE INN'S JOB SINCE 27 SEP: Yue Tu reserves the ¥550 tour
     for Dec 17 at the Dec 10 release, confirmed with the inn on Dec 9, and the
     20:00 DIY release is the fallback only. Still pending — the pass says what
     will happen, and nothing on it is bought yet. */
  const jd=card('jade-dragon').innerText;
  if(!/Yue Tu.s ¥550 tour (—|is) RESERVED for Dec 17/.test(jd)) return 'FAIL the Jade Dragon pass does not carry the inn reservation';
  if(!/now the FALLBACK only/i.test(jd)) return 'FAIL the Dec 10 release is not the fallback on the Jade Dragon pass';

  /* Ten open a place this repo already verified — the concert opens the hall
     next door to the hotel. Shanghai Disneyland (the eleventh since 2026-10-17,
     in place of the Thaiwoo lesson) opens NOTHING: no Shanghai place has been
     verified. */
  const btns=(k)=>[...card(k).querySelectorAll('.maps button')];
  const wrong=ids.filter(k=>k!=='disney').filter(k=>btns(k).length!==1);
  if(wrong.length) return 'FAIL map buttons on '+wrong.join(',');
  if(btns('disney').length!==0) return 'FAIL Disneyland got a button it has never earned';
  if(!/¥439/.test(card('disney').innerText)||!/non-refundable/i.test(card('disney').innerText)) return 'FAIL the Disney pass lost its Trip.com price or its warning';
  const hall=btns('hkphil')[0].getAttribute('data-geo')||'';
  if(!hall.startsWith('geo:0,0?q='+encodeURIComponent('Hong Kong Cultural Centre'))) return 'FAIL concert geo '+hall.slice(0,70);
  return 'ok 11 passes · 1 bought, 10 to buy · 10 buttons';
})()`, true);
rows.push([String(experiences).startsWith('ok') ? 'PASS' : 'FAIL', 'Experiences · the concert, and ten to buy', String(experiences).slice(0, 60)]);

/* ELEVEN BEDS ARE BOOKED — every bed on the trip except the gorge guesthouse,
   which is a deliberate walk-in. Eight went on 26–27 Jul; Dali and Kunming
   finished the platform list on 2026-07-27, and the ACADEMY was written down on
   2026-08-12. This is the check that notices if any one of
   them ever quietly goes back to pending. It asserts the fact several ways, so a
   half-reverted seed cannot slip through: the stamp on the card, the number a
   check-in desk asks for (copyable, in the big type, with the secondary line
   under it — never the other way round), the price actually paid, the real
   cancellation deadline, the LINK BACK TO THE PLATFORM, and that NO bed which is
   not booked wears the stamp.

   ALL TEN NOW CARRY A NUMBER. Element was the last without — its Agoda number
   was not captured until 29 Jul 2026, and until then the app showed nothing
   rather than something plausible, and this comment said so. Its card carries
   two: the Agoda ID and, underneath, the booking.com allotment number the
   property may actually file the stay under. The link rule is unchanged, and
   Element is still the bed that proved it: "we were never given the number" and
   "you cannot reach the order" are different admissions.

   THE ELEVENTH JOINED ON 2026-08-12 AND IT BREAKS THE SHAPE OF THIS CHECK, on
   purpose. The Kunyu academy fortnight is BOOKED — its deposit was sent and
   acknowledged, "the slot is held and this is not an open item" — and it had no
   number, no price and no platform, because none of the three was ever issued
   for it. So it is in the stamp list, where being booked is what is asserted,
   and out of the number/link lists, where it would assert a paperwork it never
   had. The absences get their own assertion instead: an academy card that grew
   a code strip would be showing a reference nobody gave.
   ONE OF THE THREE FILLED IN ON 2026-08-13. The school stated $840 in writing,
   so the academy is no longer exempt from the PRICE half of this check — its
   own block below now demands the figure of it. It stays out of the number and
   link lists, which were never about money: "nobody ever issued us a number" is
   still true, and still a different sentence from "we lost it". */
/* 2026-10-17: Element (stay-02) left — CANCELLED on Agoda — and the Hi Cozy
   hostel (stay-13) joined, booked on Trip.com the same day. */
const BOOKED_BEDS = ['cn26-stay-00','cn26-stay-01','cn26-stay-03','cn26-stay-04',
                     'cn26-stay-05','cn26-stay-06','cn26-stay-08','cn26-stay-09','cn26-stay-10',
                     'cn26-stay-11','cn26-stay-12', // stay-12: the Muping night, booked 2026-09-28
                     'cn26-stay-13']; // stay-13: the Hi Cozy hostel, Shanghai, booked 2026-10-17
/* The ten a platform holds — everything that can be read out at a desk. */
const NUMBERED_BEDS = BOOKED_BEDS.filter((id) => id !== 'cn26-stay-11');
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/stays` });
await wait(2200);
const bedsBooked = await js(`(async()=>{
  ${PASS_HELPERS}
  const sleep=__sleep;
  const copied=[];
  navigator.clipboard.writeText=(t)=>{copied.push(t); return Promise.resolve();};
  /* EVERY BED'S PASS, WALKED ONCE. What the checks below read is a detached
     copy of each pass; the two things only a LIVE pass can prove — that the
     number copies, and that the secondary line is smaller than the number —
     are taken while it is on screen. The Stays list must hold all twelve. */
  const listed=[...document.querySelectorAll('.passrow')].map(a=>a.getAttribute('data-id'));
  const allBeds=[...${JSON.stringify(BOOKED_BEDS)},'cn26-stay-07','cn26-stay-02'];
  const unlisted=allBeds.filter(id=>!listed.includes(id));
  if(unlisted.length) return 'FAIL the Stays list is missing '+unlisted.join(',');
  const P={}, LIVE={};
  for(const id of allBeds){
    const el=await openPass(id);
    if(!el) return 'FAIL no pass for '+id;
    const code=el.querySelector('.codestrip .code');
    const sub=el.querySelector('.codestrip .codesub');
    let got=null;
    if(code){ copied.length=0; code.click(); await sleep(300); got=copied[0]; }
    LIVE[id]={ codePx: code?parseFloat(getComputedStyle(code).fontSize):0,
               subPx: sub?parseFloat(getComputedStyle(sub).fontSize):0, copied: got };
    P[id]=el.cloneNode(true);
  }
  const card=(id)=>P[id];
  const stamp=(id)=>(card(id)?.querySelector('.tk-stamp')?.textContent||'').trim();
  for(const id of ${JSON.stringify(BOOKED_BEDS)}){
    if(!/^Booked/.test(stamp(id))) return 'FAIL '+id+' is not booked: "'+stamp(id)+'"';
  }
  /* NOTHING is pending any more, so the only bed that may not wear the stamp is
     the gorge walk-in. If a "Pending" stamp ever reappears anywhere, a booking
     has been lost. */
  if(/^Booked/.test(stamp('cn26-stay-07'))) return 'FAIL the walk-in wears the booked stamp';
  const pending=Object.keys(P).map(stamp).filter(t=>/pending/i.test(t));
  if(pending.length) return 'FAIL a bed went back to pending: '+pending.join(',');
  if(!/Walk/i.test(stamp('cn26-stay-07'))) return 'FAIL the gorge stopped being a walk-in: '+stamp('cn26-stay-07');
  /* ELEMENT IS CANCELLED (2026-10-17) — listed under Cancelled, stamped so,
     and carrying none of the dead order's numbers or its price. */
  if(!/cancel/i.test(stamp('cn26-stay-02'))) return 'FAIL Element is not stamped cancelled: "'+stamp('cn26-stay-02')+'"';
  if(card('cn26-stay-02')?.querySelector('.codestrip')) return 'FAIL the cancelled Element still shows a code strip';
  for(const dead of ['683386279','5351254076','$232.95']){
    if((card('cn26-stay-02')?.innerText||'').includes(dead)) return 'FAIL the cancelled Element still shows '+dead;
  }

  const chipsOf=(el)=>[...el.querySelectorAll('.meta .m')].map(m=>(m.querySelector('.k')?.textContent||'').trim()+'='+(m.querySelector('.v')?.textContent||'').trim());

  /* A number you read out at a desk: big, copyable, with the small line under
     it carrying the thing that is NOT the number (a PIN, or where it was
     booked). Six of the ten carry a secondary line; the price beside it is
     the price the confirmation printed, IN THE CURRENCY IT PRINTED IT IN — five
     of the ten are quoted in yuan, and the ibis is quoted in the dollars its
     order actually charged.
     Element's secondary line is the odd one: not a PIN and not a platform name
     but a SECOND booking number. Agoda sold a room allotted from booking.com,
     so the property's own system may only recognise 5351254076. A desk that
     cannot find the Agoda ID needs the other number on the same card. */
  /* Element's two numbers left on 2026-10-17 (cancelled); the Hi Cozy
     hostel's Trip.com number and PIN came, priced in the shekels it was paid in. */
  const numbered=[['cn26-stay-13','1653717714742604',/PIN 8861/,'₪136.40'],
                  ['cn26-stay-03','682760663',/Agoda/i,'¥887.52'],
                  ['cn26-stay-06','5942328968',/3635/,'¥857.30'],
                  ['cn26-stay-08','6352597569',/8706/,'¥324.00'],
                  ['cn26-stay-09','1653715562519718',/2284/,'$25.73'],
                  ['cn26-stay-10','cohTex87hq19CnTh',/direct/i,'$1,232.01']];
  for(const [id,want,subRe,price] of numbered){
    const el=card(id);
    const code=el?.querySelector('.codestrip .code');
    if(!code) return 'FAIL '+id+' has no code strip to read out at a desk';
    if(code.textContent.trim()!==want) return 'FAIL '+id+' code '+code.textContent.trim();
    if(LIVE[id].copied!==want) return 'FAIL '+id+' number did not copy: '+String(LIVE[id].copied).slice(0,30);
    const sub=el.querySelector('.codestrip .codesub');
    if(!sub||!subRe.test(sub.textContent)) return 'FAIL '+id+' secondary line is wrong: '+(sub?sub.textContent:'(none)');
    /* Secondary means SMALLER. If a redesign ever makes that line as loud as
       the number, the desk is read the wrong string. */
    if(!(LIVE[id].subPx<LIVE[id].codePx)) return 'FAIL '+id+' secondary line is not smaller: '+LIVE[id].subPx+' vs '+LIVE[id].codePx;
    if(!el.innerText.includes(price)) return 'FAIL '+id+' does not show '+price;
  }
  /* THREE OF THESE FOUR GREW A PIN ON 2026-08-12, and the story is the same for
     each: the Trip.com bookings LIST prints no PIN, the order DETAIL page behind
     it prints one, and for three weeks nobody had clicked through. Four Points
     1170, Huatian 7074, Glenview 4782 — all real, none invented.
     BLOSSOM HOUSE STILL HAS NONE and keeps the old assertion, which is the whole
     reason this is split rather than relaxed: "no PIN was shown" has to stay
     enforceable for the bed where it is still true.
     Since 2026-09-27 its small line is NOT empty — it carries the HOTEL'S own
     confirmation number off the Trip.com email, the Element arrangement (a
     second number for a desk that cannot find the first). So the check moved
     from "no codesub" to "a codesub that is that number and is not a PIN". */
  for(const [id,want,price,pin] of [['cn26-stay-00','1653715561783471','$244.74','1170'],
                                    ['cn26-stay-04','1653715534089209','¥419.00','7074'],
                                    ['cn26-stay-05','1653715534121148','¥1,166.00','4782']]){
    const el=card(id);
    const code=el?.querySelector('.codestrip .code');
    if(!code||code.textContent.trim()!==want) return 'FAIL '+id+' code '+(code?code.textContent.trim():'(none)');
    const sub=el.querySelector('.codestrip .codesub');
    if(!sub||!sub.textContent.includes(pin)) return 'FAIL '+id+' lost its PIN '+pin;
    if(!el.innerText.includes(price)) return 'FAIL '+id+' does not show '+price;
  }
  /* The one Trip.com bed whose order has still never shown a PIN. */
  {
    const el=card('cn26-stay-01');
    const code=el?.querySelector('.codestrip .code');
    if(!code||code.textContent.trim()!=='1653715561827302') return 'FAIL cn26-stay-01 code';
    const bsub=el.querySelector('.codestrip .codesub')?.textContent||'';
    if(/PIN/i.test(bsub)) return 'FAIL cn26-stay-01 invented a PIN — its order has never shown one';
    if(!bsub.includes('R9000388217900556001')) return 'FAIL cn26-stay-01 lost the hotel confirmation number: "'+bsub+'"';
    if(!el.innerText.includes('$299.56')) return 'FAIL cn26-stay-01 does not show $299.56';
  }

  /* THE FOUR POINTS REGRESSION GUARD. That bed was rebooked at a better rate on
     2026-07-27 and EVERY term of the old order died with it. The rule here is
     the one Pullman's GADYUN typo established: the dead figures are allowed to
     be NAMED in the note — the owner still has the old confirmation email and
     needs to be told which numbers are stale — but they may never be PRESENTED
     as this booking's, which means never in the code strip, never in a chip and
     never as the price. The two CREDENTIALS are stricter still: a dead order
     number and a dead PIN have no explanatory value at all, so they may not
     appear on the card in any form. */
  const fpCard=card('cn26-stay-00');
  const fpText=(fpCard?.innerText)||'';
  for(const dead of ['1653715561596848','9858']){
    if(fpText.includes(dead)) return 'FAIL a superseded Four Points credential is on the card: '+dead;
  }
  const fpCode=fpCard?.querySelector('.codestrip')?.innerText||'';
  const fpChips=chipsOf(fpCard);
  const fpFront=fpCode+' | '+fpChips.join(' | ');
  /* 16:00 LEFT THIS LIST ON 2026-08-12. The live order's own detail page states
     free cancellation before 16:00 on 5 Dec — the SAME window the dead order
     carried. Refusing to carry it across on assumption was still correct: a
     guess that turns out right is a guess, and the app only prints it now
     because the live order prints it. The three figures that remain are the
     ones the live order does NOT state, and they may never reach the front of
     the card. */
  for(const dead of ['289.68','144.84','1,960']){
    if(fpFront.includes(dead)) return 'FAIL Four Points presents a superseded term as its own: '+dead;
  }
  if(!fpText.includes('$244.74')) return 'FAIL Four Points does not show the rebooked price';
  /* INVERTED 2026-08-12. This demanded "not stated" on both chips for sixteen
     days and was right to: the bookings list gave neither. The order DETAIL page
     gives both — free cancellation to 16:00 on 5 Dec, and "Prepay Online ✓
     Paid". The bed had been paid for the whole time. What is defended now is
     that it states its own order rather than drifting back to a research line
     or to the dead order's terms. */
  for(const [k,want] of [['Free cancel',/16:00 Dec 5/i],['Payment',/PREPAID ONLINE/i]]){
    const chip=fpChips.find(c=>c.startsWith(k+'='))||'';
    if(!want.test(chip)) return 'FAIL Four Points lost the term its live order states: "'+chip+'"';
    if(/not stated/i.test(chip)) return 'FAIL Four Points still says "not stated": "'+chip+'"';
  }

  /* The deadline is the money. A generic "free cancellation" chip on Element
     would hide a 46% loss, so each booked bed WITH a stated cut-off must print
     it — and Dec 9 closes TWO windows, Element's at 00:00 and Pullman's at
     23:59. Four Points is deliberately not in this list any more: the 16:00
     Dec 5 window belonged to the order that was replaced. */
  /* Element's 00:00 Dec 9 left with it (cancelled 2026-10-17); Dec 9 still
     closes two windows — the Hi Cozy hostel's at 18:00 and Pullman's at 23:59. */
  const deadlines=[['cn26-stay-13',/18:00 Dec 9/],['cn26-stay-03',/23:59 Dec 9/],
                   ['cn26-stay-06',/23:59 Dec 13/],['cn26-stay-08',/23:59 Dec 15/],
                   ['cn26-stay-09',/23:00 Dec 17/]];
  for(const [id,re] of deadlines){
    const chip=chipsOf(card(id)).find(c=>/^Free cancel=/.test(c))||'';
    if(!re.test(chip)) return 'FAIL '+id+' cancellation chip: "'+chip+'"';
  }
  /* THE ROYAL GARDEN LEFT THIS LIST ON 2026-09-27 — by the other door. It was
     paid in full on 30 Jul and has been NON-REFUNDABLE since 31 Jul; the card
     went on printing "free to 14:00 Dec 19" for two months. It must now say
     PAID and NON-REFUNDABLE and carry no free-cancel chip at all. */
  const rgc=chipsOf(card('cn26-stay-10'));
  if(rgc.some(c=>/^Free cancel=/.test(c))) return 'FAIL the Royal Garden still shows a free-cancel window';
  if(!rgc.some(c=>/^Cancellation=NON-REFUNDABLE/.test(c))) return 'FAIL the Royal Garden does not say NON-REFUNDABLE';
  if(!rgc.some(c=>/^Payment=PAID IN FULL/.test(c))) return 'FAIL the Royal Garden does not say it is paid';
  /* DALI'S CLIFF is the second on the trip that reaches a 100% loss — from
     00:00 on Dec 16 the whole ¥324 is gone — and its desk SHUTS AT 23:00, an
     hour before Yue Tu's, on the night you arrive off the gorge road by shared
     car. Until 2026-09-27 this check also demanded "NOT declared"; the arrival
     had in fact been APPROVED on 27 Jul (22:00–23:00) and nobody had read the
     email. So now: the money, APPROVED, the 23:00 door, and the ETA job. */
  const dali=chipsOf(card('cn26-stay-08'));
  const dcliff=dali.find(c=>/^Then=/.test(c))||'';
  if(!/00:00 Dec 16/.test(dcliff)||!/¥324/.test(dcliff)) return 'FAIL Dali refund cliff: "'+dcliff+'"';
  const darr=dali.find(c=>/^Late arrival=/.test(c))||'';
  if(!/22:00–23:00 APPROVED/i.test(darr)||!/23:00/.test(darr)) return 'FAIL Dali approved arrival: "'+darr+'"';
  if(!dali.some(c=>/WhatsApp your ETA/i.test(c))) return 'FAIL Dali lost the ETA job';
  const dpay=dali.find(c=>/^Payment=/.test(c))||'';
  if(!/not stated/i.test(dpay)) return 'FAIL Dali claims a payment mode nobody stated: "'+dpay+'"';
  const dci=dali.find(c=>/^Check-in=/.test(c))||'';
  if(!/23:00/.test(dci)) return 'FAIL Dali does not show when its desk shuts: "'+dci+'"';
  /* THE VISA-EXIT NIGHT IS PAID AND CONFIRMED. Trip.com had the money and a
     number on 27 Jul while the property had not accepted and the order page
     offered "Expedite Booking"; it accepted on 29 Jul. The bed was booked
     throughout — it was paid — and each state was carried honestly in turn.
     Now the chip must say CONFIRMED, the word "Confirming" must be gone, and
     the note must NOT be drawn as an alert: a warning that outlives its own
     truth teaches the reader to skip warnings, on the one night that cannot
     afford it. The free-cancellation cut-off and the free airport transfer
     that is the entire reason this bed exists are unchanged. */
  const ibis=chipsOf(card('cn26-stay-09'));
  const ist=ibis.find(c=>/^Status=/.test(c))||'';
  if(!/CONFIRMED/i.test(ist)||/CONFIRMING/i.test(ist)) return 'FAIL the ibis does not read CONFIRMED: "'+ist+'"';
  if(card('cn26-stay-09')?.querySelector('.note.alert')) return 'FAIL the ibis note is still drawn as an alert after the order was accepted';
  const ish=ibis.find(c=>/^Shuttle=/.test(c))||'';
  if(!/free airport transfer/i.test(ish)) return 'FAIL the ibis buries its free shuttle: "'+ish+'"';
  const ipay=ibis.find(c=>/^Payment=/.test(c))||'';
  if(!/PREPAID ONLINE/i.test(ipay)||!/25\\.73/.test(ipay)) return 'FAIL the ibis prepayment chip: "'+ipay+'"';
  const ismk=ibis.find(c=>/^Smoking=/.test(c))||'';
  if(!/SMOKING PERMITTED/i.test(ismk)) return 'FAIL the ibis smoking room is not stated: "'+ismk+'"';
  /* YUE TU'S REFUND CLIFF. Free to 23:59 Dec 13, then one night (US$63) is
     gone. Until 27 Sep 2026 (evening) this deadline also decided the gorge bag
     transfer; the inn's third reply that evening (16:36 UTC) said it has no
     contact for Tina's Inn either, so the owner now arranges the bag himself
     (Option B, Jane's Guesthouse) and this cliff is a pure money deadline
     again. The approved 22:00–23:00 arrival rides here too: it is the reason
     the trip's "always declare a late arrival" rule is satisfied for this bed. */
  const yt=chipsOf(card('cn26-stay-06'));
  const cliff=yt.find(c=>/^Then=/.test(c))||'';
  if(!/00:00 Dec 14/.test(cliff)||!/US\\$63/.test(cliff)) return 'FAIL Yue Tu refund cliff: "'+cliff+'"';
  const arr=yt.find(c=>/^Late arrival=/.test(c))||'';
  if(!/22:00–23:00 APPROVED/.test(arr)) return 'FAIL Yue Tu approved arrival window: "'+arr+'"';
  const ytPay=yt.find(c=>/^Payment=/.test(c))||'';
  if(!/1st night charged at booking/i.test(ytPay)) return 'FAIL Yue Tu prepayment chip: "'+ytPay+'"';
  /* PULLMAN'S CLIFF. It is the only three-tier policy on the trip and the only
     bed that reaches a 100% loss: free to 23:59 Dec 9, PARTIAL from 00:00
     Dec 10, and NOTHING back from 00:00 Dec 11 — its own check-in day, and the
     day of the monopoly flight. A card showing only the free window would read
     as safe on Dec 10, when a cancellation then already costs the first night,
     so all three tiers have to be on the screen, with their dates. */
  const pull=chipsOf(card('cn26-stay-03'));
  const partial=pull.find(c=>/partial/i.test(c))||'';
  const norefund=pull.find(c=>/^No refund=/.test(c))||'';
  if(!/00:00 Dec 10/.test(partial)) return 'FAIL Pullman partial-refund tier: "'+partial+'"';
  if(!/00:00 Dec 11/.test(norefund)) return 'FAIL Pullman NON-REFUNDABLE cliff: "'+norefund+'"';
  const pay=pull.find(c=>/^Payment=/.test(c))||'';
  if(!/8 Dec/.test(pay)||/7 Dec/.test(pay)) return 'FAIL Pullman auto-charge date: "'+pay+'"';
  /* Hong Kong checks out at 11:00, not the 12:00 this trip used to assume. */
  const out=chipsOf(card('cn26-stay-10')).find(c=>/^Check-out=/.test(c))||'';
  if(!/11:00/.test(out)||/12:00/.test(out)) return 'FAIL Royal Garden check-out chip: "'+out+'"';
  /* HUATIAN AND GLENVIEW, INVERTED 2026-08-12. Both showed no cancellation terms
     and no payment mode, so both had to say so — "free cancellation" invented
     from old research would have been the most expensive sentence in the app.
     Their order DETAIL pages, opened for the first time that day, state both:
     free before check-in, pay at hotel, ¥419 and ¥1,166. They were never
     unstated; the bookings list simply does not print them.
     Huatian also asks for a CNY 800 deposit at the desk — nearly twice the
     room's price, the only one on the trip, and it has to survive on the card. */
  for(const [id,cash] of [['cn26-stay-04','CNY 419'],['cn26-stay-05','CNY 1,166']]){
    const chips=chipsOf(card(id));
    const fc=chips.find(c=>/^Free cancel=/.test(c))||'';
    const pm=chips.find(c=>/^Payment=/.test(c))||'';
    if(!/free before check-in/i.test(fc)) return 'FAIL '+id+' lost its stated deadline: "'+fc+'"';
    if(!/pay at hotel/i.test(pm)||!pm.includes(cash)) return 'FAIL '+id+' payment chip: "'+pm+'"';
    if(/not stated/i.test(fc+pm)) return 'FAIL '+id+' still says "not stated"';
  }
  {
    const dep=chipsOf(card('cn26-stay-04')).find(c=>/DEPOSIT/i.test(c))||'';
    if(!/800/.test(dep)) return 'FAIL Huatian hides its CNY 800 desk deposit: "'+dep+'"';
  }


  /* NO BED IS NUMBERLESS ANY MORE. This loop used to hold cn26-stay-02 and
     assert it had NO code strip; Element's Agoda confirmation arrived on
     29 Jul 2026 and the list emptied. What is checked instead is the property
     the empty list stands for: every booked bed can be read out at a desk. */
  for(const id of ${JSON.stringify(NUMBERED_BEDS)}){
    if(!card(id)?.querySelector('.codestrip')) return 'FAIL '+id+' has no confirmation number to read out at a desk';
  }
  if(!card('cn26-stay-13')?.innerText.includes('₪136.40')) return 'FAIL cn26-stay-13 does not show ₪136.40';

  /* THE ACADEMY, THE OTHER WAY ROUND (2026-08-12). Everything above asks what a
     booked bed SHOWS; this asks what this one must not invent. No code strip —
     no reference was ever issued. No Manage button — no platform holds it. Both
     absences still stand.
     THE THIRD ABSENCE ENDED ON 2026-08-13. Until then this block also demanded
     that NO price appear anywhere on the card, because the rate had never been
     confirmed in writing and the ~$890/month the document quoted may not be
     shown as one. The school wrote $840 down, so the demand inverts: the price
     row must now EXIST and read $840. It is checked in both directions — the
     figure present, and the old "not confirmed in writing" chip gone — because
     a card that showed both would be telling two stories about the same bed.
     What it must still show is everything else it does have: BOOKED, twelve
     nights, cash on arrival, no cancellation term stated by anyone, and — new
     the same day — the uniform, the refundable room-keeping float, and the
     11:00 Muping pickup with its meeting point still unfixed. */
  {
    const el=card('cn26-stay-11');
    if(!el) return 'FAIL the academy fortnight has no card in Stays';
    if(!/^Booked/.test(stamp('cn26-stay-11'))) return 'FAIL the academy is not stamped booked: "'+stamp('cn26-stay-11')+'"';
    if(el.querySelector('.codestrip')) return 'FAIL the academy invented a reference — none was ever issued';
    const manage=[...(el.querySelectorAll('a.btn')||[])].find(x=>/Manage/i.test(x.textContent));
    if(manage) return 'FAIL the academy links to a platform that does not hold it: '+manage.getAttribute('href');
    /* The price line is the .row.dim under the dates. It was absent for a month
       and must be present now, reading the school's own figure and nothing
       else — $840 is a lump sum for the stay, so a per-night derivation or a
       total multiplied by twelve would both be inventions. */
    const priceRow=[...el.querySelectorAll('.row.dim')].map(r=>r.textContent.trim()).find(t=>/^[~≈]?(US)?[$¥]\\s?[\\d]/.test(t));
    if(!priceRow) return 'FAIL the academy card shows no price, three weeks after the school stated one';
    if(!/\\$840/.test(priceRow)) return 'FAIL the academy price row reads "'+priceRow+'", expected $840';
    const ac=chipsOf(el);
    if(ac.some(c=>/^Price=NOT confirmed in writing/i.test(c))) return 'FAIL the academy still says its price is unconfirmed: '+ac.join(' | ');
    if(!ac.some(c=>/^Price=\\$840 — in writing, 13 Aug 2026/.test(c))) return 'FAIL the academy hides when its price was stated: '+ac.join(' | ');
    /* The two figures that are NOT the price, and must never become one. */
    if(!ac.some(c=>/^Uniform=US\\$50/.test(c))) return 'FAIL the $50 winter uniform is missing: '+ac.join(' | ');
    if(!ac.some(c=>/^Room-keeping=US\\$50 — refundable on leaving/.test(c))) return 'FAIL the refundable room-keeping float is missing: '+ac.join(' | ');
    /* The pickup, confirmed in writing on 13 Aug — with its Muping residue kept
       beside it, because a pickup whose district you cannot see is a pickup you
       will book the wrong hotel for. */
    /* …and on 2026-09-28 the school moved it: earliest 10:30, in the Muping
       hotel lobby. The 11:00 is history and may not be the chip. */
    if(!ac.some(c=>/^Pickup=from 10:30 Mon 23 Nov/.test(c))) return 'FAIL the academy lost the 10:30 Monday pickup: '+ac.join(' | ');
    if(ac.some(c=>/^Pickup=.*11:00/.test(c))) return 'FAIL the academy still shows the superseded 11:00 pickup: '+ac.join(' | ');
    if(!ac.some(c=>/^Pickup=.*Muping/.test(c))) return 'FAIL the pickup hides which district it was offered for: '+ac.join(' | ');
    /* The private room was DROPPED by the owner, not answered by the school, so
       the chip may not still read as an open ask. */
    if(!ac.some(c=>/^Room=no preference/i.test(c))) return 'FAIL the dropped private room still reads as pending: '+ac.join(' | ');
    if(!ac.some(c=>/^Cancellation=none stated/i.test(c))) return 'FAIL the academy invented or dropped a cancellation term: '+ac.join(' | ');
    if(!ac.some(c=>/^Payment=CASH ONLY/i.test(c))) return 'FAIL the academy does not warn that the desk takes cash only';
    if(!ac.some(c=>/^Arrivals=MON\\/TUE\\/WED ONLY/i.test(c))) return 'FAIL the academy lost the arrival-day rule that moved the date';
    if(!/12/.test(ac.find(c=>/^Rooms · nights=/.test(c))||'')) return 'FAIL the academy is not 12 nights';
    /* AND THE ADDRESS IS PRINTED WITHOUT BECOMING A BUTTON — the school's own
       postal line on the note, and still nothing to tap (asserted for the whole
       card by the map-button check further down). */
    if(!/264100/.test(el.innerText)) return 'FAIL the academy card does not print the address the school published';
  }

  /* THE OWNER'S OWN RULE, 2026-07-27: every booked bed shows its PRICE, that it
     IS booked, and a LINK TO THE SITE IT WAS BOOKED ON — so they can open and
     manage it. Where no deep link to the reservation was ever supplied the link
     is the platform's own entry point, and it must be that platform: sending
     someone to Booking.com for a bed they took on Agoda is worse than sending
     them nowhere. Element used to be in this list WITHOUT a confirmation
     number, which was the whole point — not knowing the number is a different
     admission from not being able to get back to the order. Its number arrived
     on 29 Jul 2026 and the link is unchanged: still Agoda's bookings list, and
     still not a deep link nobody ever supplied. */
  const links={'cn26-stay-00':'https://www.trip.com/order/all',
               'cn26-stay-01':'https://www.trip.com/order/all',
               'cn26-stay-03':'https://www.agoda.com/account/bookings.html',
               'cn26-stay-04':'https://www.trip.com/order/all',
               'cn26-stay-05':'https://www.trip.com/order/all',
               'cn26-stay-06':'https://secure.booking.com/mytrips.html',
               'cn26-stay-08':'https://secure.booking.com/mytrips.html',
               'cn26-stay-09':'https://www.trip.com/order/all',
               'cn26-stay-10':'https://www.rghk.com.hk/en/index.php',
               'cn26-stay-12':'https://www.trip.com/order/all',
               'cn26-stay-13':'https://www.trip.com/order/all'};
  for(const [id,href] of Object.entries(links)){
    const a=[...(card(id)?.querySelectorAll('a.btn')||[])].find(x=>/Manage/i.test(x.textContent));
    if(!a) return 'FAIL '+id+' has no link back to the site it was booked on';
    if(a.getAttribute('href')!==href) return 'FAIL '+id+' links to '+a.getAttribute('href');
    if(!/^https:/.test(a.getAttribute('href'))) return 'FAIL '+id+' link is not https';
  }
  /* The Royal Garden was booked DIRECT, so its link is the hotel's own site and
     the reservations desk IS the manage channel — it has to be readable on the
     card, because there is no account to sign into. */
  const rgText=(card('cn26-stay-10')?.innerText)||'';
  if(!rgText.includes('rsvoff@rghk.com.hk')||!rgText.includes('+852 2733 2828')) return 'FAIL the Royal Garden hides its reservations desk';
  /* THE MUPING NIGHT, 2026-09-28: its Trip.com number to read out, ¥164 in
     cash at the desk, free before check-in, and the pickup from its lobby. */
  {
    const el=card('cn26-stay-12');
    const code=el?.querySelector('.codestrip .code');
    if(!code||code.textContent.trim()!=='1653717166174001') return 'FAIL cn26-stay-12 code '+(code?code.textContent.trim():'(none)');
    if(!el.innerText.includes('¥164.00')) return 'FAIL cn26-stay-12 does not show ¥164.00';
    const mc=chipsOf(el);
    if(!mc.some(c=>/^Payment=PAY AT HOTEL — CNY 164\\.00, in CASH/.test(c))) return 'FAIL the Muping night hides that the desk wants cash: '+mc.join(' | ');
    if(!mc.some(c=>/^Free cancel=before check-in/.test(c))) return 'FAIL the Muping night lost its free window: '+mc.join(' | ');
    if(!mc.some(c=>/^Pickup=.*10:30/.test(c))) return 'FAIL the Muping night does not say when the school collects: '+mc.join(' | ');
    if(!el.innerText.includes('锦江之星品尚酒店')) return 'FAIL the Muping night does not print its Chinese name for the driver';
  }
  return 'ok';
})()`, true);
rows.push([bedsBooked === 'ok' ? 'PASS' : 'FAIL', 'Twelve beds booked, all priced, eleven linked', String(bedsBooked).slice(0, 55)]);

/* THE ADDRESS LAYER, three promises.

   1. A driver card that has an address shows it FULL SCREEN under the Chinese
      name, and its own button copies it — that is the thing you hand across
      the front seat. The address is read back out of IndexedDB rather than
      typed in here, so this check stays true when the manifests change.
   2. The same address is folded into the geo: intent behind the map button,
      BEHIND the name, never instead of it.
   3. A bed that ships no button gets one the moment an address is typed. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/driver` });
await wait(2200);
const addrGeo = await js(`(async()=>{
  /* The measured rule (phone, 2026-07-25): the NAME goes to the map, the
     address stays on the driver card. Sending the street buried 北京南站
     under road segments — its street is called 南站幸福路. Only an entry
     that opts in (a chain, where the street picks the branch) sends it. */
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const all=await new Promise(r=>{const q=db.transaction('showCards').objectStore('showCards').getAll();q.onsuccess=()=>r(q.result)});
  db.close();
  const withAddr=all.filter(c=>c.kind==='place'&&c.address);
  if(withAddr.length<5) return 'FAIL only '+withAddr.length+' cards carry an address';
  const card=withAddr.find(c=>!c.addressInSearch&&document.body.innerText.includes(c.native));
  if(!card) return 'FAIL none of them is on screen';
  window.__addrCard=card;
  const row=[...document.querySelectorAll('.zhlist li')].find(r=>r.textContent.includes(card.native));
  const geo=row?.querySelector('.maps button')?.getAttribute('data-geo')||'';
  if(!geo) return 'FAIL no geo on the button';
  if(geo.includes(encodeURIComponent(card.address))) return 'FAIL the street went to the map: '+geo.slice(0,60);
  if(!geo.includes(encodeURIComponent(card.mapQuery))) return 'FAIL the name is missing: '+geo.slice(0,60);
  return 'ok '+withAddr.length+' cards carry an address, none of it searched';
})()`, true);
rows.push([String(addrGeo).startsWith('ok') ? 'PASS' : 'FAIL', 'Address stays off the map search', String(addrGeo).slice(3, 56)]);

const addrCard = await js(`(async()=>{
  const card=window.__addrCard;
  if(!card) return 'FAIL no card to open';
  const copied=[];
  navigator.clipboard.writeText=(t)=>{copied.push(t); return Promise.resolve();};
  const row=[...document.querySelectorAll('.zhlist li')].find(r=>r.textContent.includes(card.native));
  row.querySelector('.txt').click();
  await new Promise(r=>setTimeout(r,700));
  const d=document.querySelector('.driver');
  if(!d) return 'FAIL no overlay';
  if(!d.innerText.includes(card.address)) return 'FAIL overlay text: '+d.innerText.replace(/\\n/g,' | ').slice(0,60);
  const btn=d.querySelector('.addr');
  if(!btn) return 'FAIL no copy button on the address';
  btn.click(); await new Promise(r=>setTimeout(r,400));
  if(copied[0]!==card.address) return 'FAIL copied '+String(copied[0]).slice(0,40);
  return 'ok '+card.address;
})()`, true);
rows.push([String(addrCard).startsWith('ok') ? 'PASS' : 'FAIL', 'Driver card · address, full screen', String(addrCard).slice(3, 56)]);

/* One paste is all it takes. This test used to run on Four Points, precisely
   BECAUSE that bed shipped buttonless; booking it on 2026-07-27 gave it an
   address, so the test MOVED to Blossom House rather than being softened —
   booked, and still buttonless: its bookings-list row named a district, and
   the door its confirmation email prints (found 2026-09-27) rides on the note
   until it has been checked in Amap on the phone. Type an address and the button appears,
   searching for that address. The string below is a TYPED TEST VALUE, not a
   sourced fact — the point is that the button follows whatever is entered. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/cn26-stay-01` });
await wait(2200);
const paste = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const btns=()=>[...(document.getElementById('bk-cn26-stay-01')?.querySelectorAll('.maps button')||[])];
  if(!document.getElementById('bk-cn26-stay-01')) return 'FAIL the Blossom House pass did not draw';
  if(btns().length!==0) return 'FAIL Blossom House already has a button';
  document.querySelector('.editmode').click();
  await sleep(600);
  const card=document.getElementById('bk-cn26-stay-01');
  /* Scoped to THIS card. The edit row lives inside bk-<id>, so searching the
     parent would find the first Edit button on the screen, not this bed's. */
  const edit=[...card.querySelectorAll('button')].find(b=>/Edit/.test(b.textContent));
  if(!edit) return 'FAIL no edit button';
  edit.click(); await sleep(900);
  const input=document.getElementById('f-address');
  if(!input) return 'FAIL no Address field on the stay form';
  const want='北京市西城区后海北沿';
  input.value=want; input.dispatchEvent(new Event('input',{bubbles:true}));
  await sleep(300);
  document.querySelector('.sform button[type=submit]').click();
  await sleep(1800);
  const after=btns();
  if(after.length!==1) return 'FAIL buttons after paste: '+after.length;
  const geo=after[0].getAttribute('data-geo')||'';
  return geo==='geo:0,0?q='+encodeURIComponent(want) ? 'ok' : 'FAIL geo '+geo.slice(0,60);
})()`, true);
rows.push([paste === 'ok' ? 'PASS' : 'FAIL', 'Paste an address · button appears', String(paste).slice(0, 55)]);

await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey/cn26-stop-gorge/guide` });
await wait(2200);
const shared = await js(`(async()=>{
  const seen=[];
  window.open=(u)=>{ seen.push(String(u)); return null; };
  const b=document.querySelector('.maps button');
  if(!b) return 'FAIL no button';
  b.click(); await new Promise(r=>setTimeout(r,400));
  return seen[0]==='https://maps.app.goo.gl/fHfSus2NQN8NmxKcA' ? 'ok' : 'FAIL '+String(seen[0]).slice(0,50);
})()`, true);
rows.push([shared === 'ok' ? 'PASS' : 'FAIL', "Gorge opens the owner's share link", String(shared).slice(0, 50)]);

/* The offline vow. Two separate promises:
   1. the map path is pure link building — it must never reach out by itself;
   2. the weather fetch, the one sanctioned call, must fail in total silence.
   Note CDP's offline emulation does NOT flip navigator.onLine, so the app
   legitimately still attempts the call here; a real airplane mode is covered
   by the next check. */
const remoteMaps = netlog.filter((u) => /amap\.com|google\.com\/maps/.test(u));
const weatherErrs = errs.filter((e) => /open-meteo|weather/i.test(e));
const attempts = netlog.filter((u) => u.includes('open-meteo')).length;
const quiet = remoteMaps.length === 0 && weatherErrs.length === 0;
rows.push([quiet ? 'PASS' : 'FAIL', 'Maps silent, weather fails quietly',
  quiet ? `0 map calls, ${attempts} weather attempt(s), 0 errors`
        : `${remoteMaps.join(' ')} ${weatherErrs.join(' ')}`.slice(0, 60)]);

/* Real airplane mode: navigator.onLine false means the app does not even try. */
await S('Page.addScriptToEvaluateOnNewDocument', {
  source: `Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});`,
});
netlog = [];
await S('Page.navigate', { url: `${BASE}?d=2026-11-25#/trip/cn26/now/day` });
await wait(3000);
const tried = netlog.filter((u) => u.includes('open-meteo'));
const stillThere = String(await js('document.body.innerText')).toLowerCase();
const grounded = tried.length === 0 && (await js('navigator.onLine')) === false
  && stillThere.includes('kunyu academy') && stillThere.includes('usual day');
rows.push([grounded ? 'PASS' : 'FAIL', 'Airplane mode · no attempt at all',
  grounded ? 'onLine=false, 0 requests, Today intact' : `${tried.length} request(s)`]);

/* AND NOW IT SAYS SO. With the network gone the screen used to be
   pixel-identical to the online one — no chip, no dimmed action, nothing — so
   a dead "Find email" tab could be the phone, the Firewall, or a broken app,
   with no way to tell. It is a QUIET chip, not a warning: offline is the
   normal condition of this trip. Same page as the check above, still
   navigator.onLine === false. */
await S('Page.navigate', { url: `${BASE}?d=2026-11-25#/trip/cn26/now` });
await wait(2200);
const offchip = await js(`(async()=>{
  const chip=document.querySelector('.offchip');
  if(!chip) return 'FAIL Now says nothing about being offline';
  if(!/offline/i.test(chip.textContent)) return 'FAIL the chip does not say offline: '+chip.textContent.trim();
  if(!/showing saved data/i.test(chip.textContent)) return 'FAIL it does not say the data is saved, not stale-live';
  /* dim, not crit — this is a normal state, not a failure */
  const col=getComputedStyle(chip).color;
  if(/rgb\\(255, 95, 82\\)/.test(col)) return 'FAIL the offline chip shouts in crit red';
  /* the update banner must not be sitting there telling him to reload */
  const b=document.getElementById('sw-update');
  if(b && b.classList.contains('show')) return 'FAIL "tap to reload" is on screen with no network';
  return 'ok '+chip.textContent.trim();
})()`, true);
rows.push([String(offchip).startsWith('ok') ? 'PASS' : 'FAIL', 'Offline · the app says so, quietly', String(offchip).slice(3, 56)]);

/* And the Pocket carries the same chip, because it is the other screen read
   while standing still with no signal (Info's job before Horizon). Quiet, not
   crit: offline is this trip's normal. */
await S('Page.navigate', { url: `${BASE}?d=2026-11-25#/trip/cn26/pocket` });
await wait(2500);
const offinfo = await js(`(()=>{
  const chip=document.querySelector('.offchip');
  if(!chip||!/offline/i.test(chip.textContent)) return 'FAIL the Pocket is silent about being offline';
  if(/rgb\\(255, 95, 82\\)/.test(getComputedStyle(chip).color)) return 'FAIL the offline chip shouts in crit red';
  return 'ok';
})()`);
rows.push([offinfo === 'ok' ? 'PASS' : 'FAIL', 'Offline · the Pocket says so too', String(offinfo).slice(0, 50)]);

/* ============================================================
   LANTERN RUN C1 — THE DRIVE BACKUP, WHICH IS NOT CONNECTED AND MUST
   THEREFORE BE COMPLETELY SILENT.

   The app gained a second permitted runtime call: an opt-in Google Drive
   backup, so a phone lost in China costs a device and not the trip. It ships
   with a NULL client id (only the owner can create one — docs/DRIVE-SETUP.md),
   which means every install that is not theirs is in the 'unconfigured' state.

   Two promises are walked here, and neither is deleted or weakened elsewhere:

   1. the network vow grows by one host family. googleapis.com / accounts.
      google.com are permitted ONLY while the feature is connected, which in a
      rehearsal it never is — so the tally must be exactly zero, and this whole
      walk (from the moment we went offline at the top) is the window;
   2. the card says so HONESTLY. "Not connected" with a Connect button would be
      a lie on a build that has no credential to connect with, so the
      unconfigured state offers no button at all and names the missing step.
   ============================================================ */
const driveConnected = await js(`(async()=>{
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  if(!db.objectStoreNames.contains('meta')){ db.close(); return false; }
  const tok=await new Promise(r=>{const q=db.transaction('meta').objectStore('meta').get('drive.tokens');q.onsuccess=()=>r(q.result)});
  db.close();
  return !!tok;
})()`, true);
const gapis = netlog.filter((u) => /googleapis\.com|accounts\.google\.com|oauth2\.google/.test(u));
/* The whitelist is conditional by construction: connected would permit them,
   and connected is a state this walk can never be in. */
const gquiet = driveConnected === true ? true : gapis.length === 0;
rows.push([gquiet ? 'PASS' : 'FAIL', 'Drive · zero Google calls, not connected',
  gquiet ? `not connected, ${gapis.length} google call(s)` : gapis.slice(0, 2).join(' ').slice(0, 60)]);

await S('Page.navigate', { url: `${BASE}#/backup` });
await wait(2500);
/* Since the Reminders run (owner, 29 Sep 2026: "skip the Google Cloud
   Console, all will be on the phone") an UNCONFIGURED Drive shows no card
   at all: backups leave through the share menu to the Google Drive app.
   The rule it keeps: nothing on the screen promises a sign-in no tap can
   deliver, and the save is still one tap. */
const drivecard = await js(`(async()=>{
  const card=document.querySelector('.drivecard');
  if(card) return 'FAIL an unconfigured Drive still draws its sign-in card';
  if(/one-time google setup|connect google drive/i.test(document.body.innerText)) return 'FAIL a Google sign-in is still offered';
  const save=[...document.querySelectorAll('button')].find(b=>/Save everything|Back up to Drive/.test(b.textContent));
  if(!save) return 'FAIL no one-tap save';
  return 'ok no dead sign-in card, one-tap save';
})()`, true);
rows.push([String(drivecard).startsWith('ok') ? 'PASS' : 'FAIL', 'Drive · no sign-in card, one-tap save', String(drivecard).slice(3, 56)]);

/* Rendering the card must not itself be a reason to call Google. */
const gapisAfter = netlog.filter((u) => /googleapis\.com|accounts\.google\.com|oauth2\.google/.test(u));
rows.push([gapisAfter.length === 0 ? 'PASS' : 'FAIL', 'Drive card · drawing it calls nobody',
  gapisAfter.length === 0 ? '0 calls after the card rendered' : gapisAfter.slice(0, 2).join(' ').slice(0, 60)]);

/* ============================================================
   LANTERN RUN C2 — THE SMALL ROAD TOOLS, WALKED WITH THE NETWORK STILL OFF.

   A converter that fetches a rate is a blank card behind the Firewall, and an
   insurance policy that lives in an inbox is a policy you do not have in a
   hospital. Both are built out of data the trip already carries, and both are
   therefore walked here — offline, where they will actually be used.
   ============================================================ */
await S('Page.navigate', { url: `${BASE}?d=2026-12-05#/trip/cn26/pocket/convert` });
await wait(2500);

const conv = await js(`(async()=>{
  const card=document.querySelector('.convcard');
  if(!card) return 'FAIL the Pocket has no converter';
  const amt=card.querySelector('input');
  const sels=[...card.querySelectorAll('select')];
  if(!amt||sels.length<2) return 'FAIL the converter has no amount and two currencies';
  /* USD -> CNY at the trip's own rate: 100 becomes 715. */
  sels[0].value='USD'; sels[0].dispatchEvent(new Event('change',{bubbles:true}));
  sels[1].value='CNY'; sels[1].dispatchEvent(new Event('change',{bubbles:true}));
  amt.value='100'; amt.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,700));
  const out=card.querySelector('.out').innerText.replace(/[^0-9.]/g,'');
  if(!/^715/.test(out)) return 'FAIL 100 USD did not become 715 CNY, it became '+out;
  /* and it must SAY where that rate came from, not present it as live */
  const t=card.innerText.replace(/\\s+/g,' ');
  if(!/1 USD = 7.15 CNY/.test(t)) return 'FAIL the rate is not stated as a sentence: '+t.slice(0,70);
  if(!/rate this trip was planned with|your rate|what you spent/i.test(t)) return 'FAIL the rate has no provenance: '+t.slice(0,90);
  return 'ok 100 USD = 715 CNY, rate sourced';
})()`, true);
rows.push([String(conv).startsWith('ok') ? 'PASS' : 'FAIL', 'Converter · computes with no network', String(conv).slice(3, 56)]);

await S('Page.navigate', { url: `${BASE}?d=2026-12-05#/trip/cn26/pocket/health` });
await wait(2500);
const health = await js(`(()=>{
  const card=document.querySelector('.healthcard');
  if(!card) return 'FAIL the Pocket has no health & insurance screen';
  const t=card.innerText.replace(/\\s+/g,' ');
  if(!/insurance/i.test(t)) return 'FAIL it does not name the policy: '+t.slice(0,70);
  /* the numbers you would want while somebody else is driving */
  if(!/police/i.test(t)) return 'FAIL no local emergency number gathered here';
  if(!/ambulance/i.test(t)) return 'FAIL no ambulance number gathered here';
  /* every number here must be dialable, not just readable */
  const tels=[...card.querySelectorAll('a[href^="tel:"]')];
  if(tels.length<3) return 'FAIL only '+tels.length+' number(s) are actually dialable';
  /* and the trip's own medicine words, not ours */
  if(!/medicine rules/i.test(t)) return 'FAIL the medicine note did not come along';
  return 'ok '+tels.length+' dialable numbers, policy + medicine';
})()`);
rows.push([String(health).startsWith('ok') ? 'PASS' : 'FAIL', 'Health · one place, and it dials', String(health).slice(3, 56)]);

/* ============================================================
   LANTERN RUN C3.2 — THE A11Y FLOOR, SWEPT ACROSS THE WHOLE APP.

   Two properties that are cheap to hold and expensive to notice you have
   lost: every control can be reached by keyboard and SHOWS it, and no control
   is a glyph with no name. Swept over the five tabs plus Backup and Settings
   rather than asserted per-screen, so a new icon button anywhere fails here.
   ============================================================ */
const A11Y_URLS = ['#/trip/cn26/now', '#/trip/cn26/now/day', '#/trip/cn26/journey',
  '#/trip/cn26/journey/cn26-stop-zhangjiajie', '#/trip/cn26/journey/cn26-stop-zhangjiajie/guide', '#/trip/cn26/pocket',
  '#/trip/cn26/pocket/money', '#/trip/cn26/pocket/cn26-flight-ey888', '#/trip/cn26/pocket/driver',
  '#/trip/cn26/find', '#/trip/cn26/now/todo', '#/trips', '#/backup', '#/settings'];
const nameless = [];
let focusChecked = 0;
let focusBad = 0;
const focusWho = [];
for (const u of A11Y_URLS) {
  await S('Page.navigate', { url: `${BASE}?d=2026-12-05${u}` });
  await wait(1800);
  const found = await js(`(()=>{
    const bad=[];
    for(const b of document.querySelectorAll('button')){
      /* textContent, NOT innerText: innerText is layout-dependent and answers
         '' for anything currently collapsed or hidden (the update banner, a
         closed accordion), which would report a perfectly well-named button
         as nameless. An accessible name comes from the DOM, not the layout. */
      const name=(b.getAttribute('aria-label')||b.getAttribute('title')||b.textContent||'').trim();
      /* a glyph is not a name: strip anything that is not a letter or digit */
      if(!name.replace(/[^\\p{L}\\p{N}]/gu,'')) bad.push((b.className||'(no class)')+':'+(b.textContent||'').trim().slice(0,6));
    }
    return bad.slice(0,4).join(' | ');
  })()`);
  if (found) nameless.push(`${u} ${found}`);
  /* Focus is a STATE THE EYE CAN FIND: the global rule paints
     a sunrise outline, and a control that overrides it back to none is
     invisible to a keyboard. Horizon moved much of the app onto LINKS (the nav,
     the Pocket's rows and tiles), so links are swept too; a control a keyboard
     cannot reach at all — the update banner while it is hidden — is not a
     control on this screen and is left out rather than counted as a failure. */
  const focus = await js(`(()=>{
    const reach=(el)=>!el.disabled&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
    const ctrls=[...document.querySelectorAll('button, a[href]')].filter(reach).slice(0,8);
    let checked=0,bad=0; const who=[];
    for(const b of ctrls){
      b.focus();
      if(document.activeElement!==b) continue;
      const s=getComputedStyle(b);
      checked++;
      const ring=(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||s.boxShadow!=='none';
      if(!ring){ bad++; who.push(String(b.className).split(' ')[0]||b.tagName); }
    }
    return checked+'/'+bad+'/'+who.join(',');
  })()`);
  const [c, b, who] = String(focus).split('/');
  focusChecked += Number(c) || 0;
  focusBad += Number(b) || 0;
  if (Number(b)) focusWho.push(`${u} ${who}`);
}
rows.push([nameless.length === 0 ? 'PASS' : 'FAIL', 'A11y · every button has a name',
  nameless.length === 0 ? `${A11Y_URLS.length} screens swept, 0 nameless` : nameless.join(' ').slice(0, 60)]);
rows.push([focusBad === 0 ? 'PASS' : 'FAIL', 'A11y · focus is visible, not implied',
  focusBad === 0 ? `${focusChecked} controls, all show focus` : `${focusBad}/${focusChecked} show nothing: ${focusWho.join(' ; ')}`.slice(0, 90)]);

/* ============================================================
   HORIZON RUN 1 — THE POCKET, THE PASS, COUNTER MODE, FIND, THE SHELF AND
   SETTINGS, WALKED WITH THE NETWORK STILL OFF.

   Each of these is a promise the new screens make that the old ones did not
   have to: today's code first, a counter view a desk can read, the one search
   that puts the Capital-vs-Daxing trap above everything, a shelf that draws
   the trip from its real coordinates, and a route-animation switch that
   actually stills the routes.
   ============================================================ */

/* TODAY'S CODE, FIRST. Dec 11 was the Daxing flight until 2026-10-17;
   skiing was dropped, and Dec 11's flight is MU394 from Pudong — planned and
   BOOKED that day — so the Pocket opens on it with its code in full and
   Counter mode one tap away, and never on CA8609, cancelled the same day.
   The code is read out of IndexedDB rather than typed here. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/pocket` });
await wait(2400);
const pocketPending = await js(`(async()=>{
  const card=document.querySelector('.today');
  if(!card) return 'FAIL the Pocket does not open on today';
  const t=card.innerText.replace(/\\s+/g,' ');
  if(!/MU ?394/.test(t)) return 'FAIL today is not MU394: '+t.slice(0,60);
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const b=await new Promise(r=>{const q=db.transaction('bookings').objectStore('bookings').get('cn26-flight-mu394');q.onsuccess=()=>r(q.result)});
  db.close();
  if(!b||!b.code) return 'FAIL MU394 has no code in the database';
  const shown=(card.querySelector('.td-codeval')?.textContent||'').replace(/\\s+/g,'');
  if(shown!==b.code) return 'FAIL today shows '+shown+', not '+b.code;
  if(![...card.querySelectorAll('button')].some(b=>/Counter mode/i.test(b.textContent))) return 'FAIL no Counter mode on today';
  if(/CA ?8609/.test(t)) return 'FAIL the Pocket leads with CA8609, cancelled';
  return 'ok MU 394, booked, its code in full, Counter mode';
})()`, true);
rows.push([String(pocketPending).startsWith('ok') ? 'PASS' : 'FAIL', 'Pocket · Dec 11, today\'s code', String(pocketPending).slice(3, 56)]);
await S('Page.navigate', { url: `${BASE}?d=2026-12-16#/trip/cn26/pocket` });
await wait(2400);
const pocketToday = await js(`(async()=>{
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const bk=await new Promise(r=>{const q=db.transaction('bookings').objectStore('bookings').get('cn26-flight-3u8011');q.onsuccess=()=>r(q.result)});
  db.close();
  if(!bk||!bk.code) return 'FAIL the Dec 16 flight has no code in the vault';
  const card=document.querySelector('.today');
  if(!card) return 'FAIL the Pocket does not open on today';
  const t=card.innerText.replace(/\\s+/g,' ');
  if(!/3U ?8011/.test(t)) return 'FAIL today is not 3U8011: '+t.slice(0,60);
  const shown=(card.querySelector('.td-codeval')?.textContent||'').trim();
  if(shown!==bk.code) return 'FAIL the code is not shown in full';
  if(!card.classList.contains('opal-edge')) return 'FAIL today is not the lit card';
  const cm=[...card.querySelectorAll('button')].find(b=>/Counter mode/i.test(b.textContent));
  if(!cm) return 'FAIL no Counter mode on today';
  /* the driver cards ride under it as white chips */
  const chips=document.querySelectorAll('.paperchip');
  if(chips.length<1) return 'FAIL no driver chips on the Pocket';
  return 'ok 3U 8011, code in full, '+chips.length+' driver chips';
})()`, true);
rows.push([String(pocketToday).startsWith('ok') ? 'PASS' : 'FAIL', 'Pocket · today’s code first', String(pocketToday).slice(3, 56)]);

/* RUN 3b — NO NAME CUT SHORT, ON THE BOARDS' WIDTH AND THE S23'S. The
   driver chips clamped "Beijing Daxing International Airport (PKX)" to
   "Beijing Daxing International…"; they now carry the short name the boards
   write ("Beijing Daxing (PKX)") and the whole one as their accessible name,
   and nothing on them is hidden. Since 2026-10-17 Dec 11 names two cards of
   its own (the Zhangjiajie airport and Wulingyuan), and the third chip falls
   back to the trip's first card — the academy's, in the school's own long
   words, which a chip clamps by design (the white card shows them whole).
   The day's own chips are the ones held to "whole"; Dec 16, the one day
   with three cards of its own, has two names longer than a chip. The app bar's pill says "VISA", not
   "MAINLAND VISA", with the full name still its accessible name. Walked at
   412 px and again at 384 px, the S23 Ultra's width. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/pocket` });
await wait(2200);
const pocketNames = `(()=>{
  const chips=[...document.querySelectorAll('.paperchip')];
  if(chips.length!==3) return 'FAIL '+chips.length+' driver chips';
  const own=chips.filter(c=>/张家界荷花国际机场|武陵源/.test(c.textContent));
  if(own.length!==2) return 'FAIL the day’s own two cards are not the first chips';
  if(!/昆嵛山武校/.test(chips[2].textContent)) return 'FAIL the third chip is not the trip’s first card';
  const cut=own.map(c=>c.querySelector('.pc-en')).filter(e=>e.scrollHeight>e.clientHeight+1).map(e=>e.textContent);
  if(cut.length) return 'FAIL cut short: '+cut.join(' | ');
  const dyg=own.find(c=>/张家界荷花国际机场/.test(c.textContent));
  const en=(dyg?.querySelector('.pc-en')?.textContent||'').trim();
  if(en!=='Zhangjiajie Hehua (DYG)') return 'FAIL the Zhangjiajie airport chip reads '+en;
  if(!/Zhangjiajie Hehua Airport \\(DYG\\)/.test(dyg.getAttribute('aria-label')||'')) return 'FAIL the chip lost its full name';
  const tk=[...document.querySelectorAll('.tk-l')].filter(l=>l.scrollWidth>l.clientWidth+1).map(l=>l.textContent);
  if(tk.length) return 'FAIL a wallet label is cut: '+tk.join(', ');
  const p=document.querySelector('.statuspill');
  const k=(p?.querySelector('.sp-k')?.textContent||'').trim();
  if(k!=='visa') return 'FAIL the pill says '+k;
  if(!/^Mainland visa: \\d+[/]30$/.test(p.getAttribute('aria-label')||'')) return 'FAIL the pill is named '+p.getAttribute('aria-label');
  return 'ok '+innerWidth+' px · '+chips.map(c=>c.querySelector('.pc-en').textContent.trim()).join(' · ');
})()`;
const names412 = await js(pocketNames);
rows.push([String(names412).startsWith('ok') ? 'PASS' : 'FAIL', 'Pocket · whole names, 412 px', String(names412).slice(3, 60)]);
await S('Emulation.setDeviceMetricsOverride', { width: 384, height: 824, deviceScaleFactor: 2, mobile: true });
await wait(700);
const names384 = await js(pocketNames);
rows.push([String(names384).startsWith('ok') ? 'PASS' : 'FAIL', 'Pocket · whole names, 384 px (the S23)', String(names384).slice(3, 60)]);
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
await wait(500);

/* COUNTER MODE: the code at desk size on white paper, and Android back puts
   the pass back. */
const counter = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  location.hash='#/trip/cn26/pocket/cn26-flight-mu394'; await sleep(1200);
  const pass=document.getElementById('bk-cn26-flight-mu394');
  if(!pass) return 'FAIL the pass did not open';
  const code=(pass.querySelector('.codestrip .code')?.textContent||'').trim();
  if(!code) return 'FAIL the pass shows no code';
  const btn=[...document.querySelectorAll('.ps-actions button')].find(b=>/Counter mode/i.test(b.textContent));
  if(!btn) return 'FAIL the pass has no Counter mode button';
  btn.click(); await sleep(900);
  const cm=document.querySelector('.counter');
  if(!cm) return 'FAIL Counter mode did not open';
  const cmCode=(cm.querySelector('.cm-code')?.textContent||'').trim();
  if(cmCode!==code) return 'FAIL Counter mode shows a different code';
  const bg=(getComputedStyle(cm).backgroundColor.match(/\\d+/g)||[]).slice(0,3).map(Number);
  if(bg.reduce((a,b)=>a+b,0)<700) return 'FAIL Counter mode is not white paper: '+getComputedStyle(cm).backgroundColor;
  const px=parseFloat(getComputedStyle(cm.querySelector('.cm-code')).fontSize);
  if(px<28) return 'FAIL the desk code is only '+px+' px';
  const r=cm.getBoundingClientRect();
  if(r.width<window.innerWidth-1||r.height<window.innerHeight-1) return 'FAIL Counter mode is not full screen';
  if(document.querySelector('.navbar')&&document.elementFromPoint(window.innerWidth/2,window.innerHeight-30)?.closest('.navbar')) return 'FAIL the nav bar shows through Counter mode';
  history.back(); await sleep(900);
  if(document.querySelector('.counter')) return 'FAIL back did not close Counter mode';
  if(!/\\/pocket\\/cn26-flight-mu394$/.test(location.hash)) return 'FAIL back left the pass: '+location.hash;
  return 'ok '+px+' px on white, back returns to the pass';
})()`, true);
rows.push([String(counter).startsWith('ok') ? 'PASS' : 'FAIL', 'Counter mode · desk size, white, back', String(counter).slice(3, 56)]);

/* RUN 3b — THE PASS AS THE BOARD DRAWS IT. A lit pass wears its opal edge
   (its own ground had been painting over it) and the perforation's two
   notches cut it; the airports' names sit short under the codes, whole in
   the pass's accessible name; a flight offers the vault's flight manifest
   (tag "ticket", named "Flight manifest…"), and Counter mode reads the route
   in two lines, no word broken. */
/* Walked on MU394 since 2026-10-17 (the Dec 11 flight; CA8609, cancelled,
   no longer lights). */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/pocket/cn26-flight-mu394` });
await wait(2200);
const passLook = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const pass=document.querySelector('#bk-cn26-flight-mu394 .pass');
  if(!pass) return 'FAIL no MU 394 pass';
  if(!pass.classList.contains('opal-edge')||!/gradient/.test(getComputedStyle(pass).backgroundImage)) return 'FAIL the lit pass has no opal edge';
  if(pass.querySelectorAll('.ps-perf .n').length!==2) return 'FAIL the perforation has no notches';
  const ends=(pass.querySelector('.pe-names')?.innerText||'').replace(/\\s+/g,' ').trim();
  if(ends!=='Shanghai Pudong · T1 Zhangjiajie Hehua · T2') return 'FAIL the ends read '+ends;
  if(!/Shanghai Pudong Intl · Terminal 1 → Zhangjiajie Hehua · Terminal 2/.test(pass.getAttribute('aria-label')||'')) return 'FAIL the full names left the pass';
  const date=pass.querySelector('.pe-date');
  if(!date||date.getBoundingClientRect().height>24) return 'FAIL the date wraps between the codes';
  const doc=[...pass.querySelectorAll('.pf-doc')].map(b=>b.textContent.replace(/\\s+/g,' ').trim());
  if(!doc.includes('E-ticket · Flight manifest (PDF)')) return 'FAIL no e-ticket row: '+doc.join(' | ');
  [...document.querySelectorAll('.ps-actions button')].find(b=>/Counter mode/i.test(b.textContent)).click(); await sleep(900);
  const lines=[...document.querySelectorAll('.counter .cm-line')].map(l=>l.textContent.trim());
  if(lines.join(' | ')!=='Shanghai Pudong · T1 (PVG) | → Zhangjiajie Hehua · T2 (DYG)') return 'FAIL the desk route reads '+lines.join(' | ');
  const tall=[...document.querySelectorAll('.counter .cm-line')].filter(l=>l.getBoundingClientRect().height>40).length;
  if(tall) return 'FAIL the route wraps';
  history.back(); await sleep(700);
  return 'ok opal edge, notches, '+doc[0];
})()`, true);
rows.push([String(passLook).startsWith('ok') ? 'PASS' : 'FAIL', 'Pass · edge, notches, ends, e-ticket, desk route', String(passLook).slice(3, 60)]);

/* FIND, ON DEC 11. Until 2026-10-17 "daxing" was the search a traveller made
   on Dec 11 and the Capital-airport card came first as a warning. Skiing was
   dropped and Dec 11 leaves from PUDONG on MU394 (booked the same day): "pudong"
   finds that flight and today's step, no driver card warns about any airport
   any more (the warning mechanism is proved on its own in find.test.ts), and
   the flight's row opens its pass. Joins, never guesses (logic/find.ts). */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/find` });
await wait(2200);
const findWarn = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const q=document.getElementById('find-q');
  if(!q) return 'FAIL Find has no search field';
  q.value='daxing'; q.dispatchEvent(new Event('input',{bubbles:true}));
  await sleep(800);
  if(document.querySelector('.fresults .fwarn .fw-box.wrong')) return 'FAIL an airport warning is still drawn for "daxing"';
  q.value='pudong'; q.dispatchEvent(new Event('input',{bubbles:true}));
  await sleep(800);
  const res=document.querySelector('.fresults');
  if(!res) return 'FAIL no results region';
  if(res.querySelector('.fw-box.wrong')) return 'FAIL "pudong" draws an airport warning';
  const row=[...document.querySelectorAll('.fresults .frow')].find(b=>/MU ?394/.test(b.innerText));
  if(!row) return 'FAIL MU394 is not found by "pudong"';
  row.click(); await sleep(1000);
  if(!/\\/pocket\\/cn26-flight-mu394$/.test(location.hash)) return 'FAIL the flight row went to '+location.hash;
  return 'ok no airport warning · "pudong" → the MU 394 pass';
})()`, true);
rows.push([String(findWarn).startsWith('ok') ? 'PASS' : 'FAIL', 'Find · Dec 11, Pudong and no stale warning', String(findWarn).slice(3, 56)]);

/* A PLACE FOUND OPENS ITS GUIDE AT THE PLACES (Horizon Run 3): a spot result
   lands on its city's guide, on the Places chapter where its map button is —
   not at the top of the longest page in the app; a stop result opens the city. */
const findSpot = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  location.hash='#/trip/cn26/find'; await sleep(1000);
  const q=document.getElementById('find-q');
  if(!q) return 'FAIL Find has no search field';
  q.value='beihai park'; q.dispatchEvent(new Event('input',{bubbles:true}));
  await sleep(800);
  const rowsNow=[...document.querySelectorAll('.fresults .frow')];
  const spot=rowsNow.find(b=>(b.querySelector('.fr-title')||{}).textContent?.trim()==='Beihai Park');
  if(!spot) return 'FAIL no Beihai Park result';
  spot.click(); await sleep(1700);
  if(!/journey\\/cn26-stop-beijing\\/guide$/.test(location.hash)) return 'FAIL the spot went to '+location.hash;
  const eat=document.getElementById('g-eat');
  if(!eat) return 'FAIL the guide has no Places chapter';
  const top=eat.getBoundingClientRect().top;
  if(top<-40||top>window.innerHeight/2) return 'FAIL the guide did not open at Places ('+Math.round(top)+' px)';
  if(!/北海公园/.test(eat.textContent)) return 'FAIL Beihai Park is not in the Places chapter';
  return 'ok Beihai Park → the Beijing guide, at Places';
})()`, true);
rows.push([String(findSpot).startsWith('ok') ? 'PASS' : 'FAIL', 'Find · a place opens its guide at Places', String(findSpot).slice(3, 56)]);

/* THE SHELF DRAWS THE TRIP FROM ITS REAL COORDINATES. On Dec 11 China 2026 is
   day 21 of 37 with tonight in Zhangjiajie and sixteen days to go — each figure
   derived from the trip's own dates and stops — and its constellation places
   the nine stops that carry a coordinate (ten until Shanghai replaced
   Chongli on 2026-10-17 — it has none), labelling the first, tonight's and
   the last. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trips` });
await wait(2200);
const shelfMap = await js(`(()=>{
  const card=[...document.querySelectorAll('.tripcard')].find(c=>/China 2026/.test(c.innerText));
  if(!card) return 'FAIL no China 2026 card on the shelf';
  if(!card.classList.contains('lead')) return 'FAIL the trip on the road is not the lead card';
  const t=card.innerText.replace(/\\s+/g,' ');
  for(const s of ['Day 21 of 37','Zhangjiajie','16 days to go','Continue the trip']){
    if(!t.includes(s)) return 'FAIL the card does not say '+s;
  }
  const svg=card.querySelector('svg.shelfmap');
  if(!svg) return 'FAIL no constellation on the card';
  const stars=svg.querySelectorAll('.done-dot, .here-dot, .ahead-dot').length;
  if(stars!==9) return 'FAIL '+stars+' stars, expected the 9 stops with a coordinate';
  if(svg.querySelectorAll('.here-dot').length!==1) return 'FAIL tonight is not one ringed star';
  const labels=[...svg.querySelectorAll('text')].map(x=>x.textContent).join('|');
  if(!/TONIGHT/.test(labels)||!/ZHANGJIAJIE/.test(labels)) return 'FAIL tonight is not labelled: '+labels;
  if(!/HONG KONG/.test(labels)) return 'FAIL the last stop is not labelled: '+labels;
  if(!document.querySelector('a[href="#/settings"]')) return 'FAIL the shelf has no way to Settings';
  return 'ok day 21 of 37, 9 stars, '+labels.replace(/\\|/g,' · ').slice(0,40);
})()`);
rows.push([String(shelfMap).startsWith('ok') ? 'PASS' : 'FAIL', 'Shelf · the route as a constellation', String(shelfMap).slice(3, 56)]);

/* ROUTE ANIMATIONS IS A REAL SWITCH. Off stills the route lines (html gets
   no-routes) and says so; Calm motion holds everything and the route row says
   it is paused rather than claiming "on". Both are put back as found. */
await S('Page.navigate', { url: `${BASE}#/settings` });
await wait(2200);
const routeSwitch = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const row=(re)=>[...document.querySelectorAll('label.row')].find(l=>re.test(l.textContent));
  const routes=row(/Route animations/)?.querySelector('input');
  const calm=row(/Calm motion/)?.querySelector('input');
  if(!routes||!calm) return 'FAIL Settings lacks the Route animations or Calm motion switch';
  if(!routes.checked) return 'FAIL route animations are not on by default';
  const html=document.documentElement;
  if(html.classList.contains('no-routes')) return 'FAIL routes are stilled with the switch on';
  routes.click(); await sleep(700);
  if(!html.classList.contains('no-routes')) return 'FAIL switching off did not still the routes';
  if(!/off, the map stays still/i.test(row(/Route animations/).textContent)) return 'FAIL the row does not say it is off';
  routes.click(); await sleep(700);
  if(html.classList.contains('no-routes')) return 'FAIL switching on did not bring them back';
  calm.click(); await sleep(700);
  if(!html.classList.contains('calm')) return 'FAIL Calm motion did not reach the document';
  if(!/paused by Calm motion/i.test(row(/Route animations/).textContent)) return 'FAIL the route row claims "on" under Calm motion';
  calm.click(); await sleep(700);
  if(html.classList.contains('calm')||html.classList.contains('no-routes')) return 'FAIL the switches were not put back';
  return 'ok off stills the routes, calm pauses them, both restored';
})()`, true);
rows.push([String(routeSwitch).startsWith('ok') ? 'PASS' : 'FAIL', 'Settings · route animations switch', String(routeSwitch).slice(3, 56)]);

/* ============================================================
   HORIZON RUN 2 — NOW: THE MAP, THE ONE SENTENCE, THE TILES, THE TRAVEL
   DAY AS A METRO LINE, THE FOCUS CARD, TO DO — walked with the network
   still off.

   Each of these is a promise Now makes that Lantern's Home did not have to:
   the trip drawn from its real coordinates with the one leg that moves; one
   plain sentence made only of the trip's own facts; five tiles and no NOW
   tile; a travel day generated from its bookings, joined to its runbook by
   exact words; a Done that is a write; motion that keeps its rules.
   ============================================================ */

/* THE HOME ON DEC 11 (f-now). It was "the Daxing day" — ten stars, CHONGLI ·
   YOU, a flowing leg — until 2026-10-17. Skiing was dropped: you are in
   Shanghai, which has no verified coordinate, so the board draws nine stars,
   NO YOU and no flowing leg rather than a YOU on the wrong star (it read
   BEIJING · YOU before constellation.ts learned that a leg skipping an
   unplaced stop is never where you stand). Tonight is still Zhangjiajie; the
   sentence is step 1 of 7, in the step's own words; the tiles in the board's
   order. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/now` });
await wait(2400);
const nowHome = await js(`(()=>{
  const svg=document.querySelector('.nh-map svg.tmap');
  if(!svg) return 'FAIL Now has no map';
  const stars=svg.querySelectorAll('.here-dot, .done-dot, .ahead-dot').length;
  if(stars!==9) return 'FAIL '+stars+' stars, expected the 9 located stops';
  const labels=[...svg.querySelectorAll('text.lbl')].map(t=>t.textContent).join('|');
  if(/· YOU/.test(labels)) return 'FAIL a YOU on the board while you are in Shanghai: '+labels.slice(0,80);
  for(const w of ['ZHANGJIAJIE','TONIGHT','LIJIANG · GORGE · DALI','HONG KONG','KUNMING']){
    if(!labels.includes(w)) return 'FAIL the map does not say '+w+': '+labels.slice(0,80);
  }
  if(svg.querySelectorAll('.fl-line.flow').length!==0) return 'FAIL a leg flows from a star you are not at';
  if(svg.querySelectorAll('.leg.done').length!==1) return 'FAIL the road so far is not the one leg behind you: '+svg.querySelectorAll('.leg.done').length;
  if(svg.querySelector('circle.ping')) return 'FAIL a you-are-here ping with no star for you';
  const se=document.querySelector('a.sentence');
  if(!se) return 'FAIL no sentence';
  const st=se.innerText.replace(/\\s+/g,' ');
  if(!/step 1 of 7/i.test(st)) return 'FAIL the sentence is not on step 1: '+st;
  if(!/Breakfast, check out by 12:00, and leave the bag at Hi Cozy\\./.test(st)) return 'FAIL the sentence reads '+st;
  const kinds=[...document.querySelectorAll('.rail .tile')].map(t=>(t.className.match(/t-(next|tonight|visa|driver|todo)/)||[])[1]);
  if(kinds.join(',')!=='next,tonight,visa,driver,todo') return 'FAIL tiles '+kinds.join(',');
  if(/\\bNOW\\b/.test([...document.querySelectorAll('.rail .t-caps')].map(c=>c.textContent).join('|'))) return 'FAIL there is a NOW tile';
  const tonight=document.querySelector('.t-tonight').innerText;
  if(!/Pullman/.test(tonight)||!/Booked/i.test(tonight)) return 'FAIL tonight tile: '+tonight;
  if(document.querySelector('.t-visa .tv-day').textContent.trim()!=='19') return 'FAIL the visa tile is not on day 19';
  if(!/张家界荷花国际机场/.test(document.querySelector('.t-driver').innerText)) return 'FAIL the driver card is not the airport you land at: '+document.querySelector('.t-driver').innerText.slice(0,40);
  return 'ok 9 stars · no YOU in Shanghai · the sentence · 5 tiles';
})()`);
rows.push([String(nowHome).startsWith('ok') ? 'PASS' : 'FAIL', 'Now · map, sentence and tiles (Dec 11)', String(nowHome).slice(3, 56)]);

/* THE DRIVER CARD TILE opens the white card for other eyes, and Android back
   puts Now back — a layer, never a route. */
const driverTile = await js(`(async()=>{
  const b=document.querySelector('.t-driver');
  if(!b) return 'FAIL no driver tile';
  const before=location.hash;
  b.click(); await new Promise(r=>setTimeout(r,900));
  const d=document.querySelector('.driver');
  if(!d||!/张家界荷花国际机场/.test(d.innerText)) return 'FAIL the white card did not open on the Zhangjiajie airport';
  history.back(); await new Promise(r=>setTimeout(r,900));
  if(document.querySelector('.driver')) return 'FAIL back did not close it';
  if(location.hash!==before) return 'FAIL back left Now: '+location.hash;
  return 'ok opens the white card, back closes it';
})()`, true);
rows.push([String(driverTile).startsWith('ok') ? 'PASS' : 'FAIL', 'Now · the driver tile is a layer', String(driverTile).slice(3, 56)]);

/* THE DRIVER TILE IS TODAY'S, OR IT IS NOT DRAWN. With no step under way it
   holds the first of the day's own places that has a card (Dec 6: Sanlitun);
   a day whose places name no card (Dec 13, the Zhangjiajie parks) draws no
   tile — never the trip's first card, a school two thousand km away. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-06#/trip/cn26/now` });
await wait(2200);
const driverDay = await js(`(()=>{
  const t=document.querySelector('.t-driver');
  if(!t) return 'FAIL no driver tile on Dec 6, whose places include Sanlitun';
  if(!/三里屯/.test(t.innerText)) return 'FAIL Dec 6 shows '+t.innerText.replace(/\\s+/g,' ').slice(0,40);
  return 'ok';
})()`);
await S('Page.navigate', { url: `${BASE}?d=2026-12-13#/trip/cn26/now` });
await wait(2200);
const driverNone = await js(`(()=>{
  const t=document.querySelector('.t-driver');
  if(t) return 'FAIL a driver tile on Dec 13: '+t.innerText.replace(/\\s+/g,' ').slice(0,40);
  if(!document.querySelector('.rail .t-next')) return 'FAIL Now did not draw on Dec 13';
  return 'ok';
})()`);
const driverRule = !String(driverDay).startsWith('ok') ? driverDay : !String(driverNone).startsWith('ok') ? driverNone : 'ok Dec 6 Sanlitun · Dec 13 no tile';
rows.push([String(driverRule).startsWith('ok') ? 'PASS' : 'FAIL', 'Now · the driver tile is today’s, or none', String(driverRule).slice(3, 56)]);

/* THE TRAVEL DAY IS GENERATED FROM ITS BOOKINGS (f-travelday): last night's
   bed, every end of every leg, tonight's bed, in order; the flight an arc;
   the crossing no booking covers pointing at its step; the times the steps
   tie to places; you at the bed you leave; tonight's bed a door to its pass.
   Since 2026-10-17 Dec 11 is the Hi Cozy hostel → Pudong → MU394 (booked)
   → DYG → the Pullman — CA8609, cancelled the same day, draws no leg. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/now/day` });
await wait(2400);
const metro = await js(`(()=>{
  const m=document.querySelector('.metro');
  if(!m) return 'FAIL no metro line on Dec 11';
  const t=m.innerText;
  const order=['Hi Cozy International Hostel','Shanghai Pudong Intl','Zhangjiajie Hehua','Pullman Zhangjiajie'].map(s=>t.indexOf(s));
  if(order.some(i=>i<0)||order.some((i,k)=>k>0&&i<order[k-1])) return 'FAIL stations out of order: '+order.join(',');
  if(/Daxing|CA ?8609|Taizicheng|Qinghe/.test(t)) return 'FAIL the line still carries the Chongli day or the OR';
  if(m.querySelectorAll('.m-seg.air').length!==1) return 'FAIL the flight is not one arc';
  if(!/see step 2/.test(t)) return 'FAIL the crossing to Pudong does not point at its step';
  for(const w of ['check out by ~15:30','by 17:10','19:10 → 21:40','≈22:30','NOT Hongqiao']) if(!t.includes(w)) return 'FAIL the line does not say '+w;
  const you=m.querySelector('.m-you');
  if(!you||!/Hi Cozy/.test(you.closest('.m-st').innerText)) return 'FAIL you are not at the bed you leave';
  if(!m.querySelector('line.flow, path.flow')) return 'FAIL the segment you are on does not Flow';
  const bed=[...m.querySelectorAll('.m-st')].pop();
  if(!/Booked/.test(bed.innerText)||!bed.querySelector('a[href$="cn26-stay-03"]')) return 'FAIL tonight is not the booked Pullman, a door to its pass';
  const f=document.querySelector('.focus');
  if(!f||!/Step 1 of 7/i.test(f.innerText)) return 'FAIL no Focus card on step 1';
  if(document.querySelectorAll('.steps li').length!==7) return 'FAIL the runbook is not all there';
  return 'ok 4 stations in order, 1 arc, see step 2, you at Hi Cozy';
})()`);
rows.push([String(metro).startsWith('ok') ? 'PASS' : 'FAIL', 'Travel day · the line from the bookings', String(metro).slice(3, 56)]);

/* DONE IS A WRITE. The Focus card's Done ticks step 1 into the database (the
   same key a tick in the list writes) and the card moves to step 2 — the
   crossing from the Hi Cozy hostel to Pudong, with its times and its NOT.
   Step 1 is not a move (leaving the bag), so you stay at the hostel until
   step 2 is done.
   Then it is put back the way a thumb would: by the step's own text in the
   list. */
const focusDone = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const done=[...document.querySelectorAll('.focus button')].find(b=>/Done/.test(b.textContent));
  if(!done) return 'FAIL the Focus card has no Done';
  done.click(); await sleep(1300);
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const keys=await new Promise(r=>{const q=db.transaction('checkState').objectStore('checkState').getAllKeys();q.onsuccess=()=>r(q.result)});
  db.close();
  if(!keys.some(k=>/cn26:run:cn26-run-dec11:2026-12-11:0$/.test(k))) return 'FAIL Done was not written';
  const f=document.querySelector('.focus');
  if(!/Step 2 of 7/i.test(f.innerText)||!/Hi Cozy International Hostel[^\\n]* → Shanghai Pudong Intl/.test(f.innerText)) return 'FAIL the Focus card did not move on: '+f.innerText.slice(0,60);
  if(!/check out by ~15:30/.test(f.innerText)||!/by 17:10/.test(f.innerText)||!/NOT Hongqiao/.test(f.innerText)) return 'FAIL the Focus card lost its facts';
  const you=document.querySelector('.metro .m-you');
  if(!you||!/Hi Cozy/.test(you.closest('.m-st').innerText)) return 'FAIL you left the hostel before the crossing';
  return 'ok written · step 2 · the crossing to Pudong';
})()`, true);
rows.push([String(focusDone).startsWith('ok') ? 'PASS' : 'FAIL', 'Focus · Done is a write and moves you', String(focusDone).slice(3, 56)]);

await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/now` });
await wait(2200);
const boardSentence = await js(`(()=>{
  const s=(document.querySelector('a.sentence')||{innerText:''}).innerText.replace(/\\s+/g,' ').trim();
  if(!/step 2 of 7/i.test(s)) return 'FAIL '+s.slice(0,60);
  if(!/Next: check out of Hi Cozy International Hostel East Nanjing Road & The Bund & 24h English Services by 15:30, then get to Shanghai Pudong Intl · Terminal 1 by about 17:10\\./.test(s)) return 'FAIL '+s.slice(0,70);
  return 'ok the board’s own sentence';
})()`);
rows.push([String(boardSentence).startsWith('ok') ? 'PASS' : 'FAIL', 'Concierge · one plain sentence (step 2)', String(boardSentence).slice(3, 56)]);

await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/now/day` });
await wait(2200);
const undone = await js(`(async()=>{
  const li=document.querySelector('.steps li');
  if(!li.querySelector('.cbox').checked) return 'FAIL step 1 is not ticked in the list';
  li.querySelector('.stx').click(); await new Promise(r=>setTimeout(r,1000));
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const keys=await new Promise(r=>{const q=db.transaction('checkState').objectStore('checkState').getAllKeys();q.onsuccess=()=>r(q.result)});
  db.close();
  if(keys.some(k=>/cn26-run-dec11/.test(k))) return 'FAIL the tick stayed in the database';
  return /Step 1 of 7/i.test(document.querySelector('.focus').innerText) ? 'ok put back' : 'FAIL the Focus card did not go back';
})()`, true);
rows.push([String(undone).startsWith('ok') ? 'PASS' : 'FAIL', 'Runbook · a tick in the list undoes Done', String(undone).slice(3, 56)]);

/* INK — done: the road so far paints itself once on the first open of a day,
   and a second open of the same day finds it already painted. */
await js(`localStorage.removeItem('ltd:ink');'ok'`);
await S('Page.navigate', { url: `${BASE}?d=2026-12-12#/trip/cn26/now` });
await wait(1400);
const inked1 = await js(`document.querySelectorAll('.nh-map .leg.done.ink').length`);
await S('Page.reload', {});
await wait(2200);
const inked2 = await js(`document.querySelectorAll('.nh-map .leg.done.ink').length + document.querySelectorAll('.nh-map .leg.done').length * 100`);
/* 2 legs since 2026-10-17 (Kunyu → Beijing, Beijing → Zhangjiajie): Shanghai
   has no star, so the road so far skips it */
const inkOk = Number(inked1) === 2 && Number(inked2) === 200;
rows.push([inkOk ? 'PASS' : 'FAIL', 'Ink · the road so far, once a day', `first open ${inked1} legs inked, then ${Number(inked2) % 100} (of ${Math.floor(Number(inked2) / 100)})`]);

/* COMET — moving through time: a tap on the map flies the leg you are on
   once (Sat 12: the next move, to Chongqing), then it lands and is gone —
   one one-shot at a time. */
const comet = await js(`(async()=>{
  const svg=document.querySelector('.nh-map svg.tmap');
  svg.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,300));
  const c=svg.querySelectorAll('.comet');
  if(c.length!==1) return 'FAIL '+c.length+' comets after a tap';
  if(!c[0].querySelector('.comet-head')||!c[0].querySelector('.comet-flash')) return 'FAIL the comet has no head or no flash';
  await new Promise(r=>setTimeout(r,1800));
  if(svg.querySelector('.comet')) return 'FAIL the comet never landed';
  return 'ok flew once and landed';
})()`, true);
rows.push([String(comet).startsWith('ok') ? 'PASS' : 'FAIL', 'Comet · a tap flies the live leg once', String(comet).slice(3, 56)]);

/* ROUTE ANIMATIONS OFF: Now's Flow stands still at its end state — a solid
   leg with its arrowhead — and the you-are-here pulse, which is not a route,
   still breathes. Put back as found. */
const flipRoutes = async () => {
  await S('Page.navigate', { url: `${BASE}#/settings` });
  await wait(2000);
  await js(`(async()=>{ const row=[...document.querySelectorAll('label.row')].find(l=>/Route animations/.test(l.textContent)); row.querySelector('input').click(); await new Promise(r=>setTimeout(r,600)); return 'ok'; })()`, true);
};
await flipRoutes();
/* Dec 12 since 2026-10-17: Dec 11 has no Flow any more (you are in Shanghai,
   which has no star); Dec 12's next move flows from Zhangjiajie, with the pulse */
await S('Page.navigate', { url: `${BASE}?d=2026-12-12#/trip/cn26/now` });
await wait(2200);
const still = await js(`(()=>{
  if(!document.documentElement.classList.contains('no-routes')) return 'FAIL routes are not off';
  const cs=getComputedStyle(document.querySelector('.fl-line'));
  if(cs.animationName!=='none') return 'FAIL today’s leg still flows: '+cs.animationName;
  if(cs.strokeDasharray!=='none') return 'FAIL the leg is not solid: '+cs.strokeDasharray;
  const a=document.querySelector('.fl-arrow');
  if(!a||getComputedStyle(a).display==='none') return 'FAIL no arrowhead in the still state';
  if(getComputedStyle(document.querySelector('.ping')).animationName==='none') return 'FAIL the you-are-here pulse stopped too';
  return 'ok a solid leg with its arrow, the pulse breathes';
})()`);
await flipRoutes();
const restored = await js(`document.documentElement.classList.contains('no-routes') ? 'FAIL' : 'ok'`);
rows.push([String(still).startsWith('ok') && restored === 'ok' ? 'PASS' : 'FAIL', 'Motion · routes off stills Flow, not the pulse', String(still).slice(3, 56)]);

/* TO DO, FOLDED INTO TIME (f-todo): today first, then tomorrow; the train
   still to buy on its day and a door to its pass; the Tianmen ticket on
   Mon 14; everything past in one Earlier group of 23 to-dos (24 while
   muping-late-arrival was open, 29 Sep, before it closed the same day — the
   to-do count above has the list); and a tick that is a write both ways. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/now/todo` });
await wait(2200);
const todoDays = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const heads=[...document.querySelectorAll('.tday-h')].map(h=>h.textContent.trim());
  if(!/^Today · Fri 11 Dec/i.test(heads[0]||'')) return 'FAIL the first day is not today: '+heads[0];
  if(!/^Tomorrow · Sat 12 Dec/i.test(heads[1]||'')) return 'FAIL tomorrow is not second: '+heads[1];
  const today=document.querySelector('.tday');
  /* since 2026-10-17: the 15:30 bag-and-Pudong alarm; MU394 was booked the
     same day, and a booked thing is not a to-do */
  if(!/Collect the bag at Hi Cozy/.test(today.innerText)) return 'FAIL today’s alarm is not on today';
  if([...today.querySelectorAll('a.trow.booking')].some(r=>/MU ?394/.test(r.innerText))) return 'FAIL the booked MU394 is listed as a to-do';
  const mon=[...document.querySelectorAll('.tday')].find(s=>/Mon 14 Dec/.test(s.querySelector('.tday-h').textContent));
  if(!mon||!/Tianmen/.test(mon.innerText)) return 'FAIL the Tianmen ticket is not on Mon 14';
  const sum=document.querySelector('details.earlier summary').textContent;
  if(!/Earlier · 25 to-dos/.test(sum)) return 'FAIL Earlier reads '+sum; // 23 → 29 on 2026-10-17: six of the seven Shanghai to-dos fall before Dec 11 · 29 → 27 that evening: melia and element-cancel closed · 27 → 26: mu394 closed · 26 → 25: train-shanghai closed
  const read=async()=>{ const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)}); const all=await new Promise(r=>{const q=db.transaction('tasks').objectStore('tasks').getAll();q.onsuccess=()=>r(q.result)}); db.close(); return all.find(t=>/1949/.test(t.title)); };
  const tick=()=>[...document.querySelectorAll('.trow[data-kind="task"]')].find(r=>/1949/.test(r.innerText)).querySelector('.tick').click();
  tick(); await sleep(900);
  if(!(await read()).done) return 'FAIL the tick did not reach the database';
  tick(); await sleep(900);
  if((await read()).done) return 'FAIL the untick did not reach the database';
  return 'ok today, tomorrow, Tianmen on 14, Earlier 25, tick both ways';
})()`, true);
rows.push([String(todoDays).startsWith('ok') ? 'PASS' : 'FAIL', 'To do · folded into days, ticks are writes', String(todoDays).slice(3, 56)]);

/* ============================================================
   GAP E — THE NIGHT, EVEN FOR A PHONE THAT ONCE CHOSE DAYLIGHT.

   Horizon is dark only since Run 4 (owner, 2026-09-28: "we dont need
   Daylight" … "remove it"). The failure worth a rehearsal is the phone that
   DID choose it on an older build: its settings record still says
   `theme: 'light'`, and so does the localStorage key the old boot script read.
   Nothing may read either any more. So both are written here, the app is
   booted cold, and it is asked — at DOMContentLoaded, before anything of the
   app could have run, and again once it is up — whether it is the night: no
   `data-theme`, the night sky, the sky as the status bar's colour. Then the
   surfaces Daylight used to re-ink are read on the night — the pass, the
   guide, the day line — with the facts the Light walk used to assert there.
   The stored 'light' is left in place for the rest of the run.
   ============================================================ */

/* Record the theme attribute as it stood at DOMContentLoaded. */
await S('Page.addScriptToEvaluateOnNewDocument', {
  source:
    "document.addEventListener('DOMContentLoaded',function(){" +
    "window.__themeAtDCL=document.documentElement.getAttribute('data-theme');});",
});

await S('Page.navigate', { url: `${BASE}#/trips` });
await wait(2000);
const storedLight = await js(`(async()=>{
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const s=await new Promise(r=>{const q=db.transaction('settings').objectStore('settings').get('settings');q.onsuccess=()=>r(q.result)});
  await new Promise((r,j)=>{const t=db.transaction('settings','readwrite'); t.objectStore('settings').put(Object.assign({},s||{id:'settings'},{theme:'light'})); t.oncomplete=r; t.onerror=j;});
  db.close();
  localStorage.setItem('ltd:theme','light');
  return 'ok';
})()`, true);
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/pocket/cn26-flight-ey888` });
await wait(2600);
const bootsDark = storedLight !== 'ok' ? 'FAIL could not store the old choice: ' + storedLight : await js(`(async()=>{
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const s=await new Promise(r=>{const q=db.transaction('settings').objectStore('settings').get('settings');q.onsuccess=()=>r(q.result)});
  db.close();
  if((s&&s.theme)!=='light'||localStorage.getItem('ltd:theme')!=='light') return 'FAIL the stored light choice is not there to ignore';
  if(window.__themeAtDCL!==null) return 'FAIL a theme was set before the app: '+String(window.__themeAtDCL);
  if(document.documentElement.hasAttribute('data-theme')) return 'FAIL the app put data-theme on the page';
  const bg=getComputedStyle(document.documentElement).backgroundColor;
  if(bg!=='rgb(11, 12, 22)') return 'FAIL the canvas is not the night sky: '+bg;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(!meta||meta.getAttribute('content').toLowerCase()!=='#0b0c16') return 'FAIL the status bar is not the sky: '+(meta&&meta.getAttribute('content'));
  if(getComputedStyle(document.documentElement).colorScheme!=='dark') return 'FAIL the page does not declare the dark scheme';
  return 'ok stored light both ways, boots '+bg;
})()`, true);
rows.push([String(bootsDark).startsWith('ok') ? 'PASS' : 'FAIL', 'Night · a stored "light" still boots dark', String(bootsDark).slice(3, 56)]);

/* The pass: the object you hold up. Its facts, and night ink on a night card
   — down to the code a desk reads. */
{
  const text = String(await js(`document.body.innerText`)).toLowerCase();
  const want = ['8CR7MR', 'Etihad', 'BOOKED'];
  const miss = want.filter((w) => !text.includes(w.toLowerCase()));
  rows.push([miss.length ? 'FAIL' : 'PASS', 'Night · the pass reads (EY 888)', miss.length ? `missing: ${miss.join(', ')}` : '']);
}
const passInk = await js(`(()=>{
  const sum=(c)=>{const m=/rgb\\((\\d+), (\\d+), (\\d+)/.exec(c); return m?(+m[1])+(+m[2])+(+m[3]):-1;};
  const pass=document.querySelector('.pass');
  if(!pass) return 'FAIL no pass on the booking screen';
  const card=getComputedStyle(pass).backgroundColor;
  if(sum(card)<0||sum(card)>200) return 'FAIL the pass is not a night card: '+card;
  for(const sel of ['.ps-caps','.ps-title','.codestrip .code']){
    const el=pass.querySelector(sel);
    if(!el) return 'FAIL the pass has no '+sel;
    if(sum(getComputedStyle(el).color)<450) return 'FAIL '+sel+' is dark on the night: '+getComputedStyle(el).color;
  }
  return 'ok card '+card+', ink light';
})()`);
rows.push([String(passInk).startsWith('ok') ? 'PASS' : 'FAIL', 'Night · the pass is a night card', String(passInk).slice(3, 56)]);

/* The city guide: its chapter headings and its day-by-day accordion. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/journey/cn26-stop-zhangjiajie/guide` });
await wait(2400);
const guideInk = await js(`(()=>{
  const sum=(el)=>{const m=/rgb\\((\\d+), (\\d+), (\\d+)\\)/.exec(getComputedStyle(el).color); return m?(+m[1])+(+m[2])+(+m[3]):-1;};
  const head=document.querySelector('.gd-body .gd-h2');
  if(!head) return 'FAIL the guide has no chapter heading';
  if(sum(head)<450) return 'FAIL the chapter heading is dark on the night';
  const sm=document.querySelector('.accitem > summary');
  if(!sm) return 'FAIL the day-by-day accordion is gone';
  if(sum(sm)<450) return 'FAIL an accordion day title is dark on the night';
  if(document.documentElement.hasAttribute('data-theme')) return 'FAIL data-theme appeared on the way';
  return 'ok headings and day titles inked for the night';
})()`);
rows.push([String(guideInk).startsWith('ok') ? 'PASS' : 'FAIL', 'Night · the guide is inked', String(guideInk).slice(3, 56)]);

/* The day line's planned-hour cards (--plan-card, the bridge's last Lantern
   ground): night glass with the night's ink. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-13#/trip/cn26/now/day` });
await wait(2400);
const planGlass = await js(`(()=>{
  const card=document.querySelector('.tcard');
  if(!card) return 'FAIL no authored timeline card on Dec 13';
  const m=getComputedStyle(card).backgroundColor.match(/\\d+/g);
  if(!m) return 'FAIL the card has no background';
  const lum=(+m[0]+ +m[1]+ +m[2])/3;
  if(lum>64) return 'FAIL the planned-hour card is not night glass: '+getComputedStyle(card).backgroundColor;
  const b=card.querySelector('b');
  if(!b) return 'FAIL the card has no title';
  const ink=getComputedStyle(b).color.match(/\\d+/g);
  if(!ink||(+ink[0]+ +ink[1]+ +ink[2])/3<160) return 'FAIL dark ink on a night card: '+getComputedStyle(b).color;
  return 'ok card '+Math.round(lum)+', ink '+Math.round((+ink[0]+ +ink[1]+ +ink[2])/3);
})()`);
rows.push([String(planGlass).startsWith('ok') ? 'PASS' : 'FAIL', 'Night · the day line is night glass', String(planGlass).slice(3, 56)]);

/* And Settings has nothing to choose: Appearance is Calm motion and Route
   animations — no Light, no Dark. */
await S('Page.navigate', { url: `${BASE}#/settings` });
await wait(2500);
const noTheme = await js(`(()=>{
  const sec=[...document.querySelectorAll('section.group')].find(s=>s.getAttribute('aria-label')==='Appearance');
  if(!sec) return 'FAIL no Appearance group';
  const t=sec.innerText;
  if(!/Calm motion/.test(t)||!/Route animations/.test(t)) return 'FAIL Appearance lost its motion switches';
  const btns=[...document.querySelectorAll('button')].map(b=>b.textContent.trim());
  if(btns.some(b=>/^(Light|Dark)$/.test(b))||/\\bTheme\\b/.test(document.body.innerText)) return 'FAIL a theme choice is still offered';
  return 'ok Appearance: Calm motion, Route animations';
})()`);
rows.push([String(noTheme).startsWith('ok') ? 'PASS' : 'FAIL', 'Settings · no theme to choose', String(noTheme).slice(3, 56)]);

/* ============================================================
   MAP 5C — THE MAP TAB, OFFLINE, WITH THE COMMITTED TEST PACK.

   The street map in WebGL (SwiftShader), the network hard off: the tab from
   the nav; with no pack, the night canvas with the pins, you and the rings
   and the import card (a file input with no accept filter); a trip file
   refused as a map pack; the test pack (scripts/e2e/fixtures, z11–13 round
   Houhai) imported through that same input into OPFS and its streets drawn
   from it; the pins by category and the chips' counts; you, the rings and
   the rail nearest first; a place's sheet with the trip's own words and a
   straight line from you, focus in and back; Guide me — the live leg
   flowing, the compass, the hand-off — and standing still under Calm
   motion; the filters and the list; a lost WebGL context built again;
   Settings' pack row; "Show on map" from the guide, a pass, Find and the
   day; and not one request off this machine. The moment is the boards':
   Tue 8 Dec, you by the Houhai lakes (39.9380 N, 116.3871 E, ±25 m).
   ============================================================ */
const MAP_Q = '?d=2026-12-08';
const MAP_URL = `${BASE}${MAP_Q}#/trip/cn26/map`;
const TEST_PACK = join(APP, 'scripts', 'e2e', 'fixtures', 'houhai-test.pmtiles');
const mapNet0 = netlog.length;
await S('DOM.enable');
await send('Browser.grantPermissions', { permissions: ['geolocation'], origin: BASE.replace(/\/$/, '') });
await S('Emulation.setGeolocationOverride', { latitude: 39.938, longitude: 116.3871, accuracy: 25 });
const setFile = async (selector, path) => {
  const { root } = await S('DOM.getDocument', { depth: -1 });
  const { nodeId } = await S('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) return false;
  await S('DOM.setFileInputFiles', { nodeId, files: [path] });
  return true;
};
/* injected into checks — no backticks in here, ever */
const MAP_H =
  "const __sleep=(ms)=>new Promise(r=>setTimeout(r,ms));" +
  "const __idle=async(ms)=>{ for(let i=0;i<ms/100;i++){ if(document.querySelector('.m-canvas[data-idle]')) return true; await __sleep(100); } return false; };" +
  "const __data=()=>{ const c=document.querySelector('.m-canvas'); return c?Object.assign({},c.dataset):{}; };" +
  "const __opfs=async()=>{ try{ const r=await navigator.storage.getDirectory(); const d=await r.getDirectoryHandle('mappacks'); const f=await (await d.getFileHandle('map.pmtiles')).getFile(); return f.size; }catch(e){ return 0; } };" +
  /* Map 5d: the foot (scale, attribution) never lies on a pin or its name at rest — unless it has gone to its one short line */
  "const __foot=()=>{ const f=document.querySelector('.m-foot'); if(!f) return 'ok'; const r=f.getBoundingClientRect(); const c=document.querySelector('.m-canvas').getBoundingClientRect();" +
  /* Map 5f: "x,y[,photo,chars]" — a pin wearing its photo is a 23.5 px round with its name 43 px down, an icon 17 and 38 */
  " const pts=(__data().at||'').split(' ').filter(Boolean).map(s=>s.split(',').map(Number));" +
  " const under=pts.filter(([x,y,ph,ch])=>{ const rr=ph?23.5:17, half=Math.max(rr,Math.min(103.5,(ch||0)*6.4)/2), lines=ch?Math.ceil(ch*6.4/103.5):1;" +
  " return x+c.left+half>r.left&&x+c.left-half<r.right&&y+c.top+(ph?43:38)+(lines-1)*14>r.top&&y+c.top-rr<r.bottom; });" +
  " return under.length&&!f.classList.contains('short')?'FAIL the scale and attribution lie on '+under.length+' pin(s) at rest ('+(f.classList.contains('right')?'right':'left')+')':'ok'; };";
const mapRow = (label, r, cut = 64) => rows.push([String(r).startsWith('ok') ? 'PASS' : 'FAIL', label, String(r).replace(/^ok /, '').slice(0, cut)]);

/* the tab, from the nav */
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/now` });
await wait(2200);
mapRow('Map · the tab, from the nav', await js(`(async()=>{ ${MAP_H}
  const a=[...document.querySelectorAll('.navbar .navitem')].find(x=>x.dataset.place==='map');
  if(!a) return 'FAIL the nav has no Map';
  a.click();
  for(let i=0;i<60&&!document.querySelector('.mapscreen');i++) await __sleep(100);
  if(location.hash!=='#/trip/cn26/map') return 'FAIL the Map item went to '+location.hash;
  if(!document.querySelector('.mapscreen')) return 'FAIL the Map screen did not open';
  if(!(await __idle(20000))) return 'FAIL the map never settled';
  const cur=document.querySelector('.navbar .navitem[aria-current=page]');
  if(!cur||cur.dataset.place!=='map') return 'FAIL Map is not the current place';
  const h1=document.querySelector('h1');
  return 'ok '+(h1?h1.textContent.trim():'no h1')+' · engine '+(document.querySelector('.maplibregl-canvas')?'drawn':'missing');
})()`, true, true));

/* no pack yet: the night canvas, the pins, you, the rings, the import card */
await S('Page.navigate', { url: MAP_URL });
await wait(2400);
mapRow('Map · no pack: pins, you, rings on the night canvas', await js(`(async()=>{ ${MAP_H}
  if(!(await __idle(20000))) return 'FAIL the map never settled';
  const card=document.querySelector('.m-nopack');
  if(!card||!/Map pack not on this phone — import it/.test(card.innerText)) return 'FAIL no "Map pack not on this phone — import it"';
  const input=card.querySelector('input[type=file]');
  if(!input) return 'FAIL the card has no file input';
  if(input.hasAttribute('accept')) return 'FAIL the file input carries an accept filter (the Capacitor chooser crashes on one)';
  const loc=document.querySelector('.m-locate'); if(loc&&loc.getAttribute('aria-pressed')!=='true') loc.click();
  for(let i=0;i<60&&document.querySelector('.m-you.off');i++) await __sleep(100);
  if(document.querySelector('.m-you.off')) return 'FAIL no you on the night canvas';
  await __sleep(900); await __idle(10000); await __sleep(300);
  const d=__data();
  if(!/sight:\\d/.test(d.cats||'')) return 'FAIL no pins drawn: '+(d.cats||'none');
  if(Number(d.rings||0)<3) return 'FAIL the rings are not drawn ('+d.rings+')';
  if(Number(d.reads||0)!==0) return 'FAIL tiles read with no pack';
  return 'ok '+d.cats+' · rings '+d.rings+' · no tiles';
})()`, true, true));

/* a trip file is not a map pack: refused, nothing written */
await setFile('.m-nopack input[type=file]', SEED);
await wait(1500);
mapRow('Map · the import refuses a file that is not a pack', await js(`(async()=>{ ${MAP_H}
  const p=document.querySelector('.pk-problem');
  if(!p) return 'FAIL no word of refusal';
  if(!/not a map pack/.test(p.textContent)) return 'FAIL the refusal says: '+p.textContent.trim().slice(0,50);
  if(!document.querySelector('.m-nopack')) return 'FAIL the empty state went away';
  if(await __opfs()) return 'FAIL something was written to the phone';
  return 'ok '+p.textContent.trim().slice(0,56);
})()`, true));

/* the test pack, through the same input: into OPFS, the streets drawn from it */
await setFile('.m-nopack input[type=file]', TEST_PACK);
mapRow('Map · the test pack imports, the streets come from it', await js(`(async()=>{ ${MAP_H}
  for(let i=0;i<120&&document.querySelector('.m-nopack');i++) await __sleep(100);
  if(document.querySelector('.m-nopack')) return 'FAIL the pack did not land: '+((document.querySelector('.pk-problem')||{}).textContent||'no word');
  const size=await __opfs();
  if(size!==${readFileSync(TEST_PACK).length}) return 'FAIL the phone holds '+size+' bytes, not the pack';
  for(let i=0;i<60&&!document.querySelector('.m-canvas[data-reads]');i++) await __sleep(100);
  await __sleep(500); await __idle(20000); await __sleep(300);
  const d=__data();
  if(!(Number(d.reads)>0)) return 'FAIL no tile was read from the pack';
  return 'ok '+size+' bytes in OPFS · '+d.reads+' reads from the file';
})()`, true, true));

/* THE FIRST FIX FLIES YOU ALL THE WAY IN (Map 5d, item 9): the map opens on
   the city at z13 and the first fix flies to you at z13.5. The follow effect
   read and wrote `following`, re-ran on its own write, and its short pan cut
   the flight off: at rest on you, but at z13.00. A FRESH load (by way of
   about:blank — a navigation to the address already open is only a change of
   fragment, and keeps the map as the rows before left it). */
await S('Page.navigate', { url: 'about:blank' });
await S('Page.navigate', { url: MAP_URL });
await wait(2400);
mapRow('Map · the first fix flies you all the way in', await js(`(async()=>{ ${MAP_H}
  if(!(await __idle(20000))) return 'FAIL the map never settled';
  for(let i=0;i<60&&document.querySelector('.m-you.off');i++) await __sleep(100);
  await __sleep(1500); await __idle(10000);
  const [lng,lat,z]=(__data().center||'').split(',').map(Number);
  if(Math.abs(lat-39.938)>0.002||Math.abs(lng-116.3871)>0.002) return 'FAIL the map is not on you: '+__data().center;
  if(!(Math.abs(z-13.5)<0.05)) return 'FAIL on you, but at z'+z.toFixed(2)+', not z13.50 — the flight was cut short';
  return 'ok on you at z'+z.toFixed(2);
})()`, true, true));

/* the pins by category, and the chips' counts: Beijing's own */
await S('Page.navigate', { url: MAP_URL });
await wait(2400);
mapRow('Map · pins by category, the chips count Beijing', await js(`(async()=>{ ${MAP_H}
  if(!(await __idle(20000))) return 'FAIL the map never settled';
  for(let i=0;i<60&&document.querySelector('.m-you.off');i++) await __sleep(100);
  await __sleep(900); await __idle(10000);
  document.querySelector('.m-zoom button[aria-label="Zoom out"]').click();
  await __sleep(700); await __idle(10000); await __sleep(300);
  const foot=__foot(); if(foot!=='ok') return foot;
  const cats=(__data().cats||'').split(',').filter(Boolean).map(x=>x.split(':')[0]);
  const want=['sight','spa','medical','food'];
  const missing=want.filter(c=>!cats.includes(c));
  if(missing.length) return 'FAIL no '+missing.join('/')+' pin drawn round Houhai: '+cats.join(',');
  const chips=[...document.querySelectorAll('.m-chips .m-chip')].map(b=>b.textContent.replace(/\\s+/g,' ').trim());
  /* All 30 / Transport 5 until 2026-10-17: Beijing North and Qinghe left with the Chongli train */
  const expect=['All 28','Food 1','Spa 1','Sights 18','Shows 3','Shopping 1','Transport 3','Medical 1'];
  if(chips.join('|')!==expect.join('|')) return 'FAIL chips '+chips.join(' · ');
  return 'ok '+cats.join(' · ')+' drawn; '+chips.slice(0,4).join(' · ')+'…';
})()`, true, true));

/* you, the rings, and the rail nearest first — distances only from you */
mapRow('Map · you, the rings, the rail nearest first', await js(`(async()=>{ ${MAP_H}
  if(document.querySelector('.m-you.off')) return 'FAIL you are not on the map';
  if(Number(__data().rings||0)<3) return 'FAIL the rings are not drawn';
  const head=document.querySelector('#m-near');
  if(!head||head.textContent.trim()!=='Near you') return 'FAIL the rail is not "Near you": '+(head&&head.textContent);
  const foot=__foot(); if(foot!=='ok') return foot;
  const ds=[...document.querySelectorAll('.rail .rc-dist')].map(e=>e.textContent.replace(/\\s+/g,' ').trim()).filter(Boolean);
  if(ds.length<5) return 'FAIL only '+ds.length+' distances on the rail';
  const m=ds.map(t=>{ const x=/≈ ([\\d.]+) (m|km)/.exec(t); return x?Number(x[1])*(x[2]==='km'?1000:1):NaN; });
  if(m.some(Number.isNaN)) return 'FAIL a distance that is not a straight line: '+ds.join(' ; ');
  for(let i=1;i<m.length;i++) if(m[i]<m[i-1]) return 'FAIL not nearest first: '+ds.join(' ; ');
  if(!ds.every(t=>/ (N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)$/.test(t))) return 'FAIL a distance with no direction: '+ds[0];
  return 'ok '+ds.slice(0,3).join(' · ')+' …';
})()`, true));

/* a place's sheet: the trip's own words, a straight line, focus in and back */
mapRow('Map · a place: its words, a straight line, focus in and back', await js(`(async()=>{ ${MAP_H}
  const map0=document.querySelector('.maplibregl-canvas');
  location.hash='#/trip/cn26/map/cn26-place-07';
  for(let i=0;i<50&&!document.querySelector('.ps');i++) await __sleep(100);
  const ps=document.querySelector('.ps');
  if(!ps) return 'FAIL no place sheet';
  await __sleep(700);
  const h=ps.querySelector('h1')?.textContent.trim(), zh=ps.querySelector('.ps-zh')?.textContent.trim(), line=ps.querySelector('.ps-detail')?.textContent.trim();
  if(h!=='Beijing Massage Hospital'||zh!=='北京按摩医院') return 'FAIL the sheet names '+h+' '+zh;
  if(line!=='Blind massage / tuina, not bone-setting') return 'FAIL the line is not the trip’s own: '+line;
  const km=ps.querySelector('.ps-km')?.textContent.trim(), of=ps.querySelector('.ps-of')?.textContent.trim();
  if(km!=='≈ 1.9 km'||of!=='WSW of you · straight line') return 'FAIL the distance reads '+km+' / '+of;
  const btns=[...ps.querySelectorAll('button')].map(b=>b.textContent.trim());
  for(const w of ['Navigate','Driver card','Google Maps','Copy address']) if(!btns.includes(w)) return 'FAIL no '+w+' ('+btns.join(', ')+')';
  if(!ps.contains(document.activeElement)) return 'FAIL focus did not go to the sheet';
  if(document.querySelector('.rail .rc-open')) return 'FAIL the rail is still drawn under the sheet';
  history.back();
  for(let i=0;i<30&&document.querySelector('.ps');i++) await __sleep(100);
  if(document.querySelector('.ps')) return 'FAIL back did not close the sheet';
  await __sleep(300);
  const first=document.querySelector('.rail .rc-open');
  if(!first) return 'FAIL no rail card after the sheet closed';
  first.focus(); first.click();
  for(let i=0;i<50&&!document.querySelector('.ps');i++) await __sleep(100);
  const name=document.querySelector('.ps h1')?.textContent.trim();
  document.querySelector('.ps-x').click();
  for(let i=0;i<30&&document.querySelector('.ps');i++) await __sleep(100);
  await __sleep(300);
  const back=document.activeElement;
  if(!back||!back.classList.contains('rc-open')) return 'FAIL focus did not come back to the rail card ('+(back&&back.className)+')';
  if(document.querySelector('.maplibregl-canvas')!==map0) return 'FAIL the street map was built again for a sheet';
  return 'ok the Massage Hospital, ≈ 1.9 km WSW; '+name+' from the rail, focus back, one map';
})()`, true, true));

/* Guide me: the live leg flows, the compass, the hand-off */
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/map/cn26-place-07/go` });
await wait(2400);
mapRow('Map · Guide me: the live leg, the compass, Amap', await js(`(async()=>{ ${MAP_H}
  await __idle(20000);
  for(let i=0;i<60&&!document.querySelector('.m-lines .fl-line');i++) await __sleep(100);
  const flow=document.querySelector('.m-lines .fl-line');
  if(!flow) return 'FAIL no line from you to the place';
  const run=flow.getAnimations().some(a=>a.animationName==='h-flow'&&a.playState==='running');
  if(!run) return 'FAIL the live leg does not flow';
  /* Map 5d: the phone near flat WITH A ROLL (β 20°, γ −8°), its top edge at
     magnetic west: true 262.6°, 7° off the place's 255.5° — straight ahead.
     The back-of-device formula it replaced read 292° here: "slightly left". */
  window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute',{alpha:90,beta:20,gamma:-8,absolute:true}));
  await __sleep(500);
  const km=document.querySelector('.gm-km')?.textContent.trim(), dir=document.querySelector('.gm-dir')?.textContent.trim();
  if(km!=='1.9 km') return 'FAIL the distance reads '+km;
  if(dir!=='WSW · straight ahead') return 'FAIL facing west with a roll the place reads '+dir;
  const leg=document.querySelector('.m-legkm')?.textContent.trim();
  if(leg!=='1.9 km') return 'FAIL the leg reads '+leg;
  const t=document.querySelector('.gm-panel')?.innerText||'';
  for(const w of ['Turn-by-turn in Amap','Works in mainland China without a VPN','Google Maps','Show a driver','Directions open in the maps app; this app never goes online for maps.']) if(!t.includes(w)) return 'FAIL no "'+w+'"';
  if(document.querySelector('.navbar')) return 'FAIL the nav is drawn over Guide me';
  const loops=document.getAnimations().filter(a=>a.playState==='running').map(a=>a.animationName);
  if(loops.filter(n=>n==='h-flow').length!==1) return 'FAIL loops: '+loops.join(',');
  /* Map 5d: the leg says what the panel says — Houhai, under you, is not "0 km" */
  location.hash='#/trip/cn26/map/cn26-place-05/go';
  for(let i=0;i<40&&!/Houhai/.test(document.querySelector('.gm-to')?.textContent||'');i++) await __sleep(100);
  await __sleep(900);
  const near=document.querySelector('.m-legkm')?.textContent.trim();
  if(near!=='10 m') return 'FAIL the leg to Houhai, under you, reads '+near;
  return 'ok flowing · 1.9 km · '+dir+' (β 20 γ −8) · leg 1.9 km, 10 m under you';
})()`, true, true));

/* …and still under Calm motion: the line solid with its arrowhead, nothing running */
await flipCalm();
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/map/cn26-place-07/go` });
await wait(2600);
mapRow('Map · Guide me stands still under Calm motion', await js(`(async()=>{ ${MAP_H}
  await __idle(20000);
  for(let i=0;i<60&&!document.querySelector('.m-lines .fl-line');i++) await __sleep(100);
  if(!document.documentElement.classList.contains('calm')) return 'FAIL Calm motion is not on';
  const flow=document.querySelector('.m-lines .fl-line');
  if(!flow) return 'FAIL no line from you to the place';
  const running=document.getAnimations().filter(a=>a.playState==='running');
  if(running.length) return 'FAIL '+running.length+' running: '+running.map(a=>a.animationName).join(',');
  if(getComputedStyle(flow).strokeDasharray!=='none') return 'FAIL the leg is still dashed: '+getComputedStyle(flow).strokeDasharray;
  const tip=document.querySelector('.m-lines .fl-arrow');
  if(!tip||getComputedStyle(tip).display==='none') return 'FAIL no arrowhead at the end of the leg';
  return 'ok a solid leg with its arrowhead, 0 animations';
})()`, true));
await flipCalm();

/* the filters and the list */
await S('Page.navigate', { url: MAP_URL });
await wait(2400);
mapRow('Map · filters: every category, beds or all, rings', await js(`(async()=>{ ${MAP_H}
  await __idle(20000);
  const b=document.querySelector('.m-toprow button[aria-label="Filters: what to show on the map"]');
  if(!b) return 'FAIL no filters button';
  b.click();
  for(let i=0;i<30&&!document.querySelector('.sheet');i++) await __sleep(100);
  const sh=document.querySelector('.sheet');
  if(!sh||!/Show on the map/.test(sh.innerText)) return 'FAIL no "Show on the map" sheet';
  const rows=[...sh.querySelectorAll('.fl-row')];
  if(rows.length<7) return 'FAIL only '+rows.length+' categories';
  if(!/Hotels shown/.test(sh.innerText)||!sh.querySelector('[role=radio][aria-checked=true]')) return 'FAIL no beds / all choice';
  if(!/Distance rings around you/.test(sh.innerText)) return 'FAIL no rings switch';
  if(!/Green, amber and red stay for booking status/.test(sh.innerText)) return 'FAIL no status-colour note';
  const sights=rows.find(r=>/Sights/.test(r.innerText)).querySelector('input');
  const before=sh.querySelector('.fl-go').textContent.trim();
  sights.click(); await __sleep(300);
  const after=sh.querySelector('.fl-go').textContent.trim();
  sights.click(); await __sleep(200);
  history.back(); await __sleep(700);
  if(document.querySelector('.sheet')) return 'FAIL back did not close the filters';
  if(before===after) return 'FAIL switching Sights off changed nothing ('+before+')';
  return 'ok '+rows.length+' categories · '+before+' → '+after+' → back';
})()`, true, true));
mapRow('Map · the list carries every place, and the unpinned', await js(`(async()=>{ ${MAP_H}
  document.querySelector('.m-listbtn').click();
  for(let i=0;i<30&&!document.querySelector('.sheet');i++) await __sleep(100);
  const sh=document.querySelector('.sheet');
  if(!sh) return 'FAIL no list';
  const rowsP=[...sh.querySelectorAll('.pl-row')];
  if(rowsP.length!==28) return 'FAIL '+rowsP.length+' places listed, 28 are pinned in Beijing';
  const cat=/, (Sight|Food|Spa|Show|Shopping|Hotel|Transport|Medical)(, [\\d.]+ (kilometres|metres) [a-z-]+)?$/;
  const bad=rowsP.find(r=>!cat.test(r.getAttribute('aria-label')||''));
  if(bad) return 'FAIL a row without its category: '+bad.getAttribute('aria-label');
  if(!rowsP.some(r=>/kilometres|metres/.test(r.getAttribute('aria-label')||''))) return 'FAIL no distance for a screen reader';
  if(!/Opens by name — no pin yet/i.test(sh.innerText)) return 'FAIL no "Opens by name" group';
  const byName=sh.querySelectorAll('.pl-named').length;
  history.back(); await __sleep(600);
  return 'ok 28 places, each with its category and distance; '+byName+' by name';
})()`, true, true));

/* a lost WebGL context is built again when the app comes back */
await S('Page.navigate', { url: MAP_URL });
await wait(2400);
mapRow('Map · a lost WebGL context is built again', await js(`(async()=>{ ${MAP_H}
  await __idle(20000);
  const c0=document.querySelector('.maplibregl-canvas');
  const gl=c0.getContext('webgl2')||c0.getContext('webgl');
  const ext=gl&&gl.getExtension('WEBGL_lose_context');
  if(!ext) return 'FAIL cannot lose the context here';
  ext.loseContext(); await __sleep(300);
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  document.dispatchEvent(new Event('visibilitychange')); await __sleep(200);
  delete document.hidden;
  document.dispatchEvent(new Event('visibilitychange'));
  for(let i=0;i<60&&document.querySelector('.maplibregl-canvas')===c0;i++) await __sleep(100);
  const c1=document.querySelector('.maplibregl-canvas');
  if(!c1||c1===c0) return 'FAIL the map was not built again';
  if(!(await __idle(20000))) return 'FAIL the rebuilt map never settled';
  const d=__data();
  if(!/sight:\\d/.test(d.cats||'')) return 'FAIL the rebuilt map has no pins';
  return 'ok a new canvas, pins back ('+d.cats.split(',').length+' categories)';
})()`, true, true));

/* Settings: the pack on this phone */
await S('Page.navigate', { url: `${BASE}#/settings` });
await wait(2200);
mapRow('Map · Settings shows the pack on this phone', await js(`(async()=>{ ${MAP_H}
  let sec=null;
  for(let i=0;i<40&&!sec;i++){ sec=[...document.querySelectorAll('section.group')].find(s=>s.getAttribute('aria-label')==='Map pack'); if(!sec) await __sleep(100); }
  if(!sec) return 'FAIL no Map pack group';
  for(let i=0;i<30&&!/KB|MB/.test(sec.innerText);i++) await __sleep(100);
  const t=sec.innerText.replace(/\\s+/g,' ');
  if(!/633 KB · OpenStreetMap of 28 Sep 2026/.test(t)) return 'FAIL the row reads: '+t.slice(0,70);
  if(![...sec.querySelectorAll('button')].some(b=>/Delete/.test(b.textContent))) return 'FAIL no Delete';
  if(!sec.querySelector('input[type=file]')) return 'FAIL no Replace';
  return 'ok '+t.slice(0,60);
})()`, true));

/* ============================================================
   MAP 5E — THE PLACES' PHOTOS, THEIR ABOUT AND LINKS (MAP-5E.md).

   First, a pack from before Map 5e (the plain test pack imported above):
   no photo box, no About, the rail's cards as they were — only the map
   buttons have moved into the sheet's links row. Then the test pack
   WITH the tiny photo set (scripts/e2e/fixtures/houhai-test-photos.pmtiles:
   the same streets, then the lakes, the Drum and Bell Towers and Beihai Park,
   their index and trailer) replaces it through Settings' own input — one
   file, one import. Then the owner's A, A2, B, E and F, the full-screen
   photo and Android back, Settings › Photo credits, and every photo URL
   handed back when the Map tab is left. What the screens must say is read
   from the committed manifest (scripts/maps/photos/manifest.json): the
   credit, Wikipedia's words verbatim, the article.
   ============================================================ */
const PHOTO_PACK = join(APP, 'scripts', 'e2e', 'fixtures', 'houhai-test-photos.pmtiles');
const PHOTO_MANIFEST = JSON.parse(readFileSync(join(APP, 'scripts', 'maps', 'photos', 'manifest.json'), 'utf8'));
const creditOf = (id) => {
  const p = PHOTO_MANIFEST.places[id]?.photo;
  return p ? (p.author ? `Photo: ${p.author} · ${p.licence}` : `Photo · ${p.licence}`) : null;
};
const BEIHAI = 'cn26-spot-beijing-beihai';
const DRUM = 'cn26-spot-beijing-drum-tower';
const PHOTO_H =
  "const __loaded=(img)=>!!img&&img.complete&&img.naturalWidth>0;" +
  "const __waitImg=async(sel,ms)=>{ for(let i=0;i<(ms||8000)/100;i++){ const im=document.querySelector(sel); if(__loaded(im)) return im; await __sleep(100); } return null; };";

/* a pack from before Map 5e: no photo box, no About — the rail as it was, the map buttons in the links row.
   The map first, then the place within it: back closes the sheet in this same page */
await S('Page.navigate', { url: MAP_URL });
await wait(2400);
mapRow('Map 5e · a pack from before: no photo, no About, the rail as it was', await js(`(async()=>{ ${MAP_H}
  location.hash='#/trip/cn26/map/${BEIHAI}';
  for(let i=0;i<60&&!document.querySelector('.ps h1');i++) await __sleep(100);
  const ps=document.querySelector('.ps');
  if(!ps) return 'FAIL no sheet for Beihai Park';
  await __sleep(600);
  if(ps.querySelector('.ps-hero')) return 'FAIL a photo box with no photos on the phone';
  if(ps.querySelector('.ps-about')) return 'FAIL an About with no photos on the phone';
  const links=[...ps.querySelectorAll('.ps-link')].map(b=>b.textContent.trim());
  if(links.join('|')!=='Google Maps|Amap') return 'FAIL the links read '+links.join(', ');
  history.back();
  for(let i=0;i<40&&document.querySelector('.ps');i++) await __sleep(100);
  await __sleep(500);
  if(!document.querySelector('.rail .rc')) return 'FAIL no rail';
  if(document.querySelector('.rail .rc-ph')) return 'FAIL the rail cards carry photo boxes with no photos on the phone';
  return 'ok no photo box, no About; links Google Maps · Amap; the rail as before';
})()`, true, true));

/* the pack with photos, through Settings' Replace: one file, one import */
await S('Page.navigate', { url: `${BASE}#/settings` });
await wait(2200);
await setFile('section.mappack input[type=file]', PHOTO_PACK);
mapRow('Map 5e · the pack with photos replaces it: one file, one import', await js(`(async()=>{ ${MAP_H}
  let sec=null;
  for(let i=0;i<150;i++){ sec=[...document.querySelectorAll('section.group')].find(s=>s.getAttribute('aria-label')==='Map pack'); if(sec&&/photos/.test(sec.innerText)) break; await __sleep(100); }
  const t=(sec&&sec.innerText||'').replace(/\\s+/g,' ');
  if(!/· 4 photos/.test(t)) return 'FAIL the pack row reads: '+t.slice(0,90);
  const size=await __opfs();
  if(size!==${readFileSync(PHOTO_PACK).length}) return 'FAIL the phone holds '+size+' bytes, not the pack with photos';
  if(!sec.querySelector('.mp-credits')) return 'FAIL no Photo credits row';
  return 'ok '+size+' bytes in OPFS, the one file · '+(t.match(/[\\d.]+ (KB|MB) ·[^·]+· \\d+ areas · 4 photos/)||[''])[0];
})()`, true, true));

/* Settings › Photo credits: who took each photo, its licence, its file page; the texts' articles */
mapRow('Map 5e · Settings › Photo credits: every photo credited', await js(`(async()=>{ ${MAP_H}
  document.querySelector('.mp-credits').click();
  for(let i=0;i<40&&!document.querySelector('.sheet .cr-row');i++) await __sleep(100);
  const sh=document.querySelector('.sheet');
  if(!sh||!/Photo credits/.test(sh.querySelector('h2')?.textContent||'')) return 'FAIL no Photo credits sheet';
  const rows=[...sh.querySelectorAll('.cr-row')];
  if(rows.length!==5) return 'FAIL '+rows.length+' credited places, the test set has 5';
  const beihai=rows.find(r=>/Beihai Park/.test(r.innerText));
  if(!beihai) return 'FAIL Beihai Park is not credited';
  const want=${JSON.stringify(creditOf(BEIHAI)?.replace(/^Photo: /, '') ?? '')};
  if(!beihai.innerText.includes(want)) return 'FAIL Beihai’s credit is not '+want;
  const links=[...sh.querySelectorAll('.cr-link[href]')].map(a=>a.getAttribute('href'));
  if(!links.some(h=>/^https:\\/\\/commons\\.wikimedia\\.org\\/wiki\\/File:/.test(h))) return 'FAIL no file page linked';
  if(!links.some(h=>/^https:\\/\\/en\\.wikipedia\\.org\\/wiki\\//.test(h))) return 'FAIL no article linked for the texts';
  if(!links.some(h=>/creativecommons\\.org\\/licenses\\//.test(h))) return 'FAIL no licence deed linked';
  history.back(); await __sleep(700);
  if(document.querySelector('.sheet')) return 'FAIL back did not close the credits';
  return 'ok 5 places · '+links.length+' links: file pages, licences, articles · back closes';
})()`, true, true));

/* A — the place card: the photo and its credit, About from Wikipedia verbatim, the links; full screen and back */
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/map/${BEIHAI}` });
await wait(2400);
mapRow('Map 5e · A: the photo, its credit, About from Wikipedia, the links', await js(`(async()=>{ ${MAP_H} ${PHOTO_H}
  for(let i=0;i<60&&!document.querySelector('.ps h1');i++) await __sleep(100);
  const ps=document.querySelector('.ps');
  if(!ps) return 'FAIL no sheet';
  const img=await __waitImg('.ps-hero img');
  if(!img) return 'FAIL the photo did not load';
  if(!/^blob:/.test(img.src)) return 'FAIL the photo is not read from the pack: '+img.src.slice(0,40);
  const credit=ps.querySelector('.ps-credit')?.textContent.trim();
  if(credit!==${JSON.stringify(creditOf(BEIHAI))}) return 'FAIL the credit reads '+credit;
  const h=ps.querySelector('.ps-abouth')?.textContent.replace(/\\s+/g,' ').trim();
  if(h!=='About · From Wikipedia') return 'FAIL the About reads '+h;
  const text=ps.querySelector('.ps-abouttext')?.textContent.trim();
  if(text!==${JSON.stringify(PHOTO_MANIFEST.places[BEIHAI]?.about?.text ?? '')}) return 'FAIL the About is not Wikipedia’s own words: '+(text||'').slice(0,50);
  if(!/CC BY-SA 4\\.0/.test(ps.querySelector('.ps-aboutby')?.textContent||'')) return 'FAIL the About does not say its licence';
  const detail=ps.querySelector('.ps-detail'), about=ps.querySelector('.ps-about');
  if(!detail||!(detail.compareDocumentPosition(about)&Node.DOCUMENT_POSITION_FOLLOWING)) return 'FAIL the trip’s own line is not above the About';
  const links=[...ps.querySelectorAll('.ps-link')].map(b=>b.textContent.trim());
  if(links.join('|')!=='Wikipedia|Google Maps|Amap') return 'FAIL the links read '+links.join(', ');
  const wiki=ps.querySelector('a.ps-link');
  if(wiki.getAttribute('href')!==${JSON.stringify(PHOTO_MANIFEST.places[BEIHAI]?.about?.url ?? '')}) return 'FAIL Wikipedia links to '+wiki.getAttribute('href');
  if(!/VPN or a roaming eSIM/.test(ps.querySelector('.ps-linknote')?.textContent||'')) return 'FAIL no quiet line under the links';
  if([...ps.querySelectorAll('.ps-act')].some(b=>/Google Maps/.test(b.textContent))) return 'FAIL Google Maps is still in the button grid too';
  /* full screen, and Android back closes it — the sheet stays */
  const hero=ps.querySelector('.ps-hero');
  hero.click();
  for(let i=0;i<30&&!document.querySelector('.pv');i++) await __sleep(100);
  const pv=document.querySelector('.pv[role=dialog]');
  if(!pv) return 'FAIL no full-screen photo';
  const big=await __waitImg('.pv img');
  if(!big) return 'FAIL the full-screen photo did not load';
  if(pv.querySelector('.pv-credit')?.textContent.trim()!==${JSON.stringify(creditOf(BEIHAI))}) return 'FAIL the full-screen credit reads '+pv.querySelector('.pv-credit')?.textContent;
  if(pv.querySelector('.pv-link')?.getAttribute('href')!==${JSON.stringify(PHOTO_MANIFEST.places[BEIHAI]?.photo?.source ?? '')}) return 'FAIL the file page is not linked';
  if(document.activeElement!==pv.querySelector('.pv-x')) return 'FAIL focus did not go to ✕';
  history.back();
  for(let i=0;i<30&&document.querySelector('.pv');i++) await __sleep(100);
  if(document.querySelector('.pv')) return 'FAIL back did not close the photo';
  if(!document.querySelector('.ps h1')) return 'FAIL back took the sheet away too';
  await __sleep(300);
  if(document.activeElement!==document.querySelector('.ps-hero')) return 'FAIL focus did not come back to the photo';
  return 'ok the photo from the pack · '+credit+' · About verbatim · Wikipedia · Google Maps · Amap · full screen, back';
})()`, true, true));

/* A2 — no free photo: the category's colour, its icon, the words; and a place the pack never looked at: nothing */
mapRow('Map 5e · A2: no free photo — the colour, the icon, the words', await js(`(async()=>{ ${MAP_H}
  location.hash='#/trip/cn26/map/cn26-place-07';
  for(let i=0;i<60&&!/Massage/.test(document.querySelector('.ps h1')?.textContent||'');i++) await __sleep(100);
  await __sleep(500);
  const ps=document.querySelector('.ps');
  const none=ps&&ps.querySelector('.ps-hero.none');
  if(!none) return 'FAIL no placeholder for the Massage Hospital';
  if(none.querySelector('img')) return 'FAIL a picture in the placeholder';
  if(none.querySelector('.ps-nophoto')?.textContent.trim()!=='No free photo of this place') return 'FAIL the placeholder says '+none.innerText;
  if(!none.querySelector('.ps-nodisc svg')) return 'FAIL no icon in the placeholder';
  if(ps.querySelector('.ps-about')) return 'FAIL an About for a place Wikipedia has no article on';
  const links=[...ps.querySelectorAll('.ps-link')].map(b=>b.textContent.trim());
  if(links.join('|')!=='Google Maps|Amap') return 'FAIL the links read '+links.join(', ');
  /* the Lama Temple is not in the test set: the pack never looked at it, so nothing is claimed */
  location.hash='#/trip/cn26/map/cn26-spot-beijing-lama-temple';
  for(let i=0;i<60&&!/Lama/.test(document.querySelector('.ps h1')?.textContent||'');i++) await __sleep(100);
  await __sleep(400);
  if(document.querySelector('.ps .ps-hero')) return 'FAIL a photo box for a place the pack never looked at';
  history.back(); await __sleep(300); history.back(); await __sleep(500);
  return 'ok the spa colour and icon, “No free photo of this place”, no About; a place never looked at: no box';
})()`, true, true));

/* B — the "Near you" cards: a photo on top of each, the colour where there is none */
await S('Page.navigate', { url: MAP_URL });
await wait(2400);
mapRow('Map 5e · B: a photo on each “Near you” card', await js(`(async()=>{ ${MAP_H} ${PHOTO_H}
  await __idle(20000);
  for(let i=0;i<60&&document.querySelector('.m-you.off');i++) await __sleep(100);
  await __sleep(1200);
  /* the streets still come from the pack: the photos only made it longer */
  if(!(Number(__data().reads)>0)) return 'FAIL no tile read from the pack with photos';
  const cards=[...document.querySelectorAll('.rail .rc:not(.all)')];
  if(cards.length<4) return 'FAIL only '+cards.length+' cards';
  if(cards.some(c=>!c.querySelector('.rc-ph'))) return 'FAIL a card without its photo box';
  for(let i=0;i<60;i++){ if(cards.slice(0,2).every(c=>{ const im=c.querySelector('.rc-ph img'); return __loaded(im); })) break; await __sleep(100); }
  const withPhoto=cards.filter(c=>__loaded(c.querySelector('.rc-ph img')));
  const colour=cards.filter(c=>c.querySelector('.rc-ph.none'));
  if(withPhoto.length<2) return 'FAIL only '+withPhoto.length+' card photos loaded';
  if(!colour.length) return 'FAIL no card shows the colour for a place without a photo';
  const first=cards[0].querySelector('.rc-name')?.textContent.trim();
  if(!__loaded(cards[0].querySelector('.rc-ph img'))) return 'FAIL the nearest card ('+first+') has no photo';
  if(cards[0].querySelector('.rc-ph').getAttribute('aria-hidden')!=='true') return 'FAIL the card photo is not decorative (the card’s button names the place)';
  return 'ok '+withPhoto.length+' photos, '+colour.length+' in their colour; nearest: '+first;
})()`, true, true));

/* E — photo pins at close zoom; icons further out; clusters as they were */
mapRow('Map 5e · E: photo pins close in, icons further out', await js(`(async()=>{ ${MAP_H}
  const zin=document.querySelector('.m-zoom button[aria-label="Zoom in"]'), zout=document.querySelector('.m-zoom button[aria-label="Zoom out"]');
  const settle=async()=>{ await __sleep(900); await __idle(15000); await __sleep(700); await __idle(10000); };
  const z=()=>Number((__data().center||'').split(',')[2]);
  const z0=z();
  if(!(z0<15)) return 'FAIL the map opened at z'+z0.toFixed(2)+', already past 15';
  /* in, a whole step at a time, to the first zoom past 15 — a street's worth round Houhai, where the test set's
     photos are (one step more and only the lakes' own is left in view) */
  let steps=0;
  while(z()<15&&steps<4){ zin.click(); steps++; await settle(); }
  const d=__data();
  if(!(z()>=15)) return 'FAIL zoomed in to z'+z().toFixed(2)+', not past 15';
  if(!(Number(d.photos)>=2)) return 'FAIL '+(d.photos||0)+' photo pins at z'+z().toFixed(1);
  if(!(Number(d.photoImages)>=2)) return 'FAIL '+(d.photoImages||0)+' photo images painted';
  const close=d.photos, zc=z();
  for(let i=0;i<steps;i++){ zout.click(); await settle(); }
  const d2=__data();
  if(Number(d2.photos)!==0) return 'FAIL '+d2.photos+' photo pins at z'+z().toFixed(1);
  if(!/sight:\\d/.test(d2.cats||'')) return 'FAIL the icons did not come back: '+(d2.cats||'none');
  return 'ok z'+z0.toFixed(1)+' → z'+zc.toFixed(1)+': '+close+' photo pins ('+d.photoImages+' painted) → back: 0, icons';
})()`, true, true));

/* F — Guide me: "Look for this", the photo, the name and its Chinese, the credit; a place with none has no row */
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/map/${DRUM}/go` });
await wait(2400);
mapRow('Map 5e · F: Guide me — Look for this', await js(`(async()=>{ ${MAP_H} ${PHOTO_H}
  for(let i=0;i<60&&!document.querySelector('.gm-panel');i++) await __sleep(100);
  const look=document.querySelector('.gm-look');
  if(!look) return 'FAIL no Look for this';
  if(!(await __waitImg('.gm-look img'))) return 'FAIL its photo did not load';
  if(look.querySelector('.gm-look1')?.textContent.trim()!=='Look for this') return 'FAIL it reads '+look.querySelector('.gm-look1')?.textContent;
  const names=look.querySelector('.gm-look2')?.textContent.replace(/\\s+/g,' ').trim();
  if(names!=='Drum Tower · 鼓楼') return 'FAIL the names read '+names;
  const credit=look.querySelector('.gm-look3')?.textContent.trim();
  if(credit!==${JSON.stringify(creditOf(DRUM))}) return 'FAIL the credit reads '+credit;
  const panel=document.querySelector('.gm-panel'), acts=panel.querySelector('.gm-acts');
  if(!(look.compareDocumentPosition(acts)&Node.DOCUMENT_POSITION_FOLLOWING)) return 'FAIL the row is not above the map apps';
  look.click();
  for(let i=0;i<30&&!document.querySelector('.pv');i++) await __sleep(100);
  if(!document.querySelector('.pv')) return 'FAIL the photo does not open full screen';
  history.back();
  for(let i=0;i<30&&document.querySelector('.pv');i++) await __sleep(100);
  if(!document.querySelector('.gm-panel')) return 'FAIL back left Guide me';
  location.hash='#/trip/cn26/map/cn26-place-07/go';
  for(let i=0;i<50&&!/Massage/.test(document.querySelector('.gm-to')?.textContent||'');i++) await __sleep(100);
  await __sleep(400);
  if(document.querySelector('.gm-look')) return 'FAIL a Look for this row with no photo';
  return 'ok the photo, “Drum Tower · 鼓楼”, '+credit+' · full screen and back · none for the Massage Hospital';
})()`, true, true));

/* THE PLACES' SHEET FOLDED AWAY AND BACK (Map 5e — the owner's addition: "press on an arrow … to make it
   disappear and an arrow to reappear"). The chevron folds "Near you" to a bar — its title, how many, "Show
   places": the rail goes, the map takes the room back with nothing on it moving, focus stays on the chevron.
   The choice holds as the tab is left and opened again; a place still opens its sheet; the grab unfolds it too,
   the rail rising into place — and under Calm motion nothing slides. It ends unfolded (the phone forgets). */
mapRow('Map 5e · the places sheet folds away and back (the owner’s arrow)', await js(`(async()=>{ ${MAP_H}
  location.hash='#/trip/cn26/map';
  for(let i=0;i<60&&!document.querySelector('.m-peek .rail .rc');i++) await __sleep(100);
  await __idle(15000); await __sleep(800);
  const peek=()=>document.querySelector('.m-peek'), btn=()=>document.querySelector('.m-peekbtn');
  if(!peek()||!btn()) return 'FAIL no places sheet, or no chevron on it';
  const b=btn();
  if(b.getAttribute('aria-expanded')!=='true') return 'FAIL the chevron does not say the places are shown';
  if(b.getAttribute('aria-label')!=='Hide places') return 'FAIL the chevron is named '+b.getAttribute('aria-label');
  const body=document.getElementById(b.getAttribute('aria-controls')||'');
  if(!body||!body.contains(document.querySelector('.m-peek .rail'))) return 'FAIL aria-controls does not name the box the rail is in';
  const r=b.getBoundingClientRect();
  if(r.width<44||r.height<44) return 'FAIL the chevron is '+Math.round(r.width)+'x'+Math.round(r.height);
  const h0=peek().getBoundingClientRect().height, foot0=document.querySelector('.m-foot').getBoundingClientRect().bottom;
  const pins0=(__data().at||'').split(' ').filter(Boolean);
  b.focus(); b.click();
  await __sleep(500); await __idle(10000); await __sleep(500);
  if(document.querySelector('.m-peek .rail')) return 'FAIL the rail is still there';
  if(btn()!==b) return 'FAIL the chevron was drawn anew (focus would be lost)';
  if(document.activeElement!==b) return 'FAIL focus left the chevron';
  if(b.getAttribute('aria-expanded')!=='false') return 'FAIL the chevron still says shown';
  if(!/Show places/.test(b.textContent)) return 'FAIL the bar has no Show places: '+b.textContent.trim();
  const sub=(peek().querySelector('.m-peeksub')?.textContent||'').trim();
  if(!/^\\d+ places?$/.test(sub)) return 'FAIL the bar does not count the places: '+sub;
  const h1=peek().getBoundingClientRect().height, foot1=document.querySelector('.m-foot').getBoundingClientRect().bottom;
  if(!(h0-h1>120)) return 'FAIL the sheet gave back only '+Math.round(h0-h1)+' px';
  if(!(foot1-foot0>120)) return 'FAIL the map foot moved only '+Math.round(foot1-foot0)+' px: the map did not take the room';
  /* nothing on the map moved: every pin drawn where it was (more may show in the room given back) */
  const pins1=(__data().at||'').split(' ').filter(Boolean).map(p=>p.split(',').map(Number));
  const moved=pins0.map(p=>p.split(',').map(Number)).filter(([x,y])=>!pins1.some(([a,c])=>Math.abs(a-x)<2&&Math.abs(c-y)<2));
  if(!pins0.length) return 'FAIL no pins drawn to watch';
  if(moved.length) return 'FAIL the map jumped: '+moved.length+' of '+pins0.length+' pins moved';
  /* the choice holds as the tab is left and opened again */
  location.hash='#/trip/cn26/now';
  for(let i=0;i<50&&document.querySelector('.m-peek');i++) await __sleep(100);
  await __sleep(500);
  location.hash='#/trip/cn26/map';
  for(let i=0;i<60&&!btn();i++) await __sleep(100);
  await __sleep(800);
  if(document.querySelector('.m-peek .rail')||btn().getAttribute('aria-expanded')!=='false') return 'FAIL the fold was forgotten on the way back to the Map tab';
  /* a place still opens its sheet, and closing it finds the bar */
  location.hash='#/trip/cn26/map/cn26-place-07';
  for(let i=0;i<60&&!/Massage/.test(document.querySelector('.ps h1')?.textContent||'');i++) await __sleep(100);
  if(!/Massage/.test(document.querySelector('.ps h1')?.textContent||'')) return 'FAIL a place no longer opens its sheet while folded';
  history.back();
  for(let i=0;i<40&&document.querySelector('.ps');i++) await __sleep(100);
  await __sleep(600);
  if(!btn()||btn().getAttribute('aria-expanded')!=='false') return 'FAIL closing the place did not find the bar';
  /* the grab unfolds it too, and the rail rises into place */
  document.querySelector('.m-grab').click();
  await __sleep(60);
  const rising=document.getAnimations().filter(a=>a.effect&&a.effect.target&&a.effect.target.id==='m-peekbody');
  for(let i=0;i<40&&!document.querySelector('.m-peek .rail .rc');i++) await __sleep(100);
  if(!document.querySelector('.m-peek .rail .rc')) return 'FAIL the grab did not bring the places back';
  if(btn().getAttribute('aria-expanded')!=='true') return 'FAIL the chevron does not say shown again';
  if(!rising.length) return 'FAIL the rail did not rise into place';
  /* under Calm motion nothing slides */
  document.documentElement.classList.add('calm');
  btn().click(); await __sleep(400); btn().click(); await __sleep(60);
  const sliding=document.getAnimations().filter(a=>a.playState==='running'&&a.effect&&a.effect.target&&a.effect.target.id==='m-peekbody');
  document.documentElement.classList.remove('calm');
  if(sliding.length) return 'FAIL the rail slides under Calm motion';
  await __sleep(500);
  if(btn().getAttribute('aria-expanded')!=='true') return 'FAIL it did not end unfolded';
  const h2=peek().getBoundingClientRect().height;
  if(Math.abs(h2-h0)>2) return 'FAIL the sheet came back '+Math.round(h2)+' px tall, not '+Math.round(h0);
  return 'ok '+Math.round(h0)+' → '+Math.round(h1)+' px, the map foot '+Math.round(foot1-foot0)+' px lower, '+pins0.length+' pins unmoved, focus kept · held across the tab · a place opens · the grab unfolds · still under Calm';
})()`, true, true));

/* every photo URL is handed back once the Map tab is left */
mapRow('Map 5e · photo URLs are handed back', await js(`(async()=>{ ${MAP_H}
  const live=()=>Number(document.documentElement.dataset.photoUrls||0);
  const was=live();
  location.hash='#/trip/cn26/now';
  for(let i=0;i<50&&document.querySelector('.mapscreen');i++) await __sleep(100);
  for(let i=0;i<40&&live()>0;i++) await __sleep(100);
  if(live()!==0) return 'FAIL '+live()+' photo URLs still live after leaving the Map tab';
  return 'ok '+was+' live on the Map → 0 after leaving it';
})()`, true, true));

/* ============================================================
   MAP 5F — THE FIXES FOR THE PHOTOS AND THE FOLD (FIX-5F.md), EACH WALKED
   WHERE IT FAILED. The pack with the tiny photo set is on the phone.
   · a second place opens at its top (item 1): Beihai Park scrolled down to
     Navigate, then the Drum Tower in the same sheet — 5e opened it where
     Beihai had been scrolled to, its photo and About scrolled away;
   · the pack imports from a file that can only be read from its start, in
     order (item 2) — what a pack picked straight from Google Drive can be on
     the phone: 5e read the PICKED file's metadata, trailer and index;
   · the Israel trip with the China pack shows no empty photo boxes (item 8);
   · the nav never covers the end of a sheet's words, at 412 and 384 (item
     15): 5e's place sheet scrolled under the fixed nav, its last ~90 px
     hidden on first view.
   ============================================================ */
const SHEET_H =
  "const __box=()=>document.querySelector('.m-sheetbox')||document.querySelector('.m-sheet');" +
  /* every word of the sheet that shows — clipped to its scroll box — and lies under the nav */
  "const __underNav=()=>{ const box=__box(), nav=document.querySelector('.navbar'); if(!box||!nav) return []; const b=box.getBoundingClientRect(), n=nav.getBoundingClientRect();" +
  " return [...box.querySelectorAll('h1,h2,p,a,button,.ps-credit,.ps-cat,.ps-km,.ps-of')].filter(e=>{ const r=e.getBoundingClientRect(); const top=Math.max(r.top,b.top), bot=Math.min(r.bottom,b.bottom); return bot>top+1&&bot>n.top+0.5&&top<n.bottom&&r.right>n.left&&r.left<n.right; }).map(e=>(e.textContent||'').trim().slice(0,16)); };";

/* item 1 — a second place opens at its top; the same place keeps its scroll */
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/map/${BEIHAI}` });
await wait(2400);
mapRow('Map 5f · a second place opens at its top', await js(`(async()=>{ ${MAP_H} ${PHOTO_H} ${SHEET_H}
  for(let i=0;i<60&&!document.querySelector('.ps h1');i++) await __sleep(100);
  await __waitImg('.ps-hero img'); await __sleep(700);
  const go=document.querySelector('.ps-go');
  if(!go) return 'FAIL no Navigate on Beihai Park';
  go.scrollIntoView({block:'nearest'}); await __sleep(500);
  const down=Math.round(__box().scrollTop);
  if(down<60) return 'FAIL Beihai Park’s sheet did not scroll ('+down+' px)';
  await __sleep(1200);
  if(Math.abs(__box().scrollTop-down)>2) return 'FAIL the same place lost its scroll: '+down+' → '+Math.round(__box().scrollTop)+' px';
  /* another place in the same sheet, as a pin tapped in the band of map above it opens one */
  location.hash='#/trip/cn26/map/${DRUM}';
  for(let i=0;i<60&&!/Drum Tower/.test(document.querySelector('.ps h1')?.textContent||'');i++) await __sleep(100);
  await __sleep(600);
  if(!/Drum Tower/.test(document.querySelector('.ps h1')?.textContent||'')) return 'FAIL the Drum Tower did not open';
  const top=Math.round(__box().scrollTop);
  if(top!==0) return 'FAIL the Drum Tower opened '+top+' px down — where Beihai Park was scrolled to';
  const hero=document.querySelector('.ps-hero'), b=__box().getBoundingClientRect();
  if(!hero||hero.getBoundingClientRect().top<b.top-1) return 'FAIL the Drum Tower’s photo is not at the top of its sheet';
  history.back(); await __sleep(400); history.back(); await __sleep(600);
  return 'ok Beihai scrolled '+down+' px, kept; the Drum Tower at its top, its photo first';
})()`, true, true));

/* item 2 — a pack picked as a stream that cannot seek: only its start is ever read, in order. The picked
   file (this pack's name) refuses — and counts — any read that does not start at its first byte, as a Drive
   stream would; the copy in OPFS (another name) is read as ever */
await S('Page.navigate', { url: `${BASE}#/settings` });
await wait(2200);
await js(`(()=>{ const real=Blob.prototype.slice; window.__realSlice=real; window.__deep=0; window.__from0=0;
  Blob.prototype.slice=function(a,b,t){
    if(this instanceof File&&this.name==='houhai-test-photos.pmtiles'){
      const at=(a||0)<0?Math.max(0,this.size+a):(a||0);
      if(at>0){ window.__deep++; const x=real.call(this,0,0); const no=()=>Promise.reject(new DOMException('the picked file cannot seek','NotReadableError'));
        x.arrayBuffer=no; x.text=no; x.stream=()=>new ReadableStream({start(c){ c.error(new DOMException('the picked file cannot seek','NotReadableError')); }}); return x; }
      window.__from0++;
    }
    return real.call(this,a,b,t); };
  return 'ok'; })()`);
const opfsWas = await js(`(async()=>{ try{ const r=await navigator.storage.getDirectory(); const d=await r.getDirectoryHandle('mappacks'); return (await (await d.getFileHandle('map.pmtiles')).getFile()).lastModified; }catch(e){ return 0; } })()`, true);
await setFile('section.mappack input[type=file]', PHOTO_PACK);
mapRow('Map 5f · a pack that can only be read in order imports', await js(`(async()=>{ ${MAP_H}
  const mod=async()=>{ try{ const r=await navigator.storage.getDirectory(); const d=await r.getDirectoryHandle('mappacks'); return (await (await d.getFileHandle('map.pmtiles')).getFile()).lastModified; }catch(e){ return 0; } };
  let sec=null;
  for(let i=0;i<200;i++){ sec=[...document.querySelectorAll('section.group')].find(s=>s.getAttribute('aria-label')==='Map pack'); if((await mod())!==${Number(opfsWas) || 0}&&sec&&/· 4 photos/.test(sec.innerText)&&!sec.querySelector('.pk-progress,[role=progressbar]')) break; await __sleep(100); }
  await __sleep(400);
  const deep=window.__deep, from0=window.__from0;
  Blob.prototype.slice=window.__realSlice;
  const problem=(document.querySelector('.pk-problem')||{}).textContent;
  if(problem) return 'FAIL the import refused it: '+problem.trim().slice(0,60);
  if(deep) return 'FAIL the importer asked the picked file for '+deep+' read(s) past its start — a stream from Drive cannot seek';
  if((await mod())===${Number(opfsWas) || 0}) return 'FAIL no new copy landed in OPFS';
  const size=await __opfs();
  if(size!==${readFileSync(PHOTO_PACK).length}) return 'FAIL the phone holds '+size+' bytes, not the pack';
  if(!/· 4 photos/.test(sec.innerText)) return 'FAIL the pack row reads: '+sec.innerText.replace(/\\s+/g,' ').slice(0,80);
  return 'ok '+from0+' read(s) from its start, 0 past it; '+size+' bytes in OPFS, checked whole there · 4 photos';
})()`, true, true));
await js(`(()=>{ if(window.__realSlice) Blob.prototype.slice=window.__realSlice; return 'ok'; })()`);

/* item 8 — the Israel trip with the China pack: no photos, no empty boxes. The sample trip (seed/israel-test)
   is imported the way the install imported China, walked where it pins a place — Ein Bokek, on the Dead Sea —
   and deleted again through the shelf, so the walk goes on with China alone, as it was */
const ISRAEL_SEED = join(APP, '..', 'seed', 'israel-test.trip.json');
await S('Page.navigate', { url: `${BASE}#/trips` });
await wait(2200);
await js(`window.__il=${JSON.stringify(readFileSync(ISRAEL_SEED, 'utf8'))};'ok'`);
const ilIn = await js(`(async()=>{
  [...document.querySelectorAll('button')].find(b=>/Import a trip/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,800));
  const dt=new DataTransfer(); dt.items.add(new File([window.__il],'il.json',{type:'application/json'}));
  const i=document.querySelector('.filebtn input[type=file]'); i.files=dt.files; i.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,2000));
  const go=[...document.querySelectorAll('button')].find(b=>/^(Import|Replace & import)$/.test(b.textContent.trim()));
  if(!go) return 'FAIL no Import button for the sample trip';
  go.click(); await new Promise(r=>setTimeout(r,3500));
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const trips=await new Promise(r=>{const q=db.transaction('trips').objectStore('trips').getAll();q.onsuccess=()=>r(q.result)}); db.close();
  return trips.map(t=>t.id).sort().join(',');
})()`, true, true);
await S('Emulation.setGeolocationOverride', { latitude: 31.1985, longitude: 35.3655, accuracy: 20 });
await S('Page.navigate', { url: `${BASE}?d=2026-08-13#/trip/il26/map` });
await wait(2600);
const ilMap = String(ilIn) !== 'cn26,il26' ? `FAIL the sample trip did not import (the vault holds ${ilIn})` : await js(`(async()=>{ ${MAP_H}
  await __idle(20000);
  for(let i=0;i<80&&!document.querySelector('.rail .rc-open');i++) await __sleep(100);
  await __sleep(800);
  const cards=[...document.querySelectorAll('.rail .rc:not(.all)')];
  if(!cards.length) return 'FAIL no card on the rail at the Dead Sea';
  if(document.querySelector('.rail .rc-ph')) return 'FAIL '+document.querySelectorAll('.rail .rc-ph').length+' photo box(es) on '+cards.length+' card(s) — the China pack’s colours';
  if(Number(__data().photos||0)) return 'FAIL photo pins on the Israel trip';
  cards[0].querySelector('.rc-open').click();
  for(let i=0;i<50&&!document.querySelector('.ps h1');i++) await __sleep(100);
  await __sleep(600);
  const ps=document.querySelector('.ps');
  if(!ps) return 'FAIL the card opens no sheet';
  if(ps.querySelector('.ps-hero')) return 'FAIL a photo box on '+ps.querySelector('h1').textContent.trim();
  if(ps.querySelector('.ps-about')) return 'FAIL an About on the Israel trip';
  const name=ps.querySelector('h1').textContent.trim();
  history.back(); await __sleep(500);
  return 'ok '+cards.length+' card(s), no photo box; '+name+': no photo, no About';
})()`, true, true);
await S('Emulation.setGeolocationOverride', { latitude: 39.938, longitude: 116.3871, accuracy: 25 });
await S('Page.navigate', { url: `${BASE}#/trips` });
await wait(2200);
const ilOut = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const card=[...document.querySelectorAll('.tripcard')].find(c=>/Israel/.test(c.textContent));
  if(!card) return 'no card for the sample trip';
  card.querySelector('.tc-menu').click(); await sleep(800);
  const del=[...document.querySelectorAll('button')].find(b=>/Delete trip/.test(b.textContent));
  if(!del) return 'no Delete trip';
  del.click(); await sleep(400);
  const armed=[...document.querySelectorAll('button')].find(b=>/Tap again/.test(b.textContent));
  if(!armed) return 'the delete did not arm';
  armed.click(); await sleep(2500);
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const trips=await new Promise(r=>{const q=db.transaction('trips').objectStore('trips').getAll();q.onsuccess=()=>r(q.result)}); db.close();
  return trips.map(t=>t.id).join(',');
})()`, true, true);
mapRow('Map 5f · the Israel trip with the China pack: no empty boxes', String(ilOut) !== 'cn26' && String(ilMap).startsWith('ok') ? `FAIL the sample trip was not deleted again: ${ilOut}` : ilMap);

/* item 10 — "Around here" (no position: sorted round the map's middle) keeps its order as the places fold away and
   come back: the fold moves nothing on the screen, only the centre the room is measured from — 5e re-sorted the
   rail round that new centre a moment after "Show places" */
await S('Emulation.setGeolocationOverride', {});
await S('Page.navigate', { url: 'about:blank' });
await S('Page.navigate', { url: MAP_URL });
await wait(2600);
mapRow('Map 5f · “Around here” keeps its order as the places come back', await js(`(async()=>{ ${MAP_H}
  await __idle(20000);
  for(let i=0;i<60&&!document.querySelector('.rail .rc-open');i++) await __sleep(100);
  await __sleep(1500);
  const head=(document.querySelector('#m-near')?.textContent||'').trim();
  if(head!=='Around here') return 'FAIL the rail is "'+head+'" — this needs no position';
  const order=()=>[...document.querySelectorAll('.rail .rc-open')].map(b=>b.dataset.place).join(' ');
  const was=order();
  const btn=()=>document.querySelector('.m-peekbtn');
  btn().click(); await __sleep(900); await __idle(10000); await __sleep(600);
  btn().click(); await __sleep(120);
  const back=order();
  await __sleep(1500);
  const later=order();
  try{ localStorage.removeItem('ltd:map:peekHidden'); }catch(e){}
  if(back!==was) return 'FAIL the rail came back in another order';
  if(later!==was) return 'FAIL the rail sorted itself again a moment after the places came back';
  return 'ok '+was.split(' ').length+' cards, the same order before, on and after the fold';
})()`, true, true));
await S('Emulation.setGeolocationOverride', { latitude: 39.938, longitude: 116.3871, accuracy: 25 });

/* item 15 — the nav never covers a sheet's words, at the top of a place and at its end, at 412 and 384. Beihai
   Park (its photo, About, links, distance, Navigate) and the Massage Hospital (no photo); the filters and the
   list rise above the nav; Guide me has none */
const navRows = [];
for (const [w, h] of [
  [412, 915],
  [384, 824],
]) {
  await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
  for (const id of [BEIHAI, 'cn26-place-07']) {
    await S('Page.navigate', { url: 'about:blank' });
    await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/map/${id}` });
    await wait(2400);
    navRows.push(await js(`(async()=>{ ${MAP_H} ${PHOTO_H} ${SHEET_H}
      for(let i=0;i<60&&!document.querySelector('.ps h1');i++) await __sleep(100);
      await __waitImg('.ps-hero img', 3000); await __sleep(900);
      const nav=document.querySelector('.navbar');
      if(!nav) return 'FAIL ${w} no nav over the place';
      const name=document.querySelector('.ps h1').textContent.trim().split(' ')[0];
      const first=__underNav();
      if(first.length) return 'FAIL ${w} '+name+' at its top: '+first.length+' under the nav ('+first.slice(0,2).join(' | ')+')';
      __box().scrollTop=__box().scrollHeight; await __sleep(500);
      const end=__underNav();
      if(end.length) return 'FAIL ${w} '+name+' at its end: '+end.length+' under the nav ('+end[0]+')';
      const last=[...__box().querySelectorAll('.ps-act, .ps-pass, .ps-go, .ps-link')].pop();
      if(last&&last.getBoundingClientRect().bottom>nav.getBoundingClientRect().top) return 'FAIL ${w} '+name+'’s last control under the nav';
      const gap=Math.round(nav.getBoundingClientRect().top-__box().getBoundingClientRect().bottom);
      return 'ok ${w} '+name+' '+gap+' px';
    })()`, true, true));
  }
  /* the filters and the list: sheets above the nav — its middle is theirs */
  for (const [label, open] of [
    ['filters', `document.querySelector('.m-toprow button[aria-label="Filters: what to show on the map"]').click()`],
    ['list', `document.querySelector('.m-listbtn').click()`],
  ]) {
    await S('Page.navigate', { url: 'about:blank' });
    await S('Page.navigate', { url: MAP_URL });
    await wait(2400);
    navRows.push(await js(`(async()=>{ ${MAP_H}
      await __idle(15000);
      ${open};
      for(let i=0;i<30&&!document.querySelector('.sheet');i++) await __sleep(100);
      await __sleep(700);
      const sh=document.querySelector('.sheet'), nav=document.querySelector('.navbar');
      if(!sh) return 'FAIL ${w} no ${label} sheet';
      const body=sh.querySelector('.sheet-body'); body.scrollTop=body.scrollHeight; await __sleep(300);
      if(nav){ const n=nav.getBoundingClientRect(); const at=document.elementFromPoint(n.left+n.width/2, n.top+n.height/2);
        if(nav.contains(at)) return 'FAIL ${w} the nav is drawn over the ${label}'; }
      const kids=[...body.querySelectorAll('button, a, input, label, p, li')].filter(e=>e.getClientRects().length);
      const last=kids.pop();
      if(last){ const r=last.getBoundingClientRect(); const at=document.elementFromPoint(Math.min(r.left+8,innerWidth-2), Math.min(r.bottom-4,innerHeight-2));
        if(nav&&nav.contains(at)) return 'FAIL ${w} the ${label}’s end is under the nav'; }
      history.back(); await __sleep(500);
      return 'ok ${w} ${label}';
    })()`, true, true));
  }
  /* "Near you": its cards end above the nav */
  await S('Page.navigate', { url: 'about:blank' });
  await S('Page.navigate', { url: MAP_URL });
  await wait(2400);
  navRows.push(await js(`(async()=>{ ${MAP_H}
    await __idle(15000);
    for(let i=0;i<60&&!document.querySelector('.m-peek .rail .rc');i++) await __sleep(100);
    await __sleep(600);
    const nav=document.querySelector('.navbar');
    if(!nav) return 'FAIL ${w} no nav over Near you';
    const n=nav.getBoundingClientRect();
    const under=[...document.querySelectorAll('.m-peek .rail .rc, .m-peek .m-peekhead button')].filter(e=>{ const r=e.getBoundingClientRect(); return r.bottom>n.top+0.5&&r.right>n.left&&r.left<n.right; });
    return under.length ? 'FAIL ${w} '+under.length+' of Near you’s cards under the nav' : 'ok ${w} near you';
  })()`, true, true));
  /* Guide me: no nav at all */
  await S('Page.navigate', { url: 'about:blank' });
  await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/map/${DRUM}/go` });
  await wait(2400);
  navRows.push(await js(`(async()=>{ for(let i=0;i<40&&!document.querySelector('.gm-panel');i++) await new Promise(r=>setTimeout(r,100)); return document.querySelector('.gm-panel')&&!document.querySelector('.navbar') ? 'ok ${w} guide' : 'FAIL ${w} Guide me '+(document.querySelector('.gm-panel')?'under the nav':'did not open'); })()`, true));
}
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
{
  const bad = navRows.filter((r) => !String(r).startsWith('ok'));
  mapRow('Map 5f · the nav never covers a sheet’s end (412, 384)', bad.length ? bad[0] : `ok ${navRows.length} views clear: ${navRows.filter((r) => /px$/.test(String(r))).map((r) => String(r).replace(/^ok /, '')).join(', ')}`, 90);
}

/* "Show on map": the guide, a pass, Find and the day — where the map draws the place */
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/journey/cn26-stop-beijing/guide` });
await wait(2600);
mapRow('Show on map · from the guide, a pass, Find, the day', await js(`(async()=>{ ${MAP_H}
  const links=[...document.querySelectorAll('ul.spots .onmap')];
  if(links.length<20) return 'FAIL only '+links.length+' guide places carry "Show on map"';
  const beihai=links.find(a=>/Beihai Park/.test(a.getAttribute('aria-label')||''));
  if(!beihai) return 'FAIL Beihai Park has no "Show on map"';
  if(links.some(a=>/Jinshanling/.test(a.getAttribute('aria-label')||''))) return 'FAIL an unpinned place has a doorway';
  beihai.click();
  for(let i=0;i<60&&!document.querySelector('.ps h1');i++) await __sleep(100);
  if(location.hash!=='#/trip/cn26/map/cn26-spot-beijing-beihai') return 'FAIL the guide went to '+location.hash;
  if(document.querySelector('.ps h1')?.textContent.trim()!=='Beihai Park') return 'FAIL the sheet is not Beihai Park';
  location.hash='#/trip/cn26/pocket/cn26-ticket-forbidden-city';
  for(let i=0;i<40&&!document.querySelector('.ps-row .onmap');i++) await __sleep(100);
  const p=document.querySelector('.ps-row .onmap');
  if(!p) return 'FAIL the Forbidden City pass has no "Show on map"';
  p.click();
  for(let i=0;i<60&&!document.querySelector('.ps h1');i++) await __sleep(100);
  const merged=document.querySelector('.ps h1')?.textContent.trim();
  if(merged!=='Palace Museum') return 'FAIL the ticket opened '+merged;
  if(!/Forbidden City/.test(document.querySelector('.ps-with')?.innerText||'')) return 'FAIL the ticket does not ride with its place';
  location.hash='#/trip/cn26/find'; await __sleep(1000);
  const q=document.getElementById('find-q'); q.value='massage'; q.dispatchEvent(new Event('input',{bubbles:true})); await __sleep(700);
  const f=[...document.querySelectorAll('.frow-w .onmap')].find(a=>/cn26-place-07$/.test(a.getAttribute('href')||''));
  if(!f) return 'FAIL Find shows no "Show on map" for the Massage Hospital';
  location.hash='#/trip/cn26/now/day'; await __sleep(1400);
  const day=[...document.querySelectorAll('.dayplaces .onmap')].map(a=>a.getAttribute('href'));
  if(!day.some(h=>/cn26-place-27$/.test(h))) return 'FAIL Dec 8’s Huguosi chip has no "Show on map": '+day.join(',');
  if(day.some(h=>/jiuhua/.test(h))) return 'FAIL unpinned Jiuhua has a doorway';
  return 'ok '+links.length+' in the guide · the pass → Palace Museum · Find · the day';
})()`, true, true));

/* ============================================================
   MAP 5D — THE FIXES, EACH WALKED WHERE IT FAILED (FIX-5D.md).
   ============================================================ */

/* ADD TO MY DAY: only the day screen's own offer (item 1) — today's stop,
   not a travel day, not a line the day already has. On Dec 8 the Map tab
   offered Kunyu's places (the pick then showed under Beijing's "Planned"),
   the Temple of Heaven the day already names, and on Dec 9 — a travel day —
   Chongli's (Zhangjiajie's on Dec 11 since 2026-10-17). Then one offer taken, shown by the day, and taken back out. */
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/map/cn26-spot-beijing-beihai` });
await wait(2400);
const PICKS = "const __picks=async(d)=>{ const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)}); const all=await new Promise(r=>{const q=db.transaction('dayPicks').objectStore('dayPicks').getAll(); q.onsuccess=()=>r(q.result)}); db.close(); return all.filter(p=>p.date===d); };" +
  "const __sheet=async(id)=>{ if(!location.hash.endsWith('/map/'+id)) location.hash='#/trip/cn26/map/'+id; for(let i=0;i<60;i++){ const ps=document.querySelector('.ps'); if(ps&&location.hash.endsWith('/map/'+id)){ await __sleep(400); return document.querySelector('.ps'); } await __sleep(100); } return null; };" +
  "const __add=(ps)=>ps?[...ps.querySelectorAll('.ps-act')].find(b=>/Add to my day|In my day/.test(b.textContent)):null;";
const dayOffer = await js(`(async()=>{ ${MAP_H} ${PICKS}
  let ps=await __sheet('cn26-spot-beijing-beihai');
  if(!ps) return 'FAIL no sheet for Beihai Park';
  if(!/Add to my day/.test(__add(ps)?.textContent||'')) return 'FAIL Beihai Park — a Beijing line Dec 8 does not have — is not offered';
  ps=await __sheet('cn26-spot-beijing-temple-heaven');
  if(!ps) return 'FAIL no sheet for the Temple of Heaven';
  if(__add(ps)) return 'FAIL the Temple of Heaven is offered: Dec 8 already names it';
  ps=await __sheet('cn26-spot-kunyu-yantaishan');
  if(!ps) return 'FAIL no sheet for Yantai Hill';
  if(__add(ps)) return 'FAIL Yantai Hill — Kunyu’s — is offered on a Beijing day';
  if((await __picks('2026-12-08')).length) return 'FAIL a pick for Dec 8 before any was made';
  ps=await __sheet('cn26-spot-beijing-beihai');
  __add(ps).click();
  for(let i=0;i<30&&!(await __picks('2026-12-08')).length;i++) await __sleep(100);
  const made=await __picks('2026-12-08');
  if(made.length!==1||made[0].stopId!=='cn26-stop-beijing') return 'FAIL the pick written: '+JSON.stringify(made.map(p=>[p.stopId,p.spotId]));
  if(!/In my day/.test(__add(document.querySelector('.ps'))?.textContent||'')) return 'FAIL the sheet does not say In my day';
  location.hash='#/trip/cn26/now/day';
  for(let i=0;i<40&&!document.querySelector('.tcard.mine');i++) await __sleep(100);
  const mine=document.querySelector('.tcard.mine')?.innerText||'';
  if(!/Beihai/.test(mine)) return 'FAIL the day does not show the pick: '+mine.slice(0,40);
  history.back();
  ps=await __sheet('cn26-spot-beijing-beihai');
  __add(ps).click();
  for(let i=0;i<30&&(await __picks('2026-12-08')).length;i++) await __sleep(100);
  if((await __picks('2026-12-08')).length) return 'FAIL the pick was not taken back out';
  return 'ok Beihai offered, picked, in the day, out again; the Temple of Heaven and Kunyu not';
})()`, true, true);
/* The travel-day half was Genting on Dec 9 until skiing was dropped
   (2026-10-17); it is Golden Whip Stream on Dec 11, the day you fly in. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/map/cn26-spot-zhangjiajie-golden-whip` });
await wait(2400);
const dayOfferTravel = await js(`(async()=>{ ${MAP_H} ${PICKS}
  const ps=await __sheet('cn26-spot-zhangjiajie-golden-whip');
  if(!ps) return 'FAIL no sheet for Golden Whip Stream';
  if(__add(ps)) return 'FAIL Golden Whip Stream is offered on Dec 11, a travel day';
  return 'ok';
})()`, true, true);
mapRow('Map · Add to my day only for today’s stop', String(dayOffer).startsWith('ok') && dayOfferTravel !== 'ok' ? dayOfferTravel : dayOffer);

/* NO STALE YOU (item 3; item 10): leave the tab, a minute passes, come back —
   the old fix is where you were, so no dot, no rings, no distances, and
   "Finding where you are…" until a new one. Then location off: the tap is
   answered ("No position yet"), not ignored. Then a fix again: you, back. */
await S('Emulation.setGeolocationOverride', { latitude: 39.938, longitude: 116.3871, accuracy: 25 });
await S('Page.navigate', { url: MAP_URL });
await wait(2400);
const NAV = "const __nav=async(p)=>{ const a=[...document.querySelectorAll('.navbar .navitem')].find(x=>x.dataset.place===p); a.click(); for(let i=0;i<60;i++){ if(p==='map'?!!document.querySelector('.mapscreen'):!document.querySelector('.mapscreen')) break; await __sleep(100); } await __sleep(300); };";
const staleA = await js(`(async()=>{ ${MAP_H} ${NAV}
  await __idle(20000);
  for(let i=0;i<60&&document.querySelector('.m-you.off');i++) await __sleep(100);
  if(document.querySelector('.m-you.off')) return 'FAIL no you to begin with';
  await __nav('now');
  /* a minute on, and the GPS with nothing new to say */
  window.__watch=navigator.geolocation.watchPosition;
  navigator.geolocation.watchPosition=function(){ return 4242; };
  window.__now=Date.now; Date.now=()=>window.__now()+60000;
  await __nav('map');
  await __idle(20000); await __sleep(700); await __idle(10000);
  const you=!document.querySelector('.m-you.off');
  const rings=Number(__data().rings||0);
  const head=(document.querySelector('#m-near')?.textContent||'').trim();
  const sub=(document.querySelector('.m-peeksub')?.textContent||'').trim();
  const dists=[...document.querySelectorAll('.rail .rc-dist')].map(e=>e.textContent.trim()).filter(Boolean).length;
  Date.now=window.__now; navigator.geolocation.watchPosition=window.__watch;
  if(you) return 'FAIL YOU drawn from a fix a minute old';
  if(rings) return 'FAIL '+rings+' rings round where you were';
  if(dists) return 'FAIL '+dists+' distances measured from where you were';
  if(head!=='Around here') return 'FAIL the rail is "'+head+'", not "Around here"';
  if(sub!=='Finding where you are…') return 'FAIL the rail says "'+sub+'"';
  return 'ok';
})()`, true, true);
await S('Emulation.setGeolocationOverride', {});
const staleB = await js(`(async()=>{ ${MAP_H} ${NAV}
  /* past the watch's maximumAge (5 s): a watch started sooner is handed the
     browser's cached position, which is a real (recent) one */
  await __nav('now'); await __sleep(6000); await __nav('map');
  for(let i=0;i<60&&document.querySelector('.mapscreen')?.dataset.located!=='unavailable';i++) await __sleep(100);
  if(document.querySelector('.mapscreen')?.dataset.located!=='unavailable') return 'FAIL location off reads '+document.querySelector('.mapscreen')?.dataset.located;
  document.querySelector('.m-locate').click();
  let said='';
  for(let i=0;i<40&&!said;i++){ said=[...document.querySelectorAll('.toast')].map(t=>t.textContent.trim()).find(t=>/No position yet/.test(t))||''; if(!said) await __sleep(100); }
  if(!said) return 'FAIL "Show where you are" with location off says nothing';
  return 'ok';
})()`, true, true);
await S('Emulation.setGeolocationOverride', { latitude: 39.938, longitude: 116.3871, accuracy: 25 });
const staleC = await js(`(async()=>{ ${MAP_H}
  document.querySelector('.m-locate').click();
  for(let i=0;i<80&&document.querySelector('.m-you.off');i++) await __sleep(100);
  if(document.querySelector('.m-you.off')) return 'FAIL no you after a fresh fix';
  await __sleep(900); await __idle(10000); await __sleep(300);
  if(Number(__data().rings||0)<3) return 'FAIL the rings did not come back';
  const head=(document.querySelector('#m-near')?.textContent||'').trim();
  if(head!=='Near you') return 'FAIL the rail is "'+head+'" with a fresh fix';
  return 'ok';
})()`, true, true);
mapRow('Map · no stale YOU after leaving and coming back', [staleA, staleB, staleC].find((r) => r !== 'ok') ?? 'ok a minute away: no dot, no rings, “Finding…”; location off: “No position yet”; a fix: you');

/* GUIDE ME IN HONG KONG (item 4): Google Maps is the first button, and no
   Amap, no VPN line — the territory rule the map buttons keep. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-23#/trip/cn26/map/cn26-spot-hongkong-tai-kwun/go` });
await wait(2400);
mapRow('Map · Guide me in Hong Kong: Google Maps first', await js(`(async()=>{ ${MAP_H}
  for(let i=0;i<60&&!document.querySelector('.gm-panel .gm-acts');i++) await __sleep(100);
  const panel=document.querySelector('.gm-panel');
  if(!panel) return 'FAIL no Guide me for Tai Kwun';
  const first=panel.querySelector('.gm-acts > button');
  const t=(first?.innerText||'').replace(/\\s+/g,' ').trim();
  if(t!=='Turn-by-turn in Google Maps') return 'FAIL the first button reads "'+t+'"';
  if(/Amap|VPN/.test(panel.innerText)) return 'FAIL Amap or the VPN line is offered in Hong Kong';
  return 'ok "'+t+'" · no Amap, no VPN line';
})()`, true, true));

/* THE MAP THAT CANNOT START (item 5): no WebGL — the fallback, the rail and
   the list still there, and not one uncaught exception. (Map 5c resolved the
   failed start and the screen's effects then threw on a map that was not
   there.) And a map whose worker never starts (item 8): the same fallback
   after START_MS (15 s), not "Opening the map…" for ever. */
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/now` });
await wait(2200);
const errsNoGl = errs.length;
const noGl = await js(`(async()=>{ ${MAP_H} ${NAV}
  const real=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(t,...a){ return /webgl/i.test(String(t))?null:real.call(this,t,...a); };
  await __nav('map');
  for(let i=0;i<100&&!document.querySelector('.m-fail');i++) await __sleep(100);
  const fail=document.querySelector('.m-fail');
  if(!fail) return 'FAIL no fallback: '+(document.querySelector('.m-wait')?'still "Opening the map…"':'nothing');
  if(!/could not start/.test(fail.textContent)) return 'FAIL the fallback says '+fail.textContent.trim();
  await __sleep(600);
  if(document.querySelector('.maplibregl-canvas')) return 'FAIL a map canvas was left behind';
  const cards=document.querySelectorAll('.rail .rc-open').length;
  if(cards<3) return 'FAIL the rail went with the map ('+cards+' cards)';
  document.querySelector('.m-listbtn').click();
  for(let i=0;i<30&&!document.querySelector('.sheet');i++) await __sleep(100);
  const listed=document.querySelectorAll('.sheet .pl-row').length;
  history.back(); await __sleep(700);
  if(listed<10) return 'FAIL the list went with the map ('+listed+' rows)';
  document.querySelector('.rail .rc-open').click();
  for(let i=0;i<40&&!document.querySelector('.ps h1');i++) await __sleep(100);
  const place=document.querySelector('.ps h1')?.textContent.trim();
  history.back(); await __sleep(600);
  const zoom=!!document.querySelector('.m-zoom');
  HTMLCanvasElement.prototype.getContext=real;
  if(!place) return 'FAIL a rail card opens no sheet without a map';
  if(zoom) return 'FAIL zoom buttons for a map that is not there';
  return 'ok '+cards+' rail cards, '+listed+' in the list, '+place+'’s sheet';
})()`, true, true);
const noGlErrs = errs.slice(errsNoGl);
await S('Page.navigate', { url: `${BASE}${MAP_Q}#/trip/cn26/now` });
await wait(2200);
const errsLate = errs.length;
const noLoad = await js(`(async()=>{ ${MAP_H} ${NAV}
  /* a worker that never starts: maplibre asks it, and it never answers */
  window.Worker=class{ constructor(){} postMessage(){} addEventListener(){} removeEventListener(){} terminate(){} };
  const t0=performance.now();
  await __nav('map');
  for(let i=0;i<260&&!document.querySelector('.m-fail');i++) await __sleep(100);
  const s=Math.round((performance.now()-t0)/100)/10;
  if(!document.querySelector('.m-fail')) return 'FAIL still '+(document.querySelector('.m-wait')?'"Opening the map…"':'no word')+' after '+s+' s';
  if(document.querySelector('.maplibregl-canvas')) return 'FAIL the map that never loaded was left on the page';
  return 'ok the fallback after '+s+' s';
})()`, true, true);
const noLoadErrs = errs.slice(errsLate);
mapRow('Map · a map that cannot start: the fallback, no crash', noGlErrs.length ? `FAIL ${noGlErrs.length} uncaught: ${noGlErrs[0].slice(5, 70)}`
  : !String(noGl).startsWith('ok') ? noGl
  : !String(noLoad).startsWith('ok') ? noLoad
  : noLoadErrs.length ? `FAIL ${noLoadErrs.length} uncaught with no worker: ${noLoadErrs[0].slice(5, 50)}`
  : `${noGl} · no worker: ${String(noLoad).slice(3)}`, 90);

/* WHERE A SCREEN OPENS (item 6): stepped to, at its top; stepped back to,
   where it was left. Map 5c ended the "Loading…" flash that used to reset
   the scroll: scrolled down Now, Journey opened at Now's offset. Now's day
   (Dec 11, the travel day — Now's home fits one screen) → the nav's Journey
   → back; the day → To do → back; the Pocket's Travel list → a pass → back
   (it reset to its top); and the guide's own rule, kept: back from a pass,
   the guide is where it was left (Run 3c). */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/now/day` });
await wait(2400);
const scrollWalk = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(f)=>{ for(let i=0;i<50&&!f();i++) await sleep(100); await sleep(700); };
  const nav=(p)=>[...document.querySelectorAll('.navbar .navitem')].find(x=>x.dataset.place===p);
  const room=()=>document.documentElement.scrollHeight-innerHeight;
  if(room()<500) return 'FAIL the day is too short to scroll ('+room()+' px)';
  window.scrollTo(0,420); await sleep(400);
  const y0=Math.round(scrollY);
  nav('journey').click(); await until(()=>/journey$/.test(location.hash));
  const j=Math.round(scrollY);
  if(room()<y0) return 'FAIL Journey is too short to tell ('+room()+' px)';
  if(j!==0) return 'FAIL Journey opened at '+j+' px, the day’s offset';
  history.back(); await until(()=>/now\\/day$/.test(location.hash));
  if(Math.abs(scrollY-y0)>2) return 'FAIL back, the day is at '+Math.round(scrollY)+' px, not '+y0;
  /* another of Now's screens: To do */
  location.hash='#/trip/cn26/now/todo';
  await until(()=>/now\\/todo$/.test(location.hash));
  if(room()<y0) return 'FAIL To do is too short to tell ('+room()+' px)';
  if(Math.round(scrollY)!==0) return 'FAIL To do opened at '+Math.round(scrollY)+' px';
  history.back(); await until(()=>/now\\/day$/.test(location.hash));
  if(Math.abs(scrollY-y0)>2) return 'FAIL back from To do, the day is at '+Math.round(scrollY)+' px, not '+y0;
  /* the Pocket's Travel list → a pass → back */
  location.hash='#/trip/cn26/pocket/travel'; await until(()=>/pocket\\/travel$/.test(location.hash));
  if(room()<400) return 'FAIL Travel is too short ('+room()+' px)';
  window.scrollTo(0,Math.min(700,room()-10)); await sleep(400);
  const t0=Math.round(scrollY);
  const pass=[...document.querySelectorAll('a[href*="/pocket/cn26-"]')].find(a=>{ const r=a.getBoundingClientRect(); return r.top>60&&r.bottom<innerHeight-120; });
  if(!pass) return 'FAIL no pass in view on Travel';
  pass.click(); await until(()=>!/pocket\\/travel$/.test(location.hash));
  if(Math.round(scrollY)!==0) return 'FAIL the pass opened at '+Math.round(scrollY)+' px';
  history.back(); await until(()=>/pocket\\/travel$/.test(location.hash));
  if(Math.abs(scrollY-t0)>2) return 'FAIL back, Travel is at '+Math.round(scrollY)+' px, not '+t0;
  /* the guide's own rule: back from a pass, where it was left */
  location.hash='#/trip/cn26/journey/cn26-stop-beijing/guide'; await until(()=>/guide$/.test(location.hash));
  await sleep(600);
  const link=[...document.querySelectorAll('a.gd-item[href*="/pocket/"]')][0];
  if(!link) return 'FAIL no pass link in the Beijing guide';
  link.scrollIntoView({block:'center'}); await sleep(500);
  const g0=Math.round(scrollY);
  if(g0<800) return 'FAIL the guide’s pass link is too near the top to tell ('+g0+' px)';
  link.click(); await until(()=>/pocket\\//.test(location.hash));
  if(Math.round(scrollY)!==0) return 'FAIL the pass from the guide opened at '+Math.round(scrollY)+' px';
  history.back(); await until(()=>/guide$/.test(location.hash));
  await sleep(500);
  if(Math.abs(scrollY-g0)>60) return 'FAIL back, the guide is at '+Math.round(scrollY)+' px, not '+g0;
  return 'ok the day '+y0+' → Journey 0 → back '+y0+'; To do 0 → back; Travel '+t0+' → pass 0 → back; the guide '+g0+' → pass → back';
})()`, true, true);
rows.push([String(scrollWalk).startsWith('ok') ? 'PASS' : 'FAIL', 'Scroll · forward at the top, back where it was', String(scrollWalk).replace(/^ok /, '').slice(0, 96)]);

/* not one request off this machine: the map's streets, pins and fonts are the app's own */
{
  const off = netlog.slice(mapNet0).filter((u) => !/^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|data:|blob:|about:|chrome-extension:)/.test(u) && !/open-meteo/.test(u));
  rows.push([off.length === 0 ? 'PASS' : 'FAIL', 'Map · nothing asked off this machine', off.length ? off.slice(0, 2).join(' ').slice(0, 64) : `${netlog.length - mapNet0} requests, all local (the forecast apart)`]);
}

/* ============================================================
   HORIZON RUN 4 — THE A11Y FLOOR, EVERY SCREEN, AT 412 AND 384 PX.

   Four properties, swept over every screen and the overlays at both
   widths (412, the boards; 384, the S23 Ultra's real CSS width):
   · every control has a name — read from Chrome's own accessibility tree,
     the name TalkBack would speak, not guessed from the DOM;
   · every target is at least 44 × 44 px — a control's own box, or the
     hit area its ::before / ::after gives it (a link inside running text
     is exempt, as WCAG exempts it);
   · focus is a ring the eye can find — drawn (on the control, or by its
     label / field around it) and not cut away by a scroll box or a card
     that clips: at least half of it on screen once focus has scrolled
     the control into view, as a keyboard would;
   · one h1 per screen, and no heading level skipped.
   Transitions and entrance animations are frozen while it measures, so a
   ring that fades in, or a row still rising, is read in its end state.
   ============================================================ */
const A11Y_SWEEP = `(()=>{
  if(!document.getElementById('__still')){ const st=document.createElement('style'); st.id='__still'; st.textContent='*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}'; document.head.appendChild(st); }
  const SEL='a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=switch], [role=checkbox], [role=tab], [tabindex]:not([tabindex="-1"])';
  const vis=(el)=>{ if(!el.getClientRects().length) return false; const s=getComputedStyle(el); return s.visibility!=='hidden'&&s.display!=='none'; };
  const tag=(el)=>el.tagName.toLowerCase()+'.'+String(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className).split(' ').filter(c=>c&&!c.startsWith('_')).slice(0,2).join('.')+'"'+(el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,14)+'"';
  const ctrls=[...document.querySelectorAll(SEL)].filter(vis).filter(el=>!(el.getAttribute('tabindex')==='-1'&&el.getAttribute('aria-hidden')==='true'));
  const small=[],ring=[],skips=[];
  for(const el of ctrls){
    let target=el;
    if(el.tagName==='INPUT'&&/^(checkbox|radio|file)$/.test(el.type)&&el.closest('label')) target=el.closest('label');
    const r=target.getBoundingClientRect(); let L=r.left,T=r.top,R=r.right,B=r.bottom;
    for(const p of ['::before','::after']){
      const s=getComputedStyle(target,p);
      if(s.content==='none'||s.content==='normal'||s.position!=='absolute'||s.pointerEvents==='none') continue;
      const px=(v)=>v==='auto'?null:parseFloat(v); const t=px(s.top),l=px(s.left),rr=px(s.right),b=px(s.bottom);
      if(t!==null&&l!==null&&rr!==null&&b!==null){ L=Math.min(L,r.left+l); T=Math.min(T,r.top+t); R=Math.max(R,r.right-rr); B=Math.max(B,r.bottom-b); }
    }
    const inline=el.tagName==='A'&&el.closest('p, li, .md, .prose')&&getComputedStyle(el).display==='inline';
    if(!inline&&(R-L<43.5||B-T<43.5)) small.push(tag(el)+' '+Math.round(R-L)+'x'+Math.round(B-T));
    if(el.disabled) continue;
    const near=[el.parentElement,el.parentElement&&el.parentElement.parentElement,...(el.parentElement?[...el.parentElement.children].filter(c=>c!==el):[])].filter(Boolean);
    const look=(a)=>{const s=getComputedStyle(a);return s.outlineStyle+s.outlineWidth+s.boxShadow+s.borderColor;};
    /* the last control's ring must go first: a sibling losing ITS ring is not
       a ring drawn for this one */
    if(document.activeElement&&document.activeElement!==document.body&&document.activeElement.blur) document.activeElement.blur();
    const before=near.map(look);
    el.focus();
    if(document.activeElement!==el) continue;
    const s=getComputedStyle(el);
    const within=near.some((a,i)=>look(a)!==before[i]);
    const ow=s.outlineStyle!=='none'?parseFloat(s.outlineWidth)||0:0;
    if((!ow&&s.boxShadow==='none')||+s.opacity===0){ if(!within) ring.push(tag(el)+' no ring'); continue; }
    if(!ow||within) continue;
    const g=(parseFloat(s.outlineOffset)||0)+ow, er=el.getBoundingClientRect();
    const o={l:er.left-g,t:er.top-g,r:er.right+g,b:er.bottom+g};
    let c={l:-1e9,t:-1e9,r:1e9,b:1e9};
    for(let a=el.parentElement;a&&a!==document.documentElement;a=a.parentElement){
      const as=getComputedStyle(a);
      if(as.overflowX==='visible'&&as.overflowY==='visible') continue;
      const ar=a.getBoundingClientRect();
      c={l:Math.max(c.l,ar.left+(parseFloat(as.borderLeftWidth)||0)),t:Math.max(c.t,ar.top+(parseFloat(as.borderTopWidth)||0)),r:Math.min(c.r,ar.right-(parseFloat(as.borderRightWidth)||0)),b:Math.min(c.b,ar.bottom-(parseFloat(as.borderBottomWidth)||0))};
    }
    const seg=(a0,a1,lo,hi)=>Math.max(0,Math.min(a1,hi)-Math.max(a0,lo));
    const inY=(y)=>y>=c.t&&y<=c.b, inX=(x)=>x>=c.l&&x<=c.r;
    const shown=(inY(o.t)?seg(o.l,o.r,c.l,c.r):0)+(inY(o.b)?seg(o.l,o.r,c.l,c.r):0)+(inX(o.l)?seg(o.t,o.b,c.t,c.b):0)+(inX(o.r)?seg(o.t,o.b,c.t,c.b):0);
    const frac=shown/(2*((o.r-o.l)+(o.b-o.t)));
    if(frac<0.5) ring.push(tag(el)+' '+Math.round(frac*100)+'% shown');
  }
  if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
  const hs=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].filter(h=>(h.getClientRects().length||h.closest('.sr-only'))&&!h.closest('[aria-hidden="true"]'));
  const lv=(h)=>h.getAttribute('aria-level')?+h.getAttribute('aria-level'):+h.tagName[1];
  let prev=0;
  for(const h of hs){ const v=lv(h); if(prev&&v>prev+1) skips.push('h'+prev+'>h'+v+' '+h.textContent.trim().slice(0,18)); prev=v; }
  if(hs.filter(h=>lv(h)===1).length!==1) skips.push(hs.filter(h=>lv(h)===1).length+' h1');
  return JSON.stringify({n:ctrls.length,small,ring,skips});
})()`;
const AX_INTERACTIVE = new Set(['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'switch', 'radio', 'slider', 'spinbutton', 'menuitem', 'tab', 'DisclosureTriangle', 'listbox', 'ToggleButton', 'PopUpButton']);
await S('DOM.enable');
await S('Accessibility.enable');
async function axNameless() {
  const { nodes } = await S('Accessibility.getFullAXTree');
  const bad = [];
  for (const n of nodes) {
    if (n.ignored || !AX_INTERACTIVE.has(n.role?.value)) continue;
    if (String(n.name?.value ?? '').replace(/[^\p{L}\p{N}]/gu, '')) continue;
    let who = n.role.value;
    try {
      const d = await S('DOM.describeNode', { backendNodeId: n.backendDOMNodeId });
      const a = d.node.attributes || [];
      who += ':' + d.node.nodeName.toLowerCase() + '.' + String(a[a.indexOf('class') + 1] || '').split(' ').filter((c) => c && !c.startsWith('_')).slice(0, 2).join('.');
    } catch {}
    bad.push(who);
  }
  return bad;
}
const D11 = '?d=2026-12-11';
const FLOOR_SCREENS = [
  ['trips', '#/trips', ''], ['settings', '#/settings', ''], ['backup', '#/backup', ''],
  ['now', '#/trip/cn26/now', D11], ['day (travel)', '#/trip/cn26/now/day', D11], ['day (ordinary)', '#/trip/cn26/now/day', '?d=2026-12-13'],
  ['to do', '#/trip/cn26/now/todo', D11], ['packing', '#/trip/cn26/now/todo/packing', D11], ['checklists', '#/trip/cn26/now/todo/lists', D11],
  ['journey', '#/trip/cn26/journey', D11], ['city', '#/trip/cn26/journey/cn26-stop-zhangjiajie', D11], ['guide', '#/trip/cn26/journey/cn26-stop-zhangjiajie/guide', D11],
  ['pocket', '#/trip/cn26/pocket', D11], ['pass', '#/trip/cn26/pocket/cn26-flight-mu394', D11],
  ...['travel', 'stays', 'experiences', 'cards', 'money', 'docs', 'driver', 'phrases', 'visa', 'emergency', 'convert', 'health', 'info', 'notes', 'clocks'].map((s) => [s, `#/trip/cn26/pocket/${s}`, D11]),
  ['find', '#/trip/cn26/find', D11],
  /* the Map tab (Map 5c): the map, a place's sheet, Guide me — you by Houhai on Dec 8 */
  ['map', '#/trip/cn26/map', '?d=2026-12-08'], ['map · a place', '#/trip/cn26/map/cn26-place-07', '?d=2026-12-08'], ['map · guide me', '#/trip/cn26/map/cn26-place-07/go', '?d=2026-12-08'],
  /* Map 5d: Guide me in Hong Kong — Google first, the driver card alone on its row */
  ['map · guide me (Hong Kong)', '#/trip/cn26/map/cn26-spot-hongkong-tai-kwun/go', '?d=2026-12-23'],
  /* Map 5e: a place with its photo and About; Guide me with Look for this (the pack with photos is on the phone by now) */
  ['map · a place with its photo', '#/trip/cn26/map/cn26-spot-beijing-beihai', '?d=2026-12-08'],
  ['map · guide me with its photo', '#/trip/cn26/map/cn26-spot-beijing-drum-tower/go', '?d=2026-12-08'],
];
/* the overlays, opened the way a thumb opens them */
const FLOOR_OVERLAYS = [
  ['find "daxing"', '#/trip/cn26/find', D11, "(async()=>{const i=document.querySelector('.ffield input'); i.value='daxing'; i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,900)); return 'ok';})()"],
  ['counter mode', '#/trip/cn26/pocket', '?d=2026-12-16', "(async()=>{[...document.querySelectorAll('button')].find(b=>/Counter mode/i.test(b.textContent)).click(); await new Promise(r=>setTimeout(r,900)); return document.querySelector('[role=dialog]')?'ok':'no dialog';})()"],
  ['driver card', '#/trip/cn26/pocket', D11, "(async()=>{document.querySelector('.paperchip').click(); await new Promise(r=>setTimeout(r,900)); return document.querySelector('[role=dialog]')?'ok':'no dialog';})()"],
  ['the long jump', '#/trip/cn26/now/day', D11, "(async()=>{const b=[...document.querySelectorAll('button')].find(b=>/Day \\d+ of/.test(b.textContent)); if(!b) return 'no centre'; b.click(); await new Promise(r=>setTimeout(r,900)); return document.querySelector('.sheet')?'ok':'no sheet';})()"],
  ['a new trip', '#/trips', '', "(async()=>{[...document.querySelectorAll('button')].find(b=>/Start a new trip/.test(b.textContent)).click(); await new Promise(r=>setTimeout(r,1400)); return document.querySelector('.sheet')?'ok':'no sheet';})()"],
  ['import', '#/trips', '', "(async()=>{[...document.querySelectorAll('button')].find(b=>/Import a trip/.test(b.textContent)).click(); await new Promise(r=>setTimeout(r,1400)); return document.querySelector('.sheet')?'ok':'no sheet';})()"],
  ['a flight, edited', '#/trip/cn26/pocket/travel', D11, "(async()=>{const e=[...document.querySelectorAll('button')].find(b=>/^Edit$/i.test(b.getAttribute('aria-label')||'')); if(!e) return 'no edit switch'; e.click(); await new Promise(r=>setTimeout(r,700)); const a=[...document.querySelectorAll('button')].find(b=>/Add a flight/.test(b.textContent)); if(!a) return 'no add'; a.click(); await new Promise(r=>setTimeout(r,900)); return document.querySelector('.sheet')?'ok':'no sheet';})()"],
  ['map · filters', '#/trip/cn26/map', '?d=2026-12-08', "(async()=>{const b=document.querySelector('.m-toprow button[aria-label=\"Filters: what to show on the map\"]'); if(!b) return 'no filters button'; b.click(); await new Promise(r=>setTimeout(r,900)); return document.querySelector('.sheet')?'ok':'no sheet';})()"],
  ['map · the list', '#/trip/cn26/map', '?d=2026-12-08', "(async()=>{const b=document.querySelector('.m-listbtn'); if(!b) return 'no list button'; b.click(); await new Promise(r=>setTimeout(r,900)); return document.querySelector('.sheet')?'ok':'no sheet';})()"],
  ['map · search', '#/trip/cn26/map', '?d=2026-12-08', "(async()=>{const i=document.querySelector('.m-search input'); if(!i) return 'no search'; i.value='temple'; i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,700)); return document.querySelector('.m-results .m-res')?'ok':'no results';})()"],
  /* Map 5e, the owner's fold: "Near you" as its bar (the phone forgets the fold again at once, so the next
     screen opens as ever) */
  ['map · places folded', '#/trip/cn26/map', '?d=2026-12-08', "(async()=>{ for(let i=0;i<50&&!document.querySelector('.m-peekbtn');i++) await new Promise(r=>setTimeout(r,100)); const b=document.querySelector('.m-peekbtn'); if(!b) return 'no chevron'; b.click(); await new Promise(r=>setTimeout(r,700)); try{ localStorage.removeItem('ltd:map:peekHidden'); }catch(e){} return b.getAttribute('aria-expanded')==='false'?'ok':'not folded';})()"],
  /* Map 5e: a place's photo, full screen; Settings › Photo credits */
  ['map · a photo, full screen', '#/trip/cn26/map/cn26-spot-beijing-beihai', '?d=2026-12-08', "(async()=>{ for(let i=0;i<60&&!(document.querySelector('.ps-hero img')||{}).naturalWidth;i++) await new Promise(r=>setTimeout(r,100)); const h=document.querySelector('.ps-hero'); if(!h) return 'no photo'; h.click(); await new Promise(r=>setTimeout(r,800)); return document.querySelector('.pv')?'ok':'no viewer';})()"],
  ['settings · photo credits', '#/settings', '', "(async()=>{ for(let i=0;i<50&&!document.querySelector('.mp-credits');i++) await new Promise(r=>setTimeout(r,100)); const b=document.querySelector('.mp-credits'); if(!b) return 'no credits row'; b.click(); await new Promise(r=>setTimeout(r,900)); return document.querySelector('.sheet .cr-row')?'ok':'no credits';})()"],
  ['the guide, edited', '#/trip/cn26/journey/cn26-stop-zhangjiajie/guide', D11, "(async()=>{const b=[...document.querySelectorAll('button')].find(b=>/edit/i.test(b.getAttribute('aria-label')||'')); if(!b) return 'no edit switch'; b.click(); await new Promise(r=>setTimeout(r,900)); return 'ok';})()"],
];
const floor = { nameless: [], small: [], ring: [], skips: [], opened: [], controls: 0, visits: 0 };
for (const width of [412, 384]) {
  await S('Emulation.setDeviceMetricsOverride', { width, height: 915, deviceScaleFactor: 2, mobile: true });
  for (const [label, hash, q, open] of [...FLOOR_SCREENS.map(([l, h, qq]) => [l, h, qq, null]), ...FLOOR_OVERLAYS]) {
    await S('Page.navigate', { url: 'about:blank' });
    await S('Page.navigate', { url: `${BASE}${q}${hash}` });
    await wait(2000);
    if (open) {
      const o = await js(open, true, true);
      if (o !== 'ok') floor.opened.push(`${width} ${label}: ${o}`);
    }
    /* one real Tab first: the keyboard is what shows a focus ring */
    await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    for (const n of await axNameless()) floor.nameless.push(`${width} ${label} ${n}`);
    let r;
    try {
      r = JSON.parse(await js(A11Y_SWEEP));
    } catch {
      floor.opened.push(`${width} ${label}: the sweep did not run`);
      continue;
    }
    floor.visits++;
    floor.controls += r.n;
    for (const x of r.small) floor.small.push(`${width} ${label} ${x}`);
    for (const x of r.ring) floor.ring.push(`${width} ${label} ${x}`);
    for (const x of r.skips) floor.skips.push(`${width} ${label} ${x}`);
  }
}
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
const floorNote = (list, ok) => (floor.opened.length ? `not opened: ${floor.opened.join(' ; ')}` : list.length ? list.slice(0, 3).join(' ; ') : ok).slice(0, 90);
const floorOk = (list) => floor.opened.length === 0 && list.length === 0 && floor.visits === 2 * (FLOOR_SCREENS.length + FLOOR_OVERLAYS.length);
rows.push([floorOk(floor.nameless) ? 'PASS' : 'FAIL', 'A11y · every control named (412 + 384)', floorNote(floor.nameless, `${floor.visits} screens, ${floor.controls} controls, the a11y tree`)]);
rows.push([floorOk(floor.small) ? 'PASS' : 'FAIL', 'A11y · every target ≥ 44 px (412 + 384)', floorNote(floor.small, `${floor.visits} screens and overlays`)]);
rows.push([floorOk(floor.ring) ? 'PASS' : 'FAIL', 'A11y · focus rings drawn, not clipped', floorNote(floor.ring, 'every control, keyboard focus, both widths')]);
rows.push([floorOk(floor.skips) ? 'PASS' : 'FAIL', 'A11y · one h1, no heading level skipped', floorNote(floor.skips, `${floor.visits} screens and overlays`)]);

/* A KEYBOARD WALKS NOW'S TILES AT 384 PX (Run 4). Real Tab presses, not
   focus() from a script: Chrome counts a tile half past the rail's edge as
   visible and left the VISA tile mostly outside the rail on the S23, its
   ring a sliver (lib/components/ui/revealFocus.ts). Every tile that takes
   focus must stand wholly inside the rail, its ring clear of the edge. */
await S('Emulation.setDeviceMetricsOverride', { width: 384, height: 824, deviceScaleFactor: 2, mobile: true });
await S('Page.navigate', { url: 'about:blank' });
await S('Page.navigate', { url: `${BASE}${D11}#/trip/cn26/now` });
await wait(2600);
const tabbed = [];
let tabNote = '';
for (let i = 0; i < 30; i++) {
  await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await wait(120);
  const r = await js(`(()=>{
    const a=document.activeElement, rail=document.querySelector('.nowhome .rail');
    if(!rail||!a||!rail.contains(a)||a===rail) return '';
    const s=getComputedStyle(a), g=(parseFloat(s.outlineWidth)||0)+(parseFloat(s.outlineOffset)||0);
    const t=a.getBoundingClientRect(), b=rail.getBoundingClientRect();
    const name=(a.className.match(/t-[a-z]+/)||['?'])[0];
    return name+(t.left-g>=b.left&&t.right+g<=b.right?' in':' OUT '+Math.round(t.left)+'-'+Math.round(t.right)+' of '+Math.round(b.left)+'-'+Math.round(b.right));
  })()`);
  if (r) tabbed.push(r);
  if (/^t-todo/.test(String(r))) break;
}
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
const tabOut = tabbed.filter((x) => !/ in$/.test(x));
if (tabbed.length < 4) tabNote = `only ${tabbed.length} tiles reached by Tab: ${tabbed.join(', ')}`;
rows.push([tabOut.length === 0 && !tabNote ? 'PASS' : 'FAIL', 'A11y · Tab brings each tile into view (384)', (tabNote || (tabOut.length ? tabOut.join('; ') : `${tabbed.length} tiles, each wholly in the rail`)).slice(0, 70)]);

/* ============================================================
   HORIZON RUN 4 — THE MOTION RULES, ON EVERY SCREEN THAT LOOPS.

   Calm motion (the app) and reduce-motion (the phone) hold EVERYTHING
   still: no animation running anywhere, no smooth scroll. Route animations
   off stops the route motions (Flow, Comet, Ink, Relay) and leaves the
   ambient ones (the ping, the sun, the opal edge) — the design's own rule.
   Asked of the page itself: document.getAnimations(), what is running.
   ============================================================ */
const LOOP_SCREENS = [['now', '#/trip/cn26/now'], ['day', '#/trip/cn26/now/day'], ['journey', '#/trip/cn26/journey'], ['city', '#/trip/cn26/journey/cn26-stop-zhangjiajie'], ['pocket', '#/trip/cn26/pocket'], ['pass', '#/trip/cn26/pocket/cn26-flight-mu394'], ['trips', '#/trips'], ['settings', '#/settings'], ['map', '#/trip/cn26/map'], ['guide me', '#/trip/cn26/map/cn26-place-07/go']];
const RUNNING = `JSON.stringify({run:document.getAnimations().filter(a=>a.playState==='running').map(a=>(a.animationName||'?')+'@'+String((a.effect&&a.effect.target&&(a.effect.target.className.baseVal!==undefined?a.effect.target.className.baseVal:a.effect.target.className))||'').split(' ').filter(c=>c&&!c.startsWith('_'))[0]), smooth:[document.documentElement,document.body].some(e=>getComputedStyle(e).scrollBehavior==='smooth')})`;
async function stillness(query) {
  const out = [];
  for (const [label, hash] of LOOP_SCREENS) {
    await S('Page.navigate', { url: 'about:blank' });
    await S('Page.navigate', { url: `${BASE}${hash.startsWith('#/trip/') ? D11 : ''}${hash}` });
    await wait(2600);
    const r = JSON.parse(await js(RUNNING));
    out.push({ label, run: r.run, smooth: r.smooth, q: query });
  }
  return out;
}
const ROUTE = /^(h-flow|h-ink|h-bloom|h-comet-head|h-comet-tail|h-flash|h-relay)$|ck-/;
const flipRoutesSettled = async () => {
  await S('Page.navigate', { url: `${BASE}#/settings` });
  await wait(2000);
  return js(`(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    let row=null;
    for(let i=0;i<30&&!row;i++){ row=[...document.querySelectorAll('label.row')].find(l=>/Route animations/.test(l.textContent)); if(!row) await sleep(100); }
    if(!row) return 'no row';
    const was=document.documentElement.classList.contains('no-routes');
    row.querySelector('input').click();
    for(let i=0;i<30&&document.documentElement.classList.contains('no-routes')===was;i++) await sleep(100);
    return 'ok';
  })()`, true);
};
await flipCalm();
const calmRun = await stillness('calm');
await flipCalm();
await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
const reduceRun = await stillness('reduce');
await S('Emulation.setEmulatedMedia', { features: [] });
await flipRoutesSettled();
const routesRun = await stillness('routes');
await flipRoutesSettled();
const settled = await js(`document.documentElement.classList.contains('calm')||document.documentElement.classList.contains('no-routes') ? 'FAIL' : 'ok'`);
const moving = (runs) => runs.filter((x) => x.run.length || x.smooth).map((x) => `${x.label}: ${x.run.slice(0, 2).join(',')}${x.smooth ? ' smooth-scroll' : ''}`);
rows.push([moving(calmRun).length === 0 && settled === 'ok' ? 'PASS' : 'FAIL', 'Motion · Calm motion: nothing moves', moving(calmRun).length ? moving(calmRun).join(' ; ').slice(0, 70) : settled === 'ok' ? `${LOOP_SCREENS.length} screens, 0 animations running` : 'Calm motion stayed on']);
rows.push([moving(reduceRun).length === 0 ? 'PASS' : 'FAIL', 'Motion · reduce-motion: nothing moves', moving(reduceRun).length ? moving(reduceRun).join(' ; ').slice(0, 70) : `${LOOP_SCREENS.length} screens, 0 animations running`]);
const routeLeft = routesRun.filter((x) => x.run.some((n) => ROUTE.test(n.split('@')[0]))).map((x) => `${x.label}: ${x.run.filter((n) => ROUTE.test(n.split('@')[0])).slice(0, 2).join(',')}`);
const ambient = routesRun.reduce((n, x) => n + x.run.length, 0);
rows.push([routeLeft.length === 0 && ambient > 0 ? 'PASS' : 'FAIL', 'Motion · Route animations off: routes still', routeLeft.length ? routeLeft.join(' ; ').slice(0, 70) : ambient > 0 ? `no route motion; ${ambient} ambient loops still breathe` : 'nothing at all runs — the ambient loops stopped too']);

/* A LOOP OFF THE SCREEN STANDS STILL (Run 4, lib/motion/offscreen.ts): the
   Journey's map scrolled away stops its Flow, and starts again, where it
   was, when it comes back; the Pocket's TODAY card below the fold stops
   its opal edge. Nothing restarts — animation-play-state only. */
/* Dec 12 since 2026-10-17: on Dec 11 you are in Shanghai, which has no star, so nothing Flows */
await S('Page.navigate', { url: `${BASE}?d=2026-12-12#/trip/cn26/journey` });
await wait(3000);
const offscreenJourney = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const f=document.querySelector('#route .fl-line');
  if(!f) return 'FAIL no Flow on the Journey map on Dec 12';
  const state=()=>f.getAnimations().map(a=>a.playState).join(',');
  if(state()!=='running') return 'FAIL the Flow is not running in view: '+state();
  window.scrollTo(0,document.documentElement.scrollHeight); await sleep(700);
  if(!f.hasAttribute('data-offscreen')) return 'FAIL the map scrolled away is not marked off screen';
  if(state()!=='paused') return 'FAIL the Flow still runs off screen: '+state();
  const t=f.getAnimations()[0].currentTime;
  await sleep(500);
  if(f.getAnimations()[0].currentTime!==t) return 'FAIL the paused Flow still advances';
  window.scrollTo(0,0); await sleep(700);
  if(f.hasAttribute('data-offscreen')||state()!=='running') return 'FAIL the Flow did not start again in view: '+state();
  return 'ok paused off screen at '+Math.round(t)+' ms, running again in view';
})()`, true);
rows.push([String(offscreenJourney).startsWith('ok') ? 'PASS' : 'FAIL', 'Motion · a loop off the screen stands still', String(offscreenJourney).slice(3, 60)]);
await S('Page.navigate', { url: `${BASE}${D11}#/trip/cn26/pocket` });
await wait(2600);
const offscreenPocket = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const card=document.querySelector('.today.opal-edge');
  if(!card) return 'FAIL no TODAY card on Dec 11';
  if(!card.getAnimations().some(a=>a.playState==='running')) return 'FAIL the opal edge does not run in view';
  /* room enough below to scroll the card wholly out of view, whatever the
     screen's height — the test's own spacer, taken away after */
  const pad=document.createElement('div'); pad.style.height='2000px'; document.body.appendChild(pad);
  window.scrollTo(0,card.getBoundingClientRect().bottom+window.scrollY+40); await sleep(700);
  const st=card.getAnimations().map(a=>a.playState);
  const off=card.hasAttribute('data-offscreen');
  window.scrollTo(0,0); await sleep(700);
  const back=card.getAnimations().some(a=>a.playState==='running');
  pad.remove();
  if(!off||st.includes('running')) return 'FAIL the opal edge runs out of view: '+st.join(',');
  if(!back) return 'FAIL the opal edge did not come back';
  return 'ok the opal edge stops out of view, and comes back';
})()`, true);
rows.push([String(offscreenPocket).startsWith('ok') ? 'PASS' : 'FAIL', 'Motion · the opal edge stops out of view', String(offscreenPocket).slice(3, 60)]);

/* THE APP HIDDEN, EVERYTHING PAUSED. The page is told it is hidden the way
   the phone tells it (document.hidden + visibilitychange): <html> gets
   app-hidden and every running animation pauses; shown again, they run. */
await S('Page.navigate', { url: `${BASE}${D11}#/trip/cn26/now` });
await wait(2600);
const hiddenPause = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const running=()=>document.getAnimations().filter(a=>a.playState==='running').length;
  const before=running();
  if(!before) return 'FAIL nothing runs on Now to pause';
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
  document.dispatchEvent(new Event('visibilitychange')); await sleep(300);
  const hid=document.documentElement.classList.contains('app-hidden'), during=running();
  delete document.hidden; delete document.visibilityState;
  document.dispatchEvent(new Event('visibilitychange')); await sleep(300);
  if(!hid) return 'FAIL <html> did not get app-hidden';
  if(during) return 'FAIL '+during+' animation(s) ran while the app was hidden';
  if(document.documentElement.classList.contains('app-hidden')||!running()) return 'FAIL nothing ran again once shown';
  return 'ok '+before+' running, 0 while hidden, back after';
})()`, true);
rows.push([String(hiddenPause).startsWith('ok') ? 'PASS' : 'FAIL', 'Motion · the app hidden, everything paused', String(hiddenPause).slice(3, 60)]);

/* ONE FIRST RENDER (Run 4, TripShell). The trip's tables answer one IndexedDB
   task at a time; Now used to be drawn with the first of them and drawn
   again as each of the others landed. It is drawn once, whole: the tiles it
   shows the moment it appears are the tiles it shows once everything has
   settled. Watched from the page's first line, on a cold load. */
await S('Page.addScriptToEvaluateOnNewDocument', {
  source:
    "window.__nowFirst=null;new MutationObserver(function(m,o){var r=document.querySelector('.nowhome .rail');" +
    "if(r&&window.__nowFirst===null){window.__nowFirst=[...r.children].map(function(t){return t.className.split(' ').filter(function(c){return c.indexOf('t-')===0;})[0];}).join(',');" +
    "window.__nowSentence=(document.querySelector('.nowhome .sentence')||{}).textContent||'';o.disconnect();}}).observe(document,{childList:true,subtree:true});",
});
await S('Page.navigate', { url: 'about:blank' });
await S('Page.navigate', { url: `${BASE}${D11}#/trip/cn26/now` });
await wait(3500);
const firstRender = await js(`(()=>{
  const now=[...document.querySelectorAll('.nowhome .rail > *')].map(t=>t.className.split(' ').filter(c=>c.indexOf('t-')===0)[0]).join(',');
  if(window.__nowFirst===null) return 'FAIL Now never appeared';
  if(window.__nowFirst!==now) return 'FAIL first drawn with '+window.__nowFirst+', then '+now;
  const said=(document.querySelector('.nowhome .sentence')||{}).textContent||'';
  if(window.__nowSentence!==said) return 'FAIL the sentence changed after the first render';
  return 'ok drawn once, whole: '+now.split(',').length+' tiles';
})()`);
rows.push([String(firstRender).startsWith('ok') ? 'PASS' : 'FAIL', 'Perf · Now is drawn once, whole', String(firstRender).slice(3, 60)]);

/* AN EDITED STOP KEEPS ITS GUIDE (Run 4). The stop editor rebuilt the record
   from the fields it shows, so saving it — even unchanged — deleted the
   stop's options and every place on its map (found by the Map track). Walked
   the way a thumb walks it, on a real China stop: the guide → edit mode →
   Edit → change the budget note → Save. The guide must still show every
   option and every place it showed before, the vault must still hold them,
   and the note must have changed. Then the note is put back the same way —
   a second save through the same editor, with the same proof. */
const editStopWalk = (steps) =>
  js(`(async()=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const ID='cn26-stop-zhangjiajie'; ${STOPS_IDB} ${steps} })()`, true, true);
const GUIDE_READ = "const read=async()=>{ const rec=await idb('readonly', st=>st.get(ID));" +
  " return { opts:[...document.querySelectorAll('ul.gd-opts > li')].map(li=>li.textContent.trim().slice(0,40)), places:document.querySelectorAll('ul.spots > li').length," +
  " dbOpts:(rec&&rec.options||[]).length, dbSpots:(rec&&rec.spots||[]).length, note:rec&&rec.costNote }; };";
const EDIT_NOTE = (to) => `
  const toggle=document.querySelector('.gd-acts button[aria-pressed]');
  if(!toggle) return 'FAIL no edit switch on the guide';
  if(toggle.getAttribute('aria-pressed')!=='true'){ toggle.click(); await sleep(300); }
  const edit=[...document.querySelectorAll('.gd-edit button')].find(b=>/^Edit /.test(b.textContent.trim()));
  if(!edit) return 'FAIL no Edit button for the stop in edit mode';
  edit.click(); await sleep(900);
  const f=document.querySelector('.sheet #f-costNote');
  if(!f) return 'FAIL the stop editor has no budget note field';
  f.value=${to}; f.dispatchEvent(new Event('input',{bubbles:true})); f.dispatchEvent(new Event('change',{bubbles:true}));
  await sleep(200);
  const save=document.querySelector('.sheet button[type=submit]');
  if(!save) return 'FAIL the stop editor has no Save';
  save.click();
  for(let i=0;i<30&&document.querySelector('.sheet');i++) await sleep(150);
  if(document.querySelector('.sheet')) return 'FAIL the editor did not close after Save';
  await sleep(900);
  return 'ok';`;
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/journey/cn26-stop-zhangjiajie/guide` });
await wait(2600);
const guideBefore = await editStopWalk(`${GUIDE_READ} return JSON.stringify(await read());`);
let stopEdited = 'FAIL the guide could not be read before the edit';
let noteWas = null;
try {
  const before = JSON.parse(guideBefore);
  noteWas = before.note ?? '';
  if (!before.opts.length || !before.places || !before.dbOpts || !before.dbSpots) {
    stopEdited = `FAIL Zhangjiajie shows nothing to lose: ${guideBefore.slice(0, 60)}`;
  } else {
    const same = (x) => JSON.stringify(x.opts) === JSON.stringify(before.opts) && x.places === before.places && x.dbOpts === before.dbOpts && x.dbSpots === before.dbSpots;
    const r1 = await editStopWalk(`${GUIDE_READ} const e=await (async()=>{ ${EDIT_NOTE("(f.value||'')+' · checked in the rehearsal'")} })(); if(e!=='ok') return e; return JSON.stringify(await read());`);
    if (!String(r1).startsWith('{')) stopEdited = r1;
    else {
      const after = JSON.parse(r1);
      if (!/checked in the rehearsal/.test(after.note ?? '')) stopEdited = `FAIL the edit did not land: ${after.note}`;
      else if (!same(after)) stopEdited = `FAIL the edit lost the guide: ${before.opts.length}→${after.opts.length} options, ${before.places}→${after.places} places, vault ${before.dbOpts}/${before.dbSpots}→${after.dbOpts}/${after.dbSpots}`;
      else {
        /* and back, through the same editor */
        const r2 = await editStopWalk(`${GUIDE_READ} const e=await (async()=>{ ${EDIT_NOTE(JSON.stringify(noteWas))} })(); if(e!=='ok') return e; return JSON.stringify(await read());`);
        const back = String(r2).startsWith('{') ? JSON.parse(r2) : null;
        if (!back) stopEdited = r2;
        else if ((back.note ?? '') !== noteWas) stopEdited = `FAIL the note did not go back: ${back.note}`;
        else if (!same(back)) stopEdited = 'FAIL the second save lost the guide';
        else stopEdited = `ok edited twice: ${before.opts.length} options and ${before.places} places kept`;
      }
    }
  }
} catch (e) {
  stopEdited = `FAIL ${String(e).slice(0, 60)}`;
}
/* edit mode is in memory: leave the app as a fresh open finds it */
await S('Page.reload', {});
await wait(2400);
rows.push([String(stopEdited).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · an edited stop keeps its options', String(stopEdited).slice(3, 70)]);

/* SAVING THE STOP KEEPS THE GUIDE WHERE IT WAS (Run 4b). The guide's scroll
   effect read the whole stop, so the new object a save hands down ran it
   again and the guide jumped back to its top. Edit mode, scrolled well down,
   Edit → the budget note → Save: the page is where it was. Then the note is
   put back the same way, and it holds there too. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-11#/trip/cn26/journey/cn26-stop-zhangjiajie/guide` });
await wait(2600);
const scrollKept = await editStopWalk(`
  const toggle=document.querySelector('.gd-acts button[aria-pressed]');
  if(!toggle) return 'FAIL no edit switch on the guide';
  if(toggle.getAttribute('aria-pressed')!=='true'){ toggle.click(); await sleep(400); }
  const was=((await idb('readonly', st=>st.get(ID)))||{}).costNote||'';
  window.scrollTo(0, 1800); await sleep(400);
  const y=Math.round(window.scrollY);
  if(y<1000) return 'FAIL the guide would not scroll down ('+y+' px)';
  const e1=await (async()=>{ ${EDIT_NOTE("(f.value||'')+' · kept in place'")} })(); if(e1!=='ok') return e1;
  const y1=Math.round(window.scrollY);
  const e2=await (async()=>{ ${EDIT_NOTE('was')} })(); if(e2!=='ok') return e2;
  const y2=Math.round(window.scrollY);
  const back=((await idb('readonly', st=>st.get(ID)))||{}).costNote||'';
  if(back!==was) return 'FAIL the note did not go back: '+back;
  if(Math.abs(y1-y)>60||Math.abs(y2-y)>60) return 'FAIL the guide moved on save: '+y+' → '+y1+' → '+y2+' px';
  return 'ok at '+y+' px before, '+y1+' and '+y2+' after two saves';`);
await S('Page.reload', {});
await wait(2400);
rows.push([String(scrollKept).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · saving the stop keeps its place', String(scrollKept).replace(/^ok /, '').slice(0, 64)]);

/* CREATE, EDIT AND DELETE A TRIP (Run 4b) — on a throwaway trip, through the
   shelf's own buttons, with the database read directly after each. Runs last,
   because these are the only checks that write.

   Create lands on the new trip. (The wizard closed with a step back that
   landed after the app had gone to the trip — on the shelf; the delete walk
   below only ever found the new card because of that.) Then one back press
   is the shelf. */
const TRIP_DB =
  "const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));" +
  "const set=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };" +
  "const all=async(store)=>{ const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});" +
  " const out=await new Promise(r=>{const q=db.transaction(store).objectStore(store).getAll();q.onsuccess=()=>r(q.result)}); db.close(); return out; };" +
  "const rows=async(store,tripId)=>(await all(store)).filter(x=>!tripId||x.tripId===tripId).length;" +
  "const throwaway=async()=>(await all('trips')).find(t=>/^Throwaway/.test(t.title));";
await S('Page.navigate', { url: `${BASE}#/trips` });
await wait(2200);
const created = await js(`(async()=>{ ${TRIP_DB}
  const door=[...document.querySelectorAll('button')].find(b=>/Start a new trip/i.test(b.textContent));
  if(!door) return 'FAIL the shelf has no Start a new trip door';
  door.click();
  await sleep(800);
  const ins=[...document.querySelectorAll('.sheet input, form input')];
  const text=ins.filter(i=>i.type!=='date');
  const dates=ins.filter(i=>i.type==='date');
  if(!text.length||dates.length<2) return 'FAIL wizard inputs '+text.length+'/'+dates.length;
  set(text[0],'Throwaway'); set(dates[0],'2027-03-01'); set(dates[1],'2027-03-05');
  await sleep(300);
  [...document.querySelectorAll('button')].find(b=>/Create trip/.test(b.textContent)).click();
  for(let i=0;i<30&&!/^#\\/trip\\/[^/]+\\/now$/.test(location.hash);i++) await sleep(100);
  await sleep(700);
  if(await rows('trips')!==2) return 'FAIL trip not created';
  const mine=await throwaway(); if(!mine) return 'FAIL no throwaway';
  if(location.hash!=='#/trip/'+mine.id+'/now') return 'FAIL Create landed on '+location.hash;
  if(document.querySelector('.sheet')) return 'FAIL the wizard is still open on the new trip';
  history.back(); await sleep(1200);
  if(location.hash!=='#/trips') return 'FAIL one back press from the new trip went to '+location.hash;
  if(!document.querySelector('.tripcard')) return 'FAIL the shelf is not drawn after back';
  return 'ok on the new trip’s Now; one back press → the shelf';
})()`, true, true);
rows.push([String(created).startsWith('ok') ? 'PASS' : 'FAIL', 'Create trip · lands on the new trip', String(created).replace(/^ok /, '').slice(0, 60)]);

/* EDIT TRIP: the wizard stays open, and the edit saves. (The menu's step
   back landed after the wizard had opened, and took the wizard with it:
   editing a trip did not work.) */
const edited = await js(`(async()=>{ ${TRIP_DB}
  const mine=await throwaway(); if(!mine) return 'FAIL no throwaway to edit';
  const card=[...document.querySelectorAll('.tripcard')].find(c=>/Throwaway/.test(c.textContent));
  if(!card) return 'FAIL no card for the throwaway';
  card.querySelector('.tc-menu').click(); await sleep(800);
  const edit=[...document.querySelectorAll('.sheet button')].find(b=>/Edit trip/.test(b.textContent));
  if(!edit) return 'FAIL no Edit trip in the menu';
  edit.click(); await sleep(1500);
  const sheet=document.querySelector('.sheet');
  if(!sheet) return 'FAIL the wizard closed as it opened';
  if(sheet.getAttribute('aria-label')!=='Edit trip') return 'FAIL the sheet open is '+sheet.getAttribute('aria-label');
  const name=sheet.querySelector('input');
  if(!name||name.value!=='Throwaway') return 'FAIL the wizard does not hold the trip: '+(name&&name.value);
  set(name,'Throwaway, edited'); await sleep(300);
  sheet.querySelector('button[type=submit]').click();
  for(let i=0;i<30&&document.querySelector('.sheet');i++) await sleep(100);
  if(document.querySelector('.sheet')) return 'FAIL the wizard did not close after Save';
  await sleep(600);
  const after=await throwaway();
  if(!after||after.id!==mine.id||after.title!=='Throwaway, edited') return 'FAIL the edit was not saved: '+(after&&after.title);
  if(history.state&&history.state.layer) return 'FAIL a sheet’s entry is left behind (layer '+history.state.layer+')';
  if(location.hash!=='#/trips') return 'FAIL the edit left the shelf for '+location.hash;
  if(![...document.querySelectorAll('.tripcard')].some(c=>/Throwaway, edited/.test(c.textContent))) return 'FAIL the shelf does not show the new name';
  return 'ok the wizard stayed open; saved “Throwaway, edited”';
})()`, true, true);
rows.push([String(edited).startsWith('ok') ? 'PASS' : 'FAIL', 'Edit trip · the wizard stays open and saves', String(edited).replace(/^ok /, '').slice(0, 60)]);

/* Deleting a trip really removes it — and only it: deleted through the
   shelf's own two-tap button, then the database is read directly — the trip
   and every row that belonged to it gone, China 2026 and its rows untouched.
   The shelf is where Create's back press left the walk. */
const del = await js(`(async()=>{ ${TRIP_DB}
  if(location.hash!=='#/trips') return 'FAIL not on the shelf but '+location.hash;
  if(await rows('trips')!==2) return 'FAIL trips before the delete '+(await rows('trips'));
  const mine=await throwaway(); if(!mine) return 'FAIL no throwaway';

  const card=[...document.querySelectorAll('.tripcard')].find(c=>/Throwaway/.test(c.textContent));
  if(!card) return 'FAIL no card';
  card.querySelector('.tc-menu').click();
  await sleep(800);
  const btn=[...document.querySelectorAll('button')].find(b=>/Delete trip/.test(b.textContent));
  if(!btn) return 'FAIL no delete button';
  btn.click(); await sleep(400);
  const armed=[...document.querySelectorAll('button')].find(b=>/Tap again/.test(b.textContent));
  if(!armed) return 'FAIL did not arm — one tap would have deleted it';
  armed.click(); await sleep(2500);

  const left=await rows('trips');
  const chinaStops=await rows('stops','cn26');
  const orphans=await rows('stops',mine.id)+await rows('expenses',mine.id);
  if(left!==1) return 'FAIL trips left '+left;
  if(chinaStops!==11) return 'FAIL china stops '+chinaStops;
  if(orphans!==0) return 'FAIL orphan rows '+orphans;
  return 'ok';
})()`, true);
rows.push([del === 'ok' ? 'PASS' : 'FAIL', 'Delete a trip · gone, China intact', String(del).slice(0, 55)]);

/* ============================================================
   REMINDERS (the Reminders run) — walked with the network still off.
   In a browser the phone's scheduler cannot run: Settings says so in one
   line and draws no switch that would do nothing. A flight's pass carries
   "Check live status" (FlightAware under the ICAO code) and the "Remind
   me" bell, whose sheet opens with its ready choices and closes on back.
   The To do list offers the moments AND the flights to the calendar.
   ============================================================ */
await S('Page.navigate', { url: `${BASE}#/settings` });
await wait(2200);
const remWeb = await js(`(async()=>{
  const g=document.querySelector('[data-testid=reminders]');
  if(!g) return 'FAIL Settings has no Reminders group';
  if(!/phone app/i.test(g.textContent)) return 'FAIL the browser is not told reminders ring from the phone app';
  if(g.querySelector('input[role=switch]')) return 'FAIL a reminders switch is drawn where it can do nothing';
  return 'ok one honest line, no dead switch';
})()`, true);
rows.push([String(remWeb).startsWith('ok') ? 'PASS' : 'FAIL', 'Reminders · the web says phone only', String(remWeb).slice(3, 56)]);

await S('Page.navigate', { url: `${BASE}?d=2026-11-20#/trip/cn26/pocket/cn26-flight-ca8683` });
await wait(2600);
const remPass = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const fa=[...document.querySelectorAll('a.btn')].find(a=>/FlightAware/.test(a.textContent));
  if(!fa) return 'FAIL the flight pass has no FlightAware button';
  if(fa.getAttribute('href')!=='https://flightaware.com/live/flight/CCA8641') return 'FAIL FlightAware link is '+fa.getAttribute('href');
  const fr=[...document.querySelectorAll('a.btn')].find(a=>/Flightradar24/.test(a.textContent));
  if(!fr||fr.getAttribute('href')!=='https://www.flightradar24.com/data/flights/ca8641') return 'FAIL no Flightradar24 link';
  const bell=[...document.querySelectorAll('button.remind')].find(b=>/Remind me/.test(b.textContent));
  if(!bell) return 'FAIL the pass has no Remind me bell';
  bell.click(); await sleep(1500);
  const sheet=document.querySelector('.sheet[role=dialog]');
  if(!sheet||!/Remind me/.test(sheet.getAttribute('aria-label')||'')) return 'FAIL the Remind me sheet did not open';
  if(!/evening before/i.test(sheet.textContent)) return 'FAIL the sheet offers no ready choice';
  history.back(); await sleep(900);
  if(document.querySelector('.sheet[role=dialog]')) return 'FAIL back did not close the sheet';
  return 'ok live links, bell, sheet opens and closes on back';
})()`, true);
rows.push([String(remPass).startsWith('ok') ? 'PASS' : 'FAIL', 'Reminders · live status and Remind me', String(remPass).slice(3, 56)]);

await S('Page.navigate', { url: `${BASE}?d=2026-11-20#/trip/cn26/now/todo` });
await wait(2400);
const remIcs = await js(`(async()=>{
  const b=[...document.querySelectorAll('button')].find(x=>/to the calendar [(].ics[)]/.test(x.textContent));
  if(!b) return 'FAIL the calendar export does not offer the flights';
  const n=parseInt(b.textContent.replace(/[^0-9]/g,' ').trim().split(' ')[0],10);
  if(!(n>=9)) return 'FAIL the export counts '+n+' (the 9 flights alone are 9)';
  return 'ok '+n+' moments and flights';
})()`, true);
rows.push([String(remIcs).startsWith('ok') ? 'PASS' : 'FAIL', 'Reminders · calendar gets the flights', String(remIcs).slice(3, 56)]);

console.log('AIRPLANE-MODE DRESS REHEARSAL');
console.log('─'.repeat(64));
for (const [status, label, note] of rows) {
  console.log(`${status}  ${label.padEnd(36)} ${note}`);
}
const failed = rows.filter((r) => r[0] === 'FAIL').length;
console.log('─'.repeat(64));
console.log(`${rows.length - failed}/${rows.length} passed with the network hard off.`);
if (errs.length) console.log('\nERRORS:\n' + errs.join('\n'));

cleanup();
process.exit(failed ? 1 : 0);
