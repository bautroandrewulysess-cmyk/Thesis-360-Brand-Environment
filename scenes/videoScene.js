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
        this.suppressSubtitles = suppressSubtitles || false;

        this.videoElement = null;
        this.voAudio = null;
        this.quiz = window.PendingQuizzes?.[quizKey] || null;
        this.quizPassed = false;
        this.forwardButton = null;
        this.sceneLoadTime = null;
        this.fallbackTimeoutHandle = null;
    }

    async onLoad() {
        await super.onLoad();

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
            this.videoElement.muted = true;
            this.videoElement.loop = true;
            this.videoElement.playsInline = true;

            if (this.videoSrc) {
                this.videoElement.src = this.videoSrc;
                // Delay video playback by 1 second for harvest scene
                if (this.name === 'harvesting') {
                    this.sceneLoadTime = Date.now();
                    setTimeout(() => {
                        this.videoElement.play().catch(() => {
                            // Autoplay may fail; video will start on first user interaction
                        });
                    }, 1000);
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

            // Start VO + subtitles (auto-triggers quiz on end)
            // For harvesting, defer VO until loading screen dismisses
            if (this.audioKey && this.audioKey !== 'harvesting') {
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

    onLoadingScreenDismissed() {
        // Start VO for harvesting after loading screen fades out
        if (this.audioKey === 'harvesting') {
            this.playVoSequence(this.audioKey).catch(e => {
                console.error('[VideoScene] Failed to play VO sequence:', e);
            });
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

        if (this.fallbackTimeoutHandle) {
            clearTimeout(this.fallbackTimeoutHandle);
        }

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
    // The harvesting footage has subtitles burned into the picture in both
    // languages, so the overlay would render a second copy on top.
    suppressSubtitles: true,
    nextScene: 'roastery',
    nextSpawn: [0, 1.6, 0]
}));
