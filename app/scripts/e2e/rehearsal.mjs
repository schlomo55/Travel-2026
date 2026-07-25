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
  return missing.length ? 'FAIL missing: '+missing.join(', ') : (maps>=1 ? 'ok '+maps : 'FAIL map buttons: '+maps);
})()`);
rows.push([String(guide).startsWith('ok') ? 'PASS' : 'FAIL', 'City guide · 5 parts + map buttons', String(guide).slice(0, 56)]);

/* ONE button per place, everywhere. The old Google+Amap pair is gone, so no
   group of map buttons anywhere on this page may hold more than one. */
const single = await js(`(()=>{
  const groups=[...document.querySelectorAll('.maps')];
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

/* a booking carries its own location now: the bed that verified opens by name,
   the flight opens the airport it LEAVES from, and the four beds OSM could not
   confirm carry no button at all */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/wallet` });
await wait(2200);
const bookmaps = await js(`(async()=>{
  const seg=(re)=>[...document.querySelectorAll('.seg button')].find(b=>re.test(b.textContent));
  seg(/Stays/).click(); await new Promise(r=>setTimeout(r,800));
  const btns=(id)=>[...(document.getElementById('bk-'+id)?.querySelectorAll('.maps button')||[])];
  const naxi=btns('cn26-stay-06');
  if(naxi.length!==1) return 'FAIL Mama Naxi buttons '+naxi.length;
  const ngeo=naxi[0].getAttribute('data-geo')||'';
  if(!ngeo.startsWith('geo:0,0?q='+encodeURIComponent('Mama Naxi Guesthouse'))) return 'FAIL geo '+ngeo.slice(0,50);
  if(!ngeo.endsWith(encodeURIComponent('Lijiang'))) return 'FAIL bed city '+ngeo.slice(-30);
  /* CHAO resolves to the Workers' Stadium and the Jade Emu to nothing, so
     neither ships a button. A missing button here is the feature. */
  const mute=['cn26-stay-00','cn26-stay-03','cn26-stay-05','cn26-stay-08'].filter(id=>btns(id).length!==0);
  if(mute.length) return 'FAIL unverified bed has a button: '+mute.join(',');
  seg(/Travel/).click(); await new Promise(r=>setTimeout(r,800));
  const ca=btns('cn26-flight-ca1953');
  if(ca.length!==1) return 'FAIL CA1953 buttons '+ca.length;
  const ageo=ca[0].getAttribute('data-geo')||'';
  if(!ageo.startsWith('geo:0,0?q='+encodeURIComponent('北京首都国际机场'))) return 'FAIL flight geo '+ageo.slice(0,50);
  return 'ok';
})()`, true);
rows.push([bookmaps === 'ok' ? 'PASS' : 'FAIL', 'Bookings · one button, right place', String(bookmaps).slice(0, 55)]);

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

/* One paste is all it takes: CHAO Sanlitun ships with no button because
   OpenStreetMap answers with the Workers' Stadium. Type the address off the
   confirmation email and the button appears, searching for that address. */
await S('Page.navigate', { url: `${BASE}?d=2026-12-15#/trip/cn26/wallet` });
await wait(2200);
const paste = await js(`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const btns=()=>[...(document.getElementById('bk-cn26-stay-00')?.querySelectorAll('.maps button')||[])];
  [...document.querySelectorAll('.seg button')].find(b=>/Stays/.test(b.textContent)).click();
  await sleep(800);
  if(btns().length!==0) return 'FAIL CHAO already has a button';
  document.querySelector('.editmode').click();
  await sleep(600);
  const card=document.getElementById('bk-cn26-stay-00');
  const edit=[...card.parentElement.querySelectorAll('button')].find(b=>/Edit/.test(b.textContent));
  if(!edit) return 'FAIL no edit button';
  edit.click(); await sleep(900);
  const input=document.getElementById('f-address');
  if(!input) return 'FAIL no Address field on the stay form';
  const want='北京市朝阳区三里屯路4号';
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

  [...document.querySelectorAll('button')].find(b=>/New trip/.test(b.textContent)).click();
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

ws.close(); chrome.kill();
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
process.exit(failed ? 1 : 0);
