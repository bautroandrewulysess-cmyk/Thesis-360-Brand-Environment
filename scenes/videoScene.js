// ============================================================================
// VIDEO SCENE (REUSABLE)
// ============================================================================
// Full-screen video backdrop with audio VO, subtitles, and gated quiz.
// Extends Scene base class; uses existing playVoWithSubtitles to trigger quiz.

class VideoScene extends Scene {
    constructor({ name, videoSrc, audioKey, quizKey, nextScene, nextSpawn, suppressSubtitles }) {
        super(name);
        this.videoSrc = videoSrc;
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

            const audioPath = assetUrl(`VO/${audioKey}.mp3`);
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
            audio.addEventListener('error', (e) => {
                console.error(`[VO] Audio load failed for ${audioPath}:`, e);
            });

            audio.play().catch(e => console.warn('[VO] Autoplay blocked:', e));

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
        return 'Select Continue to visit the roastery';
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
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: #f4f4f4;
            font-family: 'Inter', sans-serif;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-radius: 4px;
            cursor: pointer;
            z-index: 951;
            transition: all 0.3s ease;
        `;
        this.forwardButton.textContent = 'Continue';
        this.forwardButton.addEventListener('mouseenter', () => {
            this.forwardButton.style.background = 'rgba(255, 255, 255, 0.2)';
            this.forwardButton.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        });
        this.forwardButton.addEventListener('mouseleave', () => {
            this.forwardButton.style.background = 'rgba(255, 255, 255, 0.1)';
            this.forwardButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
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
    videoSrc: `${R2_BASE}/harvestingWeb.mp4`,
    audioKey: 'harvesting',
    quizKey: 'harvesting',
    nextScene: 'roastery',
    nextSpawn: [0, 1.6, 0]
}));
