// ============================================================================
// VIDEO SCENE (REUSABLE)
// ============================================================================
// Full-screen video backdrop with audio VO, subtitles, and gated quiz.
// Extends Scene base class; uses existing playVoWithSubtitles to trigger quiz.

class VideoScene extends Scene {
    constructor({ name, videoSrc, audioKey, quizKey, nextScene, nextSpawn }) {
        super(name);
        this.videoSrc = videoSrc;
        this.audioKey = audioKey;
        this.quizKey = quizKey;
        this.nextScene = nextScene;
        this.nextSpawn = nextSpawn || [0, 1.6, 0];

        this.videoElement = null;
        this.voAudio = null;
        this.quiz = window.PendingQuizzes?.[quizKey] || null;
        this.quizPassed = false;
        this.forwardButton = null;
    }

    async onLoad() {
        await super.onLoad();

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
        `;
        this.videoElement.muted = true;
        this.videoElement.loop = true;
        this.videoElement.playsInline = true;
        this.videoElement.crossOrigin = 'anonymous';

        if (this.videoSrc) {
            this.videoElement.src = this.videoSrc;
            this.videoElement.play().catch(() => {
                // Autoplay may fail; video will start on first user interaction
            });
        }

        document.body.appendChild(this.videoElement);

        // Start VO + subtitles (auto-triggers quiz on end)
        if (this.audioKey) {
            await this.playVoWithSubtitles(this.audioKey);
        }

        // In free-roam mode, show Continue button immediately
        if (window.journeyComplete) {
            this.showForwardButton();
        }
    }

    getNavPromptText() {
        return 'Select Continue to visit the roastery';
    }

    onQuizPassed() {
        this.quizPassed = true;
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
            sceneManager.switchTo(this.nextScene, this.nextSpawn);
        });

        document.body.appendChild(this.forwardButton);
    }

    async onUnload() {
        this.stopVo();

        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.remove();
            this.videoElement = null;
        }

        if (this.forwardButton) {
            this.forwardButton.remove();
            this.forwardButton = null;
        }

        // Restore PlayCanvas canvas
        const canvas = document.getElementById('canvas');
        if (canvas) canvas.style.display = 'block';

        await super.onUnload();
    }
}

// Register harvesting scene
sceneManager.registerScene('harvesting', new VideoScene({
    name: 'harvesting',
    videoSrc: `${R2_BASE}/heroLoop.mp4`,
    audioKey: 'harvesting',
    quizKey: 'harvesting',
    nextScene: 'roastery',
    nextSpawn: [0, 1.6, 0]
}));
