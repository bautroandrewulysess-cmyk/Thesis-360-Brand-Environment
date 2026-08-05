// ============================================================================
// CORE PLAYCANVAS SETUP
// ============================================================================

const R2_BASE = 'https://pub-d9a52e1dd2124a6a8a669ef46ee0f58d.r2.dev';
const SUBTITLE_VERSION = 3;
window.R2_BASE = R2_BASE;

// Global asset URL helper: encodes path segments while preserving directory structure
const assetUrl = (path) => {
    return `${R2_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
};
window.assetUrl = assetUrl;

const canvas = document.getElementById('canvas');
const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    graphicsDeviceOptions: {
        antialias: false,
        webgpu: true,
        preserveDrawingBuffer: true
    }
});

// Set rendering options
app.scene.ambientLight.set(0.6, 0.6, 0.6);
app.scene.gammaCorrection = pc.GAMMA_SRGB;
app.scene.toneMapping = pc.TONE_MAPPING_ACES;

// Performance optimizations: cap pixel ratio and gaussian splat budget
app.graphicsDevice.maxPixelRatio = 1;
if (app.scene.gsplat) {
    try {
        app.scene.gsplat.splatBudget = 3000000;
    } catch (e) {}
}

// Create camera entity
const cameraEntity = new pc.Entity('camera');
cameraEntity.addComponent('camera', {
    clearColor: new pc.Color(0, 0, 0),
    fov: 75
});
cameraEntity.setLocalPosition(0, 1.6, 0);
app.root.addChild(cameraEntity);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Enable CORS for cross-origin textures
const textureHandler = app.loader.getHandler('texture');
if (textureHandler) {
    textureHandler.crossOrigin = 'anonymous';
}

// WebGL context loss listener
canvas.addEventListener('webglcontextlost', (e) => {
    console.warn('[WebGL] Context lost — possible video playback caused context reclaim');
    e.preventDefault();
});

// ============================================================================
// APPLICATION STATE & CONFIG
// ============================================================================

const appState = {
    isLoadingScene: false,
    isTransitioning: false,
    currentSceneName: null,
    nextSceneName: null,
};

const config = {
    fadeTransitionDuration: 0.6, // seconds
    debugMode: false,
};

const DEV_MODE = ['localhost', '127.0.0.1'].includes(location.hostname);
window.DEV_MODE = DEV_MODE;

// Splat preloading cache
window._preloadedSplats = {};

// Track if this is the first scene load in this session
let isFirstSceneLoad = true;

// Loading screen trivia
const loadingTrivia = [
  "Coffee seedlings spend six to twelve months in polybags before they're strong enough to be planted.",
  "Only the bright red, fully ripe cherries are hand-picked — green and yellow ones are left to ripen.",
  "During roasting, the \"first crack\" is the moment the beans expand and begin developing their flavour.",
  "Granja Alegre sits at the foot of Mount Kalatungan, in Pangantucan, Bukidnon.",
  "It takes roughly three to four years before a newly planted coffee tree bears its first harvest.",
  "Organic fertilizer goes into the planting hole before the seedling — healthy trees start with healthy soil.",
  "Arabica thrives in the cool highlands; Robusta prefers the warmer lowlands.",
  "The word \"terroir\" describes how soil, altitude, and climate shape the taste of what's grown there.",
  "Every cherry is picked by hand, which is why harvest season takes weeks rather than days.",
  "After roasting, beans need to rest for a few days before they reach their best flavour."
];

// ============================================================================
// SCENE MANAGER
// ============================================================================
// Central system that controls which scene is active and handles switching
// with smooth fade-to-black transitions.

class SceneManager {
    constructor(app) {
        this.app = app;
        this.scenes = {};
        this.activeScene = null;
        this.sceneContainer = null;
    }

    registerScene(name, sceneObject) {
        this.scenes[name] = sceneObject;
        debugLog(`Scene registered: ${name}`);
    }

    async unloadScene() {
        if (this.activeScene) {
            if (this.activeScene.onUnload) {
                await this.activeScene.onUnload();
            }

            // Remove scene container and its children
            if (this.sceneContainer) {
                this.app.root.removeChild(this.sceneContainer);
                this.sceneContainer.destroy();
                this.sceneContainer = null;
            }

            debugLog(`Scene unloaded: ${appState.currentSceneName}`);
        }
    }

    async loadScene(sceneName) {
        if (!this.scenes[sceneName]) {
            console.error(`Scene not found: ${sceneName}`);
            return false;
        }

        try {
            appState.isLoadingScene = true;
            const sceneObject = this.scenes[sceneName];

            // Create container for scene
            this.sceneContainer = new pc.Entity('scene-container');
            this.app.root.addChild(this.sceneContainer);

            // Store container reference in scene
            sceneObject.container = this.sceneContainer;

            // Call onLoad
            if (sceneObject.onLoad) {
                await sceneObject.onLoad();
            }

            // Handle color grading per scene type
            const splatScenes = ['cafe-interior', 'roastery', 'nursery', 'cafe-exterior'];
            const equirectScenes = ['street-view', 'harvesting'];
            if (splatScenes.includes(sceneName)) {
                ColorGrading.restoreState();
            } else if (equirectScenes.includes(sceneName)) {
                ColorGrading.saveState();
                ColorGrading.clearCanvasFilter();
                app.scene.exposure = 0.95;
                app.scene.ambientLight.set(1, 1, 1);
                app.scene.gammaCorrection = pc.GAMMA_SRGB;
                app.scene.toneMapping = pc.TONE_MAPPING_ACES;
            } else {
                ColorGrading.applyAll();
            }

            this.activeScene = sceneObject;
            appState.currentSceneName = sceneName;
            debugLog(`Scene loaded: ${sceneName}`);
            return true;
        } catch (error) {
            console.error(`Error loading scene: ${sceneName}`, error);
            return false;
        } finally {
            appState.isLoadingScene = false;
        }
    }

    async switchTo(sceneName, spawnPosition = null) {
        if (appState.isTransitioning || appState.isLoadingScene) {
            console.warn('switchTo blocked — already transitioning');
            return;
        }

        if (appState.currentSceneName === sceneName) {
            debugLog(`Already on scene: ${sceneName}`);
            return;
        }

        appState.isTransitioning = true;
        const loadingScreen = document.getElementById('loading-screen');
        let loadSuccess = false;

        try {
            debugLog(`Switching to scene: ${sceneName}`);
            await fadeOut();
            await this.unloadScene();

            // Show loading screen before loading new scene
            if (loadingScreen) {
                loadingScreen.classList.remove('hidden');
                showLoadingTrivia(sceneName);
            }

            console.log(`[SceneManager] About to load scene: ${sceneName}`);
            const success = await this.loadScene(sceneName);
            loadSuccess = success;
            console.log(`[SceneManager] loadScene result for ${sceneName}: ${success}`);

            if (success) {
                if (spawnPosition) {
                    console.log(`[SceneManager] Setting spawn position: ${JSON.stringify(spawnPosition)}`);
                    cameraEntity.setLocalPosition(spawnPosition[0], spawnPosition[1], spawnPosition[2]);
                }
                appState.nextSceneName = null;
            } else {
                // Show error message for failed load
                const errorMsg = document.getElementById('nav-prompt');
                if (errorMsg) {
                    errorMsg.textContent = `Scene couldn't load. Check your connection or try again.`;
                    errorMsg.style.display = 'block';
                    errorMsg.style.opacity = '1';
                    setTimeout(() => {
                        errorMsg.style.opacity = '0';
                        setTimeout(() => errorMsg.style.display = 'none', 600);
                    }, 4000);
                }
            }
        } catch (e) {
            console.error(`Scene switch to '${sceneName}' failed:`, e);
            // Show error message for exception
            const errorMsg = document.getElementById('nav-prompt');
            if (errorMsg) {
                errorMsg.textContent = `Scene couldn't load. Check your connection or try again.`;
                errorMsg.style.display = 'block';
                errorMsg.style.opacity = '1';
                setTimeout(() => {
                    errorMsg.style.opacity = '0';
                    setTimeout(() => errorMsg.style.display = 'none', 600);
                }, 4000);
            }
        } finally {
            // Always fade in, even on failure
            try {
                await fadeIn();
            } catch (fadeErr) {
                console.error('Failed to fade in:', fadeErr);
            }

            // Hide loading screen
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }

            appState.isTransitioning = false;
        }
    }

    getActiveScene() {
        return this.activeScene;
    }

    getCurrentSceneName() {
        return appState.currentSceneName;
    }
}

const sceneManager = new SceneManager(app);

// ============================================================================
// FADE TRANSITION SYSTEM
// ============================================================================

const fadeOverlay = document.getElementById('fade-overlay');
const fadeTransitionDuration = config.fadeTransitionDuration * 1000;

function fadeOut() {
    return new Promise((resolve) => {
        fadeOverlay.classList.add('active');
        setTimeout(resolve, fadeTransitionDuration);
    });
}

function fadeIn() {
    return new Promise((resolve) => {
        fadeOverlay.classList.remove('active');
        setTimeout(resolve, fadeTransitionDuration);
    });
}

function showLoadingTrivia(targetScene) {
    const triviaEl = document.getElementById('loading-trivia-text');
    if (!triviaEl) return;

    if (triviaEl._triviaInterval) {
        clearInterval(triviaEl._triviaInterval);
    }

    // Show onboarding on first load of cafe-interior only
    if (isFirstSceneLoad && targetScene === 'cafe-interior') {
        triviaEl.innerHTML = `<div style="font-size:0.95rem; line-height:1.8; text-align:center; display:inline-block;">
            <div style="font-weight:500; margin-bottom:12px; color:#f4d03f;">How to explore</div>
            <div style="margin-bottom:8px; text-align:center;"><span style="color:#e8e8e8;">W A S D</span> — walk around</div>
            <div style="margin-bottom:8px; text-align:center;"><span style="color:#e8e8e8;">Mouse drag</span> — look around</div>
            <div style="margin-bottom:8px; text-align:center;"><span style="color:#e8e8e8;">Click markers</span> — move between places</div>
            <div style="text-align:center;"><span style="color:#e8e8e8;">Listen for narration</span> — a question follows each stop</div>
        </div>`;
        triviaEl.style.opacity = '0.8';
        isFirstSceneLoad = false;
    } else {
        // Show rotating trivia on all other loads
        const showRandomTrivia = () => {
            const trivia = loadingTrivia[Math.floor(Math.random() * loadingTrivia.length)];
            triviaEl.style.opacity = '0';
            setTimeout(() => {
                triviaEl.textContent = trivia;
                triviaEl.style.opacity = '0.8';
            }, 200);
        };

        showRandomTrivia();
        triviaEl._triviaInterval = setInterval(showRandomTrivia, 8000);
    }
}

// ============================================================================
// RAYCASTING SYSTEM
// ============================================================================
// Unified click detection system for interactive objects.

class RaycastSystem {
    constructor(app, camera) {
        this.app = app;
        this.camera = camera;
        this.interactiveObjects = new Map();
        this.isEnabled = true;

        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('click', (e) => this.onClick(e));
    }

    onClick(event) {
        if (!this.isEnabled || appState.isTransitioning) {
            return;
        }

        // Block raycasts if quiz or completion panel is open, or if clicking on them or color menu
        const quizOverlay = document.getElementById('quiz-overlay');
        const completionPanel = document.getElementById('completion-panel');
        if ((quizOverlay && quizOverlay.style.display !== 'none') || (completionPanel && completionPanel.style.display !== 'none')) {
            return;
        }
        if (event.target.closest('#quiz-overlay, #completion-panel, #color-menu')) {
            return;
        }

        // Cancel click if it was actually a drag
        const activeScene = sceneManager.getActiveScene();
        if (activeScene && activeScene.mouseDragDistance > 5) {
            activeScene.mouseDragDistance = 0;
            return;
        }

        const camera = this.camera;
        const from = camera.entity.getPosition().clone();
        const to = camera.screenToWorld(event.clientX, event.clientY, 1);
        const dir = new pc.Vec3().sub2(to, from).normalize();

        let closestHit = null;
        let closestDistance = Infinity;

        for (let [entity, data] of this.interactiveObjects.entries()) {
            // Guard: skip destroyed, disabled, or invalid entities
            if (!entity || entity._destroyed || !entity.enabled) {
                continue;
            }

            // Also skip if entity has no parent (detached from scene)
            if (!entity.parent) {
                continue;
            }

            const center = entity.getPosition();
            const radius = data.radius || 0.15;

            // Manual ray-sphere intersection
            const oc = new pc.Vec3().sub2(from, center);
            const a = dir.dot(dir);
            const b = 2.0 * oc.dot(dir);
            const c = oc.dot(oc) - radius * radius;
            const discriminant = b * b - 4 * a * c;

            if (discriminant >= 0) {
                const t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
                if (t > 0 && t < closestDistance) {
                    closestDistance = t;
                    closestHit = { entity, callback: data.callback };
                }
            }
        }

        if (closestHit) {
            if (DEV_MODE) console.log(`[raycast] HIT ${closestHit.entity.name}`);
            closestHit.callback({ entity: closestHit.entity });
        }
    }

    register(entity, callback, radius = 0.15) {
        this.interactiveObjects.set(entity, { callback, radius });
        debugLog(`Registered interactive object: ${entity.name || 'unnamed'}`);
    }

    unregister(entity) {
        this.interactiveObjects.delete(entity);
    }

    clear() {
        this.interactiveObjects.clear();
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }
}

const raycaster = new RaycastSystem(app, cameraEntity.camera);

// ============================================================================
// SCENE TEMPLATE
// ============================================================================
// Base class for scenes to extend.

class Scene {
    constructor(name) {
        this.name = name;
        this.container = null;
        this.interactiveObjects = [];
        this.registeredWithRaycaster = new Set(); // Track all raycaster registrations
        this.voWarningTimer = null;
        this.quizTriggered = false;
        this.videoPending = false;
        this.storedAmbientGain = null;
        this.isVoFinished = false;
    }

    async onLoad() {
        debugLog(`${this.name} onLoad called`);
        this.quizTriggered = false;
    }

    async onUnload() {
        debugLog(`${this.name} onUnload called`);

        this.hideNavPrompt();

        // Unregister ALL objects registered via this scene's wrapper
        for (let entity of this.registeredWithRaycaster) {
            raycaster.unregister(entity);
        }
        this.registeredWithRaycaster.clear();
        this.interactiveObjects = [];

        if (this.voWarningTimer) {
            clearTimeout(this.voWarningTimer);
            this.voWarningTimer = null;
        }
    }

    showVoWarning(message = 'Please wait for the narration to finish.') {
        const warningEl = document.getElementById('vo-warning');
        if (warningEl) {
            warningEl.textContent = message;
            warningEl.style.display = 'block';
            clearTimeout(this.voWarningTimer);
            this.voWarningTimer = setTimeout(() => {
                warningEl.style.display = 'none';
            }, 2200);
        }
    }

    showNavPrompt(text) {
        const prompt = document.getElementById('nav-prompt');
        if (prompt) {
            prompt.textContent = text;
            prompt.style.display = 'block';
            setTimeout(() => prompt.style.opacity = '1', 50);
        }
    }

    hideNavPrompt() {
        const prompt = document.getElementById('nav-prompt');
        if (prompt) {
            prompt.style.opacity = '0';
            setTimeout(() => prompt.style.display = 'none', 600);
        }
    }

    clearSubtitles() {
        const subtitleBar = document.getElementById('subtitle-bar');
        if (subtitleBar) {
            subtitleBar.style.display = 'none';
            subtitleBar.textContent = '';
        }
    }

    getNavPromptText() {
        return null; // Override in subclasses to return scene-appropriate prompt text
    }

    onQuizPassed() {
        this.quizPassed = true;
        this.highlightTransitionHotspot();
        const navText = this.getNavPromptText();
        if (navText) this.showNavPrompt(navText);
    }

    canTransition() {
        if (window.journeyComplete) return true;
        return this.isVoFinished && this.quizPassed && !this.videoPending;
    }

    highlightTransitionHotspot() {
        // Find and highlight the first transition hotspot (if hotspotEntities exist)
        if (this.hotspotEntities) {
            const transitionHotspot = this.hotspotEntities.find(h => h.hotspotData?.isTransition);
            if (transitionHotspot) {
                this.hotspotHighlight = true;
                this.highlightedHotspot = transitionHotspot;
                transitionHotspot.isHighlighted = true;
                // Scale up during highlight only; colour remains gold (already set via diffuse)
                const core = transitionHotspot.coreEntity;
                if (core) core.setLocalScale(0.08, 0.08, 0.08);
                const glow = transitionHotspot.glowEntity;
                if (glow) glow.setLocalScale(0.18, 0.18, 0.18);
            }
        }
    }

    playVoWithSubtitles(audioKey) {
        if (window.journeyComplete) {
            return Promise.resolve();
        }

        this.stopVo();

        const lang = window.currentLanguage || 'en';
        const audioPath = assetUrl(`VO/${audioKey}.mp3`);
        const langVttPath = `${assetUrl(lang === 'en' ? `Subtitles/${audioKey}.vtt` : `Subtitles/${lang}/${audioKey}.vtt`)}?v=${SUBTITLE_VERSION}`;
        const fallbackVttPath = `${assetUrl(`Subtitles/${audioKey}.vtt`)}?v=${SUBTITLE_VERSION}`;

        const audio = document.createElement('audio');
        audio.crossOrigin = 'anonymous';
        audio.src = audioPath;
        audio.preload = 'auto';
        audio.hidden = true;

        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.srclang = 'en';
        track.src = langVttPath;
        track.default = true;
        audio.appendChild(track);

        document.body.appendChild(audio);
        this.voAudio = audio;

        const textTrack = audio.textTracks[0];
        if (textTrack) {
            textTrack.mode = 'hidden';
        }

        const cuechangeHandler = () => {
            const subtitleBar = document.getElementById('subtitle-bar');
            if (!subtitleBar) return;
            if (textTrack.activeCues && textTrack.activeCues.length > 0) {
                subtitleBar.textContent = textTrack.activeCues[0].text;
                subtitleBar.style.display = 'block';
            } else {
                subtitleBar.style.display = 'none';
            }
        };
        if (textTrack) {
            textTrack.addEventListener('cuechange', cuechangeHandler);
            this.voAudioCuechangeHandler = cuechangeHandler;
        }

        track.addEventListener('error', () => {
            if (lang !== 'en') {
                console.warn(`[VO] Subtitle load failed for ${langVttPath}, trying fallback ${fallbackVttPath}`);
                track.src = fallbackVttPath;
            }
        });

        const triggerQuiz = (path) => {
            const requiresEnded = path === 'ended';
            const audioEndedCheck = requiresEnded ? audio.ended === true : true;
            if (this.quiz && !window.journeyComplete && !this.quizTriggered && this.isVoFinished === true && audioEndedCheck) {
                this.quizTriggered = true;
                console.warn(`[VO] Quiz triggered via ${path}`);
                const hookMethod = this[`onVoFinished_${audioKey}`];
                if (typeof hookMethod === 'function') {
                    hookMethod.call(this);
                } else {
                    setTimeout(() => {
                        this.showQuiz(this.quiz, () => {
                            this.onQuizPassed();
                        });
                    }, 1000);
                }
            }
        };

        audio.addEventListener('ended', () => {
            this.clearSubtitles();
            this.isVoFinished = true;
            triggerQuiz('ended');
        });

        audio.addEventListener('pause', () => this.clearSubtitles());

        audio.addEventListener('error', () => {
            console.warn(`[VO] Audio fetch failed for ${audioPath}`);
            this.clearSubtitles();
            this.isVoFinished = true;
            triggerQuiz('audio-error');
        });

        setTimeout(() => {
            audio.play().catch(err => {
                console.warn('[VO] Autoplay blocked:', err.message);
                this.clearSubtitles();
                this.isVoFinished = true;
                triggerQuiz('autoplay-blocked');
            });
        }, 300);

        let safetyTimeoutHandle;
        let timeoutArmed = false;
        const armSafetyTimeout = () => {
            if (timeoutArmed || !isFinite(audio.duration) || audio.duration <= 0) {
                return;
            }
            timeoutArmed = true;
            if (safetyTimeoutHandle) clearTimeout(safetyTimeoutHandle);
            const remainingTime = (audio.duration - audio.currentTime) * 1000 + 2000;
            safetyTimeoutHandle = setTimeout(() => {
                if (!audio.paused && audio.currentTime < audio.duration - 1) {
                    console.warn('[VO] Safety timeout fired but audio still playing, re-arming');
                    timeoutArmed = false;
                    armSafetyTimeout();
                    return;
                }
                if (!this.isVoFinished) {
                    this.isVoFinished = true;
                    this.clearSubtitles();
                    console.warn('[VO] Quiz triggered via safety-timeout');
                    triggerQuiz('safety-timeout');
                }
            }, remainingTime);
        };
        audio.addEventListener('playing', armSafetyTimeout);
        audio.addEventListener('loadedmetadata', armSafetyTimeout);
        audio.addEventListener('durationchange', armSafetyTimeout);


        return audio;
    }

    stopVo() {
        if (this.voAudio) {
            this.voAudio.pause();
            const textTracks = this.voAudio.textTracks;
            for (let i = 0; i < textTracks.length; i++) {
                if (this.voAudioCuechangeHandler) {
                    textTracks[i].removeEventListener('cuechange', this.voAudioCuechangeHandler);
                }
            }
            this.clearSubtitles();
            if (this.voAudio.parentNode) {
                this.voAudio.parentNode.removeChild(this.voAudio);
            }
            this.voAudio = null;
            this.voAudioCuechangeHandler = null;
        }
    }

    async initAmbient(path, gain = 0.1) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
            }
            const response = await fetch(path);
            const buffer = await response.arrayBuffer();
            const decoded = await this.audioContext.decodeAudioData(buffer);
            this.ambientBuffer = decoded;
            this.ambientGain = this.audioContext.createGain();
            this.ambientGain.gain.value = gain;
            this.ambientGain.connect(this.audioContext.destination);
            this.ambientSource = this.audioContext.createBufferSource();
            this.ambientSource.buffer = decoded;
            this.ambientSource.loop = true;
            this.ambientSource.connect(this.ambientGain);
            this.ambientSource.start();
            this.audioLoaded = true;
        } catch(e) {
            if (!this._ambientWarnedOnce) {
                console.warn('Ambient audio init failed:', e);
                this._ambientWarnedOnce = true;
            }
        }
    }

    stopAmbient() {
        if (this.ambientSource) { try { this.ambientSource.stop(); } catch(e) {} }
        if (this.audioContext) { this.audioContext.close(); }
        this.audioContext = null;
        this.ambientSource = null;
        this.ambientGain = null;
        this.audioLoaded = false;
    }

    duckAmbient() {
        if (!this.ambientGain) return;
        this.storedAmbientGain = this.ambientGain.gain.value;
        const targetGain = this.storedAmbientGain * 0.2;
        this.ambientGain.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.4);
    }

    restoreAmbient() {
        if (!this.ambientGain || this.storedAmbientGain === null) return;
        this.ambientGain.gain.setTargetAtTime(this.storedAmbientGain, this.audioContext.currentTime, 0.4);
        this.storedAmbientGain = null;
    }

    pauseAmbient() {
        if (!this.ambientSource || !this.audioContext) return;
        this.ambientPausedGain = this.ambientGain?.gain.value || 0;
        this.ambientPausedOffset = this.audioContext.currentTime;
        try { this.ambientSource.stop(); } catch(e) {}
        this.ambientSource = null;
    }

    resumeAmbient() {
        if (!this.audioContext || !this.audioLoaded || this.ambientPausedOffset === undefined) return;
        const offset = this.audioContext.currentTime - this.ambientPausedOffset;
        this.ambientSource = this.audioContext.createBufferSource();
        this.ambientSource.buffer = this.ambientBuffer;
        this.ambientSource.loop = true;
        this.ambientSource.connect(this.ambientGain);
        this.ambientSource.start(0, offset);
        if (this.ambientGain && this.ambientPausedGain !== undefined) {
            this.ambientGain.gain.value = this.ambientPausedGain;
        }
        this.ambientPausedOffset = undefined;
    }

    showQuiz(quizData, onPass) {
        this.clearSubtitles();
        const overlay = document.getElementById('quiz-overlay');
        const questionEl = document.getElementById('quiz-question');
        const choicesEl = document.getElementById('quiz-choices');
        const feedbackEl = document.getElementById('quiz-feedback');
        const progressEl = document.getElementById('quiz-progress');

        const questions = Array.isArray(quizData) ? quizData : [quizData];
        let currentQuestionIdx = 0;
        let answered = false;

        const showQuestion = (qIdx) => {
            if (qIdx >= questions.length) {
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.style.display = 'none';
                    choicesEl.innerHTML = '';
                    feedbackEl.textContent = '';
                    feedbackEl.style.color = '#f4f4f4';
                    if (progressEl) progressEl.textContent = '';
                    setTimeout(onPass, 100);
                }, 800);
                return;
            }

            const question = questions[qIdx];
            answered = false;
            feedbackEl.textContent = '';
            feedbackEl.style.color = '#f4f4f4';
            questionEl.textContent = question.question;
            if (progressEl && questions.length > 1) {
                progressEl.textContent = `${qIdx + 1} of ${questions.length}`;
            }

            choicesEl.innerHTML = '';

            question.choices.forEach((choice, index) => {
                const btn = document.createElement('button');
                btn.textContent = choice;
                btn.style.cssText = 'padding:12px 16px; background:rgba(255,255,255,0.08); color:#f4f4f4; border:1px solid rgba(255,255,255,0.2); border-radius:6px; font-family:\'Inter\',sans-serif; cursor:pointer; transition:all 0.3s ease; font-size:0.95rem;';
                btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.12)');
                btn.addEventListener('mouseleave', () => !answered && (btn.style.background = 'rgba(255,255,255,0.08)'));

                btn.addEventListener('click', () => {
                    if (answered) return;
                    answered = true;

                    if (index === question.correct) {
                        btn.style.background = 'rgba(34,197,94,0.3)';
                        btn.style.borderColor = 'rgba(34,197,94,0.8)';
                        feedbackEl.textContent = question.feedback;
                        feedbackEl.style.color = '#22c55e';
                        const delayMs = qIdx === questions.length - 1 ? 2500 : 1500;
                        setTimeout(() => showQuestion(qIdx + 1), delayMs);
                    } else {
                        btn.style.background = 'rgba(239,68,68,0.3)';
                        btn.style.borderColor = 'rgba(239,68,68,0.8)';
                        feedbackEl.textContent = question.clue;
                        feedbackEl.style.color = '#fbbf24';
                        answered = false;
                    }
                });

                choicesEl.appendChild(btn);
            });
        };

        showQuestion(0);
        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 50);
    }

    hideQuiz() {
        const overlay = document.getElementById('quiz-overlay');
        const choicesEl = document.getElementById('quiz-choices');
        const feedbackEl = document.getElementById('quiz-feedback');

        if (DEV_MODE) {
            console.log(`[quiz] hideQuiz() called — THIS SHOULD NOT BE CALLED DURING A QUIZ SET`);
            console.trace();
        }
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            choicesEl.innerHTML = '';
            feedbackEl.textContent = '';
            feedbackEl.style.color = '#f4f4f4';
        }, 800);
    }

    registerInteractiveObject(entity, callback, radius = 0.15) {
        raycaster.register(entity, callback, radius);
        this.interactiveObjects.push(entity);
        this.registeredWithRaycaster.add(entity);
    }

    unregisterInteractiveObject(entity) {
        raycaster.unregister(entity);
        this.registeredWithRaycaster.delete(entity);
        this.interactiveObjects = this.interactiveObjects.filter(e => e !== entity);
    }

    showCompletionPanel(title, body, surveyUrl = '#') {
        const panel = document.getElementById('completion-panel');
        const titleEl = document.getElementById('completion-title');
        const bodyEl = document.getElementById('completion-body');
        const surveyLink = document.getElementById('completion-survey');
        const closeBtn = document.getElementById('completion-close');

        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.textContent = body;
        if (surveyLink) surveyLink.href = surveyUrl;

        if (panel) {
            panel.style.display = 'flex';
            setTimeout(() => panel.style.opacity = '1', 50);
        }

        if (closeBtn) {
            closeBtn.onclick = () => {
                if (panel) {
                    panel.style.opacity = '0';
                    setTimeout(() => panel.style.display = 'none', 800);
                }
                window.journeyComplete = true;
                const surveyBottom = document.getElementById('survey-link');
                if (surveyBottom) surveyBottom.style.display = 'block';
                this.preloadSplat(assetUrl('Splats/thesisCafeExterior.sog'), 'thesisCafeExterior');
            };
        }
    }

    showVideoPopup(src, { required = false, caption = null, onFinish = null } = {}) {
        const popup = document.getElementById('video-popup');
        const video = document.getElementById('popup-video');
        const skipBtn = document.getElementById('video-popup-skip');
        const canvas = document.getElementById('canvas');
        let videoPlayable = false;
        let videoEnded = false;
        let fallbackTimeoutHandle = null;

        if (!popup || !video) return;

        if (required) {
            this.videoPending = true;
            this.pauseAmbient();
        }

        video.volume = 1;
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        video.src = src;
        skipBtn.style.display = required ? 'none' : 'block';

        const cleanupVideo = async () => {
            video.volume = 1;
            for (let i = 0; i <= 40; i++) {
                video.volume = Math.max(0, 1 - (i / 40));
                await new Promise(r => setTimeout(r, 10));
            }
            video.pause();
            video.currentTime = 0;
            video.src = '';
            video.load();
        };

        const onVideoEnd = async () => {
            videoEnded = true;
            if (fallbackTimeoutHandle) clearTimeout(fallbackTimeoutHandle);
            await cleanupVideo();
            this.resumeAmbient();
            this.videoPending = false;
            this.hideVideoPopup();
            if (onFinish) onFinish();
        };

        const onVideoError = async () => {
            const errorCode = video.error?.code || 'unknown';
            console.warn(`[VideoPopup] Video failed to load: ${src}, error code: ${errorCode}`);
            if (fallbackTimeoutHandle) clearTimeout(fallbackTimeoutHandle);
            await cleanupVideo();
            this.resumeAmbient();
            this.videoPending = false;
            this.hideVideoPopup();
            if (onFinish) onFinish();
        };

        video.addEventListener('ended', onVideoEnd, { once: true });
        video.addEventListener('error', onVideoError, { once: true });

        fallbackTimeoutHandle = setTimeout(async () => {
            if (!videoPlayable && !videoEnded && video.readyState < 2) {
                console.warn('[VideoPopup] Video not playable after 30s');
                video.removeEventListener('ended', onVideoEnd);
                video.removeEventListener('error', onVideoError);
                await cleanupVideo();
                this.resumeAmbient();
                this.videoPending = false;
                this.hideVideoPopup();
                if (onFinish) onFinish();
            }
        }, 30000);

        video.addEventListener('canplay', () => {
            videoPlayable = true;
            video.play().catch(e => console.warn('[VideoPopup] Play failed:', e.message));
        }, { once: true });

        skipBtn.addEventListener('click', async () => {
            videoEnded = true;
            video.removeEventListener('ended', onVideoEnd);
            video.removeEventListener('error', onVideoError);
            if (fallbackTimeoutHandle) clearTimeout(fallbackTimeoutHandle);
            await cleanupVideo();
            this.resumeAmbient();
            this.videoPending = false;
            this.hideVideoPopup();
            if (onFinish) onFinish();
        }, { once: true });

        popup.style.display = 'block';
        setTimeout(() => popup.style.opacity = '1', 50);
    }

    hideVideoPopup() {
        const popup = document.getElementById('video-popup');
        if (popup) {
            popup.style.opacity = '0';
            setTimeout(() => {
                popup.style.display = 'none';
            }, 800);
        }
    }

    async preloadSplat(url, assetName) {
        if (!window._preloadedSplats) {
            window._preloadedSplats = {};
        }

        if (window._preloadedSplats[assetName]) {
            const cachedAsset = window._preloadedSplats[assetName];
            if (cachedAsset.resource) {
                console.warn(`[Preload] Using cached splat: ${assetName}`);
                return cachedAsset;
            } else {
                console.warn(`[Preload] Cached splat invalid (no resource), discarding: ${assetName}`);
                delete window._preloadedSplats[assetName];
            }
        }

        console.warn(`[Preload] Starting splat download: ${assetName} from ${url}`);
        const splatAsset = new pc.Asset(assetName, 'gsplat', { url });
        app.assets.add(splatAsset);
        app.assets.load(splatAsset);

        return new Promise((resolve) => {
            splatAsset.ready(() => {
                window._preloadedSplats[assetName] = splatAsset;
                console.warn(`[Preload] Splat ready (preloaded): ${assetName}`);
                resolve(splatAsset);
            });
        });
    }

    update(deltaTime) {
        // Override in subclasses
    }
}

// ============================================================================
// INITIALIZE DEFAULT SCENE
// ============================================================================
// Create a simple test scene for Phase 2.

// ============================================================================
// UPDATE LOOP
// ============================================================================

app.on('update', function(deltaTime) {
    const activeScene = sceneManager.getActiveScene();
    if (activeScene && activeScene.update) {
        activeScene.update(deltaTime);
    }
});

// ============================================================================
// COLOR GRADING MODULE
// ============================================================================

const ColorGrading = {
    defaults: {
        exposure: 0.95,
        brightness: 1.15,
        contrast: 1.05,
        saturation: 1.2,
        ambient: 1.15,
        gamma: 'SRGB',
        tonemapping: 'ACES'
    },
    values: {},

    init() {
        this.values = { ...this.defaults };
        this.restoreFromStorage();
        this.setupUI();
    },

    applyAll() {
        app.scene.exposure = this.values.exposure;
        app.scene.ambientLight.set(this.values.ambient, this.values.ambient, this.values.ambient);
        app.scene.gammaCorrection = this.values.gamma === 'SRGB' ? pc.GAMMA_SRGB : pc.GAMMA_NONE;
        const tonemappingMap = { LINEAR: pc.TONE_MAPPING_LINEAR, FILMIC: pc.TONE_MAPPING_FILMIC, HEJL: pc.TONE_MAPPING_HEJL, ACES: pc.TONE_MAPPING_ACES, ACES2: pc.TONE_MAPPING_ACES2 };
        app.scene.toneMapping = tonemappingMap[this.values.tonemapping] || pc.TONE_MAPPING_ACES;
        const canvas = document.getElementById('canvas');
        if (canvas) {
            if (this.values.brightness === 1 && this.values.contrast === 1 && this.values.saturation === 1) {
                canvas.style.filter = '';
            } else {
                canvas.style.filter = `brightness(${this.values.brightness}) contrast(${this.values.contrast}) saturate(${this.values.saturation})`;
            }
        }
    },

    restoreFromStorage() {
        try {
            const stored = sessionStorage.getItem('colorGradingSettings');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.version === 2) {
                    this.values = { ...this.defaults, ...parsed };
                } else {
                    sessionStorage.removeItem('colorGradingSettings');
                }
            }
        } catch (e) {}
    },

    saveToStorage() {
        try {
            sessionStorage.setItem('colorGradingSettings', JSON.stringify({ ...this.values, version: 2 }));
        } catch (e) {}
    },

    setupUI() {
        const sliders = ['exposure', 'brightness', 'contrast', 'saturation', 'ambient'];
        sliders.forEach(name => {
            const slider = document.getElementById(`${name}-slider`);
            const valSpan = document.getElementById(`${name}-val`);
            if (slider) {
                slider.value = this.values[name];
                slider.addEventListener('input', (e) => {
                    this.values[name] = parseFloat(e.target.value);
                    if (valSpan) valSpan.textContent = parseFloat(e.target.value).toFixed(2);
                    this.applyAll();
                    this.saveToStorage();
                });
                if (valSpan) valSpan.textContent = this.values[name].toFixed(2);
            }
        });

        const gammaSelect = document.getElementById('gamma-select');
        if (gammaSelect) {
            gammaSelect.value = this.values.gamma;
            gammaSelect.addEventListener('change', (e) => {
                this.values.gamma = e.target.value;
                this.applyAll();
                this.saveToStorage();
            });
        }

        const tonemappingSelect = document.getElementById('tonemapping-select');
        if (tonemappingSelect) {
            tonemappingSelect.value = this.values.tonemapping;
            tonemappingSelect.addEventListener('change', (e) => {
                this.values.tonemapping = e.target.value;
                this.applyAll();
                this.saveToStorage();
            });
        }

        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.values = { ...this.defaults };
                this.applyAll();
                this.saveToStorage();
                sliders.forEach(name => {
                    const slider = document.getElementById(`${name}-slider`);
                    const valSpan = document.getElementById(`${name}-val`);
                    if (slider) slider.value = this.values[name];
                    if (valSpan) valSpan.textContent = this.values[name].toFixed(2);
                });
                if (gammaSelect) gammaSelect.value = this.values.gamma;
                if (tonemappingSelect) tonemappingSelect.value = this.values.tonemapping;
            });
        }

        const copyBtn = document.getElementById('copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const objStr = 'window.ColorGrading.values = ' + JSON.stringify(this.values, null, 2) + ';';
                navigator.clipboard.writeText(objStr).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => copyBtn.textContent = 'Copy', 1500);
                }).catch(err => console.error('Copy failed:', err));
            });
        }
    },

    toggleMenu() {
        const menu = document.getElementById('color-menu');
        if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    },

    savedState: null,

    clearCanvasFilter() {
        const canvas = document.getElementById('canvas');
        if (canvas) canvas.style.filter = '';
    },

    restoreState() {
        if (this.savedState) {
            this.values = { ...this.savedState };
            this.applyAll();
        } else {
            this.applyAll();
        }
    },

    saveState() {
        this.savedState = { ...this.values };
    }
};

ColorGrading.init();
ColorGrading.applyAll();

// Build dev panels in DOM only if DEV_MODE is true
if (DEV_MODE) {
    const devPanelsHTML = `
        <div id="color-menu" style="position:fixed; top:20px; left:20px; background:rgba(5,5,5,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:20px; width:300px; z-index:940; pointer-events:auto; font-family:'Inter',sans-serif; color:#f4f4f4; backdrop-filter:blur(8px);">
          <h2 style="margin:0 0 18px 0; font-size:1.1rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">Color Grading</h2>
          <div style="font-size:0.85rem; line-height:1.8;">
            <div style="margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <label style="display:block;">Exposure</label>
                <span id="exposure-val" style="color:#f4d03f;">0.95</span>
              </div>
              <input type="range" id="exposure-slider" min="0.1" max="3.0" step="0.05" value="0.95" style="width:100%; cursor:pointer;">
            </div>
            <div style="margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <label style="display:block;">Brightness</label>
                <span id="brightness-val" style="color:#f4d03f;">1.15</span>
              </div>
              <input type="range" id="brightness-slider" min="0" max="2.0" step="0.05" value="1.15" style="width:100%; cursor:pointer;">
            </div>
            <div style="margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <label style="display:block;">Contrast</label>
                <span id="contrast-val" style="color:#f4d03f;">1.05</span>
              </div>
              <input type="range" id="contrast-slider" min="0" max="2.0" step="0.05" value="1.05" style="width:100%; cursor:pointer;">
            </div>
            <div style="margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <label style="display:block;">Saturation</label>
                <span id="saturation-val" style="color:#f4d03f;">1.20</span>
              </div>
              <input type="range" id="saturation-slider" min="0" max="2.0" step="0.05" value="1.2" style="width:100%; cursor:pointer;">
            </div>
            <div style="margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <label style="display:block;">Ambient Light</label>
                <span id="ambient-val" style="color:#f4d03f;">1.15</span>
              </div>
              <input type="range" id="ambient-slider" min="0" max="2.0" step="0.05" value="1.15" style="width:100%; cursor:pointer;">
            </div>
            <div style="margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <label style="display:block;">Gamma Correction</label>
              </div>
              <select id="gamma-select" style="width:100%; padding:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif;">
                <option value="SRGB">sRGB</option>
                <option value="NONE">Linear</option>
              </select>
            </div>
            <div style="margin-bottom:18px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <label style="display:block;">Tonemapping</label>
              </div>
              <select id="tonemapping-select" style="width:100%; padding:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif;">
                <option value="LINEAR">Linear</option>
                <option value="FILMIC">Filmic</option>
                <option value="HEJL">Hejl</option>
                <option value="ACES" selected>ACES</option>
                <option value="ACES2">ACES2</option>
              </select>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="reset-btn" style="flex:1; padding:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">Reset</button>
            <button id="copy-btn" style="flex:1; padding:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">Copy</button>
          </div>
        </div>
        <div id="disc-values" style="position:fixed; bottom:20px; right:20px; background:rgba(5,5,5,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:16px; max-width:320px; max-height:40vh; overflow-y:auto; z-index:940; pointer-events:auto; font-family:monospace; font-size:11px; color:#f4f4f4; backdrop-filter:blur(8px); white-space:pre-wrap; word-wrap:break-word;"><div id="disc-values-content" style="margin-bottom:12px;"></div><div style="display:flex; gap:8px; flex-direction:column;"><button id="disc-copy-pos" style="padding:6px 10px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:monospace; font-size:11px; transition:all 0.2s ease;">Copy this position</button><button id="disc-copy-all" style="padding:6px 10px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:monospace; font-size:11px; transition:all 0.2s ease;">Copy ALL positions</button></div></div>
        <div id="dev-jump-menu" style="position:fixed; top:20px; right:20px; background:rgba(5,5,5,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:20px; width:280px; z-index:940; pointer-events:auto; font-family:'Inter',sans-serif; color:#f4f4f4; backdrop-filter:blur(8px);">
          <h2 style="margin:0 0 16px 0; font-size:0.95rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">Scene Jump</h2>
          <div style="margin-bottom:18px;">
            <button data-scene="cafe-interior" data-position="spawn" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;" class="dev-scene-btn">Café interior</button>
            <button data-scene="cafe-interior" data-return-visit="true" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;" class="dev-scene-btn">Café interior (return)</button>
            <button data-scene="cafe-exterior" data-position="spawn" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;" class="dev-scene-btn">Café exterior</button>
            <button data-scene="nursery" data-position="spawn" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;" class="dev-scene-btn">Nursery</button>
            <button data-scene="roastery" data-position="spawn" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;" class="dev-scene-btn">Roastery</button>
            <button data-scene="street-view" data-position="spawn" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;" class="dev-scene-btn">Street view</button>
            <button data-scene="video" data-position="spawn" style="width:100%; padding:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;" class="dev-scene-btn">Harvesting</button>
          </div>
          <div style="border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:12px; padding-bottom:12px;">
            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <select id="dev-position-select" style="flex:1; padding:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem;"><option>—</option></select>
              <button id="dev-go-position" style="padding:6px 12px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;">Go</button>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="dev-toggle-journey" style="flex:1; padding:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.75rem; transition:all 0.2s ease;">Toggle journey</button>
            <button id="dev-reset-journey" style="flex:1; padding:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.75rem; transition:all 0.2s ease;">Reset journey</button>
          </div>
        </div>
        <div id="debug-overlay" style="position:fixed; top:80px; left:20px; background:rgba(5,5,5,0.95); border:1px solid rgba(0,255,0,0.2); border-radius:8px; padding:12px; width:200px; z-index:940; pointer-events:auto; font-family:monospace; font-size:11px; color:#0f0; backdrop-filter:blur(8px); display:none;">
          <div id="coord-x" style="margin-bottom:4px;">X: 0.000</div>
          <div id="coord-y" style="margin-bottom:4px;">Y: 0.000</div>
          <div id="coord-z" style="margin-bottom:4px;">Z: 0.000</div>
        </div>
        <div id="box-editor" style="position:fixed; top:20px; right:380px; background:rgba(5,5,5,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:16px; width:320px; z-index:940; pointer-events:auto; font-family:'Inter',sans-serif; color:#f4f4f4; backdrop-filter:blur(8px); display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 id="box-editor-title" style="margin:0; font-size:0.95rem; text-transform:uppercase; letter-spacing:0.5px;">Box Editor</h3>
            <span id="box-copy-feedback" style="font-size:0.8rem; color:#c0d9a8; font-weight:500;"></span>
          </div>
          <div style="font-size:0.85rem; line-height:2;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px;">
              <label style="display:flex; align-items:center; gap:4px;"><span style="min-width:20px;">PX:</span><input id="box-px" type="range" min="-100" max="100" step="0.5" style="flex:1; height:20px;"><input id="box-px-num" type="number" step="0.1" style="width:45px; padding:4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:3px; font-family:monospace;"></label>
              <label style="display:flex; align-items:center; gap:4px;"><span style="min-width:20px;">PY:</span><input id="box-py" type="range" min="-100" max="100" step="0.5" style="flex:1; height:20px;"><input id="box-py-num" type="number" step="0.1" style="width:45px; padding:4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:3px; font-family:monospace;"></label>
              <label style="display:flex; align-items:center; gap:4px;"><span style="min-width:20px;">PZ:</span><input id="box-pz" type="range" min="-100" max="100" step="0.5" style="flex:1; height:20px;"><input id="box-pz-num" type="number" step="0.1" style="width:45px; padding:4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:3px; font-family:monospace;"></label>
              <label style="display:flex; align-items:center; gap:4px;"><span style="min-width:20px;">SX:</span><input id="box-sx" type="range" min="0.1" max="50" step="0.1" style="flex:1; height:20px;"><input id="box-sx-num" type="number" step="0.1" style="width:45px; padding:4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:3px; font-family:monospace;"></label>
              <label style="display:flex; align-items:center; gap:4px;"><span style="min-width:20px;">SY:</span><input id="box-sy" type="range" min="0.1" max="50" step="0.1" style="flex:1; height:20px;"><input id="box-sy-num" type="number" step="0.1" style="width:45px; padding:4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:3px; font-family:monospace;"></label>
              <label style="display:flex; align-items:center; gap:4px;"><span style="min-width:20px;">SZ:</span><input id="box-sz" type="range" min="0.1" max="50" step="0.1" style="flex:1; height:20px;"><input id="box-sz-num" type="number" step="0.1" style="width:45px; padding:4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:3px; font-family:monospace;"></label>
              <label style="display:flex; align-items:center; gap:4px;"><span style="min-width:20px;">RY:</span><input id="box-ry" type="range" min="-180" max="180" step="1" style="flex:1; height:20px;"><input id="box-ry-num" type="number" step="0.1" style="width:45px; padding:4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:3px; font-family:monospace;"></label>
              <label style="display:flex; align-items:center; gap:4px; grid-column:1/-1;"><span style="min-width:20px;">OP:</span><input id="box-op" type="range" min="0" max="1" step="0.05" style="flex:1; height:20px;"><input id="box-op-num" type="number" step="0.05" style="width:45px; padding:4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:3px; font-family:monospace;"></label>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button id="box-copy-selected" style="flex:1; padding:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;">Copy selected</button>
            <button id="box-copy-btn" style="flex:1; padding:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#f4f4f4; border-radius:4px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.8rem; transition:all 0.2s ease;">Copy all</button>
          </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', devPanelsHTML);

    // Toggle debug overlay visibility with backtick
    const originalToggleDebugMode = toggleDebugMode;
    window.toggleDebugMode = function() {
        originalToggleDebugMode.call(this);
        const debugOverlay = document.getElementById('debug-overlay');
        if (debugOverlay) debugOverlay.style.display = config.debugMode ? 'block' : 'none';
    };

    // Wrap switchTo to update disc-values visibility on scene change
    const originalSwitchTo = sceneManager.switchTo.bind(sceneManager);
    sceneManager.switchTo = async function(sceneName, spawnPosition) {
        const result = await originalSwitchTo(sceneName, spawnPosition);
        const discPanel = document.getElementById('disc-values');
        if (discPanel) discPanel.style.display = (sceneName === 'street-view') ? 'block' : 'none';
        return result;
    };

    // Copy selected box event handler (only in DEV_MODE)
    const boxCopyBtn = document.getElementById('box-copy-selected');
    if (boxCopyBtn) {
        boxCopyBtn.addEventListener('click', () => {
        const scene = sceneManager.getActiveScene();
        if (!scene || !scene.selectedBox) {
            const feedback = document.getElementById('box-copy-feedback');
            if (feedback) {
                feedback.textContent = 'No box selected';
                setTimeout(() => { feedback.textContent = ''; }, 2000);
            }
            return;
        }

        const b = scene.selectedBox;
        const p = b.getLocalPosition();
        const s = b.getLocalScale();
        const r = b.getLocalEulerAngles();
        let rotY = r.y;
        if (Math.abs(r.x) > 90 || Math.abs(r.z) > 90) rotY = 180 - r.y;
        while (rotY > 180) rotY -= 360;
        while (rotY < -180) rotY += 360;

        const data = `{ name: '${b.name}', pos: [${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}], size: [${s.x.toFixed(3)}, ${s.y.toFixed(3)}, ${s.z.toFixed(3)}], rotY: ${rotY.toFixed(1)} }`;
        navigator.clipboard.writeText(data);

        const feedback = document.getElementById('box-copy-feedback');
        if (feedback) {
            feedback.textContent = '✓ Copied!';
            setTimeout(() => { feedback.textContent = ''; }, 2000);
        }
        });
    }

    ColorGrading.setupUI();

    // Define updateDiscValues safely with null checks
    window.updateDiscValues = function(positionKey, arrows) {
        const content = document.getElementById('disc-values-content');
        if (!content) return;

        let arrowsText = `Arrows at ${positionKey}:\n`;
        if (arrows && arrows.length > 0) {
            arrows.forEach(arrow => {
                arrowsText += `  • ${arrow.label} → ${arrow.target}\n`;
            });
        }
        content.textContent = arrowsText;
    };
}

// ============================================================================
// DEV TOOL — REMOVE BEFORE SUBMISSION
// ============================================================================

const DevJump = {
    mPresses: [],
    mPressTimeout: null,

    init() {
        this.populatePositionSelect();
        this.attachSceneButtonHandlers();
        this.attachPositionHandler();
        this.attachJourneyHandlers();
    },

    populatePositionSelect() {
        if (!sceneManager.scenes['street-view']) return;
        const positions = sceneManager.scenes['street-view'].positions;
        const select = document.getElementById('dev-position-select');
        if (!select || !positions) return;
        Object.keys(positions).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            select.appendChild(option);
        });
    },

    attachSceneButtonHandlers() {
        document.querySelectorAll('.dev-scene-btn').forEach(btn => {
            btn.addEventListener('click', () => this.jumpToScene(btn));
        });
    },

    async jumpToScene(btn) {
        const sceneName = btn.dataset.scene;
        const isReturnVisit = btn.dataset.returnVisit === 'true';
        const scene = sceneManager.scenes[sceneName];
        if (!scene) return;
        scene.quizPassed = true;
        if (isReturnVisit) scene.isReturnVisit = true;
        else if (scene.isReturnVisit !== undefined) scene.isReturnVisit = false;
        await sceneManager.switchTo(sceneName);
        this.closeMenu();
    },

    attachPositionHandler() {
        const btn = document.getElementById('dev-go-position');
        if (!btn) return;
        btn.addEventListener('click', () => this.jumpToPosition());
    },

    jumpToPosition() {
        const select = document.getElementById('dev-position-select');
        const key = select?.value;
        if (!key || key === '—') return;
        const streetScene = sceneManager.scenes['street-view'];
        if (!streetScene) return;
        if (appState.currentSceneName !== 'street-view') {
            streetScene.quizPassed = true;
            sceneManager.switchTo('street-view').then(() => {
                streetScene.transitionToPosition(key);
                this.closeMenu();
            });
        } else {
            streetScene.transitionToPosition(key);
            this.closeMenu();
        }
    },

    attachJourneyHandlers() {
        const toggleBtn = document.getElementById('dev-toggle-journey');
        const resetBtn = document.getElementById('dev-reset-journey');
        if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggleJourney());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetJourney());
    },

    toggleJourney() {
        window.journeyComplete = !window.journeyComplete;
        const surveyLink = document.getElementById('survey-link');
        if (surveyLink) surveyLink.style.display = window.journeyComplete ? 'block' : 'none';
        if (DEV_MODE) console.log('[DEV] journeyComplete:', window.journeyComplete);
    },

    resetJourney() {
        window.journeyComplete = false;
        location.reload();
    },

    toggleMenu() {
        const menu = document.getElementById('dev-jump-menu');
        if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    },

    closeMenu() {
        const menu = document.getElementById('dev-jump-menu');
        if (menu) menu.style.display = 'none';
    }
};

DevJump.init();

// END DEV TOOL

// ============================================================================
// WINDOW RESIZE HANDLING
// ============================================================================

window.addEventListener('resize', () => {
    app.resizeCanvas();
});

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

const debugInfo = document.getElementById('debug-info');

function debugLog(message) {
    if (!DEV_MODE) return;
    if (config.debugMode) {
        console.log(message);
        updateDebugUI();
    }
}

function updateDebugUI() {
    if (!config.debugMode) return;

    debugInfo.innerHTML = `
        Scene: ${appState.currentSceneName || 'none'}<br>
        Transitioning: ${appState.isTransitioning}<br>
        Loading: ${appState.isLoadingScene}<br>
        Time: ${new Date().toLocaleTimeString()}
    `;
}

function toggleDebugMode() {
    if (!DEV_MODE) return;
    config.debugMode = !config.debugMode;
    debugInfo.classList.toggle('active', config.debugMode);
    console.log('Debug mode:', config.debugMode);
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'c' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        if (!DEV_MODE) return;
        const quizOverlay = document.getElementById('quiz-overlay');
        if (!quizOverlay || quizOverlay.style.display !== 'flex') {
            ColorGrading.toggleMenu();
        }
    }
    if ((e.key === '`' || e.key === '~') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!DEV_MODE) return;
        e.preventDefault();
        if (e.shiftKey) {
            window.journeyComplete = false;
            location.reload();
        } else {
            toggleDebugMode();
        }
    }
    if (e.key === 'm' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        if (!DEV_MODE) return;
        const quizOverlay = document.getElementById('quiz-overlay');
        const completionPanel = document.getElementById('completion-panel');
        if ((quizOverlay && quizOverlay.style.display === 'flex') || (completionPanel && completionPanel.style.display === 'flex')) return;
        DevJump.mPresses.push(Date.now());
        if (DevJump.mPressTimeout) clearTimeout(DevJump.mPressTimeout);
        DevJump.mPresses = DevJump.mPresses.filter(t => Date.now() - t < 1000);
        if (DevJump.mPresses.length >= 3) {
            DevJump.toggleMenu();
            DevJump.mPresses = [];
        }
        DevJump.mPressTimeout = setTimeout(() => { DevJump.mPresses = []; }, 1000);
    }
});

// ============================================================================
// STARTUP
// ============================================================================

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('hidden');
}

let hasStarted = false;

async function startup() {
    if (hasStarted) return;
    hasStarted = true;

    try {
        // Initialize journey state for current session only
        window.journeyComplete = false;

        // Start PlayCanvas application
        app.start();

        // Show onboarding on first scene load
        showLoadingTrivia('cafe-interior');

        // Load cafe interior scene (registered by cafeInterior.js)
        await sceneManager.loadScene('cafe-interior');

        hideLoadingScreen();

        debugLog('Application started');
        debugLog('Press backtick (`) to toggle debug mode');
        debugLog('Use sceneManager.switchTo("scene-name") to switch scenes');
    } catch (error) {
        console.error('Startup error:', error);
    }
}

// Start when the landing experience is triggered
async function initializeApp() {
    await startup();
}

window.addEventListener('start360Experience', () => {
    initializeApp();
});

// ============================================================================
// EXPORT PUBLIC API
// ============================================================================

window.ThesisApp = {
    app,
    camera: cameraEntity.camera,
    cameraEntity,
    sceneManager,
    raycaster,
    Scene,
    config,
    debugLog,
    toggleDebugMode,
};

if (DEV_MODE) console.log('ThesisApp loaded. Access via window.ThesisApp');
