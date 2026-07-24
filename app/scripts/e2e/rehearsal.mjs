/* The dress rehearsal, scripted: install, import China, then go hard-offline and
   walk every screen and every date that matters. */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const BASE = 'http://localhost:4173/';
const SEED = 'C:\\Source\\China\\seed\\china-2026.trip.json';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9150 + Math.floor(Math.random() * 50);

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${(process.env.TEMP || '.')}\\cdp-reh-${PORT}`,
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
ws.onmessage = (e) => { const m = JSON.parse(e.data);
  if (m.id && p.has(m.id)) { const { res, rej } = p.get(m.id); p.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 180));
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

console.log('AIRPLANE-MODE DRESS REHEARSAL');
console.log('─'.repeat(64));
for (const [status, label, note] of rows) {
  console.log(`${status}  ${label.padEnd(36)} ${note}`);
}
const failed = rows.filter((r) => r[0] === 'FAIL').length;
console.log('─'.repeat(64));
console.log(`${rows.length - failed}/${rows.length} passed with the network hard off.`);
if (errs.length) console.log('\nERRORS:\n' + errs.join('\n'));

ws.close(); chrome.kill(); process.exit(failed ? 1 : 0);
