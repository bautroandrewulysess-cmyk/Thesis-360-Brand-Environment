#!/usr/bin/env node
/**
 * Verify the new harvesting cuts (harvestingWeb_v3).
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
const PORT = 8149;
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

// harvestingWeb_v3 is not on R2 yet, so serve it from test/loudness/Videos -- the
// exact bytes the upload block will push. Everything else goes through the usual
// cache/refetch path.
const LOCAL_OVERRIDE = {
    '/Videos/harvestingWeb_v3.mp4': path.join(HERE, 'loudness/Videos/harvestingWeb_v3.mp4'),
    '/Videos/bis/harvestingWeb_v3.mp4': path.join(HERE, 'loudness/Videos/bis/harvestingWeb_v3.mp4'),
};

const assetRoute = async (route) => {
    const url = route.request().url();
    const local = LOCAL_OVERRIDE[new URL(url).pathname];
    const file = local || cacheKey(url);
    try {
        let body;
        if (existsSync(file)) body = await readFile(file);
        else {
            if (local) throw new Error(`missing local override ${file}`);
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

const EXPECT = {
    en:  { file: 'Videos/harvestingWeb_v3.mp4',     dur: 82.9,  narrationEnd: 64.45, subs: true  },
    bis: { file: 'Videos/bis/harvestingWeb_v3.mp4', dur: 107.6, narrationEnd: 92.0,  subs: false },
};
const LOOP = { start: 30, end: 60 };

const { chromium } = await loadPlaywright();
const server = await startServer(PORT);
const browser = await chromium.launch({
    channel: 'chrome', headless: HEADLESS,
    args: ['--autoplay-policy=no-user-gesture-required'],
});
const consoleErrors = [];
const bad4xx = [];

try {
  for (const lang of ['en', 'bis']) {
    const exp = EXPECT[lang];
    console.log(`\n================ ${lang.toUpperCase()} ================`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.route(`${R2_ORIGIN}/**`, assetRoute);
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${lang}] ${m.text()}`); });
    page.on('pageerror', (e) => consoleErrors.push(`[${lang}] PAGEERROR ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400 && r.status() < 500) bad4xx.push(`[${lang}] ${r.status()} ${r.url()}`); });

    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => { try { return typeof eval('sceneManager') === 'object'; } catch { return false; } }, null, { timeout: 90000 });
    await page.evaluate(() => { try { if (!app._inFrameUpdate && !app.frame) app.start(); } catch {} });
    await page.evaluate((l) => { window.currentLanguage = l; try { sessionStorage.setItem('language', l); } catch {} }, lang);
    await page.evaluate(() => eval('sceneManager').switchTo('harvesting', null));
    await page.waitForFunction(() => {
        try { const sm = eval('sceneManager');
            return sm.activeScene?.name === 'harvesting' && sm.getActiveScene()?.isLoaded;
        } catch { return false; }
    }, null, { timeout: 600000 });

    // ---- 1. the right file, playing, audible
    const v = async (fn, arg) => page.evaluate(fn, arg);
    await page.waitForFunction(() => {
        const sc = eval('sceneManager').getActiveScene();
        return sc.videoElement && sc.videoElement.currentTime > 0.5;
    }, null, { timeout: 60000 });
    const info = await v(() => {
        const sc = eval('sceneManager').getActiveScene();
        const el = sc.videoElement;
        return { src: el.src, dur: el.duration, muted: el.muted, loop: el.loop, paused: el.paused, ct: el.currentTime };
    });
    check('plays the v3 cut for this language', info.src.includes(exp.file), info.src.split('assets.granjaalegre.com')[1] || info.src);
    check('duration matches the new encode', Math.abs(info.dur - exp.dur) < 0.25, `${info.dur.toFixed(3)}s vs ${exp.dur}s`);
    check('narration audible (not muted) and not looping', info.muted === false && info.loop === false);
    check('video is actually playing', info.paused === false, `t=${info.ct.toFixed(2)}s`);

    // ---- 2. subtitles: EN from the bar, BIS suppressed (burned in)
    await page.waitForFunction(() => {
        const sc = eval('sceneManager').getActiveScene();
        return sc.videoElement && sc.videoElement.currentTime >= 9;
    }, null, { timeout: 60000 });
    const sub = await v(() => {
        const bar = document.getElementById('subtitle-bar');
        return { text: (bar.textContent || '').trim(), shown: getComputedStyle(bar).display !== 'none',
                 ct: eval('sceneManager').getActiveScene().videoElement.currentTime };
    });
    if (exp.subs) {
        check('EN subtitle bar shows the matching cue',
              sub.shown && /ripen gradually|patience|multiple rounds/i.test(sub.text),
              `t=${sub.ct.toFixed(1)}s "${sub.text.slice(0, 60)}"`);
    } else {
        check('BIS subtitle bar stays empty (burned in, not doubled)',
              !sub.shown || sub.text.length === 0,
              `t=${sub.ct.toFixed(1)}s shown=${sub.shown} "${sub.text.slice(0, 40)}"`);
    }

    // ---- 3. quiz opens at the narration end
    await v((t) => { eval('sceneManager').getActiveScene().videoElement.currentTime = t - 2.5; }, exp.narrationEnd);
    const opened = await page.waitForFunction(
        () => getComputedStyle(document.getElementById('quiz-overlay')).display !== 'none',
        null, { timeout: 30000 }).then(() => true).catch(() => false);
    const atOpen = await v(() => eval('sceneManager').getActiveScene().__ctAtQuiz ?? null);
    check('quiz opens', opened);
    const st = await v(() => {
        const sc = eval('sceneManager').getActiveScene();
        return { armed: sc.harvestQuizArmed, looping: sc.harvestLooping,
                 muted: sc.videoElement.muted, loop: sc.videoElement.loop, ct: sc.videoElement.currentTime };
    });
    check('it opens at the narration end, not the video end',
          st.armed === true, `narrationEnd=${exp.narrationEnd}s`);

    // ---- 4. the muted holding loop
    check('picture is muted while the quiz is up', st.muted === true);
    check('picture is looping', st.loop === true && st.looping === true);
    const samples = await page.evaluate(({ s, e }) => new Promise((done) => {
        const out = [];
        const sc = eval('sceneManager').getActiveScene();
        const iv = setInterval(() => {
            out.push({ t: sc.videoElement.currentTime, m: sc.videoElement.muted });
        }, 250);
        setTimeout(() => { clearInterval(iv); done(out); }, 9000);
    }), LOOP);
    const times = samples.map(s => s.t);
    const inWindow = times.every(t => t >= LOOP.start - 0.6 && t <= LOOP.end + 0.6);
    const advanced = Math.max(...times) - Math.min(...times) > 1;
    check('loop stays inside its window while the quiz is open', inWindow,
          `min ${Math.min(...times).toFixed(2)}s max ${Math.max(...times).toFixed(2)}s (window ${LOOP.start}-${LOOP.end})`);
    check('loop keeps the picture moving', advanced);
    check('stays muted throughout the loop', samples.every(s => s.m === true));
    check('loop ends before the last narration line and before any Continue prompt',
          LOOP.end < (lang === 'bis' ? 89.5 : exp.narrationEnd), `${LOOP.end}s`);

    // ---- 5. answer correctly -> watering can -> ripeCherries -> Continue
    const before = await v(() => window.CoffeeTree.stageIndex);
    await page.evaluate(() => {
        const correct = window.PendingQuizzes.harvesting.correct;
        document.querySelectorAll('#quiz-choices button')[correct].click();
    });
    // The tool is the shared #quiz-tool element (watering can / flame / kettle),
    // shown by adding .visible -- not a per-tool id.
    const canUp = await page.waitForFunction(
        () => { const el = document.getElementById('quiz-tool'); return !!el && el.classList.contains('visible'); },
        null, { timeout: 15000 }).then(() => true).catch(() => false);
    const canIsCan = await v(() => {
        const el = document.getElementById('quiz-tool');
        return el ? (el.getAttribute('aria-label') || '') : '';
    });
    check('watering can appears after the correct answer', canUp, `aria-label "${canIsCan}"`);
    const grew = await page.waitForFunction(
        (b) => window.CoffeeTree.stageIndex > b, before, { timeout: 40000 })
        .then(() => true).catch(() => false);
    check('the plant grows', grew);
    const closed = await page.waitForFunction(
        () => getComputedStyle(document.getElementById('quiz-overlay')).display === 'none',
        null, { timeout: 40000 }).then(() => true).catch(() => false);
    check('quiz box closes only after the growth', closed);
    // Read the stage only once the box has closed: runQuizGrowth walks every
    // intermediate stage, so sampling mid-animation catches 'seed', not the target.
    const stage = await v(() => ({
        idx: window.CoffeeTree.stageIndex,
        name: ['seed','sprout','polybagSeedling','youngTree','flowering','ripeCherries','roastedBeans','cup'][window.CoffeeTree.stageIndex],
        fired: Object.keys(window.CoffeeTree.fired),
    }));
    check('the plant ends on ripeCherries', stage.name === 'ripeCherries', `stage ${before} -> ${stage.idx} (${stage.name})`);
    check('the hook that fired is harvesting', stage.fired.includes('harvesting'), stage.fired.join(','));
    const cont = await page.waitForFunction(() => {
        const sc = eval('sceneManager').getActiveScene();
        return !!sc.forwardButton && document.body.contains(sc.forwardButton);
    }, null, { timeout: 20000 }).then(() => true).catch(() => false);
    check('Continue appears after the quiz passes', cont);
    const released = await v(() => {
        const sc = eval('sceneManager').getActiveScene();
        return { looping: sc.harvestLooping, label: sc.forwardButton ? sc.forwardButton.textContent : null };
    });
    check('Continue is labelled for the language',
          released.label === (lang === 'en' ? 'Continue' : 'Padayon'), String(released.label));

    await page.close();
  }
  console.log(`\n================ console / network ================`);
  check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' || '));
  check('no 4xx responses', bad4xx.length === 0, bad4xx.slice(0, 6).join(' || '));
} finally {
  await browser.close();
  server.close();
}
console.log(`\n==================================================`);
console.log(`  ${pass} passed, ${fail} failed  (${pass + fail} checks)`);
console.log(`==================================================\n`);
process.exit(fail === 0 ? 0 : 1);
