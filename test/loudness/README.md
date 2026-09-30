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

## 3. Videos — as measured, before the fix

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

## 4. Videos — normalized (audio-only remux)

### Which videos have a bis/ variant

Probed on R2, every video the code references. Exactly five have one:

| video | en | bis |
|---|---|---|
| `brewingVideo` | 206 | **206** |
| `coffeeRoasting` | 206 | **206** |
| `harvestingWeb` | 206 | **206** |
| `ownerInterview` | 206 | **206** |
| `farmerInterview` | 206 | **206** |
| aerial, droneWeb, farmerMontage, mapZoom, polybag, testimony_v2, heroLoop | 206 | 404 |

That makes **11 speech videos**, not nine. `bis/ownerInterview` and
`bis/farmerInterview` were missed on the first pass because a comment in main.js said
the interviews kept their English path; they do not, and the Bisaya run 404d on them.

All eleven speech videos re-done at **-16 LUFS / -1.5 dBTP**, two-pass `loudnorm`,
`-c:v copy` so the video bitstream is passed through untouched. AAC 128 kbit/s,
48 kHz, stereo, `+faststart`. Outputs are in `Videos/` and `Videos/bis/` in this directory.

**They are gitignored**, like `_src/`. 224 MB of video whose destination is R2 does not
belong in git history — once pushed it can only be removed by rewriting history. The
files are on disk and ready to upload; only the code changes and this report are
committed.

Each one gets a **new filename** — videos carry `immutable` cache headers, so
overwriting in place would leave returning visitors on the old audio for a month.

| old | new | before LUFS | after LUFS | after dBTP | sample peak | dur drift s | video stream |
|---|---|---:|---:|---:|---:|---:|---|
| `Videos/ownerInterview.mp4` | `Videos/ownerInterview_v2.mp4` | -22.2 | -16.0 | -1.6 | -1.56 dBFS | +0.029 | identical |
| `Videos/farmerInterview.mp4` | `Videos/farmerInterview_v2.mp4` | -24.5 | -16.1 | -1.5 | -1.54 dBFS | +0.079 | identical |
| `Videos/harvestingWeb.mp4` | `Videos/harvestingWeb_v2.mp4` | -23.4 | -16.0 | -1.5 | -1.53 dBFS | +0.098 | identical |
| `Videos/coffeeRoasting.mp4` | `Videos/coffeeRoasting_v2.mp4` | -24.5 | -15.9 | -1.6 | -1.61 dBFS | +0.028 | identical |
| `Videos/testimony_v2.mp4` | `Videos/testimony_v3.mp4` | -18.4 | -16.1 | -2.0 | -1.97 dBFS | +0.029 | identical |
| `Videos/brewingVideo.mp4` | `Videos/brewingVideo_v2.mp4` | -23.2 | -16.0 | -1.6 | -1.62 dBFS | +0.066 | identical |
| `Videos/bis/harvestingWeb.mp4` | `Videos/bis/harvestingWeb_v2.mp4` | -23.6 | -16.1 | -1.6 | -1.59 dBFS | +0.099 | identical |
| `Videos/bis/coffeeRoasting.mp4` | `Videos/bis/coffeeRoasting_v2.mp4` | -24.9 | -16.0 | -1.7 | -1.78 dBFS | +0.008 | identical |
| `Videos/bis/ownerInterview.mp4` | `Videos/bis/ownerInterview_v2.mp4` | -22.2 | -16.1 | -1.6 | n/a | +0.063 | identical |
| `Videos/bis/farmerInterview.mp4` | `Videos/bis/farmerInterview_v2.mp4` | -24.4 | **-17.4** | -1.5 | -1.49 dBFS | +0.079 | identical |
| `Videos/bis/brewingVideo.mp4` | `Videos/bis/brewingVideo_v2.mp4` | -21.7 | -16.0 | -1.6 | -1.60 dBFS | +0.076 | identical |

Verified on every output: within **-16 ±0.5 LUFS**, true peak **at or under -1.5 dBTP**,
sample peak at or under -1.53 dBFS so nothing clips, `moov` before `mdat` (faststart),
audio `aac, 48000 Hz, stereo`, and the **video stream md5 is identical to the source**
in all nine — `-c:v copy` really did copy.

Two things this cost:

- **AAC overshoots the true peak loudnorm hands it.** `brewingVideo` came out at
  **+1.1 dBTP** from a loudnorm target of -1.5, i.e. worse than the source it was
  meant to fix. The loudnorm TP target is now -2.0, which leaves the encoder enough
  headroom that its overshoot still lands under -1.5.
- **Chasing loudness and true peak at once makes them fight.** Pulling TP down to
  stop that overshoot also pulls integrated loudness down; `ownerInterview` settled
  at -17.7 LUFS that way. The TP target is fixed and only loudness is chased.

**`Videos/bis/farmerInterview_v2.mp4` is the one file not at -16 LUFS.** It sits at
**-17.4**, because -16 cannot be reached on this source without breaching the true-peak
limit: its audio is almost entirely in the left channel and already peaks at -1.48 dBTP,
so the +8.5 dB that -16 would need puts the AAC decode overshoot well above -1.5.
Stepping the target down, measured: -16.0 gives +1.8 dBTP, -17.0 gives -0.4, -17.3 gives
**-1.5** — the loudest setting that complies. It is 1.4 LU quieter than the other ten,
which is within the 2 LU band the rest of the set sits in.

A note for whoever revisits this, because it cost real time twice: **the shell here is
zsh, and `offset=$off:linear=true` silently mangles the filter string.** zsh reads `:l`
as the lowercase modifier, so `$off:linear=true` expands to `0.07inear=true`, loudnorm
rejects the `offset` option, and ffmpeg exits without writing the file. With stderr
suppressed that looks exactly like "the target had no effect" — every target appeared to
produce the same -16.0/-0.4 output, because it was the *previous* file being measured
each time. Brace it: `offset=${off}:linear=true`. The `.sh` scripts in the scratch
directory ran under bash and were never affected.

Durations grow by 0.008-0.099 s. That is the AAC encoder's priming and padding, not
a cut: the video stream is byte-identical, so no frame moved.

## 5. Uploading

**Nothing here can ship before it is uploaded.** `VO_VERSION` is already bumped to 2 and
the code already points at the `_v2` / `_v3` video filenames, so a deploy without the
upload gives players a 404 on every video and the OLD mp3 cached under the NEW stamp
(VO mp3s carry an etag and no `cache-control` — CLAUDE.md hard rule 3). Upload, verify,
then deploy.

Run from this directory. One block, all 55 files:

```sh
BUCKET=granja-alegre-assets
cd test/loudness

# --- 46 VO mp3s ---
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

# --- 9 videos (new filenames; the old ones stay as a rollback path) ---
wrangler r2 object put "$BUCKET/Videos/ownerInterview_v2.mp4" --file="Videos/ownerInterview_v2.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/farmerInterview_v2.mp4" --file="Videos/farmerInterview_v2.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/harvestingWeb_v2.mp4" --file="Videos/harvestingWeb_v2.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/coffeeRoasting_v2.mp4" --file="Videos/coffeeRoasting_v2.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/testimony_v3.mp4" --file="Videos/testimony_v3.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/brewingVideo_v2.mp4" --file="Videos/brewingVideo_v2.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/bis/harvestingWeb_v2.mp4" --file="Videos/bis/harvestingWeb_v2.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/bis/coffeeRoasting_v2.mp4" --file="Videos/bis/coffeeRoasting_v2.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/bis/brewingVideo_v2.mp4" --file="Videos/bis/brewingVideo_v2.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/bis/ownerInterview_v2.mp4" --file="Videos/bis/ownerInterview_v2.mp4" --content-type=video/mp4 --remote
wrangler r2 object put "$BUCKET/Videos/bis/farmerInterview_v2.mp4" --file="Videos/bis/farmerInterview_v2.mp4" --content-type=video/mp4 --remote
```

## 6. Verify before deploying

`curl -I` reports `cf-cache-status: DYNAMIC` even when real GETs return `HIT`, and a
`HEAD` has reported a new `content-length` while ranged GETs still served stale bytes
(CLAUDE.md). So verify with a **ranged GET**, and re-measure what actually comes back:

```sh
BASE=https://assets.granjaalegre.com

# Every file: ranged GET must return 206, and the byte count must match what is on disk.
{ find VO -name '*.mp3'; printf '%s\n' \
    Videos/ownerInterview_v2.mp4 Videos/farmerInterview_v2.mp4 \
    Videos/harvestingWeb_v2.mp4 Videos/coffeeRoasting_v2.mp4 \
    Videos/testimony_v3.mp4 Videos/brewingVideo_v2.mp4 \
    Videos/bis/harvestingWeb_v2.mp4 Videos/bis/coffeeRoasting_v2.mp4 \
    Videos/bis/brewingVideo_v2.mp4 Videos/bis/ownerInterview_v2.mp4 \
    Videos/bis/farmerInterview_v2.mp4; } | while read -r f; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -r 0-1023 "$BASE/$f")
  remote=$(curl -s -r 0- "$BASE/$f" | wc -c | tr -d ' ')
  local=$(stat -f%z "$f")
  if [ "$code" = "206" ] && [ "$remote" = "$local" ]; then
    echo "ok    $f  ($local bytes)"
  else
    echo "FAIL  $f  http=$code remote=$remote local=$local"
  fi
done

# Spot-check that the bytes served really are the normalized ones: every line
# should read about -16 LUFS.
for f in VO/nursery_en_01.mp3 VO/bis/nursery_bis_02.mp3 \
         Videos/brewingVideo_v2.mp4 Videos/testimony_v3.mp4; do
  I=$(ffmpeg -nostdin -nostats -hide_banner -i "$BASE/$f" -map 0:a:0 -af ebur128 -f null - 2>&1 \
      | awk '/Integrated loudness/{x=1} x&&/I:/{print $2; exit}')
  echo "$I LUFS  $f"
done
```

---

## 7. Round two — new context VO, new farmer interview

Two files, both under **new names**, so nothing is overwritten in place and both old
files stay as rollback paths. `?v=` is bumped this round; `SUBTITLE_VERSION` stays
**6** and `VO_VERSION` stays **2** — a new filename needs neither. Neither file is on
R2 yet.

### `VO/contextIntro_v3.mp3` — new recording

From `Assets/VO/Context VO 3.m4a` (37.87 s). **The take opens with a spoken slate,
"Context VO", at 0.58–1.69 s** — that is not part of the script and is trimmed, along
with the 2.07 s of trailing silence. Kept span **3.035 → 35.957 s**.

`index.html` points at the new name.

| | |
|---|---|
| duration | **32.922 s** (was 18.92 s) |
| loudness | -16.4 LUFS |
| true peak | -1.7 dBTP |
| encode | mp3, 48000 Hz, stereo, 128 kbit/s |

At 32.92 s it outruns the Begin button's 25 s "enable anyway" cap, which would have
unlocked Begin with 8 s of narration still to go. The cap is now **39 s**
(duration + 6).

### `Videos/farmerInterview_v3.mp4` — new interview, one cut for both languages

From `Assets/Videos/newFarmerInterview.mp4`. The source is **HEVC Main 10,
yuv420p10le** — hard rule 8, HEVC fails silently in most browsers — so this is a full
transcode, not the audio-only remux the round-one videos got.

```
libx264 crf 24, maxrate 3M, bufsize 6M, preset slow, yuv420p
aac 256k / 48 kHz stereo
-movflags +faststart
```

| | source | output |
|---|---|---|
| codec | hevc Main 10 / yuv420p10le | **h264 High / yuv420p** |
| size | 1920×1080 30 fps, 91.6 MB | 1920×1080 30 fps, **28.6 MB** |
| duration | 88.979 s | **89.000 s** |
| loudness | -24.51 LUFS | **-16.0 LUFS** |
| true peak | -1.49 dBTP | **-2.0 dBTP** |
| faststart | — | `moov` before `mdat`, verified |

**The AAC encoder overshoots the true-peak target, and at 192 kbit/s it overshoots
erratically.** Two-pass `loudnorm` at `TP=-1.5` came out of the encoder at
**-0.8 dBTP**, and adding an `alimiter` at 192k did not behave monotonically — a
limit of 0.75 gave -1.5 dBTP while a *lower* limit of 0.72 gave -1.1. At **256 kbit/s**
the overshoot collapsed to well under a dB and the sweep behaved. Final settings:

```
loudnorm I=-15.3:TP=-1.5:LRA=11 (two-pass, measured values), then
alimiter=limit=0.78:level=false:attack=5:release=50, then aac 256k
```

`level=false` matters, same as for the mp3 VO: alimiter's auto-level applies makeup
gain and undoes the reduction.

**Burned-in Bisaya subtitles.** The farmer speaks Bisaya and the cut carries its own
subtitles burned into the picture (measured: frames at 20 s and 60 s read
"pwerti gyud ka gahi gyud nang area pag bangag namo" and "gikan pa sa seedlings,
hangtod nga imong gi tanom"). That is why **one file serves both languages** and why
both are pointed at the plain path through `assetUrl`, not `videoUrl` — there is no
`Videos/bis/` variant for `videoUrl` to resolve to.

No app subtitle file is attached on either side: `VIDEO_SUBTITLES` in `main.js` carries
only `roasterVideo` and `brewingPOV`, and the street-view gate passes no `subtitleSrc`,
so the subtitle bar cannot double up on the burned-in text. The old interview used no
subtitle file either.

### Reverted: the Bisaya nursery recut

A recut of `VO/bis/nursery_bis_01..03.mp3` from a single new take, with the three
BIS VTTs retimed to it, was prepared this round and then **reverted in full**
(`git revert` of `9c002e5`). The mp3s have been deleted from `test/loudness/VO/bis/`
and the VTTs are back to exactly what R2 serves. That is why `VO_VERSION` is back to
**2** and `SUBTITLE_VERSION` back to **6**.

### Upload and verify — one block

Run it in **bash** (not zsh: the `${var}` forms and the here-doc loop below rely on
bash word-splitting). Nothing here can ship before it is uploaded — the code already
points at both new filenames, so a deploy without the upload 404s the farmer interview
and the context narration.

```bash
#!/usr/bin/env bash
set -uo pipefail

BUCKET=granja-alegre-assets
BASE=https://assets.granjaalegre.com
CC="public, max-age=2592000"
cd /Users/ulysess/Documents/Acads/Thesis/01Code

# remote key | local file | content-type
MANIFEST=$(cat <<'LIST'
VO/contextIntro_v3.mp3|test/loudness/VO/contextIntro_v3.mp3|audio/mpeg
Videos/farmerInterview_v3.mp4|test/loudness/Videos/farmerInterview_v3.mp4|video/mp4
LIST
)

# ---------- upload ----------
while IFS='|' read -r key local type; do
  [ -z "$key" ] && continue
  echo "--> $key"
  wrangler r2 object put "$BUCKET/$key" \
    --file="$local" \
    --content-type="$type" \
    --cache-control="$CC" \
    --remote
done <<< "$MANIFEST"

# ---------- verify ----------
# Ranged GET, and ?check=1 so a CDN edge cannot hand back a cached response for the
# old bytes at the same path. HEAD is not enough: it has reported a new
# content-length while ranged GETs still served stale bytes (CLAUDE.md hard rule 5).
ok=0; fail=0
while IFS='|' read -r key local type; do
  [ -z "$key" ] && continue
  url="$BASE/$key?check=1"
  code=$(curl -s -o /dev/null -w '%{http_code}' -r 0-1023 "$url")
  remote=$(curl -s -r 0- "$url" | wc -c | tr -d ' ')
  lbytes=$(stat -f%z "$local")
  if [ "$code" = "206" ] && [ "$remote" = "$lbytes" ]; then
    echo "OK        $key  ($lbytes bytes)"
    ok=$((ok+1))
  else
    echo "MISMATCH  $key  http=$code remote=$remote local=$lbytes"
    fail=$((fail+1))
  fi
done <<< "$MANIFEST"

echo
echo "$ok OK, $fail MISMATCH, $((ok+fail)) checked"
[ "$fail" -eq 0 ] || exit 1
```

Then confirm the bytes served really are the new ones — duration and loudness, read
straight off the URL:

```bash
BASE=https://assets.granjaalegre.com
for f in VO/contextIntro_v3.mp3 Videos/farmerInterview_v3.mp4; do
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$BASE/$f?check=1")
  I=$(ffmpeg -nostdin -nostats -hide_banner -i "$BASE/$f?check=1" -af ebur128 -f null - 2>&1 \
      | awk '/Integrated loudness/{x=1} x&&/I:/{print $2; exit}')
  echo "$f  ${d}s  ${I} LUFS"
done
# expected: contextIntro_v3  32.922s  -16.4 | farmerInterview_v3  89.000s  -16.0
```
