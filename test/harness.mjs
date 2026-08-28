#!/usr/bin/env node
/**
 * Local test harness — run the experience from the working tree, without pushing.
 *
 *   node test/harness.mjs <scene> [en|bis] [--headless] [--clear-cache] [--port N]
 *
 *   node test/harness.mjs roastery bis
 *   node test/harness.mjs street-view en
 *
 * Why this exists:
 *   - R2 rejects CORS from localhost, so assets are intercepted with page.route()
 *     and refetched server-side, where CORS does not apply. The app source is NEVER
 *     modified — in particular R2_BASE is left alone, because patching it once got
 *     committed and took the live site down.
 *   - Splats are ~50MB. Intercepted responses are cached under test/.asset-cache/
 *     so repeat runs are fast.
 *
 * The browser stays open for inspection until Ctrl-C unless --headless is passed.
 * Cleanup only ever touches the browser this script launched.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const CACHE_DIR = path.join(HERE, '.asset-cache');
const R2_ORIGIN = 'https://assets.granjaalegre.com';

const SCENES = ['cafe-interior', 'cafe-exterior', 'nursery', 'street-view', 'harvesting', 'roastery'];
const LANGS = ['en', 'bis'];

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.vtt': 'text/vtt', '.svg': 'image/svg+xml', '.sog': 'application/octet-stream',
};

// ---------------------------------------------------------------- args
function parseArgs(argv) {
    const flags = new Set(argv.filter(a => a.startsWith('--')));
    const positional = argv.filter(a => !a.startsWith('--'));
    const portFlag = argv.find(a => a.startsWith('--port'));
    const scene = positional[0];
    const lang = positional[1] || 'en';
    if (!scene || !SCENES.includes(scene)) {
        console.error(`\nUsage: node test/harness.mjs <scene> [en|bis] [--headless] [--clear-cache] [--port N]\n`);
        console.error(`  scenes: ${SCENES.join(', ')}`);
        process.exit(1);
    }
    if (!LANGS.includes(lang)) {
        console.error(`Unknown language "${lang}" — expected one of: ${LANGS.join(', ')}`);
        process.exit(1);
    }
    return {
        scene, lang,
        headless: flags.has('--headless'),
        clearCache: flags.has('--clear-cache'),
        port: portFlag ? Number(portFlag.split('=')[1] || 0) || 8123 : 8123,
    };
}

// ------------------------------------------------- playwright resolution
async function loadPlaywright() {
    try {
        return await import('playwright');
    } catch { /* fall through to the npx cache */ }
    const home = process.env.HOME || '';
    const roots = [path.join(home, '.npm/_npx')];
    for (const root of roots) {
        if (!existsSync(root)) continue;
        const { readdirSync } = await import('node:fs');
        for (const entry of readdirSync(root)) {
            const candidate = path.join(root, entry, 'node_modules/playwright/index.mjs');
            const cjs = path.join(root, entry, 'node_modules/playwright');
            if (existsSync(candidate) || existsSync(cjs)) {
                try { return await import(existsSync(candidate) ? candidate : cjs); } catch { /* keep looking */ }
            }
        }
    }
    console.error('\nPlaywright not found. Install it with:\n  npm i -D playwright\n');
    process.exit(1);
}

// ---------------------------------------------------------- static server
function startServer(port) {
    const server = createServer(async (req, res) => {
        try {
            const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
            const file = path.join(REPO, rel);
            if (!file.startsWith(REPO)) { res.writeHead(403).end('forbidden'); return; }
            const body = await readFile(file);
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
            res.end(body);
        } catch {
            res.writeHead(404).end('not found');
        }
    });
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(port, '127.0.0.1', () => resolve(server));
    });
}

// ------------------------------------------------------ asset interception
const cacheKey = (url) => {
    const rel = decodeURIComponent(new URL(url).pathname.slice(1));
    const safe = rel.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(CACHE_DIR, `${createHash('sha1').update(rel).digest('hex').slice(0, 10)}__${safe}`);
};

function makeAssetRoute(stats) {
    return async (route) => {
        const url = route.request().url();
        const file = cacheKey(url);
        try {
            let body;
            if (existsSync(file)) {
                body = await readFile(file);
                stats.hits++; stats.hitBytes += body.length;
            } else {
                // Server-side fetch: no CORS, no preflight, no source patching.
                const res = await fetch(url, { headers: { 'User-Agent': 'harness' } });
                if (!res.ok) { await route.fulfill({ status: res.status, body: '' }); return; }
                body = Buffer.from(await res.arrayBuffer());
                await mkdir(CACHE_DIR, { recursive: true });
                await writeFile(file, body);
                stats.misses++; stats.missBytes += body.length;
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
        } catch (err) {
            stats.errors++;
            console.error(`  [asset] ${url} -> ${err.message}`);
            try { await route.abort(); } catch { /* already handled */ }
        }
    };
}

// ------------------------------------------------------------------- main
const opts = parseArgs(process.argv.slice(2));
if (opts.clearCache && existsSync(CACHE_DIR)) {
    await rm(CACHE_DIR, { recursive: true, force: true });
    console.log('[harness] asset cache cleared');
}
await mkdir(CACHE_DIR, { recursive: true });

const { chromium } = await loadPlaywright();
const stats = { hits: 0, misses: 0, hitBytes: 0, missBytes: 0, errors: 0 };
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(1);

const server = await startServer(opts.port);
console.log(`[harness] serving ${REPO} on http://127.0.0.1:${opts.port}`);
console.log(`[harness] scene=${opts.scene} lang=${opts.lang} headless=${opts.headless}`);

const browser = await chromium.launch({
    channel: 'chrome',
    headless: opts.headless,
    args: ['--autoplay-policy=no-user-gesture-required'],
});

let closing = false;
async function shutdown(code = 0) {
    if (closing) return;
    closing = true;
    // Only ever close the browser this script launched — never pkill by app name,
    // which would take down the user's own Chrome windows.
    try { await browser.close(); } catch { /* already gone */ }
    try { server.close(); } catch { /* already gone */ }
    const mb = (n) => (n / 1048576).toFixed(1);
    console.log(`\n[harness] cache: ${stats.hits} hits (${mb(stats.hitBytes)}MB), ` +
                `${stats.misses} misses (${mb(stats.missBytes)}MB), ${stats.errors} errors`);
    console.log(`[harness] total ${el()}s`);
    process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const page = await browser.newPage();
await page.route(`${R2_ORIGIN}/**`, makeAssetRoute(stats));

page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' || /\[VO\]|\[Gate\]|\[Scene|\[SceneManager\]/.test(text)) {
        console.log(`  ${el()}s ${m.type() === 'error' ? 'ERR ' : ''}${text.slice(0, 200)}`);
    }
});
page.on('pageerror', (e) => console.log(`  ${el()}s PAGEERROR ${e.message}`));

await page.goto(`http://127.0.0.1:${opts.port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(
    () => { try { return typeof eval('sceneManager') === 'object'; } catch { return false; } },
    null, { timeout: 90000 },
);
console.log(`[harness] app ready at ${el()}s`);

// Language must be set before the jump: scene constructors and quiz getters read it.
await page.evaluate((lang) => {
    window.currentLanguage = lang;
    try { sessionStorage.setItem('language', lang); } catch { /* non-fatal */ }
}, opts.lang);

const tJump = Date.now();
await page.evaluate((scene) => eval('sceneManager').switchTo(scene, null), opts.scene);
await page.waitForFunction((scene) => {
    try {
        const sm = eval('sceneManager');
        return sm.activeScene && sm.activeScene.name === scene
            && sm.getActiveScene()?.isLoaded && !eval('appState').isTransitioning;
    } catch { return false; }
}, opts.scene, { timeout: 600000 });

const loadSeconds = ((Date.now() - tJump) / 1000).toFixed(1);
console.log(`[harness] "${opts.scene}" loaded in ${loadSeconds}s (wall ${el()}s)`);

if (opts.headless) {
    await shutdown(0);
} else {
    console.log('[harness] browser left open — Ctrl-C to close');
}
