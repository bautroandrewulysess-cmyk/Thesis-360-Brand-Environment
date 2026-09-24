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
   changed → bump each. `?v=` is currently **46**, `SUBTITLE_VERSION` is **6**,
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
score tracking of first-try answers + keychain reward for a near-perfect first run ·
nursery VO recut from the new single-take recordings, with regenerated EN/BIS subtitles ·
testimony now points at `testimony_v2.mp4` · cafe splat warm-up removed · farm close-up
orb moved beside the forward disc (scale 0.95, radius 0.67, commit `11b0890`) · brewing
subtitles retimed in **both** languages — `steps_en_01` and `steps_bis_01` uploaded to R2
and verified live, ending ~1:16 / ~1:18.

Earlier rounds: quiz encouragement line · farm walk shortened to
`toFarm1-2-4-6-7-8-9-11-13-14` · context narration gating "Begin" · first-entry tutorial ·
"How to Explore" with real badge art · orb type badges (ⓘ / ▶ / exit) · disc direction
arrows + "To Harvest" · farm close-up beam + magnifier badge · splats decimated
(cafe-interior / roastery / cafe-exterior 2M, nursery 3M) · harvesting narrated by the
video in both languages · testimony video after brewing · harvesting quiz at narration end.

## Outstanding

- **Bisaya pass on every `// DRAFT` string in `scenes/strings.js`** (42 marked). These
  ship today as machine-drafted Cebuano and need a native review.
- **`WINNER_FORM_URL` is empty** (`main.js:17`), so the score screen shows the claim code
  with no form link. Fill it in when the form exists.
- **"Back to the Cafe" truncates in the progress pill** — the longest stage label does not
  fit.
- **Plant slot is empty before the first quiz** — the coffee-tree reward area renders blank
  until stage 1 is earned.
- **Two pre-existing bottom-band overlaps**: clue × subtitle at 800 px height, and
  nav-prompt × subtitle at 900 px width. Both predate Phase 4/5.
- **Full six-quiz live playthrough not yet done** — scoring has only been exercised across
  two quizzes in one run, never all six end to end.

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
