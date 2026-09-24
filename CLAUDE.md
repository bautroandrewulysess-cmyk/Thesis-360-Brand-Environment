# Granja Alegre — 360° coffee tour

PlayCanvas + Gaussian splats, deployed at **https://granjaalegre.com**. Bilingual
**en / bis** (Cebuano), fully localised. Assets live on Cloudflare R2 at
`https://assets.granjaalegre.com` (~870 MB). No build step: `index.html` loads plain
`<script>` files.

**This file auto-loads as project instructions at the start of every session, so it
is not an ordinary doc — anything written here is read as a standing instruction.
If it goes missing from the working tree, restore it (`git checkout -- CLAUDE.md`)
before doing anything else, because a session started without it silently loses
every rule below.**

## Layout

| Path | What |
|---|---|
| `index.html` | Landing → context → language → brand story chain, all overlay markup and CSS, the 10 versioned `<script>` tags |
| `main.js` | `sceneManager`, base `Scene` class, `RaycastSystem`, `showVideoPopup`, quizzes, VO playback + subtitles, splat preload |
| `scenes/strings.js` | Every UI string, `{ en, bis }`. Looked up with `t('key')` |
| `scenes/voData.js` | `VoSegments` — per-scene narration order and gate types. `VoMissingNonEn` = segments with no Bisaya recording |
| `scenes/quizData.js` | `PendingQuizzes` |
| `scenes/cafeInterior.js` `cafeExterior.js` `nursery.js` `roastery.js` | Splat scenes with orb hotspots |
| `scenes/streetView.js` | 360-photo farm walk. Discs, not orbs. **Fenced — see rules** |
| `scenes/videoScene.js` | Full-screen video scene type. Only `harvesting` uses it |
| `test/harness.mjs` | Local test harness (below) |

Scenes are constructed **once** at load and reused; instance state survives
unload/reload.

## Hard rules — each of these was learned by breaking something

1. **Never patch `R2_BASE`**, not even temporarily. A debug patch shipped once and took
   the live site down.
2. **Always read `git diff` before committing.**
3. **Cache busting — three independent knobs, all in `main.js`/`index.html`.**
   JS or HTML changed → bump `?v=` on **all 11** script tags in `index.html`.
   VTT *content* changed → bump `SUBTITLE_VERSION`. **VO audio content changed → bump
   `VO_VERSION`** (VO mp3s are served with no `cache-control`, only an etag, so a
   replaced recording can otherwise be served stale from cache indefinitely). Several
   changed → bump each. `?v=` is currently **54**, `SUBTITLE_VERSION` is **6**,
   `VO_VERSION` is **1**.
4. **Splats and videos carry `immutable` cache headers.** Never overwrite in place —
   returning visitors would stay on the old file for a month. Upload under a **new
   filename** (`_v2`, `_v3`) and keep the old one as a rollback path.
5. **After uploading to R2, verify by downloading and probing** — `ffprobe` the URL and
   check duration/codec. `HEAD` has reported a new `content-length` while ranged GETs
   still served stale bytes. Purge the CDN path after replacing a file.
6. **`streetView.js` arrow `label` fields are control flow, not display text.** They are
   read with `.includes('Back')` to pick arrow colour and drive gates. Never translate or
   rename them.
7. **Never `pkill` Chrome by name.** Only close browsers you launched (`ctx.close()`).
8. Videos must be **h264, not HEVC** — HEVC fails silently in most browsers.

## Working standard

- **Report before implementing** anything non-trivial; wait for approval.
- **Mark every claim measured or inferred.** Never present a guess as a result.
- If something couldn't be reached or tested, **say so plainly** and say why.
- If a measurement contradicts an earlier conclusion, **correct it explicitly**.

## Testing traps (all hit for real in this project)

- **The harness did not render until recently.** It drives `sceneManager` directly and
  never calls `startup()`, so `app.start()` never ran — screenshots came back black while
  state and DOM looked fine. Now fixed in `harness.mjs`; any *new* driver must do the same.
- **Headless drops subtitle cues.** Headless software rendering starved the main thread
  and dispatched only 3 of 14 `cuechange` events with lags to 14 s. Headed on a real GPU:
  **all cues, 1–10 ms**. Use **headed** for any timing or subtitle check.
- **`elementFromPoint` skips `pointer-events:none`.** `#subtitle-bar`, `#nav-prompt` and
  `.hotspot-label` all have it, so hit-testing them returns whatever is behind and reads
  as a false failure. Use z-index + computed visibility instead.
- **Polling from the page starves during video decode.** Sampling the DOM in a
  `setInterval` gave "first cue at 16 s" when it was really 0.003 s. Measure inside the
  event handler (`cuechange`, `playing`) instead.
- **`switchTo()` only reaches scene-idle states.** Gates, quizzes and videos need the real
  click-through or a direct handler call. Jumping out of a scene mid-VO also orphans its
  gate marker — an artifact of the jump, not a real bug.
- **The harness disk cache shadows R2.** A stale cached asset silently wins. Use a new
  filename or `--clear-cache` (slow: ~800 MB).
- **Clicks are ray-vs-sphere against a registered radius, never mesh.** Visual size and
  click size are independent; decorative children cannot intercept clicks.
- **`entity.update` is never called.** Only `activeScene.update(deltaTime)` runs. Anything
  animated must be driven from the scene loop.
- **`meshInstances[0].layer = id` is a no-op** in this PlayCanvas version.
- **Immediate/UI layer entities must have mesh instances removed before destroy**, children
  included — use `releaseImmediateEntity()` in `streetView.js`. Leftovers caused a
  stray-disc bug.
- **`curl -I` (HEAD) reports `cf-cache-status: DYNAMIC`** even when real GETs return `HIT`.
  Edge caching *is* working; test with a GET.

## Running the harness

```bash
node test/harness.mjs <scene> [en|bis] [--headless] [--clear-cache] [--port=N]
# scenes: cafe-interior cafe-exterior nursery street-view harvesting roastery
```
Intercepts R2 via `page.route()` and disk-caches to `test/.asset-cache/`. Warm runs ~6 s.
**It never modifies app source** — that is deliberate.

For live testing, serve the repo (`python3 -m http.server 8000`) so HTML/JS are local while
assets still come from real R2 — this preserves genuine network timing. `localhost:8000` is
already allow-listed in `cors.json`. Playwright lives only in the npx cache; load it with
`createRequire` from `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright` (matches the
installed browser revision 1234).

## Done this round

Phase 4 — progress pill + coffee-tree reward with real stage art · Phase 5 — arrow-key
±10 s seeking (tutorial teaches the keys; brand story seekable) and per-scene summaries ·
nursery VO recut from the new single-take recordings, with regenerated EN/BIS subtitles ·
testimony now points at `testimony_v2.mp4` · farm close-up orb moved beside the forward
disc (scale 0.95, radius 0.67, `11b0890`) · brewing subtitles retimed in **both**
languages, live and ending ~1:16 / ~1:18.

Then, this round:

- **Café splat warm-up restored and re-timed.** `2f98179` removed it; that was reverted
  (`f52415c`) because the café loading screen measured ≥87.5 s without it. It now starts
  with the **last** brand-story segment (`e0dc53f`) rather than on Enter, so its 23.6 MB
  no longer competes with the narration's own downloads. Verified: one fetch, fired once.
- **Brand-story VO watchdog** (`01aaf34`). A segment that never fires `ended` left the
  player with no gate to click. Two triggers, both requiring the audio to be playing —
  no progress for 5 s, or outliving its remaining time by 5 s — routed through the
  already-idempotent `handleEnd`. It has fired for real on a degraded connection.
- **Info popup clamped inside the viewport, and Escape closes it** (`d21d7d8`). A
  right-edge orb used to put the ✕ off screen with no way to dismiss.
- **Quiz encouragement clears on a correct answer** (`8f333ce`).
- **Plant slot hidden until the first stage is earned** (`03dfc06`).
- **Bisaya pass landed** (`cbdc9ec`). All 42 `// DRAFT bis` markers gone; the 21 entries
  that were English copied into the `bis` slot are now genuinely translated.
- **Score screen reworked** (`b9200ab`, `e676536`). Winning now requires a first-try
  result for all seven questions across the six quiz sets, not just ≤1 wrong — a 0/0 run
  used to win. Tally line and claim code removed in favour of a direct instruction to
  message the organiser; panel made fully opaque.
- **Context screen intro** (`ef3a68a`, `7f577c0`). Eyebrow, title and a two-sentence line
  above How to Explore, wording condensed from `VO/contextIntro.mp3`. English only —
  the language picker is the next screen. Card fits without scrolling at 900 and 800.
- **The two unreachable summaries now show** (`12aba8c`). `brandStoryIntro` runs after
  the last brand-story gate; `journeyToFarm` rides along with the farm's as a second
  section of one panel.

## Outstanding

Everything below is **pending live verification**, not known-broken. The café splat has
repeatedly failed to download on this connection (`ERR_HTTP2_PROTOCOL_ERROR`, and VO mp3s
measured at 3.6 KB/s against 874 KB/s for large files), so the scenes past the café have
not been reached end to end this round.

- **Café interior load time.** Best measurement is **≥87.5 s** cold, and that is a lower
  bound. Needs one cold run on a known-good connection, timing `#loading-screen` from the
  brand-story gate click to `opacity:0`.
- **Full six-quiz playthrough.** Scoring has been exercised two quizzes deep in a live run
  and across every win/lose case by rendering the panel directly, but never all seven
  questions in one real run.
- **Coffee tree, five of six hooks.** Only `cafeInterior → seed` has been seen live. The
  other five are wired and mapped but unobserved.
- **Nursery VO recut, both languages** — needs the nursery reached in EN and BIS, with all
  three gates firing against the real BIS durations (15.09 / 34.00 / 31.31).
- **Harvesting quiz timing + muted 30–60 s loop** — code is in `videoScene.js`
  (`HARVEST_LOOP`), unobserved.
- **Farm close-up placement** — shipped in `11b0890`, not re-walked since.
- **Brewing → testimony seam** — the ~1 s café flash between the two videos is documented
  below but has not been re-checked since `testimony_v2`.
- **`WINNER_FORM_URL` is empty** (`main.js`), so no form button renders. The claim message
  stands alone, which is the intended fallback. Fill it in when the form exists.
- **Progress pill truncates.** "Back to the Cafe" in English; in Bisaya *two* labels clip —
  `Padulong sa Uma` (106px into 84px) and `Balik sa Kapehan` (103px).
- **Two pre-existing bottom-band overlaps**: clue × subtitle at 800 px height, and
  nav-prompt × subtitle at 900 px width.
- **`dur` in `voData.js` is dead data.** Written 25×, read nowhere, and it equals the
  **English** duration — 11 of 24 Bisaya recordings exceed it by >5 s (worst:
  `harvesting_en_01`, 65.00 declared vs 98.43 actual). Harmless today; a trap for anyone
  who later budgets a timer from it. Rename to `durEn` or delete.
- **`SUBTITLE_VERSION` may need a bump.** It is **6**, and the retimed brewing VTTs are
  live at `?v=6`. New visitors get the correct file; anyone who cached the old one at the
  same version keeps the stale timings.

## Known open issues

- `VO/harvesting_en_02.mp3` and `Subtitles/harvesting_en_02.vtt` are **orphans on R2**
  (both still 200) — safe to delete, nothing references them.
- `toFarm3/5/10/12.jpg` (~8 MB) are orphans on R2 from the walk shortening.
- `_optimized` and `_v2` nursery splats remain on R2 as rollback paths.
- Bisaya gets the **English testimony video** deliberately until a Bisaya cut exists —
  switch `assetUrl` to `videoUrl` in `cafeInterior.playTestimonyThenResume()` then.
- `index.html` sends **no `ETag`/`Last-Modified`**, so it is re-downloaded in full every
  visit (~66 KB). Harmless, but means 304s never happen.
- The Bisaya harvesting video carries its own burned-in "click Continue" prompt from ~92 s.
- `~1 s` of café shows between the brewing and testimony videos (fade out, then in).
