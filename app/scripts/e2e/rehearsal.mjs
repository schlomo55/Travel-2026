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
/* Nov 22's runbook used to end on "No Sunday academy pickup → taxi ~$50", which
   was true of an itinerary that arrived at the academy on the Sunday and of a
   school that had never offered to collect anyone. Both facts died: the stay
   moved to Monday on 12 Aug, and on 13 Aug the school agreed to collect from the
   hotel at 11:00. The check moves with them rather than being dropped — the
   runbook still has to say what happens next, it just says a different thing.
   AND AGAIN ON 2026-09-28: the school asked for the night in MUPING and moved
   the pickup to "earliest 10:30, wait in the lobby"; the Muping bed was booked
   the same morning, so the runbook names tonight's hotel too. */
await check('Nov 22 · arrival, the Monday pickup is set', `${BASE}?d=2026-11-22#/trip/cn26/today`, ['Arrival runbook', 'the academy collects you from the lobby', 'from 10:30 tomorrow', 'Jinjiang Inn Select, Muping', 'entry day']);
await check('Nov 25 · Kunyu default day', `${BASE}?d=2026-11-25#/trip/cn26/today`, ['Kunyu Academy', 'usual day']);
/* Dec 11 moved to DAXING on 2026-09-27: Air China retimed CA1953 and the booking
   went free onto CA8609. The runbook was "the monopoly flight … PEK (Capital
   Airport) — NOT Daxing"; the three facts it must show are now the other way round. */
await check('Dec 11 · the Daxing flight', `${BASE}?d=2026-12-11#/trip/cn26/today`, ['Daxing flight', 'Daxing (PKX)', 'NOT Capital', 'CA8609', '20 kg']);
const dec11NotPek = await js(`(()=>{
  const t=document.body.innerText;
  if(/NOT Daxing/i.test(t)) return 'FAIL Dec 11 still says NOT Daxing';
  if(/PEK T3|PEK Terminal 3|Capital Airport/i.test(t)) return 'FAIL Dec 11 still sends you to Capital';
  return 'ok Daxing, and no PEK instruction';
})()`);
rows.push([String(dec11NotPek).startsWith('ok') ? 'PASS' : 'FAIL', 'Dec 11 · no surface still says Capital', String(dec11NotPek).slice(0, 56)]);
/* 📍 PLACES TODAY — the day→place join, on the screen (scripts/china/day-places.ts).
   Three days, chosen because all three are CROSS-NAME links: the day text and
   the entity disagree, so a chip appearing under the written name would mean
   the manifest had been "corrected" into a text match. Dec 6 says "Forbidden
   City" and must show the Palace Museum; Dec 15 says "Liziba" and "Eling Park /
   Testbed 2"; Dec 24 says "Yat Lok roast goose" and "Star Ferry".
   Dec 24 also proves the negative that the whole explicit manifest exists for:
   Australia Dairy is named on that day ONLY to say it is shut on Thursdays, and
   it must not have a chip. */
await check('Dec 6 · places today, under the museum’s real name', `${BASE}?d=2026-12-06#/trip/cn26/today`,
  ['Places today', 'Palace Museum', '三里屯']);
await check('Dec 15 · places today, three of them', `${BASE}?d=2026-12-15#/trip/cn26/today`,
  ['Places today', '磁器口', 'Liziba station', 'Eling Park & Testbed 2']);
await check('Dec 24 · places today, and the one that is shut', `${BASE}?d=2026-12-24#/trip/cn26/today`,
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
await check('Dec 22 · Macau, the day that used to show nothing', `${BASE}?d=2026-12-22#/trip/cn26/today`,
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
await check('Dec 16 · the late arrival', `${BASE}?d=2026-12-16#/trip/cn26/today`,
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
await check('Dec 19 · Dali, arrival approved, send the ETA', `${BASE}?d=2026-12-19#/trip/cn26/today`,
  ['Dali Yanyuan', '23:00', '+86 189 8708 1208', 'late arrival is APPROVED', 'WhatsApp']);
await check('Dec 21 · VISA EXIT DAY', `${BASE}?d=2026-12-21#/trip/cn26/today`, ['VISA EXIT DAY', 'MU733', 'day 29']);
/* 11:00, not the 12:00 this trip assumed until the Royal Garden was booked
   direct on 2026-07-27 — an hour that decides whether the last morning is a
   slow one or a late-check-out charge. */
await check('Dec 26 · flying home', `${BASE}?d=2026-12-26#/trip/cn26/today`, ['flying home', 'HKG Terminal 1', '11:00']);
await check('Dec 28 · trip complete', `${BASE}?d=2026-12-28#/trip/cn26/today`, ['Trip complete', '37 days']);
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
await S('Page.navigate', { url: `${BASE}?d=2026-12-13#/trip/cn26/today` });
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
  const adds=cands.filter(c=>/\uFF0B/.test(c.querySelector('.cadd')?.textContent||''));
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
  if(!/itinerary.cn26-stop-zhangjiajie/.test(location.hash)) return 'FAIL landed on '+location.hash;
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
await S('Page.navigate', { url: `${BASE}?d=2026-12-22#/trip/cn26/today` });
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

/* AND NOT ONE WORD ON A RUNBOOK DAY. Dec 21 is the visa exit; the checklist IS
   the day, and an app offering a cave to visit while a border crossing is
   being counted down would be reading the room badly. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/today` });
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
await S('Page.navigate', { url: `${BASE}?d=2026-11-21#/trip/cn26/today` });
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
   with the hard deadline one day later: the card must print the number at
   headline size, say the exit date, wear the crit treatment (remaining ≤ 2),
   and open Info's compliance section — the same place the app bar's pill goes,
   which is why they share router.goCompliance. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/today` });
await wait(2200);
const visacard = await js(`(async()=>{
  const el=document.querySelector('.visacard');
  if(!el) return 'FAIL no visa card on VISA EXIT DAY';
  const txt=el.innerText.replace(/\\s+/g,' ').trim();
  if(!/day 29 of 30/i.test(txt)) return 'FAIL the day number is not on the card: "'+txt+'"';
  if(!/must exit by 22 dec/i.test(txt)) return 'FAIL the card does not say when to leave: "'+txt+'"';
  if(!el.classList.contains('crit')) return 'FAIL one day of buffer is not drawn as danger';
  const big=parseFloat(getComputedStyle(el.querySelector('.vcday')).fontSize);
  if(!(big>=22)) return 'FAIL the day number is '+big+' px — still a caption';
  if(el.tagName!=='BUTTON') return 'FAIL the card is a dead '+el.tagName;
  el.click(); await new Promise(r=>setTimeout(r,1200));
  if(!/\\/info$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  if(!document.getElementById('compliance')) return 'FAIL Info has no compliance anchor to land on';
  return 'ok day 29 of 30, crit, opens Info';
})()`, true);
rows.push([String(visacard).startsWith('ok') ? 'PASS' : 'FAIL', 'Visa card · loud on exit day, and a door', String(visacard).slice(3, 56)]);

/* ①b THE NEXT HARD COMMITMENT. It was a 14.5 px row two thirds down the
   screen, under the day, the places and the bed — the one fact on Home with a
   clock attached to it, drawn quieter than the weather. Dec 21 is the case the
   trip provides: MU 733 out of Kunming at 13:50, its Trip.com reference, and a
   countdown. The reference must be COPYABLE, not decorative. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/today` });
await wait(2200);
const hero = await js(`(async()=>{
  const el=document.querySelector('.nexthero');
  if(!el) return 'FAIL no next-commitment element on VISA EXIT DAY';
  const txt=el.innerText.replace(/\\s+/g,' ').trim();
  if(!/MU ?733/i.test(txt)) return 'FAIL the flight number is not on it: "'+txt+'"';
  if(!/KMG/.test(txt)||!/HKG/.test(txt)) return 'FAIL the route is not on it: "'+txt+'"';
  if(!/13:50/.test(txt)) return 'FAIL the departure clock is not on it: "'+txt+'"';
  const code=el.querySelector('.nhcodeval');
  if(!code) return 'FAIL the booking reference has no strip';
  /* The booking's OWN reference, matched by shape rather than reprinted here:
     a Trip.com order is a 16-digit serial, and a rehearsal file is no place to
     keep a second copy of a live confirmation number. */
  if(!/^\\d{16}$/.test(code.textContent.trim())) return 'FAIL the reference reads "'+code.textContent.trim()+'"';
  if(code.tagName!=='BUTTON') return 'FAIL the reference is not copyable';
  if(!/tap to copy/i.test(txt)) return 'FAIL nothing says the reference can be copied';
  const main=el.querySelector('.nhmain');
  if(!main) return 'FAIL the element does not open anything';
  main.click(); await new Promise(r=>setTimeout(r,1000));
  if(!/\\/wallet\\/cn26-flight-mu733$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  return 'ok MU 733 · KMG → HKG · ref + deep link';
})()`, true);
rows.push([String(hero).startsWith('ok') ? 'PASS' : 'FAIL', 'Next commitment · the hero says it all', String(hero).slice(3, 56)]);

/* THE COUNTDOWN, AND THE SHAPE OF IT. Minute granularity, no seconds, gold and
   tabular so the digits do not shuffle the line sideways every sixty seconds.
   A previewed day counts from ITS OWN 00:00 — a day you are not living has no
   "now" inside it — so on Dec 21 the 13:50 departure is exactly 13 h 50 m out,
   every time this runs, at any hour of the real day. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-21#/trip/cn26/today` });
await wait(2200);
const countdown = await js(`(()=>{
  const el=document.querySelector('.nexthero .nhcount');
  if(!el) return 'FAIL the next commitment carries no countdown';
  const txt=el.innerText.trim();
  if(!/^in 13 h 50 m$/.test(txt)) return 'FAIL the countdown reads "'+txt+'"';
  if(/\\d+ ?s\\b/.test(txt)) return 'FAIL it is counting seconds';
  const cs=getComputedStyle(el);
  if(parseFloat(cs.fontSize)<24) return 'FAIL the countdown is '+cs.fontSize+' — not the loudest number';
  if(!/tabular-nums/.test(cs.fontVariantNumeric)) return 'FAIL the digits are not tabular';
  return 'ok '+txt;
})()`);
rows.push([String(countdown).startsWith('ok') ? 'PASS' : 'FAIL', 'Countdown · minutes, never seconds', String(countdown).slice(3, 56)]);

/* THE RUNBOOK ROW IS THE TARGET NOW, not a 30 px square with dead text beside
   it. Tasks has carried the 44 px invisible ring since Phase 2 and Today never
   got it, on the two days it matters most — departure and VISA EXIT DAY, in a
   queue, one-handed, with cold fingers. The box is a real checkbox inside a
   <label>, so the step text toggles it; this ticks by clicking the TEXT, which
   is the half that used to do nothing, and puts it back. */
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
await S('Page.navigate', { url: `${BASE}?d=2026-11-22#/trip/cn26/today` });
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
  if(!/\\/wallet\\/cn26-stay-12$/.test(location.hash)) return 'FAIL it went to '+location.hash;
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
   training-day template rather than by a written day — and NOV 22 ABOVE MUST
   STAY CRIT, which is what proves the app can still tell a held bed from an
   unbooked night rather than having simply gone quiet. */
await S('Page.navigate', { url: `${BASE}?d=2026-11-27#/trip/cn26/today` });
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
  if(!/\\/wallet\\/cn26-stay-11$/.test(location.hash)) return 'FAIL it went to '+location.hash;
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
await S('Page.navigate', { url: `${BASE}?d=2026-11-21#/trip/cn26/today` });
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
  if(!/\\/wallet\\/cn26-flight-ey888$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  return 'ok '+stamp.textContent.trim()+', opens EY 888';
})()`, true);
rows.push([String(airbed).startsWith('ok') ? 'PASS' : 'FAIL', 'A night in the air reads as transit', String(airbed).slice(3, 56)]);

/* And the same row on a night that IS booked still wears its real stamp and
   opens the card — the negative would pass vacuously otherwise. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-06#/trip/cn26/today` });
await wait(2200);
const bedlink = await js(`(async()=>{
  const row=document.querySelector('.bedrow');
  if(!row) return 'FAIL no tonight row on Dec 6';
  const stamp=row.querySelector('.stamp');
  if(!/booked/i.test(stamp?.textContent||'')) return 'FAIL Dec 6 stamp: "'+(stamp?.textContent||'').trim()+'"';
  const btn=row.querySelector('button.rowmain');
  if(!btn) return 'FAIL the booked bed row is still a dead div';
  btn.click(); await new Promise(r=>setTimeout(r,900));
  if(!/\\/wallet\\/cn26-stay-00$/.test(location.hash)) return 'FAIL it went to '+location.hash;
  return 'ok opens its own card';
})()`, true);
rows.push([String(bedlink).startsWith('ok') ? 'PASS' : 'FAIL', 'Tonight opens the bed it names', String(bedlink).slice(3, 56)]);

/* THE PHOTO CAPTION CARRIES THE DAY AND NOTHING ELSE. It used to read
   "DAY 29 OF 37 · TONIGHT: DALI YANYUAN MOUNTAIN RETREAT (BOOKED, ¥324)" —
   12.5 px of uppercase wrapping into the scrim at the bottom edge of the
   picture. Where you sleep is a row of its own, further down, at a size a bed
   name can be read at and with the stamp that says whether it is held. Dec 19
   is the longest bed label on the trip, which is why it is the day checked. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-19#/trip/cn26/today` });
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
await S('Page.navigate', { url: `${BASE}?d=2026-12-06#/trip/cn26/today` });
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
  return 'ok '+before+' → '+after;
})()`, true);
rows.push([String(stepping).startsWith('ok') ? 'PASS' : 'FAIL', 'Day stepping · ‹ › beside the title', String(stepping).slice(3, 56)]);

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

/* THE UPDATE BANNER USED TO EAT THREE OF THOSE FIVE TABS — and not only when
   it was showing. `translateY(120%)` is 120 % of the banner's OWN height, ~77
   px, nowhere near the ~160 px needed to leave the screen, so the HIDDEN
   banner parked itself on the tab pill at z-index 90 and swallowed taps for a
   state it was not even in. And `left: 50%` with no width made its box 50vw,
   which wrapped one line of text into two and doubled the height it did not
   clear. Both are asserted here: invisible when hidden, clear of the pill when
   shown, one line either way. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/today` });
await wait(2200);
const banner = await js(`(async()=>{
  const b=document.getElementById('sw-update');
  if(!b) return 'FAIL no update banner in the shell';
  const pill=document.querySelector('.tabbar .in');
  if(!pill) return 'FAIL no tab pill to measure against';
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
/* The to-do ring became the INLINE variant on 2026-08-12 — 56 px beside the
   header instead of 190 px above the list, because on this segment the blown
   booking windows are the point and a 0 % arc was pushing them past the fold.
   Its two smaller lines moved out of a circle they no longer fit in, so the
   selectors are `.ringwrap`, which matches both variants. Nothing is dropped:
   the same three numbers are still read and still have to agree. */
const todoring = await js(`(async()=>{
  [...document.querySelectorAll('.seg button')].find(b=>/To do/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,1600));
  const pct=document.querySelector('.ring .pct')?.textContent||'';
  const count=document.querySelector('.ringwrap .pcount')?.textContent||'';
  const lab=document.querySelector('.ringwrap .plab')?.textContent||'';
  /* it is the small one here, and the big one is reserved for packing */
  const w=document.querySelector('.ring')?.getBoundingClientRect().width||0;
  if(w>90) return 'FAIL the to-do ring is still '+Math.round(w)+' px wide';
  const m=/^([0-9]+)[/]([0-9]+)$/.exec(count);
  if(!m) return 'FAIL count '+count;
  if(lab!=='done') return 'FAIL label '+lab;
  const rows=document.querySelectorAll('.tasklist li').length;
  const ticked=document.querySelectorAll('.tasklist li.done').length;
  if(Number(m[2])!==rows) return 'FAIL total '+m[2]+' vs '+rows+' rows';
  if(Number(m[1])!==ticked) return 'FAIL done '+m[1]+' vs '+ticked+' ticked';
  /* 25 → 24 on 2026-08-06: the insurance task closed once the policy was
     bought. Its unanswered question moved to the wallet card, not to nowhere.
     24 → 25 on 2026-08-11: the kunyu-arrival task. The academy's own words are
     "without the insurance, the students can not join the training" — and they
     want it on paper. A bought policy reads as a closed item; an unprinted one
     costs the fortnight, so it gets a row of its own.
     25 → 26 on 2026-08-12: the yantai-bed task. The academy takes arrivals
     Mon/Tue/Wed only, so Sun 22 Nov became a night in Yantai city — a twelfth
     bed on a trip whose booking list had been declared finished.
     27 -> 28 on 2026-09-27, the review run: four closed (hotel-beijing,
     hotels-mainland, hkjc, hk-xmas) and five opened (late-arrivals, esim,
     tianmen-recheck, psb, ngong-ping). 28 -> 27 later the same evening:
     lijiang-bagtransfer closed (Yue Tu has no contact for Tina's Inn either;
     the owner arranges the gorge bag himself, Option B — a packing note, not
     a task).
     27 -> 23 on 2026-09-28: the academy answered and four closed —
     yantai-flights (CA1560 booked), yantai-bed (the Muping night booked), psb
     (the school registers you) and late-arrivals (both hotels told 27 Sep).
     23 -> 24 later the same day: cash-plan — the owner's decision against any
     ATM withdrawal in China, due 2026-10-12.
     24 -> 25 on 2026-09-29: kunyu-email is reworded, not closed (the Dec 5
     driver's price and the Nov 28 class time are both told after arrival, not
     chased by email); +1 opened: muping-late-arrival, checking the 29 Sep
     late-arrival request against the Trip.com order. */
  if(rows!==25) return 'FAIL '+rows+' tasks, China seeds 25';
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
  const read=()=>document.querySelector('.ringwrap .pcount')?.textContent||'';
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

/* THE PLANS LIST GREW A BUTTON, 2026-07-28. Until then Itinerary.svelte did not
   import MapButtons at all: the one screen that lists every city you are going
   to was the only place-bearing surface in the app with no way to open one, and
   getting directions to Chongqing meant opening Chongqing's page first.

   Ten pills, one per real stop, and ELEVEN STOPS. The eleventh is
   cn26-stop-flights — "International flights" is a phase of the trip, not
   somewhere you go — and it must render nothing. That is asserted directly
   rather than left to the absence of a coordinate, because the guard in the
   component is on the stop's KIND. */
const planmaps = await js(`(()=>{
  const cards=[...document.querySelectorAll('details.stop')];
  /* TEN since 2026-08-12, not eleven: the transit pseudo-stop stopped rendering
     when the connectors arrived, because it was always a move and never a place.
     Ten cities, and the journeys between them drawn as their own cards. */
  if(cards.length!==10) return 'FAIL '+cards.length+' stop cards, expected 10';
  const pills=[...document.querySelectorAll('.stopmaps .mapbtn')];
  if(pills.length!==10) return 'FAIL '+pills.length+' pills, expected 10 (one per real stop)';
  /* THE TRANSIT PSEUDO-STOP NO LONGER RENDERS AT ALL, since 2026-08-12. It was
     never a place — "International flights" is a phase of the trip — and once
     the moves between cities went on this page it became two of them, the
     arrival connector at the top and the departure connector at the bottom.
     This used to assert it grew no map button; that would now pass vacuously,
     so it asserts the stronger thing: the entry is gone from the spine. It is
     still in the DATA, as the record of one booking across four legs and their
     shared price, which is why this checks the rendering and not the seed. */
  if(document.querySelectorAll('details.transit').length) return 'FAIL the transit pseudo-stop is still drawn as a stop';
  /* One button per group, exactly as everywhere else — never the old pair. */
  const groups=[...document.querySelectorAll('.stopmaps .maps')];
  if(groups.some(g=>g.querySelectorAll('button').length!==1)) return 'FAIL a stop pill holds more than one button';
  /* It is the gold "Open in Maps" pill the city guide's hero already uses, not
     a second dialect for the same action. */
  if(!pills.every(b=>/Open in Maps/i.test(b.textContent))) return 'FAIL a stop pill is not the guide pill';
  /* And it opens the STOP's own verified search — Beijing by name and city,
     which is the same string the city page sends. */
  const bj=pills.map(b=>b.getAttribute('data-geo')||'').filter(g=>g.includes(encodeURIComponent('Beijing China')));
  if(!bj.length) return 'FAIL no stop pill opens Beijing by name';
  /* Nine send a geo: search; the gorge sends the owner's saved share link, and
     a share link is not a geo: URI — geo.ts returns null for it on purpose. */
  const geos=pills.map(b=>b.getAttribute('data-geo')||'').filter(g=>g.startsWith('geo:'));
  if(geos.length!==9) return 'FAIL '+geos.length+' pills fire a geo: intent, expected 9 + the gorge share link';
  return 'ok 10 pills, 0 on the flights entry';
})()`);
/* HOW YOU GET FROM ONE CITY TO THE NEXT — the connectors, new 2026-08-12.
   The Plans page used to list where you sleep and say nothing about the moves
   between. Three things have to hold: every join draws, a join with NOTHING
   booked says so rather than rendering blank, and a two-part move prints its
   parts in the order you travel them. That last one is the reason this check
   exists — the first build put "fly, then take the train to the airport". */
const conns = await js(`(async()=>{
  const rows=[...document.querySelectorAll('.conn')];
  if(rows.length<10) return 'FAIL only '+rows.length+' connectors drawn';
  const txt=rows.map(r=>r.innerText.replace(/\s+/g,' '));
  /* Dec 5 Yantai → Beijing WAS the one join with neither a flight nor a train.
     CA1560 was booked on 2026-09-28, so no join on the trip is a gap any more;
     the gap rendering is proved on the pre-28 Sep trip further down. */
  const gap=rows.filter(r=>r.classList.contains('gap'));
  if(gap.length!==0) return 'FAIL '+gap.length+' gap connectors, expected none since CA1560 was booked';
  if(!txt.some(t=>/CA ?1560/.test(t))) return 'FAIL the Dec 5 connector does not carry CA1560';
  /* Dec 11 is a train to Qinghe and THEN CA8609 from Daxing — both parts, that
     order. (CA1953 until 2026-09-27, when Air China retimed it.) */
  const two=txt.find(t=>/Taizicheng/.test(t)&&/CA ?8609/.test(t));
  if(!two) return 'FAIL the Dec 11 two-part move is not one connector';
  if(/CA ?1953/.test(two)) return 'FAIL Dec 11 still shows the retimed CA1953';
  if(two.indexOf('Taizicheng')>two.indexOf('CA 8609')) return 'FAIL Dec 11 puts the flight before the train that feeds it';
  if(!/then/i.test(two)) return 'FAIL the two-part move does not say "then"';
  /* Nov 22 is a flight OR the HSR — offered, never counted as a second hop.
     CA8683 was retimed free onto CA8641 (PKX 15:00 -> YNT 16:20) on
     2026-09-29; same Trip.com order, so the connector now carries CA8641. */
  const alt=txt.find(t=>/CA ?8641/.test(t));
  /* The fallback renders as its own .calt button on the CA8641 connector —
     asserted on the DOM rather than by finding the word "or" in innerText,
     because that was matching the separator and not the offer. */
  const alti=txt.findIndex(t=>/CA ?8641/.test(t));
  if(alti<0) return 'FAIL no connector carries CA8641';
  if(!rows[alti].querySelector('.calt')) return 'FAIL the Nov 22 fallback is not offered as an alternative';
  /* Three legs, in the order you fly them: TLV, Abu Dhabi, then Yantai. */
  const first=[...rows[alti].querySelectorAll('.cleg:not(.calt) .ctitle')].map(e=>e.textContent.trim());
  if(first.length!==3) return 'FAIL arrival connector has '+first.length+' legs, expected 3';
  if(!/EY ?608/.test(first[0])||!/CA ?8641/.test(first[2])) return 'FAIL arrival legs out of order';
  /* The two road legs finally have somewhere to appear. */
  if(!txt.some(t=>/Qiaotou/.test(t))) return 'FAIL the gorge bus is still invisible';
  if(!txt.some(t=>/Shared car/i.test(t))) return 'FAIL the shared car is still invisible';
  return 'ok '+rows.length+' connectors, 0 gaps, 2-part in order';
})()`, true);
rows.push([String(conns).startsWith('ok') ? 'PASS' : 'FAIL', 'Plans · how you get between cities', String(conns).slice(3, 56)]);

rows.push([String(planmaps).startsWith('ok') ? 'PASS' : 'FAIL', 'Plans list · a pill per city, none on transit', String(planmaps).slice(0, 56)]);

/* IS ANY OF IT ACTUALLY BOOKED? — the coverage chips, new 2026-08-12. Plans
   showed where you sleep and how you get there and never once said whether it
   was HELD; a bedless night was drawn as nothing at all, and a blank is the one
   thing a traveller cannot check. Every band now carries one chip.

   THE CASE THIS EXISTS FOR IS NOV 22. The academy takes arrivals Mon/Tue/Wed
   only, so the Kunyu stop starts on the 23rd and the night on the ground in
   Yantai belonged to no stop window at all — a coverage model that walked stop
   windows would have called the one truly bedless night on the trip fine.
   textContent, not innerText: the chips are uppercased in CSS. */
const covers = await js(`(()=>{
  const cards=[...document.querySelectorAll('details.stop')];
  if(cards.length!==10) return 'FAIL '+cards.length+' stop cards, expected 10';
  const nameOf=(c)=>((c.querySelector('.nm')||{}).textContent||'').trim();
  const chipOf=(c)=>c.querySelector('summary .bchip');
  if(cards.some(c=>!chipOf(c))) return 'FAIL a stop band carries no booked chip';
  const find=(re)=>cards.find(c=>re.test(nameOf(c)));
  /* Nov 22 WAS the one night on this trip with no bed of any kind; the Muping
     night was booked on 2026-09-28 and CA1560 the same morning, so the Kunyu
     band now reads the way Hong Kong's does. The amber "bed missing" chip is
     proved on the pre-28 Sep trip further down. */
  const kunyu=find(/Kunyu/);
  if(!kunyu) return 'FAIL no Kunyu band';
  const kt=chipOf(kunyu).textContent.trim();
  if(!/all booked/i.test(kt)) return 'FAIL Kunyu chip reads "'+kt+'", expected all booked since 28 Sep';
  if(!chipOf(kunyu).classList.contains('t-ok')) return 'FAIL the fully booked Kunyu leg is not drawn ok';
  /* The academy fortnight IS booked since 12 Aug — twelve nights that must
     never be counted as holes just because the card carries no price. */
  if(/12 beds|13 beds/i.test(kt)) return 'FAIL the held fortnight is being counted as missing';
  /* Hong Kong: five booked nights, a booked flight in and a booked flight out. */
  const hk=find(/Hong Kong/);
  if(!hk) return 'FAIL no Hong Kong band';
  const ht=chipOf(hk).textContent.trim();
  if(!/all booked/i.test(ht)) return 'FAIL Hong Kong chip reads "'+ht+'"';
  if(!chipOf(hk).classList.contains('t-ok')) return 'FAIL Hong Kong is fully booked and not drawn ok';
  /* Dec 5, Yantai to Beijing: CA1560, booked 28 Sep — no longer a gap. */
  const bj=find(/Beijing/);
  if(/move unbooked|bed missing/i.test(chipOf(bj).textContent)) return 'FAIL Beijing still names a gap: "'+chipOf(bj).textContent.trim()+'"';
  /* THE WALK-UP LEGS ARE NOT GAPS. The early bus into the gorge and the shared
     car out of it are walk-up, no advance sale — their own cards say so. */
  const gorge=find(/Tiger Leaping/);
  const gt=chipOf(gorge).textContent.trim();
  if(!/pending/i.test(gt)) return 'FAIL the gorge chip reads "'+gt+'", expected pending';
  if(/missing|unbooked/i.test(gt)) return 'FAIL the walk-up road legs are being called gaps';
  /* THE BAND'S TOP CORNER NOW HOLDS THREE THINGS on a 412 px phone — the chip,
     the nights pill and the chevron — and it is anchored to the right edge, so
     anything too wide grows LEFT off the card instead of wrapping visibly. */
  const top=kunyu.querySelector('.bandtop').getBoundingClientRect();
  const card=kunyu.getBoundingClientRect();
  if(top.left<card.left+4) return 'FAIL the band corner overflows the card by '+Math.round(card.left-top.left)+' px';
  if(top.height>30) return 'FAIL the band corner wrapped to '+Math.round(top.height)+' px';
  /* The detail, inside the card, now names no hole — it did until 28 Sep. */
  const list=(kunyu.querySelector('.cover')||{}).textContent||'';
  if(/no bed booked|nothing booked yet/i.test(list)) return 'FAIL the Kunyu card still names a hole: '+list.slice(0,60);
  return 'ok '+kt+' / '+ht+' / gorge '+gt;
})()`);
rows.push([String(covers).startsWith('ok') ? 'PASS' : 'FAIL', 'Plans · is each stop actually booked', String(covers).slice(3, 56)]);

/* THE TRIP AS IT STOOD BEFORE 28 SEP 2026 — the states the real trip no longer
   has. Nov 22 had no bed and Dec 5 no move until the Muping night
   (cn26-stay-12) and CA1560 (cn26-flight-ca1560) were booked that morning, and
   the three renderings built for those holes — the crit NO BOOKING ON FILE
   stamp, the amber "bed missing" band with its dated detail, and the gap
   connector that says so — would otherwise go untested. So: take the two
   records out of IndexedDB, reload, check all three, put them back
   byte-for-byte, reload, and prove the trip reads booked again. */
const held = await js(`(async()=>{
  const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
  const st=db.transaction('bookings','readwrite').objectStore('bookings');
  const out=[];
  for(const id of ['cn26-stay-12','cn26-flight-ca1560']){
    const rec=await new Promise(r=>{const q=st.get(id);q.onsuccess=()=>r(q.result)});
    if(!rec) { db.close(); return 'FAIL '+id+' is not in the vault'; }
    out.push(rec);
    await new Promise(r=>{const q=st.delete(id);q.onsuccess=()=>r()});
  }
  db.close();
  return JSON.stringify(out);
})()`, true);
if (!String(held).startsWith('[')) {
  rows.push(['FAIL', 'Before 28 Sep · the two bookings could be set aside', String(held).slice(0, 56)]);
} else {
  await S('Page.navigate', { url: `${BASE}?d=2026-11-22#/trip/cn26/today` });
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
  await S('Page.navigate', { url: `${BASE}?d=2026-12-14#/trip/cn26/itinerary` });
  await wait(2200);
  const wasGap = await js(`(()=>{
    const cards=[...document.querySelectorAll('details.stop')];
    const nameOf=(c)=>((c.querySelector('.nm')||{}).textContent||'').trim();
    const chipOf=(c)=>c.querySelector('summary .bchip');
    const kunyu=cards.find(c=>/Kunyu/.test(nameOf(c)));
    if(!kunyu) return 'FAIL no Kunyu band';
    const kt=chipOf(kunyu).textContent.trim();
    if(!/bed missing/i.test(kt)) return 'FAIL Kunyu chip reads "'+kt+'", expected the missing bed';
    if(!chipOf(kunyu).classList.contains('t-warn')) return 'FAIL the Yantai chip is not amber';
    if(/12 beds|13 beds/i.test(kt)) return 'FAIL the held fortnight is being counted as missing';
    const list=(kunyu.querySelector('.cover')||{}).textContent||'';
    if(!/no bed booked/i.test(list)) return 'FAIL the Kunyu card does not name the bedless night';
    if(!/22 Nov/.test(list)) return 'FAIL the bedless night is not dated';
    if(!/nothing booked yet/i.test(list)) return 'FAIL the Dec 5 gap is missing from the detail';
    const bj=cards.find(c=>/Beijing/.test(nameOf(c)));
    if(!/move unbooked/i.test(chipOf(bj).textContent)) return 'FAIL Beijing does not name the Dec 5 gap';
    const gap=[...document.querySelectorAll('.conn')].filter(r=>r.classList.contains('gap'));
    if(gap.length!==1) return 'FAIL '+gap.length+' gap connectors, expected exactly 1 (Dec 5)';
    if(!/No flight and no train booked/i.test(gap[0].innerText)) return 'FAIL the gap does not say it is a gap';
    return 'ok '+kt+' / Beijing move unbooked / 1 gap';
  })()`);
  rows.push([String(wasGap).startsWith('ok') ? 'PASS' : 'FAIL', 'Before 28 Sep · the hole and the gap are drawn', String(wasGap).slice(3, 56)]);
  const restored = await js(`(async()=>{
    const recs=${held};
    const o=indexedDB.open('livingthedream'); const db=await new Promise(r=>{o.onsuccess=()=>r(o.result)});
    const st=db.transaction('bookings','readwrite').objectStore('bookings');
    for(const rec of recs) await new Promise(r=>{const q=st.put(rec);q.onsuccess=()=>r()});
    const back=await Promise.all(['cn26-stay-12','cn26-flight-ca1560'].map(id=>new Promise(r=>{const q=st.get(id);q.onsuccess=()=>r(q.result)})));
    db.close();
    return back.every(Boolean) ? 'ok' : 'FAIL a booking did not come back';
  })()`, true);
  await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/itinerary` });
  await wait(2200);
  const booked28 = await js(`(()=>{
    const cards=[...document.querySelectorAll('details.stop')];
    const kunyu=cards.find(c=>/Kunyu/.test(((c.querySelector('.nm')||{}).textContent||'')));
    const kt=(kunyu?.querySelector('summary .bchip')?.textContent||'').trim();
    return /all booked/i.test(kt) ? 'ok '+kt : 'FAIL Kunyu reads "'+kt+'" after the restore';
  })()`);
  const ok = String(restored).startsWith('ok') && String(booked28).startsWith('ok');
  rows.push([ok ? 'PASS' : 'FAIL', 'Before 28 Sep · both bookings restored', ok ? '' : (String(restored) + ' / ' + String(booked28)).slice(0, 56)]);
}

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

/* THE GUIDE'S JUMP BAR, new 2026-08-12. This is the longest page in the app —
   Zhangjiajie runs to ~11,800 px — and the Dead-hour question ("three free
   hours, what is worth doing?") is answered by the spot grid roughly fourteen
   thumb flicks down it. Info's own 44 px chips already solved this on an even
   longer page, so this is that pattern reused, plus a thumb-zone way back up.
   Still on the Beijing page. */
const guidejump = await js(`(async()=>{
  const chips=[...document.querySelectorAll('.jumpbar .jchip')];
  if(chips.length<4) return 'FAIL only '+chips.length+' jump chips on the longest page in the app';
  const small=chips.filter(c=>c.getBoundingClientRect().height<44);
  if(small.length) return 'FAIL '+small.length+' jump chip(s) under 44 px';
  const labels=chips.map(c=>c.textContent.trim());
  for(const want of ['Getting there','Day by day','Eat & see']){
    if(!labels.includes(want)) return 'FAIL no "'+want+'" chip — saw ['+labels.join('|')+']';
  }
  /* it really moves the page, and it moves it to the section it names */
  window.scrollTo(0,0); await new Promise(r=>setTimeout(r,300));
  chips[chips.length-1].click(); await new Promise(r=>setTimeout(r,1400));
  if(window.scrollY<400) return 'FAIL the last chip barely moved the page: '+Math.round(window.scrollY);
  const eat=document.getElementById('g-eat');
  if(!eat) return 'FAIL there is no eat & see section to land on';
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
   flashbangs a dark-adapted eye at 22:00. The look survives where it earns its
   keep — the torn stock on the SHORT block, the typewriter headings, the
   script title — and the long read moved to the app's own face on dark ground.
   Both halves are asserted, because either one alone is the bug back. */
const guideprose = await js(`(async()=>{
  window.scrollTo(0,0); await new Promise(r=>setTimeout(r,300));
  const story=document.getElementById('g-about');
  if(!story) return 'FAIL no story panel on the Beijing guide';
  const cs=getComputedStyle(story);
  if(/Special Elite/i.test(cs.fontFamily)) return 'FAIL the long read is still typewriter';
  if(!/Instrument Sans/i.test(cs.fontFamily)) return 'FAIL the long read is in '+cs.fontFamily;
  if(parseFloat(cs.fontSize)<16) return 'FAIL the long read is '+cs.fontSize;
  if(parseFloat(cs.lineHeight)/parseFloat(cs.fontSize)<1.5) return 'FAIL leading is '+cs.lineHeight;
  /* it left the cream: a near-white ground is the thing being fixed */
  const bg=cs.backgroundColor.match(/\\d+/g).map(Number);
  if(bg[0]>120) return 'FAIL the long read is still on cream: '+cs.backgroundColor;
  /* the heading kept the guide's voice */
  const h=getComputedStyle(story.querySelector('h3'));
  if(!/Special Elite/i.test(h.fontFamily)) return 'FAIL the story heading lost the typewriter';
  /* and the SHORT block kept the paper */
  const there=document.getElementById('g-there');
  if(!there) return 'FAIL no getting-there block';
  const tb=getComputedStyle(there).backgroundColor.match(/\\d+/g).map(Number);
  if(tb[0]<200) return 'FAIL the short block lost its cream stock: '+tb.join(',');
  return 'ok story '+cs.fontSize+' on rgb('+bg.slice(0,3).join(',')+'), paper kept for the short block';
})()`, true);
rows.push([String(guideprose).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · the long read is legible at night', String(guideprose).slice(3, 56)]);

/* THE TYPE LADDER HOLDS, new 2026-08-12 (Gap D item 2). Before this run the
   app rendered 45 distinct sizes, 192 of them crowded between 8.5 and 15.5 px,
   and text as small as 8.5 px. Six rungs now, and nothing between them. The
   walk sweeps four real screens rather than reading the CSS, so a size that
   creeps back in through an inline style or a third-party node is caught too.
   The named off-ladder sizes are the driver card (§RULES 4: it is read at
   arm's length by a stranger) and the decorative scene glyphs. */
const LADDER_SWEEP = [
  ['Home', '?d=2026-12-19#/trip/cn26/today'],
  ['the guide', '#/trip/cn26/itinerary/cn26-stop-beijing'],
  ['Wallet', '#/trip/cn26/wallet'],
  ['Info', '#/trip/cn26/info'],
];
const offenders = [];
for (const [name, route] of LADDER_SWEEP) {
  await S('Page.navigate', { url: `${BASE}${route}` });
  await wait(2000);
  const bad = await js(`(()=>{
    const RUNGS=[11,13,16,20,28,40];
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
  : 'ok 4 screens, every rendered size on 11/13/16/20/28/40';
rows.push([ladder.startsWith('ok') ? 'PASS' : 'FAIL', 'Type ladder · six rungs, nothing between', String(ladder).slice(3, 56)]);
/* THE SWEEP WALKED AWAY FROM THE GUIDE, and the next four checks are still
   standing on it. Put the page back before handing it on — a check that
   silently inherits the wrong route is how "0 spots" gets read as a defect in
   the spot grid instead of a defect in this file. */
await S('Page.navigate', { url: `${BASE}#/trip/cn26/itinerary/cn26-stop-beijing` });
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
await check('City guide · booked items + prices', `${BASE}?d=2026-12-15#/trip/cn26/itinerary/cn26-stop-zhangjiajie`,
  ['CA 8609', 'PKX → DYG', '$241', 'Booked for this stop', 'Pullman Zhangjiajie', '$124',
   'Huatian Grand Hotel', '$59', 'Park pass', '¥165', 'hotels', '$183 (both booked)']);

/* THE VISA-EXIT STOP. Dec 20 is a runbook day, so Home draws "Travel-day
   basics" instead of the plan items — this page is where the exit night is
   actually read. Three facts have to be on it: the bed is booked and PAID, the
   free airport transfer that puts you at the terminal is itemised on the order,
   and the order reads CONFIRMED — it was accepted on 29 Jul after two days
   paid-but-unaccepted, and the old warning must not survive the fact. */
await check('City guide · the exit night, paid and confirmed', `${BASE}?d=2026-12-15#/trip/cn26/itinerary/cn26-stop-kunming`,
  ['Ibis Kunming Changshui', '$25.73', 'free airport transfer', 'CONFIRMED', '23:00 Dec 17']);
/* THE ACADEMY'S OWN CITY PAGE, the second screen this record has to be true on
   (2026-08-12). "Booked for this stop" listed the Yantai flight and NO bed for
   the twelve nights the whole stop exists for. The bed is there now, stamped —
   and PRICED since 2026-08-13, where for a month the guide said in its own
   words that no price was recorded. It said that because none existed; it says
   $840 now because the school wrote one. The check follows the fact both ways:
   the figure has to be on the page AND the honest placeholder has to be gone,
   or a stale "price not recorded" would sit beside a real price. */
await check('City guide · the academy fortnight is held, and priced', `${BASE}?d=2026-11-27#/trip/cn26/itinerary/cn26-stop-kunyu`,
  ['Kunyu Mountain Shaolin Kung Fu Academy', 'Booked', '$840']);
const guidePriceless = await js(`document.body.innerText.toLowerCase().includes('price not recorded')`);
rows.push([guidePriceless === false ? 'PASS' : 'FAIL', 'City guide · no bed on this stop is priceless any more', guidePriceless === false ? '' : 'a "price not recorded" line survived the $840']);
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
    'element chongli','$233','$232.95 (2n)',
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
    /* 'ca 8609' — the Dec 11 flight, CA 1953 until the free change of
       2026-09-27. Same order, same $241. 'ca 8641' — the Nov 22 flight,
       CA 8683 until the free retime of 2026-09-29. Same order, same $117.30. */
    'ca 8641','$117','ca 1560','$110','ca 8609','$241','3u 8011','$230','mu 733','$293',
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
    'counted so far','$6,535',
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
    'of a $9,000 budget','20 items have no price yet',
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
  if(/not priced/i.test(stayRow)) return 'FAIL a bed lost its price — stays group tally: "'+stayRow+'"';
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
  if(!/10 not priced/i.test(travelRow)) return 'FAIL travel group tally: "'+travelRow+'"';
  if(!/10 not priced/i.test(expRow)) return 'FAIL experiences group tally: "'+expRow+'"';
  if(!altRow) return 'FAIL the either/or leg has no group of its own';
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

/* a row of that card opens the real ticket, in the segment it lives in */
const jump = await js(`(async()=>{
  /* the ledger closes itself when the segment is re-entered — open it again */
  const bk=document.querySelector('details.bk');
  if(bk && !bk.open){ bk.querySelector('summary').click(); await new Promise(r=>setTimeout(r,400)); }
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
  const want={"INT'L FLIGHTS":'$2,026','TRAINS\\\\+FLIGHTS':'$992','KUNYU TRAINING':'$100','LODGING':'$1,862','TICKETS\\\\+SHOWS':'$88','TOTAL SPENT':'$5,216'};
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
rows.push([String(driverKunyu).startsWith('ok') ? 'PASS' : 'FAIL', 'Info · the academy driver card, and no pin', String(driverKunyu).slice(0, 60)]);

/* THE JOURNEY OVERVIEW CARRIES THE SAME CHIPS as the Plans bands, and the map
   above them rings the same stations — one derivation (logic/coverage.ts) so
   the diagram and the list cannot disagree about what is held. The invariant is
   asserted rather than a count: whatever the owner books next, the number of
   ringed stations must keep matching the number of non-ok rows. */
const infocover = await js(`(()=>{
  const rows=[...document.querySelectorAll('.stoprows .srow')];
  if(rows.length!==10) return 'FAIL '+rows.length+' journey rows, expected 10';
  const chips=rows.map(r=>r.querySelector('.chip'));
  if(chips.some(c=>!c)) return 'FAIL a journey row carries no chip';
  const textOf=(r)=>((r.querySelector('.snm')||{}).textContent||'')+' :: '+r.querySelector('.chip').textContent;
  const kunyu=rows.map(textOf).find(t=>/Kunyu/.test(t));
  /* The Yantai row carried "bed missing" until the Muping night and CA1560 were booked on 2026-09-28. */
  if(!kunyu||!/all booked/i.test(kunyu)) return 'FAIL the Kunyu row is not all booked since 28 Sep: '+kunyu;
  const hk=rows.map(textOf).find(t=>/Hong Kong/.test(t));
  if(!hk||!/all booked/i.test(hk)) return 'FAIL the Hong Kong row is not all booked: '+hk;
  const gs=[...document.querySelectorAll('.mapwrap svg g')];
  const flagged=gs.filter(g=>g.querySelector('circle.flag')).length;
  const amber=rows.filter(r=>!r.querySelector('.chip.ok')).length;
  if(!flagged) return 'FAIL the route map rings no station at all';
  if(flagged!==amber) return 'FAIL the map rings '+flagged+' stations and the rows flag '+amber;
  const hkg=gs.find(g=>/Hong Kong/.test(((g.querySelector('text.nm')||{}).textContent||'')));
  if(!hkg) return 'FAIL Hong Kong is not on the map';
  if(hkg.querySelector('circle.flag')) return 'FAIL Hong Kong is fully booked and still ringed';
  /* The diagram stays a diagram: the ring adds no word to it. */
  if(gs.some(g=>g.querySelectorAll('text').length>2)) return 'FAIL a station grew a third label';
  return 'ok 10 rows, '+flagged+' stations ringed, Hong Kong clean';
})()`);
rows.push([String(infocover).startsWith('ok') ? 'PASS' : 'FAIL', 'Info · journey rows + ringed stations', String(infocover).slice(3, 56)]);

/* THE THREE CLOCKS FIT WITHOUT A SWIPE, new 2026-08-12 (Gap D). The rail has
   always scrolled, but the trip's own three zones overflowed it by four pixels,
   so ABU DHABI read as cut off rather than as swipeable — and the type ladder
   would have widened that to twenty-two. It is padding, not point size: the
   dial is as wide as its LABEL. Asserted against the rail, not a magic number,
   so a fourth zone is allowed to scroll and these three are not. */
const clocks = await js(`(()=>{
  const rail=document.querySelector('#clocks .clocks');
  if(!rail) return 'FAIL no clock rail on Info';
  const dials=[...rail.querySelectorAll('.clock')];
  if(dials.length!==3) return 'FAIL '+dials.length+' dials, expected 3';
  if(rail.scrollWidth>rail.clientWidth+1)
    return 'FAIL the three clocks need a swipe: '+rail.scrollWidth+' in '+rail.clientWidth;
  const num=parseFloat(getComputedStyle(dials[0].querySelector('.clocknum')).fontSize);
  if(num<20) return 'FAIL the clock face shrank to '+num+' px to make room';
  return 'ok 3 dials in '+rail.clientWidth+' px, faces at '+num+' px';
})()`);
rows.push([String(clocks).startsWith('ok') ? 'PASS' : 'FAIL', 'Info · three clocks, no swipe needed', String(clocks).slice(3, 56)]);

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
     CA1560 with it: YNT has no verified card, so the flight opens nothing. */
  const mute=['cn26-stay-01','cn26-stay-11','cn26-stay-12','cn26-flight-ca1560'].filter(id=>btns(id).length!==0);
  if(mute.length) return 'FAIL unverified bed or airport has a button: '+mute.join(',');
  const hu=btns('cn26-stay-04');
  if(hu.length!==1) return 'FAIL Huatian buttons '+hu.length;
  const hgeo=hu[0].getAttribute('data-geo')||'';
  if(hgeo!=='geo:0,0?q='+encodeURIComponent('华天大酒店 张家界')) return 'FAIL Huatian geo '+hgeo.slice(0,90);
  if(/29\.11|110\.47/.test(hgeo)) return 'FAIL a coordinate reached the map for a bed: '+hgeo.slice(0,60);
  seg(/Travel/).click(); await new Promise(r=>setTimeout(r,800));
  /* The Dec 11 flight keeps its order's id (cn26-flight-ca1953) but is CA8609
     from DAXING since 2026-09-27 — its one button must open PKX, never Capital. */
  const ca=btns('cn26-flight-ca1953');
  if(ca.length!==1) return 'FAIL CA8609 buttons '+ca.length;
  const ageo=ca[0].getAttribute('data-geo')||'';
  if(!ageo.startsWith('geo:0,0?q='+encodeURIComponent('北京大兴国际机场'))) return 'FAIL flight geo '+ageo.slice(0,50);
  return 'ok';
})()`, true);
rows.push([bookmaps === 'ok' ? 'PASS' : 'FAIL', 'Bookings · one button, right place', String(bookmaps).slice(0, 55)]);

/* THE FIVE RAIL CARDS, new on 2026-07-28 — and the check is as much about the
   buttons that are NOT there as the ones that are.

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
  const seg=(re)=>[...document.querySelectorAll('.seg button')].find(b=>re.test(b.textContent));
  seg(/Travel/).click(); await new Promise(r=>setTimeout(r,800));
  const card=(id)=>document.getElementById('bk-cn26-train-'+id);
  const ids=['nov22','dec09','dec11','dec14','dec20'];
  const missing=ids.filter(i=>!card(i));
  if(missing.length) return 'FAIL no card for: '+missing.join(',');
  /* Nothing is booked, and every card has to keep saying so. */
  const notPending=ids.filter(i=>!/Pending/i.test(card(i).querySelector('.stamp')?.textContent||''));
  if(notPending.length) return 'FAIL not stamped pending: '+notPending.join(',');
  const geos=(i)=>[...card(i).querySelectorAll('.maps button')].map(b=>b.getAttribute('data-geo')||'');
  /* Dec 9 · TWO stations at the departure end, one at the arrival. */
  const d9=geos('dec09');
  if(d9.length!==3) return 'FAIL Dec 9 buttons '+d9.length+', expected 3';
  const want9=['北京北站 北京','清河站 北京','太子城站 张家口'];
  for(let k=0;k<3;k++){
    if(d9[k]!=='geo:0,0?q='+encodeURIComponent(want9[k])) return 'FAIL Dec 9 button '+k+': '+d9[k].slice(0,60);
  }
  /* Dec 14 · one button (张家界西站) and an arrival that says why it has none. */
  const d14=geos('dec14');
  if(d14.length!==1) return 'FAIL Dec 14 buttons '+d14.length+', expected 1';
  if(d14[0]!=='geo:0,0?q='+encodeURIComponent('张家界西站 张家界')) return 'FAIL Dec 14 geo '+d14[0].slice(0,60);
  const t14=card('dec14').innerText;
  if(!/重庆北/.test(t14)||!/重庆西/.test(t14)) return 'FAIL Dec 14 does not name the two it refuses to choose between';
  /* …and neither of them may be openable from the card. */
  if(d14.some(g=>/%E9%87%8D%E5%BA%86/.test(g))) return 'FAIL a Chongqing station got a button after all';
  /* Dec 11 · both ends open since 2026-09-27: 太子城站 out, 清河站 in — the
     same Qinghe the Dec 9 card opens. It was "back to Beijing", no button. */
  const d11=geos('dec11');
  const want11=['太子城站 张家口','清河站 北京'];
  if(d11.length!==2) return 'FAIL Dec 11 buttons '+d11.length+', expected 2';
  for(let k=0;k<2;k++){
    if(d11[k]!=='geo:0,0?q='+encodeURIComponent(want11[k])) return 'FAIL Dec 11 button '+k+': '+d11[k].slice(0,60);
  }
  if(!/Daxing/.test(card('dec11').innerText)||/NOT Daxing/i.test(card('dec11').innerText)) return 'FAIL Dec 11 rail card does not send you on to Daxing';
  /* Dec 20 · the visa-critical one: Kunming South opens, Dali does not. */
  const d20=geos('dec20');
  if(d20.length!==1) return 'FAIL Dec 20 buttons '+d20.length+', expected 1';
  if(d20[0]!=='geo:0,0?q='+encodeURIComponent('昆明南站 昆明')) return 'FAIL Dec 20 geo '+d20[0].slice(0,60);
  if(!/Xiaguan/i.test(card('dec20').innerText)) return 'FAIL Dec 20 does not say why the Dali end has no button';
  /* Nine buttons across the five cards, and not one more (eight until Dec 11
     named Qinghe on 2026-09-27). */
  const total=ids.reduce((n,i)=>n+geos(i).length,0);
  if(total!==9) return 'FAIL '+total+' station buttons across the five legs, expected 9';
  /* The documented fares stay ON the card, as chips — they are estimates for
     tickets nobody has bought, so they must be visible here and absent from the
     money screen's committed total (which the Money check holds at $5,356). */
  if(!/¥90/.test(card('dec09').innerText)) return 'FAIL the ~¥90 the plan quotes is not on the Dec 9 card';
  /* And the one that must not slip: Dec 20 is the visa exit leg. */
  if(!/visa/i.test(card('dec20').innerText)) return 'FAIL Dec 20 does not say it is the visa leg';
  return 'ok 5 legs, 9 buttons, 3 ends that say why they have none';
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
const experiences = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const seg=[...document.querySelectorAll('.seg button')];
  const tab=seg.find(b=>/Experiences/.test(b.textContent));
  if(!tab) return 'FAIL no Experiences segment — saw ['+seg.map(b=>b.textContent.trim().replace(/\\s+/g,' ')).join('|')+']';
  tab.click(); await sleep(900);
  /* FIVE segments on a pill that was drawn for four. The row has to keep fitting
     the phone — a tab that runs off the right edge is a tab nobody finds — so
     this is measured on the 412 px viewport this walk emulates rather than
     eyeballed once and forgotten. */
  const pill=document.querySelector('.seg');
  if(pill.scrollWidth>pill.clientWidth+1) return 'FAIL the segment row overflows: '+pill.scrollWidth+' > '+pill.clientWidth;
  const ids=['forbidden-city','wall-guide','ski-lesson','forest-park','tianmen','cq1949',
             'jade-dragon','hkphil','macau-ferry','ngong-ping','lung-king-heen'];
  const card=(k)=>document.getElementById('bk-cn26-ticket-'+k);
  const missing=ids.filter(k=>!card(k));
  if(missing.length) return 'FAIL no card for: '+missing.join(',');
  const stamp=(k)=>(card(k).querySelector('.tk-stamp')?.textContent||'').trim();
  if(!/^Booked/.test(stamp('hkphil'))) return 'FAIL the concert is not stamped booked: "'+stamp('hkphil')+'"';
  const notPending=ids.filter(k=>k!=='hkphil').filter(k=>!/Pending/i.test(stamp(k)));
  if(notPending.length) return 'FAIL not stamped pending: '+notPending.join(',');

  /* ① the reference, big, on a plain strip, and copyable with one thumb */
  const copied=[];
  navigator.clipboard.writeText=(t)=>{copied.push(t); return Promise.resolve();};
  const code=card('hkphil').querySelector('.codestrip .code');
  if(!code) return 'FAIL the concert has no reference to show at the door';
  if(code.textContent.trim()!=='26080616302422701001') return 'FAIL concert reference '+code.textContent.trim();
  code.click(); await sleep(400);
  if(copied[0]!=='26080616302422701001') return 'FAIL the reference did not copy: '+String(copied[0]).slice(0,30);
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

  /* Ten open a place this repo already verified — the concert opens the hall
     next door to the hotel. The ski lesson opens NOTHING, because 太舞滑雪小镇
     has never had a coordinate to certify a name against. */
  const btns=(k)=>[...card(k).querySelectorAll('.maps button')];
  const wrong=ids.filter(k=>k!=='ski-lesson').filter(k=>btns(k).length!==1);
  if(wrong.length) return 'FAIL map buttons on '+wrong.join(',');
  if(btns('ski-lesson').length!==0) return 'FAIL Thaiwoo got a button it has never earned';
  const hall=btns('hkphil')[0].getAttribute('data-geo')||'';
  if(!hall.startsWith('geo:0,0?q='+encodeURIComponent('Hong Kong Cultural Centre'))) return 'FAIL concert geo '+hall.slice(0,70);
  return 'ok 11 cards · 1 bought, 10 to buy · 10 buttons';
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
const BOOKED_BEDS = ['cn26-stay-00','cn26-stay-01','cn26-stay-02','cn26-stay-03','cn26-stay-04',
                     'cn26-stay-05','cn26-stay-06','cn26-stay-08','cn26-stay-09','cn26-stay-10',
                     'cn26-stay-11','cn26-stay-12']; // stay-12: the Muping night, booked 2026-09-28
/* The ten a platform holds — everything that can be read out at a desk. */
const NUMBERED_BEDS = BOOKED_BEDS.filter((id) => id !== 'cn26-stay-11');
const bedsBooked = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  /* Guarded on purpose: if the Stays segment is ever renamed or this step lands
     on the wrong route, an unguarded .click() throws and the harness reports a
     bare ERR, which says nothing. A named FAIL says where to look. */
  const seg=[...document.querySelectorAll('.seg button')];
  const stays=seg.find(b=>/Stays/.test(b.textContent));
  if(!stays) return 'FAIL no Stays segment here — saw ['+seg.map(b=>b.textContent.trim()).join('|')+']';
  stays.click();
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
     booked). Six of the ten carry a secondary line; the price beside it is
     the price the confirmation printed, IN THE CURRENCY IT PRINTED IT IN — five
     of the ten are quoted in yuan, and the ibis is quoted in the dollars its
     order actually charged.
     Element's secondary line is the odd one: not a PIN and not a platform name
     but a SECOND booking number. Agoda sold a room allotted from booking.com,
     so the property's own system may only recognise 5351254076. A desk that
     cannot find the Agoda ID needs the other number on the same card. */
  const numbered=[['cn26-stay-02','683386279',/5351254076/,'$232.95'],
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
  const deadlines=[['cn26-stay-02',/00:00 Dec 9/],['cn26-stay-03',/23:59 Dec 9/],
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
  if(!card('cn26-stay-02')?.innerText.includes('$232.95')) return 'FAIL cn26-stay-02 does not show $232.95';

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
  const links={'cn26-stay-00':'https://www.trip.com/account/orderlist/',
               'cn26-stay-01':'https://www.trip.com/account/orderlist/',
               'cn26-stay-02':'https://www.agoda.com/account/bookings.html',
               'cn26-stay-03':'https://www.agoda.com/account/bookings.html',
               'cn26-stay-04':'https://www.trip.com/account/orderlist/',
               'cn26-stay-05':'https://www.trip.com/account/orderlist/',
               'cn26-stay-06':'https://secure.booking.com/mytrips.html',
               'cn26-stay-08':'https://secure.booking.com/mytrips.html',
               'cn26-stay-09':'https://www.trip.com/account/orderlist/',
               'cn26-stay-10':'https://www.rghk.com.hk/en/index.php',
               'cn26-stay-12':'https://www.trip.com/account/orderlist/'};
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
   booked, and still buttonless: its bookings-list row named a district, and
   the door its confirmation email prints (found 2026-09-27) rides on the note
   until it has been checked in Amap on the phone. Type an address and the button appears,
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

/* AND NOW IT SAYS SO. With the network gone the screen used to be
   pixel-identical to the online one — no chip, no dimmed action, nothing — so
   a dead "Find email" tab could be the phone, the Firewall, or a broken app,
   with no way to tell. It is a QUIET chip, not a warning: offline is the
   normal condition of this trip. Same page as the check above, still
   navigator.onLine === false. */
const offchip = await js(`(async()=>{
  const chip=document.querySelector('.offchip');
  if(!chip) return 'FAIL Today says nothing about being offline';
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

/* And Info carries the same chip, because it is the other screen read while
   standing still with no signal. */
await S('Page.navigate', { url: `${BASE}?d=2026-11-25#/trip/cn26/info` });
await wait(2500);
const offinfo = await js(`(()=>{
  const chip=document.querySelector('.offchip');
  return chip && /offline/i.test(chip.textContent) ? 'ok' : 'FAIL Info is silent about being offline';
})()`);
rows.push([offinfo === 'ok' ? 'PASS' : 'FAIL', 'Offline · Info says so too', String(offinfo).slice(0, 50)]);

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
const drivecard = await js(`(async()=>{
  const card=document.querySelector('.drivecard');
  if(!card) return 'FAIL the Backup screen has no Drive card at all';
  const txt=card.innerText.replace(/\\s+/g,' ').trim();
  if(!/drive backup/i.test(txt)) return 'FAIL the card does not name itself: '+txt.slice(0,60);
  if(!/needs a one-time google setup/i.test(txt)) return 'FAIL it does not say WHY it is not connected: '+txt.slice(0,80);
  /* A Connect button here would promise something no tap can deliver. */
  const btns=[...card.querySelectorAll('button')];
  if(btns.length) return 'FAIL '+btns.length+' button(s) on a card that cannot connect: '+btns.map(b=>b.textContent.trim()).join('|');
  /* It must still say what the feature WOULD send, in plain words. */
  if(!/backup file/i.test(txt)) return 'FAIL it never says what would leave the phone';
  /* not a fault — the quiet voice, not crit red */
  const line=card.querySelector('.statline');
  if(!line) return 'FAIL no state line';
  if(/rgb\\(255, 95, 82\\)/.test(getComputedStyle(line).color)) return 'FAIL an un-set-up backup shouts in crit red';
  return 'ok honest, buttonless, quiet';
})()`, true);
rows.push([String(drivecard).startsWith('ok') ? 'PASS' : 'FAIL', 'Drive card · honest not-connected state', String(drivecard).slice(3, 56)]);

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
await S('Page.navigate', { url: `${BASE}?d=2026-12-05#/trip/cn26/info` });
await wait(2500);

const conv = await js(`(async()=>{
  const card=document.querySelector('.convcard');
  if(!card) return 'FAIL Info has no converter';
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

const health = await js(`(()=>{
  const card=document.querySelector('.healthcard');
  if(!card) return 'FAIL Info has no health & insurance section';
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
const A11Y_URLS = ['#/trip/cn26/today', '#/trip/cn26/itinerary', '#/trip/cn26/wallet',
  '#/trip/cn26/tasks', '#/trip/cn26/info', '#/backup', '#/settings'];
const nameless = [];
let focusChecked = 0;
let focusBad = 0;
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
  /* Focus is a STATE THE EYE CAN FIND, in both themes: the global rule paints
     a gold outline, and a control that overrides it back to none is invisible
     to a keyboard. */
  const focus = await js(`(()=>{
    const btns=[...document.querySelectorAll('button')].filter(b=>!b.disabled).slice(0,6);
    let checked=0,bad=0;
    for(const b of btns){
      b.focus();
      const s=getComputedStyle(b);
      checked++;
      const ring=(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||s.boxShadow!=='none';
      if(!ring) bad++;
    }
    return checked+'/'+bad;
  })()`);
  const [c, b] = String(focus).split('/').map(Number);
  focusChecked += c || 0;
  focusBad += b || 0;
}
rows.push([nameless.length === 0 ? 'PASS' : 'FAIL', 'A11y · every button has a name',
  nameless.length === 0 ? `${A11Y_URLS.length} screens swept, 0 nameless` : nameless.join(' ').slice(0, 60)]);
rows.push([focusBad === 0 ? 'PASS' : 'FAIL', 'A11y · focus is visible, not implied',
  focusBad === 0 ? `${focusChecked} controls, all show focus` : `${focusBad}/${focusChecked} show nothing`]);

/* ============================================================
   GAP E — THE LIGHT THEME, WALKED WITH THE NETWORK STILL OFF.

   Two themes, dark by default (owner decision 2026-08-12). The failure mode
   worth a rehearsal is not "the colours are wrong" — the contrast gate settles
   that before the build — it is that the CHOICE does not survive: a theme that
   flips instantly and then boots black, or boots light after a black flash
   because the attribute arrived with the first Dexie answer instead of with
   the HTML. So this pass drives the real switch in Settings, reloads, and asks
   the page when the attribute appeared, not merely whether it is there now.

   Everything above ran in dark, the default, and everything below runs in dark
   again: the last check here puts it back. No existing check is deleted, moved
   or weakened by this block.
   ============================================================ */

/* Record the theme as it stood at DOMContentLoaded. The app's own theme effect
   cannot have run by then — it waits on a Dexie live query, which is
   asynchronous — so anything found here was written by the four-line boot
   script in index.html, which is exactly the thing that prevents the flash. */
await S('Page.addScriptToEvaluateOnNewDocument', {
  source:
    "document.addEventListener('DOMContentLoaded',function(){" +
    "window.__themeAtDCL=document.documentElement.getAttribute('data-theme');});",
});

await S('Page.navigate', { url: `${BASE}#/settings` });
await wait(2500);
const litUp = await js(`(async()=>{
  const btns=[...document.querySelectorAll('.seg button')];
  const light=btns.find(b=>b.textContent.trim()==='Light');
  if(!light) return 'FAIL Settings has no Light choice: '+btns.map(b=>b.textContent.trim()).join('|');
  light.click();
  await new Promise(r=>setTimeout(r,900));
  if(document.documentElement.getAttribute('data-theme')!=='light') return 'FAIL the choice did not reach the document';
  const bg=getComputedStyle(document.body).backgroundColor;
  if(bg!=='rgb(242, 232, 213)') return 'FAIL the canvas is not cream paper: '+bg;
  if(localStorage.getItem('ltd:theme')!=='light') return 'FAIL nothing was mirrored for the next cold boot';
  return 'ok '+bg;
})()`, true);
rows.push([String(litUp).startsWith('ok') ? 'PASS' : 'FAIL', 'Light · Settings flips it at once', String(litUp).slice(3, 56)]);

/* The same facts the dark run asserts for Dec 11, now on paper. */
await check('Light · Dec 11, the Daxing flight', `${BASE}?d=2026-12-11#/trip/cn26/today`,
  ['Daxing flight', 'Daxing (PKX)', '20 kg']);

const noFlash = await js(`(()=>{
  if(window.__themeAtDCL!=='light') return 'FAIL the theme arrived AFTER the app mounted: '+String(window.__themeAtDCL);
  if(document.documentElement.getAttribute('data-theme')!=='light') return 'FAIL light did not survive the reload';
  const bg=getComputedStyle(document.body).backgroundColor;
  if(bg!=='rgb(242, 232, 213)') return 'FAIL reloaded onto the wrong canvas: '+bg;
  return 'ok painted before mount';
})()`);
rows.push([String(noFlash).startsWith('ok') ? 'PASS' : 'FAIL', 'Light · survives a reload, no flash', String(noFlash).slice(3, 56)]);

/* The Wallet's luggage tag is the hardest surface to get right in daylight:
   it is a MATERIAL, so it is not enough for the page behind it to turn cream —
   the tag has to become manila and the ink printed on it has to turn dark. A
   light theme that only re-grounds the app leaves cream ink on cream leather,
   which the contrast gate would catch but only if the token were actually
   used. This asserts the pixels. */
await check('Light · Wallet, the tag still reads', `${BASE}?d=2026-12-15#/trip/cn26/wallet`,
  ['8CR7MR', 'Etihad', 'BOOKED']);
const tagInk = await js(`(()=>{
  const kind=document.querySelector('.tag .kind');
  if(!kind) return 'FAIL no luggage tag on the Wallet';
  const m=/rgb\\((\\d+), (\\d+), (\\d+)\\)/.exec(getComputedStyle(kind).color);
  if(!m) return 'FAIL could not read the tag ink: '+getComputedStyle(kind).color;
  const sum=(+m[1])+(+m[2])+(+m[3]);
  if(sum>300) return 'FAIL the tag header is still light-on-light: '+m[0];
  return 'ok ink '+m[0];
})()`);
rows.push([String(tagInk).startsWith('ok') ? 'PASS' : 'FAIL', 'Light · the tag turns manila', String(tagInk).slice(3, 56)]);

/* The city guide, whose paper furniture has three grounds of its own. */
await check('Light · city guide, paper and accordion', `${BASE}?d=2026-12-15#/trip/cn26/itinerary/cn26-stop-zhangjiajie`,
  ['CA 8609', 'PKX → DYG', 'Booked for this stop', 'Pullman Zhangjiajie']);
const guideInk = await js(`(()=>{
  const sum=(el)=>{const m=/rgb\\((\\d+), (\\d+), (\\d+)\\)/.exec(getComputedStyle(el).color); return m?(+m[1])+(+m[2])+(+m[3]):-1;};
  const head=document.querySelector('.ghead');
  if(!head) return 'FAIL the guide has no typewriter heading';
  if(sum(head)>300) return 'FAIL the section heading is still cream on cream';
  const sm=document.querySelector('.accitem > summary');
  if(!sm) return 'FAIL the day-by-day accordion is gone';
  if(sum(sm)>300) return 'FAIL an accordion day title is still cream on a lit well';
  return 'ok headings and day titles inked';
})()`);
rows.push([String(guideInk).startsWith('ok') ? 'PASS' : 'FAIL', 'Light · the guide is inked, not ghosted', String(guideInk).slice(3, 56)]);

/* THE LAST HARD-CODED COLOUR IN THE APP (Lantern Run C3.3). Home's authored
   timeline cards were painted rgba(30,36,44,.55) with a cold blue edge —
   literal, not a token — so in daylight they stayed midnight blue and the
   day's dark-brown ink sat on a dark-blue card. Tokenised to --plan-card /
   --plan-edge, which the contrast gate now measures in both palettes. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-13#/trip/cn26/today` });
await wait(2400);
const planGlass = await js(`(()=>{
  const card=document.querySelector('.tcard');
  if(!card) return 'FAIL no authored timeline card on Dec 13';
  const bg=getComputedStyle(card).backgroundColor;
  const m=bg.match(/\\d+/g);
  if(!m) return 'FAIL the card has no background at all: '+bg;
  const lum=(+m[0]+ +m[1]+ +m[2])/3;
  if(lum<128) return 'FAIL the planned-hour card is still dark in daylight: '+bg;
  /* and the ink on it must be the DAY'S ink, not the night's cream */
  const b=card.querySelector('b');
  if(!b) return 'FAIL the card has no title to check';
  const ink=getComputedStyle(b).color.match(/\\d+/g);
  if(!ink) return 'FAIL no ink colour';
  if((+ink[0]+ +ink[1]+ +ink[2])/3>128) return 'FAIL cream ink on a pale card: '+getComputedStyle(b).color;
  return 'ok card '+Math.round(lum)+', ink '+Math.round((+ink[0]+ +ink[1]+ +ink[2])/3);
})()`);
rows.push([String(planGlass).startsWith('ok') ? 'PASS' : 'FAIL', 'Light · the timeline glass flips too', String(planGlass).slice(3, 56)]);

/* And back to the default, so everything after this runs where it started. */
await S('Page.navigate', { url: `${BASE}#/settings` });
await wait(2500);
const backToDark = await js(`(async()=>{
  const dark=[...document.querySelectorAll('.seg button')].find(b=>/^Dark/.test(b.textContent.trim()));
  if(!dark) return 'FAIL Settings has no Dark choice';
  dark.click();
  await new Promise(r=>setTimeout(r,900));
  if(document.documentElement.hasAttribute('data-theme')) return 'FAIL dark is supposed to be the ABSENCE of the attribute';
  const bg=getComputedStyle(document.body).backgroundColor;
  if(bg!=='rgb(0, 0, 0)') return 'FAIL the canvas did not come back to true black: '+bg;
  return 'ok '+bg;
})()`, true);
rows.push([String(backToDark).startsWith('ok') ? 'PASS' : 'FAIL', 'Light · dark is the default, and returns', String(backToDark).slice(3, 56)]);

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
