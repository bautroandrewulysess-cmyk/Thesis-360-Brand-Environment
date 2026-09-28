# Narration loudness — measurement and fix

Source of truth: the live files on `https://assets.granjaalegre.com`, downloaded and
verified byte-complete against `content-length` before anything was measured.
Measured with `ffmpeg -af ebur128=peak=true` (EBU R128), durations from `ffprobe`.

## 1. Before

Median across all 55 speech-bearing files: **-23.5 LUFS**. 
VO mp3s (46) span -28.9 to -20.4 LUFS; 
videos with speech (9) span -24.9 to -18.4 LUFS. 
Total spread **10.5 LU** — loud enough a difference to be heard as a jump between scenes.

`!` marks more than 2 LU from the median.

| file | LUFS | LRA | dBTP | dur s | vs median |
|---|---:|---:|---:|---:|---:|
| `VO/bis/nursery_bis_02.mp3` | -28.9 | 6.3 | -16.5 | 34.00 | -5.4 ! |
| `VO/bis/nursery_bis_01.mp3` | -28.5 | 5.1 | -16.5 | 15.09 | -5.0 ! |
| `VO/bis/nursery_bis_03.mp3` | -28.0 | 5.4 | -11.0 | 31.31 | -4.5 ! |
| `VO/backToCafe_en_02.mp3` | -27.0 | 5.4 | -11.6 | 14.35 | -3.5 ! |
| `VO/journeyToFarm_en_04.mp3` | -26.4 | 1.6 | -14.2 | 4.67 | -2.9 ! |
| `VO/brandStory_en_03.mp3` | -25.7 | 5.1 | -8.4 | 15.93 | -2.2 ! |
| `VO/backToCafe_en_01.mp3` | -25.6 | 4.0 | -10.3 | 22.97 | -2.1 ! |
| `VO/journeyToFarm_en_05.mp3` | -25.6 | 1.2 | -13.5 | 6.28 | -2.1 ! |
| `VO/bis/brandStory_bis_01.mp3` | -25.6 | 7.5 | -7.1 | 34.38 | -2.1 ! |
| `VO/bis/roasting_bis_04.mp3` | -25.4 | 2.1 | -7.5 | 7.98 | -1.9 |
| `VO/brandStory_en_02.mp3` | -25.3 | 2.7 | -10.4 | 19.25 | -1.8 |
| `VO/bis/brandStory_bis_04.mp3` | -25.2 | 7.2 | -7.7 | 30.10 | -1.7 |
| `VO/roasting_en_01.mp3` | -24.9 | 4.1 | -9.3 | 20.85 | -1.4 |
| `Videos/bis/coffeeRoasting.mp4` | -24.9 | 14.7 | -5.2 | 75.39 | -1.4 |
| `VO/journeyToFarm_en_06.mp3` | -24.8 | 2.1 | -9.6 | 4.03 | -1.3 |
| `VO/bis/brandStory_bis_02.mp3` | -24.6 | 4.4 | -8.3 | 17.24 | -1.1 |
| `VO/bis/brandStory_bis_03.mp3` | -24.5 | 4.5 | -8.2 | 28.90 | -1.0 |
| `Videos/coffeeRoasting.mp4` | -24.5 | 18.4 | -5.2 | 52.67 | -1.0 |
| `Videos/farmerInterview.mp4` | -24.5 | 6.1 | -1.5 | 93.32 | -1.0 |
| `VO/brandStory_en_01.mp3` | -24.4 | 3.2 | -5.5 | 33.52 | -0.9 |
| `VO/journeyToFarm_en_02.mp3` | -24.4 | 4.7 | -8.3 | 13.03 | -0.9 |
| `VO/roasting_en_04.mp3` | -24.4 | 1.1 | -10.5 | 6.59 | -0.9 |
| `VO/brandStory_en_04.mp3` | -24.3 | 2.4 | -9.1 | 24.75 | -0.8 |
| `VO/journeyToFarm_en_01.mp3` | -23.9 | 4.1 | -9.1 | 13.10 | -0.4 |
| `VO/harvesting_en_01.mp3` | -23.8 | 4.3 | -6.8 | 65.00 | -0.3 |
| `VO/farm_en_02.mp3` | -23.7 | 4.4 | -6.0 | 24.73 | -0.2 |
| `Videos/bis/harvestingWeb.mp4` | -23.6 | 7.3 | -4.4 | 107.60 | -0.1 |
| `VO/journeyToFarm_en_03.mp3` | -23.5 | 0.3 | -9.7 | 3.48 | +0.0 |
| `VO/farm_en_01.mp3` | -23.4 | 4.3 | -9.1 | 12.91 | +0.1 |
| `VO/bis/journeyToFarm_bis_04.mp3` | -23.4 | 1.8 | -9.5 | 3.61 | +0.1 |
| `Videos/harvestingWeb.mp4` | -23.4 | 19.7 | -6.4 | 82.80 | +0.1 |
| `VO/bis/roasting_bis_01.mp3` | -23.2 | 3.5 | -1.7 | 24.25 | +0.3 |
| `Videos/brewingVideo.mp4` | -23.2 | 9.2 | +0.5 | 83.43 | +0.3 |
| `VO/bis/backToCafe_bis_01.mp3` | -23.1 | 5.6 | -1.3 | 48.78 | +0.4 |
| `VO/bis/journeyToFarm_bis_03.mp3` | -23.1 | 0.0 | -7.9 | 2.34 | +0.4 |
| `VO/farm_en_03.mp3` | -22.9 | 3.0 | -5.9 | 23.65 | +0.6 |
| `VO/quizTime_en_01.mp3` | -22.8 | 0.0 | -12.8 | 1.56 | +0.7 |
| `VO/contextIntro.mp3` | -22.7 | 4.1 | -6.8 | 18.92 | +0.8 |
| `VO/bis/journeyToFarm_bis_02.mp3` | -22.4 | 2.8 | -5.2 | 15.58 | +1.1 |
| `VO/bis/harvesting_bis_01.mp3` | -22.3 | 5.6 | -3.7 | 98.43 | +1.2 |
| `Videos/ownerInterview.mp4` | -22.2 | 5.7 | -2.2 | 73.07 | +1.3 |
| `VO/bis/journeyToFarm_bis_01.mp3` | -22.1 | 6.8 | -2.4 | 19.93 | +1.4 |
| `VO/bis/journeyToFarm_bis_05.mp3` | -22.0 | 3.6 | -7.8 | 8.58 | +1.5 |
| `VO/nursery_en_01.mp3` | -21.9 | 2.2 | -7.1 | 17.37 | +1.6 |
| `VO/bis/backToCafe_bis_02.mp3` | -21.7 | 4.8 | -1.6 | 31.50 | +1.8 |
| `VO/bis/farm_bis_03.mp3` | -21.7 | 7.4 | -1.1 | 32.19 | +1.8 |
| `Videos/bis/brewingVideo.mp4` | -21.7 | 6.9 | -3.0 | 82.62 | +1.8 |
| `VO/farm_en_04.mp3` | -21.5 | 0.9 | -9.3 | 5.32 | +2.0 |
| `VO/bis/farm_bis_01.mp3` | -21.2 | 4.0 | -4.1 | 24.73 | +2.3 ! |
| `VO/nursery_en_02.mp3` | -21.0 | 2.9 | -5.0 | 27.44 | +2.5 ! |
| `VO/bis/farm_bis_02.mp3` | -20.9 | 6.0 | -3.9 | 41.77 | +2.6 ! |
| `VO/bis/journeyToFarm_bis_06.mp3` | -20.9 | 3.2 | -7.8 | 3.68 | +2.6 ! |
| `VO/bis/farm_bis_04.mp3` | -20.8 | 5.0 | -4.8 | 6.85 | +2.7 ! |
| `VO/nursery_en_03.mp3` | -20.4 | 2.6 | -4.1 | 18.65 | +3.1 ! |
| `Videos/testimony_v2.mp4` | -18.4 | 5.9 | -0.3 | 56.77 | +5.1 ! |

Five videos carry no speech at all and are excluded from the median (digital silence, -70 LUFS):

- `Videos/aerial.mp4` — 38.27s
- `Videos/droneWeb.mp4` — 20.03s
- `Videos/farmerMontage.mp4` — 14.95s
- `Videos/mapZoom.mp4` — 28.12s
- `Videos/polybag.mp4` — 22.44s

**True peaks above -1.5 dBTP before the fix:**

- `Videos/brewingVideo.mp4` +0.5 dBTP  ← above 0, already clipping
- `Videos/testimony_v2.mp4` -0.3 dBTP
- `VO/bis/farm_bis_03.mp3` -1.1 dBTP
- `VO/bis/backToCafe_bis_01.mp3` -1.3 dBTP

## 2. The fix — VO mp3s only

All 46 VO mp3s normalized to **-16 LUFS integrated, true peak -1.5 dBTP**, two-pass
`loudnorm` (pass 1 measures, pass 2 applies the measured values in `linear=true`).
Encoding and filenames unchanged: `libmp3lame`, 128 kbit/s, 48 kHz, stereo.

Outputs are in this directory under `VO/` and `VO/bis/`, the same layout as R2.

Six files missed -16 ±0.5 on the first pass and were re-run with the target nudged by
the miss, always re-encoding **from the original source** so no file is ever a second
mp3 generation. One — `VO/bis/journeyToFarm_bis_03.mp3`, 2.33s — would not converge at
all: `loudnorm` gates its integrated measurement on 3-second blocks and a 2.3s clip has
barely one, so it got a measured fixed gain (+7.1 dB) plus a limiter at -1.5 dBTP
instead. Integrated loudness is gain-linear, so for a clip that short this is exact.

### After

- all 46 files within **-16 ±0.5 LUFS** (actual range -16.5 to -16.0, spread 0.5 LU, down from 8.5 LU)
- worst true peak **-1.8 dBTP** — every file at or under -1.5
- worst sample peak -1.78 dBFS, so nothing clips
- **no duration changed** by more than 0.008s (the mp3 encoder's frame padding, not a cut)
- every output re-probed as `mp3, 48000 Hz, stereo, 128 kbit/s`

| file | before LUFS | after LUFS | after dBTP | dur drift s |
|---|---:|---:|---:|---:|
| `VO/backToCafe_en_01.mp3` | -25.6 | -16.4 | -1.9 | +0.000 |
| `VO/backToCafe_en_02.mp3` | -27.0 | -16.5 | -1.9 | +0.000 |
| `VO/bis/backToCafe_bis_01.mp3` | -23.1 | -16.0 | -1.8 | -0.008 |
| `VO/bis/backToCafe_bis_02.mp3` | -21.7 | -16.1 | -1.9 | -0.008 |
| `VO/bis/brandStory_bis_01.mp3` | -25.6 | -16.0 | -1.8 | -0.008 |
| `VO/bis/brandStory_bis_02.mp3` | -24.6 | -16.5 | -1.8 | -0.008 |
| `VO/bis/brandStory_bis_03.mp3` | -24.5 | -16.4 | -1.8 | -0.008 |
| `VO/bis/brandStory_bis_04.mp3` | -25.2 | -16.4 | -1.9 | -0.008 |
| `VO/bis/farm_bis_01.mp3` | -21.2 | -16.5 | -1.9 | -0.008 |
| `VO/bis/farm_bis_02.mp3` | -20.9 | -16.5 | -1.8 | -0.008 |
| `VO/bis/farm_bis_03.mp3` | -21.7 | -16.0 | -1.9 | -0.008 |
| `VO/bis/farm_bis_04.mp3` | -20.8 | -16.5 | -1.9 | -0.008 |
| `VO/bis/harvesting_bis_01.mp3` | -22.3 | -16.5 | -1.9 | -0.008 |
| `VO/bis/journeyToFarm_bis_01.mp3` | -22.1 | -16.5 | -1.9 | -0.008 |
| `VO/bis/journeyToFarm_bis_02.mp3` | -22.4 | -16.5 | -1.9 | -0.008 |
| `VO/bis/journeyToFarm_bis_03.mp3` | -23.1 | -16.5 | -1.9 | -0.008 |
| `VO/bis/journeyToFarm_bis_04.mp3` | -23.4 | -16.4 | -2.4 | -0.008 |
| `VO/bis/journeyToFarm_bis_05.mp3` | -22.0 | -16.4 | -1.9 | -0.008 |
| `VO/bis/journeyToFarm_bis_06.mp3` | -20.9 | -16.0 | -2.9 | -0.008 |
| `VO/bis/nursery_bis_01.mp3` | -28.5 | -16.3 | -4.4 | +0.000 |
| `VO/bis/nursery_bis_02.mp3` | -28.9 | -16.5 | -4.1 | +0.000 |
| `VO/bis/nursery_bis_03.mp3` | -28.0 | -16.4 | -2.0 | +0.000 |
| `VO/bis/roasting_bis_01.mp3` | -23.2 | -16.5 | -1.9 | -0.008 |
| `VO/bis/roasting_bis_04.mp3` | -25.4 | -16.4 | -1.9 | -0.008 |
| `VO/brandStory_en_01.mp3` | -24.4 | -16.4 | -1.9 | +0.000 |
| `VO/brandStory_en_02.mp3` | -25.3 | -16.4 | -2.0 | +0.000 |
| `VO/brandStory_en_03.mp3` | -25.7 | -16.4 | -1.9 | +0.000 |
| `VO/brandStory_en_04.mp3` | -24.3 | -16.4 | -1.9 | +0.000 |
| `VO/contextIntro.mp3` | -22.7 | -16.4 | -2.0 | +0.000 |
| `VO/farm_en_01.mp3` | -23.4 | -16.4 | -2.1 | +0.000 |
| `VO/farm_en_02.mp3` | -23.7 | -16.4 | -1.9 | +0.000 |
| `VO/farm_en_03.mp3` | -22.9 | -16.5 | -1.9 | +0.000 |
| `VO/farm_en_04.mp3` | -21.5 | -16.5 | -4.2 | +0.000 |
| `VO/harvesting_en_01.mp3` | -23.8 | -16.4 | -1.9 | +0.000 |
| `VO/journeyToFarm_en_01.mp3` | -23.9 | -16.4 | -2.0 | +0.000 |
| `VO/journeyToFarm_en_02.mp3` | -24.4 | -16.5 | -1.9 | +0.000 |
| `VO/journeyToFarm_en_03.mp3` | -23.5 | -16.2 | -2.4 | +0.000 |
| `VO/journeyToFarm_en_04.mp3` | -26.4 | -16.3 | -4.0 | +0.000 |
| `VO/journeyToFarm_en_05.mp3` | -25.6 | -16.2 | -4.4 | +0.000 |
| `VO/journeyToFarm_en_06.mp3` | -24.8 | -16.5 | -1.9 | +0.000 |
| `VO/nursery_en_01.mp3` | -21.9 | -16.4 | -2.0 | +0.000 |
| `VO/nursery_en_02.mp3` | -21.0 | -16.4 | -1.9 | +0.000 |
| `VO/nursery_en_03.mp3` | -20.4 | -16.5 | -1.9 | +0.000 |
| `VO/quizTime_en_01.mp3` | -22.8 | -16.4 | -6.4 | +0.000 |
| `VO/roasting_en_01.mp3` | -24.9 | -16.4 | -1.9 | +0.000 |
| `VO/roasting_en_04.mp3` | -24.4 | -16.3 | -2.4 | +0.000 |

## 3. Videos — measured only, unchanged

Every video with speech sits far below -16 LUFS. None was touched.

| file | LUFS | vs -16 | dBTP | what fixing it needs |
|---|---:|---:|---:|---|
| `Videos/bis/coffeeRoasting.mp4` | -24.9 | -8.9 | -5.2 | audio-only remux |
| `Videos/coffeeRoasting.mp4` | -24.5 | -8.5 | -5.2 | audio-only remux |
| `Videos/farmerInterview.mp4` | -24.5 | -8.5 | -1.5 | audio-only remux |
| `Videos/bis/harvestingWeb.mp4` | -23.6 | -7.6 | -4.4 | audio-only remux |
| `Videos/harvestingWeb.mp4` | -23.4 | -7.4 | -6.4 | audio-only remux |
| `Videos/brewingVideo.mp4` | -23.2 | -7.2 | +0.5 | **audio-only remux + limiting** (peaks already at/over 0) |
| `Videos/ownerInterview.mp4` | -22.2 | -6.2 | -2.2 | audio-only remux |
| `Videos/bis/brewingVideo.mp4` | -21.7 | -5.7 | -3.0 | audio-only remux |
| `Videos/testimony_v2.mp4` | -18.4 | -2.4 | -0.3 | within 3 LU — leave it |

All eight speech videos are more than 3 LU off -16, by −8.9 to −5.7 LU. What fixing them takes:

- **Audio-only remux is enough for seven of them.** `ffmpeg -i in.mp4 -c:v copy -af loudnorm=... -c:a aac -b:a 128k out.mp4` re-encodes only the audio track and leaves the video bitstream untouched, so there is no visual generation loss and it runs in seconds rather than minutes.
- **`Videos/brewingVideo.mp4` needs limiting as well** — it already true-peaks at **+0.5 dBTP**, i.e. it is clipping today, so raising it needs a limiter rather than gain alone. `Videos/testimony_v2.mp4` at −0.3 dBTP is the same story with less headroom lost.
- **A full re-encode is not needed** for any of them. Nothing about the video stream is wrong.
- **Every replacement needs a NEW FILENAME.** Videos carry `immutable` cache headers (CLAUDE.md, hard rule 4), so overwriting in place leaves returning visitors on the old file for a month. `brewingVideo_v2.mp4`, `ownerInterview_v2.mp4` and so on, with the old files kept as a rollback path, and the `videoUrl()` / `assetUrl()` call sites updated to match.
- The five silent videos need nothing — they are meant to be silent.

## 4. Uploading

**These files cannot ship until they are uploaded.** `VO_VERSION` has been bumped so the
new files bust the CDN cache, but VO mp3s are served with an etag and no `cache-control`
(CLAUDE.md, hard rule 3) — if the version ships before the bytes, players get the old
recordings at the new version and the cache is poisoned for them. Upload first, then
deploy.

Set the bucket name first — it is not recorded anywhere in this repo, so I could not
fill it in:

```sh
BUCKET=<your-r2-bucket-name>
cd test/loudness
```

Then, all 46 files:

```sh
wrangler r2 object put "$BUCKET/VO/backToCafe_en_01.mp3" --file="VO/backToCafe_en_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/backToCafe_en_02.mp3" --file="VO/backToCafe_en_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/brandStory_en_01.mp3" --file="VO/brandStory_en_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/brandStory_en_02.mp3" --file="VO/brandStory_en_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/brandStory_en_03.mp3" --file="VO/brandStory_en_03.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/brandStory_en_04.mp3" --file="VO/brandStory_en_04.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/farm_en_01.mp3" --file="VO/farm_en_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/farm_en_02.mp3" --file="VO/farm_en_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/farm_en_03.mp3" --file="VO/farm_en_03.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/farm_en_04.mp3" --file="VO/farm_en_04.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/harvesting_en_01.mp3" --file="VO/harvesting_en_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/journeyToFarm_en_01.mp3" --file="VO/journeyToFarm_en_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/journeyToFarm_en_02.mp3" --file="VO/journeyToFarm_en_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/journeyToFarm_en_03.mp3" --file="VO/journeyToFarm_en_03.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/journeyToFarm_en_04.mp3" --file="VO/journeyToFarm_en_04.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/journeyToFarm_en_05.mp3" --file="VO/journeyToFarm_en_05.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/journeyToFarm_en_06.mp3" --file="VO/journeyToFarm_en_06.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/nursery_en_01.mp3" --file="VO/nursery_en_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/nursery_en_02.mp3" --file="VO/nursery_en_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/nursery_en_03.mp3" --file="VO/nursery_en_03.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/quizTime_en_01.mp3" --file="VO/quizTime_en_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/roasting_en_01.mp3" --file="VO/roasting_en_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/roasting_en_04.mp3" --file="VO/roasting_en_04.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/contextIntro.mp3" --file="VO/contextIntro.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/backToCafe_bis_01.mp3" --file="VO/bis/backToCafe_bis_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/backToCafe_bis_02.mp3" --file="VO/bis/backToCafe_bis_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/brandStory_bis_01.mp3" --file="VO/bis/brandStory_bis_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/brandStory_bis_02.mp3" --file="VO/bis/brandStory_bis_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/brandStory_bis_03.mp3" --file="VO/bis/brandStory_bis_03.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/brandStory_bis_04.mp3" --file="VO/bis/brandStory_bis_04.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/farm_bis_01.mp3" --file="VO/bis/farm_bis_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/farm_bis_02.mp3" --file="VO/bis/farm_bis_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/farm_bis_03.mp3" --file="VO/bis/farm_bis_03.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/farm_bis_04.mp3" --file="VO/bis/farm_bis_04.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/harvesting_bis_01.mp3" --file="VO/bis/harvesting_bis_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/journeyToFarm_bis_01.mp3" --file="VO/bis/journeyToFarm_bis_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/journeyToFarm_bis_02.mp3" --file="VO/bis/journeyToFarm_bis_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/journeyToFarm_bis_03.mp3" --file="VO/bis/journeyToFarm_bis_03.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/journeyToFarm_bis_04.mp3" --file="VO/bis/journeyToFarm_bis_04.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/journeyToFarm_bis_05.mp3" --file="VO/bis/journeyToFarm_bis_05.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/journeyToFarm_bis_06.mp3" --file="VO/bis/journeyToFarm_bis_06.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/nursery_bis_01.mp3" --file="VO/bis/nursery_bis_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/nursery_bis_02.mp3" --file="VO/bis/nursery_bis_02.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/nursery_bis_03.mp3" --file="VO/bis/nursery_bis_03.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/roasting_bis_01.mp3" --file="VO/bis/roasting_bis_01.mp3" --content-type=audio/mpeg --remote
wrangler r2 object put "$BUCKET/VO/bis/roasting_bis_04.mp3" --file="VO/bis/roasting_bis_04.mp3" --content-type=audio/mpeg --remote
```

Or as a loop over the same list:

```sh
find VO -name '*.mp3' | while read -r f; do
  wrangler r2 object put "$BUCKET/$f" --file="$f" --content-type=audio/mpeg --remote
done
```

After uploading, verify before deploying — `HEAD` has reported a new `content-length`
while ranged GETs still served stale bytes (CLAUDE.md), so probe with a real GET:

```sh
ffprobe -v error -show_entries format=duration,bit_rate -of default=nw=1 \
  "https://assets.granjaalegre.com/VO/nursery_en_01.mp3?v=2"
ffmpeg -nostats -hide_banner -i "https://assets.granjaalegre.com/VO/nursery_en_01.mp3?v=2" \
  -af ebur128 -f null - 2>&1 | tail -12   # expect I: about -16.4 LUFS
```
