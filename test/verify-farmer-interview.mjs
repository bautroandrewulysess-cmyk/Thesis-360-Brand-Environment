/**
 * Verifies the new farmer interview (Videos/farmerInterview_v3.mp4) end to end,
 * headed, against the real app, in BOTH languages.
 *
 * Same interception model as harness.mjs, with one difference: the new video is
 * served from DISK, because it is not on R2 yet. That also sidesteps the harness's
 * path-keyed cache, which cannot be busted by a version stamp (CLAUDE.md testing
 * traps).
 *
 * What it asserts, per language:
 *   - the gate resolves the PLAIN path, Videos/farmerInterview_v3.mp4 — no /bis/
 *     segment in a Bisaya run, which is the whole point of bypassing videoUrl()
 *   - the bytes actually served came from disk, and are the new file (duration)
 *   - the video plays: readyState reaches HAVE_FUTURE_DATA and currentTime advances
 *   - ambient is silenced while it plays and restarts when it ends (this gate
 *     ducks by pauseAmbient(), which stops the buffer source -- ambientGain stays
 *     at its base 0.8 throughout, so a gain-only probe reads a false failure)
 *   - onFinish runs: isInputLocked goes back to false
 *   - zero console errors, no 4xx/5xx
 *
 * Throwaway driver, not part of the harness. It never modifies app source.
 *
 *   node test/verify-farmer-interview.mjs
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
const PORT = 8141;

// R2 path -> local file. These win over both the cache and the network.
const LOCAL = {
  'Videos/farmerInterview_v3.mp4': 'test/loudness/Videos/farmerInterview_v3.mp4',
};
const EXPECTED_DURATION = 89.000;   // ffprobe, measured

const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json',
  '.mp4':'video/mp4','.mp3':'audio/mpeg','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.png':'image/png','.vtt':'text/vtt','.svg':'image/svg+xml','.sog':'application/octet-stream' };

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* npx cache below */ }
  const { readdirSync } = await import('node:fs');
  const root = path.join(process.env.HOME, '.npm/_npx');
  for (const e of readdirSync(root)) {
    const mjs = path.join(root, e, 'node_modules/playwright/index.mjs');
    const cjs = path.join(root, e, 'node_modules/playwright');
    if (existsSync(mjs) || existsSync(cjs)) {
      try { return await import(existsSync(mjs) ? mjs : cjs); } catch { /* keep looking */ }
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

const checks = [];
const check = (ok, label, detail='') => { checks.push([ok,label,detail]);
  console.log(`  ${ok?'PASS':'FAIL'}  ${label}${detail?'  — '+detail:''}`); };

async function run(lang) {
  console.log(`\n=== ${lang.toUpperCase()} ===`);
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
    if (/[Ff]armerInterview/.test(rel)) served.push(`${from} ${rel}`);
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

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => { try { return typeof eval('sceneManager') === 'object'; } catch { return false; } }, null, { timeout: 90000 });
  await page.evaluate(() => { try { if (!app._inFrameUpdate && !app.frame) app.start(); } catch { /* started */ } });
  await page.evaluate((l) => { window.currentLanguage = l; try { sessionStorage.setItem('language', l); } catch { /* non-fatal */ } }, lang);

  await page.evaluate(() => eval('sceneManager').switchTo('street-view', null));
  await page.waitForFunction(() => { try { const sm = eval('sceneManager');
    return sm.activeScene?.name === 'street-view' && sm.getActiveScene()?.isLoaded && !eval('appState').isTransitioning;
  } catch { return false; } }, null, { timeout: 600000 });
  console.log('  street-view loaded');

  // Watch the ambient gain across the whole gate. setTargetAtTime is a ramp, so a
  // single read right after the event would catch it mid-slide; sample instead.
  //
  // This gate's duck is pauseAmbient(), which STOPS the buffer source; it does not
  // attenuate ambientGain, which sits at its base 0.8 throughout. A gain-only probe
  // reads 0.8 the whole way and looks like a failure. Sample both.
  await page.evaluate(() => {
    window.__gain = [];
    const sc = eval('sceneManager').getActiveScene();
    window.__gainTimer = setInterval(() => {
      if (sc.ambientGain) window.__gain.push({ g: sc.ambientGain.gain.value, src: !!sc.ambientSource });
    }, 100);
  });
  const hasAmbient = await page.evaluate(() => !!eval('sceneManager').getActiveScene().ambientGain);
  check(hasAmbient, 'ambient bed exists (duck/restore is live, not inert)', hasAmbient ? 'ambientGain present' : 'ambientGain is null — duck path never runs');

  // Walk straight to the gate. transitionToPosition() sets currentPosition and then
  // calls checkFarmerInterviewAtToFarm14() itself, so this is the real code path.
  await page.evaluate(() => {
    const sc = eval('sceneManager').getActiveScene();
    window.journeyComplete = false;
    sc.toFarm14FirstArrival = true;
    return sc.transitionToPosition('toFarm14');
  });

  const gotSrc = await page.waitForFunction(() => {
    const v = document.getElementById('popup-video');
    return v && v.src && /farmerInterview/.test(v.src) ? v.src : false;
  }, null, { timeout: 120000 }).then(h => h.jsonValue()).catch(() => null);

  check(gotSrc === `${R2}/Videos/farmerInterview_v3.mp4`, 'gate resolves the plain single-file path',
    gotSrc || 'no farmerInterview src appeared');
  check(gotSrc !== null && !/\/Videos\/bis\//.test(gotSrc), 'no per-language /Videos/bis/ segment',
    gotSrc ? gotSrc.replace(R2, '') : 'n/a');

  // Playing, not merely attached.
  const play = await page.waitForFunction(() => {
    const v = document.getElementById('popup-video');
    if (!v || !/farmerInterview/.test(v.src)) return false;
    return (v.readyState >= 3 && v.currentTime > 0.3 && !v.paused)
      ? { dur: v.duration, t: v.currentTime, rs: v.readyState, muted: v.muted, vol: v.volume }
      : false;
  }, null, { timeout: 180000 }).then(h => h.jsonValue()).catch(() => null);

  check(play !== null, 'video actually plays', play ? `readyState ${play.rs}, currentTime ${play.t.toFixed(2)}s, volume ${play.vol}` : 'never reached playing state');
  check(play !== null && Math.abs(play.dur - EXPECTED_DURATION) < 0.2, 'it is the new v3 cut',
    play ? `duration ${play.dur.toFixed(3)}s (expected ${EXPECTED_DURATION})` : 'n/a');
  check(served.some(s => s.startsWith('LOCAL')), 'bytes came from disk, not R2', served.join(' | ') || 'nothing served');

  await page.waitForTimeout(2500);
  const during = await page.evaluate(() => {
    const sc = eval('sceneManager').getActiveScene();
    return { src: !!sc.ambientSource, gain: sc.ambientGain.gain.value,
             paused: sc.ambientPausedGain };
  });
  check(hasAmbient && during.src === false, 'ambient is silenced while the interview plays',
    `ambientSource ${during.src ? 'still running' : 'stopped'}, gain held at ${during.gain.toFixed(3)}, resume value ${during.paused}`);

  // Jump to the end rather than sit through 89s; 'ended' fires normally either way,
  // and it is 'ended' that runs the teardown -- resumeAmbient() then onFinish().
  await page.evaluate(() => {
    const v = document.getElementById('popup-video');
    window.__ended = false;
    v.addEventListener('ended', () => { window.__ended = true; }, { once: true });
    v.currentTime = Math.max(0, v.duration - 1.5);
  });
  const ended = await page.waitForFunction(() => window.__ended === true, null, { timeout: 60000 })
    .then(() => true).catch(() => false);
  check(ended, 'the video reaches its end and fires ended', ended ? 'ended fired' : 'never ended');

  const restored = await page.waitForFunction(() => {
    const sc = eval('sceneManager').getActiveScene();
    return sc.ambientSource ? sc.ambientGain.gain.value : false;
  }, null, { timeout: 60000 }).then(h => h.jsonValue()).catch(() => null);
  check(restored !== null, 'ambient restarts when the interview ends',
    restored !== null ? `ambientSource running again at gain ${restored.toFixed(3)}` : 'ambientSource never came back');

  const unlocked = await page.waitForFunction(
    () => !eval('sceneManager').getActiveScene().isInputLocked, null, { timeout: 30000 })
    .then(() => true).catch(() => false);
  check(unlocked, 'input unlocked after the gate (onFinish ran)', unlocked ? 'isInputLocked false' : 'still locked');

  check(errors.length === 0, 'zero console errors', errors.slice(0,4).join(' | ') || 'none');
  check(bad.length === 0, 'no 4xx/5xx responses', bad.slice(0,4).join(' | ') || 'none');

  await page.evaluate(() => clearInterval(window.__gainTimer));
  await browser.close();
}

await run('en');
await run('bis');

server.close();
const pass = checks.filter(c => c[0]).length;
console.log(`\n${pass}/${checks.length} checks passed`);
process.exit(pass === checks.length ? 0 : 1);
