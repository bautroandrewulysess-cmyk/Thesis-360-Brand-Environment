// ============================================================================
// CAFE INTERIOR SCENE
// ============================================================================
// Loads and renders the cafe interior Gaussian splat with WASD movement
// and click-drag camera control. Uses voxel-based collision detection.
//
// Dependencies (from main.js global scope):
// - app (PlayCanvas Application)
// - cameraEntity (camera entity)
// - sceneManager (scene manager)
// - Scene (base scene class)
// - loadVoxelCollision (from src/voxel-collision.js)

class CafeInteriorScene extends Scene {
    constructor() {
        super('cafe-interior');
        this.splatEntity = null;
        this.splatAsset = null;
        this.isLoaded = false;

        // Mouse position tracking
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDragDistance = 0;
        this.mouseDownX = 0;
        this.mouseDownY = 0;

        // Hotspot system
        this.hotspots = [
            {
                id: 'yfc-board',
                position: new pc.Vec3(-1.230, 1.290, -0.880),
                label: 'YFC Board',
                description: 'Aside from the owners\' passion in bringing the farm to the cup, they bring the same passion in dedicating their time in building a Christ-centered community. For over ten years, they faithfully serve as Chapter 5 coordinators of the Youth for Christ Pangantucan Chapter, dedicating their time in being committed to touching countless lives through consistent providing leadership, service, guidance and support to the municipalities of Kalilangan, Pangantucan, and Wao. Their continued dedication reflects a life of selfless service, inspiring communities to grow in faith, unity, and love for God.'
            },
            {
                id: 'finca-logo',
                position: new pc.Vec3(0.100, 0.990, -0.570),
                label: 'Finca de Garces Logo',
                description: 'This was Finca de Garces\' old logo. Owners decided to renew their branding years later to bring a new face to Finca de Garces while preserving the farm\'s roots.'
            },
            {
                id: 'bar',
                position: new pc.Vec3(0.140, 1.290, -0.660),
                label: 'The Bar',
                description: 'The bar is where specialty coffee is meticulously crafted, served and discussed. Unlike traditional and commercial cafes, this is where the owners showcase the careful process of pouring a cup of specialty coffee while they engage with visitors.'
            },
            {
                id: 'coffee-brewing',
                position: new pc.Vec3(0.140, 1.650, -0.660),
                label: 'Coffee Brewing',
                description: '',
                isVideo: true,
                videoSrc: `${R2_BASE}/brewing.mp4`,
                isTransition: false
            },
            {
                id: 'chill-section',
                position: new pc.Vec3(1.140, 1.060, 0.140),
                label: 'Chill Section',
                description: 'The owners always emphasize creating connections. The chill section is where customers can play with games, cards and indulge in books to create conversation and a relaxing atmosphere whilst enjoying a cup of coffee.'
            },
            {
                id: 'exit-to-exterior',
                position: new pc.Vec3(0.780, 1.500, 1.610),
                label: 'Go Outside',
                description: 'Click to step outside the cafe.',
                isTransition: true,
                get targetScene() { return window.journeyComplete ? 'cafe-exterior' : 'nursery'; },
                spawnPosition: [0, 1.6, 0]
            }
        ];
        this.hotspotEntities = [];
        this.activeHotspotEntity = null;
        this.isVoFinished = false;
        this.voAudio = null;

        // Audio system
        this.audioContext = null;
        this.ambientSource = null;
        this.audioLoaded = false;

        this.isReturnVisit = false;
        this.quizPassed = false;
        this.quiz = {
            question: 'What was the original purpose of opening Alegre Café & Roastery?',
            choices: [
                'To become the largest coffee exporter in the region.',
                'To create a place where people could gather, share stories, and enjoy coffee grown on the family\'s farm.',
                'To sell imported specialty coffee.',
                'To promote tourism in Pangantucan.'
            ],
            correct: 1,
            clue: 'Think about why the family opened the café — it wasn\'t about scale or selling someone else\'s beans.',
            feedback: 'Correct! Alegre Café & Roastery was created as a place where people can connect through coffee while learning the story behind every cup.'
        };

        // Collision boxes traced with the editor tool (position, size, Y rotation in degrees)
        this.collisionBoxes = [
            { name: 'box-0', pos: [-0.020, 0.820, 2.190], size: [1.140, 0.790, 0.490], rotY: -21.0 },
            { name: 'box-1', pos: [0.480, 0.880, 1.950], size: [0.460, 0.480, 0.390], rotY: -23.0 },
            { name: 'box-2', pos: [0.760, 0.950, 0.930], size: [0.490, 0.480, 0.850], rotY: -24.0 },
            { name: 'box-3', pos: [0.440, 0.790, 0.830], size: [0.250, 0.420, 0.490], rotY: -23.0 },
            { name: 'box-4', pos: [-1.560, 0.960, 0.600], size: [0.460, 0.660, 2.070], rotY: -21.5 },
            { name: 'box-5', pos: [-1.060, 0.770, 0.590], size: [0.430, 0.690, 1.940], rotY: -20.0 },
            { name: 'box-6', pos: [-0.750, 0.780, 0.720], size: [0.380, 0.870, 1.470], rotY: -20.5 },
            { name: 'box-7', pos: [-1.160, 0.840, -0.840], size: [0.460, 0.480, 0.420], rotY: -23.0 },
            { name: 'box-8', pos: [-1.300, 1.030, -0.610], size: [0.260, 0.690, 0.210], rotY: -23.0 },
            { name: 'box-9', pos: [-1.060, 1.000, -1.260], size: [0.310, 0.750, 0.330], rotY: -23.0 },
            { name: 'box-10', pos: [-0.340, 0.960, -1.260], size: [0.390, 0.900, 0.240], rotY: -23.0 },
            { name: 'box-11', pos: [-0.220, 1.000, -0.520], size: [0.220, 0.610, 0.180], rotY: -23.0 },
            { name: 'box-12', pos: [0.330, 1.000, -0.270], size: [0.220, 0.610, 0.180], rotY: -23.0 },
            { name: 'box-13', pos: [1.240, 1.000, 0.100], size: [0.210, 0.610, 0.680], rotY: -23.0 },
            { name: 'box-14', pos: [1.380, 1.140, -1.240], size: [0.950, 0.610, 0.280], rotY: -23.0 },
            { name: 'box-15', pos: [0.120, 0.920, -0.620], size: [0.750, 0.610, 0.280], rotY: -20.0 },
            { name: 'box-16', pos: [0.440, 0.800, -0.830], size: [0.250, 0.610, 0.400], rotY: -23.0 },
            { name: 'box-17', pos: [1.570, 0.800, -0.720], size: [0.250, 0.420, 0.630], rotY: -23.0 },
            { name: 'box-18', pos: [1.030, 0.800, -1.110], size: [0.250, 0.400, 0.190], rotY: -23.0 },
            { name: 'wall-1', pos: [-0.930, 1.140, 2.160], size: [2.990, 0.860, 0.050], rotY: -21.0 },
            { name: 'wall-2', pos: [1.170, 1.150, 0.760], size: [0.050, 1.020, 4.650], rotY: -21.0 },
            { name: 'wall-3', pos: [-1.890, 1.150, 0.360], size: [0.050, 1.330, 4.650], rotY: -21.0 },
            { name: 'wall-4', pos: [-0.160, 1.160, -1.440], size: [2.270, 1.340, 0.170], rotY: -23.0 },
            { name: 'box-21', pos: [0.870, 1.070, 0.400], size: [0.090, 0.460, 0.180], rotY: -23.0 },
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
        this.moveSpeed = 0.7; // units per second (walking pace)

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
            yaw: 0,   // Horizontal rotation (Y axis)
            pitch: 0,  // Vertical rotation (X axis)
        };
        this.pitchMin = -Math.PI / 2.5; // ~72° down
        this.pitchMax = Math.PI / 2.5;  // ~72° up

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Store bound methods for later removal
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
            // B key: triple-press toggles editor mode, single-press spawns box in editor mode
            this.onKeyB = (e) => {
                if (e.key !== 'b' && e.key !== 'B') return;

                const now = Date.now();
                this.bPressTimes.push(now);
                this.bPressTimes = this.bPressTimes.filter(t => now - t < 800);

                // Cancel any pending single-press spawn
                if (this.bSpawnTimer) {
                    clearTimeout(this.bSpawnTimer);
                    this.bSpawnTimer = null;
                }

                if (this.bPressTimes.length >= 3) {
                    // Triple press — toggle editor mode
                    this.bPressTimes = [];
                    this.editorMode = !this.editorMode;
                    this.setEditorMode(this.editorMode);
                    return;
                }

                // Single press in editor mode — schedule spawn (cancelled if more presses come)
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

            // Cmd+D (Mac) or Ctrl+D (Windows) duplicates selected box
            this.onKeyDuplicate = (e) => {
                if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
                    e.preventDefault(); // stop browser bookmark dialog
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

        // Ignore clicks on UI panels
        if (event.target.closest('#box-editor') ||
            event.target.closest('#quiz-overlay') ||
            event.target.closest('#hotspot-popup') ||
            event.target.closest('#video-popup')) {
            return;
        }

        if (event.button === 0) { // Left mouse button only
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

        // Update rotation based on mouse delta
        this.eulerAngles.yaw -= deltaX * this.mouseSensitivity;
        this.eulerAngles.pitch -= deltaY * this.mouseSensitivity;

        // Clamp pitch to prevent camera from flipping
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

            // Inverse rotate the point by the box's Y rotation
            // PlayCanvas Y rotation is counterclockwise looking down -Y
            const rot = box.rotY * Math.PI / 180;
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);

            // Correct inverse rotation (rotate point by -rotY)
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

        // Make clickable
        this.registerInteractiveObject(boxEntity, () => {
            this.selectEditorBox(boxEntity);
        });

        // Auto-select on spawn
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

        // Same size and rotation, offset position slightly so it's visible
        boxEntity.setLocalPosition(srcPos.x + 0.3, srcPos.y, srcPos.z + 0.3);
        boxEntity.setLocalScale(srcScale.x, srcScale.y, srcScale.z);
        boxEntity.setLocalEulerAngles(0, rotY, 0);

        app.root.addChild(boxEntity);
        this.editorBoxes.push(boxEntity);

        this.registerInteractiveObject(boxEntity, () => {
            this.selectEditorBox(boxEntity);
        });

        // Auto-select the duplicate
        this.selectEditorBox(boxEntity);
    }

    selectEditorBox(boxEntity) {
        this.selectedBox = boxEntity;
        document.getElementById('box-editor')?.classList.add('active');
        document.getElementById('box-editor-title').textContent = boxEntity.name;

        // Selected box glows orange, unselected boxes stay red
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
        // Red editor boxes
        this.editorBoxes.forEach(b => b.enabled = on);
        // Blue debug collision boxes
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
            const el = document.getElementById(id);
            if (el) el.value = value;
            const elNum = document.getElementById(id + '-num');
            if (elNum) elNum.value = parseFloat(value).toFixed(2);
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

        document.getElementById('box-delete-btn')?.addEventListener('click', () => {
            if (this.selectedBox) {
                this.editorBoxes = this.editorBoxes.filter(b => b !== this.selectedBox);
                this.unregisterInteractiveObject(this.selectedBox);
                this.selectedBox.destroy();
                this.selectedBox = null;
                document.getElementById('box-editor')?.classList.remove('active');
            }
        });

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

        // Register debug-boxes-toggle button ONCE globally (not per scene)
        if (!window._debugBoxesToggleInit) {
            window._debugBoxesToggleInit = true;
            document.getElementById('debug-boxes-toggle')?.addEventListener('click', () => {
                const scene = sceneManager.getActiveScene();
                if (scene && scene.debugBoxes && scene.debugBoxes.length > 0) {
                    const newState = !scene.debugBoxes[0].enabled;
                    scene.debugBoxes.forEach(b => b.enabled = newState);
                    if (window.DEV_MODE) console.log('Debug boxes:', newState ? 'visible' : 'hidden');
                }
            });
        }
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


    createHotspots() {
        document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

        this.hotspots.forEach(hotspot => {
            // Create hotspot group
            const group = new pc.Entity(`hotspot-${hotspot.id}`);
            group.setLocalPosition(hotspot.position);
            this.container.addChild(group);

            // Inner core sphere (bright, small)
            const core = new pc.Entity(`hotspot-core-${hotspot.id}`);
            core.addComponent('render', { type: 'sphere' });
            core.setLocalScale(0.06, 0.06, 0.06);

            const coreMaterial = new pc.StandardMaterial();
            const isTransition = hotspot.isTransition;
            coreMaterial.emissive = isTransition ? new pc.Color(1, 0.9, 0.3) : new pc.Color(0.2, 0.8, 1);
            coreMaterial.emissiveIntensity = 6;
            coreMaterial.opacity = 1.0;
            coreMaterial.blendType = pc.BLEND_NORMAL;
            coreMaterial.update();
            core.render.meshInstances[0].material = coreMaterial;
            group.addChild(core);

            // Outer glow sphere (larger, transparent, soft edge)
            const glow = new pc.Entity(`hotspot-glow-${hotspot.id}`);
            glow.addComponent('render', { type: 'sphere' });
            glow.setLocalScale(0.14, 0.14, 0.14);

            const glowMaterial = new pc.StandardMaterial();
            glowMaterial.emissive = isTransition ? new pc.Color(1, 0.8, 0.1) : new pc.Color(0.1, 0.6, 1);
            glowMaterial.emissiveIntensity = 0.8;
            glowMaterial.opacity = 0.4;
            glowMaterial.blendType = pc.BLEND_ADDITIVE;
            glowMaterial.depthWrite = false;
            glowMaterial.cull = pc.CULLFACE_NONE;
            glowMaterial.update();
            glow.render.meshInstances[0].material = glowMaterial;
            group.addChild(glow);

            // Outer halo sphere (for highlighted hotspots only, added dynamically)
            const halo = new pc.Entity(`hotspot-halo-${hotspot.id}`);
            halo.addComponent('render', { type: 'sphere' });
            halo.setLocalScale(0.45, 0.45, 0.45);
            const haleMaterial = new pc.StandardMaterial();
            haleMaterial.emissive = new pc.Color(1, 0.85, 0.2);
            haleMaterial.emissiveIntensity = 0.5;
            haleMaterial.opacity = 0.12;
            haleMaterial.blendType = pc.BLEND_ADDITIVE;
            haleMaterial.depthWrite = false;
            haleMaterial.cull = pc.CULLFACE_NONE;
            haleMaterial.update();
            halo.render.meshInstances[0].material = haleMaterial;
            halo.enabled = false;
            group.addChild(halo);
            group.haloEntity = halo;

            // Store group entity for raycasting and animation
            group.hotspotData = hotspot;
            group.coreEntity = core;
            group.glowEntity = glow;
            this.hotspotEntities.push(group);

            // Visibility: hide video hotspots until quiz is passed
            if (hotspot.isVideo) {
                group.enabled = this.quizPassed;
            }

            // Register group with raycaster
            this.registerInteractiveObject(group, () => {
                this.onHotspotClick(hotspot, group);
            });

            // Create label for transition hotspots and video hotspots
            if (hotspot.isTransition || hotspot.isVideo) {
                const label = document.createElement('div');
                label.className = 'hotspot-label';
                label.textContent = hotspot.label;
                label.style.cssText = `position:fixed; pointer-events:none; z-index:5000; color:#f4f4f4; font-family:'Inter',sans-serif; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.5px; background:rgba(0,0,0,0.6); padding:6px 12px; border-radius:4px; border:1px solid rgba(244,208,63,0.4); display:none;`;
                document.body.appendChild(label);
                group.labelElement = label;
            }
        });
    }

    getNavPromptText() {
        return this.isReturnVisit ? null : 'Follow the glowing marker to the nursery';
    }

    onQuizPassed() {
        super.onQuizPassed();
        if (this.isReturnVisit) {
            this.hideNavPrompt();
            this.showCompletionPanel('Coffee Journey Complete', window.PendingQuizzes.finalChallenge.feedback, 'https://forms.gle/UmT9jCX7bCieUKDW9');
        }
    }

    onVoFinished_brandStory() {
        this.showVideoPopup(`${R2_BASE}/ownerInterview.mp4`, {
            required: true,
            caption: 'Hear it from the owners',
            onFinish: () => {
                setTimeout(() => {
                    this.showQuiz(this.quiz, () => {
                        this.onQuizPassed();
                    });
                }, 1000);
            }
        });
    }

    onHotspotClick(hotspot, entity) {
        this.activeHotspotEntity = entity;

        if (hotspot.isTransition) {
            if (!this.canTransition()) {
                this.showVoWarning('Please wait for the narration and complete the quiz.');
                return;
            }
            if (hotspot.targetScene === 'nursery' && !this.quizPassed && !window.journeyComplete) {
                this.showVoWarning('Please complete the quiz first.');
                return;
            }
            if (this.isReturnVisit && !window.journeyComplete) {
                return;
            }
            sceneManager.switchTo(hotspot.targetScene, hotspot.spawnPosition || null);
            return;
        }

        if (hotspot.isVideo && hotspot.videoSrc) {
            // Guard against overlap: ignore if video is already pending or VO is playing
            if (this.videoPending) return;
            if (this.voAudio && !this.voAudio.paused) return;

            // Pause ambient, play video with fade in/out
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

        const hotspotTitle = document.getElementById('hotspot-title');
        const hotspotDescription = document.getElementById('hotspot-description');
        if (hotspotTitle) hotspotTitle.textContent = hotspot.label;
        if (hotspotDescription) hotspotDescription.textContent = hotspot.description;
        if (this.dom.hotspotPopup) this.dom.hotspotPopup.classList.add('active');
    }


    async onLoad() {
        await super.onLoad();

        if (this.isLoaded) return;

        try {
            document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

            window.ThesisApp.debugLog('Loading cafe interior splat...');

            // Check if splat was preloaded
            if (window._preloadedSplats && window._preloadedSplats['cafe-interior-splat']) {
                this.splatAsset = window._preloadedSplats['cafe-interior-splat'];
                console.warn('[CafeInterior] Using preloaded splat');
            } else {
                // Create and load Gaussian splat asset
                this.splatAsset = new pc.Asset('cafe-interior-splat', 'gsplat', {
                    url: `${R2_BASE}/thesisCafeInterior.sog`
                });

                app.assets.add(this.splatAsset);
                app.assets.load(this.splatAsset);
            }

            // Wait for asset to load
            await new Promise((resolve) => {
                this.splatAsset.ready(() => {
                    // Create entity for the splat
                    this.splatEntity = new pc.Entity('cafe-interior-splat');
                    this.splatEntity.addComponent('gsplat', { asset: this.splatAsset });

                    // Rotate 180 degrees on Z axis to correct upside-down orientation
                    this.splatEntity.setEulerAngles(0, 0, 180);

                    // Move splat up by 1.3 units
                    this.splatEntity.setLocalPosition(0, 1.3, 0);

                    // Add to scene container
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
                quizOverlay: document.getElementById('quiz-overlay'),
                quizCurrent: document.getElementById('quiz-current'),
                quizQuestion: document.getElementById('quiz-question'),
                quizFeedback: document.getElementById('quiz-feedback'),
                quizChoices: document.getElementById('quiz-choices'),
                videoPopup: document.getElementById('video-popup'),
                popupVideo: document.getElementById('popup-video')
            };

            // Setup collision box editor listeners
            this.setupEditorPanelListeners();

            // Reset quiz for this load
            this.quizPassed = false;

            // Start ambient early so it's playing before VO begins
            this.initAmbient(assetUrl('Music/cafeJazz.mp3'), 0.1);

            // Branch on return visit
            this.isVoFinished = false;
            if (this.isReturnVisit) {
                this.quiz = [window.PendingQuizzes.backToTheCafe, window.PendingQuizzes.finalChallenge];
                // Delay VO by ~1s to let ambient establish atmosphere
                setTimeout(() => this.playVoWithSubtitles('backToTheCafe'), 1000);
            } else {
                setTimeout(() => this.playVoWithSubtitles('brandStory'), 1000);
                if (!window.journeyComplete) {
                    this.preloadSplat(`${R2_BASE}/thesisNursery.sog`, 'nursery-splat');
                }
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

            const fallbackAudioStart = () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().catch(() => {});
                }
                window.removeEventListener('keydown', fallbackAudioStart);
                window.removeEventListener('click', fallbackAudioStart);
            };
            window.addEventListener('keydown', fallbackAudioStart);
            window.addEventListener('click', fallbackAudioStart);

            // Attach event listeners for this scene
            this.attachEventListeners();

            // Reset camera position and rotation
            // Start inside the voxel grid — Z must be > 0.2 in voxel space = > 0.2 in world space
            cameraEntity.setLocalPosition(0, 1.6, 0.9);
            this.eulerAngles.yaw = 0;
            this.eulerAngles.pitch = 0;

            window.ThesisApp.debugLog('Cafe Interior scene loaded successfully');
        } catch (error) {
            console.error('Failed to load cafe interior scene:', error);
            this.isLoaded = false;
            throw error;
        }
        this.isLoaded = true;
    }

    async onUnload() {
        try {
            document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

            // Detach event listeners
            this.detachEventListeners();

            // Reset key states
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

            // Destroy hotspot entities and labels
            this.hotspotEntities.forEach(group => { if (group) { if (group.labelElement) group.labelElement.remove(); group.destroy(); } });
            this.hotspotEntities = [];
            this.activeHotspotEntity = null;

            // Destroy editor boxes
            this.editorBoxes.forEach(b => b.destroy());
            this.editorBoxes = [];
            this.selectedBox = null;

            // Destroy debug collision boxes
            if (this.debugBoxes) {
                this.debugBoxes.forEach(b => b.destroy());
                this.debugBoxes = [];
            }

            // Clear DOM leak: clean up quiz overlay and quiz-choices children
            if (this.dom.quizChoices) {
                this.dom.quizChoices.innerHTML = '';
            }
            if (this.dom.quizOverlay) {
                this.dom.quizOverlay.classList.remove('active');
            }
            if (this.dom.hotspotPopup) {
                this.dom.hotspotPopup.classList.remove('active');
            }
            if (this.dom.videoPopup) {
                this.dom.videoPopup.classList.remove('active');
            }

            // Clear global event listener flags so they can be re-registered on next load
            window._boxCopyBtnInit = false;
            window._debugBoxesToggleInit = false;

            // Clean up audio
            if (this.ambientSource) { try { this.ambientSource.stop(); } catch(e) {} }
            if (this.audioContext) { this.audioContext.close(); }
            this.audioContext = null;
            this.ambientSource = null;
            this.audioLoaded = false;

            window.ThesisApp.debugLog('Cafe Interior scene unloaded');

            await super.onUnload();
        } catch (error) {
            console.error('Error unloading cafe interior scene:', error);
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

        // Apply camera rotation (YXZ order for FPS-style camera)
        cameraEntity.setEulerAngles(this.eulerAngles.pitch * 180 / Math.PI, this.eulerAngles.yaw * 180 / Math.PI, 0);

        // Animate hotspot pulse (scale only, no material updates)
        const pulse = Math.sin(Date.now() * 0.003) * 0.5 + 0.5;
        const tripleSpeedPulse = Math.sin(Date.now() * 0.009) * 0.5 + 0.5;
        this.hotspotEntities.forEach(group => {
            if (group === this.highlightedHotspot) {
                // Tripled pulse rate for highlighted hotspot
                const core = group.coreEntity;
                const glow = group.glowEntity;
                const halo = group.haloEntity;
                if (!this._highlightedOnce) { if (window.DEV_MODE) console.log('[Glow] Highlighted hotspot pulse activated'); this._highlightedOnce = true; }
                if (core) {
                    const s = 0.12 + tripleSpeedPulse * 0.06;
                    core.setLocalScale(s, s, s);
                }
                if (glow) {
                    const s = 0.30 + tripleSpeedPulse * 0.12;
                    glow.setLocalScale(s, s, s);
                    glow.render.meshInstances[0].material.opacity = 0.5;
                }
                if (halo) {
                    halo.enabled = true;
                    const s = 0.45 + (Math.sin(Date.now() * 0.005 + Math.PI/4) * 0.5 + 0.5) * 0.08;
                    halo.setLocalScale(s, s, s);
                    halo.render.meshInstances[0].material.opacity = 0.25;
                }
            } else {
                // Normal pulse for regular hotspots
                const core = group.coreEntity;
                const glow = group.glowEntity;
                if (core) {
                    const s = 0.05 + pulse * 0.02;
                    core.setLocalScale(s, s, s);
                }
                if (glow) {
                    const s = 0.12 + pulse * 0.04;
                    glow.setLocalScale(s, s, s);
                }
            }
        });

        // Update video hotspot visibility when quiz is passed
        this.hotspotEntities.forEach(group => {
            if (group.hotspotData?.isVideo) {
                group.enabled = this.quizPassed;
            }
        });

        // Update transition and video hotspot labels (only when actually visible)
        const shouldShowLabels = this.quizPassed && !window.journeyComplete;
        if (shouldShowLabels) {
            this.hotspotEntities.forEach(group => {
                if (group.labelElement && (group.hotspotData?.isTransition || group.hotspotData?.isVideo)) {
                    const worldPos = group.getPosition();
                    const screen = this.worldToScreen(worldPos);
                    const isOffScreen = screen.x < 0 || screen.x > window.innerWidth || screen.y < 0 || screen.y > window.innerHeight;
                    const newDisplay = isOffScreen ? 'none' : 'block';
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
                }
            });
        } else if (this.hotspotEntities.some(g => g.labelElement && g._labelDisplay !== 'none')) {
            this.hotspotEntities.forEach(group => {
                if (group.labelElement && group._labelDisplay !== 'none') {
                    group.labelElement.style.display = 'none';
                    group._labelDisplay = 'none';
                }
            });
        }

        // Anchor popup to hotspot marker and hide if off-screen
        if (this.activeHotspotEntity) {
            const popup = this.dom.hotspotPopup;
            if (popup && popup.classList.contains('active')) {
                const worldPos = this.activeHotspotEntity.getPosition();
                const screen = this.worldToScreen(worldPos);
                const isOffScreen = screen.x < -50 || screen.x > window.innerWidth + 50 || screen.y < -50 || screen.y > window.innerHeight + 50;
                if (isOffScreen) { popup.classList.remove('active'); } else { popup.style.left = `${screen.x + 20}px`; popup.style.top = `${screen.y - 60}px`; popup.style.transform = 'none'; }
            } else {
                // Popup was closed — clear entity reference
                this.activeHotspotEntity = null;
            }
        }

        // Update Blender-style transforms
        this.updateTransform();

        // === JUMP PHYSICS — runs every frame regardless of WASD ===
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

        // === WASD MOVEMENT ===
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
            // Not moving — still apply jump Y
            cameraEntity.setLocalPosition(currentPos.x, targetY, currentPos.z);
        }
    }
}

// Register and create the cafe interior scene
const cafeInteriorScene = new CafeInteriorScene();
sceneManager.registerScene('cafe-interior', cafeInteriorScene);
