// ============================================================================
// CORE PLAYCANVAS SETUP
// ============================================================================

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
            const equirectScenes = ['street-view', 'video'];
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
        try {
            debugLog(`Switching to scene: ${sceneName}`);
            await fadeOut();
            await this.unloadScene();
            const success = await this.loadScene(sceneName);

            if (success) {
                if (spawnPosition) {
                    cameraEntity.setLocalPosition(spawnPosition[0], spawnPosition[1], spawnPosition[2]);
                }
                appState.nextSceneName = null;
                await fadeIn();
            }
        } catch (e) {
            console.error(`Scene switch to '${sceneName}' failed:`, e);
            try {
                await fadeIn();
            } catch (fadeErr) {
                console.error('Failed to fade in after error:', fadeErr);
            }
        } finally {
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
            console.log(`[raycast] HIT ${closestHit.entity.name}`);
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

    highlightTransitionHotspot() {
        // Find and highlight the first transition hotspot (if hotspotEntities exist)
        if (this.hotspotEntities) {
            const transitionHotspot = this.hotspotEntities.find(h => h.hotspotData?.isTransition);
            if (transitionHotspot) {
                this.hotspotHighlight = true;
                this.highlightedHotspot = transitionHotspot;
                transitionHotspot.isHighlighted = true;
                // Update core material to warm gold
                const core = transitionHotspot.children.find(c => c.name.includes('hotspot-core'));
                if (core && core.render && core.render.meshInstances[0]) {
                    const material = core.render.meshInstances[0].material;
                    if (material) {
                        material.emissive = new pc.Color(1, 0.85, 0.2);
                        material.emissiveIntensity = 8;
                        material.update();
                    }
                }
                // Update glow material to warm gold with higher intensity
                const glow = transitionHotspot.children.find(c => c.name.includes('hotspot-glow'));
                if (glow && glow.render && glow.render.meshInstances[0]) {
                    const material = glow.render.meshInstances[0].material;
                    if (material) {
                        material.emissive = new pc.Color(1, 0.85, 0.2);
                        material.emissiveIntensity = 1.5;
                        material.opacity = 0.4;
                        material.update();
                    }
                }
            }
        }
    }

    playVoWithSubtitles(audioKey) {
        if (window.journeyComplete) {
            return Promise.resolve();
        }

        this.stopVo();

        const lang = window.currentLanguage || 'en';
        // Bisaya support requires Assets/Subtitles/ceb/*.vtt files (and optionally Assets/VO/ceb/*.mp3 for localized VO)
        // VO path currently uses single language variant; audio remains in original language for all locales
        const audioPath = `Assets/VO/${audioKey}.mp3`;
        const langVttPath = lang === 'en' ? `Assets/Subtitles/${audioKey}.vtt` : `Assets/Subtitles/${lang}/${audioKey}.vtt`;
        const fallbackVttPath = `Assets/Subtitles/${audioKey}.vtt`;

        const audio = document.createElement('audio');
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

        track.addEventListener('load', () => {
            const textTrack = audio.textTracks[0];
            if (textTrack) {
                textTrack.mode = 'hidden';
                textTrack.addEventListener('cuechange', () => {
                    const subtitleBar = document.getElementById('subtitle-bar');
                    if (!subtitleBar) return;
                    if (textTrack.activeCues && textTrack.activeCues.length > 0) {
                        subtitleBar.textContent = textTrack.activeCues[0].text;
                        subtitleBar.style.display = 'block';
                    } else {
                        subtitleBar.style.display = 'none';
                    }
                });
            }
        });

        track.addEventListener('error', () => {
            if (lang !== 'en') {
                console.warn(`[VO] Subtitle load failed for ${langVttPath}, trying fallback ${fallbackVttPath}`);
                track.src = fallbackVttPath;
            }
        });

        const triggerQuiz = () => {
            if (this.quiz && !window.journeyComplete && !this.quizTriggered) {
                this.quizTriggered = true;
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
            const voFinishedProp = 'isVoFinished';
            if (voFinishedProp in this) {
                this[voFinishedProp] = true;
            }
            triggerQuiz();
        });

        audio.addEventListener('pause', () => this.clearSubtitles());

        setTimeout(() => {
            audio.play().catch(err => {
                console.log('[VO] Autoplay blocked:', err.message);
                this.clearSubtitles();
                triggerQuiz();
            });
        }, 1000);

        let safetyTimeoutHandle;
        audio.addEventListener('loadedmetadata', () => {
            const duration = audio.duration * 1000 + 2000;
            if (safetyTimeoutHandle) clearTimeout(safetyTimeoutHandle);
            safetyTimeoutHandle = setTimeout(() => {
                const voFinishedProp = 'isVoFinished';
                if (voFinishedProp in this && !this[voFinishedProp]) {
                    this[voFinishedProp] = true;
                    this.clearSubtitles();
                    console.log('[VO] Safety timeout triggered');
                    triggerQuiz();
                }
            }, duration);
        });


        return audio;
    }

    stopVo() {
        if (this.voAudio) {
            this.voAudio.pause();
            const textTracks = this.voAudio.textTracks;
            for (let i = 0; i < textTracks.length; i++) {
                textTracks[i].removeEventListener('cuechange', null);
            }
            this.clearSubtitles();
            if (this.voAudio.parentNode) {
                this.voAudio.parentNode.removeChild(this.voAudio);
            }
            this.voAudio = null;
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

        console.log(`[quiz] hideQuiz() called — THIS SHOULD NOT BE CALLED DURING A QUIZ SET`);
        console.trace();
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
            };
        }
    }

    showVideoPopup(src, { required = false, onFinish = null } = {}) {
        const popup = document.getElementById('video-popup');
        const video = document.getElementById('popup-video');
        const caption = document.getElementById('video-popup-caption');
        const skipBtn = document.getElementById('video-popup-skip');
        let videoPlayable = false;
        let videoEnded = false;
        let fallbackTimeoutHandle = null;

        if (!popup || !video) return;

        caption.textContent = required ? 'Hear it from the owners' : '';
        video.src = src;
        skipBtn.style.display = required ? 'none' : 'block';

        const onVideoEnd = () => {
            videoEnded = true;
            if (fallbackTimeoutHandle) clearTimeout(fallbackTimeoutHandle);
            this.hideVideoPopup();
            if (onFinish) onFinish();
        };

        const onVideoError = () => {
            console.warn('[VideoPopup] Video failed to load');
            if (fallbackTimeoutHandle) clearTimeout(fallbackTimeoutHandle);
            this.hideVideoPopup();
            if (onFinish) onFinish();
        };

        video.addEventListener('ended', onVideoEnd, { once: true });
        video.addEventListener('error', onVideoError, { once: true });

        fallbackTimeoutHandle = setTimeout(() => {
            if (!videoPlayable && !videoEnded) {
                console.warn('[VideoPopup] Video not playable after 10s');
                video.removeEventListener('ended', onVideoEnd);
                video.removeEventListener('error', onVideoError);
                this.hideVideoPopup();
                if (onFinish) onFinish();
            }
        }, 10000);

        video.addEventListener('canplay', () => { videoPlayable = true; }, { once: true });

        popup.style.display = 'flex';
        setTimeout(() => popup.style.opacity = '1', 50);
        video.play().catch(e => console.warn('[VideoPopup] Play failed:', e.message));
    }

    hideVideoPopup() {
        const popup = document.getElementById('video-popup');
        const video = document.getElementById('popup-video');
        if (popup) {
            popup.style.opacity = '0';
            setTimeout(() => {
                popup.style.display = 'none';
                if (video) {
                    video.pause();
                    video.src = '';
                }
            }, 800);
        }
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
        console.log('[DEV] journeyComplete:', window.journeyComplete);
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
    config.debugMode = !config.debugMode;
    debugInfo.classList.toggle('active', config.debugMode);
    console.log('Debug mode:', config.debugMode);
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'c' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const quizOverlay = document.getElementById('quiz-overlay');
        if (!quizOverlay || quizOverlay.style.display !== 'flex') {
            ColorGrading.toggleMenu();
        }
    }
    if ((e.key === '`' || e.key === '~') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
            window.journeyComplete = false;
            location.reload();
        } else {
            toggleDebugMode();
        }
    }
    if (e.key === 'm' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
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

console.log('ThesisApp loaded. Access via window.ThesisApp');
