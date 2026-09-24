// ============================================================================
// CORE PLAYCANVAS SETUP
// ============================================================================

const R2_BASE = 'https://assets.granjaalegre.com';
const SUBTITLE_VERSION = 6;
// VO audio is the one asset class R2 serves with no cache-control at all -- only an
// etag and last-modified -- so a replaced recording is cached heuristically and a
// returning visitor can keep the old one without ever revalidating. Bumping this
// forces a fresh copy without renaming segment ids, exactly as SUBTITLE_VERSION does
// for the VTTs. Bump it whenever a VO file's CONTENT changes.
const VO_VERSION = 1;

// Where a winner goes to choose their keychain. Leave it empty and winners get a
// claim code to show at the cafe instead; set it to a form URL and they get a button.
// Either way the reward is the same -- this only decides how it is redeemed.
const WINNER_FORM_URL = '';
window.R2_BASE = R2_BASE;

// Global asset URL helper: encodes path segments while preserving directory structure
const assetUrl = (path) => {
    return `${R2_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
};
window.assetUrl = assetUrl;

// Language-aware UI string lookup. Falls back to English whenever the current
// language has no entry, an empty string, or the key itself is unknown, so a
// missing translation can never render blank.
const t = (key) => {
    const entry = (window.Strings || {})[key];
    if (!entry) {
        console.warn(`[i18n] Unknown string key: ${key}`);
        return '';
    }
    const lang = window.currentLanguage || 'en';
    const val = entry[lang];
    return (val === undefined || val === null || val === '') ? entry.en : val;
};
window.t = t;

// Resolve the segment manifest for a scene. Segment ids are language-neutral —
// voUrl() maps each id to the right per-language audio file — so the 'en' list is
// the manifest for every language. A per-language array is only consulted when the
// key actually exists; an existing-but-empty one is a genuine authoring error.
const voSegmentsFor = (sceneKey) => {
    const entry = window.VoSegments?.[sceneKey];
    if (!entry) return null;
    const lang = window.currentLanguage || 'en';
    if (lang !== 'en' && Object.prototype.hasOwnProperty.call(entry, lang)) {
        const langSegments = entry[lang];
        if (langSegments && langSegments.length > 0) return langSegments;
        console.warn(`[VO] ${sceneKey}: '${lang}' segment list exists but is empty`);
    }
    return entry.en || null;
};
window.voSegmentsFor = voSegmentsFor;

// Language-aware VO audio path helper
const voUrl = (audioKey) => {
    const lang = window.currentLanguage || 'en';
    const path = lang === 'en'
        ? `VO/${audioKey}.mp3`
        : `VO/${lang}/${audioKey.replace('_en_', `_${lang}_`)}.mp3`;
    return `${assetUrl(path)}?v=${VO_VERSION}`;
};
window.voUrl = voUrl;

// Language-aware video path helper. Only the two videos with narration baked into
// their audio track (brewingVideo, coffeeRoasting) have per-language versions; every
// other video is muted or narrated by a separate VO file and must keep the base path.
const videoUrl = (name) => {
    const lang = window.currentLanguage || 'en';
    return assetUrl(lang === 'en' ? `Videos/${name}` : `Videos/${lang}/${name}`);
};
window.videoUrl = videoUrl;

// Language-aware subtitle path helper. Mirrors voUrl: English at the Subtitles
// root, every other language in a folder named for it. Version-stamped so a VTT
// correction ships without waiting out the CDN cache.
const subtitleUrl = (name) => {
    const lang = window.currentLanguage || 'en';
    const path = lang === 'en' ? `Subtitles/${name}` : `Subtitles/${lang}/${name}`;
    return `${assetUrl(path)}?v=${SUBTITLE_VERSION}`;
};
window.subtitleUrl = subtitleUrl;

// Subtitles for the videos that carry their own narration in their audio track.
// playVoWithSubtitles never runs for these, so without this nothing would fill the
// subtitle bar while they play. Keyed by gate ref, resolved per language.
// Several call sites reach these videos — the generic gate handler in
// onGateMarkerClick, plus RoasteryScene's and CafeInteriorScene's own gate-marker
// branches in onHotspotClick — so the mapping lives here rather than in any of them.
//
// steps_en_01 is not in any VO sequence: its narration is baked into the brewing
// video's audio track, and its timings already line up from zero, so the segment
// VTT is used as-is rather than merged and offset like the roasting one.
const VIDEO_SUBTITLES = {
    roasterVideo: 'roasting_video.vtt',
    brewingPOV: 'steps_en_01.vtt'
};
const videoSubtitleUrl = (ref) => (VIDEO_SUBTITLES[ref] ? subtitleUrl(VIDEO_SUBTITLES[ref]) : null);
window.videoSubtitleUrl = videoSubtitleUrl;

// Fully release a gaussian splat. app.assets.remove() alone leaks: window._preloadedSplats
// keeps a strong reference to the pc.Asset, which pins its .resource (the GPU buffers), so
// the splat is never collected and VRAM/heap grows with every scene the user visits.
// Releasing means: drop the cache entry, unload the resource, then remove from the registry.
const releaseSplat = (assetName, sceneAsset = null) => {
    const cached = window._preloadedSplats ? window._preloadedSplats[assetName] : null;
    if (window._preloadedSplats) delete window._preloadedSplats[assetName];
    const targets = [];
    if (sceneAsset) targets.push(sceneAsset);
    if (cached && cached !== sceneAsset) targets.push(cached);
    for (const asset of targets) {
        try {
            app.assets.remove(asset);
            if (asset.resource) asset.unload();
        } catch (e) {
            console.warn(`[Splat] Release failed for ${assetName}: ${e.message}`);
        }
    }
    if (targets.length && window.DEV_MODE) console.warn(`[Splat] Released ${assetName} (${targets.length} asset(s))`);
    return targets.length;
};
window.releaseSplat = releaseSplat;

// Free every cached splat except the one the incoming scene is about to consume.
// Catches splats preloaded for a branch the user never took, and orphans cached under
// a name no scene reads (e.g. 'thesisCafeExterior', which nothing consumes).
const sweepPreloadedSplats = (keepAssetName) => {
    if (!window._preloadedSplats) return 0;
    let freed = 0;
    for (const name of Object.keys(window._preloadedSplats)) {
        if (name === keepAssetName) continue;
        freed += releaseSplat(name) ? 1 : 0;
    }
    return freed;
};
window.sweepPreloadedSplats = sweepPreloadedSplats;

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

// Track if scene change was initiated by popstate to avoid pushing duplicate state
let isSceneChangeFromPopstate = false;

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
            try {
                if (this.activeScene.onUnload) {
                    await this.activeScene.onUnload();
                }
            } catch (e) {
                console.error('Error during scene unload:', e);
            }

            // Unconditional teardown: remove orphaned labels and clear raycaster
            document.querySelectorAll('.hotspot-label, .arrow-label').forEach(el => el.remove());
            if (typeof raycaster !== 'undefined') raycaster.clear();

            // Remove scene container and its children
            if (this.sceneContainer) {
                this.app.root.removeChild(this.sceneContainer);
                this.sceneContainer.destroy();
                this.sceneContainer = null;
            }

            this.activeScene = null;
            debugLog(`Scene unloaded: ${appState.currentSceneName}`);
        }

        // Safety net: clear any remaining mesh instances from Immediate and UI layers
        // MUST run outside if(this.activeScene) block to catch cases where activeScene is already null
        try {
            const immediateLayer = this.app.scene.layers.getLayerByName('Immediate');
            const uiLayer = this.app.scene.layers.getLayerByName('UI');

            // Destroy nodes that own orphaned mesh instances (clearMeshInstances() alone doesn't work)
            if (immediateLayer && immediateLayer.meshInstances.length > 0) {
                console.warn(`[SceneManager] Destroying ${immediateLayer.meshInstances.length} orphaned mesh instances in Immediate layer`);
                const meshInstancesToRemove = [...immediateLayer.meshInstances];
                meshInstancesToRemove.forEach(mi => {
                    if (mi.node && !mi.node._destroyed) {
                        mi.node.destroy();
                    }
                });
            }

            if (uiLayer && uiLayer.meshInstances.length > 0) {
                console.warn(`[SceneManager] Destroying ${uiLayer.meshInstances.length} orphaned mesh instances in UI layer`);
                const meshInstancesToRemove = [...uiLayer.meshInstances];
                meshInstancesToRemove.forEach(mi => {
                    if (mi.node && !mi.node._destroyed) {
                        mi.node.destroy();
                    }
                });
            }
        } catch (e) {
            console.error('Error clearing layer mesh instances:', e);
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
            if (window.DEV_MODE) console.warn(`[SceneManager] Queued switch to ${sceneName} — waiting for current transition`);
            // Wait for current transition to complete
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (!appState.isTransitioning && !appState.isLoadingScene) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }

        appState.isTransitioning = true; // Lock immediately

        if (appState.currentSceneName === sceneName) {
            debugLog(`Already on scene: ${sceneName}`);
            appState.isTransitioning = false;
            return;
        }
        const loadingScreen = document.getElementById('loading-screen');
        let loadSuccess = false;
        let loadingScreenShownAt = null;
        const wasFirstSceneLoad = isFirstSceneLoad;

        try {
            debugLog(`Switching to scene: ${sceneName}`);
            await fadeOut();
            await this.unloadScene();

            // Drop splats the incoming scene will not use, so a preload for a branch
            // the user skipped does not sit in VRAM for the rest of the journey.
            sweepPreloadedSplats(`${sceneName}-splat`);

            // Show loading screen before loading new scene
            if (loadingScreen) {
                loadingScreenShownAt = Date.now();
                loadingScreen.classList.remove('hidden');
                loadingScreen.style.opacity = '1';
                loadingScreen.style.pointerEvents = 'auto';
                showLoadingTrivia(sceneName);
            }

            if (window.DEV_MODE) console.log(`[SceneManager] About to load scene: ${sceneName}`);
            const success = await this.loadScene(sceneName);
            loadSuccess = success;
            if (window.DEV_MODE) console.log(`[SceneManager] loadScene result for ${sceneName}: ${success}`);

            if (success) {
                // spawnPosition is either an [x, y, z] triple (every hotspot and
                // videoScene passes one) or a *named* position -- the dev jump menu
                // passes 'spawn' and 'toFarm1'. Indexing a string yields its first
                // three characters, so 'toFarm1' set the camera to ('t','o','F'):
                // a NaN transform, a NaN view matrix, and a black scene with every
                // worldToScreen returning NaN. Only real triples are applied; a name
                // means "leave the scene on its own default spawn".
                const isCoordinateTriple = Array.isArray(spawnPosition)
                    && spawnPosition.length >= 3
                    && Number.isFinite(spawnPosition[0])
                    && Number.isFinite(spawnPosition[1])
                    && Number.isFinite(spawnPosition[2]);
                if (isCoordinateTriple) {
                    if (window.DEV_MODE) console.log(`[SceneManager] Setting spawn position: ${JSON.stringify(spawnPosition)}`);
                    cameraEntity.setLocalPosition(spawnPosition[0], spawnPosition[1], spawnPosition[2]);
                } else if (spawnPosition) {
                    if (window.DEV_MODE) console.log(`[SceneManager] Named spawn "${spawnPosition}" — keeping the scene's default camera`);
                }
                appState.nextSceneName = null;
                // Push scene change to history (skip if this came from a popstate event)
                if (!isSceneChangeFromPopstate) {
                    history.pushState({view:'experience', scene:sceneName}, '', `#experience/${sceneName}`);
                }
                isSceneChangeFromPopstate = false;
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
            // Enforce minimum loading screen duration (3000ms for first scene, 2000ms for others)
            if (loadingScreenShownAt && loadingScreen) {
                const elapsedMs = Date.now() - loadingScreenShownAt;
                const minDurationMs = wasFirstSceneLoad ? 3000 : 2000;
                const remainingMs = Math.max(0, minDurationMs - elapsedMs);
                if (remainingMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, remainingMs));
                }
            }

            // Always fade in, even on failure
            try {
                await fadeIn();
            } catch (fadeErr) {
                console.error('Failed to fade in:', fadeErr);
            }

            // Hide loading screen
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                loadingScreen.style.opacity = '0';
                loadingScreen.style.pointerEvents = 'none';
            }

            // Signal to active scene that loading screen has been dismissed — allows VO to start after loading
            if (this.activeScene?.onLoadingScreenDismissed) {
                this.activeScene.onLoadingScreenDismissed();
            }

            appState.isTransitioning = false;
        }
    }

    getActiveScene() {
        return this.activeScene;
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
        fadeOverlay.style.opacity = '1';
        setTimeout(resolve, fadeTransitionDuration);
    });
}

function fadeIn() {
    return new Promise((resolve) => {
        fadeOverlay.classList.remove('active');
        fadeOverlay.style.opacity = '0';
        setTimeout(resolve, fadeTransitionDuration);
    });
}

// Shared VO playback: plays audio with subtitles (used by both Scene class and brand story overlay)
function playVoSegment(audioKey, subtitleElement, onEnded) {
    return new Promise((resolve) => {
        const lang = window.currentLanguage || 'en';
        let audioPath = voUrl(audioKey);
        const fallbackAudioPath = assetUrl(`VO/${audioKey}.mp3`);
        const langVttPath = `${assetUrl(lang === 'en' ? `Subtitles/${audioKey}.vtt` : `Subtitles/${lang}/${audioKey}.vtt`)}?v=${SUBTITLE_VERSION}`;
        const fallbackVttPath = `${assetUrl(`Subtitles/${audioKey}.vtt`)}?v=${SUBTITLE_VERSION}`;

        const audio = document.createElement('audio');
        audio.crossOrigin = 'anonymous';
        audio.src = audioPath;
        audio.preload = 'auto';
        audio.hidden = true;

        // Create track for subtitle loading
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.srclang = 'en';
        track.src = langVttPath;
        track.default = true;
        audio.appendChild(track);

        document.body.appendChild(audio);
        // The arrow keys need something to seek. This is the brand story's only VO
        // path, and the element was previously held in this closure alone, reachable
        // from nowhere. Cleared in handleEnd so a finished segment is never seeked.
        window.__brandStoryAudio = audio;

        const textTrack = audio.textTracks[0];
        if (textTrack) {
            textTrack.mode = 'hidden';
        }

        const cuechangeHandler = () => {
            if (subtitleElement && textTrack.activeCues && textTrack.activeCues.length > 0) {
                subtitleElement.textContent = textTrack.activeCues[0].text;
            } else if (subtitleElement) {
                subtitleElement.textContent = '';
            }
        };
        if (textTrack) {
            textTrack.addEventListener('cuechange', cuechangeHandler);
        }

        track.addEventListener('error', () => {
            if (lang !== 'en') {
                console.warn(`[VO] Subtitle load failed for ${langVttPath}, trying fallback`);
                track.src = fallbackVttPath;
            }
        });

        let audioFallbackAttempted = false;
        let ended = false;
        const handleEnd = () => {
            if (ended) return;
            ended = true;
            clearInterval(watchdog);
            audio.removeEventListener('ended', handleEnd);
            audio.removeEventListener('error', handleEnd);
            if (subtitleElement) subtitleElement.textContent = '';
            if (window.__brandStoryAudio === audio) window.__brandStoryAudio = null;
            audio.remove();
            if (onEnded) onEnded();
            resolve();
        };

        // ------------------------------------------------------------------
        // Watchdog.
        //
        // This is the brand story's only VO path, and unlike scene VO it had no
        // safety net: onEnded is what spawns the gate button, so a segment that
        // never fires 'ended' leaves the player on the brand story with nothing to
        // click and no way forward. Measured live -- a starved buffer parks the
        // element at paused=false, ended=false, readyState=2, mid-file, forever.
        //
        // Two independent triggers, both requiring the audio to actually be
        // playing, so a deliberate pause never trips them:
        //   - it stops advancing for 5s while unpaused (waiting/stalled), or
        //   - it outlives the time it had left to play, plus 5s.
        //
        // Both call handleEnd, which is already idempotent: a real 'ended' that
        // arrives afterwards finds ended === true and returns, so the gate is
        // spawned exactly once either way.
        //
        // duration is NaN until loadedmetadata, so the budget is only armed once
        // it is finite -- until then the stall trigger covers the window. The
        // budget is recomputed on every seek, so seeking backwards to re-listen
        // extends it rather than tripping it.
        // ------------------------------------------------------------------
        const WATCHDOG_GRACE = 5;
        let budget = null;
        let lastTime = -1;
        let stalledFor = 0;
        const armWatchdog = () => {
            budget = (Number.isFinite(audio.duration) && audio.duration > 0)
                ? (audio.duration - audio.currentTime) + WATCHDOG_GRACE
                : null;
            stalledFor = 0;
            lastTime = -1;
        };
        audio.addEventListener('loadedmetadata', armWatchdog);
        audio.addEventListener('seeking', armWatchdog);
        const watchdog = setInterval(() => {
            if (ended) return;
            if (audio.paused) { lastTime = audio.currentTime; return; }
            if (budget === null) armWatchdog();

            if (Math.abs(audio.currentTime - lastTime) < 0.05) stalledFor += 1;
            else stalledFor = 0;
            lastTime = audio.currentTime;
            if (budget !== null) budget -= 1;

            const stalled = stalledFor >= WATCHDOG_GRACE;
            const overran = budget !== null && budget <= 0;
            if (stalled || overran) {
                console.warn(`[VO] ${audioKey} never ended (${stalled ? 'stalled' : 'overran its duration'}) — opening the gate anyway`);
                handleEnd();
            }
        }, 1000);

        audio.addEventListener('ended', handleEnd);

        audio.addEventListener('error', () => {
            if (lang !== 'en' && !audioFallbackAttempted) {
                audioFallbackAttempted = true;
                console.warn(`[VO] Audio load failed for ${audioPath}, retrying with English`);
                audio.src = fallbackAudioPath;
                audio.load();
                setTimeout(() => {
                    audio.play().catch(e => {
                        console.warn(`[VO] Fallback audio also failed for ${audioKey}: ${e.name}`);
                        handleEnd();
                    });
                }, 100);
            } else {
                console.warn(`[VO] Audio failed for ${audioKey}`);
                handleEnd();
            }
        });

        audio.play().catch(e => {
            // A language fallback swap rejects this pending promise; the error
            // handler owns the retry, so don't tear the element down here.
            if (audioFallbackAttempted) return;
            console.warn(`[VO] Autoplay failed: ${e.name}`);
            handleEnd();
        });
    });
}

// Journey progress for the loading screen. Narrative order, which is not the same as
// the scene list: 'street-view' covers two steps (the walk out and the farm itself) and
// 'cafe-interior' is both the first and last step. Index is therefore tracked as a
// monotonic counter rather than derived from the scene name alone — a second
// cafe-interior load is 'Back to the Cafe', not a return to step 0.
const JOURNEY_STEPS = [
    { key: 'cafeInterior',  scene: 'cafe-interior' },
    { key: 'nursery',       scene: 'nursery' },
    { key: 'journeyToFarm', scene: 'street-view' },
    { key: 'farm',          scene: null },   // same scene as the step above, no load screen of its own
    { key: 'harvesting',    scene: 'harvesting' },
    { key: 'roastery',      scene: 'roastery' },
    { key: 'backToCafe',    scene: 'cafe-interior' }
];
let journeyProgressStep = -1;

// Advance to the earliest step matching this scene that we have not already passed,
// then paint. Scenes outside the narrative (cafe-exterior) leave the track untouched.
function updateJourneyProgress(targetScene) {
    const el = document.getElementById('journey-progress');
    if (!el) return;

    if (window.journeyComplete) {           // free roam: no journey to show
        el.classList.remove('visible');
        el.innerHTML = '';
        updateJourneyBar();
        return;
    }

    const next = JOURNEY_STEPS.findIndex((s, i) => s.scene === targetScene && i > journeyProgressStep);
    if (next !== -1) journeyProgressStep = next;
    if (journeyProgressStep < 0) {
        el.classList.remove('visible');
        return;
    }

    paintJourneyTrack(el);
    el.classList.add('visible');
    paintJourneyPanelTrack();
    updateJourneyBarLabel();
}
window.updateJourneyProgress = updateJourneyProgress;

// The o---o---o track itself. Extracted so the loading screen and the persistent
// journey panel can render the same markup from the same journeyProgressStep; both
// reuse the .jp-* styles unchanged.
function paintJourneyTrack(el) {
    el.innerHTML = '';
    JOURNEY_STEPS.forEach((step, i) => {
        if (i > 0) {
            const link = document.createElement('div');
            link.className = 'jp-link' + (i <= journeyProgressStep ? ' done' : '');
            el.appendChild(link);
        }
        const wrap = document.createElement('div');
        wrap.className = 'jp-step' + (i < journeyProgressStep ? ' done' : i === journeyProgressStep ? ' current' : '');
        const dot = document.createElement('div');
        dot.className = 'jp-dot';
        wrap.appendChild(dot);
        const label = document.createElement('div');
        label.className = 'jp-label';
        label.textContent = t(`ui.progress.${step.key}`);
        wrap.appendChild(label);
        el.appendChild(wrap);
    });
}

function paintJourneyPanelTrack() {
    const track = document.getElementById('journey-panel-track');
    if (track && journeyProgressStep >= 0) paintJourneyTrack(track);
}

// Current location, shown on the collapsed pill.
function updateJourneyBarLabel() {
    const label = document.getElementById('journey-bar-label');
    if (!label) return;
    const step = JOURNEY_STEPS[journeyProgressStep];
    label.textContent = step ? t(`ui.progress.${step.key}`) : '';
}

function closeJourneyPanel() {
    const panel = document.getElementById('journey-panel');
    if (panel) panel.classList.remove('visible');
    // Drives the CSS that suppresses the tutorial card and the farm hint while the
    // panel is open; removing it puts both back exactly as they were, because the
    // suppression is a !important display rule and never touches their own styles.
    document.body.classList.remove('journey-panel-open');
    const toggle = document.getElementById('journey-bar-toggle');
    if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', t('ui.journey.expand'));
    }
}

function toggleJourneyPanel() {
    const panel = document.getElementById('journey-panel');
    if (!panel) return;
    if (panel.classList.contains('visible')) { closeJourneyPanel(); return; }
    paintJourneyPanelTrack();
    if (window.updateJourneyPlant) updateJourneyPlant();
    panel.classList.add('visible');
    document.body.classList.add('journey-panel-open');
    const toggle = document.getElementById('journey-bar-toggle');
    if (toggle) {
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', t('ui.journey.collapse'));
    }
}
window.toggleJourneyPanel = toggleJourneyPanel;

// Visibility follows the clue bar's rules (main.js updateClue): gone while a video or
// any overlay is up. Driven from the global app update rather than a scene's, because
// street-view and videoScene never call updateClue.
function updateJourneyBar() {
    const bar = document.getElementById('journey-bar');
    if (!bar) return;
    const loading = document.getElementById('loading-screen');
    const blocked = window.journeyComplete
        || journeyProgressStep < 0
        || document.body.classList.contains('video-open')
        || document.body.classList.contains('ui-overlay-active')
        || (loading && !loading.classList.contains('hidden'))
        || window.innerWidth < 900;
    if (blocked) {
        bar.classList.remove('visible');
        closeJourneyPanel();
        return;
    }
    bar.classList.add('visible');
}
window.updateJourneyBar = updateJourneyBar;

// ============================================================================
// COFFEE TREE
// ============================================================================
// A plant that grows one step per scene quiz, from seed to a finished cup. It pops
// up over the scene when a quiz-gated transition is taken, and otherwise lives in
// the journey panel, which is the only place it can be looked at again.

// Narrative order. Two of the six hooks advance twice, which is why stages and hooks
// are separate lists rather than one enum: the nursery grows seed -> sprout ->
// polybag seedling in a single pop-up, and the farm young tree -> flowering.
const COFFEE_TREE_STAGES = [
    'seed', 'sprout', 'polybagSeedling', 'youngTree',
    'flowering', 'ripeCherries', 'roastedBeans', 'cup'
];

// Where each hook leaves the plant. growCoffeeTree walks from wherever it is to here,
// so pass-through stages need no special casing.
const COFFEE_TREE_HOOKS = {
    cafeInterior: 'seed',
    nursery: 'polybagSeedling',
    farm: 'flowering',
    harvesting: 'ripeCherries',
    roastery: 'roastedBeans',
    backToCafe: 'cup'
};

// The artwork lives in scenes/coffeeTreeArt.js, loaded before this file. Eight stages,
// each an inline <svg> on a 200x200 viewBox standing on a ground line at y=178 so the
// plant does not jump when one stage cross-fades into the next. Its motion is selected
// by the data-to attribute set on .ct-art below, which names the stage being grown INTO.
const CoffeeTreeArt = window.CoffeeTreeArt || {};

// The art ships its keyframes as a string rather than in index.html so the SVG classes
// and the rules that drive them stay in one file. Injected here, not on first pop-up,
// because the journey panel's slot paints the same art and can open first.
(function injectCoffeeTreeArtCSS() {
    if (!window.CoffeeTreeArtCSS || document.getElementById('coffee-tree-art-css')) return;
    const style = document.createElement('style');
    style.id = 'coffee-tree-art-css';
    style.textContent = window.CoffeeTreeArtCSS;
    document.head.appendChild(style);
})();

// Deliberately on window and deliberately not persisted: it resets on reload, which is
// what a replay should do, and scene instances survive unload so per-scene fields would
// not reset with it. Namespaced so a later score system can sit alongside rather than
// share quizPassed, which already means "this scene's transition is unlocked".
window.CoffeeTree = { stageIndex: -1, fired: {} };

const COFFEE_TREE_TIMING = { popIn: 280, hold: 1800, cross: 420, popOut: 260 };

function ensureCoffeeTreePopup() {
    let el = document.getElementById('coffee-tree-popup');
    if (!el) {
        el = document.createElement('div');
        el.id = 'coffee-tree-popup';
        el.innerHTML = '<div class="ct-card"><div class="ct-art"></div><div class="ct-line"></div></div>';
        document.body.appendChild(el);
    }
    return el;
}

function removeCoffeeTreePopup() {
    const el = document.getElementById('coffee-tree-popup');
    if (el) el.remove();
}
window.removeCoffeeTreePopup = removeCoffeeTreePopup;

// The plant's resting place: the journey panel's slot. Repainted whenever it grows and
// whenever the panel opens, so it always shows the stage actually reached.
function updateJourneyPlant() {
    const slot = document.getElementById('journey-plant');
    if (!slot) return;
    const stage = COFFEE_TREE_STAGES[window.CoffeeTree.stageIndex];
    slot.innerHTML = stage ? CoffeeTreeArt[stage] : '';
    if (stage) slot.setAttribute('data-to', stage);
    else slot.removeAttribute('data-to');
    // Hidden outright until the first hook fires. stageIndex starts at -1, and an
    // empty-but-present slot reserved a visible gap in the journey bar for the whole
    // of the first scene -- a placeholder for something the player had no way to
    // know was coming.
    // 'flex' rather than '' because the rule's own default is flex and this runs on
    // every journey-panel open, so the slot is always correct as the panel appears.
    slot.style.display = window.CoffeeTree.stageIndex >= 0 ? 'flex' : 'none';
}
window.updateJourneyPlant = updateJourneyPlant;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Grow to wherever this hook leaves the plant, showing every stage passed through.
// Awaited by each hook so the pop-up finishes before the transition it precedes.
// Idempotent per hook: a replayed scene or a double-fired handler does nothing.
async function growCoffeeTree(hookKey) {
    const target = COFFEE_TREE_HOOKS[hookKey];
    if (!target) {
        console.warn(`[CoffeeTree] Unknown hook: ${hookKey}`);
        return;
    }
    if (window.CoffeeTree.fired[hookKey]) return;
    const targetIdx = COFFEE_TREE_STAGES.indexOf(target);
    if (targetIdx <= window.CoffeeTree.stageIndex) return;
    window.CoffeeTree.fired[hookKey] = true;

    const el = ensureCoffeeTreePopup();
    const art = el.querySelector('.ct-art');
    const line = el.querySelector('.ct-line');

    // Art, motion and caption move together. Every stage gets its own line, including
    // the intermediate ones the nursery and farm walk through -- captioning those with
    // the target's line described a plant the viewer could not yet see.
    const showStage = (idx) => {
        const stage = COFFEE_TREE_STAGES[idx];
        art.innerHTML = CoffeeTreeArt[stage] || '';
        art.setAttribute('data-to', stage);
        line.textContent = t(`ui.tree.${stage}`);
    };

    const first = window.CoffeeTree.stageIndex + 1;
    showStage(first);
    el.classList.add('visible');
    await wait(COFFEE_TREE_TIMING.popIn + COFFEE_TREE_TIMING.hold);

    for (let i = first + 1; i <= targetIdx; i++) {
        art.classList.remove('ct-grow');
        void art.offsetWidth;                 // restart the animation
        showStage(i);
        art.classList.add('ct-grow');
        await wait(COFFEE_TREE_TIMING.cross + COFFEE_TREE_TIMING.hold);
    }

    el.classList.remove('visible');
    await wait(COFFEE_TREE_TIMING.popOut);
    removeCoffeeTreePopup();

    window.CoffeeTree.stageIndex = targetIdx;
    updateJourneyPlant();
}
// The summary runs after the tree pop-up and before the caller's transition, and it
// runs even when the tree itself no-ops (an already-fired hook), because whether the
// player seeked is independent of whether the plant still had a stage left to grow.
// Captured BEFORE the global is reassigned below. A top-level function declaration in
// a classic script is a property of the global object, and the scene files call the
// bare identifier -- so without this const the wrapper would resolve to itself and
// recurse forever.
const growCoffeeTreeOnly = growCoffeeTree;
async function growCoffeeTreeThenSummarise(hookKey) {
    await growCoffeeTreeOnly(hookKey);
    await showSceneSummary(HOOK_TO_SUMMARY[hookKey]);
}
window.growCoffeeTree = growCoffeeTreeThenSummarise;

// Scene summary. Shown at a scene's exit only when the player seeked FORWARD in that
// scene -- a recap of narration they chose not to hear. Explicit Continue rather than a
// timer: auto-dismissing would repeat exactly the thing the seek was avoiding.
// Takes one key or several. Several exist because the walk to the farm has no exit of
// its own -- it runs straight into the farm -- so its recap rides along with the farm's
// at the farm exit, as two sections of one panel rather than a second pause mid-walk.
// Keys not seeked are dropped, so a player who seeked only one of them sees only that.
function showSceneSummary(voKeys) {
    return new Promise((resolve) => {
        const keys = (Array.isArray(voKeys) ? voKeys : [voKeys]).filter(Boolean);
        const shown = keys.filter(k => window.SceneSeeked[k]
            && window.Strings && window.Strings[`ui.summary.${k}`]);
        if (shown.length === 0) return resolve();
        // Once per sequence: a replayed scene must not show it twice.
        shown.forEach(k => { window.SceneSeeked[k] = false; });

        const el = document.createElement('div');
        el.id = 'scene-summary-panel';
        el.innerHTML =
            '<div class="ss-card">'
          +   '<div class="ss-title"></div>'
          +   '<div class="ss-sections"></div>'
          +   '<button type="button" class="ss-continue"></button>'
          + '</div>';
        el.querySelector('.ss-title').textContent = t('ui.summary.title');
        const sections = el.querySelector('.ss-sections');
        shown.forEach((k, i) => {
            if (i > 0) {
                const rule = document.createElement('div');
                rule.className = 'ss-rule';
                sections.appendChild(rule);
            }
            const body = document.createElement('div');
            body.className = 'ss-body';
            body.textContent = t(`ui.summary.${k}`);
            sections.appendChild(body);
        });
        const btn = el.querySelector('.ss-continue');
        btn.textContent = t('ui.summary.continue');
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('visible'));

        const done = () => {
            el.classList.remove('visible');
            setTimeout(() => { el.remove(); resolve(); }, 260);
        };
        btn.addEventListener('click', done, { once: true });
        btn.focus();
    });
}
window.showSceneSummary = showSceneSummary;

// Which summary each coffee-tree hook closes out. The hooks fire at exactly the seam
// the summary belongs in -- after the tree pop-up, before the loading screen -- so the
// mapping lives here rather than being repeated at all seven call sites.
const HOOK_TO_SUMMARY = {
    cafeInterior: 'cafeInterior',
    nursery: 'nursery',
    // The walk has no exit of its own, so its recap rides along with the farm's.
    farm: ['journeyToFarm', 'farm'],
    harvesting: 'harvesting',
    roastery: 'roasting',
    backToCafe: 'backToCafe'
};

function showLoadingTrivia(targetScene) {
    updateJourneyProgress(targetScene);
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

// ============================================================================
// SCORE AND REWARD
//
// Points come only from first-try correct answers on the six SCENE quizzes. A wrong
// answer is never fatal -- the quiz still makes you retry until you get it right, and
// none of that logic is touched here. Counting is pure observation: a capture-phase
// listener watches clicks land in #quiz-choices and then reads back the colour the
// existing handler painted the button, so nothing about passing or failing a quiz
// changes. Mini-quizzes live in #mini-quiz-overlay and are therefore invisible to it,
// which is exactly the required behaviour rather than a special case.
// ============================================================================

const SCORE_MAX_WRONG = 1;              // at most this many wrong answers still wins
const SCORE_STORAGE_KEY = 'granjaAlegre.runCompleted';

// Every question a complete run asks, across the six scene quizzes. Six sets, seven
// questions -- back-to-café shows backToTheCafe and finalChallenge as one set:
//   cafe.quiz · nursery.quiz · streetView.quiz · harvesting · roastery.quiz ·
//   [backToTheCafe + finalChallenge]
// Winning requires a first-try result recorded for all of them. Without this, a run
// that reached the end screen having answered nothing scored 0 wrong and "won".
const SCORE_REQUIRED_ANSWERS = 7;

window.Score = { firstTryCorrect: 0, firstTryWrong: 0, seen: {} };

// A failure to read storage must never cost someone their reward, so every path that
// cannot prove this is a repeat run treats it as a first run.
function isFirstRun() {
    try {
        return window.localStorage.getItem(SCORE_STORAGE_KEY) === null;
    } catch (e) {
        return true;
    }
}
function markRunCompleted() {
    try {
        window.localStorage.setItem(SCORE_STORAGE_KEY, String(Date.now()));
    } catch (e) {
        // Private browsing or a full quota. Nothing to do: the run still counted, it
        // just cannot be remembered, and the next run is scored as a first run again.
    }
}

document.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('#quiz-choices button') : null;
    if (!btn) return;
    const qEl = document.getElementById('quiz-question');
    const scene = (typeof sceneManager !== 'undefined' && sceneManager.activeScene) ? sceneManager.activeScene.name : '?';
    const key = `${scene}|${qEl ? qEl.textContent.trim() : '?'}`;
    if (window.Score.seen[key]) return;          // only the FIRST answer to a question counts
    window.Score.seen[key] = true;
    // Read back after the app's own handler has painted the result. Green background =
    // correct, red = wrong; both are set synchronously in that handler.
    setTimeout(() => {
        // Whitespace stripped: the browser serialises the colour back as
        // "rgba(34, 197, 94, 0.3)", so matching the unspaced form silently never hits.
        const bg = (btn.style.background || '').replace(/\s+/g, '');
        if (bg.includes('34,197,94')) window.Score.firstTryCorrect++;
        else if (bg.includes('239,68,68')) window.Score.firstTryWrong++;
        else window.Score.seen[key] = false;      // could not tell; let the next click decide
        if (window.DEV_MODE) console.log(`[Score] ${key} -> correct=${window.Score.firstTryCorrect} wrong=${window.Score.firstTryWrong}`);
    }, 0);
}, true);

// Text-only end screen. Sits between the summary panel and the completion panel.
function showScoreEndScreen() {
    return new Promise((resolve) => {
        const firstRun = isFirstRun();
        // Answering nothing is not a near-perfect run. A run that reached this screen
        // without a single recorded answer used to satisfy "wrong <= 1" and win, so
        // completing every question is now a condition in its own right. >= rather than
        // === so an unexpected extra recorded answer can never deny a real win.
        const answered = window.Score.firstTryCorrect + window.Score.firstTryWrong;
        const completedAll = answered >= SCORE_REQUIRED_ANSWERS;
        const won = firstRun && completedAll && window.Score.firstTryWrong <= SCORE_MAX_WRONG;

        const el = document.createElement('div');
        el.id = 'score-panel';
        el.innerHTML =
            '<div class="sc-card">'
          +   '<div class="sc-title"></div>'
          +   '<div class="sc-body"></div>'
          +   '<div class="sc-reward"></div>'
          +   '<button type="button" class="sc-continue"></button>'
          + '</div>';
        const t_ = (k) => t(`ui.score.${k}`);
        el.querySelector('.sc-title').textContent = firstRun ? (won ? t_('winTitle') : t_('loseTitle')) : t_('replayTitle');
        el.querySelector('.sc-body').textContent  = firstRun ? (won ? t_('winBody')  : t_('loseBody'))  : t_('replayBody');

        const reward = el.querySelector('.sc-reward');
        if (won) {
            const contact = document.createElement('div');
            contact.className = 'sc-claim';
            contact.textContent = t_('claimContact');
            const proof = document.createElement('div');
            proof.className = 'sc-hint';
            proof.textContent = t_('claimProof');
            reward.append(contact, proof);
            if (WINNER_FORM_URL) {
                const a = document.createElement('a');
                a.className = 'sc-form';
                a.href = WINNER_FORM_URL;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = t_('formButton');
                reward.appendChild(a);
            }
        }

        const btn = el.querySelector('.sc-continue');
        btn.textContent = t_('continue');
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('visible'));

        // Recorded once the result has actually been shown, so a run that never reached
        // this screen is not burned.
        if (firstRun) markRunCompleted();

        btn.addEventListener('click', () => {
            el.classList.remove('visible');
            setTimeout(() => { el.remove(); resolve(); }, 260);
        }, { once: true });
        btn.focus();
    });
}
window.showScoreEndScreen = showScoreEndScreen;

// ============================================================================
// ARROW-KEY SEEK
//
// Right seeks +10s, Left seeks -10s, inside whatever is currently playing. Forward
// seeks clamp to duration rather than firing anything themselves, so the media ends
// NORMALLY and its gate runs exactly as it would unseeked -- a quiz gate opens its
// quiz, a marker gate spawns its marker and still waits for a real click. That is
// what keeps quizzes, mini-quizzes and the farm close-up block unskippable without a
// single special case. Backward seeks clamp to 0, so they stop at the start of the
// current segment and can never fall into the previous one.
// ============================================================================

const SEEK_STEP = 10;
// Never seek onto duration itself -- see the note in seekBy.
const SEEK_END_EPSILON = 0.15;

// One predicate for "an overlay owns the screen", shared with RaycastSystem.onClick so
// a future overlay blocks clicks and keys together rather than one but not the other.
function uiOverlayActive() {
    const shown = (id) => {
        const el = document.getElementById(id);
        return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
    };
    if (shown('quiz-overlay') || shown('completion-panel')) return true;
    if (document.getElementById('mini-quiz-overlay')) return true;
    if (document.getElementById('coffee-tree-popup')) return true;
    if (document.getElementById('scene-summary-panel')) return true;
    if (document.getElementById('score-panel')) return true;
    return false;
}
window.uiOverlayActive = uiOverlayActive;

// Seeking is refused outright while an overlay is up, mid-transition, or once the
// harvesting quiz has parked the video in its muted loop -- there is nothing left to
// seek there and the quiz must not be reachable past.
function seekBlocked() {
    if (uiOverlayActive()) return true;
    if (typeof appState !== 'undefined' && appState.isTransitioning) return true;
    const scene = (typeof sceneManager !== 'undefined') ? sceneManager.activeScene : null;
    if (scene && scene.harvestLooping) return true;
    return false;
}

// The element the arrows act on. Order matters and the drone is the reason why: a
// full-screen video is playing there, but the transition is cut by the VO ending, not
// by the video, so the VO is what must move. It is reached by the voAudio branch only
// because the drone video is neither #popup-video nor activeScene.videoElement -- do
// not "simplify" this into a generic search for a playing video element.
function currentSeekTarget() {
    const popup = document.getElementById('video-popup');
    if (popup && popup.style.display !== 'none') {
        const v = document.getElementById('popup-video');
        if (v && v.src) return v;
    }
    const scene = (typeof sceneManager !== 'undefined') ? sceneManager.activeScene : null;
    if (scene && scene.videoElement && scene.videoElement.src) return scene.videoElement;
    if (scene && scene.voAudio && scene.voAudio.src) return scene.voAudio;
    if (window.__brandStoryAudio && window.__brandStoryAudio.src) return window.__brandStoryAudio;
    return null;
}

// True once the player has seeked FORWARD in this scene -- the signal the summary
// panel reads. Backward seeks never set it: re-listening is not skipping.
window.SceneSeeked = {};

// Where the last press asked to land. Presses accumulate from here rather than from
// currentTime, so two quick presses go +20s even though the first seek has not landed
// yet. Refusing a press while a seek is in flight was tried instead and was wrong: a
// paused or buffering element can take seconds to emit 'seeked', and every deliberate
// press in that window was silently swallowed. Held keys are handled where they
// actually originate -- the keydown handler drops auto-repeat.
let seekPending = null;

function seekBy(delta) {
    if (seekBlocked()) return null;
    const el = currentSeekTarget();
    if (!el) return null;
    // duration is NaN until loadedmetadata, and seeking against it would throw.
    if (!Number.isFinite(el.duration) || el.duration <= 0) return null;

    const basis = (seekPending && seekPending.el === el) ? seekPending.to : el.currentTime;
    const from = el.currentTime;
    // Stop just short of the end rather than landing on duration exactly. An mp3's
    // declared duration can sit a fraction past its last frame -- measured on the
    // freshly encoded nursery segments, where currentTime = duration snapped the
    // element back to 0 with readyState dropping to 1 instead of firing 'ended'.
    // Leaving a sliver to play out is also truer to the design: the segment ends by
    // reaching its end, never by being forced there, so the gate runs off a genuine
    // 'ended' event every time.
    const forwardLimit = Math.max(0, el.duration - SEEK_END_EPSILON);
    const to = delta > 0
        ? Math.min(basis + SEEK_STEP, forwardLimit)
        : Math.max(basis - SEEK_STEP, 0);
    // Already inside the sliver: let it finish on its own.
    if (to <= from + 0.01 && delta > 0) return null;
    if (to === basis && to === from) return null;

    seekPending = { el, to };
    const clear = () => { if (seekPending && seekPending.el === el) seekPending = null; };
    el.addEventListener('seeked', clear, { once: true });
    setTimeout(clear, 4000);

    el.currentTime = to;

    if (delta > 0) {
        // Keyed on the VO sequence, not the scene: street-view carries both the walk to
        // the farm and the farm itself, and cafe-interior is visited twice. Those are
        // four different summaries, and scene names cannot tell them apart.
        const scene = (typeof sceneManager !== 'undefined') ? sceneManager.activeScene : null;
        const key = (el === window.__brandStoryAudio)
            ? 'brandStoryIntro'
            : (scene && (scene.voSceneKey || scene.audioKey || scene.name));
        if (key) window.SceneSeeked[key] = true;
    }
    if (window.DEV_MODE) console.log(`[Seek] ${delta > 0 ? '+' : ''}${delta}s  ${from.toFixed(2)} -> ${to.toFixed(2)}  on ${el.id || el.tagName}`);
    return { from, to, el };
}
window.seekBy = seekBy;

window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    // Auto-repeat from a held key, not a new intention. This is where held keys are
    // debounced, so that a genuine second press is never mistaken for one.
    if (e.repeat) return;
    const target = e.target;
    // Never steal the arrows from a real text field.
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    e.preventDefault();
    seekBy(e.key === 'ArrowRight' ? SEEK_STEP : -SEEK_STEP);
});

// ============================================================================
// HOTSPOT POPUP ANCHORING
//
// The info popup is placed beside its orb, at the orb's screen position plus a
// fixed offset. Near a viewport edge that offset used to push the card outside:
// measured live at 1440x900, an orb at x=1266 put the card's right edge at 1586
// and its close button at 1551 -- entirely off screen. Neither Escape nor a
// click outside dismissed it, so the only way out was to click a different orb
// and let the popup re-anchor somewhere reachable.
//
// Clamping keeps the whole card, and therefore its close button, on screen on
// every edge. The offset is still applied first, so a popup that already fits
// lands exactly where it always did and nothing moves for the common case.
// ============================================================================
const HOTSPOT_POPUP_MARGIN = 12;
function anchorHotspotPopup(popup, screen) {
    // Laid out and visible by the time this runs, so these are the real size.
    const w = popup.offsetWidth;
    const h = popup.offsetHeight;
    // Math.max guards a card larger than the viewport: it pins to the top-left
    // margin rather than being clamped to a negative coordinate.
    const maxLeft = Math.max(HOTSPOT_POPUP_MARGIN, window.innerWidth - w - HOTSPOT_POPUP_MARGIN);
    const maxTop = Math.max(HOTSPOT_POPUP_MARGIN, window.innerHeight - h - HOTSPOT_POPUP_MARGIN);
    popup.style.left = `${Math.min(Math.max(screen.x + 20, HOTSPOT_POPUP_MARGIN), maxLeft)}px`;
    popup.style.top = `${Math.min(Math.max(screen.y - 60, HOTSPOT_POPUP_MARGIN), maxTop)}px`;
    popup.style.transform = 'none';
}
window.anchorHotspotPopup = anchorHotspotPopup;

// Escape closes the info popup. Deliberately narrow: it acts only when that
// popup is open, so it cannot swallow Escape from a quiz, a video or any other
// overlay that may want it later. The scenes' own update loops notice the lost
// 'active' class and clear activeHotspotEntity, exactly as for a ✕ click.
window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const popup = document.getElementById('hotspot-popup');
    if (popup && popup.classList.contains('active')) {
        popup.classList.remove('active');
    }
});

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

        // Block raycasts while an overlay owns the screen. Shared with the arrow-key
        // seek so both input paths are blocked by the same rule.
        if (uiOverlayActive()) {
            return;
        }
        // The journey bar sits over the canvas and is clickable, so without this a
        // click on the pill would also cast a ray into the scene behind it.
        if (event.target.closest('#quiz-overlay, #completion-panel, #color-menu, #journey-bar, #journey-panel')) {
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

}

const raycaster = new RaycastSystem(app, cameraEntity.camera);

// ============================================================================
// SCENE TEMPLATE
// ============================================================================
// Base class for scenes to extend.

class Scene {
    // Language-aware string lookup for scene-owned UI text. See window.t.
    t(key) {
        return t(key);
    }

    constructor(name) {
        this.name = name;
        this.container = null;
        this.interactiveObjects = [];
        this.registeredWithRaycaster = new Set(); // Track all raycaster registrations
        this.voWarningTimer = null;
        this.voSafetyTimeoutHandle = null; // armed inside playVoWithSubtitles; cancelled by stopVo()
        this.quizTriggered = false;
        this.videoPending = false;
        this.storedAmbientGain = null;
        this.isVoFinished = false;
        this.voSequenceIndex = 0;
        this.voSequenceRunning = false;
        this.voGateType = null; // Set to gate type when paused at a gate ('marker'|'miniquiz'|'quiz'|null)
        this.voSceneKey = null; // voData.js key for the active segment sequence (e.g. 'nursery', 'farm', 'brandStory')
        this.lastClueUpdate = 0; // Throttle clue updates to 250ms

        // Dev key handlers (only bound if DEV_MODE)
        if (window.DEV_MODE) {
            this.onKeyVoSkip = (e) => this.handleVoSkip(e);
            this.onKeyVoReplay = (e) => this.handleVoReplay(e);
            this.onKeyVoResume = (e) => this.handleVoResume(e);
        }
    }

    async onLoad() {
        debugLog(`${this.name} onLoad called`);
        this.quizTriggered = false;
        this.voSequenceIndex = 0;
        this.voSceneKey = null;
        // Safety net: a scene must never start with a stale running flag, whatever
        // happened on the way out last time.
        this.voSequenceRunning = false;
        this.voGateType = null;
        this.isVoFinished = false;

        // Register dev VO shortcuts
        if (window.DEV_MODE) {
            if (window.DEV_MODE) console.log('[VO Shortcuts] Registering Shift+A/S/D shortcuts');
            window.addEventListener('keydown', this.onKeyVoSkip);
            window.addEventListener('keydown', this.onKeyVoReplay);
            window.addEventListener('keydown', this.onKeyVoResume);
        }
    }

    async onUnload() {
        debugLog(`${this.name} onUnload called`);

        this.removeHotspotBadges();

        this.hideNavPrompt();
        this.despawnGateMarker();
        this.hideMiniQuiz();
        this.hideQuiz(true);
        this.setClue(null);
        // Defensive only: the pop-up normally removes itself at the end of its own
        // animation, and every hook awaits it before transitioning. This catches the
        // case where a scene is torn down mid-animation, e.g. via browser history.
        if (window.removeCoffeeTreePopup) window.removeCoffeeTreePopup();

        // Cancel this scene's VO sequence state. Leaving mid-segment means playVoSequence
        // never reaches its finally, so voSequenceRunning would stay true forever and the
        // `if (this.voSequenceRunning) return;` guard would silently mute this scene's VO
        // on every later visit.
        this.voSequenceRunning = false;
        this.voGateType = null;
        this.isVoFinished = false;

        // Backstop: cafeExterior aside, every scene calls stopVo() itself, but an unload
        // path that skips it must still not leave an armed timer behind.
        if (this.voSafetyTimeoutHandle) {
            clearTimeout(this.voSafetyTimeoutHandle);
            this.voSafetyTimeoutHandle = null;
        }

        // Remove clue bar element so it cannot leak into video scenes
        const clueBar = document.getElementById('clue-bar');
        if (clueBar) {
            clueBar.remove();
        }

        // Unregister dev VO shortcuts
        if (window.DEV_MODE) {
            if (this.onKeyVoSkip) window.removeEventListener('keydown', this.onKeyVoSkip);
            if (this.onKeyVoReplay) window.removeEventListener('keydown', this.onKeyVoReplay);
            if (this.onKeyVoResume) window.removeEventListener('keydown', this.onKeyVoResume);
        }

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

    // Drive #subtitle-bar from a VTT that runs alongside a popup video whose narration
    // is baked into its own audio track. Same hidden-track pattern as playVoWithSubtitles:
    // the browser parses the VTT and fires cuechange, but mode='hidden' keeps it from
    // painting its own cue boxes, which look nothing like the overlay every other
    // subtitle in the tour uses.
    //
    // The VTT is fetched and handed to the track as a same-origin blob: URL rather than
    // pointed straight at R2. A cross-origin <track> src would force crossOrigin on the
    // <video>, which turns the video fetch itself into a CORS request — untested against
    // R2 for these files, and a failure there costs the video, not just the subtitles.
    //
    // Returns { detach, ready }. `ready` resolves once the track is attached, or on
    // failure — never rejects — so a caller can wait for subtitles without a dead VTT
    // ever holding up the picture. Call detach on every path that tears the video down.
    attachVideoSubtitles(video, subtitleSrc) {
        let signalReady;
        const ready = new Promise((r) => { signalReady = r; });
        let blobUrl = null;
        let track = null;
        let textTrack = null;
        let cuechangeHandler = null;
        let detached = false;

        const detach = () => {
            detached = true;
            if (textTrack && cuechangeHandler) textTrack.removeEventListener('cuechange', cuechangeHandler);
            if (track && track.parentNode) track.parentNode.removeChild(track);
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            blobUrl = null;
            this.clearSubtitles();
        };

        const fetchStart = performance.now();
        fetch(subtitleSrc)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            })
            .then(vtt => {
                if (detached) return; // video already ended or was skipped mid-fetch
                blobUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
                track = document.createElement('track');
                track.kind = 'subtitles';
                track.srclang = window.currentLanguage || 'en';
                track.src = blobUrl;
                video.appendChild(track);

                textTrack = track.track;
                textTrack.mode = 'hidden'; // hidden, not showing: cues fire, nothing renders

                cuechangeHandler = () => {
                    const subtitleBar = document.getElementById('subtitle-bar');
                    if (window.DEV_MODE && textTrack.activeCues && textTrack.activeCues.length) {
                        // Measured inside the handler: how far past a cue's own start time
                        // the picture already is when that cue is handed to us. Immune to
                        // any external polling, unlike sampling the bar from outside.
                        const cue = textTrack.activeCues[0];
                        (window.__cueLag = window.__cueLag || []).push({
                            src: subtitleSrc.split('/').slice(-1)[0],
                            cueStart: Number(cue.startTime.toFixed(3)),
                            at: Number(video.currentTime.toFixed(3)),
                            lag: Number((video.currentTime - cue.startTime).toFixed(3)),
                        });
                    }
                    if (!subtitleBar) return;
                    if (this.suppressSubtitles) {
                        subtitleBar.style.display = 'none';
                        return;
                    }
                    if (textTrack.activeCues && textTrack.activeCues.length > 0) {
                        subtitleBar.textContent = textTrack.activeCues[0].text;
                        subtitleBar.style.display = 'block';
                    } else {
                        subtitleBar.style.display = 'none';
                    }
                };
                textTrack.addEventListener('cuechange', cuechangeHandler);
                if (window.DEV_MODE) {
                    console.warn(`[VideoPopup] Subtitle track attached after ${Math.round(performance.now() - fetchStart)}ms `
                        + `(video currentTime ${video.currentTime.toFixed(2)}s, paused=${video.paused})`);
                }
            })
            .catch(err => {
                console.warn(`[VideoPopup] Subtitle load failed for ${subtitleSrc}: ${err.message}`);
            })
            .finally(() => signalReady());

        return { detach, ready };
    }

    // ------------------------------------------------------------------
    // Hotspot badges: icon = action.
    //
    // Colour is largely fixed by the voiceover ("golden marker", "blue ones reveal
    // something"), so shape and icon are what separate one orb from another. This
    // matters most in the roastery, which shows a gate orb and a transition orb at
    // the same time — both gold, so only the icon distinguishes them.
    //
    // Delivered as DOM rather than 3D: camera-facing for free, pointer-events:none so
    // it can never absorb a click, and crisp at any distance. Inline SVG rather than
    // Unicode because the obvious glyphs render as colour emoji on macOS.
    // ------------------------------------------------------------------
    hotspotIconKind(hotspot) {
        if (!hotspot) return 'info';
        if (hotspot.isGateMarker || hotspot.isVideo) return 'play';
        if (hotspot.isTransition) return 'exit';
        return 'info';
    }

    hotspotIconSvg(kind) {
        const gold = '#f4d03f', blue = '#4fc3f7';
        const stroke = kind === 'info' ? blue : gold;
        const open = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">`;
        if (kind === 'play') {
            // Solid triangle reads as "plays a video" at small sizes better than an outline.
            return `<svg width="18" height="18" viewBox="0 0 24 24" fill="${gold}"><path d="M8 5.5v13l11-6.5z"/></svg>`;
        }
        if (kind === 'exit') {
            // Door with an arrow leaving it: changes scene.
            return open + '<path d="M14 3H5v18h9"/><path d="M13 12h8"/><path d="M18 8l4 4-4 4"/></svg>';
        }
        return open + '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.6" r="0.9" fill="' + blue + '" stroke="none"/></svg>';
    }

    createHotspotBadges() {
        this.removeHotspotBadges();
        for (const group of (this.hotspotEntities || [])) {
            const hotspot = group && group.hotspotData;
            if (!hotspot) continue;
            const kind = this.hotspotIconKind(hotspot);
            const accent = kind === 'info' ? 'rgba(79,195,247,0.85)' : 'rgba(244,208,63,0.85)';
            const badge = document.createElement('div');
            // 'hotspot-label' too, so the sweeps those scenes already run also catch it.
            badge.className = 'hotspot-label hotspot-badge';
            badge.style.cssText = 'position:fixed; pointer-events:none; z-index:5001; display:none; '
                + 'transform:translate(-50%,-50%); width:30px; height:30px; border-radius:50%; '
                + 'background:rgba(12,12,12,0.72); border:1px solid ' + accent + '; '
                + 'box-shadow:0 0 10px ' + accent + '; align-items:center; justify-content:center;';
            badge.innerHTML = this.hotspotIconSvg(kind);
            document.body.appendChild(badge);
            group.badgeElement = badge;
        }
    }

    removeHotspotBadges() {
        document.querySelectorAll('.hotspot-badge').forEach(el => el.remove());
        for (const group of (this.hotspotEntities || [])) {
            if (group) group.badgeElement = null;
        }
    }

    updateHotspotBadges() {
        if (!this.hotspotEntities || !cameraEntity) return;
        // Self-healing: scenes rebuild their hotspots at various points (quiz pass,
        // free-roam), so rather than asking every scene to remember a second call,
        // notice a hotspot without a badge and rebuild the set here.
        if (this.hotspotEntities.some(g => g && g.hotspotData && !g.badgeElement)) {
            this.createHotspotBadges();
        }
        const overlayActive = document.getElementById('quiz-overlay')?.style.display === 'flex'
            || document.getElementById('completion-panel')?.style.display === 'flex'
            || document.body.classList.contains('video-open');
        const camPos = cameraEntity.getPosition();
        const camFwd = cameraEntity.forward;
        for (const group of this.hotspotEntities) {
            const badge = group && group.badgeElement;
            if (!badge) continue;
            if (overlayActive || !group.enabled || group._destroyed) {
                if (badge.style.display !== 'none') badge.style.display = 'none';
                continue;
            }
            const worldPos = group.getPosition();
            const screen = this.worldToScreen(worldPos);
            const toHotspot = new pc.Vec3().sub2(worldPos, camPos);
            const behind = toHotspot.dot(camFwd) <= 0;
            const off = screen.x < 0 || screen.x > window.innerWidth
                     || screen.y < 0 || screen.y > window.innerHeight;
            const show = !behind && !off;
            badge.style.display = show ? 'flex' : 'none';
            if (show) {
                badge.style.left = `${screen.x}px`;
                badge.style.top = `${screen.y}px`;
            }
        }
    }

    getNavPromptText(hotspot) {
        if (!hotspot || !hotspot.hotspotData?.isTransition) {
            return null;
        }
        if (!cameraEntity) return null;

        const hotspotPos = hotspot.getPosition();
        const camPos = cameraEntity.getPosition();
        const toHotspot = new pc.Vec3().sub2(hotspotPos, camPos);
        toHotspot.normalize();

        const camForward = cameraEntity.forward;
        const camRight = cameraEntity.right;

        const dotForward = toHotspot.dot(camForward);
        const dotRight = toHotspot.dot(camRight);

        const angleRad = Math.acos(Math.max(-1, Math.min(1, dotForward)));
        const angleDeg = angleRad * 180 / Math.PI;

        let text;
        if (angleDeg <= 30) {
            text = t('ui.clue.ahead');
        } else if (angleDeg > 30 && angleDeg <= 100) {
            text = dotRight > 0 ? t('ui.clue.right') : t('ui.clue.left');
        } else {
            text = t('ui.clue.behind');
        }
        return text;
    }

    ensureClueBar() {
        let d = document.getElementById('clue-bar');
        if (!d) {
            d = document.createElement('div');
            d.id = 'clue-bar';
            d.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 22px;background:rgba(0,0,0,0.75);color:#f4d03f;font-family:Inter,sans-serif;font-size:0.95rem;letter-spacing:0.5px;text-transform:uppercase;border:1px solid rgba(244,208,63,0.35);border-radius:30px;z-index:99999;pointer-events:none;';
            document.body.appendChild(d);
        }
        return d;
    }

    setClue(text) {
        const d = this.ensureClueBar();
        if (d._last === text) return;
        d._last = text;
        d.textContent = text || '';
        d.style.display = text ? 'block' : 'none';
    }

    updateClue() {
        if (!this.hotspotEntities) {
            this.setClue(null);
            return;
        }

        if (!this.quizPassed && !window.journeyComplete) {
            this.setClue(null);
            return;
        }

        if (document.body.classList.contains('video-open') || document.body.classList.contains('ui-overlay-active')) {
            this.setClue(null);
            return;
        }

        // Throttle to 250ms
        const now = Date.now();
        if (now - this.lastClueUpdate < 250) return;
        this.lastClueUpdate = now;

        if (!cameraEntity) {
            this.setClue(null);
            return;
        }

        // Find all enabled transition hotspots
        const transitionHotspots = [];
        for (const group of this.hotspotEntities) {
            if (group.hotspotData?.isTransition && group.enabled) {
                transitionHotspots.push(group);
            }
        }

        if (transitionHotspots.length === 0) {
            this.setClue(null);
            return;
        }

        // Pick the nearest by distance from camera
        const camPos = cameraEntity.getPosition();
        let nearestHotspot = null;
        let minDist = Infinity;

        for (const hotspot of transitionHotspots) {
            const worldPos = hotspot.getPosition();
            const toHotspot = new pc.Vec3().sub2(worldPos, camPos);
            const dist = toHotspot.length();
            if (dist < minDist) {
                nearestHotspot = hotspot;
                minDist = dist;
            }
        }

        if (nearestHotspot) {
            const text = this.getNavPromptText(nearestHotspot);
            this.setClue(text);
        } else {
            this.setClue(null);
        }
    }

    async onQuizPassed() {
        this.quizPassed = true;
        this.highlightTransitionHotspot();

        // Play held postquiz segments only if a segment sequence is active for this scene
        if (this.voSceneKey) {
            await this.resumeVoSequence();
        }

        this.hideNavPrompt();
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

    setBrandStoryVideoBackground(audioKey) {
        const brandStoryVideoMap = {
            'brandStory_en_01': 'Videos/mapZoom.mp4',
            'brandStory_en_02': 'Videos/aerial.mp4',
            'brandStory_en_03': 'Videos/farmerMontage.mp4',
        };
        const videoUrl = brandStoryVideoMap[audioKey];
        if (videoUrl) {
            const videoEl = document.getElementById('brand-story-video');
            if (videoEl) {
                const sourceEl = videoEl.querySelector('source');
                if (sourceEl) {
                    sourceEl.src = assetUrl(videoUrl);
                    videoEl.load();
                }
            }
        }
    }

    playVoWithSubtitles(audioKey, isQuizEligible = false) {
        if (window.journeyComplete) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            this.stopVo();

            // Swap brand story background video if this is a brand story segment
            this.setBrandStoryVideoBackground(audioKey);

            const lang = window.currentLanguage || 'en';
            let audioPath = voUrl(audioKey);
            const fallbackAudioPath = assetUrl(`VO/${audioKey}.mp3`);
            const langVttPath = subtitleUrl(`${audioKey}.vtt`);
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
                // Scenes whose video has subtitles burned into the picture set
                // suppressSubtitles so the overlay does not double up on them.
                if (this.suppressSubtitles) {
                    subtitleBar.style.display = 'none';
                    return;
                }
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
                // Belt-and-braces for any in-flight callback that outlived its scene.
                // A null activeScene means a load is in progress, so only bail when a
                // *different* scene is demonstrably active.
                if (sceneManager.activeScene && sceneManager.activeScene !== this) {
                    console.warn(`[VO] Ignoring quiz trigger via ${path} — ${this.name} is no longer the active scene`);
                    return;
                }
                const requiresEnded = path === 'ended';
                const audioEndedCheck = requiresEnded ? audio.ended === true : true;
                if (this.quiz && !window.journeyComplete && !this.quizTriggered && this.isVoFinished === true && audioEndedCheck) {
                    this.quizTriggered = true;
                    if (window.DEV_MODE) console.warn(`[VO] Quiz triggered via ${path}`);
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
                if (isQuizEligible) triggerQuiz('ended');
                resolve();
            });

            audio.addEventListener('pause', () => this.clearSubtitles());

            let audioFallbackAttempted = false;
            audio.addEventListener('error', () => {
                if (lang !== 'en' && !audioFallbackAttempted) {
                    audioFallbackAttempted = true;
                    console.warn(`[VO] Audio load failed for ${audioPath}, retrying with English`);
                    audio.src = fallbackAudioPath;
                    audio.load();
                    setTimeout(() => {
                        audio.play().catch(err => {
                            console.warn(`[VO] Fallback audio also failed for ${audioKey}: ${err.message}`);
                            this.clearSubtitles();
                            this.isVoFinished = true;
                            if (isQuizEligible) triggerQuiz('audio-error-fallback');
                            resolve();
                        });
                    }, 100);
                } else {
                    console.warn(`[VO] Audio fetch failed for ${audioPath}`);
                    this.clearSubtitles();
                    this.isVoFinished = true;
                    if (isQuizEligible) triggerQuiz('audio-error');
                    resolve();
                }
            });

            setTimeout(() => {
                audio.play().catch(err => {
                    // A language fallback swap rejects this pending promise; the
                    // error handler owns the retry, so don't finish the segment here.
                    if (audioFallbackAttempted) return;
                    console.warn('[VO] Autoplay blocked:', err.message);
                    this.clearSubtitles();
                    this.isVoFinished = true;
                    if (isQuizEligible) triggerQuiz('autoplay-blocked');
                    resolve();
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
                safetyTimeoutHandle = this.voSafetyTimeoutHandle = setTimeout(() => {
                    if (!audio.paused && audio.currentTime < audio.duration - 1) {
                        console.warn('[VO] Safety timeout fired but audio still playing, re-arming');
                        timeoutArmed = false;
                        armSafetyTimeout();
                        return;
                    }
                    if (!this.isVoFinished) {
                        this.isVoFinished = true;
                        this.clearSubtitles();
                        if (isQuizEligible) {
                            if (window.DEV_MODE) console.warn('[VO] Quiz triggered via safety-timeout');
                            triggerQuiz('safety-timeout');
                        }
                        resolve();
                    }
                }, remainingTime);
            };
            audio.addEventListener('playing', armSafetyTimeout);
            audio.addEventListener('loadedmetadata', armSafetyTimeout);
            audio.addEventListener('durationchange', armSafetyTimeout);
        });
    }

    stopVo() {
        // Cancel the armed safety timeout first. It is a bare setTimeout closure that
        // nothing else clears, so after a scene change it would fire against the stale
        // scene and trigger a quiz or spawn a gate marker into whatever scene is active
        // by then. Runs outside the voAudio guard so it is cancelled either way.
        if (this.voSafetyTimeoutHandle) {
            clearTimeout(this.voSafetyTimeoutHandle);
            this.voSafetyTimeoutHandle = null;
        }
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

    duckAmbient(level = 0.2) {
        if (!this.ambientGain) return;
        this.storedAmbientGain = this.ambientGain.gain.value;
        const targetGain = this.storedAmbientGain * level;
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
        if (this.ambientGain && this.ambientPausedGain !== undefined) {
            this.ambientGain.gain.value = this.ambientPausedGain;
        }
        if (!this.audioContext || !this.audioLoaded || this.ambientPausedOffset === undefined) return;
        const offset = this.audioContext.currentTime - this.ambientPausedOffset;
        this.ambientSource = this.audioContext.createBufferSource();
        this.ambientSource.buffer = this.ambientBuffer;
        this.ambientSource.loop = true;
        this.ambientSource.connect(this.ambientGain);
        this.ambientSource.start(0, offset);
        this.ambientPausedOffset = undefined;
    }

    showQuiz(quizData, onPass) {
        this.clearSubtitles();
        const overlay = document.getElementById('quiz-overlay');
        const questionEl = document.getElementById('quiz-question');
        const choicesEl = document.getElementById('quiz-choices');
        const feedbackEl = document.getElementById('quiz-feedback');
        const progressEl = document.getElementById('quiz-progress');
        const encouragementEl = document.getElementById('quiz-encouragement');

        const questions = Array.isArray(quizData) ? quizData : [quizData];
        let currentQuestionIdx = 0;
        let answered = false;

        const showQuestion = (qIdx) => {
            if (qIdx >= questions.length) {
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.style.display = 'none';
                    document.body.classList.remove('ui-overlay-active');
                    choicesEl.innerHTML = '';
                    feedbackEl.textContent = '';
                    feedbackEl.style.color = '#f4f4f4';
                    if (encouragementEl) encouragementEl.textContent = '';
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
            // Reassurance reads before the answer, not after — placed above the choices
            // for that reason. Mini-quizzes render elsewhere and deliberately skip it.
            if (encouragementEl) encouragementEl.textContent = t('ui.quiz.encouragement');
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
                        // Reassurance has done its job. Left up, it sat under a green
                        // "Correct!" still telling the player it was okay to get it
                        // wrong. A wrong answer keeps it: that is when it is wanted.
                        if (encouragementEl) encouragementEl.textContent = '';
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
        document.body.classList.add('ui-overlay-active');
        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 50);
    }

    // immediate=true tears the overlay down synchronously instead of after the 800ms
    // fade. Scene unload uses it so the quiz cannot linger into the next scene.
    hideQuiz(immediate = false) {
        const overlay = document.getElementById('quiz-overlay');
        const choicesEl = document.getElementById('quiz-choices');
        const feedbackEl = document.getElementById('quiz-feedback');
        const encouragementEl = document.getElementById('quiz-encouragement');

        if (!overlay) return;

        if (DEV_MODE && !immediate) {
            if (window.DEV_MODE) console.log(`[quiz] hideQuiz() called — THIS SHOULD NOT BE CALLED DURING A QUIZ SET`);
            console.trace();
        }
        const clear = () => {
            overlay.style.display = 'none';
            if (choicesEl) choicesEl.innerHTML = '';
            if (feedbackEl) {
                feedbackEl.textContent = '';
                feedbackEl.style.color = '#f4f4f4';
            }
            if (encouragementEl) encouragementEl.textContent = '';
        };
        overlay.style.opacity = '0';
        if (immediate) clear(); else setTimeout(clear, 800);
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
            document.body.classList.add('ui-overlay-active');
            panel.style.display = 'flex';
            setTimeout(() => panel.style.opacity = '1', 50);
        }

        if (closeBtn) {
            closeBtn.onclick = () => {
                document.body.classList.remove('ui-overlay-active');
                if (panel) {
                    panel.style.opacity = '0';
                    setTimeout(() => panel.style.display = 'none', 800);
                }
                window.journeyComplete = true;
                const surveyBottom = document.getElementById('survey-link');
                if (surveyBottom) surveyBottom.style.display = 'block';
                this.preloadSplat(`${R2_BASE}/thesisCafeExterior_v2.sog`, 'thesisCafeExterior');
            };
        }
    }

    // Wrapped below so the score screen always precedes it -- see the note there.
    showVideoPopup(src, { required = false, caption = null, onFinish = null, narrationId = null, volume = 1, subtitleSrc = null, duckAmbient = false, keepPopupForNext = false } = {}) {
        const popup = document.getElementById('video-popup');
        const video = document.getElementById('popup-video');
        // Improve video hardware acceleration hints to reduce lag when overlaying the canvas
        if (video && video.style) {
            video.style.transform = 'translateZ(0)';
            video.style.willChange = 'transform';
            video.style.backfaceVisibility = 'hidden';
        }
        const skipBtn = document.getElementById('video-popup-skip');
        const canvas = document.getElementById('canvas');
        let videoPlayable = false;
        let videoEnded = false;
        let fallbackTimeoutHandle = null;

        // Mirror of the VO audio fallback: if a per-language video is missing, retry
        // the English original exactly once. Guarded so a second failure falls through
        // to the normal error path instead of looping.
        const videoLang = window.currentLanguage || 'en';
        const englishFallbackSrc = (videoLang !== 'en' && src.includes(`/Videos/${videoLang}/`))
            ? src.replace(`/Videos/${videoLang}/`, '/Videos/')
            : null;
        // If the video falls back to English, its subtitles have to follow — the
        // per-language cuts differ in length, so the other language's timings would be
        // wrong against it.
        const englishFallbackSubtitleSrc = (subtitleSrc && videoLang !== 'en' && subtitleSrc.includes(`/Subtitles/${videoLang}/`))
            ? subtitleSrc.replace(`/Subtitles/${videoLang}/`, '/Subtitles/')
            : null;
        let videoFallbackAttempted = false;

        if (!popup || !video) return;

        if (required) {
            this.videoPending = true;
            if (duckAmbient) {
                if (typeof duckAmbient === 'number') {
                    this.duckAmbient(duckAmbient);
                } else {
                    this.duckAmbient();
                }
            } else {
                this.pauseAmbient();
            }
        }

        // Clear previous tracks
        while (video.firstChild) {
            video.removeChild(video.firstChild);
        }

        video.volume = volume;
        video.preload = 'auto';
        video.src = src;
        skipBtn.style.display = required ? 'none' : 'block';

        // Overlay subtitles for videos whose narration lives in their own audio track.
        // attachVideoSubtitles renders into #subtitle-bar rather than letting the browser
        // draw cues, and never sets crossOrigin on the video — see the comment there.
        video.removeAttribute('crossorigin');
        let detachSubtitles = subtitleSrc ? this.attachVideoSubtitles(video, subtitleSrc).detach : null;

        // Play narration if specified
        if (narrationId) {
            this.playVoWithSubtitles(narrationId, false);
        }

        const cleanupVideo = async () => {
            // Before the fade, not after: a subtitle lingering over a fading video reads
            // as a bug.
            if (detachSubtitles) {
                detachSubtitles();
                detachSubtitles = null;
            }
            const startVol = video.volume;
            for (let i = 0; i <= 40; i++) {
                video.volume = Math.max(0, startVol * (1 - (i / 40)));
                await new Promise(r => setTimeout(r, 10));
            }
            video.pause();
            video.currentTime = 0;
            video.removeAttribute('src');
            video.load();
        };

        const onVideoEnd = async () => {
            videoEnded = true;
            if (fallbackTimeoutHandle) clearTimeout(fallbackTimeoutHandle);
            video.removeEventListener('error', onVideoError);

            // Chained hand-off: the next video takes over this same popup, so cut
            // straight to it. The normal path cannot be reused here -- cleanupVideo()
            // ends with removeAttribute('src') + load(), and hideVideoPopup() fades the
            // overlay out over 800ms before the next one fades back in. Together they
            // showed about a second of the scene behind between the two videos.
            // The popup stays up at full opacity, so the only thing on screen between
            // the last frame of one video and the first frame of the next is the
            // popup's own backdrop. Ambient stays ducked and videoPending stays true,
            // because the player is still held.
            if (keepPopupForNext) {
                if (detachSubtitles) {
                    detachSubtitles();
                    detachSubtitles = null;
                }
                if (onFinish) onFinish();
                return;
            }

            await cleanupVideo();
            this.resumeAmbient();
            this.videoPending = false;
            this.hideVideoPopup(onFinish);
        };

        const onVideoError = async () => {
            const errorCode = video.error?.code || 'unknown';
            if (englishFallbackSrc && !videoFallbackAttempted) {
                videoFallbackAttempted = true;
                console.warn(`[VideoPopup] Video failed to load: ${src}, error code: ${errorCode}, retrying with English`);
                video.addEventListener('error', onVideoError, { once: true }); // re-arm for the retry
                if (detachSubtitles) {
                    detachSubtitles();
                    detachSubtitles = englishFallbackSubtitleSrc
                        ? this.attachVideoSubtitles(video, englishFallbackSubtitleSrc).detach
                        : null;
                }
                video.src = englishFallbackSrc;
                video.load();
                return;
            }
            console.warn(`[VideoPopup] Video failed to load: ${src}, error code: ${errorCode}`);
            if (fallbackTimeoutHandle) clearTimeout(fallbackTimeoutHandle);
            await cleanupVideo();
            this.resumeAmbient();
            this.videoPending = false;
            this.hideVideoPopup(onFinish);
        };

        if (narrationId && this.voAudio) {
            video.loop = true; // Loop the video visually while narration plays
            this.voAudio.addEventListener('ended', onVideoEnd, { once: true }); // Close popup when VO ends
        } else {
            video.addEventListener('ended', onVideoEnd, { once: true });
        }
        video.addEventListener('error', onVideoError, { once: true });

        fallbackTimeoutHandle = setTimeout(async () => {
            if (!videoPlayable && !videoEnded && video.readyState < 2) {
                console.warn('[VideoPopup] Video not playable after 30s');
                video.removeEventListener('ended', onVideoEnd);
                video.removeEventListener('error', onVideoError);
                await cleanupVideo();
                this.resumeAmbient();
                this.videoPending = false;
                this.hideVideoPopup(onFinish);
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
            this.hideVideoPopup(onFinish);
        }, { once: true });

        popup.style.display = 'flex';
        document.body.classList.add('video-open');
        setTimeout(() => popup.style.opacity = '1', 50);
    }

    // onHidden runs when the popup has actually gone, not when the fade starts.
    // Calling it early let the next VO begin roughly half a second before the video
    // disappeared, so the incoming narration overlapped the tail of the outgoing one.
    hideVideoPopup(onHidden) {
        const popup = document.getElementById('video-popup');
        document.body.classList.remove('video-open');
        if (!popup) {
            if (onHidden) onHidden();
            return;
        }
        popup.style.opacity = '0';
        setTimeout(() => {
            popup.style.display = 'none';
            if (onHidden) onHidden();
        }, 800);
    }

    async preloadSplat(url, assetName) {
        if (!window._preloadedSplats) {
            window._preloadedSplats = {};
        }

        if (window._preloadedSplats[assetName]) {
            const cachedAsset = window._preloadedSplats[assetName];
            if (cachedAsset.resource && cachedAsset.ready) {
                if (window.DEV_MODE) console.warn(`[Preload] Using cached splat: ${assetName}`);
                return cachedAsset;
            } else {
                console.warn(`[Preload] Cached splat invalid (no resource/ready), discarding: ${assetName}`);
                delete window._preloadedSplats[assetName];
            }
        }

        if (window.DEV_MODE) console.warn(`[Preload] Starting splat download: ${assetName} from ${url}`);
        const splatAsset = new pc.Asset(assetName, 'gsplat', { url });
        app.assets.add(splatAsset);
        app.assets.load(splatAsset);

        return new Promise((resolve) => {
            splatAsset.ready(() => {
                window._preloadedSplats[assetName] = splatAsset;
                if (window.DEV_MODE) console.warn(`[Preload] Splat ready (preloaded): ${assetName}`);
                resolve(splatAsset);
            });
        });
    }

    // Fire the end-of-scene quiz without playing a VO segment. Mirrors the triggerQuiz()
    // closure inside playVoWithSubtitles so a skipped sting still opens the quiz its gate
    // was responsible for, instead of leaving the scene without a quiz.
    triggerQuizDirect(audioKey) {
        // Same stale-scene guard as the triggerQuiz closure: never open a quiz for a
        // scene the player has already left.
        if (sceneManager.activeScene && sceneManager.activeScene !== this) {
            console.warn(`[VO] Ignoring direct quiz trigger (${audioKey}) — ${this.name} is no longer the active scene`);
            return;
        }
        if (!this.quiz || window.journeyComplete || this.quizTriggered) return;
        this.quizTriggered = true;
        if (window.DEV_MODE) console.warn(`[VO] Quiz triggered directly (segment ${audioKey} skipped)`);
        const hookMethod = this[`onVoFinished_${audioKey}`];
        if (typeof hookMethod === 'function') {
            hookMethod.call(this);
            return;
        }
        setTimeout(() => {
            this.showQuiz(this.quiz, () => {
                this.onQuizPassed();
            });
        }, 1000);
    }

    async playVoSequence(sceneKey) {
        if (this.voSequenceRunning) return;
        this.voSceneKey = sceneKey;
        const segments = voSegmentsFor(sceneKey);
        if (!segments || segments.length === 0) {
            console.warn(`[VO] No segments found for ${sceneKey}`);
            return;
        }

        this.voSequenceRunning = true;
        try {
            while (this.voSequenceIndex < segments.length) {
                const segment = segments[this.voSequenceIndex];
                const gateType = segment.gate?.type;

                // Skip postquiz segments if quiz hasn't passed yet. Assumption: postquiz segments
                // always come after quiz gates in voData.js, so they're unreachable until quiz fires.
                // If the order ever changes, this destructive skip would lose segments.
                if (gateType === 'postquiz' && !this.quizPassed) {
                    this.voSequenceIndex++;
                    continue;
                }

                const isQuizSegment = gateType === 'quiz';
                // Segments with no recording in the active language are skipped outright
                // rather than falling back to English mid-sequence. The gate below still
                // runs, so a skipped quiz sting still opens its quiz.
                const missingNonEn = window.VoMissingNonEn || new Set();
                if (missingNonEn.has(segment.id) && (window.currentLanguage || 'en') !== 'en') {
                    if (window.DEV_MODE) console.warn(`[VO] Skipping ${segment.id} — no ${window.currentLanguage} recording`);
                    this.isVoFinished = true;
                    if (isQuizSegment) this.triggerQuizDirect(segment.id);
                } else {
                    if (window.DEV_MODE) console.log(`[VO] Playing segment ${this.voSequenceIndex + 1}/${segments.length}: ${segment.id}`);
                    await this.playVoWithSubtitles(segment.id, isQuizSegment);
                }

                if (gateType === 'marker') {
                    if (window.DEV_MODE) console.log(`[VO] Paused at marker gate`);
                    this.voGateType = gateType;
                    this.spawnGateMarker(segment.gate);
                    break;
                } else if (gateType === 'miniquiz') {
                    if (window.DEV_MODE) console.log(`[VO] Paused at miniquiz gate`);
                    this.voGateType = gateType;
                    const quizData = this.getMiniQuizData?.(segment.gate.ref);
                    if (quizData) {
                        this.showMiniQuiz(segment.gate.ref, quizData);
                    }
                    break;
                } else if (gateType === 'quiz') {
                    if (window.DEV_MODE) console.log(`[VO] Reached quiz gate (terminal)`);
                    break;
                } else {
                    this.voSequenceIndex++;
                }
            }
            // If we exited the loop normally (all segments played), clear gate type and sequence key
            if (this.voSequenceIndex >= segments.length) {
                this.voGateType = null;
                this.voSceneKey = null;
            }
        } finally {
            this.voSequenceRunning = false;
        }
    }

    async resumeVoSequence() {
        if (!this.voSceneKey) {
            console.warn(`[VO] No active segment sequence, cannot resume`);
            return;
        }

        if (!window.VoSegments?.[this.voSceneKey]) {
            console.warn(`[VO] No segments defined for ${this.voSceneKey}, cannot resume`);
            return;
        }

        const segments = voSegmentsFor(this.voSceneKey);
        if (!segments || segments.length === 0) return;
        if (this.voSequenceIndex >= segments.length) return;

        this.voSequenceIndex++;
        this.voGateType = null; // Clear gate type when resuming

        // If we just passed a quiz, check for postquiz segments
        if (this.quizPassed) {
            while (this.voSequenceIndex < segments.length && segments[this.voSequenceIndex].gate?.type === 'postquiz') {
                const segment = segments[this.voSequenceIndex];
                if (window.DEV_MODE) console.log(`[VO] Playing postquiz segment: ${segment.id}`);
                await this.playVoWithSubtitles(segment.id, false);
                this.voSequenceIndex++;
            }
        }

        await this.playVoSequence(this.voSceneKey);
    }

    getGateMarkerLabel(gateRef) {
        const key = `ui.gate.${gateRef}`;
        // Check the table directly so an unknown ref falls back quietly rather
        // than emitting an [i18n] unknown-key warning.
        return (window.Strings && window.Strings[key]) ? t(key) : t('ui.gate.default');
    }

    spawnGateMarker(gate) {
        // Belt-and-braces: never spawn a marker for a scene the player has already left.
        if (sceneManager.activeScene && sceneManager.activeScene !== this) {
            console.warn(`[Gate] Ignoring marker spawn (${gate?.ref}) — ${this.name} is no longer the active scene`);
            return;
        }

        // Clean up any existing marker
        this.despawnGateMarker();

        // Create DOM button, screen-fixed and centred
        const button = document.createElement('button');
        button.className = 'gate-marker-button';
        button.textContent = this.getGateMarkerLabel(gate.ref);
        button.style.cssText = `position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); padding:14px 28px; background:#f4d03f; border:none; color:#050505; font-family:'Inter',sans-serif; font-size:1rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; border-radius:6px; cursor:pointer; transition:all 0.3s ease; z-index:940; outline:none; animation:gate-marker-pulse 2s ease-in-out infinite; box-shadow: 0 0 20px rgba(244,208,63,0.5);`;

        // Guard against double-clicks and drag-clicks
        let clicked = false;
        let pointerDownX = 0;
        let pointerDownY = 0;

        button.addEventListener('pointerdown', (e) => {
            pointerDownX = e.clientX;
            pointerDownY = e.clientY;
        });

        const handleClick = (e) => {
            if (clicked) return;
            // Guard against drag: only fire if pointer moved < 5px
            const dx = Math.abs(e.clientX - pointerDownX);
            const dy = Math.abs(e.clientY - pointerDownY);
            if (dx > 5 || dy > 5) return;
            clicked = true;
            this.onGateMarkerClick(gate);
        };

        // Hover effects
        button.addEventListener('mouseenter', () => {
            if (!clicked) {
                button.style.background = '#ffffff';
                button.style.color = '#050505';
            }
        });
        button.addEventListener('mouseleave', () => {
            if (!clicked) {
                button.style.background = '#f4d03f';
                button.style.color = '#050505';
            }
        });
        button.addEventListener('click', handleClick);

        document.body.appendChild(button);
        this.gateMarkerButton = button;
    }

    despawnGateMarker() {
        // Sweep every marker in the DOM by class, not just this scene's reference: an
        // orphan spawned by a dead scene has no live reference anyone can clear, which
        // is what left a stranded marker on screen after a scene change.
        document.querySelectorAll('.gate-marker-button').forEach(el => el.remove());
        this.gateMarkerButton = null;
    }

    onGateMarkerClick(gate) {
        this.despawnGateMarker();

        // Handle based on gate ref
        if (gate.ref === 'treePhoto') {
            const imagePopup = document.getElementById('image-popup');
            const popupImage = document.getElementById('popup-image');
            const closeBtn = document.getElementById('image-popup-close');
            if (imagePopup && popupImage) {
                popupImage.src = assetUrl('Photos (360)/Farm1/Close Up/farm1Closeup 1.jpg');
                imagePopup.style.display = 'flex';
                imagePopup.style.opacity = '1';
                document.body.classList.add('video-open');

                const onClose = () => {
                    imagePopup.style.opacity = '0';
                    setTimeout(() => {
                        imagePopup.style.display = 'none';
                        document.body.classList.remove('video-open');
                        this.resumeVoSequence();
                    }, 800);
                };
                closeBtn.onclick = onClose;
            } else {
                this.resumeVoSequence();
            }
        } else if (gate.ref) {
            // Special case: polybag video plays in parallel with nursery_en_02 VO
            if (gate.ref === 'polybag' && this.voSceneKey === 'nursery' && this.voSequenceIndex + 1 < window.VoSegments.nursery.en.length) {
                // Play polybag video in overlay while next VO segment plays
                const videoUrl = assetUrl('Videos/polybag.mp4');
                const polybagOverlay = document.createElement('div');
                polybagOverlay.id = 'polybag-video-overlay';
                polybagOverlay.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:1000; display:flex; align-items:center; justify-content:center; transition:opacity 0.6s ease;`;
                const video = document.createElement('video');
                video.src = videoUrl;
                video.autoplay = true;
                video.muted = true;
                video.loop = false;
                video.style.cssText = `max-width:90vw; max-height:90vh; object-fit:contain;`;
                polybagOverlay.appendChild(video);
                document.body.appendChild(polybagOverlay);
                // Mark the overlay like every other fullscreen video so the clue bar,
                // hotspot labels and nav prompt stay hidden while it plays.
                document.body.classList.add('video-open');

                // Fade video when it ends (not when VO ends), allowing VO to continue underneath
                const fadeVideoOverlay = () => {
                    if (polybagOverlay.parentNode) {
                        polybagOverlay.style.opacity = '0';
                        setTimeout(() => {
                            if (polybagOverlay.parentNode) {
                                polybagOverlay.remove();
                            }
                            document.body.classList.remove('video-open');
                        }, 600);
                    }
                };
                video.addEventListener('ended', fadeVideoOverlay, { once: true });

                // Resume sequence to play nursery_en_02 while video plays
                this.resumeVoSequence();
            } else {
                // Standard gate video playback (roasterVideo, brewingPOV, ownerInterview)
                // Fully-resolved URLs. Only the two narrated videos go through videoUrl();
                // ownerInterview/farmerInterview keep their English path.
                const videoMap = {
                    roasterVideo: videoUrl('coffeeRoasting.mp4'),
                    brewingPOV: videoUrl('brewingVideo.mp4'),
                    ownerInterview: videoUrl('ownerInterview.mp4'),
                    farmerInterview: videoUrl('farmerInterview.mp4')
                };
                    const videoSrc = videoMap[gate.ref];
                // Dialogue videos (roaster, owner, farmer, brewing) at full volume; ambience videos at 15%
                const dialogueRefs = ['roasterVideo', 'ownerInterview', 'farmerInterview', 'brewingPOV'];
                const videoVolume = dialogueRefs.includes(gate.ref) ? 1.0 : 0.15;
                if (window.DEV_MODE) console.log(`[Gate] ref=${gate.ref}, videoSrc=${videoSrc}`);
                if (videoSrc) {
                    if (window.DEV_MODE) console.log(`[Gate] Playing video: ${videoSrc}`);
                        this.showVideoPopup(videoSrc, {
                        required: true,
                        volume: videoVolume,
                        subtitleSrc: videoSubtitleUrl(gate.ref),
                        duckAmbient: ['roasterVideo', 'ownerInterview', 'farmerInterview', 'brewingPOV'].includes(gate.ref),
                        onFinish: () => this.resumeVoSequence()
                    });
                } else {
                    if (window.DEV_MODE) console.log(`[Gate] No video mapped, resuming VO immediately`);
                    this.resumeVoSequence();
                }
            }
        } else {
            this.resumeVoSequence();
        }
    }

    showMiniQuiz(gateRef, questionData) {
        if (!questionData) return;

        // Create or reuse quiz container
        let quizContainer = document.getElementById('mini-quiz-overlay');
        if (!quizContainer) {
            quizContainer = document.createElement('div');
            quizContainer.id = 'mini-quiz-overlay';
            quizContainer.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:950; display:flex; align-items:center; justify-content:center;`;
            document.body.appendChild(quizContainer);
        }

        // Clear previous content
        quizContainer.innerHTML = '';
        quizContainer.style.display = 'flex';

        // Create quiz card
        const card = document.createElement('div');
        card.style.cssText = `background:rgba(30,30,30,0.95); border:1px solid rgba(244,208,63,0.3); border-radius:12px; padding:40px; max-width:500px; width:90%; color:#f4f4f4; font-family:'Inter',sans-serif;`;

        // Question
        const question = document.createElement('div');
        question.textContent = questionData.question;
        question.style.cssText = `font-size:1.1rem; margin-bottom:25px; line-height:1.5; text-align:center;`;
        card.appendChild(question);

        // Same reassurance the scene quizzes carry. Deliberately its own element on the
        // card, never inside optionsContainer: the options are built solely from
        // questionData.a / .b and the answer is matched with option === correctAnswer,
        // so nothing added here can enter that comparison.
        const encouragement = document.createElement('div');
        encouragement.textContent = t('ui.quiz.encouragement');
        encouragement.style.cssText = `font-size:0.85rem; line-height:1.4; color:rgba(244,244,244,0.6); text-align:center; margin-bottom:20px;`;
        card.appendChild(encouragement);

        // Answer options
        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = `display:flex; flex-direction:column; gap:12px; align-items:center;`;

        const correctAnswer = questionData.correct;
        const options = [questionData.a, questionData.b].sort(() => Math.random() - 0.5); // Shuffle
        let answered = false;

        const handleAnswer = (answer, isCorrect) => {
            if (answered) return;
            answered = true;

            if (isCorrect) {
                card.style.backgroundColor = 'rgba(76,175,80,0.2)';
                const confirmMsg = document.createElement('div');
                confirmMsg.textContent = t('ui.quiz.correct');
                confirmMsg.style.cssText = `color:#4caf50; font-weight:bold; text-align:center; margin-top:20px;`;
                card.appendChild(confirmMsg);

                setTimeout(() => {
                    quizContainer.style.display = 'none';
                    this.resumeVoSequence();
                }, 1000);
            } else {
                answered = false;
                card.style.backgroundColor = 'rgba(139, 107, 107, 0.15)';
                const clueMsg = document.createElement('div');
                clueMsg.textContent = `${t('ui.miniquiz.wrongPrefix')} ${questionData.clue}`;
                clueMsg.style.cssText = `color:#a68585; margin-top:15px; font-size:0.9rem; font-style:italic; line-height:1.4;`;
                card.appendChild(clueMsg);
            }
        };

        options.forEach(option => {
            const btn = document.createElement('button');
            btn.textContent = option;
            btn.style.cssText = `padding:12px 16px; background:rgba(244,208,63,0.15); border:1px solid rgba(244,208,63,0.4); color:#f4f4f4; border-radius:6px; cursor:pointer; font-family:'Inter',sans-serif; font-size:0.95rem; transition:all 0.2s; text-align:center; width:280px;`;
            btn.addEventListener('mouseenter', () => {
                if (!btn.disabled) btn.style.background = 'rgba(244,208,63,0.3)';
            });
            btn.addEventListener('mouseleave', () => {
                if (!btn.disabled) btn.style.background = 'rgba(244,208,63,0.15)';
            });
            btn.addEventListener('click', () => {
                const isCorrect = option === correctAnswer;
                handleAnswer(option, isCorrect);
            });
            optionsContainer.appendChild(btn);
        });

        card.appendChild(optionsContainer);
        quizContainer.appendChild(card);
    }

    hideMiniQuiz() {
        const quizContainer = document.getElementById('mini-quiz-overlay');
        if (quizContainer) {
            quizContainer.style.display = 'none';
        }
    }

    // Dev VO shortcuts (only registered if DEV_MODE)
    handleVoSkip(e) {
        if (e.shiftKey && e.key === 'a') {
            if (window.DEV_MODE) console.log('[VO] Shift+A skip triggered');
            e.preventDefault();
            if (!this.voSceneKey) return; // No active sequence

            const segments = voSegmentsFor(this.voSceneKey);
            if (!segments || this.voSequenceIndex >= segments.length) return;

            const segment = segments[this.voSequenceIndex];
            const gateType = segment.gate?.type;

            // Stop current audio and clear subtitles
            this.stopVo();
            this.clearSubtitles();

            // Trigger the segment's end behavior
            if (gateType === 'marker') {
                this.resumeVoSequence();
            } else if (gateType === 'miniquiz') {
                this.resumeVoSequence();
            } else if (gateType === 'quiz') {
                // Skip quiz by marking it as passed
                this.isVoFinished = true;
                this.quizTriggered = true;
                this.onQuizPassed();
            } else {
                // 'none' or 'sting' gate - just advance
                this.voSequenceIndex++;
                this.playVoSequence(this.voSceneKey);
            }
        }
    }

    handleVoReplay(e) {
        if (e.shiftKey && e.key === 's') {
            if (window.DEV_MODE) console.log('[VO] Shift+S replay triggered');
            e.preventDefault();
            if (!this.voSceneKey) return; // No active sequence

            const segments = voSegmentsFor(this.voSceneKey);
            if (!segments || this.voSequenceIndex >= segments.length) return;

            // Stop current audio and clear subtitles
            this.stopVo();
            this.clearSubtitles();

            // Replay current segment
            const segment = segments[this.voSequenceIndex];
            this.playVoWithSubtitles(segment.id, segment.gate?.type === 'quiz').catch(() => {});
        }
    }

    handleVoResume(e) {
        if (e.shiftKey && e.key === 'd') {
            if (window.DEV_MODE) console.log('[VO] Shift+D resume triggered');
            e.preventDefault();
            if (!this.voSceneKey) return; // No active sequence

            // Resume past the current gate (equivalent to clicking the gate button)
            this.resumeVoSequence();
        }
    }

    update(deltaTime) {
        // Base scene update (subclasses override this)
    }
}

// The completion panel is the last thing a run shows, and cafeInterior already awaits
// growCoffeeTree (the cup, then the summary) immediately before calling it. Wrapping
// the method rather than that one call site keeps the whole end-of-run order in one
// place: cup -> summary -> score -> completion panel.
(function wrapCompletionPanelWithScore() {
    const original = Scene.prototype.showCompletionPanel;
    Scene.prototype.showCompletionPanel = async function (...args) {
        await showScoreEndScreen();
        return original.apply(this, args);
    };
})();

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
    updateJourneyBar();
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
    scenePresets: {
        nursery: {
            exposure: 1.55,
            brightness: 0.95,
            contrast: 1.1,
            saturation: 1.7,
            ambient: 1.15,
            gamma: 'SRGB',
            tonemapping: 'ACES'
        }
    },
    values: {},

    applyPreset(sceneName) {
        const preset = this.scenePresets[sceneName];
        if (preset) {
            this.values = { ...preset };
            this.applyAll();
        }
    },

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
// OVERLAY MANAGEMENT
// ============================================================================

function dismissAllOverlays() {
    const overlays = [
        'landing-wrapper',
        'context-screen',
        'brand-story-screen',
        'quiz-overlay'
    ];

    overlays.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
        }
    });
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
        const spawnPos = btn.dataset.position || 'spawn';

        // Dismiss all overlays and show canvas
        dismissAllOverlays();
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
            loadingScreen.style.opacity = '1';
            loadingScreen.style.pointerEvents = 'auto';
        }
        const canvas = document.getElementById('canvas');
        if (canvas) canvas.style.display = 'block';

        // Set properties before switching
        const scene = sceneManager.scenes[sceneName];
        if (scene) {
            scene.quizPassed = true;
            if (isReturnVisit) scene.isReturnVisit = true;
            else if (scene.isReturnVisit !== undefined) scene.isReturnVisit = false;
        }

        // Switch with spawn position
        const spawnMap = {
            'street-view': 'toFarm1',
            'cafe-interior': 'spawn',
            'cafe-exterior': 'spawn',
            'nursery': 'spawn',
            'roastery': 'spawn',
            'video': 'spawn'
        };
        const finalPos = spawnPos !== 'spawn' ? spawnPos : spawnMap[sceneName];

        try {
            await sceneManager.switchTo(sceneName, finalPos);
            if (window.DEV_MODE) console.log(`[DEV] Jumped to ${sceneName} at ${finalPos}`);
        } catch (e) {
            console.error(`[DEV] Failed to switch to ${sceneName}:`, e);
        }
        this.closeMenu();
    },

    attachPositionHandler() {
        const btn = document.getElementById('dev-go-position');
        if (!btn) return;
        btn.addEventListener('click', () => this.jumpToPosition());
    },

    async jumpToPosition() {
        const select = document.getElementById('dev-position-select');
        const key = select?.value;
        if (!key || key === '—') return;
        const streetScene = sceneManager.scenes['street-view'];
        if (!streetScene) {
            console.error('[DEV] Street view scene not found');
            return;
        }

        // Dismiss all overlays and show canvas
        dismissAllOverlays();
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
            loadingScreen.style.opacity = '1';
            loadingScreen.style.pointerEvents = 'auto';
        }
        const canvas = document.getElementById('canvas');
        if (canvas) canvas.style.display = 'block';

        if (appState.currentSceneName !== 'street-view') {
            streetScene.quizPassed = true;
            try {
                await sceneManager.switchTo('street-view', 'toFarm1');
                await streetScene.transitionToPosition(key);
                if (window.DEV_MODE) console.log(`[DEV] Jumped to position ${key}`);
            } catch (e) {
                console.error(`[DEV] Failed to jump to position ${key}:`, e);
            }
        } else {
            try {
                await streetScene.transitionToPosition(key);
                if (window.DEV_MODE) console.log(`[DEV] Jumped to position ${key}`);
            } catch (e) {
                console.error(`[DEV] Failed to transition to ${key}:`, e);
            }
        }
        this.closeMenu();
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
        if (window.DEV_MODE) console.log(message);
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
    if (window.DEV_MODE) console.log('Debug mode:', config.debugMode);
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

        // Push initial History state for the experience
        history.pushState({view:'experience', scene:'cafe-interior'}, '', '#experience');

        hideLoadingScreen();

        const activeScene = sceneManager.getActiveScene();
        if (activeScene && activeScene.onLoadingScreenDismissed) {
            activeScene.onLoadingScreenDismissed();
        }

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

// Handle browser back button for History API
window.addEventListener('popstate', async (e) => {
    const state = e.state;
    if (state?.view === 'experience' && state?.scene) {
        // Navigate to the scene from history
        isSceneChangeFromPopstate = true;

        // Stop rogue videos
        const video = document.getElementById('popup-video');
        if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
        document.body.classList.remove('video-open', 'ui-overlay-active');

        const canvas = document.getElementById('canvas');
        if (canvas) canvas.style.display = 'block';
        const fadeOverlay = document.getElementById('fade-overlay');
        if (fadeOverlay) fadeOverlay.classList.remove('active');

        app.resume?.(); // Force render loop to restart
        await sceneManager.switchTo(state.scene);
    } else {
        // Back button went past the experience entry — return to landing page
        const wrapper = document.getElementById('landing-wrapper');
        if (wrapper) {
            wrapper.style.display = 'block';
            wrapper.style.opacity = '1';
        }
        document.body.style.overflow = '';

        const canvas = document.getElementById('canvas');
        if (canvas) canvas.style.display = 'none';
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
        const fadeOverlay = document.getElementById('fade-overlay');
        if (fadeOverlay) fadeOverlay.classList.remove('active');
        const videoPopup = document.getElementById('video-popup');
        if (videoPopup) videoPopup.classList.remove('active');
        const hotspotPopup = document.getElementById('hotspot-popup');
        if (hotspotPopup) hotspotPopup.classList.remove('active');
        const quizOverlay = document.getElementById('quiz-overlay');
        if (quizOverlay) quizOverlay.style.display = 'none';
        const completionPanel = document.getElementById('completion-panel');
        if (completionPanel) completionPanel.style.display = 'none';
        const travelMenu = document.getElementById('travel-menu');
        if (travelMenu) travelMenu.style.display = 'none';
        const navPrompt = document.getElementById('nav-prompt');
        if (navPrompt) navPrompt.style.display = 'none';
        app.pause?.();
        window.journeyComplete = false;
        hasStarted = false;
    }
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
