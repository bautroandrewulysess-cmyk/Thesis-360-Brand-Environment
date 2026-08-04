// ============================================================================
// STREET VIEW SCENE
// ============================================================================
// 360-degree equirectangular photo sphere viewer with interactive navigation.
// Displays a graph of 31 linked positions across the cafe-to-farm path,
// with arrow-based navigation, fade transitions, and preloading.
//
// Dependencies (from main.js global scope):
// - app (PlayCanvas Application)
// - cameraEntity (camera entity)
// - sceneManager (scene manager)
// - Scene (base scene class)
// - fadeOut(), fadeIn() (fade transition functions)

class StreetViewScene extends Scene {
    constructor() {
        super('street-view');
        this.currentPosition = 'toFarm1';
        this.isLoaded = false;
        this.photoSphere = null;
        this.nadirPatch = null;
        this.nadirPatchTexture = null;
        this.arrowEntities = [];
        this.arrowLabels = [];

        // Camera control
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mouseDragDistance = 0;
        this.mouseDownX = 0;
        this.mouseDownY = 0;
        this.mouseSensitivity = 0.005;
        this.eulerAngles = { yaw: 0, pitch: 0 };
        this.pitchMin = -Math.PI / 2.5;
        this.pitchMax = Math.PI / 2.5;

        // Texture management
        this.currentPhotoAsset = null;
        this.preloadedAssets = {};
        this.preloadedAssetKeys = [];

        // Audio
        this.audioContext = null;
        this.ambientSource = null;
        this.ambientGain = null;
        this.audioLoaded = false;

        // DOM
        this.dom = {};
        this.coordUpdateTimer = 0;
        this.coordUpdateInterval = 0.1; // Update coordinate display ~10x/sec instead of every frame

        this.arrowPulsePhase = 0;
        this.farmVoStarted = false;
        this.quizPassed = false;
        this.highlightFarm1_5Forward = false;
        this.toFarm14FirstArrival = true;
        this.isInputLocked = false;
        this.quiz = {
            question: 'Why is organic fertilizer added before planting a coffee seedling?',
            choices: ['To make the soil richer and help the roots grow well.', 'To make harvesting easier.', 'To speed up roasting.', 'To change the flavor of the coffee immediately.'],
            correct: 0,
            clue: 'Think about what the fertilizer touches first — it goes into the hole, before the tree ever grows.',
            feedback: 'Correct! Healthy coffee trees begin with healthy soil. Preparing the planting hole with organic fertilizer gives young trees the best possible start.'
        };

        // Position graph: 31 total positions
        this.positions = {
            // === Cafe → Farm main walk (14 positions) ===
            'toFarm1': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm1.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -36.4, pitch: -8.9, target: 'toFarm2' },
                    { label: 'Back to Cafe', yaw: -176.2, pitch: -17.5, targetScene: 'cafe-exterior', spawnPosition: [-2.094, 1.6, -0.948] }
                ]
            },
            'toFarm2': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm2.jpg'),
                arrows: [
                    { label: 'Continue', yaw: 174.1, pitch: -6.9, target: 'toFarm3' },
                    { label: 'Go Back', yaw: -9.7, pitch: -13.2, target: 'toFarm1' }
                ]
            },
            'toFarm3': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm3.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -175.6, pitch: -7.4, target: 'toFarm4' },
                    { label: 'Go Back', yaw: -3.7, pitch: -17.8, target: 'toFarm2' }
                ]
            },
            'toFarm4': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm4.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -171.4, pitch: -11.5, target: 'toFarm5' },
                    { label: 'Go Back', yaw: 14.5, pitch: -20.1, target: 'toFarm3' }
                ]
            },
            'toFarm5': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm5.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -171.4, pitch: -6, target: 'toFarm6' },
                    { label: 'Go Back', yaw: 19.4, pitch: -22.3, target: 'toFarm4' }
                ]
            },
            'toFarm6': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm6.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -158.5, pitch: -3.7, target: 'toFarm7' },
                    { label: 'Go Back', yaw: 15.4, pitch: -22.2, target: 'toFarm5' }
                ]
            },
            'toFarm7': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm7.jpg'),
                arrows: [
                    { label: 'Continue', yaw: 160.8, pitch: -18.7, target: 'toFarm8' },
                    { label: 'Go Back', yaw: -11.8, pitch: -25.3, target: 'toFarm6' }
                ]
            },
            'toFarm8': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm8.jpg'),
                arrows: [
                    { label: 'Continue', yaw: 159.1, pitch: -27.6, target: 'toFarm9' },
                    { label: 'Go Back', yaw: -25, pitch: -17.6, target: 'toFarm7' }
                ]
            },
            'toFarm9': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm9.jpg'),
                arrows: [
                    { label: 'Continue', yaw: 154.5, pitch: -26.4, target: 'toFarm10' },
                    { label: 'Go Back', yaw: -24.5, pitch: -17.6, target: 'toFarm8' }
                ]
            },
            'toFarm10': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm10.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -170.3, pitch: -23.3, target: 'toFarm11' },
                    { label: 'Go Back', yaw: -36.2, pitch: -20.7, target: 'toFarm9' }
                ]
            },
            'toFarm11': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm11.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -177.1, pitch: -19.3, target: 'toFarm12' },
                    { label: 'Go Back', yaw: 8.2, pitch: -13.3, target: 'toFarm10' }
                ]
            },
            'toFarm12': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm12.jpg'),
                arrows: [
                    { label: 'Continue', yaw: 177.4, pitch: -18.4, target: 'toFarm13' },
                    { label: 'Go Back', yaw: 6.8, pitch: -24.2, target: 'toFarm11' }
                ]
            },
            'toFarm13': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm13.jpg'),
                arrows: [
                    { label: 'Continue', yaw: 161.9, pitch: -17.9, target: 'toFarm14' },
                    { label: 'Go Back', yaw: -9.8, pitch: -25.6, target: 'toFarm12' }
                ]
            },
            'toFarm14': {
                photo: assetUrl('Photos (360)/aGoing Main/toFarm14.jpg'),
                arrows: [
                    { label: 'Go Back', yaw: 22.2, pitch: -23, target: 'toFarm13' },
                    { label: 'View Farm', yaw: 171.1, pitch: -17.6, target: 'farm1-1' },
                    { label: 'To Dryer', yaw: 90, target: 'toDryer1' }
                ]
            },

            // === Farm viewing spots (5 positions) ===
            'farm1-1': {
                photo: assetUrl('Photos (360)/Farm1/farm1 1.jpg'),
                arrows: [
                    { label: 'Next View', yaw: 171.5, pitch: -23, target: 'farm1-2' },
                    { label: 'Back', yaw: 16, pitch: -31.6, target: 'toFarm14' }
                ]
            },
            'farm1-2': {
                photo: assetUrl('Photos (360)/Farm1/farm1 2.jpg'),
                arrows: [
                    { label: 'Next View', yaw: 151.7, pitch: -25.3, target: 'farm1-3' },
                    { label: 'Back', yaw: 6.3, pitch: -33.3, target: 'farm1-1' }
                ]
            },
            'farm1-3': {
                photo: assetUrl('Photos (360)/Farm1/farm1 3.jpg'),
                arrows: [
                    { label: 'Next View', yaw: -179, pitch: -22.7, target: 'farm1-4' },
                    { label: 'Back', yaw: -42.1, pitch: -36.8, target: 'farm1-2' }
                ]
            },
            'farm1-4': {
                photo: assetUrl('Photos (360)/Farm1/farm1 4.jpg'),
                arrows: [
                    { label: 'Next View', yaw: 13.9, pitch: -16.7, target: 'farm1-5' },
                    { label: 'Back', yaw: -146.1, pitch: -40.2, target: 'farm1-3' }
                ]
            },
            'farm1-5': {
                photo: assetUrl('Photos (360)/Farm1/farm1 5.jpg'),
                arrows: [
                    { label: 'To the Harvest', yaw: 0, targetScene: 'harvesting', spawnPosition: [0, 1.6, 0], isHarvestMarker: true }
                ]
            },

            // === Farm → Dryer walk (6 positions) ===
            'toDryer1': {
                photo: assetUrl('Photos (360)/aTo Dryer/toDryer1.jpg'),
                arrows: [
                    { label: 'Continue', yaw: 179.8, pitch: -23.2, target: 'toDryer2' },
                    { label: 'Go Back', yaw: -32.9, pitch: -28.9, target: 'toFarm14' }
                ]
            },
            'toDryer2': {
                photo: assetUrl('Photos (360)/aTo Dryer/toDryer2.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -177.9, pitch: -20.3, target: 'toDryer3' },
                    { label: 'Go Back', yaw: 5.2, pitch: -28.9, target: 'toDryer1' }
                ]
            },
            'toDryer3': {
                photo: assetUrl('Photos (360)/aTo Dryer/toDryer3.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -128.6, pitch: -22.9, target: 'toDryer4' },
                    { label: 'Go Back', yaw: 39.2, pitch: -30.4, target: 'toDryer2' }
                ]
            },
            'toDryer4': {
                photo: assetUrl('Photos (360)/aTo Dryer/toDryer4.jpg'),
                arrows: [
                    { label: 'Continue', yaw: -164.7, pitch: -19.5, target: 'toDryer5' },
                    { label: 'Go Back', yaw: -6.9, pitch: -27.8, target: 'toDryer3' }
                ]
            },
            'toDryer5': {
                photo: assetUrl('Photos (360)/aTo Dryer/toDryer5.jpg'),
                arrows: [
                    { label: 'Continue', yaw: 179.8, pitch: -18, target: 'toDryer6' },
                    { label: 'Go Back', yaw: 14.9, pitch: -25.5, target: 'toDryer4' }
                ]
            },
            'toDryer6': {
                photo: assetUrl('Photos (360)/aTo Dryer/toDryer6.jpg'),
                arrows: [
                    { label: 'See the Dryer', yaw: 172.7, pitch: -16.9, target: 'dryer1' },
                    { label: 'Other Farm Side', yaw: 135.5, pitch: -7.7, target: 'farm2-1' },
                    { label: 'Go Back', yaw: 2, pitch: -21.2, target: 'toDryer5' }
                ]
            },

            // === Dryer area (4 positions) ===
            'dryer1': {
                photo: assetUrl('Photos (360)/Dryer/dryer1.jpg'),
                arrows: [
                    { label: 'Next', yaw: -165.9, pitch: -17.2, target: 'dryer2' },
                    { label: 'Back', yaw: 8, pitch: -18.3, target: 'toDryer6' }
                ]
            },
            'dryer2': {
                photo: assetUrl('Photos (360)/Dryer/dryer2.jpg'),
                arrows: [
                    { label: 'Next', yaw: 0, target: 'dryer3' },
                    { label: 'Back', yaw: 180, target: 'dryer1' }
                ]
            },
            'dryer3': {
                photo: assetUrl('Photos (360)/Dryer/dryer3.jpg'),
                arrows: [
                    { label: 'Next', yaw: 117, pitch: -25.8, target: 'dryer4' },
                    { label: 'Back', yaw: -136.5, pitch: -14.3, target: 'dryer2' }
                ]
            },
            'dryer4': {
                photo: assetUrl('Photos (360)/Dryer/dryer4.jpg'),
                arrows: [
                    { label: 'Back', yaw: 139.6, pitch: -11.2, target: 'toDryer6' }
                ]
            },

            // === Farm2 side (2 positions) ===
            'farm2-1': {
                photo: assetUrl('Photos (360)/Farm2/farm2 1.jpg'),
                arrows: [
                    { label: 'Next View', yaw: 0, target: 'farm2-2' },
                    { label: 'Back', yaw: 180, target: 'toDryer6' }
                ]
            },
            'farm2-2': {
                photo: assetUrl('Photos (360)/Farm2/farm2 2.jpg'),
                arrows: [
                    { label: 'Back', yaw: 180, target: 'farm2-1' }
                ]
            }
        };

        this.setupEventListeners();
    }

    getNavPromptText() {
        return 'Follow the glowing marker along the path';
    }

    highlightTransitionHotspot() {
        // Override: streetView uses arrows instead of hotspots; mark farm1-5 forward arrow for highlighting
        this.highlightFarm1_5Forward = true;
        if (this.currentPosition === 'farm1-5') {
            this.createArrows(); // Recreate arrows with highlighting
        }
    }

    setupEventListeners() {
        this.onMouseDown = (e) => this.handleMouseDown(e);
        this.onMouseMove = (e) => this.handleMouseMove(e);
        this.onMouseUp = (e) => this.handleMouseUp(e);
        this.onKeyAim = (e) => this.handleKeyAim(e);
    }

    attachEventListeners() {
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('keydown', this.onKeyAim);
    }

    detachEventListeners() {
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('keydown', this.onKeyAim);
    }

    handleMouseDown(event) {
        if (event.target.closest('#box-editor') ||
            event.target.closest('#quiz-overlay') ||
            event.target.closest('#hotspot-popup') ||
            event.target.closest('#video-popup')) {
            return;
        }

        if (event.button === 0) {
            this.isMouseDown = true;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            this.mouseDownX = event.clientX;
            this.mouseDownY = event.clientY;
            this.mouseDragDistance = 0;
        }
    }

    handleMouseMove(event) {
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;

        if (this.isMouseDown && !this.isInputLocked) {
            const dx = event.clientX - this.mouseDownX;
            const dy = event.clientY - this.mouseDownY;
            this.mouseDragDistance = Math.sqrt(dx * dx + dy * dy);

            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;

            this.eulerAngles.yaw -= deltaX * this.mouseSensitivity;
            this.eulerAngles.pitch -= deltaY * this.mouseSensitivity;

            this.eulerAngles.pitch = Math.max(this.pitchMin, Math.min(this.pitchMax, this.eulerAngles.pitch));

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
        }
    }

    handleMouseUp(event) {
        if (event.button === 0) {
            this.isMouseDown = false;
            this.mouseDragDistance = 0; // Always reset on mouseup
        }
    }

    handleKeyAim(event) {
        if (!window.DEV_MODE) return;
        if (!this.isLoaded) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        // Shift+E: session export
        if (event.shiftKey && (event.key === 'e' || event.key === 'E')) {
            const positionKeys = Object.keys(this.positions);
            const jsCode = `{\n` +
                positionKeys.map(posKey => {
                    const pos = this.positions[posKey];
                    return `    '${posKey}': {\n        photo: '${pos.photo}',\n        arrows: [\n` +
                        pos.arrows.map((a) =>
                            `            { label: '${a.label}', yaw: ${a.yaw}, pitch: ${a.pitch}${a.target ? `, target: '${a.target}'` : ''}${a.targetScene ? `, targetScene: '${a.targetScene}'` : ''}${a.spawnPosition ? `, spawnPosition: [${a.spawnPosition.join(', ')}]` : ''} }`
                        ).join(',\n') +
                        `\n        ]\n    }`;
                }).join(',\n') +
                `\n}`;
            console.log(`[aim-export] Exported ${positionKeys.length} positions:\n${jsCode}`);
            navigator.clipboard.writeText(jsCode);
            return;
        }

        const posData = this.positions[this.currentPosition];
        if (!posData || !posData.arrows) return;

        // Capture current camera yaw/pitch
        let yaw = this.eulerAngles.yaw * 180 / Math.PI;
        let pitch = this.eulerAngles.pitch * 180 / Math.PI;
        while (yaw > 180) yaw -= 360;
        while (yaw < -180) yaw += 360;
        pitch = Math.max(-90, Math.min(90, pitch));
        yaw = Math.round(yaw * 10) / 10;
        pitch = Math.round(pitch * 10) / 10;

        // Y: target first forward arrow
        if (event.key === 'y' || event.key === 'Y') {
            const arrowIdx = posData.arrows.findIndex(a => !a.label.includes('Back'));
            if (arrowIdx < 0) {
                console.log(`[aim] ${this.currentPosition}: no forward arrow`);
                return;
            }
            const arrow = posData.arrows[arrowIdx];
            arrow.yaw = yaw;
            arrow.pitch = pitch;
            console.log(`[aim] ${this.currentPosition} forward "${arrow.label}" → yaw ${arrow.yaw}°, pitch ${arrow.pitch}°`);
            this.createArrows();
            if (window.updateDiscValues) window.updateDiscValues(this.currentPosition, posData.arrows);
            return;
        }

        // I: target second forward arrow
        if (event.key === 'i' || event.key === 'I') {
            const forwardArrows = posData.arrows.filter(a => !a.label.includes('Back'));
            if (forwardArrows.length < 2) {
                console.log(`[aim] ${this.currentPosition}: no second forward arrow`);
                return;
            }
            const arrow = forwardArrows[1];
            arrow.yaw = yaw;
            arrow.pitch = pitch;
            console.log(`[aim] ${this.currentPosition} forward "${arrow.label}" → yaw ${arrow.yaw}°, pitch ${arrow.pitch}°`);
            this.createArrows();
            if (window.updateDiscValues) window.updateDiscValues(this.currentPosition, posData.arrows);
            return;
        }

        // U: target first back arrow
        if (event.key === 'u' || event.key === 'U') {
            const arrowIdx = posData.arrows.findIndex(a => a.label.includes('Back'));
            if (arrowIdx < 0) {
                console.log(`[aim] ${this.currentPosition}: no back arrow`);
                return;
            }
            const arrow = posData.arrows[arrowIdx];
            arrow.yaw = yaw;
            arrow.pitch = pitch;
            console.log(`[aim] ${this.currentPosition} back "${arrow.label}" → yaw ${arrow.yaw}°, pitch ${arrow.pitch}°`);
            this.createArrows();
            if (window.updateDiscValues) window.updateDiscValues(this.currentPosition, posData.arrows);
            return;
        }
    }

    createPhotoSphere() {
        const sphereSize = 50;
        const sphere = new pc.Entity('photo-sphere');

        // Get UI layer for proper rendering
        const layer = app.scene.layers.getLayerByName('Immediate') || app.scene.layers.getLayerByName('UI');

        // Add render component with sphere type
        sphere.addComponent('render', {
            type: 'sphere',
            layers: layer ? [layer.id] : undefined
        });
        // Negative X scale mirrors the sphere horizontally to un-flip equirect image
        sphere.setLocalScale(-sphereSize, sphereSize, sphereSize);

        // Start with placeholder material (will be replaced by loadPosition)
        const mat = new pc.StandardMaterial();
        mat.cull = pc.CULLFACE_NONE; // Render both sides to work with negative X scale
        mat.diffuse = new pc.Color(0.1, 0.1, 0.1);
        mat.emissive = new pc.Color(0.2, 0.2, 0.2);
        mat.update();

        sphere.render.meshInstances[0].material = mat;
        this.container.addChild(sphere);
        this.photoSphere = sphere;
        if (window.DEV_MODE) console.log('Photo sphere created with placeholder material (mirrored X scale, CULLFACE_NONE)');
    }

    createNadirTextureCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1024, 1024);

        ctx.save();
        ctx.scale(-1, -1);
        ctx.translate(-1024, -1024);

        const text = 'GRANJA ALEGRE';
        const fontSize = 60;
        const letterSpacing = 15;
        ctx.font = `bold ${fontSize}px "Times New Roman"`;
        ctx.fillStyle = '#3a3a3a';
        ctx.textBaseline = 'middle';

        let totalWidth = 0;
        for (let i = 0; i < text.length; i++) {
            const charWidth = ctx.measureText(text[i]).width;
            totalWidth += charWidth + (i < text.length - 1 ? letterSpacing : 0);
        }

        let x = (1024 - totalWidth) / 2;
        const y = 512;

        for (let i = 0; i < text.length; i++) {
            ctx.fillText(text[i], x, y);
            x += ctx.measureText(text[i]).width + letterSpacing;
        }

        ctx.restore();
        return canvas;
    }

    createNadirPatch() {
        // White disc at bottom to cover camera operator
        const disc = new pc.Entity('nadir-patch');

        // Get UI layer for proper rendering
        const layer = app.scene.layers.getLayerByName('Immediate') || app.scene.layers.getLayerByName('UI');

        // Add render component with cylinder type
        disc.addComponent('render', {
            type: 'cylinder',
            layers: layer ? [layer.id] : undefined
        });
        disc.setLocalPosition(0, -12, 0);
        disc.setLocalScale(10, 0.1, 10);

        const canvas = this.createNadirTextureCanvas();
        const texture = new pc.Texture(app.graphicsDevice, {
            width: 1024,
            height: 1024,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            mipmaps: false
        });
        texture.setSource(canvas);

        this.nadirPatchTexture = texture;

        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(1, 1, 1);
        mat.emissive = new pc.Color(1, 1, 1);
        mat.diffuseMap = texture;
        mat.emissiveMap = texture;
        mat.update();

        disc.render.meshInstances[0].material = mat;
        this.container.addChild(disc);
        this.nadirPatch = disc;
    }

    createArrows() {
        // Clear previous arrows — MUST unregister from raycast system first
        this.arrowEntities.forEach(arrow => {
            this.unregisterInteractiveObject(arrow);
            arrow.destroy();
        });
        this.arrowEntities = [];
        this.arrowLabels.forEach(label => label.remove());
        this.arrowLabels = [];

        const posData = this.positions[this.currentPosition];
        if (!posData || !posData.arrows) {
            if (window.DEV_MODE) console.log(`[createArrows] No arrows for ${this.currentPosition}`);
            return;
        }

        if (window.DEV_MODE) console.log(`[createArrows] Creating ${posData.arrows.length} arrows for ${this.currentPosition}`);

        posData.arrows.forEach((arrow, index) => {
            if (arrow.label === 'To Dryer' && !window.journeyComplete) return;
            if (this.currentPosition === 'farm1-1' && arrow.target === 'toFarm14' && this.farmVoStarted && !window.journeyComplete) return;
            // Parse yaw and pitch (default pitch -18° if not specified)
            const yawDeg = arrow.yaw;
            const pitchDeg = arrow.pitch !== undefined ? arrow.pitch : -18;
            const yawRad = yawDeg * Math.PI / 180;
            const pitchRad = pitchDeg * Math.PI / 180;
            const distance = 12;

            // Calculate position along view ray (camera forward: -sin(yaw)·cos(pitch), sin(pitch), -cos(yaw)·cos(pitch))
            const arrowPos = new pc.Vec3(
                -Math.sin(yawRad) * Math.cos(pitchRad) * distance,
                Math.sin(pitchRad) * distance,
                -Math.cos(yawRad) * Math.cos(pitchRad) * distance
            );

            if (window.DEV_MODE) console.log(`[createArrows] Arrow ${index} "${arrow.label}": world pos ${arrowPos.toString()}`);

            // Create disc marker (flattened cylinder)
            const arrowEntity = new pc.Entity(`arrow-${index}`);

            // Get UI layer for proper rendering
            const layer = app.scene.layers.getLayerByName('Immediate') || app.scene.layers.getLayerByName('UI');

            arrowEntity.addComponent('render', {
                type: 'cylinder',
                layers: layer ? [layer.id] : undefined
            });

            // Flat disc: cylinder already has its flat face pointing up (Y axis)
            // No rotation needed, just position and scale
            arrowEntity.setLocalPosition(arrowPos.x, arrowPos.y, arrowPos.z);
            arrowEntity.setLocalEulerAngles(0, 0, 0); // Flat orientation
            arrowEntity.setLocalScale(1.5, 0.08, 1.5); // Increased visibility

            // Material: cyan for forward, white for back arrows; gold for highlighted farm1-5 forward
            const isBackArrow = arrow.label === 'Back' || arrow.label === 'Go Back' || arrow.label.includes('Back');
            const isHarvestMarker = arrow.isHarvestMarker;
            const isFarm1_5ForwardArrow = this.currentPosition === 'farm1-5' && !isBackArrow && this.highlightFarm1_5Forward;

            // Larger scale for harvest marker
            if (isHarvestMarker) {
                arrowEntity.setLocalScale(2.5, 0.12, 2.5);
            }

            const mat = new pc.StandardMaterial();
            mat.cull = pc.CULLFACE_NONE;
            mat.opacity = isHarvestMarker ? 1 : 0.9;
            mat.blendType = pc.BLEND_NORMAL;
            mat.depthWrite = false;
            mat.emissive = isHarvestMarker ? new pc.Color(1, 0.85, 0.2) : new pc.Color(0, 0, 0);
            mat.emissiveIntensity = isHarvestMarker ? 0.6 : 0;

            if (isHarvestMarker) {
                mat.diffuse = new pc.Color(1, 0.85, 0.2);
            } else if (isFarm1_5ForwardArrow) {
                mat.diffuse = new pc.Color(1, 0.85, 0.2);
            } else if (isBackArrow) {
                mat.diffuse = new pc.Color(1, 1, 1);
            } else {
                mat.diffuse = new pc.Color(0.15, 0.45, 1);
            }

            mat.update();

            arrowEntity.render.meshInstances[0].material = mat;
            arrowEntity.arrowData = arrow;
            arrowEntity.arrowIndex = index;

            // Add pulsing animation for harvest marker
            if (isHarvestMarker) {
                const pulseScale = 1.2;
                const pulseDuration = 1.2;
                let scaleTime = 0;
                arrowEntity.update = (dt) => {
                    scaleTime = (scaleTime + dt) % pulseDuration;
                    const pulse = 1 + (Math.sin(scaleTime / pulseDuration * Math.PI * 2) * 0.3);
                    arrowEntity.setLocalScale(2.5 * pulse, 0.12, 2.5 * pulse);
                };
            }

            this.container.addChild(arrowEntity);
            this.arrowEntities.push(arrowEntity);

            // Log properties after creation
            if (window.DEV_MODE) console.log(`[createArrows]   Arrow ${index}: enabled=${arrowEntity.enabled}, parent=${!!arrowEntity.parent}, has render=${!!arrowEntity.render}`);

            // Register for clicking
            this.registerInteractiveObject(arrowEntity, () => {
                this.onArrowClick(arrow);
            }, 1.5);
        });

        if (window.DEV_MODE) console.log(`[createArrows] ✓ ${this.arrowEntities.length} arrows created`);
    }

    loadTexture(url) {
        return new Promise((resolve, reject) => {
            const asset = new pc.Asset(`texture-${Date.now()}`, 'texture', { url: url });

            const onLoad = () => {
                asset.off('load', onLoad);
                asset.off('error', onError);
                clearTimeout(timeout);

                if (!asset.resource) {
                    reject(new Error(`Texture resource not available: ${url}`));
                    return;
                }

                resolve(asset);
            };

            const onError = (err) => {
                asset.off('load', onLoad);
                asset.off('error', onError);
                clearTimeout(timeout);
                reject(new Error(`Texture load failed: ${url}`));
            };

            const timeout = setTimeout(() => {
                asset.off('load', onLoad);
                asset.off('error', onError);
                reject(new Error(`Texture load timeout: ${url}`));
            }, 15000);

            asset.on('load', onLoad);
            asset.on('error', onError);
            app.assets.add(asset);
            app.assets.load(asset);
        });
    }

    async onArrowClick(arrow) {
        if (this.mouseDragDistance > 5 || this.isInputLocked) {
            return;
        }

        const isBackArrow = arrow.label === 'Back' || arrow.label === 'Go Back' || arrow.label.includes('Back');

        if (this.currentPosition.startsWith('farm1-') && arrow.targetScene === 'harvesting' && !window.journeyComplete) {
            if (!this.isVoFinished || !this.quizPassed) {
                this.showVoWarning('Please wait for the narration and complete the quiz.');
                return;
            }
        }

        if (isBackArrow && arrow.targetScene === 'cafe-exterior' && !window.journeyComplete) {
            this.showVoWarning('Finish the journey to explore freely.');
            return;
        }

        if (arrow.targetScene) {
            await sceneManager.switchTo(arrow.targetScene, arrow.spawnPosition || null);
        } else if (arrow.target) {
            if (window.DEV_MODE) console.log(`[navigation] ${this.currentPosition} → ${arrow.target}`);
            await this.transitionToPosition(arrow.target);
        }
    }

    async checkFarmerInterviewAtToFarm14() {
        console.warn('[FarmerInterview] checkFarmerInterviewAtToFarm14 entered');
        console.warn('[FarmerInterview] currentPosition:', this.currentPosition, 'toFarm14FirstArrival:', this.toFarm14FirstArrival);
        if (this.currentPosition === 'toFarm14' && this.toFarm14FirstArrival) {
            this.toFarm14FirstArrival = false;
            const required = !window.journeyComplete;
            console.warn('[FarmerInterview] showVideoPopup called, required:', required);
            const videoSrc = `${R2_BASE}/farmerInterview.mp4`;
            console.warn('[FarmerInterview] video src:', videoSrc);
            if (required) {
                this.isInputLocked = true;
                for (let arrow of this.arrowEntities) arrow.enabled = false;
            }
            const video = this.showVideoPopup(videoSrc, {
                required,
                caption: 'Meet the farmer',
                onFinish: () => {
                    console.warn('[FarmerInterview] onFinish callback fired');
                    this.isInputLocked = false;
                    for (let arrow of this.arrowEntities) arrow.enabled = true;
                    if (required) this.createArrows();
                }
            });
            if (video) {
                const checkReadyState = () => {
                    console.warn('[FarmerInterview] readyState:', video.readyState, 'duration:', video.duration, 'src:', video.src);
                    if (video.readyState < 4) {
                        setTimeout(checkReadyState, 5000);
                    }
                };
                video.addEventListener('canplay', () => {
                    console.warn('[FarmerInterview] canplay event fired');
                }, { once: true });
                video.addEventListener('error', (e) => {
                    console.warn('[FarmerInterview] error event fired:', e);
                }, { once: true });
                setTimeout(checkReadyState, 5000);
            }
        } else {
            console.warn('[FarmerInterview] Check skipped - not at toFarm14 or not first arrival');
        }
    }

    updateAmbientVolumeForPosition(positionKey) {
        if (!this.ambientGain) return;
        const targetGain = positionKey.startsWith('toFarm') ? 0.8 : positionKey.startsWith('farm1') ? 0.5 : 0.5;
        this.ambientGain.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.3);
    }

    async transitionToPosition(positionKey) {
        if (!this.positions[positionKey]) {
            console.error(`Position not found: ${positionKey}`);
            return;
        }

        try {
            await fadeOut();
            this.currentPosition = positionKey;
            this.updateAmbientVolumeForPosition(positionKey);
            await this.loadPosition(positionKey);
            this.createArrows();

            // Face the way forward: set camera yaw to match first forward arrow
            const posData = this.positions[positionKey];
            if (posData?.arrows && posData.arrows.length > 0) {
                const forwardArrow = posData.arrows.find(arr => !arr.label.includes('Back') && arr.label !== 'Go Back');
                if (forwardArrow) {
                    const currentEulers = cameraEntity.getLocalEulerAngles();
                    cameraEntity.setLocalEulerAngles(currentEulers.x, forwardArrow.yaw, 0);
                    this.eulerAngles.yaw = forwardArrow.yaw;
                }
            }

            try {
                if (window.updateDiscValues) window.updateDiscValues(positionKey, this.positions[positionKey].arrows);
            } catch (e) {
                console.error('[DiscValues] Error updating disc values:', e);
            }
            this.checkFarmerInterviewAtToFarm14();
            this.updateCoordinateDisplay();
            this.preloadArrowTargets();
            await fadeIn();
        } catch (error) {
            console.error(`Transition to ${positionKey} failed:`, error);
            try {
                await fadeIn();
            } catch (fadeErr) {
                console.error('fadeIn also failed:', fadeErr);
            }
        }
    }

    async loadPosition(positionKey) {
        const posData = this.positions[positionKey];
        if (!posData) {
            throw new Error(`Position not found: ${positionKey}`);
        }

        if (!this.photoSphere) {
            throw new Error('Photo sphere not initialized');
        }

        const photoUrl = posData.photo;

        try {
            if (positionKey === 'farm1-1' && !this.farmVoStarted) {
                this.farmVoStarted = true;
                this.isVoFinished = false;
                setTimeout(() => this.playVoWithSubtitles('farm'), 1200);
            }

            // Dispose old asset before loading new one
            if (this.currentPhotoAsset) {
                this.currentPhotoAsset.unload();
                app.assets.remove(this.currentPhotoAsset);
                this.currentPhotoAsset = null;
            }

            if (this.preloadedAssets[positionKey]) {
                // Use preloaded asset
                this.currentPhotoAsset = this.preloadedAssets[positionKey];
                delete this.preloadedAssets[positionKey];
                this.preloadedAssetKeys = this.preloadedAssetKeys.filter(k => k !== positionKey);
            } else {
                // Load asset with error handling
                this.currentPhotoAsset = await this.loadTexture(photoUrl);
            }

            // Validate asset and resource
            if (!this.currentPhotoAsset) {
                throw new Error('Asset is null after loading');
            }
            if (!this.currentPhotoAsset.resource) {
                throw new Error('Asset resource is null');
            }

            // Update sphere material
            const mat = new pc.StandardMaterial();
            mat.cull = pc.CULLFACE_NONE;
            mat.emissiveMap = this.currentPhotoAsset.resource;
            mat.emissive = new pc.Color(1, 1, 1);
            mat.emissiveIntensity = 1;
            mat.diffuse = new pc.Color(0.5, 0.5, 0.5);
            mat.diffuseMap = this.currentPhotoAsset.resource;
            mat.update();

            this.photoSphere.render.meshInstances[0].material = mat;
            console.log(`[position] ✓ ${positionKey} loaded`);
        } catch (error) {
            console.error(`Position load failed: ${error.message}`);
            throw error;
        }
    }

    preloadArrowTargets() {
        const posData = this.positions[this.currentPosition];
        if (!posData || !posData.arrows) return;

        posData.arrows.forEach(arrow => {
            if (arrow.target && !this.preloadedAssets[arrow.target]) {
                const targetData = this.positions[arrow.target];
                if (targetData) {
                    const photoUrl = targetData.photo;
                    // Background preload — don't block on failures
                    this.loadTexture(photoUrl)
                        .then(asset => {
                            this.preloadedAssets[arrow.target] = asset;
                            this.preloadedAssetKeys.push(arrow.target);
                            if (this.preloadedAssetKeys.length > 4) {
                                const oldest = this.preloadedAssetKeys.shift();
                                this.preloadedAssets[oldest].unload();
                                app.assets.remove(this.preloadedAssets[oldest]);
                                delete this.preloadedAssets[oldest];
                            }
                            console.log('Preloaded:', arrow.target);
                        })
                        .catch(err => {
                            console.warn('Preload failed (non-blocking):', arrow.target, err);
                        });
                }
            }
        });
    }

    updateCoordinateDisplay() {
        if (this.dom.coordX && this.dom.coordY && this.dom.coordZ) {
            this.dom.coordX.textContent = `Location: ${this.currentPosition}`;
            this.dom.coordY.textContent = `Yaw: ${(this.eulerAngles.yaw * 180 / Math.PI).toFixed(0)}°`;
            this.dom.coordZ.textContent = `Pitch: ${(this.eulerAngles.pitch * 180 / Math.PI).toFixed(0)}°`;
        }
    }


    async onLoad() {
        await super.onLoad();

        if (this.isLoaded) return;

        try {
            document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

            // Create sphere first (with placeholder) so loadPosition can update its material
            this.createPhotoSphere();

            // Create nadir patch
            this.createNadirPatch();

            // Load initial photo and update sphere material (non-fatal on failure)
            try {
                await this.loadPosition('toFarm1');
            } catch (loadError) {
                console.error('Initial position load failed:', loadError.message);
                console.warn('[streetView] Continuing with placeholder sphere — scene is navigable but photo failed to load');
            }

            // Create arrow navigation
            this.createArrows();

            // Cache DOM references
            this.dom = {
                coordX: document.getElementById('coord-x'),
                coordY: document.getElementById('coord-y'),
                coordZ: document.getElementById('coord-z'),
                hotspotPopup: document.getElementById('hotspot-popup'),
                videoPopup: document.getElementById('video-popup')
            };

            this.updateCoordinateDisplay();

            // Set camera to center of sphere
            cameraEntity.setLocalPosition(0, 0, 0);
            this.eulerAngles.yaw = 0;
            this.eulerAngles.pitch = 0;

            this.initAmbient(assetUrl('Music/farmAmbienceSound.mp3'), 0.8);

            const fallbackAudioStart = () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().catch(() => {});
                }
                window.removeEventListener('keydown', fallbackAudioStart);
                window.removeEventListener('click', fallbackAudioStart);
            };
            window.addEventListener('keydown', fallbackAudioStart);
            window.addEventListener('click', fallbackAudioStart);

            // Preload next positions
            this.preloadArrowTargets();

            this.attachEventListeners();
        } catch (error) {
            console.error('Street view load failed:', error);

            // Diagnostic: render sphere with diagnostic color so we know sphere itself works
            if (this.photoSphere) {
                const diagMat = new pc.StandardMaterial();
                diagMat.cull = pc.CULLFACE_NONE; // Render both sides to work with negative X scale
                diagMat.diffuse = new pc.Color(0.3, 0, 0); // Red
                diagMat.emissive = new pc.Color(1, 0, 0);
                diagMat.emissiveIntensity = 0.5;
                diagMat.update();
                this.photoSphere.render.meshInstances[0].material = diagMat;
                console.error('[diagnostic] Sphere rendered in red to confirm rendering pipeline works');
            }

            this.isLoaded = false;
            throw error;
        }
        this.isLoaded = true;
    }

    async onUnload() {
        try {
            document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

            this.detachEventListeners();

            this.isMouseDown = false;

            this.stopAmbient();

            this.stopVo();

            this.photoSphere = null;
            this.nadirPatch = null;
            if (this.nadirPatchTexture) {
                this.nadirPatchTexture.destroy();
                this.nadirPatchTexture = null;
            }
            this.arrowEntities.forEach(arrow => {
                this.unregisterInteractiveObject(arrow);
                arrow.destroy();
            });
            this.arrowEntities = [];
            this.arrowLabels = [];

            // Dispose preloaded assets
            Object.values(this.preloadedAssets).forEach(asset => {
                asset.unload();
                app.assets.remove(asset);
            });
            this.preloadedAssets = {};
            this.preloadedAssetKeys = [];

            await super.onUnload();
        } catch (error) {
            console.error('Error unloading street view:', error);
        } finally {
            this.isLoaded = false;
        }
    }

    update(deltaTime) {
        if (!this.isLoaded) return;

        // Update camera rotation from euler angles
        cameraEntity.setEulerAngles(
            this.eulerAngles.pitch * 180 / Math.PI,
            this.eulerAngles.yaw * 180 / Math.PI,
            0
        );

        // Arrow scale-pulse animation (keep flat orientation)
        this.arrowPulsePhase += deltaTime * 3; // ~3 rad/sec
        const pulse = Math.sin(this.arrowPulsePhase) * 0.5 + 0.5; // 0 to 1
        this.arrowEntities.forEach(arrow => {
            // Scale pulse on X and Z (keep Y thin for flat disc)
            const baseScale = 1.5;
            const scale = baseScale + pulse * 0.2; // Pulse between 1.5 and 1.7
            arrow.setLocalScale(scale, 0.08, scale);
        });

        // Update coordinate display periodically
        this.coordUpdateTimer += deltaTime;
        if (this.coordUpdateTimer >= this.coordUpdateInterval) {
            this.updateCoordinateDisplay();
            this.coordUpdateTimer = 0;
        }
    }
}

// Register the street view scene
const streetViewScene = new StreetViewScene();
sceneManager.registerScene('street-view', streetViewScene);
