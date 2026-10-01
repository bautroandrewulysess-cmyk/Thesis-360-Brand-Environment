#!/usr/bin/env node
/**
 * Verify the drone-video rescue paths (nursery -> street view).
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
const PORT = 8137;
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
        console.log(`\n================ ${lang.toUpperCase()} ================`);
        const page = await browser.newPage();
        await page.route(`${R2_ORIGIN}/**`, assetRoute);
        page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${lang}] ${m.text()}`); });
        page.on('pageerror', (e) => consoleErrors.push(`[${lang}] PAGEERROR ${e.message}`));
        page.on('response', (r) => { if (r.status() >= 400 && r.status() < 500) bad4xx.push(`[${lang}] ${r.status()} ${r.url()}`); });

        await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction(() => { try { return typeof eval('sceneManager') === 'object'; } catch { return false; } }, null, { timeout: 90000 });
        await page.evaluate(() => { try { if (!app._inFrameUpdate && !app.frame) app.start(); } catch { /* started */ } });
        await page.evaluate((l) => {
            window.currentLanguage = l;
            try { sessionStorage.setItem('language', l); } catch { /* non-fatal */ }
        }, lang);
        await page.evaluate(() => eval('sceneManager').switchTo('nursery', null));
        await page.waitForFunction(() => {
            try {
                const sm = eval('sceneManager');
                return sm.activeScene?.name === 'nursery' && sm.getActiveScene()?.isLoaded && !eval('appState').isTransitioning;
            } catch { return false; }
        }, null, { timeout: 600000 });
        console.log(`  nursery loaded`);

        // Spy harness installed once; each case resets it.
        await page.evaluate(() => {
            const sm = eval('sceneManager');
            window.__drone = { calls: [], t0: 0 };
            if (!sm.__origSwitchTo) {
                sm.__origSwitchTo = sm.switchTo.bind(sm);
                sm.switchTo = (scene, spawn) => {
                    if (scene === 'street-view' && window.__drone.t0) {
                        window.__drone.calls.push({ scene, at: performance.now() - window.__drone.t0 });
                        return Promise.resolve();   // neutered: street-view never loads
                    }
                    return sm.__origSwitchTo(scene, spawn);
                };
            }
            const ns = sm.getActiveScene();
            ns.__origVo = ns.playVoWithSubtitles.bind(ns);
            window.__droneVideo = () => [...document.querySelectorAll('video')]
                .find(v => v.style.zIndex === '9997') || null;
        });

        const startCase = (opts) => page.evaluate((o) => {
            const sm = eval('sceneManager');
            const ns = sm.getActiveScene();
            window.__drone = { calls: [], t0: performance.now(), log: [] };
            // Stub the VO where the test needs the rescue path to be the only way out.
            ns.playVoWithSubtitles = o.hangVo ? (() => new Promise(() => {})) : ns.__origVo;
            if (o.rejectPlay) {
                if (!HTMLMediaElement.prototype.__origPlay) {
                    HTMLMediaElement.prototype.__origPlay = HTMLMediaElement.prototype.play;
                }
                HTMLMediaElement.prototype.play = function () {
                    if (this.tagName === 'VIDEO') {
                        window.__drone.log.push(`play() refused muted=${this.muted}`);
                        return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
                    }
                    return HTMLMediaElement.prototype.__origPlay.call(this);
                };
            } else if (HTMLMediaElement.prototype.__origPlay) {
                HTMLMediaElement.prototype.play = HTMLMediaElement.prototype.__origPlay;
            }
            ns.playDroneVideoThenTransition(null);
        }, opts);

        const waitSwitch = async (ms) => {
            try {
                await page.waitForFunction(() => window.__drone.calls.length > 0, null, { timeout: ms });
                return await page.evaluate(() => window.__drone.calls[0].at / 1000);
            } catch { return null; }
        };

        // ---------------------------------------------- A: normal play
        console.log(`\n  -- A normal play --`);
        await startCase({ hangVo: false, rejectPlay: false });
        const aPlayed = await page.waitForFunction(
            () => { const v = window.__droneVideo(); return v && v.currentTime > 0.3; },
            null, { timeout: 30000 }).then(() => true).catch(() => false);
        check('A video actually plays', aPlayed);
        const aAt = await waitSwitch(35000);
        check('A transitions to street-view', aAt !== null, aAt !== null ? `${aAt.toFixed(2)}s` : 'never');
        const aEnded = await page.evaluate(() => { const v = window.__droneVideo(); return v ? v.ended : 'gone'; });
        console.log(`        video.ended at transition: ${aEnded}`);
        await page.evaluate(() => { const v = window.__droneVideo(); if (v) v.remove(); document.body.classList.remove('video-open'); });

        // ---------------------------------------------- B: forced pause
        console.log(`\n  -- B forced pause at ~3s --`);
        await startCase({ hangVo: true, rejectPlay: false });
        await page.waitForFunction(() => { const v = window.__droneVideo(); return v && v.currentTime >= 3; }, null, { timeout: 40000 });
        const bPause = await page.evaluate(() => {
            const v = window.__droneVideo();
            v.pause();
            window.__drone.pausedAt = performance.now() - window.__drone.t0;
            return { ct: v.currentTime, paused: v.paused };
        });
        check('B video is paused mid-stream', bPause.paused === true, `t=${bPause.ct.toFixed(2)}s`);
        const bAt = await waitSwitch(20000);
        const bPausedAt = await page.evaluate(() => window.__drone.pausedAt / 1000);
        const bDelta = bAt !== null ? bAt - bPausedAt : null;
        check('B transitions despite the pause', bAt !== null);
        check('B does so within ~8s of the pause', bDelta !== null && bDelta >= 6 && bDelta <= 11,
              bDelta !== null ? `${bDelta.toFixed(2)}s after pause` : 'never');
        await page.evaluate(() => { const v = window.__droneVideo(); if (v) v.remove(); document.body.classList.remove('video-open'); });

        // ---------------------------------------------- C: play() rejects
        console.log(`\n  -- C play() rejects --`);
        await startCase({ hangVo: true, rejectPlay: true });
        const cAt = await waitSwitch(15000);
        check('C transitions when play() is refused', cAt !== null, cAt !== null ? `${cAt.toFixed(2)}s` : 'never');
        check('C does so promptly, not on the 8s watchdog', cAt !== null && cAt < 3, cAt !== null ? `${cAt.toFixed(2)}s` : '-');
        const cLog = await page.evaluate(() => window.__drone.log);
        check('C retried once muted before giving up',
              cLog.some(l => l.includes('muted=false')) && cLog.some(l => l.includes('muted=true')),
              cLog.join(' | '));
        await page.evaluate(() => {
            if (HTMLMediaElement.prototype.__origPlay) HTMLMediaElement.prototype.play = HTMLMediaElement.prototype.__origPlay;
            const v = window.__droneVideo(); if (v) v.remove();
            document.body.classList.remove('video-open');
        });

        // ---------------------------------------------- D: Continue button
        console.log(`\n  -- D Continue button --`);
        await startCase({ hangVo: true, rejectPlay: false });
        const noBtnEarly = await page.evaluate(() => !document.getElementById('drone-continue-button'));
        check('D button absent at t=0', noBtnEarly);
        const btnAppeared = await page.waitForSelector('#drone-continue-button', { timeout: 12000, state: 'attached' })
            .then(() => true).catch(() => false);
        const btnAt = await page.evaluate(() => performance.now() / 1000);
        check('D button appears', btnAppeared);
        const btnInfo = await page.evaluate(() => {
            const b = document.getElementById('drone-continue-button');
            if (!b) return null;
            const r = b.getBoundingClientRect();
            const cs = getComputedStyle(b);
            return {
                text: b.textContent, z: cs.zIndex, vis: cs.visibility, disp: cs.display,
                w: Math.round(r.width), h: Math.round(r.height),
                inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
                onTop: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b,
            };
        });
        check('D button label is right for the language',
              btnInfo && btnInfo.text === (lang === 'en' ? 'Continue' : 'Padayon'),
              btnInfo ? btnInfo.text : 'no button');
        check('D button is visible and on top', btnInfo && btnInfo.inView && btnInfo.onTop
              && btnInfo.vis === 'visible' && btnInfo.w > 0 && btnInfo.h > 0,
              btnInfo ? `z=${btnInfo.z} ${btnInfo.w}x${btnInfo.h} onTop=${btnInfo.onTop}` : '-');
        const beforeClick = await page.evaluate(() => window.__drone.calls.length);
        check('D no transition before the click', beforeClick === 0);
        await page.click('#drone-continue-button');
        const dAt = await waitSwitch(3000);
        check('D clicking it continues the journey', dAt !== null, dAt !== null ? `${dAt.toFixed(2)}s` : 'never');
        const btnGone = await page.evaluate(() => !document.getElementById('drone-continue-button'));
        check('D button is torn down afterwards', btnGone);
        const dOnce = await page.evaluate(() => window.__drone.calls.length);
        check('D idempotent: exactly one switchTo', dOnce === 1, `${dOnce} call(s)`);
        await page.evaluate(() => { const v = window.__droneVideo(); if (v) v.remove(); document.body.classList.remove('video-open'); });

        await page.close();
    }

    console.log(`\n================ console / network ================`);
    check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' || '));
    check('no 4xx responses', bad4xx.length === 0, bad4xx.slice(0, 5).join(' || '));
} finally {
    await browser.close();
    server.close();
}

console.log(`\n==================================================`);
console.log(`  ${pass} passed, ${fail} failed  (${pass + fail} checks)`);
console.log(`==================================================\n`);
process.exit(fail === 0 ? 0 : 1);
