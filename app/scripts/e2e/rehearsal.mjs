/* The dress rehearsal, scripted: install, import China, then go hard-offline and
   walk every screen and every date that matters. */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:4173/';
const SEED = 'C:\\Source\\China\\seed\\china-2026.trip.json';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = fileURLToPath(new URL('../../', import.meta.url));
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
    [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', '4173', '--strictPort'],
    { cwd: APP, stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80 && !up; i++) { await nap(250); up = await alive(); }
  if (!up) {
    console.error(`Could not serve the build on ${BASE} — is port 4173 taken by something else?`);
    preview.kill();
    process.exit(2);
  }
  console.log('Preview server started for this run.');
}

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
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
};
const send = (me, pa = {}, s) => new Promise((res, rej) => { p.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method: me, params: pa, sessionId: s })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, pa) => send(m, pa, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
const js = async (x, aw = false) => {
  const r = await S('Runtime.evaluate', { expression: x, awaitPromise: aw, returnByValue: true });
  return r.exceptionDetails ? 'ERR' : r.result?.value;
};
const wait = nap;

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

await S('Page.navigate', { url: BASE });
await wait(2500);
await js(`window.__seed=${JSON.stringify(readFileSync(SEED, 'utf8'))};'ok'`);
await js(`(async()=>{
  [...document.querySelectorAll('button')].find(b=>/Import a trip/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,700));
  const dt=new DataTransfer(); dt.items.add(new File([window.__seed],'s.json',{type:'application/json'}));
  const i=document.querySelector('.filebtn input[type=file]'); i.files=dt.files;
  i.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,2000));
  [...document.querySelectorAll('button')].find(b=>/^(Import|Replace & import)$/.test(b.textContent.trim())).click();
  await new Promise(r=>setTimeout(r,3500));
  return 'ok';
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

/* the six hard days from ABOUT.md, plus each tab */
await check('Nov 21 · departure runbook', `${BASE}?d=2026-11-21#/trip/cn26/today`, ['Departure runbook', 'NordWhisper', 'Day 1 of 37']);
await check('Nov 22 · arrival, no Sunday pickup', `${BASE}?d=2026-11-22#/trip/cn26/today`, ['Arrival runbook', 'No Sunday academy pickup', 'entry day']);
await check('Nov 25 · Kunyu default day', `${BASE}?d=2026-11-25#/trip/cn26/today`, ['Kunyu Academy', 'usual day']);
await check('Dec 11 · the monopoly flight', `${BASE}?d=2026-12-11#/trip/cn26/today`, ['monopoly flight', 'PEK (Capital Airport)', '20 kg']);
/* The late arrival stopped being a thing to chase on 2026-07-27: Yue Tu Inn
   APPROVED a 22:00–23:00 window when the bed was booked, so the day must say so
   rather than telling you to message them. */
await check('Dec 16 · the late arrival', `${BASE}?d=2026-12-16#/trip/cn26/today`,
  ['late arrival', 'Yue Tu Inn', '2,400m', 'approved']);
/* Dec 19 is the OTHER evening arrival, and the one where the standing
   "declare a late arrival" rule is NOT satisfied: the Yanyuan desk shuts at
   23:00 and nothing has been declared. The day has to say so, with the number
   to call — the opposite of Dec 16, where the day says the arrival is approved.
   IT HAD TO BECOME A RUNBOOK DAY TO SAY IT. Home replaces the timeline with the
   runbook on a runbook day, and Dec 19 was on the generic "Travel-day basics",
   so the warning sat in plan items the screen never drew. Dec 16 solved the
   same problem the same way, which is why `cn26-run-dec16` exists at all. */
await check('Dec 19 · Dali, arrival not declared', `${BASE}?d=2026-12-19#/trip/cn26/today`,
  ['Dali Yanyuan', '23:00', '+86 189 8708 1208', 'NO late arrival was declared']);
await check('Dec 21 · VISA EXIT DAY', `${BASE}?d=2026-12-21#/trip/cn26/today`, ['VISA EXIT DAY', 'MU733', 'day 29']);
/* 11:00, not the 12:00 this trip assumed until the Royal Garden was booked
   direct on 2026-07-27 — an hour that decides whether the last morning is a
   slow one or a late-check-out charge. */
await check('Dec 26 · flying home', `${BASE}?d=2026-12-26#/trip/cn26/today`, ['flying home', 'HKG Terminal 1', '11:00']);
await check('Dec 28 · trip complete', `${BASE}?d=2026-12-28#/trip/cn26/today`, ['Trip complete', '37 days']);
await check('Plans · stops + the route doorway', `${BASE}?d=2026-12-15#/trip/cn26/itinerary`,
  ['The route map lives in Info', 'Kunyu Academy', 'Tiger Leaping Gorge']);
await check('Wallet · counter cards', `${BASE}?d=2026-12-15#/trip/cn26/wallet`, ['8CR7MR', 'Etihad', 'BOOKED']);
await check('Tasks · deadlines + alarms', `${BASE}?d=2026-12-15#/trip/cn26/tasks`, ['ACTION LIST', 'phone alarms', 'Forbidden City']);
await check('Info · visa clock + driver cards', `${BASE}?d=2026-12-15#/trip/cn26/info`, ['MAINLAND VISA', '北京大兴国际机场', 'Emergency']);
/* Info is the hub now: route, vault and statistics under one roof, and the
   three old routes still land there instead of 404-ing. */
await check('Info hub · journey + vault + stats', `${BASE}?d=2026-12-15#/trip/cn26/info`,
  ['JOURNEY OVERVIEW', '10 stops', 'DOCUMENT VAULT', 'TRIP STATISTICS', 'Distance, stop to stop']);
await check('Old #/stats deep link redirects to Info', `${BASE}?d=2026-12-15#/trip/cn26/stats`,
  ['JOURNEY OVERVIEW', 'TRIP STATISTICS']);
await check('Old #/docs deep link redirects to Info', `${BASE}?d=2026-12-15#/trip/cn26/docs`,
  ['DOCUMENT VAULT', 'Flight manifest']);
await check('Old #/map deep link redirects to Info', `${BASE}?d=2026-12-15#/trip/cn26/map`,
  ['JOURNEY OVERVIEW']);
await check('Shelf', `${BASE}?d=2026-12-15#/trips`, ['China 2026', 'ACTIVE']);
await check('Backup screen', `${BASE}#/backup`, ['Save a copy', 'Storage', 'Restore']);

/* The floating tab pill: five tabs, renamed with the Lantern redesign, each
   one an SVG glyph rather than an emoji, and each one arriving where it says.
   The labels live in strings.ts — this walk is what keeps them honest. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/today` });
await wait(2200);
const tabwalk = await js(`(async()=>{
  const labels=[...document.querySelectorAll('.tabbar button .lb')].map(e=>e.textContent.trim());
  const want=['Home','Plans','Wallet','Lists','Info'];
  if(labels.join('|')!==want.join('|')) return 'FAIL labels '+labels.join('|');
  const glyphs=[...document.querySelectorAll('.tabbar button svg path')].length;
  if(glyphs<5) return 'FAIL only '+glyphs+' icon paths';
  const seen=[];
  for(let i=0;i<5;i++){
    const b=[...document.querySelectorAll('.tabbar button')][i];
    if(!b) return 'FAIL no button '+i;
    b.click(); await new Promise(r=>setTimeout(r,900));
    seen.push(location.hash.split('/').pop());
  }
  const expect=['today','itinerary','wallet','tasks','info'];
  return seen.join('|')===expect.join('|') ? 'ok '+labels.join(' · ') : 'FAIL routes '+seen.join('|');
})()`, true);
rows.push([String(tabwalk).startsWith('ok') ? 'PASS' : 'FAIL', 'Tab pill · five renamed tabs', String(tabwalk).slice(3, 56)]);

/* the packing ring is real arithmetic, not a decorative arc */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/tasks` });
await wait(2200);
const ring = await js(`(async()=>{
  [...document.querySelectorAll('.seg button')].find(b=>/Packing/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,1600));
  const pct=document.querySelector('.ring .pct')?.textContent||'';
  const count=document.querySelector('.ring .pcount')?.textContent||'';
  const m=/^([0-9]+)[/]([0-9]+)$/.exec(count);
  if(!m) return 'FAIL count '+count;
  const want=Math.round(Number(m[1])/Number(m[2])*100)+'%';
  if(pct!==want) return 'FAIL '+pct+' vs '+want;
  const fab=document.querySelector('.fab');
  return fab ? 'ok '+pct+' of '+count : 'FAIL no add button';
})()`, true);
rows.push([String(ring).startsWith('ok') ? 'PASS' : 'FAIL', 'Packing ring · counts what is packed', String(ring).slice(3, 56)]);

/* The to-do segment wears the same ring, and it must count TASKS — the seed
   ships 21 of them. Counting the rows on screen as well as reading the ring is
   what stops the to-do ring quietly reporting the rucksack's 30. */
const todoring = await js(`(async()=>{
  [...document.querySelectorAll('.seg button')].find(b=>/To do/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,1600));
  const pct=document.querySelector('.ring .pct')?.textContent||'';
  const count=document.querySelector('.ring .pcount')?.textContent||'';
  const lab=document.querySelector('.ring .plab')?.textContent||'';
  const m=/^([0-9]+)[/]([0-9]+)$/.exec(count);
  if(!m) return 'FAIL count '+count;
  if(lab!=='done') return 'FAIL label '+lab;
  const rows=document.querySelectorAll('.tasklist li').length;
  const ticked=document.querySelectorAll('.tasklist li.done').length;
  if(Number(m[2])!==rows) return 'FAIL total '+m[2]+' vs '+rows+' rows';
  if(Number(m[1])!==ticked) return 'FAIL done '+m[1]+' vs '+ticked+' ticked';
  if(rows!==21) return 'FAIL '+rows+' tasks, China seeds 21';
  const want=Math.round(Number(m[1])/Number(m[2])*100)+'%';
  return pct===want ? 'ok '+pct+' of '+count : 'FAIL '+pct+' vs '+want;
})()`, true);
rows.push([String(todoring).startsWith('ok') ? 'PASS' : 'FAIL', 'To-do ring · counts tasks, not packing', String(todoring).slice(3, 56)]);

/* A ticked checklist item has to survive the write, or the ring above it is a
   decoration on a lie: the items come off liveQuery as $state proxies and
   IndexedDB refuses to clone one, so the tick used to throw into a floating
   promise and the box un-ticked itself on the next render. Tick, watch the
   ring move, untick, and leave the seed as we found it. */
const checkring = await js(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  [...document.querySelectorAll('.seg button')].find(b=>/Checklists/.test(b.textContent)).click();
  await sleep(1600);
  const read=()=>document.querySelector('.ring .pcount')?.textContent||'';
  const before=read();
  const m=/^([0-9]+)[/]([0-9]+)$/.exec(before);
  if(!m) return 'FAIL count '+before;
  if(Number(m[2])!==11) return 'FAIL '+m[2]+' items, China seeds 11';
  const box=document.querySelector('.klist .cbox');
  if(!box) return 'FAIL no checkbox';
  box.click(); await sleep(1200);
  const ticked=read();
  if(Number(/^([0-9]+)/.exec(ticked)[1])!==Number(m[1])+1) return 'FAIL tick did not stick: '+before+' → '+ticked;
  const pct=document.querySelector('.ring .pct').textContent;
  const want=Math.round((Number(m[1])+1)/Number(m[2])*100)+'%';
  if(pct!==want) return 'FAIL '+pct+' vs '+want;
  document.querySelector('.klist .cbox').click(); await sleep(1200);
  return read()===before ? 'ok '+before+' → '+ticked+' ('+want+') → '+read() : 'FAIL untick '+read();
})()`, true);
rows.push([String(checkring).startsWith('ok') ? 'PASS' : 'FAIL', 'Checklist tick survives the write', String(checkring).slice(3, 56)]);

/* the counter-facing actions */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/info` });
await wait(2200);
const driver = await js(`(async()=>{
  const btn=[...document.querySelectorAll('.zhlist .txt')].find(b=>/Daxing/.test(b.textContent));
  btn.click(); await new Promise(r=>setTimeout(r,700));
  const d=document.querySelector('.driver');
  return d ? d.innerText.replace(/\\n/g,' | ') : 'FAIL';
})()`, true);
rows.push([driver.includes('请带我去这里') ? 'PASS' : 'FAIL', 'Driver card full-screen', driver.slice(0, 60)]);

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
rows.push([webps === 10 ? 'PASS' : 'FAIL', 'Ten place photos stored offline', `webp blobs: ${webps}`]);

/* photo bands actually RENDER offline (innerText cannot see broken images) */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/itinerary` });
await wait(2200);
const bands = await js(`(async()=>{
  for (let i=1;i<=4;i++){ window.scrollTo(0, document.body.scrollHeight*i/4); await new Promise(r=>setTimeout(r,500)); }
  await new Promise(r=>setTimeout(r,600));
  return [...document.images].filter(im=>im.src.startsWith('blob:')&&im.complete&&im.naturalWidth>0).length;
})()`, true);
rows.push([bands >= 10 ? 'PASS' : 'FAIL', 'Photo bands render offline', `loaded imgs: ${bands}`]);

/* the read-more place page: route, text and hero, offline */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/itinerary/cn26-stop-beijing` });
await wait(2200);
const place = await js(`(()=>{
  const t=document.body.innerText.toLowerCase();
  const hero=[...document.images].some(im=>im.src.startsWith('blob:')&&im.complete&&im.naturalWidth>0);
  return (t.includes('palace museum') && t.includes('mutianyu') && t.includes('day-by-day') && hero) ? 'ok' : 'FAIL '+t.slice(0,40);
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

/* the flight fare chip lands on the stop it belongs to (Zhangjiajie, CA 1953),
   with the beds booked there and the itemised money block beside it.
   $124, not the $104 that was planned: Pullman was booked on 2026-07-27 for
   ¥887.52, and the stop page converts at the trip's own rate rather than
   inventing a dollar price the confirmation never printed. */
await check('City guide · booked items + prices', `${BASE}?d=2026-12-15#/trip/cn26/itinerary/cn26-stop-zhangjiajie`,
  ['CA 1953', 'PEK → DYG', '$241', 'Booked for this stop', 'Pullman Zhangjiajie', '$124',
   'Huatian Grand Hotel', '$59', 'Park pass', '$35', 'hotels', '$183 (both booked)']);

/* THE VISA-EXIT STOP. Dec 20 is a runbook day, so Home draws "Travel-day
   basics" instead of the plan items — this page is where the exit night is
   actually read. Three facts have to be on it: the bed is booked and PAID, the
   free airport transfer that puts you at the terminal is itemised on the order,
   and the order still reads "Confirming". */
await check('City guide · the exit night, paid and unconfirmed', `${BASE}?d=2026-12-15#/trip/cn26/itinerary/cn26-stop-kunming`,
  ['Ibis Kunming Changshui', '$25.73', 'free airport transfer', 'Confirming', '23:00 Dec 17']);
/* And the Dali page carries the cliff and the desk that shuts at 23:00. */
await check('City guide · Dali booked, arrival undeclared', `${BASE}?d=2026-12-15#/trip/cn26/itinerary/cn26-stop-dali`,
  ['Dali Yanyuan Mountain Retreat', '¥324', '23:59 Dec 15', '23:00', '+86 189 8708 1208']);

/* the money screen: what is booked, what each one costs, and a total that is
   honest about the legs it cannot price */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/wallet` });
await wait(2200);
const money = await js(`(async()=>{
  [...document.querySelectorAll('.seg button')].find(b=>/Money/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,700));
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
  const want=['booked & committed','four points by sheraton','$245','$244.74 (2n)',
    'blossom house','$300','$299.56 (2n)',
    'element chongli','$233','$232.95 (2n)',
    'pullman zhangjiajie','$124','¥887.52 (2n)',
    'huatian grand hotel','$59','¥419.00',
    'glenview itc plaza','$163','¥1,166.00 (2n)',
    'yue tu inn','$120','¥857.30 (2n)',
    'dali yanyuan mountain retreat','$45','¥324.00',
    'ibis kunming changshui','$26','$25.73',
    'the royal garden','$1,232','$1,232.01 (5n)',
    'halfway guesthouse','$20','ca 1953','$241','3u 8011','$230','mu 733','$293',
    'international flights','booked ~$2,026','price not recorded','counted so far','$5,356',
    'of a $7,500 budget','4 not priced','4 items have no price yet'];
  /* The superseded Four Points price, as a regression guard on the money card
     rather than only on the ticket. $289.68 is unambiguous: no other row on
     this trip carries it, and it is exactly what a reverted seed would print. */
  if(t.includes('289.68')) return 'FAIL the superseded Four Points price is back on the money card';
  const missing=want.filter(w=>!t.includes(w.toLowerCase()));
  return missing.length ? 'FAIL missing: '+missing.join(', ') : 'ok';
})()`, true);
rows.push([money === 'ok' ? 'PASS' : 'FAIL', 'Money · booked & committed card', String(money).slice(0, 70)]);

/* a row of that card opens the real ticket, in the segment it lives in */
const jump = await js(`(async()=>{
  const row=[...document.querySelectorAll('.bk .what')].find(b=>/Four Points by Sheraton/.test(b.textContent));
  if(!row) return 'FAIL no row';
  row.click(); await new Promise(r=>setTimeout(r,700));
  const seg=[...document.querySelectorAll('.seg button')].find(b=>b.getAttribute('aria-selected')==='true');
  const card=document.getElementById('bk-cn26-stay-00');
  return (card && /Stays/.test(seg?.textContent||'')) ? 'ok' : 'FAIL '+(seg?.textContent||'')+'/'+!!card;
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
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/wallet` });
await wait(2200);
const prepaid = await js(`(async()=>{
  [...document.querySelectorAll('.seg button')].find(b=>/Money/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,700));
  const t=document.body.innerText.replace(/\\s+/g,' ');
  const chip=(label)=>{ const m=t.match(new RegExp(label+'\\\\s+(\\\\$[0-9,]+)','i')); return m?m[1]:'?'; };
  const want={"INT'L FLIGHTS":'$2,026','TRAINS\\\\+FLIGHTS':'$764','KUNYU TRAINING':'$100','LODGING':'$86','TOTAL SPENT':'$2,976'};
  const bad=Object.entries(want).filter(([k,v])=>chip(k)!==v).map(([k])=>k+'='+chip(k));
  return bad.length ? 'FAIL '+bad.join(' ') : 'ok';
})()`, true);
rows.push([prepaid === 'ok' ? 'PASS' : 'FAIL', 'Money · prepaid already counted', String(prepaid).slice(0, 60)]);

/* place cards carry map buttons, and the maps hint card explains Amap */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/info` });
await wait(2200);
const infomaps = await js(`(()=>{
  const t=document.body.innerText.toLowerCase();
  const groups=[...document.querySelectorAll('.zhlist .maps')];
  const pairs=groups.filter(g=>g.querySelectorAll('button').length!==1).length;
  const ok=t.includes('maps in china') && t.includes('高德地图') && groups.length>=17 && pairs===0;
  return ok ? 'ok '+groups.length+' cards, 1 button each' : 'FAIL hint/'+groups.length+'/'+pairs;
})()`);
rows.push([String(infomaps).startsWith('ok') ? 'PASS' : 'FAIL', 'Info · one map button per card', String(infomaps).slice(0, 40)]);

/* the button must open the PLACE, not a nameless coordinate. Two proofs:
   the geo: intent the phone would fire (a name search, Chinese encoded), and
   the https link a browser falls back to — neither is a coordinate. */
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
  if(/query=\d/.test(g)) return 'FAIL web fallback still a coordinate';
  return 'ok';
})()`, true);
rows.push([names === 'ok' ? 'PASS' : 'FAIL', 'Maps open the place, not a dot', String(names).slice(0, 55)]);

/* a booking carries its own location now: the beds whose address the owner's
   own paperwork prints open on that address, the flight opens the airport it
   LEAVES from, and the beds with nothing verified carry no button at all */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/wallet` });
await wait(2200);
const bookmaps = await js(`(async()=>{
  const seg=(re)=>[...document.querySelectorAll('.seg button')].find(b=>re.test(b.textContent));
  seg(/Stays/).click(); await new Promise(r=>setTimeout(r,800));
  const btns=(id)=>[...(document.getElementById('bk-'+id)?.querySelectorAll('.maps button')||[])];
  const yuetu=btns('cn26-stay-06');
  if(yuetu.length!==1) return 'FAIL Yue Tu Inn buttons '+yuetu.length;
  const ngeo=yuetu[0].getAttribute('data-geo')||'';
  /* The address IS the search — no hotel name this repo never verified goes
     to a map, and no coordinate ever does. */
  if(ngeo!=='geo:0,0?q='+encodeURIComponent('No. 43 Yizheng Jinjia Street, Dayan Ancient Town')) return 'FAIL geo '+ngeo.slice(0,70);
  /* Four Points was in the mute list until 2026-07-27. Booking it produced the
     address the accommodation document had told us to go and get, so it now
     opens on that address — and the check follows the fact instead of being
     deleted. Its name is still nowhere near a map: Four Points is a chain. */
  const fp=btns('cn26-stay-00');
  if(fp.length!==1) return 'FAIL Four Points buttons '+fp.length;
  const fgeo=fp[0].getAttribute('data-geo')||'';
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
  const rgeo=rg[0].getAttribute('data-geo')||'';
  if(rgeo!=='geo:0,0?q='+encodeURIComponent('69 Mody Road, Tsimshatsui East, Kowloon, Hong Kong')) return 'FAIL Royal Garden geo '+rgeo.slice(0,90);
  const elb=btns('cn26-stay-02');
  if(elb.length!==1) return 'FAIL Element buttons '+elb.length;
  const egeo=elb[0].getAttribute('data-geo')||'';
  if(egeo!=='geo:0,0?q='+encodeURIComponent('Block I, Thaiwoo Ski Resort & Alpine Park, Sitaizui County')) return 'FAIL Element geo '+egeo.slice(0,90);
  if(/Royal%20Garden|Element|Marriott/i.test(rgeo+egeo)) return 'FAIL a hotel name reached the map';
  /* Pullman was booked 2026-07-27 and its Agoda confirmation MISSPELLS the
     street — "GADYUN ROAD" for Gaoyun Road. The button keeps the accommodation
     document's spelling, because a search for a street that does not exist is
     worse than no button at all, and the typo must never reach a map. */
  const pl=btns('cn26-stay-03');
  if(pl.length!==1) return 'FAIL Pullman buttons '+pl.length;
  const pgeo=pl[0].getAttribute('data-geo')||'';
  if(pgeo!=='geo:0,0?q='+encodeURIComponent('No. 188 Gaoyun Road, Wulingyuan')) return 'FAIL Pullman geo '+pgeo.slice(0,90);
  if(/GADYUN/i.test(pgeo)) return 'FAIL the confirmation typo reached the map';
  if(/Pullman|Accor/i.test(pgeo)) return 'FAIL the chain name reached the map: '+pgeo.slice(0,60);
  /* Glenview kept the document's address too — its Trip.com booking printed
     none of its own to compare with. */
  const gv=btns('cn26-stay-05');
  if(gv.length!==1) return 'FAIL Glenview buttons '+gv.length;
  const ggeo=gv[0].getAttribute('data-geo')||'';
  if(ggeo!=='geo:0,0?q='+encodeURIComponent('No. 66 Qingnian Road, Yuzhong District')) return 'FAIL Glenview geo '+ggeo.slice(0,90);
  /* DALI joined the addressed beds on 2026-07-27 evening: its document entry
     had only a COORDINATE, which a bed never ships, and its Booking.com
     confirmation printed a street. The postcode rides inside that verbatim line
     rather than being appended to another source's — and cutting it out would
     also cut out "Dali", the city. The coordinate must still be nowhere near
     the button. */
  const dl=btns('cn26-stay-08');
  if(dl.length!==1) return 'FAIL Dali buttons '+dl.length;
  const dgeo=dl[0].getAttribute('data-geo')||'';
  if(dgeo!=='geo:0,0?q='+encodeURIComponent('No.133, Yinxian Road, Shuidui Village, 671003 Dali, China')) return 'FAIL Dali geo '+dgeo.slice(0,90);
  if(/25\.6957|100\.1537|Yanyuan/i.test(dgeo)) return 'FAIL a coordinate or the hotel name reached the map: '+dgeo.slice(0,60);
  /* The ibis kept the address that names its UNIT. Its Trip.com order prints a
     fuller line that is not a superset of this one, and adopting it would cost
     the word "Kunming" at the address cap — so the shipped line did not move,
     and the order's version lives on the note instead. */
  const ib=btns('cn26-stay-09');
  if(ib.length!==1) return 'FAIL ibis buttons '+ib.length;
  const igeo=ib[0].getAttribute('data-geo')||'';
  if(igeo!=='geo:0,0?q='+encodeURIComponent('Unit 1-1, Building 1, Yunlifang, Changshui Hangcheng')) return 'FAIL ibis geo '+igeo.slice(0,90);
  if(/ibis|Accor/i.test(igeo)) return 'FAIL the chain name reached the map: '+igeo.slice(0,60);
  /* Blossom House and Huatian still have no address anywhere, so neither ships
     a button. A missing button here is the feature — and BOTH are BOOKED beds:
     Blossom House's confirmation named a district and Huatian's Trip.com
     booking printed no address at all. Booked is not the same as locatable, and
     booking one must never conjure a button. */
  const mute=['cn26-stay-01','cn26-stay-04'].filter(id=>btns(id).length!==0);
  if(mute.length) return 'FAIL unverified bed has a button: '+mute.join(',');
  seg(/Travel/).click(); await new Promise(r=>setTimeout(r,800));
  const ca=btns('cn26-flight-ca1953');
  if(ca.length!==1) return 'FAIL CA1953 buttons '+ca.length;
  const ageo=ca[0].getAttribute('data-geo')||'';
  if(!ageo.startsWith('geo:0,0?q='+encodeURIComponent('北京首都国际机场'))) return 'FAIL flight geo '+ageo.slice(0,50);
  return 'ok';
})()`, true);
rows.push([bookmaps === 'ok' ? 'PASS' : 'FAIL', 'Bookings · one button, right place', String(bookmaps).slice(0, 55)]);

/* TEN BEDS ARE BOOKED — every bed on the trip except the gorge guesthouse,
   which is a deliberate walk-in. Eight went on 26–27 Jul; Dali and Kunming
   finished the list on 2026-07-27. This is the check that notices if any one of
   them ever quietly goes back to pending. It asserts the fact several ways, so a
   half-reverted seed cannot slip through: the stamp on the card, the number a
   check-in desk asks for (copyable, in the big type, with the secondary line
   under it — never the other way round), the price actually paid, the real
   cancellation deadline, the LINK BACK TO THE PLATFORM, and that NO bed which is
   not booked wears the stamp.

   ONE of the ten deliberately carries NO number: Element's Agoda number was
   never captured. The app would rather show nothing than something plausible,
   and that must survive too — while still carrying its link, because "we were
   never given the number" and "you cannot reach the order" are different
   admissions. */
const BOOKED_BEDS = ['cn26-stay-00','cn26-stay-01','cn26-stay-02','cn26-stay-03','cn26-stay-04',
                     'cn26-stay-05','cn26-stay-06','cn26-stay-08','cn26-stay-09','cn26-stay-10'];
const bedsBooked = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  [...document.querySelectorAll('.seg button')].find(b=>/Stays/.test(b.textContent)).click();
  await sleep(900);
  const card=(id)=>document.getElementById('bk-'+id);
  const stamp=(id)=>(card(id)?.querySelector('.tk-stamp')?.textContent||'').trim();
  for(const id of ${JSON.stringify(BOOKED_BEDS)}){
    if(!/^Booked/.test(stamp(id))) return 'FAIL '+id+' is not booked: "'+stamp(id)+'"';
  }
  /* NOTHING is pending any more, so the only bed that may not wear the stamp is
     the gorge walk-in. If a "Pending" stamp ever reappears anywhere, a booking
     has been lost. */
  if(/^Booked/.test(stamp('cn26-stay-07'))) return 'FAIL the walk-in wears the booked stamp';
  const pending=[...document.querySelectorAll('.tk-stamp')].map(e=>e.textContent.trim()).filter(t=>/pending/i.test(t));
  if(pending.length) return 'FAIL a bed went back to pending: '+pending.join(',');
  if(!/Walk/i.test(stamp('cn26-stay-07'))) return 'FAIL the gorge stopped being a walk-in: '+stamp('cn26-stay-07');

  const copied=[];
  navigator.clipboard.writeText=(t)=>{copied.push(t); return Promise.resolve();};
  const px=(el)=>parseFloat(getComputedStyle(el).fontSize);
  const chipsOf=(el)=>[...el.querySelectorAll('.meta .m')].map(m=>(m.querySelector('.k')?.textContent||'').trim()+'='+(m.querySelector('.v')?.textContent||'').trim());

  /* A number you read out at a desk: big, copyable, with the small line under
     it carrying the thing that is NOT the number (a PIN, or where it was
     booked). Five of the ten carry a secondary line; the price beside it is
     the price the confirmation printed, IN THE CURRENCY IT PRINTED IT IN — five
     of the ten are quoted in yuan, and the ibis is quoted in the dollars its
     order actually charged. */
  const numbered=[['cn26-stay-03','682760663',/Agoda/i,'¥887.52'],
                  ['cn26-stay-06','5942328968',/3635/,'¥857.30'],
                  ['cn26-stay-08','6352597569',/8706/,'¥324.00'],
                  ['cn26-stay-09','1653715562519718',/2284/,'$25.73'],
                  ['cn26-stay-10','cohTex87hq19CnTh',/direct/i,'$1,232.01']];
  for(const [id,want,subRe,price] of numbered){
    const el=card(id);
    const code=el?.querySelector('.codestrip .code');
    if(!code) return 'FAIL '+id+' has no code strip to read out at a desk';
    if(code.textContent.trim()!==want) return 'FAIL '+id+' code '+code.textContent.trim();
    copied.length=0;
    code.click(); await sleep(400);
    if(copied[0]!==want) return 'FAIL '+id+' number did not copy: '+String(copied[0]).slice(0,30);
    const sub=el.querySelector('.codestrip .codesub');
    if(!sub||!subRe.test(sub.textContent)) return 'FAIL '+id+' secondary line is wrong: '+(sub?sub.textContent:'(none)');
    /* Secondary means SMALLER. If a redesign ever makes that line as loud as
       the number, the desk is read the wrong string. */
    if(!(px(sub)<px(code))) return 'FAIL '+id+' secondary line is not smaller: '+px(sub)+' vs '+px(code);
    if(!el.innerText.includes(price)) return 'FAIL '+id+' does not show '+price;
  }
  /* The four Trip.com beds carry their order number with no secondary line at
     all — no PIN was shown for any of them. Four Points is in this group now,
     and used to be in the one above: the order that carried PIN 9858 was
     REPLACED on 2026-07-27, and the replacement showed no PIN. Blossom House
     joined it from the other direction, having had no number at all until the
     same bookings list was read. */
  for(const [id,want,price] of [['cn26-stay-00','1653715561783471','$244.74'],
                                ['cn26-stay-01','1653715561827302','$299.56'],
                                ['cn26-stay-04','1653715534089209','¥419.00'],
                                ['cn26-stay-05','1653715534121148','¥1,166.00']]){
    const el=card(id);
    const code=el?.querySelector('.codestrip .code');
    if(!code||code.textContent.trim()!==want) return 'FAIL '+id+' code '+(code?code.textContent.trim():'(none)');
    if(el.querySelector('.codestrip .codesub')) return 'FAIL '+id+' invented a secondary line — no PIN was shown';
    if(!el.innerText.includes(price)) return 'FAIL '+id+' does not show '+price;
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
  for(const dead of ['289.68','144.84','1,960','16:00']){
    if(fpFront.includes(dead)) return 'FAIL Four Points presents a superseded term as its own: '+dead;
  }
  if(!fpText.includes('$244.74')) return 'FAIL Four Points does not show the rebooked price';
  for(const k of ['Free cancel','Payment']){
    const chip=fpChips.find(c=>c.startsWith(k+'='))||'';
    if(!/not stated/i.test(chip)) return 'FAIL Four Points claims a term its live order never gave: "'+chip+'"';
  }

  /* The deadline is the money. A generic "free cancellation" chip on Element
     would hide a 46% loss, so each booked bed WITH a stated cut-off must print
     it — and Dec 9 closes TWO windows, Element's at 00:00 and Pullman's at
     23:59. Four Points is deliberately not in this list any more: the 16:00
     Dec 5 window belonged to the order that was replaced. */
  const deadlines=[['cn26-stay-02',/00:00 Dec 9/],['cn26-stay-03',/23:59 Dec 9/],
                   ['cn26-stay-06',/23:59 Dec 13/],['cn26-stay-08',/23:59 Dec 15/],
                   ['cn26-stay-09',/23:00 Dec 17/],['cn26-stay-10',/14:00 Dec 19/]];
  for(const [id,re] of deadlines){
    const chip=chipsOf(card(id)).find(c=>/^Free cancel=/.test(c))||'';
    if(!re.test(chip)) return 'FAIL '+id+' cancellation chip: "'+chip+'"';
  }
  /* DALI'S CLIFF is the second on the trip that reaches a 100% loss — from
     00:00 on Dec 16 the whole ¥324 is gone — and its desk SHUTS AT 23:00, an
     hour before Yue Tu's, on the night you arrive off the gorge road by shared
     car with NO late arrival declared. Both have to be on the card: the money,
     and the reason the trip's standing late-arrival rule is satisfied at Yue Tu
     and NOT here. */
  const dali=chipsOf(card('cn26-stay-08'));
  const dcliff=dali.find(c=>/^Then=/.test(c))||'';
  if(!/00:00 Dec 16/.test(dcliff)||!/¥324/.test(dcliff)) return 'FAIL Dali refund cliff: "'+dcliff+'"';
  const darr=dali.find(c=>/^Late arrival=/.test(c))||'';
  if(!/NOT declared/i.test(darr)||!/23:00/.test(darr)) return 'FAIL Dali undeclared arrival: "'+darr+'"';
  const dpay=dali.find(c=>/^Payment=/.test(c))||'';
  if(!/not stated/i.test(dpay)) return 'FAIL Dali claims a payment mode nobody stated: "'+dpay+'"';
  const dci=dali.find(c=>/^Check-in=/.test(c))||'';
  if(!/23:00/.test(dci)) return 'FAIL Dali does not show when its desk shuts: "'+dci+'"';
  /* THE VISA-EXIT NIGHT IS PAID AND NOT CONFIRMED. Trip.com has the money and a
     number; the property has not accepted, and the order page offers "Expedite
     Booking". The bed is booked — it is paid — and the state is carried
     honestly: a chip in the platform's own word, an alert-styled note, the
     free-cancellation cut-off that bounds the decision, and the free airport
     transfer that is the entire reason this bed exists. Rounding "Confirming"
     up to a plain tick is the one tidy-looking edit that could cost the exit. */
  const ibis=chipsOf(card('cn26-stay-09'));
  const ist=ibis.find(c=>/^Status=/.test(c))||'';
  if(!/CONFIRMING/i.test(ist)) return 'FAIL the ibis hides its unconfirmed state: "'+ist+'"';
  if(!card('cn26-stay-09')?.querySelector('.note.alert')) return 'FAIL the ibis note is not drawn as an alert';
  const ish=ibis.find(c=>/^Shuttle=/.test(c))||'';
  if(!/free airport transfer/i.test(ish)) return 'FAIL the ibis buries its free shuttle: "'+ish+'"';
  const ipay=ibis.find(c=>/^Payment=/.test(c))||'';
  if(!/PREPAID ONLINE/i.test(ipay)||!/25\\.73/.test(ipay)) return 'FAIL the ibis prepayment chip: "'+ipay+'"';
  const ismk=ibis.find(c=>/^Smoking=/.test(c))||'';
  if(!/SMOKING PERMITTED/i.test(ismk)) return 'FAIL the ibis smoking room is not stated: "'+ismk+'"';
  /* YUE TU'S REFUND CLIFF, and what hangs on it. Free to 23:59 Dec 13, then one
     night (US$63) is gone — and Dec 13 is also the last free day to decide the
     gorge bag transfer, which was asked for at booking and never answered. A
     card showing only the free window would hide both the money and the
     decision. The approved 22:00–23:00 arrival rides here too: it is the reason
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
  /* Huatian and Glenview showed NO cancellation terms and NO payment mode. They
     must say so on the card rather than reprinting the old research as if the
     booking had confirmed it — "free cancellation" here would be the most
     expensive sentence in the app. */
  for(const id of ['cn26-stay-04','cn26-stay-05']){
    const chips=chipsOf(card(id));
    const fc=chips.find(c=>/^Free cancel=/.test(c))||'';
    const pm=chips.find(c=>/^Payment=/.test(c))||'';
    if(!/not stated/i.test(fc)) return 'FAIL '+id+' claims a deadline nobody confirmed: "'+fc+'"';
    if(!/not stated/i.test(pm)) return 'FAIL '+id+' claims a payment mode nobody confirmed: "'+pm+'"';
  }

  /* Booked, priced, and still deliberately numberless — one bed only now. */
  for(const [id,price] of [['cn26-stay-02','$232.95']]){
    if(card(id)?.querySelector('.codestrip')) return 'FAIL '+id+' grew a confirmation number';
    if(!card(id)?.innerText.includes(price)) return 'FAIL '+id+' does not show '+price;
  }

  /* THE OWNER'S OWN RULE, 2026-07-27: every booked bed shows its PRICE, that it
     IS booked, and a LINK TO THE SITE IT WAS BOOKED ON — so they can open and
     manage it. Where no deep link to the reservation was ever supplied the link
     is the platform's own entry point, and it must be that platform: sending
     someone to Booking.com for a bed they took on Agoda is worse than sending
     them nowhere. Element is in this list WITHOUT a confirmation number, which
     is the whole point — not knowing the number is a different admission from
     not being able to get back to the order. */
  const links={'cn26-stay-00':'https://www.trip.com/account/orderlist/',
               'cn26-stay-01':'https://www.trip.com/account/orderlist/',
               'cn26-stay-02':'https://www.agoda.com/account/bookings.html',
               'cn26-stay-03':'https://www.agoda.com/account/bookings.html',
               'cn26-stay-04':'https://www.trip.com/account/orderlist/',
               'cn26-stay-05':'https://www.trip.com/account/orderlist/',
               'cn26-stay-06':'https://secure.booking.com/mytrips.html',
               'cn26-stay-08':'https://secure.booking.com/mytrips.html',
               'cn26-stay-09':'https://www.trip.com/account/orderlist/',
               'cn26-stay-10':'https://www.rghk.com.hk/en/index.php'};
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
  return 'ok';
})()`, true);
rows.push([bedsBooked === 'ok' ? 'PASS' : 'FAIL', 'Ten beds booked, priced, linked', String(bedsBooked).slice(0, 55)]);

/* THE ADDRESS LAYER, three promises.

   1. A driver card that has an address shows it FULL SCREEN under the Chinese
      name, and its own button copies it — that is the thing you hand across
      the front seat. The address is read back out of IndexedDB rather than
      typed in here, so this check stays true when the manifests change.
   2. The same address is folded into the geo: intent behind the map button,
      BEHIND the name, never instead of it.
   3. A bed that ships no button gets one the moment an address is typed. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/info` });
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
   booked, and still buttonless, because its confirmation names a district and
   not a street. Type an address off a confirmation and the button appears,
   searching for that address. The string below is a TYPED TEST VALUE, not a
   sourced fact — the point is that the button follows whatever is entered. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/wallet` });
await wait(2200);
const paste = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const btns=()=>[...(document.getElementById('bk-cn26-stay-01')?.querySelectorAll('.maps button')||[])];
  [...document.querySelectorAll('.seg button')].find(b=>/Stays/.test(b.textContent)).click();
  await sleep(800);
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

await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/itinerary/cn26-stop-gorge` });
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
await S('Page.navigate', { url: `${BASE}?d=2026-11-25#/trip/cn26/today` });
await wait(3000);
const tried = netlog.filter((u) => u.includes('open-meteo'));
const stillThere = String(await js('document.body.innerText')).toLowerCase();
const grounded = tried.length === 0 && (await js('navigator.onLine')) === false
  && stillThere.includes('kunyu academy') && stillThere.includes('usual day');
rows.push([grounded ? 'PASS' : 'FAIL', 'Airplane mode · no attempt at all',
  grounded ? 'onLine=false, 0 requests, Today intact' : `${tried.length} request(s)`]);

/* Deleting a trip really removes it — and only it. A throwaway trip is created
   here, deleted through the shelf's own two-tap button, and then the database
   is read directly: the trip and every row that belonged to it must be gone,
   while China 2026 and its rows must be untouched. Runs last, because it is
   the only check that writes. */
await S('Page.navigate', { url: `${BASE}#/trips` });
await wait(2200);
const del = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const set=(el,v)=>{ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };
  const rows=async(store,tripId)=>{
    const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
    const all=await new Promise(r=>{const q=db.transaction(store).objectStore(store).getAll();q.onsuccess=()=>r(q.result)});
    db.close();
    return all.filter(x=>!tripId||x.tripId===tripId).length;
  };

  [...document.querySelectorAll('button')].find(b=>/Start a New Trip/.test(b.textContent)).click();
  await sleep(800);
  const ins=[...document.querySelectorAll('.sheet input, form input')];
  const text=ins.filter(i=>i.type!=='date');
  const dates=ins.filter(i=>i.type==='date');
  if(!text.length||dates.length<2) return 'FAIL wizard inputs '+text.length+'/'+dates.length;
  set(text[0],'Throwaway'); set(dates[0],'2027-03-01'); set(dates[1],'2027-03-05');
  await sleep(300);
  [...document.querySelectorAll('button')].find(b=>/Create trip/.test(b.textContent)).click();
  await sleep(1800);

  if(await rows('trips')!==2) return 'FAIL trip not created';
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const trips=await new Promise(r=>{const q=db.transaction('trips').objectStore('trips').getAll();q.onsuccess=()=>r(q.result)});
  db.close();
  const mine=trips.find(t=>t.title==='Throwaway'); if(!mine) return 'FAIL no throwaway';

  /* give it something to cascade */
  const stopsBefore=await rows('stops', mine.id);

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
