// ============================================================================
// ROASTERY SCENE
// ============================================================================
// Loads and renders the roastery Gaussian splat with WASD movement
// and click-drag camera control. Uses manual OBB collision detection.
//
// Dependencies (from main.js global scope):
// - app (PlayCanvas Application)
// - cameraEntity (camera entity)
// - sceneManager (scene manager)
// - Scene (base scene class)

class RoasteryScene extends Scene {
    constructor() {
        super('roastery');
        this.splatEntity = null;
        this.splatAsset = null;
        this.isLoaded = false;

        // Mouse position tracking
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDragDistance = 0;
        this.mouseDownX = 0;
        this.mouseDownY = 0;

        // Gate marker hotspot highlighting
        this.highlightedHotspot = null;
        this.highlightStartTime = 0;
        this.highlightLabel = null;

        // Hotspot system
        this.hotspots = [
            {
                id: 'back-to-exterior',
                position: new pc.Vec3(-1.116, 1.600, 1.233),
                label: 'Back to Cafe Exterior',
                description: 'Return to the cafe garden.',
                isTransition: true,
                targetScene: 'cafe-interior',
                spawnPosition: [0, 1.6, 0.9]
            },
            {
                id: 'roasting-machine',
                position: new pc.Vec3(0.566, 1.5, -0.740),
                label: 'Roasting Machine',
                description: 'The roaster applies controlled heat to green coffee beans, moving them through drying, first crack, and development — the stages that build the sugars, acids, and oils responsible for flavour and aroma. Roast time and temperature are adjusted to draw out each bean\'s best character before cooling and packaging.',
                isTransition: false
            },
            {
                id: 'roasting-beans-transition',
                position: new pc.Vec3(0.566, 1.3, -0.740),
                label: 'Roasting Beans',
                description: 'Watch the beans roast',
                isVideo: true,
                videoSrc: `${R2_BASE}/roasting.mp4`,
                isGateMarker: true
            },
            {
                id: 'green-bean-packs',
                position: new pc.Vec3(-0.471, 0.9, 0.389),
                label: 'Green Bean Packs',
                description: 'Arabica grows at higher elevations and is known for a smoother, more complex, slightly sweet profile with milder acidity. Robusta is hardier, carries more caffeine, and brings a bolder, more bitter character — often used to add body and crema.',
                isTransition: false
            }
        ];
        this.hotspotEntities = [];
        this.activeHotspotEntity = null;
        this.isVoFinished = false;
        this.voAudio = null;
        this.quizPassed = false;
        this.quiz = {
            question: 'What does the \'first crack\' during roasting indicate?',
            choices: ['The beans are ready to be planted.', 'The beans begin developing their full coffee flavor.', 'The beans have finished cooling.', 'The beans are ready to be brewed immediately.'],
            correct: 1,
            clue: 'First crack happens in the middle of roasting, not at the end — it\'s about flavor developing.',
            feedback: 'Correct! The first crack signals an important stage where the beans expand and develop the flavors and aromas we associate with coffee.'
        };

        // Audio system (skipped for now)
        this.audioContext = null;
        this.ambientSource = null;
        this.audioLoaded = false;

        // Collision boxes traced with the editor tool (exported from editor, complete state)
        this.collisionBoxes = [
            { name: 'roast-box-1',  pos: [-1.340, 1.140, 1.080], size: [0.010, 1.302, 1.309], rotY: 43.0 },
            { name: 'roast-box-2',  pos: [-0.570, 1.140, 1.190], size: [0.012, 1.302, 2.330], rotY: -47.0 },
            { name: 'roast-box-3',  pos: [1.390, 1.140, -0.635], size: [0.012, 1.302, 2.330], rotY: -47.0 },
            { name: 'roast-box-4',  pos: [0.810, 0.985, -0.895], size: [0.468, 0.287, 1.153], rotY: 40.7 },
            { name: 'roast-box-5',  pos: [0.665, 0.925, -0.350], size: [0.312, 0.192, 0.350], rotY: 25.0 },
            { name: 'roast-box-6',  pos: [0.865, 0.925, 0.255], size: [0.312, 0.192, 0.350], rotY: 34.0 },
            { name: 'roast-box-7',  pos: [0.845, 0.925, 0.735], size: [0.312, 0.192, 0.350], rotY: 34.0 },
            { name: 'roast-box-8',  pos: [0.360, 0.925, 0.650], size: [0.312, 0.192, 0.350], rotY: 45.3 },
            { name: 'roast-box-9',  pos: [-0.260, 0.925, -0.310], size: [1.290, 0.192, 0.350], rotY: 40.8 },
            { name: 'roast-box-10', pos: [-1.300, 0.925, 0.720], size: [0.790, 0.192, 0.350], rotY: 41.5 },
            { name: 'roast-box-11', pos: [-0.790, 0.765, 0.365], size: [0.417, 0.192, 0.350], rotY: 41.5 },
            { name: 'roast-box-12', pos: [0.140, 1.135, -0.695], size: [0.258, 0.102, 0.109], rotY: 5.5 },
            { name: 'roast-box-13', pos: [0.030, 1.135, -0.950], size: [0.524, 0.102, 0.110], rotY: -136.0 },
        ];

        // Collision box editor (dev tool)
        this.editorBoxes = [];
        this.selectedBox = null;
        this.boxIdCounter = 0;
        this.syncingPanel = false;
        this.editorMode = false;
        this.bPressTimes = [];
        this.bSpawnTimer = null;

        // Blender-style transform controls
        this.transformMode = null;      // null | 'grab' | 'scale' | 'rotate'
        this.transformAxis = null;      // null | 'x' | 'y' | 'z'
        this.transformStart = null;     // stores original transform for cancel
        this.transformMouseStart = { x: 0, y: 0 };
        this.shiftHeld = false;         // precision mode

        // Collision debug visualization
        this.debugBoxes = [];
        this.debugBoxesBuilt = false;

        // DOM reference cache (populated in onLoad, throttles frequent lookups)
        this.dom = {};
        this.coordUpdateTimer = 0;
        this.coordUpdateInterval = 0.1; // Update coordinate display 10x/sec instead of 60x/sec

        // Jump physics
        this.verticalVelocity = 0;
        this.isJumping = false;
        this.floorHeight = 1.6;
        this.jumpStrength = 2.5;
        this.gravity = 9.8;

        // WASD Movement
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
        };
        this.moveSpeed = 0.7;

        // Scratch vectors for collision/movement (reused, not alloced per frame)
        this._moveDir = new pc.Vec3();
        this._newPos = new pc.Vec3();
        this._slideA = new pc.Vec3();
        this._slideB = new pc.Vec3();
        this._screenPos = new pc.Vec3();

        // Mouse-look camera rotation
        this.isMouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mouseSensitivity = 0.005;
        this.eulerAngles = {
            yaw: 0,
            pitch: 0,
        };
        this.pitchMin = -Math.PI / 2.5;
        this.pitchMax = Math.PI / 2.5;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.onKeyDown = (e) => this.handleKeyDown(e);
        this.onKeyUp = (e) => this.handleKeyUp(e);
        this.onMouseDown = (e) => this.handleMouseDown(e);
        this.onMouseMove = (e) => this.handleMouseMove(e);
        this.onMouseUp = (e) => this.handleMouseUp(e);
    }

    attachEventListeners() {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);

        if (window.DEV_MODE) {
            this.onKeyB = (e) => {
                if (e.key !== 'b' && e.key !== 'B') return;

                const now = Date.now();
                this.bPressTimes.push(now);
                this.bPressTimes = this.bPressTimes.filter(t => now - t < 800);

                if (this.bSpawnTimer) {
                    clearTimeout(this.bSpawnTimer);
                    this.bSpawnTimer = null;
                }

                if (this.bPressTimes.length >= 3) {
                    this.bPressTimes = [];
                    this.editorMode = !this.editorMode;
                    this.setEditorMode(this.editorMode);
                    return;
                }

                if (this.editorMode && this.bPressTimes.length === 1) {
                    this.bSpawnTimer = setTimeout(() => {
                        this.bSpawnTimer = null;
                        if (this.editorMode) {
                            this.spawnEditorBox();
                        }
                        this.bPressTimes = [];
                    }, 850);
                }
            };
            window.addEventListener('keydown', this.onKeyB);

            this.onKeyDuplicate = (e) => {
                if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
                    e.preventDefault();
                    this.duplicateSelectedBox();
                }
            };
            window.addEventListener('keydown', this.onKeyDuplicate);

            // Blender-style transform controls (G/F/R)
            this.onTransformKey = (e) => {
                if (!this.editorMode || !this.selectedBox) return;

                const key = e.key.toLowerCase();

                // Start modes
                if (!this.transformMode) {
                    if (key === 'g') { this.startTransform('grab'); e.preventDefault(); }
                    if (key === 'f') { this.startTransform('scale'); e.preventDefault(); }
                    if (key === 'r') { this.startTransform('rotate'); e.preventDefault(); }
                    return;
                }

                // Axis constraints while in a mode
                if (key === 'x') this.transformAxis = 'x';
                if (key === 'y') this.transformAxis = 'y';
                if (key === 'z') this.transformAxis = 'z';

                // Cancel
                if (e.key === 'Escape') this.cancelTransform();
            };
            window.addEventListener('keydown', this.onTransformKey);
        }
    }

    detachEventListeners() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        if (this.onKeyB) window.removeEventListener('keydown', this.onKeyB);
        if (this.onKeyDuplicate) window.removeEventListener('keydown', this.onKeyDuplicate);
        if (this.onTransformKey) window.removeEventListener('keydown', this.onTransformKey);
    }

    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        if (key === 'w') this.keys.w = true;
        if (key === 'a') this.keys.a = true;
        if (key === 's') this.keys.s = true;
        if (key === 'd') this.keys.d = true;

        // Track shift for precision transform mode
        if (event.key === 'Shift') {
            this.shiftHeld = true;
            // Re-anchor transform to prevent jumping when shift is pressed mid-drag
            if (this.transformMode && this.selectedBox) {
                const p = this.selectedBox.getLocalPosition().clone();
                const s = this.selectedBox.getLocalScale().clone();
                const r = this.selectedBox.getLocalEulerAngles().clone();
                this.transformStart = { pos: p, scale: s, rot: r };
                this.transformMouseStart = { x: this.mouseX, y: this.mouseY };
            }
        }

        if (event.code === 'Space') {
            event.preventDefault();
            if (!this.isJumping) {
                this.isJumping = true;
                this.verticalVelocity = this.jumpStrength;
            }
        }
    }

    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        if (key === 'w') this.keys.w = false;
        if (key === 'a') this.keys.a = false;
        if (key === 's') this.keys.s = false;
        if (key === 'd') this.keys.d = false;

        // Track shift release for precision transform mode
        if (event.key === 'Shift') {
            this.shiftHeld = false;
            // Re-anchor transform to prevent jumping when shift is released mid-drag
            if (this.transformMode && this.selectedBox) {
                const p = this.selectedBox.getLocalPosition().clone();
                const s = this.selectedBox.getLocalScale().clone();
                const r = this.selectedBox.getLocalEulerAngles().clone();
                this.transformStart = { pos: p, scale: s, rot: r };
                this.transformMouseStart = { x: this.mouseX, y: this.mouseY };
            }
        }
    }

    handleMouseDown(event) {
        // Confirm transform on click
        if (this.transformMode) {
            this.confirmTransform();
            return;
        }

        if (event.target.closest('#box-editor') ||
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

        if (this.isMouseDown) {
            const dx = event.clientX - this.mouseDownX;
            const dy = event.clientY - this.mouseDownY;
            this.mouseDragDistance = Math.sqrt(dx * dx + dy * dy);
        }

        // Skip camera look during transform mode
        if (this.transformMode) return;

        if (!this.isMouseDown) return;

        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;

        this.eulerAngles.yaw -= deltaX * this.mouseSensitivity;
        this.eulerAngles.pitch -= deltaY * this.mouseSensitivity;

        this.eulerAngles.pitch = Math.max(this.pitchMin, Math.min(this.pitchMax, this.eulerAngles.pitch));

        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }

    handleMouseUp(event) {
        if (event.button === 0) {
            this.isMouseDown = false;
        }
    }

    checkManualCollision(newPos) {
        const pad = 0.05;

        for (const box of this.collisionBoxes) {
            const dx = newPos.x - box.pos[0];
            const dz = newPos.z - box.pos[2];

            const rot = box.rotY * Math.PI / 180;
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);

            const localX = dx * cos + dz * -sin;
            const localZ = dx * sin + dz * cos;

            const halfX = box.size[0] / 2 + pad;
            const halfZ = box.size[2] / 2 + pad;

            if (Math.abs(localX) < halfX && Math.abs(localZ) < halfZ) {
                return true;
            }
        }

        return false;
    }

    spawnEditorBox() {
        const camPos = cameraEntity.getLocalPosition();

        const boxEntity = new pc.Entity(`editor-box-${this.boxIdCounter++}`);
        const layer = app.scene.layers.getLayerByName('Immediate') || app.scene.layers.getLayerByName('UI');
        boxEntity.addComponent('render', {
            type: 'box',
            layers: [layer.id]
        });

        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(1, 0.2, 0.2);
        mat.emissive = new pc.Color(1, 0.2, 0.2);
        mat.emissiveIntensity = 1.5;
        mat.opacity = 0.65;
        mat.blendType = pc.BLEND_NORMAL;
        mat.depthWrite = false;
        mat.depthTest = false;
        mat.cull = pc.CULLFACE_NONE;
        mat.update();
        boxEntity.render.meshInstances[0].material = mat;

        boxEntity.setLocalPosition(-0.470, 1.140, 0.760);
        boxEntity.setLocalScale(0.05, 0.05, 0.05);
        boxEntity.setLocalEulerAngles(0, -23.0, 0);

        app.root.addChild(boxEntity);
        this.editorBoxes.push(boxEntity);

        this.registerInteractiveObject(boxEntity, () => {
            this.selectEditorBox(boxEntity);
        });

        this.selectEditorBox(boxEntity);
    }

    duplicateSelectedBox() {
        if (!this.selectedBox) return;

        const srcPos = this.selectedBox.getLocalPosition();
        const srcScale = this.selectedBox.getLocalScale();
        const srcRot = this.selectedBox.getLocalEulerAngles();

        // Normalize Y rotation — handle flipped euler representation
        let rotY = srcRot.y;
        if (Math.abs(srcRot.x) > 90 || Math.abs(srcRot.z) > 90) {
            // Euler was flipped: actual Y = 180 - y
            rotY = 180 - srcRot.y;
        }
        // Wrap to -180..180
        while (rotY > 180) rotY -= 360;
        while (rotY < -180) rotY += 360;

        const boxEntity = new pc.Entity(`editor-box-${this.boxIdCounter++}`);

        const layer = app.scene.layers.getLayerByName('Immediate') || app.scene.layers.getLayerByName('UI');
        boxEntity.addComponent('render', {
            type: 'box',
            layers: [layer.id]
        });

        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(1, 0.2, 0.2);
        mat.emissive = new pc.Color(1, 0.2, 0.2);
        mat.emissiveIntensity = 1.5;
        mat.opacity = 0.65;
        mat.blendType = pc.BLEND_NORMAL;
        mat.depthWrite = false;
        mat.depthTest = false;
        mat.cull = pc.CULLFACE_NONE;
        mat.update();
        boxEntity.render.meshInstances[0].material = mat;

        boxEntity.setLocalPosition(srcPos.x + 0.3, srcPos.y, srcPos.z + 0.3);
        boxEntity.setLocalScale(srcScale.x, srcScale.y, srcScale.z);
        boxEntity.setLocalEulerAngles(0, rotY, 0);

        app.root.addChild(boxEntity);
        this.editorBoxes.push(boxEntity);

        this.registerInteractiveObject(boxEntity, () => {
            this.selectEditorBox(boxEntity);
        });

        this.selectEditorBox(boxEntity);
    }

    selectEditorBox(boxEntity) {
        this.selectedBox = boxEntity;
        document.getElementById('box-editor')?.classList.add('active');
        const boxEditorTitle = document.getElementById('box-editor-title');
        if (boxEditorTitle) boxEditorTitle.textContent = boxEntity.name;

        this.editorBoxes.forEach(b => {
            const m = b.render.meshInstances[0].material;
            m.emissive = (b === boxEntity) ? new pc.Color(1, 0.5, 0.1) : new pc.Color(1, 0.2, 0.2);
            m.update();
        });

        this.syncEditorPanel();
    }

    setEditorMode(on) {
        // Lazily create debug boxes on first editor mode activation
        if (on && !this.debugBoxesBuilt) {
            this.createCollisionDebugBoxes();
            this.debugBoxesBuilt = true;
        }
        this.editorBoxes.forEach(b => b.enabled = on);
        if (this.debugBoxes) {
            this.debugBoxes.forEach(b => b.enabled = on);
        }
        if (!on) {
            document.getElementById('box-editor')?.classList.remove('active');
            this.selectedBox = null;
            this.cancelTransform();
        }
        if (window.DEV_MODE) console.log('Editor mode:', on ? 'ON' : 'OFF');
    }

    startTransform(mode) {
        this.transformMode = mode;
        this.transformAxis = null;
        this.transformMouseStart = { x: this.mouseX, y: this.mouseY };
        const p = this.selectedBox.getLocalPosition().clone();
        const s = this.selectedBox.getLocalScale().clone();
        const r = this.selectedBox.getLocalEulerAngles().clone();
        this.transformStart = { pos: p, scale: s, rot: r };
        if (window.DEV_MODE) console.log(`Transform mode: ${mode}`);
    }

    cancelTransform() {
        if (this.transformStart && this.selectedBox) {
            this.selectedBox.setLocalPosition(this.transformStart.pos);
            this.selectedBox.setLocalScale(this.transformStart.scale);
            this.selectedBox.setLocalEulerAngles(this.transformStart.rot);
        }
        this.transformMode = null;
        this.transformAxis = null;
        this.transformStart = null;
    }

    confirmTransform() {
        this.transformMode = null;
        this.transformAxis = null;
        this.transformStart = null;
        this.syncEditorPanel();
    }

    updateTransform() {
        if (!this.transformMode || !this.selectedBox || !this.transformStart) return;

        const sensitivity = this.shiftHeld ? 0.005 : 0.06;
        const dx = (this.mouseX - this.transformMouseStart.x) * sensitivity;
        const dy = (this.mouseY - this.transformMouseStart.y) * sensitivity;

        if (this.transformMode === 'grab') {
            if (this.transformAxis === 'y') {
                this.selectedBox.setLocalPosition(
                    this.transformStart.pos.x,
                    this.transformStart.pos.y - dy,
                    this.transformStart.pos.z
                );
            } else if (this.transformAxis === 'x') {
                // Lock to world X axis only
                this.selectedBox.setLocalPosition(
                    this.transformStart.pos.x + dx,
                    this.transformStart.pos.y,
                    this.transformStart.pos.z
                );
            } else if (this.transformAxis === 'z') {
                // Lock to world Z axis only
                this.selectedBox.setLocalPosition(
                    this.transformStart.pos.x,
                    this.transformStart.pos.y,
                    this.transformStart.pos.z + dx
                );
            } else {
                // Free XZ plane movement relative to camera
                const camTransform = cameraEntity.getWorldTransform();
                const right = camTransform.getX();
                const forward = camTransform.getZ().scale(-1);
                right.y = 0; forward.y = 0;
                right.normalize(); forward.normalize();

                this.selectedBox.setLocalPosition(
                    this.transformStart.pos.x + right.x * dx + forward.x * -dy,
                    this.transformStart.pos.y,
                    this.transformStart.pos.z + right.z * dx + forward.z * -dy
                );
            }
        }

        if (this.transformMode === 'scale') {
            const factor = 1 + dx;
            const s = this.transformStart.scale;
            if (this.transformAxis === 'x') {
                this.selectedBox.setLocalScale(Math.max(0.01, s.x * factor), s.y, s.z);
            } else if (this.transformAxis === 'y') {
                this.selectedBox.setLocalScale(s.x, Math.max(0.01, s.y * factor), s.z);
            } else if (this.transformAxis === 'z') {
                this.selectedBox.setLocalScale(s.x, s.y, Math.max(0.01, s.z * factor));
            } else {
                this.selectedBox.setLocalScale(
                    Math.max(0.01, s.x * factor),
                    Math.max(0.01, s.y * factor),
                    Math.max(0.01, s.z * factor)
                );
            }
        }

        if (this.transformMode === 'rotate') {
            this.selectedBox.setLocalEulerAngles(0, this.transformStart.rot.y + dx * 150, 0);
        }
    }

    syncEditorPanel() {
        if (!this.selectedBox) return;
        this.syncingPanel = true;

        const pos = this.selectedBox.getLocalPosition();
        const scale = this.selectedBox.getLocalScale();
        const rot = this.selectedBox.getLocalEulerAngles();

        // Normalize Y rotation — handle flipped euler representation
        let rotY = rot.y;
        if (Math.abs(rot.x) > 90 || Math.abs(rot.z) > 90) {
            // Euler was flipped: actual Y = 180 - y
            rotY = 180 - rot.y;
        }
        // Wrap to -180..180
        while (rotY > 180) rotY -= 360;
        while (rotY < -180) rotY += 360;

        const set = (id, value) => {
            const slider = document.getElementById(id);
            const numInput = document.getElementById(id + '-num');
            if (slider) slider.value = value;
            if (numInput) numInput.value = parseFloat(value).toFixed(2);
        };
        set('box-px', pos.x); set('box-py', pos.y); set('box-pz', pos.z);
        set('box-sx', scale.x); set('box-sy', scale.y); set('box-sz', scale.z);
        set('box-ry', rotY);

        const mat = this.selectedBox.render.meshInstances[0].material;
        set('box-op', mat.opacity);

        this.syncingPanel = false;
    }

    setupEditorPanelListeners() {
        const bind = (id, callback) => {
            const slider = document.getElementById(id);
            const num = document.getElementById(id + '-num');
            if (!slider || !num) return;
            slider?.addEventListener('input', () => {
                if (this.syncingPanel) return;
                num.value = slider.value;
                callback(parseFloat(slider.value));
            });
            num?.addEventListener('input', () => {
                if (this.syncingPanel) return;
                slider.value = num.value;
                callback(parseFloat(num.value));
            });
        };

        bind('box-px', v => { if (this.selectedBox) { const p = this.selectedBox.getLocalPosition(); this.selectedBox.setLocalPosition(v, p.y, p.z); } });
        bind('box-py', v => { if (this.selectedBox) { const p = this.selectedBox.getLocalPosition(); this.selectedBox.setLocalPosition(p.x, v, p.z); } });
        bind('box-pz', v => { if (this.selectedBox) { const p = this.selectedBox.getLocalPosition(); this.selectedBox.setLocalPosition(p.x, p.y, v); } });
        bind('box-sx', v => { if (this.selectedBox) { const s = this.selectedBox.getLocalScale(); this.selectedBox.setLocalScale(v, s.y, s.z); } });
        bind('box-sy', v => { if (this.selectedBox) { const s = this.selectedBox.getLocalScale(); this.selectedBox.setLocalScale(s.x, v, s.z); } });
        bind('box-sz', v => { if (this.selectedBox) { const s = this.selectedBox.getLocalScale(); this.selectedBox.setLocalScale(s.x, s.y, v); } });
        bind('box-ry', v => { if (this.selectedBox) { this.selectedBox.setLocalEulerAngles(0, v, 0); } });
        bind('box-op', v => {
            if (this.selectedBox) {
                const m = this.selectedBox.render.meshInstances[0].material;
                m.opacity = v;
                m.update();
            }
        });

        const deleteBtn = document.getElementById('box-delete-btn');
        if (deleteBtn && !deleteBtn.classList.contains('roastery-bound')) {
            deleteBtn.classList.add('roastery-bound');
            deleteBtn.addEventListener('click', () => {
                if (this.selectedBox) {
                    this.editorBoxes = this.editorBoxes.filter(b => b !== this.selectedBox);
                    this.unregisterInteractiveObject(this.selectedBox);
                    this.selectedBox.destroy();
                    this.selectedBox = null;
                    document.getElementById('box-editor')?.classList.remove('active');
                }
            });
        }

        // Register copy button ONCE globally — exports collision + editor boxes combined
        if (!window._boxCopyBtnInit) {
            window._boxCopyBtnInit = true;
            document.getElementById('box-copy-btn')?.addEventListener('click', () => {
                const scene = sceneManager.getActiveScene();
                if (!scene) return;

                const fromCollision = scene.collisionBoxes.map(b =>
                    `{ name: '${b.name}', pos: [${b.pos[0].toFixed(3)}, ${b.pos[1].toFixed(3)}, ${b.pos[2].toFixed(3)}], size: [${b.size[0].toFixed(3)}, ${b.size[1].toFixed(3)}, ${b.size[2].toFixed(3)}], rotY: ${b.rotY.toFixed(1)} }`
                );

                const fromEditor = scene.editorBoxes.map(b => {
                    const p = b.getLocalPosition();
                    const s = b.getLocalScale();
                    const r = b.getLocalEulerAngles();
                    let rotY = r.y;
                    if (Math.abs(r.x) > 90 || Math.abs(r.z) > 90) rotY = 180 - r.y;
                    while (rotY > 180) rotY -= 360;
                    while (rotY < -180) rotY += 360;
                    return `{ name: '${b.name}', pos: [${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}], size: [${s.x.toFixed(3)}, ${s.y.toFixed(3)}, ${s.z.toFixed(3)}], rotY: ${rotY.toFixed(1)} }`;
                });

                const data = [...fromCollision, ...fromEditor].join(',\n');
                navigator.clipboard.writeText(data);
                const boxCopyFeedback = document.getElementById('box-copy-feedback');
                if (boxCopyFeedback) {
                    boxCopyFeedback.textContent = '✓ Copied full list!';
                    setTimeout(() => { boxCopyFeedback.textContent = ''; }, 2000);
                }
            });
        }

        document.getElementById('quiz-close-btn')?.addEventListener('click', () => {
            document.getElementById('quiz-overlay')?.classList.remove('active');
        });

        document.getElementById('video-close-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const videoEl = document.getElementById('popup-video');
            if (videoEl) {
                videoEl.pause();
                videoEl.src = '';
            }
            document.getElementById('video-popup')?.classList.remove('active');
        });

        // Global debug-boxes-toggle already registered
    }

    createCollisionDebugBoxes() {
        this.debugBoxes = [];
        this.collisionBoxes.forEach(box => {
            const entity = new pc.Entity(`debug-${box.name}`);

            const layer = app.scene.layers.getLayerByName('Immediate') || app.scene.layers.getLayerByName('UI');
            entity.addComponent('render', {
                type: 'box',
                layers: [layer.id]
            });

            const mat = new pc.StandardMaterial();
            mat.diffuse = new pc.Color(0.2, 0.5, 1);
            mat.emissive = new pc.Color(0.2, 0.5, 1);
            mat.emissiveIntensity = 1;
            mat.opacity = 0.4;
            mat.blendType = pc.BLEND_NORMAL;
            mat.depthWrite = false;
            mat.depthTest = false;
            mat.cull = pc.CULLFACE_NONE;
            mat.update();
            entity.render.meshInstances[0].material = mat;

            entity.setLocalPosition(box.pos[0], box.pos[1], box.pos[2]);
            entity.setLocalScale(box.size[0], box.size[1], box.size[2]);
            entity.setLocalEulerAngles(0, box.rotY, 0);
            entity.enabled = false;

            app.root.addChild(entity);
            this.debugBoxes.push(entity);

            // Make clickable — converts to editable box in editor mode
            entity.collisionBoxData = box;
            entity._lastClickTime = 0;
            const clickRadius = Math.max(box.size[0], box.size[1], box.size[2]) / 2;
            this.registerInteractiveObject(entity, () => {
                if (!this.editorMode) return;
                const now = Date.now();
                if (now - entity._lastClickTime < 400) {
                    // Double-click confirmed — convert to editable
                    this.convertDebugBoxToEditable(entity);
                } else {
                    entity._lastClickTime = now;
                    if (window.DEV_MODE) console.log(`${box.name} — click again to edit`);
                }
            }, clickRadius);
        });
        if (window.DEV_MODE) console.log('Collision debug boxes visible:', this.debugBoxes.length);
    }

    convertDebugBoxToEditable(debugEntity) {
        const boxData = debugEntity.collisionBoxData;
        if (!boxData) return;

        // Remove from collision array
        this.collisionBoxes = this.collisionBoxes.filter(b => b !== boxData);

        // Remove debug entity
        this.debugBoxes = this.debugBoxes.filter(b => b !== debugEntity);
        this.unregisterInteractiveObject(debugEntity);
        debugEntity.destroy();

        // Spawn red editor box with same transform
        const boxEntity = new pc.Entity(`editor-box-${this.boxIdCounter++}`);
        const layer = app.scene.layers.getLayerByName('Immediate') || app.scene.layers.getLayerByName('UI');
        boxEntity.addComponent('render', { type: 'box', layers: [layer.id] });

        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(1, 0.2, 0.2);
        mat.emissive = new pc.Color(1, 0.2, 0.2);
        mat.emissiveIntensity = 1.5;
        mat.opacity = 0.65;
        mat.blendType = pc.BLEND_NORMAL;
        mat.depthWrite = false;
        mat.depthTest = false;
        mat.cull = pc.CULLFACE_NONE;
        mat.update();
        boxEntity.render.meshInstances[0].material = mat;

        boxEntity.setLocalPosition(boxData.pos[0], boxData.pos[1], boxData.pos[2]);
        boxEntity.setLocalScale(boxData.size[0], boxData.size[1], boxData.size[2]);
        boxEntity.setLocalEulerAngles(0, boxData.rotY, 0);

        app.root.addChild(boxEntity);
        this.editorBoxes.push(boxEntity);

        this.registerInteractiveObject(boxEntity, () => {
            this.selectEditorBox(boxEntity);
        });

        this.selectEditorBox(boxEntity);
        if (window.DEV_MODE) console.log(`Converted ${boxData.name} to editable box`);
    }

    worldToScreen(worldPos) {
        cameraEntity.camera.worldToScreen(worldPos, this._screenPos);
        return { x: this._screenPos.x, y: this._screenPos.y };
    }

    getNavPromptText() {
        return 'Follow the glowing marker back to the café';
    }

    createHotspots() {
        document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

        this.hotspotEntities.forEach(group => { if (group?.labelElement) group.labelElement.remove(); });
        this.hotspotEntities = [];

        this.hotspots.forEach(hotspot => {
            const group = new pc.Entity(`hotspot-${hotspot.id}`);
            group.setLocalPosition(hotspot.position);
            this.container.addChild(group);

            const core = new pc.Entity(`hotspot-core-${hotspot.id}`);
            core.addComponent('render', { type: 'sphere' });
            const isTransition = hotspot.isTransition;
            const isGateMarker = hotspot.isGateMarker;
            const coreScale = (isTransition || isGateMarker) ? 0.08 : 0.04;
            core.setLocalScale(coreScale, coreScale, coreScale);

            const coreMaterial = new pc.StandardMaterial();
            coreMaterial.diffuse = (isTransition || isGateMarker) ? new pc.Color(1, 0.85, 0.2) : coreMaterial.diffuse;
            coreMaterial.emissive = new pc.Color(0, 0, 0);
            coreMaterial.emissiveIntensity = 0;
            coreMaterial.opacity = 1.0;
            coreMaterial.blendType = pc.BLEND_NORMAL;
            coreMaterial.update();
            core.render.meshInstances[0].material = coreMaterial;
            group.addChild(core);

            const glow = new pc.Entity(`hotspot-glow-${hotspot.id}`);
            glow.addComponent('render', { type: 'sphere' });
            const glowScale = (isTransition || isGateMarker) ? 0.18 : 0.08;
            glow.setLocalScale(glowScale, glowScale, glowScale);

            const glowMaterial = new pc.StandardMaterial();
            glowMaterial.emissive = (isTransition || isGateMarker) ? new pc.Color(1, 0.85, 0.2) : new pc.Color(0, 0, 0);
            glowMaterial.emissiveIntensity = (isTransition || isGateMarker) ? 3 : 0;
            glowMaterial.opacity = (isTransition || isGateMarker) ? 0.6 : 0.4;
            glowMaterial.blendType = pc.BLEND_NORMAL;
            glowMaterial.depthWrite = false;
            glowMaterial.cull = pc.CULLFACE_NONE;
            glowMaterial.update();
            glow.render.meshInstances[0].material = glowMaterial;
            group.addChild(glow);

            const halo = new pc.Entity(`hotspot-halo-${hotspot.id}`);
            halo.addComponent('render', { type: 'sphere' });
            const haloScale = (isTransition || isGateMarker) ? 0.25 : 0.15;
            halo.setLocalScale(haloScale, haloScale, haloScale);
            const haleMaterial = new pc.StandardMaterial();
            haleMaterial.emissive = new pc.Color(0, 0, 0);
            haleMaterial.emissiveIntensity = 0;
            haleMaterial.opacity = 0.12;
            haleMaterial.blendType = pc.BLEND_NORMAL;
            haleMaterial.depthWrite = false;
            haleMaterial.cull = pc.CULLFACE_NONE;
            haleMaterial.update();
            halo.render.meshInstances[0].material = haleMaterial;
            halo.enabled = false;
            group.addChild(halo);
            group.haloEntity = halo;

            group.hotspotData = hotspot;
            group.coreEntity = core;
            group.glowEntity = glow;
            // Hide gate marker on initial load; it will be enabled via spawnGateMarker when appropriate
            if (hotspot.isGateMarker) group.enabled = false;
            this.hotspotEntities.push(group);
            console.log(`[roastery] Created hotspot: "${hotspot.id}" (transition=${hotspot.isTransition})`);


            this.registerInteractiveObject(group, () => {
                this.onHotspotClick(hotspot, group);
            });

            // Create label for transition hotspots, gate markers, and video hotspots
            if (hotspot.isTransition || hotspot.isGateMarker || hotspot.isVideo) {
                const label = document.createElement('div');
                label.className = 'hotspot-label';
                label.textContent = hotspot.label;
                label.style.cssText = `position:fixed; pointer-events:none; z-index:5000; color:#f4f4f4; font-family:'Inter',sans-serif; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.5px; background:rgba(0,0,0,0.6); padding:6px 12px; border-radius:4px; border:1px solid rgba(244,208,63,0.4); display:none; transform:translateX(-50%);`;
                document.body.appendChild(label);
                group.labelElement = label;
                // Gate markers show their label immediately
                if (hotspot.isGateMarker) {
                    label.style.display = 'block';
                }
                console.warn(`[roastery] Created label: "${hotspot.label}" for hotspot "${hotspot.id}"`);
            }
        });
    }

    async onLoad() {
        console.log('[Roastery] onLoad called');
        await super.onLoad();

        if (this.isLoaded) {
            console.log('[Roastery] Already loaded, returning');
            return;
        }

        try {
            console.log('[Roastery] Starting load sequence');
            document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

            window.ThesisApp.debugLog('Loading roastery splat...');

            // Check if splat was preloaded
            if (window._preloadedSplats && window._preloadedSplats['roastery-splat']) {
                this.splatAsset = window._preloadedSplats['roastery-splat'];
                console.warn('[Roastery] Using preloaded splat');
            } else {
                this.splatAsset = new pc.Asset('roastery-splat', 'gsplat', {
                    url: `${R2_BASE}/thesisRoastery_optimized.sog`
                });

                app.assets.add(this.splatAsset);
                app.assets.load(this.splatAsset);
            }

            await new Promise((resolve) => {
                this.splatAsset.ready(() => {
                    this.splatEntity = new pc.Entity('roastery-splat');
                    this.splatEntity.addComponent('gsplat', { asset: this.splatAsset });

                    this.splatEntity.setEulerAngles(0, 0, 180);
                    this.splatEntity.setLocalPosition(0, 1.3, 0);

                    this.container.addChild(this.splatEntity);

                    if (this.splatEntity.gsplat) {
                        this.splatEntity.gsplat.unified = true;
                    }

                    if (app.scene.gsplat) {
                        app.scene.gsplat.splatBudget = 2000000;
                    }

                    resolve();
                });
            });

            // Create hotspots
            this.createHotspots();

            // Cache DOM references to avoid repeated getElementById() calls
            this.dom = {
                coordX: document.getElementById('coord-x'),
                coordY: document.getElementById('coord-y'),
                coordZ: document.getElementById('coord-z'),
                hotspotPopup: document.getElementById('hotspot-popup'),
                videoPopup: document.getElementById('video-popup'),
                popupVideo: document.getElementById('popup-video')
            };

            // Setup collision box editor listeners
            this.setupEditorPanelListeners();

            this.isVoFinished = false;
            this.playVoSequence('roasting');
            this.initAmbient(assetUrl('Music/roasteryJazz.mp3'), 0.05);
            if (!window.journeyComplete) {
                this.preloadSplat(`${R2_BASE}/thesisCafeInterior_optimized.sog`, 'cafe-interior-splat');
            }

            const startVoOnInteraction = () => {
                if (this.voAudio && this.voAudio.paused && this.voAudio.currentTime === 0) {
                    this.voAudio.play().catch(e => {
                        console.warn('VO Autoplay blocked', e);
                        this.isVoFinished = true;
                    });
                    window.removeEventListener('keydown', startVoOnInteraction);
                    window.removeEventListener('click', startVoOnInteraction);
                }
            };
            window.addEventListener('keydown', startVoOnInteraction);
            window.addEventListener('click', startVoOnInteraction);

            // Attach event listeners for this scene
            this.attachEventListeners();

            // Reset camera position and rotation
            cameraEntity.setLocalPosition(0, 1.6, 0);
            this.eulerAngles.yaw = 0;
            this.eulerAngles.pitch = 0;

            window.ThesisApp.debugLog('Roastery scene loaded successfully');
        } catch (error) {
            console.error('Failed to load roastery scene:', error);
            console.error('[Roastery] Load failed with error:', error.message);
            this.isLoaded = false;
            throw error;
        }
        this.isLoaded = true;
        console.log('[Roastery] onLoad completed successfully');
    }

    spawnGateMarker(gate) {
        // For roasterVideo gate, highlight and show the roasting-beans-transition orb
        if (gate.ref === 'roasterVideo') {
            const hotspotGroup = this.hotspotEntities.find(h => h.hotspotData?.id === 'roasting-beans-transition');
            if (hotspotGroup) {
                hotspotGroup.enabled = true;
                this.highlightedHotspot = hotspotGroup;
                this.highlightStartTime = Date.now();
                // Set initial glow color for highlighted state
                const glowMat = hotspotGroup.glowEntity.render.meshInstances[0].material;
                glowMat.emissive = new pc.Color(1, 0.85, 0.2);
                glowMat.update();
                // Show label
                if (hotspotGroup.labelElement) {
                    hotspotGroup.labelElement.style.display = 'block';
                    this.highlightLabel = hotspotGroup.labelElement;
                }
                console.log('[Roastery] roasterVideo gate reached - roasting-beans-transition orb highlighted');
            }
            return;
        }
        // Otherwise, use the base class implementation
        super.spawnGateMarker(gate);
    }

    onHotspotClick(hotspot, entity) {
        this.activeHotspotEntity = entity;

        if (hotspot.isTransition) {
            if (!this.canTransition()) {
                this.showVoWarning('Please wait for the narration and complete the quiz.');
                return;
            }
            if (!this.isVoFinished && !window.journeyComplete) { this.showVoWarning(); return; }
            if (!this.quizPassed && !window.journeyComplete) {
                this.showVoWarning('Please complete the quiz first.');
                return;
            }
            // Set return visit flag before switching to cafe-interior (only if not in free-roam)
            if (hotspot.targetScene === 'cafe-interior' && !window.journeyComplete) {
                sceneManager.scenes['cafe-interior'].isReturnVisit = true;
            }
            sceneManager.switchTo(hotspot.targetScene, hotspot.spawnPosition || null);
            return;
        }

        if (hotspot.isVideo && hotspot.videoSrc) {
            // Guard against overlap: ignore if video is already pending or VO is playing
            if (this.videoPending) return;
            if (this.voAudio && !this.voAudio.paused) return;

            // If this is the roasterVideo gate marker (roasting-beans-transition), play video and resume sequence
            if (hotspot.isGateMarker && this.voSceneKey === 'roasting') {
                // Unhighlight and hide the gate marker orb
                const glowMat = entity.glowEntity.render.meshInstances[0].material;
                glowMat.emissive = new pc.Color(0, 0, 0);
                glowMat.emissiveIntensity = 0;
                glowMat.update();
                // Clear highlight state and hide label
                this.highlightedHotspot = null;
                if (this.highlightLabel) {
                    this.highlightLabel.style.display = 'none';
                    this.highlightLabel = null;
                }
                // Disable the orb after clicking
                entity.enabled = false;

                this.pauseAmbient();
                this.showVideoPopup(hotspot.videoSrc, {
                    required: false,
                    caption: hotspot.label,
                    volume: 0.15,
                    onFinish: () => {
                        this.resumeAmbient();
                    }
                });

                // Apply fade in/out to popup
                const popup = document.getElementById('video-popup');
                if (popup) {
                    popup.style.transition = 'opacity 0.5s ease-in-out';
                }
                // Resume sequence after video opens
                this.resumeVoSequence();
                return;
            }

            // Normal video hotspot click
            this.pauseAmbient();
            this.showVideoPopup(hotspot.videoSrc, {
                required: false,
                caption: hotspot.label,
                onFinish: () => {
                    this.resumeAmbient();
                }
            });

            // Apply fade in/out to popup
            const popup = document.getElementById('video-popup');
            if (popup) {
                popup.style.transition = 'opacity 0.5s ease-in-out';
            }
            return;
        }

        document.getElementById('hotspot-title').textContent = hotspot.label;
        document.getElementById('hotspot-description').textContent = hotspot.description;
        this.dom.hotspotPopup.classList.add('active');
    }

    onQuizPassed() {
        super.onQuizPassed();
    }

    async onUnload() {
        try {
            document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

            this.detachEventListeners();

            this.keys = { w: false, a: false, s: false, d: false };
            this.isMouseDown = false;

            // Destroy splat entity to free VRAM (not just set to null)
            if (this.splatEntity) {
                this.splatEntity.destroy();
                this.splatEntity = null;
            }

            // Dispose of splat asset
            if (this.splatAsset) {
                app.assets.remove(this.splatAsset);
                this.splatAsset = null;
            }

            this.stopVo();

            this.hotspotEntities.forEach(group => { if (group) { if (group.labelElement) group.labelElement.remove(); group.destroy(); } });
            this.hotspotEntities = [];
            this.activeHotspotEntity = null;

            this.editorBoxes.forEach(b => b.destroy());
            this.editorBoxes = [];
            this.selectedBox = null;

            if (this.debugBoxes) {
                this.debugBoxes.forEach(b => b.destroy());
                this.debugBoxes = [];
            }

            if (this.ambientSource) { try { this.ambientSource.stop(); } catch(e) {} }
            if (this.proximitySource) { try { this.proximitySource.stop(); } catch(e) {} }
            if (this.audioContext) { this.audioContext.close(); }
            this.audioContext = null;
            this.ambientSource = null;
            this.audioLoaded = false;

            // Clear DOM: popups
            if (this.dom.hotspotPopup) {
                this.dom.hotspotPopup.classList.remove('active');
            }
            if (this.dom.videoPopup) {
                this.dom.videoPopup.classList.remove('active');
            }

            // Clear global event listener flags so they can be re-registered on next load
            window._boxCopyBtnInit = false;
            window._debugBoxesToggleInit = false;

            window.ThesisApp.debugLog('Roastery scene unloaded');

            await super.onUnload();
        } catch (error) {
            console.error('Error unloading roastery scene:', error);
        } finally {
            this.isLoaded = false;
        }
    }

    update(deltaTime) {
        if (!this.isLoaded) return;

        // Display camera position — throttled to 10x per second (not every frame)
        const camPos = cameraEntity.getLocalPosition();
        this.coordUpdateTimer += deltaTime;
        if (this.coordUpdateTimer > this.coordUpdateInterval) {
            this.coordUpdateTimer = 0;
            if (this.dom.coordX) this.dom.coordX.textContent = `X: ${camPos.x.toFixed(3)}`;
            if (this.dom.coordY) this.dom.coordY.textContent = `Y: ${camPos.y.toFixed(3)}`;
            if (this.dom.coordZ) this.dom.coordZ.textContent = `Z: ${camPos.z.toFixed(3)}`;
        }

        // Update Blender-style transforms
        this.updateTransform();

        cameraEntity.setEulerAngles(this.eulerAngles.pitch * 180 / Math.PI, this.eulerAngles.yaw * 180 / Math.PI, 0);

        const pulse = Math.sin(Date.now() * 0.003) * 0.5 + 0.5;
        const tripleSpeedPulse = Math.sin(Date.now() * 0.009) * 0.5 + 0.5;
        this.hotspotEntities.forEach(group => {
            if (group === this.highlightedHotspot) {
                const core = group.coreEntity;
                const glow = group.glowEntity;
                const halo = group.haloEntity;
                if (!this._highlightedOnce) { if (window.DEV_MODE) console.log('[Glow] Highlighted hotspot pulse activated'); this._highlightedOnce = true; }
                if (core) {
                    const s = 0.04 + tripleSpeedPulse * 0.02;
                    core.setLocalScale(s, s, s);
                }
                if (glow) {
                    const s = 0.08 + tripleSpeedPulse * 0.04;
                    glow.setLocalScale(s, s, s);
                    glow.render.meshInstances[0].material.opacity = 0.5;
                    // Animate glow intensity
                    const intensityPulse = 1.5 + (Math.sin(Date.now() * 0.005) * 0.5 + 0.5) * 1.5;
                    glow.render.meshInstances[0].material.emissiveIntensity = intensityPulse;
                    glow.render.meshInstances[0].material.update();
                }
                if (halo) {
                    halo.enabled = true;
                    const s = 0.15 + (Math.sin(Date.now() * 0.005 + Math.PI/4) * 0.5 + 0.5) * 0.03;
                    halo.setLocalScale(s, s, s);
                    halo.render.meshInstances[0].material.opacity = 0.25;
                }
            } else {
                const core = group.coreEntity;
                const glow = group.glowEntity;
                if (core) {
                    const s = 0.03 + pulse * 0.01;
                    core.setLocalScale(s, s, s);
                }
                if (glow) {
                    const s = 0.06 + pulse * 0.02;
                    glow.setLocalScale(s, s, s);
                }
            }
        });

        // Update video hotspot visibility when quiz is passed
            // Video hotspots are shown/hidden based on quiz state when created; do not override here

        // Update transition, gate marker, and video hotspot labels (only when actually visible)
        if (!document.body.classList.contains('video-open')) {
            this.hotspotEntities.forEach(group => {
                if (group.labelElement && (group.hotspotData?.isTransition || group.hotspotData?.isGateMarker || group.hotspotData?.isVideo)) {
                    const isGateMarker = group.hotspotData?.isGateMarker;
                    let shouldShow;
                    if (isGateMarker) {
                        shouldShow = group.enabled;
                    } else {
                        shouldShow = this.quizPassed && !window.journeyComplete;
                    }
                    if (shouldShow) {
                        const worldPos = group.getPosition();
                        const screen = this.worldToScreen(worldPos);
                        const camPos = cameraEntity.getPosition();
                        const camFwd = cameraEntity.forward;
                        const toHotspot = new pc.Vec3().sub2(worldPos, camPos);
                        const isBehind = toHotspot.dot(camFwd) <= 0;
                        const isOffScreen = screen.x < 0 || screen.x > window.innerWidth || screen.y < 0 || screen.y > window.innerHeight;
                        const newDisplay = (isOffScreen || isBehind) ? 'none' : 'block';
                        if (group._labelDisplay !== newDisplay) {
                            group.labelElement.style.display = newDisplay;
                            group._labelDisplay = newDisplay;
                        }
                        if (group._labelX !== screen.x) {
                            group.labelElement.style.left = `${screen.x}px`;
                            group._labelX = screen.x;
                        }
                        if (group._labelY !== screen.y) {
                            group.labelElement.style.top = `${screen.y - 50}px`;
                            group._labelY = screen.y;
                        }
                    } else {
                        group.labelElement.style.display = 'none';
                        group._labelDisplay = 'none';
                    }
                }
            });
        }

        if (this.activeHotspotEntity) {
            const popup = this.dom.hotspotPopup;
            if (popup.classList.contains('active')) {
                const worldPos = this.activeHotspotEntity.getPosition();
                const screen = this.worldToScreen(worldPos);
                const isOffScreen = screen.x < -50 || screen.x > window.innerWidth + 50 || screen.y < -50 || screen.y > window.innerHeight + 50;
                if (isOffScreen) { popup.classList.remove('active'); } else { popup.style.left = `${screen.x + 20}px`; popup.style.top = `${screen.y - 60}px`; popup.style.transform = 'none'; }
            } else {
                this.activeHotspotEntity = null;
            }
        }

        const currentPos = cameraEntity.getLocalPosition();
        let targetY = this.floorHeight;

        if (this.isJumping) {
            this.verticalVelocity -= this.gravity * deltaTime;
            targetY = currentPos.y + this.verticalVelocity * deltaTime;
            if (targetY <= this.floorHeight) {
                targetY = this.floorHeight;
                this.isJumping = false;
                this.verticalVelocity = 0;
            }
        }

        // Skip movement if in a transform mode (G/F/R)
        if (!this.transformMode && (this.keys.w || this.keys.a || this.keys.s || this.keys.d)) {
            const cameraTransform = cameraEntity.getWorldTransform();
            const forward = cameraTransform.getZ().scale(-1);
            const right = cameraTransform.getX();
            forward.y = 0;
            right.y = 0;
            forward.normalize();
            right.normalize();
            this._moveDir.set(0, 0, 0);
            if (this.keys.w) this._moveDir.add(forward);
            if (this.keys.s) this._moveDir.sub(forward);
            if (this.keys.d) this._moveDir.add(right);
            if (this.keys.a) this._moveDir.sub(right);
            if (this._moveDir.length() > 0) {
                this._moveDir.normalize();
                const speed = this.moveSpeed * deltaTime;
                this._newPos.copy(currentPos).add(this._moveDir.scale(speed));
                this._newPos.y = targetY;

                if (!this.checkManualCollision(this._newPos)) {
                    cameraEntity.setLocalPosition(this._newPos);
                } else {
                    this._slideA.set(this._newPos.x, targetY, currentPos.z);
                    if (!this.checkManualCollision(this._slideA)) {
                        cameraEntity.setLocalPosition(this._slideA);
                    } else {
                        this._slideB.set(currentPos.x, targetY, this._newPos.z);
                        if (!this.checkManualCollision(this._slideB)) {
                            cameraEntity.setLocalPosition(this._slideB);
                        }
                    }
                }
            }
        } else {
            cameraEntity.setLocalPosition(currentPos.x, targetY, currentPos.z);
        }
    }
}

// Register and create the roastery scene
const roasteryScene = new RoasteryScene();
sceneManager.registerScene('roastery', roasteryScene);
