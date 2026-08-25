// ============================================================================
// VIDEO SCENE (REUSABLE)
// ============================================================================
// Full-screen video backdrop with audio VO, subtitles, and gated quiz.
// Extends Scene base class; uses existing playVoWithSubtitles to trigger quiz.

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

            // Set up 90-second fallback for harvest scene
            if (this.name === 'harvesting') {
                this.fallbackTimeoutHandle = setTimeout(() => {
                    console.log('[VideoScene] 90s fallback triggered - showing Continue button');
                    if (!this.quizPassed) {
                        console.log('[VideoScene] Quiz did not pass in 90s, forcing transition');
                        this.showForwardButton();
                    }
                }, 90000);
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
        // Override to suppress subtitles if suppressSubtitles flag is set
        if (this.suppressSubtitles) {
            // Hide subtitle bar and play audio without VTT track
            const subtitleBar = document.getElementById('subtitle-bar');
            if (subtitleBar) subtitleBar.style.display = 'none';

            this.stopVo();

            const lang = window.currentLanguage || 'en';
            let audioPath = voUrl(audioKey);
            const fallbackAudioPath = assetUrl(`VO/${audioKey}.mp3`);
            const audio = document.createElement('audio');
            audio.crossOrigin = 'anonymous';
            audio.src = audioPath;
            audio.preload = 'auto';
            audio.hidden = true;

            document.body.appendChild(audio);
            this.voAudio = audio;

            const triggerQuiz = () => {
                if (this.quiz && !window.journeyComplete && !this.quizTriggered) {
                    this.quizTriggered = true;
                    const hookMethod = this[`onVoFinished_${audioKey}`];
                    if (typeof hookMethod === 'function') {
                        hookMethod.call(this);
                    } else {
                        this.onQuizPassed();
                    }
                }
            };

            audio.addEventListener('ended', () => {
                console.log('[VideoScene] VO ended');
                triggerQuiz();
            }, { once: true });

            let audioFallbackAttempted = false;
            audio.addEventListener('error', (e) => {
                if (lang !== 'en' && !audioFallbackAttempted) {
                    audioFallbackAttempted = true;
                    console.warn(`[VO] Audio load failed for ${audioPath}, retrying with English`);
                    audio.src = fallbackAudioPath;
                    audio.load();
                    setTimeout(() => {
                        audio.play().catch(err => {
                            // Both languages missing: advance anyway, a stalled
                            // scene is worse than a silent one.
                            console.error(`[VO] Fallback audio also failed for ${audioKey}:`, err);
                            triggerQuiz();
                        });
                    }, 100);
                } else {
                    console.error(`[VO] Audio load failed for ${audioPath}:`, e);
                    triggerQuiz();
                }
            });

            audio.play().catch(e => {
                // A language fallback swap rejects this pending promise; the error
                // handler owns the retry.
                if (audioFallbackAttempted) return;
                console.warn('[VO] Autoplay blocked:', e);
            });

            this.voAudioEndedHandler = triggerQuiz;
            return Promise.resolve();
        }

        // Otherwise use parent class implementation, passing through isQuizEligible
        return super.playVoWithSubtitles(audioKey, isQuizEligible);
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
            z-index: 1010;
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
            console.log(`[VideoScene] Continue clicked, transitioning to ${this.nextScene} with spawn ${JSON.stringify(this.nextSpawn)}`);
            sceneManager.switchTo(this.nextScene, this.nextSpawn);
        });

        document.body.appendChild(this.forwardButton);
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
    nextScene: 'roastery',
    nextSpawn: [0, 1.6, 0]
}));
