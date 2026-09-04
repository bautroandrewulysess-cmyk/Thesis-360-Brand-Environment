// ============================================================================
// VIDEO SCENE (REUSABLE)
// ============================================================================
// Full-screen video backdrop with audio VO, subtitles, and gated quiz.
// Extends Scene base class; uses existing playVoWithSubtitles to trigger quiz.

// The Continue fallback is an escape hatch for a VO that never loads, not for one
// that is merely long. It is armed against the VO's own duration plus this grace
// margin as soon as metadata is available; the fixed delay below applies only when
// the duration is still unknown. A fixed 90s used to fire mid-narration in Bisaya
// (harvesting_bis_01 runs 98.4s against 65s in English), putting Continue on screen
// before the quiz had even been triggered.
const VIDEO_SCENE_FALLBACK_GRACE_MS = 30000;
const VIDEO_SCENE_FALLBACK_UNKNOWN_MS = 90000;

// The harvesting picture carries burned-in subtitles while the narration plays from
// a separate mp3, so the two must share one start point or the subtitles drift out of
// step with the voice. Playback is held until the loading screen clears and the VO is
// then started from the video's own 'playing' event, so picture and voice begin
// together and both are visible. This timeout is measured from that same moment — it
// is the escape hatch for a video that never starts (failed load, blocked autoplay),
// so the scene is never left silent with its quiz unreachable.
const VIDEO_SCENE_VO_START_FALLBACK_MS = 5000;

class VideoScene extends Scene {
    constructor({ name, videoSrc, audioKey, quizKey, nextScene, nextSpawn, suppressSubtitles }) {
        super(name);
        // videoSrc may be a function so the URL resolves at read time, after the player
        // has chosen a language. A plain string is still accepted unchanged.
        if (typeof videoSrc === 'function') {
            Object.defineProperty(this, 'videoSrc', { get: videoSrc, configurable: true });
        } else {
            this.videoSrc = videoSrc;
        }
        this.audioKey = audioKey;
        this.quizKey = quizKey;
        this.nextScene = nextScene;
        this.nextSpawn = nextSpawn || [0, 1.6, 0];
        // Resolved at read time, like videoSrc: scenes are constructed before the
        // player picks a language, so a literal would freeze to English.
        if (typeof suppressSubtitles === 'function') {
            Object.defineProperty(this, 'suppressSubtitles', { get: suppressSubtitles, configurable: true });
        } else {
            this.suppressSubtitles = suppressSubtitles || false;
        }

        this.videoElement = null;
        this.voAudio = null;
        this.quiz = window.PendingQuizzes?.[quizKey] || null;
        this.quizPassed = false;
        this.forwardButton = null;
        this.sceneLoadTime = null;
        this.fallbackTimeoutHandle = null;
        this.voStarted = false;
        this.voStartFallbackHandle = null;
        this.videoPlaybackStarted = false;
        this.detachVideoSubtitles = null;
    }

    async onLoad() {
        await super.onLoad();
        this.voStarted = false;
        this.videoPlaybackStarted = false;

        try {
            document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

            // Hide PlayCanvas canvas
            const canvas = document.getElementById('canvas');
            if (canvas) canvas.style.display = 'none';

            // Create and append full-screen video element
            this.videoElement = document.createElement('video');
            this.videoElement.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                z-index: 10;
                transform: translateZ(0);
                will-change: transform;
                backface-visibility: hidden;
            `;
            // Both harvesting cuts carry their narration in the video's own audio track
            // (en 82.8s, bis 107.6s). They must therefore be audible, and must not loop:
            // a loop would restart the narration from the top. Every other video keeps
            // the muted, looping backdrop behaviour.
            this.narratedByVideo = this.name === 'harvesting';
            this.videoElement.muted = !this.narratedByVideo;
            this.videoElement.loop = !this.narratedByVideo;
            this.videoElement.playsInline = true;

            if (this.videoSrc) {
                this.videoElement.src = this.videoSrc;
                // Harvesting holds playback until the loading screen clears, so the
                // picture does not run on unseen ahead of the narration. Started from
                // startVideoPlayback, not here.
                if (this.name === 'harvesting') {
                    this.sceneLoadTime = Date.now();
                } else {
                    this.videoElement.play().catch(() => {
                        // Autoplay may fail; video will start on first user interaction
                    });
                }
            }

            document.body.appendChild(this.videoElement);

            // Load farm ambience for harvest scene
            if (this.name === 'harvesting') {
                this.duckAmbient();
                await this.initAmbient(assetUrl('Music/farmAmbienceSound.mp3'), 0.3);
            }

            // Start VO + subtitles (auto-triggers quiz on end).
            // Harvesting instead starts its VO from the video's first frame, so the
            // narration lines up with the subtitles burned into the picture.
            if (this.audioKey === 'harvesting') {
                if (this.narratedByVideo) {
                    this.bindQuizToVideoEnd();
                    this.bindSubtitlesToVideo();
                }
                this.bindVoToVideoStart();
                // The dismissal may already have happened — a free-roam revisit or a
                // fast load leaves no event still to come.
                if (!this.isLoadingScreenVisible()) {
                    this.startVideoPlayback('loading screen already dismissed');
                }
            } else if (this.audioKey) {
                await this.playVoWithSubtitles(this.audioKey);
            }

            // Escape hatch for the harvest scene, in case the VO never loads at all.
            // Armed for the unknown-duration case here and re-armed against the real
            // VO length once metadata arrives (see trackVoForFallback).
            if (this.name === 'harvesting') {
                this.armForwardFallback(VIDEO_SCENE_FALLBACK_UNKNOWN_MS, 'VO duration unknown');
            }

            // In free-roam mode, show Continue button immediately
            if (window.journeyComplete) {
                this.showForwardButton();
            }
        } catch (error) {
            console.error('Failed to load video scene:', error);
            this.isLoaded = false;
            throw error;
        }
        this.isLoaded = true;
    }

    playVoWithSubtitles(audioKey, isQuizEligible = false) {
        // suppressSubtitles is honoured inside the shared Scene.playVoWithSubtitles
        // (it keeps #subtitle-bar hidden), so this scene needs no separate VO path.
        // It previously had one, which also skipped the scene's quiz entirely.
        if (this.suppressSubtitles) {
            const subtitleBar = document.getElementById('subtitle-bar');
            if (subtitleBar) subtitleBar.style.display = 'none';
        }

        const playing = super.playVoWithSubtitles(audioKey, isQuizEligible);
        // The base implementation assigns this.voAudio synchronously inside its
        // promise executor, so the element is available by the time it returns.
        if (this.name === 'harvesting') this.trackVoForFallback(this.voAudio);
        return playing;
    }

    // Re-arm the Continue fallback against the VO actually playing, so the escape
    // hatch can never appear while the narration is still running.
    trackVoForFallback(audio) {
        if (!audio) return;
        const rearm = () => {
            if (!isFinite(audio.duration) || audio.duration <= 0) return;
            const remainingMs = Math.max(0, audio.duration - audio.currentTime) * 1000;
            this.armForwardFallback(
                remainingMs + VIDEO_SCENE_FALLBACK_GRACE_MS,
                `VO ${audio.duration.toFixed(1)}s + ${VIDEO_SCENE_FALLBACK_GRACE_MS / 1000}s grace`,
            );
        };
        audio.addEventListener('loadedmetadata', rearm);
        audio.addEventListener('durationchange', rearm);
        audio.addEventListener('playing', rearm);
        rearm(); // duration may already be known for a cached file
    }

    armForwardFallback(delayMs, why) {
        if (this.fallbackTimeoutHandle) clearTimeout(this.fallbackTimeoutHandle);
        console.log(`[VideoScene] Continue fallback armed for ${(delayMs / 1000).toFixed(1)}s (${why})`);
        this.fallbackTimeoutHandle = setTimeout(() => {
            this.fallbackTimeoutHandle = null;
            if (this.quizPassed) return;
            console.log('[VideoScene] Continue fallback fired');
            this.showForwardButton();
        }, delayMs);
    }

    // Single entry point for starting the narration. The video is loop=true and
    // outruns the VO in both languages (en 82.8s vs 65.0s, bis 107.6s vs 98.4s), so
    // 'playing' fires again on every loop — this must only ever run once.
    startVoOnce(why) {
        if (this.voStarted) return;
        this.voStarted = true;
        if (this.voStartFallbackHandle) {
            clearTimeout(this.voStartFallbackHandle);
            this.voStartFallbackHandle = null;
        }
        if (this.narratedByVideo) {
            // Narration plays from the video's audio track; the quiz hangs off the
            // video's 'ended' instead (see bindQuizToVideoEnd).
            console.log(`[VideoScene] Narration is in the video's own audio track (${why}); no separate VO`);
            return;
        }
        console.log(`[VideoScene] Starting VO (${why})`);
        this.playVoSequence(this.audioKey).catch(e => {
            console.error('[VideoScene] Failed to play VO sequence:', e);
        });
    }

    bindVoToVideoStart() {
        const video = this.videoElement;
        if (!video) {
            this.startVoOnce('no video element');
            return;
        }

        video.addEventListener('playing', () => this.startVoOnce('video playing'), { once: true });
        // A dead video must not leave the scene silent with its quiz unreachable.
        video.addEventListener('error', () => this.startVoOnce('video error'), { once: true });

        // The event may already have passed by the time the listener attaches.
        if (video.readyState >= 3 && !video.paused) {
            this.startVoOnce('video already playing');
        }
    }

    // With no mp3 there is no audio 'ended' to hang the quiz on. Route the video's
    // 'ended' through the same triggerQuizDirect the skipped-segment path uses, so the
    // quiz keeps its stale-scene guard and its once-only flag rather than gaining a
    // second, parallel trigger.
    bindQuizToVideoEnd() {
        const video = this.videoElement;
        if (!video) return;

        video.addEventListener('ended', () => {
            console.log('[VideoScene] Video ended — embedded narration finished, triggering quiz');
            this.isVoFinished = true;
            const segments = window.voSegmentsFor ? window.voSegmentsFor(this.audioKey) : null;
            const segmentId = (segments && segments[0]) ? segments[0].id : this.audioKey;
            this.triggerQuizDirect(segmentId);
        }, { once: true });

        // Continue must never appear before the quiz exists. The unknown-duration
        // fallback armed in onLoad is 90s against a 107.6s video, so re-arm against the
        // video's own length exactly as trackVoForFallback does against the mp3's.
        const rearm = () => {
            if (!isFinite(video.duration) || video.duration <= 0) return;
            const remainingMs = Math.max(0, video.duration - video.currentTime) * 1000;
            this.armForwardFallback(
                remainingMs + VIDEO_SCENE_FALLBACK_GRACE_MS,
                `video ${video.duration.toFixed(1)}s + ${VIDEO_SCENE_FALLBACK_GRACE_MS / 1000}s grace`,
            );
        };
        video.addEventListener('loadedmetadata', rearm);
        video.addEventListener('durationchange', rearm);
        video.addEventListener('playing', rearm);
        rearm();
    }

    // The subtitle bar used to be driven by the narration mp3's own text track inside
    // playVoWithSubtitles. With the narration moved into the video there is no audio
    // element left to carry it, so the same VTT is hung off the video instead, reusing
    // the hidden-track renderer the popup videos already use — cues follow the picture,
    // which is now also the voice. Languages with burned-in subtitles skip this.
    bindSubtitlesToVideo() {
        if (this.suppressSubtitles || !this.videoElement) return;
        const segments = window.voSegmentsFor ? window.voSegmentsFor(this.audioKey) : null;
        const segmentId = (segments && segments[0]) ? segments[0].id : this.audioKey;
        const src = subtitleUrl(`${segmentId}.vtt`);
        console.log(`[VideoScene] Attaching subtitles to video: ${src}`);
        this.detachVideoSubtitles = this.attachVideoSubtitles(this.videoElement, src);
    }

    isLoadingScreenVisible() {
        const loadingScreen = document.getElementById('loading-screen');
        return !!loadingScreen && !loadingScreen.classList.contains('hidden');
    }

    // Picture and voice both begin here: the video is played, and the VO follows from
    // its 'playing' event a frame later. The fallback is armed from this moment rather
    // than from onLoad, so it cannot expire while the loading screen is still up.
    startVideoPlayback(why) {
        if (this.videoPlaybackStarted) return;
        this.videoPlaybackStarted = true;
        console.log(`[VideoScene] Starting video playback (${why})`);

        this.voStartFallbackHandle = setTimeout(
            () => this.startVoOnce(`video did not start within ${VIDEO_SCENE_VO_START_FALLBACK_MS / 1000}s`),
            VIDEO_SCENE_VO_START_FALLBACK_MS,
        );

        if (!this.videoElement) {
            this.startVoOnce('no video element');
            return;
        }
        this.videoElement.play().catch(() => {
            // Autoplay may fail; the VO fallback above still starts the narration.
        });
    }

    onLoadingScreenDismissed() {
        // Release the held picture. The VO follows from the video's own 'playing'
        // event (see bindVoToVideoStart), so both start together and both are seen.
        if (this.name === 'harvesting') {
            this.startVideoPlayback('loading screen dismissed');
        }
    }

    getNavPromptText() {
        return this.t('ui.video.roasteryPrompt');
    }

    onQuizPassed() {
        this.quizPassed = true;
        console.log(`[VideoScene] Quiz passed for ${this.name}`);
        if (this.fallbackTimeoutHandle) {
            clearTimeout(this.fallbackTimeoutHandle);
            console.log('[VideoScene] 90s fallback cleared after quiz pass');
        }
        // Show Continue button for all scenes
        this.showForwardButton();
    }

    showForwardButton() {
        if (this.forwardButton) return;

        // Never offer Continue over an unanswered quiz. The button is centred on the
        // same point as #quiz-overlay, so it lands on the quiz card and hands the
        // player a way past the question.
        if (this.quiz && !this.quizPassed) {
            const overlay = document.getElementById('quiz-overlay');
            const quizVisible = !!overlay && overlay.style.display !== 'none';
            if (quizVisible || this.quizTriggered) {
                console.warn('[VideoScene] Suppressing Continue — quiz is open or pending');
                return;
            }
        }

        this.forwardButton = document.createElement('button');
        this.forwardButton.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 16px 32px;
            background: #f4d03f;
            border: none;
            color: #050505;
            font-family: 'Inter', sans-serif;
            font-size: 1.1rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-radius: 6px;
            cursor: pointer;
            z-index: 940;
            transition: background 0.2s ease, color 0.2s ease;
            box-shadow: 0 0 20px rgba(244, 208, 63, 0.5);
            animation: gate-marker-pulse 2s ease-in-out infinite;
        `;
        this.forwardButton.textContent = this.t('ui.video.continue');
        
        this.forwardButton.addEventListener('mouseenter', () => {
            this.forwardButton.style.background = '#ffffff';
            this.forwardButton.style.color = '#050505';
        });
        this.forwardButton.addEventListener('mouseleave', () => {
            this.forwardButton.style.background = '#f4d03f';
            this.forwardButton.style.color = '#050505';
        });
        
        this.forwardButton.addEventListener('click', () => {
            // Last line of defence behind showForwardButton's guard: a scene with an
            // unpassed quiz opens the quiz instead of advancing, so the escape hatch
            // still leads somewhere rather than skipping the question.
            if (this.quiz && !this.quizPassed) {
                console.warn('[VideoScene] Continue clicked with the quiz unpassed — opening the quiz instead');
                this.removeForwardButton();
                this.triggerQuizDirect(this.audioKey);
                return;
            }
            console.log(`[VideoScene] Continue clicked, transitioning to ${this.nextScene} with spawn ${JSON.stringify(this.nextSpawn)}`);
            sceneManager.switchTo(this.nextScene, this.nextSpawn);
        });

        document.body.appendChild(this.forwardButton);
    }

    removeForwardButton() {
        if (!this.forwardButton) return;
        this.forwardButton.remove();
        this.forwardButton = null;
    }

    async onUnload() {
        this.stopVo();

        if (this.detachVideoSubtitles) {
            this.detachVideoSubtitles();
            this.detachVideoSubtitles = null;
        }

        if (this.fallbackTimeoutHandle) {
            clearTimeout(this.fallbackTimeoutHandle);
            this.fallbackTimeoutHandle = null;
        }

        if (this.voStartFallbackHandle) {
            clearTimeout(this.voStartFallbackHandle);
            this.voStartFallbackHandle = null;
        }
        this.voStarted = false;
        this.videoPlaybackStarted = false;

        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.remove();
            this.videoElement = null;
        }

        if (this.forwardButton) {
            this.forwardButton.remove();
            this.forwardButton = null;
        }

        this.restoreAmbient();
        this.stopAmbient();

        // Restore PlayCanvas canvas
        const canvas = document.getElementById('canvas');
        if (canvas) canvas.style.display = 'block';

        await super.onUnload();
    }
}

// Register harvesting scene
sceneManager.registerScene('harvesting', new VideoScene({
    name: 'harvesting',
    videoSrc: () => videoUrl('harvestingWeb.mp4'),
    audioKey: 'harvesting',
    quizKey: 'harvesting',
    // Only the Bisaya cut has subtitles burned into the picture, where the overlay
    // would render a second copy on top. English has none, so it uses the normal
    // subtitle bar fed by Subtitles/harvesting_en_01.vtt.
    suppressSubtitles: () => (window.currentLanguage || 'en') !== 'en',
    nextScene: 'roastery',
    nextSpawn: [0, 1.6, 0]
}));
