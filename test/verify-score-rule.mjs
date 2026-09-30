/**
 * Verifies the prize rule: a player wins ONLY with zero wrong first-try answers
 * across all seven scene-quiz questions. Both languages.
 *
 * Two halves:
 *
 *  A. The decision and the text, driven through the real showScoreEndScreen():
 *       7 right / 0 wrong, first run   -> WIN
 *       6 right / 1 wrong, first run   -> LOSE   (this used to win)
 *       7 right / 0 wrong, replay      -> REPLAY
 *       0 answered,       first run    -> LOSE   (the old 0/0 win, still closed)
 *     and the rendered strings are checked for the new wording and for em dashes.
 *
 *  B. That pass/fail is untouched: in the real cafe quiz, a wrong answer is still
 *     recoverable -- the quiz stays open, the right answer still passes it -- and
 *     the run is scored 1 wrong on the first try, not 0.
 *
 * Same interception model as harness.mjs. Never modifies app source.
 *
 *   node test/verify-score-rule.mjs
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
const PORT = 8143;

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

async function route(r) {
  const url = r.request().url();
  const rel = decodeURIComponent(new URL(url).pathname.slice(1));
  let body;
  const f = cacheKey(rel);
  if (existsSync(f)) body = await readFile(f);
  else {
    const res = await fetch(url, { headers: { 'User-Agent': 'verify' } });
    if (!res.ok) { await r.fulfill({ status: res.status, body: '' }); return; }
    body = Buffer.from(await res.arrayBuffer());
    await mkdir(CACHE_DIR, { recursive: true }); await writeFile(f, body);
  }
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

const checks = [];
const check = (ok, label, detail='') => { checks.push([ok,label,detail]);
  console.log(`  ${ok?'PASS':'FAIL'}  ${label}${detail?'  — '+detail:''}`); };

const EXPECT = {
  en: {
    winTitle: 'You did it! A true coffee expert!',
    winBody: 'You answered every question right on the first try. That earns you a Granja Alegre keychain, your choice of design.',
    loseTitle: 'Journey complete',
    loseBody: 'You made it from seed to cup. Thank you for coming along! The keychain goes to players who answer every question right on the first try, and this time it was just out of reach.',
    replayBody: 'Thanks for coming back. The keychain is for a first run only, so this one is just for the love of coffee.',
    claim: 'Message Andrew Ulysess E. Bautro to claim your prize.',
  },
  bis: {
    winTitle: 'Nahimo nimo! Usa ka tinuod nga eksperto sa kape!',
    winBody: 'Natubag nimo og sakto ang tanang pangutana sa unang higayon. Tungod niini, makadawat ka og Granja Alegre keychain, ikaw ang mopili sa disenyo.',
    loseTitle: 'Nahuman ang panaw',
    loseBody: 'Naabot nimo gikan sa liso ngadto sa tasa. Salamat sa imong pag-uban! Ang keychain para sa mga nakatubag og sakto sa tanang pangutana sa unang higayon, ug niining higayona wala gyud maabot.',
    replayBody: 'Salamat sa imong pagbalik. Ang keychain para lamang sa unang dula, busa kini para na lang sa gugma sa kape.',
    claim: 'I-message si Andrew Ulysess E. Bautro aron makuha ang imong premyo.',
  },
};

// Drive showScoreEndScreen() for one scenario and read the panel back, then dismiss it.
async function scorePanel(page, { correct, wrong, replay }) {
  await page.evaluate(({ correct, wrong, replay }) => {
    window.Score = { firstTryCorrect: correct, firstTryWrong: wrong, seen: {} };
    try {
      if (replay) window.localStorage.setItem('granjaAlegre.runCompleted', '1');
      else window.localStorage.removeItem('granjaAlegre.runCompleted');
    } catch { /* private mode: isFirstRun() then treats every run as first */ }
    window.__scoreDone = false;
    window.showScoreEndScreen().then(() => { window.__scoreDone = true; });
  }, { correct, wrong, replay });
  await page.waitForSelector('#score-panel', { timeout: 15000 });
  const read = await page.evaluate(() => {
    const el = document.getElementById('score-panel');
    return {
      title: el.querySelector('.sc-title').textContent,
      body: el.querySelector('.sc-body').textContent,
      claim: el.querySelector('.sc-claim')?.textContent || null,
      form: !!el.querySelector('.sc-form'),
    };
  });
  await page.evaluate(() => document.querySelector('#score-panel .sc-continue').click());
  await page.waitForFunction(() => window.__scoreDone === true, null, { timeout: 15000 });
  return read;
}

async function run(lang) {
  console.log(`\n=== ${lang.toUpperCase()} ===`);
  const E = EXPECT[lang];
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ channel: 'chrome', headless: false,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route(`${R2}/**`, route);

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => { try { return typeof eval('sceneManager') === 'object'; } catch { return false; } }, null, { timeout: 90000 });
  await page.evaluate(() => { try { if (!app._inFrameUpdate && !app.frame) app.start(); } catch { /* started */ } });
  await page.evaluate((l) => { window.currentLanguage = l; try { sessionStorage.setItem('language', l); } catch { /* non-fatal */ } }, lang);

  const maxWrong = await page.evaluate(() => {
    // SCORE_MAX_WRONG is a module-scope const, not on window; read it where it is used.
    return eval('SCORE_MAX_WRONG');
  });
  check(maxWrong === 0, 'SCORE_MAX_WRONG is 0', `value ${maxWrong}`);

  // ---- A. the three outcomes
  const win = await scorePanel(page, { correct: 7, wrong: 0, replay: false });
  check(win.title === E.winTitle, '7/7 first try, first run -> WIN title', JSON.stringify(win.title));
  check(win.body === E.winBody, 'win body is the new wording', JSON.stringify(win.body.slice(0, 60) + '…'));
  check(win.claim === E.claim, 'claim message unchanged', JSON.stringify(win.claim));
  check(win.form === false, 'no form button (WINNER_FORM_URL still empty)', String(win.form));

  const lose = await scorePanel(page, { correct: 6, wrong: 1, replay: false });
  check(lose.title === E.loseTitle, 'exactly 1 wrong, first run -> LOSE title', JSON.stringify(lose.title));
  check(lose.body === E.loseBody, 'lose body is the new wording', JSON.stringify(lose.body.slice(0, 60) + '…'));
  check(lose.claim === null, 'no claim message on a loss', String(lose.claim));

  const none = await scorePanel(page, { correct: 0, wrong: 0, replay: false });
  check(none.title === E.loseTitle && none.claim === null, '0 answered, first run -> still LOSE',
    JSON.stringify(none.title));

  const replay = await scorePanel(page, { correct: 7, wrong: 0, replay: true });
  check(replay.body === E.replayBody, '7/7 on a replay -> replay message', JSON.stringify(replay.body.slice(0, 50) + '…'));
  check(replay.claim === null, 'no claim message on a replay', String(replay.claim));

  const dashes = [win.title, win.body, lose.title, lose.body].filter(x => /[—–]/.test(x));
  check(dashes.length === 0, 'no em or en dashes in the win/lose text', dashes.join(' | ') || 'none');

  // ---- B. pass/fail logic untouched: wrong answer, then right answer.
  //
  // Any loaded scene will do -- showQuiz lives on Scene.prototype. The cafe is the
  // cheapest to reach, and PendingQuizzes.harvesting is used as the question because
  // its correct index is fixed data (2), not something to guess from localised text.
  // growHook null so no watering can runs and the box closes on its own.
  await page.evaluate(() => eval('sceneManager').switchTo('cafe-interior', null));
  await page.waitForFunction(() => { try { const sm = eval('sceneManager');
    return sm.getActiveScene()?.isLoaded && !eval('appState').isTransitioning;
  } catch { return false; } }, null, { timeout: 600000 });

  const correctIdx = await page.evaluate(() => window.PendingQuizzes.harvesting.correct);
  const wrongIdx = correctIdx === 0 ? 1 : 0;

  await page.evaluate(() => {
    window.Score = { firstTryCorrect: 0, firstTryWrong: 0, seen: {} };
    window.__passed = false;
    const sc = eval('sceneManager').getActiveScene();
    sc.showQuiz(window.PendingQuizzes.harvesting, () => { window.__passed = true; }, null);
  });
  await page.waitForFunction(() => document.querySelectorAll('#quiz-choices button').length > 1,
    null, { timeout: 20000 });

  await page.evaluate((i) => document.querySelectorAll('#quiz-choices button')[i].click(), wrongIdx);
  await page.waitForTimeout(1000);
  const afterWrong = await page.evaluate(() => ({
    open: document.getElementById('quiz-overlay').style.display,
    wrong: window.Score.firstTryWrong, right: window.Score.firstTryCorrect,
    passed: window.__passed,
  }));
  check(afterWrong.open === 'flex', 'a wrong answer leaves the quiz open to retry', `display ${afterWrong.open}`);
  check(afterWrong.passed === false, 'a wrong answer does not pass the quiz', `onPass fired: ${afterWrong.passed}`);
  check(afterWrong.wrong === 1 && afterWrong.right === 0, 'the wrong first try is scored as 1 wrong',
    `correct ${afterWrong.right}, wrong ${afterWrong.wrong}`);

  await page.evaluate((i) => document.querySelectorAll('#quiz-choices button')[i].click(), correctIdx);
  // Poll, do not sleep: the box shows its feedback and then fades before onPass runs,
  // so a fixed 1.5s wait reads a false failure.
  const passedIn = await page.waitForFunction(() => window.__passed === true, null, { timeout: 30000 })
    .then(() => true).catch(() => false);
  const afterRight = await page.evaluate(() => ({
    wrong: window.Score.firstTryWrong, right: window.Score.firstTryCorrect, passed: window.__passed,
  }));
  check(passedIn && afterRight.passed === true, 'the right answer still passes the quiz after a wrong one',
    `onPass fired: ${afterRight.passed}`);
  check(afterRight.wrong === 1 && afterRight.right === 0,
    'the retry is NOT scored (only first tries count)',
    `correct ${afterRight.right}, wrong ${afterRight.wrong}`);

  check(errors.length === 0, 'zero console errors', errors.slice(0,4).join(' | ') || 'none');
  await browser.close();
}

await run('en');
await run('bis');

server.close();
const pass = checks.filter(c => c[0]).length;
console.log(`\n${pass}/${checks.length} checks passed`);
process.exit(pass === checks.length ? 0 : 1);
