/* The dress rehearsal, scripted: install, import China, then go hard-offline and
   walk every screen and every date that matters. */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const BASE = 'http://localhost:4173/';
const SEED = 'C:\\Source\\China\\seed\\china-2026.trip.json';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9150 + Math.floor(Math.random() * 50);
/* A THROWAWAY profile per run, and it must be unique. A reused directory keeps
   the service worker from the last run, which precached the PREVIOUS build —
   the rehearsal then walks an app that is one deploy old and lies to you. */
const PROFILE = `${process.env.TEMP || '.'}\\cdp-reh-${PORT}-${Date.now()}`;

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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
console.log('Installed and China imported. Going offline…\n');

await S('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
netlog = [];

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
await check('Dec 16 · the late arrival', `${BASE}?d=2026-12-16#/trip/cn26/today`, ['late arrival', 'Mama Naxi', '2,400m']);
await check('Dec 21 · VISA EXIT DAY', `${BASE}?d=2026-12-21#/trip/cn26/today`, ['VISA EXIT DAY', 'MU733', 'day 29']);
await check('Dec 26 · flying home', `${BASE}?d=2026-12-26#/trip/cn26/today`, ['flying home', 'HKG Terminal 1']);
await check('Dec 28 · trip complete', `${BASE}?d=2026-12-28#/trip/cn26/today`, ['Trip complete', '37 days']);
await check('Plan · route map + stops', `${BASE}?d=2026-12-15#/trip/cn26/itinerary`, ['THE ROUTE', 'Kunyu Academy', 'Tiger Leaping Gorge']);
await check('Wallet · counter cards', `${BASE}?d=2026-12-15#/trip/cn26/wallet`, ['8CR7MR', 'Etihad', 'BOOKED']);
await check('Tasks · deadlines + alarms', `${BASE}?d=2026-12-15#/trip/cn26/tasks`, ['ACTION LIST', 'phone alarms', 'Forbidden City']);
await check('Info · visa clock + driver cards', `${BASE}?d=2026-12-15#/trip/cn26/info`, ['MAINLAND VISA', '北京大兴国际机场', 'Emergency']);
await check('Stats · map + burn', `${BASE}?d=2026-12-15#/trip/cn26/stats`, ['THE ROUTE', 'MONEY', 'PROGRESS']);
await check('Shelf', `${BASE}?d=2026-12-15#/trips`, ['China 2026', 'ACTIVE']);
await check('Backup screen', `${BASE}#/backup`, ['Save a copy', 'Storage', 'Restore']);

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
  return missing.length ? 'FAIL missing: '+missing.join(', ') : (maps>=2 ? 'ok '+maps : 'FAIL map buttons: '+maps);
})()`);
rows.push([String(guide).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · 5 parts + map buttons', String(guide).slice(0, 56)]);

/* the flight fare chip lands on the stop it belongs to (Zhangjiajie, CA 1953),
   with the beds booked there and the itemised money block beside it */
await check('City guide · booked items + prices', `${BASE}?d=2026-12-15#/trip/cn26/itinerary/cn26-stop-zhangjiajie`,
  ['CA 1953', 'PEK → DYG', '$241', 'Booked for this stop', 'Peakcap Hostel', '$50', 'Park pass', '$35']);

/* the money screen: what is booked, what each one costs, and a total that is
   honest about the legs it cannot price */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/wallet` });
await wait(2200);
const money = await js(`(async()=>{
  [...document.querySelectorAll('.seg button')].find(b=>/Money/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,700));
  const t=document.body.innerText.toLowerCase();
  const want=['booked & committed','chao sanlitun','$376','houju','$34 – $80','$17–40/n',
    'salisbury','$550 – $950','$550–950 (5n)','ca 1953','$241','3u 8011','$230','mu 733','$293',
    'international flights','booked ~$2,026','price not recorded','counted so far','$4,391 – $4,867',
    'of a $6,500 budget','4 not priced','4 items have no price yet'];
  const missing=want.filter(w=>!t.includes(w.toLowerCase()));
  return missing.length ? 'FAIL missing: '+missing.join(', ') : 'ok';
})()`, true);
rows.push([money === 'ok' ? 'PASS' : 'FAIL', 'Money · booked & committed card', String(money).slice(0, 70)]);

/* a row of that card opens the real ticket, in the segment it lives in */
const jump = await js(`(async()=>{
  const row=[...document.querySelectorAll('.bk .what')].find(b=>/CHAO Sanlitun/.test(b.textContent));
  if(!row) return 'FAIL no row';
  row.click(); await new Promise(r=>setTimeout(r,700));
  const seg=[...document.querySelectorAll('.seg button')].find(b=>b.getAttribute('aria-selected')==='true');
  const card=document.getElementById('bk-cn26-stay-00');
  return (card && /Stays/.test(seg?.textContent||'')) ? 'ok' : 'FAIL '+(seg?.textContent||'')+'/'+!!card;
})()`, true);
rows.push([jump === 'ok' ? 'PASS' : 'FAIL', 'Money row opens its own ticket', String(jump).slice(0, 40)]);

/* the tracker starts from what was already paid, not from zero — and no bed
   is counted, because every stay is still pending */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/wallet` });
await wait(2200);
const prepaid = await js(`(async()=>{
  [...document.querySelectorAll('.seg button')].find(b=>/Money/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,700));
  const t=document.body.innerText.replace(/\\s+/g,' ');
  const chip=(label)=>{ const m=t.match(new RegExp(label+'\\\\s+(\\\\$[0-9,]+)','i')); return m?m[1]:'?'; };
  const want={"INT'L FLIGHTS":'$2,026','TRAINS\\\\+FLIGHTS':'$764','KUNYU TRAINING':'$100','LODGING':'$0','TOTAL SPENT':'$2,890'};
  const bad=Object.entries(want).filter(([k,v])=>chip(k)!==v).map(([k])=>k+'='+chip(k));
  return bad.length ? 'FAIL '+bad.join(' ') : 'ok';
})()`, true);
rows.push([prepaid === 'ok' ? 'PASS' : 'FAIL', 'Money · prepaid already counted', String(prepaid).slice(0, 60)]);

/* place cards carry map buttons, and the maps hint card explains Amap */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/info` });
await wait(2200);
const infomaps = await js(`(()=>{
  const t=document.body.innerText.toLowerCase();
  const n=document.querySelectorAll('.zhlist .maps button').length;
  return (t.includes('maps in china') && t.includes('高德地图') && n>=20) ? 'ok '+n : 'FAIL hint/'+n;
})()`);
rows.push([String(infomaps).startsWith('ok') ? 'PASS' : 'FAIL', 'Info · map buttons on place cards', String(infomaps).slice(0, 40)]);

/* the buttons must open the PLACE, not a nameless coordinate: a Chinese name
   search on a place card, and the owner's own share link on the gorge */
const names = await js(`(async()=>{
  const seen=[];
  window.open=(u)=>{ seen.push(String(u)); return null; };
  const row=[...document.querySelectorAll('.zhlist li')].find(r=>/洪崖洞/.test(r.textContent));
  if(!row) return 'FAIL no Hongyadong row';
  const btns=row.querySelectorAll('.maps button');
  if(btns.length<2) return 'FAIL buttons '+btns.length;
  btns[0].click(); btns[1].click();
  await new Promise(r=>setTimeout(r,400));
  const g=seen.find(u=>u.includes('google.com/maps'))||'';
  const a=seen.find(u=>u.includes('amap.com'))||'';
  const enc=encodeURIComponent('洪崖洞');
  if(!g.includes(enc)) return 'FAIL google not by name: '+g.slice(0,60);
  if(/query=\d/.test(g)) return 'FAIL google still a coordinate';
  if(!a.includes('uri.amap.com/search?keyword='+enc)) return 'FAIL amap not a POI search: '+a.slice(0,60);
  return 'ok';
})()`, true);
rows.push([names === 'ok' ? 'PASS' : 'FAIL', 'Maps open the place, not a dot', String(names).slice(0, 55)]);

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

console.log('AIRPLANE-MODE DRESS REHEARSAL');
console.log('─'.repeat(64));
for (const [status, label, note] of rows) {
  console.log(`${status}  ${label.padEnd(36)} ${note}`);
}
const failed = rows.filter((r) => r[0] === 'FAIL').length;
console.log('─'.repeat(64));
console.log(`${rows.length - failed}/${rows.length} passed with the network hard off.`);
if (errs.length) console.log('\nERRORS:\n' + errs.join('\n'));

ws.close(); chrome.kill();
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(failed ? 1 : 0);
