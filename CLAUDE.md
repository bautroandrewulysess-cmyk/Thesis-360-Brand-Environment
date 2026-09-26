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
   changed → bump each. `?v=` is currently **63**, `SUBTITLE_VERSION` is **6**,
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
  filename or `--clear-cache` (slow: ~800 MB). Its key is the URL **path only**, so
  bumping `VO_VERSION` or `SUBTITLE_VERSION` does **not** bust it: a recut VO replays at
  its old length locally. Cost real time once — a Bisaya nursery run measured
  `nursery_bis_01` at 23.8 s from cache while R2 was serving the 15.09 s recut. Delete
  the specific cache entries when a file is replaced in place.
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

### From the last full live check

- **A localhost origin cannot fetch R2 on this machine** — the transfer stalls at about
  0.6 MB. The way through was to serve R2's *real bytes and headers* from a local
  **SPKI-pinned HTTPS host** standing in for `assets.granjaalegre.com`, so the app still
  sees a real HTTPS origin with real cache headers.
- **`page.route()` and `--ignore-certificate-errors` both bypass the HTTP cache.** Any
  measurement of caching, 304s or repeat-visit cost is meaningless under either. The
  SPKI-pinned host above exists precisely so the cache stays live.
- **Click DOM buttons directly** — `.gate-marker-button` and friends. For 3D orbs use
  `ThesisApp.camera.worldToScreen` and **reject behind-camera targets**; a generic
  click-the-nearest-hotspot routine hits decorative ones instead (`yfc-board`).
- **The seek summary is `#scene-summary-panel .ss-continue`**, parented to `<body>` —
  not inside the scene's own overlay tree.
- **The readiness signal is `ThesisApp.sceneManager.activeScene.name`.** Read it with
  `?.` — it is null for a moment mid-transition.

### From the full audit run (driver traps, all cost real time)

- **`switchTo()` before `startup()` leaves the update loop dead.** `startup()` is what
  calls `app.start()`. Jump straight into a scene without it and `activeScene.update()`
  never runs: no tutorial, no journey pill, and `#loading-screen` never gains `.hidden`.
  Three convincing "bugs", all driver artifact. Reach the café through the app's own
  `initializeApp()`.
- **A wrong mini-quiz answer leaves the overlay open by design**, so a driver that
  guesses wrong loops forever. The correct option differs per scene — the nursery's
  (`flowers`) is **a**, the farm's (`monitoring`) is **b**. Read it from
  `getMiniQuizData(ref).correct`, never from a guessed strings key.
- **Not every gate is a `.gate-marker-button`.** The roastery's `roasterVideo` gate
  spawns no button at all: `RoasteryScene.spawnGateMarker` highlights the
  `roasting-beans-transition` orb and returns. Watch `activeScene.highlightedHotspot`.
- **`videoScene` waits on a Continue button** appended straight to `<body>` with no id
  or class — the localised label is the only handle. Without clicking it, harvesting
  never advances to the roastery.
- **Pace with the narration or the farm close-up block looks absent.** It only arms once
  `farm_en_01` has finished; clicking discs every 1.6 s reaches `farm1-5` long before
  that, and nothing blocks. With `voDone` true it holds.
- **Hide every dev surface before a screenshot**, not just the two obvious ones:
  `#travel-menu`, `#disc-values`, `#color-menu`, `#dev-jump-menu`, `#debug-info`. The
  colour-grading and scene-jump panels sat in a whole set of audit screenshots.
- **The score screen is `#score-panel`** from `showScoreEndScreen()` — `#completion-panel`
  is a different, older panel.
- **The drone video is neither `#popup-video` nor `activeScene.videoElement`** — the
  nursery creates its own full-viewport element. `querySelector('video')` returns the
  leftover landing `heroLoop` element, which is muted and looping for its own reasons:
  measuring that says nothing about the scene's footage.

## Running the harness

```bash
node test/harness.mjs <scene> [en|bis] [--headless] [--clear-cache] [--port=N]
# scenes: cafe-interior cafe-exterior nursery street-view harvesting roastery
```
Intercepts R2 via `page.route()` and disk-caches to `test/.asset-cache/`. Warm runs ~6 s.
**It never modifies app source** — that is deliberate.

For live testing, serve the repo (`python3 -m http.server 8000`) so HTML/JS are local.
`localhost:8000` is allow-listed in `cors.json`, **but a localhost origin still cannot pull
R2 on this machine** — it stalls around 0.6 MB, so the old advice that this "preserves
genuine network timing" against real R2 no longer holds. Either intercept R2 the way the
harness does (no HTTP cache) or stand up the local SPKI-pinned HTTPS host that replays R2's
real bytes and headers (keeps the cache live). Playwright lives only in the npx cache; load it with
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
- **The close-up's Back disc now sits where the player is looking** (`315b141`). The one
  arrow at `farm1-closeup` was at yaw -0.1 while `onFarmCloseupOrbClick` forces the camera
  to yaw 171, so the disc was 171° behind the player. Clicks are ray-vs-sphere, so with
  the sphere behind the camera no click anywhere in the viewport could reach it. Measured
  identical at `v2.1` and `11b0890^`: never a regression — unreachable since the close-up
  gained its camera snap. Only the yaw number changed; the label and target are untouched.
- **The two unreachable summaries now show** (`12aba8c`). `brandStoryIntro` runs after
  the last brand-story gate; `journeyToFarm` rides along with the farm's as a second
  section of one panel.

Then, since that was written:

- **Drone-video watchdog** (`d5d9468`). A frozen `droneWeb.mp4` used to strand the
  nursery → walk transition with nothing to click. The journey is now rescued the same
  way the VO is.
- **VO prefetch, within a scene** (`cb7c62f`) — the next segment is warmed while the
  current one plays — **and across scenes** (`7ff1ceb`), where the last segment of a
  scene warms the first segment of the next via `NEXT_VO_SCENE`.
- **`warmableSegmentId()` guard** (`9b0f7ee`), so a Bisaya run does not prefetch segments
  that have no Bisaya recording.
- **Scene-VO stall watchdog** (`528c1dd`), armed at segment start, giving
  `playVoWithSubtitles` the same safety net the brand story already had.
- **The collapsed pill now shrinks its label to fit** (this round). Font steps down from
  0.8rem to a floor of 11px, ellipsis below that; pill padding went 14px → 12px to buy
  the last 3px two Bisaya labels needed. Measured at 1280 and 900 with Inter loaded: all
  7 labels fit in both languages, smallest 11.0px (`Padulong sa Uma`).
- **Both VO watchdogs now stall-trigger before metadata** (this round). The 1s tick was
  re-arming the budget while `duration` was NaN, which re-zeroed the stall counter every
  tick. Measured with a deliberately hung mp3: scene VO 23.1 s → **9.0 s** (EN) /
  **9.1 s** (BIS); brand story **never fired** → **6.1 s** in both. Normal playback over
  25 s in both languages triggers neither.

- **Full audit playthrough, English, all 13 stages PASS** (reproduced twice): context →
  brand story → café → nursery → drone → walk → farm → harvesting → roastery → back to
  café → brewing/testimony → win screen, one wrong answer, 7/7 answered. Bisaya pass
  (context, brand story, café, nursery, harvesting) PASS. **Zero console errors and no
  4xx in either**; every request failure was `ERR_ABORTED` on a video that returns 206.
- **The score screen now suppresses the rest of the UI** (this round). It set no body
  class, so the nav prompt showed behind the win panel.
- **The brewing → testimony seam did not reproduce** with `testimony_v2`: no café frame
  between the two videos at 200 ms sampling, gap 203 ms. A sub-200 ms flash is not ruled
  out.

## Outstanding

Everything below is **pending live verification**, not known-broken. The items struck
this round were verified **locally through the harness** (real clicks, real R2 assets
over `page.route`), which is not the same as a verification on the live site.

- **`WINNER_FORM_URL` is empty** (`main.js`), so no form button renders. The claim message
  stands alone, which is the intended fallback — confirmed on the win screen this round.
  Fill it in when the form exists.
- **Two pre-existing bottom-band overlaps**: clue × subtitle at 800 px height, and
  nav-prompt × subtitle at 900 px width.
- **`dur` in `voData.js` is dead data.** Written 25×, read nowhere, and it equals the
  **English** duration — 11 of 24 Bisaya recordings exceed it by >5 s (worst:
  `harvesting_en_01`, 65.00 declared vs 98.43 actual). Harmless today; a trap for anyone
  who later budgets a timer from it. Rename to `durEn` or delete.
- **`SUBTITLE_VERSION` may need a bump.** It is **6**, and the retimed brewing VTTs are
  live at `?v=6`. New visitors get the correct file; anyone who cached the old one at the
  same version keeps the stale timings.

- **Café interior load: 8–11 s cold, ~21 s throttled to 10 Mbps**, and **the splat
  downloads exactly once**. This replaces the old ≥87.5 s lower bound, which was measured
  before the warm-up was re-timed onto the last brand-story segment — that number is no
  longer the state of the app.
- **Progress pill labels all fit** in both languages at 1280 and 900 (see above).

Cleared this round, all by real clicks in the harness:

- **Full six-quiz playthrough** — one run, café → nursery → walk → farm → harvesting →
  roastery → café, all seven questions, exactly one wrong. The win screen appeared
  ("You did it — a coffee expert!") with the claim message and no form button.
- **Coffee tree, all six hooks** — seed · sprout · polybagSeedling · youngTree ·
  flowering · ripeCherries · roastedBeans · cup, each with its own caption.
- **Nursery VO recut, both languages** — EN traversed; in BIS all three gates fired
  against the real durations (15.09 / 34.00 / 31.31): marker at 15 s, mini-quiz at 34 s,
  scene quiz at ~31 s.
- **Harvesting quiz timing + muted 30–60 s loop** — quiz opened at the narration end
  (64.45 s EN, 92 s BIS); holding it open 50 s, the video was muted and wrapped twice.
- **Farm close-up placement** — re-walked, which is how the unreachable Back disc was
  found and fixed (see Done this round).
- **The combined walk + farm summary** — one "What you skipped" panel with both sections,
  shown at the harvest exit.

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
- `~1 s` of café between the brewing and testimony videos — **did not reproduce** in the
  audit against `testimony_v2` (no café frame at 200 ms sampling, 203 ms gap). Kept here
  only because a sub-200 ms flash was not ruled out.
