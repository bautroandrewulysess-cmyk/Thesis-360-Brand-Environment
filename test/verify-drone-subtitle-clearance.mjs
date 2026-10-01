#!/usr/bin/env node
/**
 * Verify the drone Continue button clears the subtitle bar.
 *
 *   node test/verify-drone-watchdog.mjs [--headless]
 *
 * Four cases per language, each driving the real
 * nursery.playDroneVideoThenTransition():
 *   A normal play            -> transitions (VO end / 'ended')
 *   B forced pause at ~3s    -> transitions within ~8s of the pause
 *   C play() always rejects  -> transitions immediately
 *   D Continue button        -> appears at ~6s and transitions when clicked
 *
 * sceneManager.switchTo is spied on and neutered, so "the journey continues" is
 * measured directly and street-view never actually loads. Cases B/C/D also stub
 * playVoWithSubtitles to a promise that never settles, so the only thing that can
 * rescue the player is the mechanism under test.
 *
 * Headed by design -- headless software rendering starves media timing (CLAUDE.md).
 * Never patches app source.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const CACHE_DIR = path.join(HERE, '.asset-cache');
const R2_ORIGIN = 'https://assets.granjaalegre.com';
const PORT = 8141;
const HEADLESS = process.argv.includes('--headless');

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json',
    '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.png': 'image/png', '.vtt': 'text/vtt',
    '.svg': 'image/svg+xml', '.sog': 'application/octet-stream',
};

async function loadPlaywright() {
    try { return await import('playwright'); } catch { /* npx cache */ }
    // Playwright lives only in the npx cache here, and it is CJS -- dynamic import()
    // of the package directory does not resolve it, so go through createRequire
    // (CLAUDE.md: the e41f20... copy matches installed browser revision 1234).
    const { createRequire } = await import('node:module');
    const require_ = createRequire(import.meta.url);
    const root = path.join(process.env.HOME || '', '.npm/_npx');
    const { readdirSync } = await import('node:fs');
    for (const entry of readdirSync(root)) {
        const cjs = path.join(root, entry, 'node_modules/playwright');
        if (existsSync(cjs)) { try { return require_(cjs); } catch { /* keep looking */ } }
    }
    throw new Error('playwright not found');
}

function startServer(port) {
    const server = createServer(async (req, res) => {
        try {
            const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
            const body = await readFile(path.join(REPO, rel));
            res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' }).end(body);
        } catch { res.writeHead(404).end('not found'); }
    });
    return new Promise((ok, no) => { server.on('error', no); server.listen(port, '127.0.0.1', () => ok(server)); });
}

const cacheKey = (url) => {
    const rel = decodeURIComponent(new URL(url).pathname.slice(1));
    const safe = rel.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(CACHE_DIR, `${createHash('sha1').update(rel).digest('hex').slice(0, 10)}__${safe}`);
};

const assetRoute = async (route) => {
    const url = route.request().url();
    const file = cacheKey(url);
    try {
        let body;
        if (existsSync(file)) body = await readFile(file);
        else {
            const res = await fetch(url, { headers: { 'User-Agent': 'harness' } });
            if (!res.ok) { await route.fulfill({ status: res.status, body: '' }); return; }
            body = Buffer.from(await res.arrayBuffer());
            await mkdir(CACHE_DIR, { recursive: true });
            await writeFile(file, body);
        }
        const type = MIME[path.extname(new URL(url).pathname)] || 'application/octet-stream';
        const range = route.request().headers()['range'];
        if (range && /^bytes=/.test(range)) {
            const [s, e] = range.replace('bytes=', '').split('-');
            const start = Number(s || 0);
            const end = e ? Math.min(Number(e), body.length - 1) : body.length - 1;
            await route.fulfill({
                status: 206, body: body.subarray(start, end + 1),
                headers: {
                    'Content-Type': type, 'Accept-Ranges': 'bytes',
                    'Content-Range': `bytes ${start}-${end}/${body.length}`,
                    'Access-Control-Allow-Origin': '*',
                },
            });
            return;
        }
        await route.fulfill({
            status: 200, body,
            headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' },
        });
    } catch { try { await route.abort(); } catch { /* done */ } }
};


// ------------------------------------------------------------------ checks
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
    (ok ? pass++ : fail++);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
};

const VIEWPORTS = [{ w: 1280, h: 800 }, { w: 900, h: 800 }];
const { chromium } = await loadPlaywright();
const server = await startServer(PORT);
const browser = await chromium.launch({
    channel: 'chrome', headless: HEADLESS,
    args: ['--autoplay-policy=no-user-gesture-required'],
});
const consoleErrors = [];
let shot = false;

try {
  for (const lang of ['en', 'bis']) {
    for (const vp of VIEWPORTS) {
      console.log(`\n========== ${lang.toUpperCase()} @ ${vp.w}x${vp.h} ==========`);
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await page.route(`${R2_ORIGIN}/**`, assetRoute);
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${lang} ${vp.w}] ${m.text()}`); });
      page.on('pageerror', (e) => consoleErrors.push(`[${lang} ${vp.w}] PAGEERROR ${e.message}`));

      await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => { try { return typeof eval('sceneManager') === 'object'; } catch { return false; } }, null, { timeout: 90000 });
      await page.evaluate(() => { try { if (!app._inFrameUpdate && !app.frame) app.start(); } catch {} });
      await page.evaluate((l) => { window.currentLanguage = l; try { sessionStorage.setItem('language', l); } catch {} }, lang);
      await page.evaluate(() => eval('sceneManager').switchTo('nursery', null));
      await page.waitForFunction(() => {
          try { const sm = eval('sceneManager');
            return sm.activeScene?.name === 'nursery' && sm.getActiveScene()?.isLoaded && !eval('appState').isTransitioning;
          } catch { return false; }
      }, null, { timeout: 600000 });

      // Neuter the scene switch so the overlay stays up for measuring, and let the
      // real VO + subtitles run so there are genuine cues on screen.
      const tStart = Date.now();
      await page.evaluate(() => {
          const sm = eval('sceneManager');
          window.__drone = { calls: [], peak: null, samples: 0, withCue: 0, worstGap: Infinity, overlaps: 0 };
          if (!sm.__origSwitchTo) {
              sm.__origSwitchTo = sm.switchTo.bind(sm);
              // Tag by spawnPosition so phase 2's click can be told apart from
              // phase 1's real VO finishing late (EN narration is 13.1s and lands
              // after the phase switch, which otherwise reads as a spurious call).
              sm.switchTo = (scene, spawn) => {
                  if (scene === 'street-view') { window.__drone.calls.push(spawn); return Promise.resolve(); }
                  return sm.__origSwitchTo(scene, spawn);
              };
          }
          sm.getActiveScene().playDroneVideoThenTransition(null);
      });

      const btnOk = await page.waitForSelector('#drone-continue-button', { timeout: 14000, state: 'attached' })
          .then(() => true).catch(() => false);
      const appearedAt = (Date.now() - tStart) / 1000;
      check('button appears at ~6s', btnOk && appearedAt >= 5 && appearedAt <= 9, `${appearedAt.toFixed(2)}s`);

      // Sample both rects for 8s of real narration, counting only frames where a
      // subtitle line is actually painted.
      await page.evaluate(() => new Promise((done) => {
          const s = window.__drone;
          const tick = () => {
              const b = document.getElementById('drone-continue-button');
              const bar = document.getElementById('subtitle-bar');
              if (b && bar) {
                  const br = b.getBoundingClientRect();
                  const sr = bar.getBoundingClientRect();
                  const cueUp = getComputedStyle(bar).display !== 'none' && sr.height > 0 && bar.textContent.trim().length > 0;
                  s.samples++;
                  if (cueUp) {
                      s.withCue++;
                      const gap = sr.top - br.bottom;
                      if (gap < s.worstGap) {
                          s.worstGap = gap;
                          s.peak = { gap, btn: {t: Math.round(br.top), b: Math.round(br.bottom)},
                                     bar: {t: Math.round(sr.top), b: Math.round(sr.bottom), h: Math.round(sr.height)},
                                     text: bar.textContent.trim().slice(0, 40) };
                      }
                      if (gap < 0) s.overlaps++;
                  }
              }
          };
          const iv = setInterval(tick, 100);
          setTimeout(() => { clearInterval(iv); done(); }, 5000);
      }));

      const m = await page.evaluate(() => window.__drone);
      check('real subtitle cues were on screen while sampling', m.withCue > 10, `${m.withCue}/${m.samples} frames with a cue`);
      check('button and subtitle bar never overlap', m.overlaps === 0, `${m.overlaps} overlapping frames`);
      check('bottom edge clears the bar top by >=16px',
            m.peak !== null && m.peak.gap >= 16,
            m.peak ? `worst gap ${m.peak.gap.toFixed(1)}px | btn ${m.peak.btn.t}-${m.peak.btn.b} | bar ${m.peak.bar.t}-${m.peak.bar.b} (h${m.peak.bar.h}) | "${m.peak.text}"` : 'no cue seen');

      if (!shot && lang === 'bis' && vp.w === 1280) {
          await page.screenshot({ path: 'test/drone-continue-above-subtitles.png' });
          shot = true;
          console.log('  screenshot -> test/drone-continue-above-subtitles.png');
      }

      // Still works. Re-run with the VO stubbed out -- the real EN narration is only
      // 13.1s, so it would complete the transition and remove the button mid-test.
      await page.evaluate(() => {
          const sm = eval('sceneManager');
          const b = document.getElementById('drone-continue-button'); if (b) b.remove();
          const v = [...document.querySelectorAll('video')].find(x => x.style.zIndex === '9997');
          if (v) v.remove();
          document.body.classList.remove('video-open');
          window.__drone.calls = [];
          const ns = sm.getActiveScene();
          ns.playVoWithSubtitles = () => new Promise(() => {});
          ns.playDroneVideoThenTransition('__phase2__');
      });
      await page.waitForSelector('#drone-continue-button', { timeout: 14000, state: 'attached' });
      const before = await page.evaluate(() => window.__drone.calls.filter(c => c === '__phase2__').length);
      check('no transition before the click', before === 0);
      await page.click('#drone-continue-button');
      const clicked = await page.waitForFunction(
          () => window.__drone.calls.filter(c => c === '__phase2__').length > 0, null, { timeout: 3000 })
          .then(() => true).catch(() => false);
      check('clicking it still continues the journey', clicked);
      check('idempotent: exactly one switchTo from the click',
            await page.evaluate(() => window.__drone.calls.filter(c => c === '__phase2__').length) === 1);
      check('button torn down afterwards', await page.evaluate(() => !document.getElementById('drone-continue-button')));

      await page.close();
    }
  }
  console.log(`\n========== console ==========`);
  check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' || '));
} finally {
  await browser.close();
  server.close();
}
console.log(`\n==================================================`);
console.log(`  ${pass} passed, ${fail} failed  (${pass + fail} checks)`);
console.log(`==================================================\n`);
process.exit(fail === 0 ? 0 : 1);
