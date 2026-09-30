/**
 * Verifies the recut Bisaya nursery narration end to end, headed, against the real
 * app. Same interception model as harness.mjs, with one difference: the three recut
 * mp3s and the three retimed VTTs are served from DISK, so nothing on R2 is touched
 * and the harness's path-keyed cache cannot shadow them (CLAUDE.md testing traps).
 *
 * Throwaway driver, not part of the harness. It never modifies app source.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const CACHE_DIR = path.join(HERE, '.asset-cache');
const R2 = 'https://assets.granjaalegre.com';
const PORT = 8137;

// R2 path -> local file. These win over both the cache and the network.
const LOCAL = {
  'VO/bis/nursery_bis_01.mp3': 'test/loudness/VO/bis/nursery_bis_01.mp3',
  'VO/bis/nursery_bis_02.mp3': 'test/loudness/VO/bis/nursery_bis_02.mp3',
  'VO/bis/nursery_bis_03.mp3': 'test/loudness/VO/bis/nursery_bis_03.mp3',
  'Subtitles/bis/nursery_en_01.vtt': 'test/nursery/Subtitles/bis/nursery_en_01.vtt',
  'Subtitles/bis/nursery_en_02.vtt': 'test/nursery/Subtitles/bis/nursery_en_02.vtt',
  'Subtitles/bis/nursery_en_03.vtt': 'test/nursery/Subtitles/bis/nursery_en_03.vtt',
};

const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json',
  '.mp4':'video/mp4','.mp3':'audio/mpeg','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.png':'image/png','.vtt':'text/vtt','.svg':'image/svg+xml','.sog':'application/octet-stream' };

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const { readdirSync } = await import('node:fs');
  const root = path.join(process.env.HOME, '.npm/_npx');
  for (const e of readdirSync(root)) {
    const mjs = path.join(root, e, 'node_modules/playwright/index.mjs');
    const cjs = path.join(root, e, 'node_modules/playwright');
    if (existsSync(mjs) || existsSync(cjs)) {
      try { return await import(existsSync(mjs) ? mjs : cjs); } catch {}
    }
  }
  throw new Error('playwright not found');
}

const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(REPO, rel);
    if (!file.startsWith(REPO)) return res.writeHead(403).end();
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('nf'); }
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const cacheKey = (rel) => path.join(CACHE_DIR,
  `${createHash('sha1').update(rel).digest('hex').slice(0,10)}__${rel.replace(/[^a-zA-Z0-9._-]/g,'_')}`);

const served = [];
async function route(r) {
  const url = r.request().url();
  const rel = decodeURIComponent(new URL(url).pathname.slice(1));
  let body, from;
  if (LOCAL[rel]) { body = await readFile(path.join(REPO, LOCAL[rel])); from = 'LOCAL'; }
  else {
    const f = cacheKey(rel);
    if (existsSync(f)) { body = await readFile(f); from = 'cache'; }
    else {
      const res = await fetch(url, { headers: { 'User-Agent': 'verify' } });
      if (!res.ok) { await r.fulfill({ status: res.status, body: '' }); return; }
      body = Buffer.from(await res.arrayBuffer());
      await mkdir(CACHE_DIR, { recursive: true }); await writeFile(f, body);
      from = 'net';
    }
  }
  if (/nursery_(bis|en)_0/.test(rel)) served.push(`${from} ${rel} ${body.length}B`);
  const type = MIME[path.extname(rel)] || 'application/octet-stream';
  const range = r.request().headers()['range'];
  if (range && /^bytes=/.test(range)) {
    const [s, e] = range.replace('bytes=','').split('-');
    const start = Number(s || 0), end = e ? Math.min(Number(e), body.length-1) : body.length-1;
    return r.fulfill({ status: 206, body: body.subarray(start, end+1), headers: {
      'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Access-Control-Allow-Origin': '*' } });
  }
  await r.fulfill({ status: 200, body, headers: {
    'Content-Type': type, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' } });
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.route(`${R2}/**`, route);

const errors = [], bad = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });

const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(1);
const log = (...a) => console.log(`${el()}s`, ...a);
const checks = [];
const check = (ok, label, detail='') => { checks.push([ok,label,detail]);
  console.log(`  ${ok?'PASS':'FAIL'}  ${label}${detail?'  — '+detail:''}`); };

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => { try { return typeof eval('sceneManager') === 'object'; } catch { return false; } }, null, { timeout: 90000 });
await page.evaluate(() => { try { if (!app._inFrameUpdate && !app.frame) app.start(); } catch {} });
await page.evaluate(() => { window.currentLanguage = 'bis'; try { sessionStorage.setItem('language','bis'); } catch {} });
log('app ready');

// Instrument VO playback before the scene loads.
await page.evaluate(() => {
  window.__vo = [];
  const OA = window.Audio;
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (this.src && /nursery_bis_/.test(this.src)) {
      const id = this.src.match(/nursery_bis_\d+/)[0];
      if (!window.__vo.some(v => v.id === id)) {
        const rec = { id, t: performance.now()/1000, dur: null, ended: null, cues: [] };
        window.__vo.push(rec);
        // The cross-scene VO prefetch means metadata is often already there by the
        // time play() runs, so a bare 'loadedmetadata' listener never fires.
        if (isFinite(this.duration)) rec.dur = this.duration;
        this.addEventListener('loadedmetadata', () => { rec.dur = this.duration; });
        this.addEventListener('durationchange', () => { rec.dur = this.duration; });
        this.addEventListener('ended', () => { rec.ended = performance.now()/1000; });
        const wire = () => {
          const tt = [...(this.textTracks||[])];
          tt.forEach(tr => { if (tr.__wired) return; tr.__wired = true;
            tr.addEventListener('cuechange', () => {
            const c = tr.activeCues && tr.activeCues[0];
            if (c) rec.cues.push({ at: this.currentTime, s: c.startTime, e: c.endTime, txt: c.text });
          }); });
        };
        // Wire at once, or cue 1 (which starts at ~0.10s) is missed.
        wire(); this.addEventListener('loadedmetadata', wire); setTimeout(wire, 400);
      }
    }
    return orig.apply(this, arguments);
  };
});

await page.evaluate(() => eval('sceneManager').switchTo('nursery', null));
await page.waitForFunction(() => { try { const sm = eval('sceneManager');
  return sm.activeScene?.name === 'nursery' && sm.getActiveScene()?.isLoaded && !eval('appState').isTransitioning;
} catch { return false; } }, null, { timeout: 600000 });
log('nursery loaded');

const s = () => page.evaluate(() => {
  const sc = eval('sceneManager').getActiveScene();
  return { gate: sc.voGateType, idx: sc.voIndex, hl: sc.highlightedHotspot?.name || null,
    marker: !!document.querySelector('.gate-marker-button'),
    mini: !!document.getElementById('mini-quiz-overlay'),
    quiz: (document.getElementById('quiz-overlay')||{}).style?.display,
    sub: (document.getElementById('subtitle-bar')||{}).textContent || '' };
});

async function until(fn, ms, label) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await fn()) return (Date.now()-t)/1000; await page.waitForTimeout(250); }
  return null;
}

// ---- gate 1: the polybag marker, after nursery_bis_01
let t = await until(async () => (await s()).marker, 45000, 'marker');
check(t !== null, 'polybag marker appears after segment 01', t !== null ? `${t.toFixed(1)}s after scene load` : 'timed out');
let st = await s(); check(st.gate === 'marker', 'gate type is marker', String(st.gate));
await page.click('.gate-marker-button');
log('clicked marker');

// the marker gate plays the polybag video before segment 02
t = await until(async () => { const v = await page.evaluate(() => window.__vo.map(x=>x.id));
  return v.includes('nursery_bis_02'); }, 120000);
check(t !== null, 'segment 02 starts after the marker gate', t !== null ? `${t.toFixed(1)}s` : 'timed out');

// ---- gate 2: the flowers mini-quiz, after nursery_bis_02
t = await until(async () => (await s()).mini, 90000);
check(t !== null, 'flowers mini-quiz opens after segment 02', t !== null ? `${t.toFixed(1)}s` : 'timed out');
const correct = await page.evaluate(() => eval('sceneManager').getActiveScene().getMiniQuizData('flowers').correct);
await page.evaluate((c) => {
  [...document.querySelectorAll('#mini-quiz-overlay button')].find(b => b.textContent === c).click();
}, correct);
log(`answered mini-quiz "${correct}"`);

t = await until(async () => page.evaluate(() => window.__vo.some(v => v.id === 'nursery_bis_03')), 60000);
check(t !== null, 'segment 03 starts after the mini-quiz', t !== null ? `${t.toFixed(1)}s` : 'timed out');

// ---- gate 3: the scene quiz, at the end of nursery_bis_03
t = await until(async () => (await s()).quiz === 'flex', 90000);
check(t !== null, 'scene quiz opens at the end of segment 03', t !== null ? `${t.toFixed(1)}s` : 'timed out');

const vo = await page.evaluate(() => window.__vo);
const EXPECT = { nursery_bis_01: 14.402, nursery_bis_02: 32.778, nursery_bis_03: 30.601 };
check(vo.map(v=>v.id).join(',') === 'nursery_bis_01,nursery_bis_02,nursery_bis_03',
  'all three segments played, in order', vo.map(v=>v.id).join(' -> '));
for (const v of vo) {
  const want = EXPECT[v.id];
  check(v.dur !== null && Math.abs(v.dur - want) < 0.15,
    `${v.id} is the recut file`, `duration ${v.dur?.toFixed(3)}s (expected ${want})`);
}
for (const v of vo) {
  const last = v.cues[v.cues.length-1];
  const lag = v.cues.length ? Math.max(...v.cues.map(c => Math.abs(c.at - c.s))) : null;
  check(v.cues.length > 0, `${v.id} fired subtitle cues`, `${v.cues.length} cues, worst lag ${lag?.toFixed(3)}s`);
  if (last) check(last.e <= (v.dur ?? 0) + 0.05, `${v.id} last cue ends inside the audio`,
    `cue ends ${last.e.toFixed(3)}s, audio ${v.dur?.toFixed(3)}s`);
}

check(errors.length === 0, 'zero console errors', errors.slice(0,4).join(' | ') || 'none');
check(bad.length === 0, 'no 4xx/5xx responses', bad.slice(0,4).join(' | ') || 'none');
console.log('\nasset routing for nursery files:');
[...new Set(served)].forEach(x => console.log('  ' + x));
console.log('\ncue log:');
vo.forEach(v => { console.log(`  ${v.id} (${v.dur?.toFixed(3)}s)`);
  v.cues.forEach(c => console.log(`    @${c.at.toFixed(2)}  ${c.s.toFixed(2)}-${c.e.toFixed(2)}  ${c.txt.replace(/\n/g,' ')}`)); });

const pass = checks.filter(c=>c[0]).length;
console.log(`\n${pass}/${checks.length} checks passed`);
await browser.close(); server.close();
process.exit(pass === checks.length ? 0 : 1);
