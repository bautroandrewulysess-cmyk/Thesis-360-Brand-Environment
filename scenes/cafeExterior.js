// ============================================================================
// CAFE EXTERIOR SCENE
// ============================================================================
// Loads and renders the cafe exterior Gaussian splat with WASD movement
// and click-drag camera control. Uses manual OBB collision detection.
//
// Dependencies (from main.js global scope):
// - app (PlayCanvas Application)
// - cameraEntity (camera entity)
// - sceneManager (scene manager)
// - Scene (base scene class)

class CafeExteriorScene extends Scene {
    constructor() {
        super('cafe-exterior');
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
                id: 'enter-interior',
                position: new pc.Vec3(0, 1.6, 1.0),
                label: 'Enter Cafe',
                description: 'Click to go inside.',
                isTransition: true,
                targetScene: 'cafe-interior'
            },
            {
                id: 'to-roastery',
                position: new pc.Vec3(-3.42, 1.14, 5.26),
                label: 'Enter the Roastery',
                description: 'Step inside and see where the coffee is roasted.',
                isTransition: true,
                targetScene: 'roastery',
                spawnPosition: [-0.7, 1.6, 0.8]
            },
            {
                id: 'to-nursery',
                position: new pc.Vec3(-2.374, 1.600, -1.254),
                label: 'Enter the Nursery',
                description: 'Visit the coffee seedling nursery.',
                isTransition: true,
                targetScene: 'nursery',
                spawnPosition: [0, 1.6, 0]
            },
            {
                id: 'walk-to-farm',
                position: new pc.Vec3(-2.0, 1.6, -1.4),
                label: 'Walk to the Farm',
                description: 'Take the path from the cafe to the coffee farm.',
                isTransition: true,
                targetScene: 'street-view'
            }
        ];
        this.hotspotEntities = [];
        this.activeHotspotEntity = null;

        // Audio system (skipped for now)
        this.audioContext = null;
        this.ambientSource = null;
        this.audioLoaded = false;

        this.quizPassed = false;

        // Collision boxes traced with the editor tool (exported from editor, complete state)
        this.collisionBoxes = [
            { name: 'ext-box-1',  pos: [-2.679, 1.090, 4.330], size: [0.015, 0.953, 11.502], rotY: -35.7 },
            { name: 'ext-box-2',  pos: [-4.063, 1.100, 2.228], size: [0.054, 1.028, 3.254], rotY: -27.5 },
            { name: 'ext-box-3',  pos: [-4.720, 0.895, 4.193], size: [2.991, 0.825, 1.625], rotY: -52.5 },
            { name: 'ext-box-4',  pos: [-2.706, 0.850, -0.669], size: [0.257, 0.257, 0.921], rotY: 10.0 },
            { name: 'ext-box-5',  pos: [-1.700, 0.765, -1.290], size: [1.465, 0.430, 0.122], rotY: -23.0 },
            { name: 'ext-box-6',  pos: [-2.472, 0.850, -0.006], size: [0.049, 0.269, 0.710], rotY: -1.3 },
            { name: 'ext-box-7',  pos: [0.376, 0.775, -0.311], size: [0.224, 0.257, 0.810], rotY: -32.5 },
            { name: 'ext-box-8',  pos: [0.871, 0.715, -0.436], size: [0.303, 0.257, 0.282], rotY: -32.5 },
            { name: 'ext-box-9',  pos: [-0.820, 0.765, -1.435], size: [0.764, 0.430, 0.131], rotY: -122.5 },
            { name: 'ext-box-10', pos: [3.066, 1.020, -2.947], size: [4.964, 0.855, 0.011], rotY: -3.4 },
            { name: 'ext-box-11', pos: [4.431, 1.020, -2.647], size: [2.891, 0.855, 0.011], rotY: -39.4 },
            { name: 'ext-box-12', pos: [-0.142, 1.075, -2.104], size: [0.764, 0.050, 0.389], rotY: -46.3 },
            { name: 'ext-box-13', pos: [1.488, 1.075, -2.784], size: [0.764, 0.050, 0.389], rotY: -92.5 },
            { name: 'ext-box-14', pos: [2.563, 1.075, -2.704], size: [0.764, 0.050, 0.389], rotY: -92.5 },
            { name: 'ext-box-15', pos: [3.683, 1.075, -2.639], size: [0.764, 0.050, 0.389], rotY: -92.5 },
            { name: 'ext-box-16', pos: [-0.302, 1.075, -1.804], size: [0.204, 0.012, 0.234], rotY: -50.8 },
            { name: 'ext-box-17', pos: [-0.802, 1.075, -1.864], size: [0.204, 0.012, 0.234], rotY: -50.8 },
            { name: 'ext-box-18', pos: [1.908, 0.910, -2.784], size: [0.204, 0.012, 0.234], rotY: -4.0 },
            { name: 'ext-box-19', pos: [2.303, 1.045, -2.729], size: [0.204, 0.012, 0.234], rotY: -4.0 },
            { name: 'ext-box-20', pos: [2.923, 1.045, -2.744], size: [0.204, 0.012, 0.234], rotY: -4.0 },
            { name: 'ext-box-21', pos: [3.453, 1.045, -2.769], size: [0.204, 0.012, 0.234], rotY: -4.0 },
            { name: 'ext-box-22', pos: [3.418, 1.045, -2.359], size: [0.214, 0.013, 0.245], rotY: -4.0 },
            { name: 'ext-box-23', pos: [3.958, 1.045, -2.659], size: [0.214, 0.013, 0.245], rotY: -4.0 },
            { name: 'ext-box-24', pos: [1.283, 1.045, -1.224], size: [0.070, 0.010, 0.079], rotY: 23.0 },
            { name: 'ext-box-25', pos: [1.288, 0.565, -1.219], size: [0.254, 0.037, 0.290], rotY: 23.0 },
            { name: 'ext-box-26', pos: [2.828, 0.590, -0.779], size: [0.254, 0.037, 0.290], rotY: -39.5 },
            { name: 'ext-box-27', pos: [2.813, 1.045, -0.809], size: [0.070, 0.010, 0.079], rotY: 23.0 },
            { name: 'ext-box-28', pos: [2.498, 0.910, -1.914], size: [0.560, 0.012, 0.234], rotY: -4.0 },
            { name: 'ext-box-29', pos: [3.983, 0.655, -1.139], size: [0.123, 0.018, 0.140], rotY: -39.5 },
            { name: 'ext-box-30', pos: [4.283, 0.655, -0.839], size: [0.123, 0.018, 0.140], rotY: -39.5 },
            { name: 'ext-box-31', pos: [3.538, 0.710, 0.036], size: [0.315, 0.045, 0.360], rotY: -39.5 },
            { name: 'ext-box-32', pos: [3.348, 0.695, 0.336], size: [0.245, 0.035, 0.280], rotY: -39.5 },
            { name: 'ext-box-33', pos: [3.633, 0.685, -0.269], size: [0.141, 0.020, 0.162], rotY: -39.5 },
            { name: 'ext-box-34', pos: [4.268, 0.910, -0.259], size: [3.738, 0.232, 0.489], rotY: 56.0 },
            { name: 'ext-box-35', pos: [2.133, 1.005, 0.597], size: [3.440, 0.855, 0.011], rotY: -32.4 },
            { name: 'ext-box-36', pos: [-1.735, 0.895, 2.375], size: [0.294, 0.212, 3.742], rotY: -35.8 },
            { name: 'ext-box-37', pos: [-2.787, 0.655, 0.897], size: [0.268, 0.307, 0.330], rotY: 35.0 },
            { name: 'ext-box-38', pos: [-2.932, 0.850, 0.400], size: [0.357, 0.357, 1.278], rotY: -33.3 },
            { name: 'ext-box-39', pos: [-2.374, 1.020, -1.327], size: [1.697, 0.855, 0.011], rotY: 40.2 },
            { name: 'ext-box-40', pos: [1.113, 1.045, -2.859], size: [0.204, 0.012, 0.234], rotY: -10.8 },
            { name: 'ext-box-41', pos: [0.723, 0.745, -2.274], size: [0.245, 0.014, 0.282], rotY: -10.8 },
            { name: 'ext-box-42', pos: [0.633, 0.745, -1.979], size: [0.120, 0.010, 0.137], rotY: -10.8 },
            { name: 'ext-box-43', pos: [0.703, 0.745, -2.844], size: [0.170, 0.014, 0.195], rotY: -10.8 },
            { name: 'ext-box-44', pos: [4.028, 0.910, -1.519], size: [1.103, 0.023, 0.489], rotY: -25.0 },
            { name: 'ext-box-45', pos: [-3.945, 0.715, 3.375], size: [1.290, 0.272, 0.981], rotY: -38.5 },
            { name: 'ext-box-46', pos: [-0.275, 1.140, -2.445], size: [2.948, 0.725, 0.056], rotY: 39.3 },
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
        if (deleteBtn && !deleteBtn.classList.contains('exterior-bound')) {
            deleteBtn.classList.add('exterior-bound');
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
        if (!this.container || this.container._destroyed) return; // Prevent zombie callbacks

        document.querySelectorAll('.hotspot-label').forEach(el => el.remove());
        this.hotspotEntities.forEach(group => { if (group?.labelElement) group.labelElement.remove(); });
        this.hotspotEntities = [];

        this.hotspots.forEach(hotspot => {
            const group = new pc.Entity(`hotspot-${hotspot.id}`);
            group.setLocalPosition(hotspot.position);
            this.container.addChild(group);

            const core = new pc.Entity(`hotspot-core-${hotspot.id}`);
            core.addComponent('render', { type: 'sphere' });
            core.setLocalScale(0.04, 0.04, 0.04);

            const coreMaterial = new pc.StandardMaterial();
            const isTransition = hotspot.isTransition;
            let coreColor;
            if (isTransition) {
                coreColor = new pc.Color(1, 0.55, 0); // warm amber-gold
            } else {
                coreColor = new pc.Color(0, 0.65, 1); // strong cyan-azure
            }
            coreMaterial.diffuse = coreColor;
            coreMaterial.emissive = new pc.Color(0, 0, 0);
            coreMaterial.emissiveIntensity = 0;
            coreMaterial.opacity = 1.0;
            coreMaterial.blendType = pc.BLEND_NORMAL;
            coreMaterial.update();
            core.render.meshInstances[0].material = coreMaterial;
            group.addChild(core);

            const glow = new pc.Entity(`hotspot-glow-${hotspot.id}`);
            glow.addComponent('render', { type: 'sphere' });
            glow.setLocalScale(0.08, 0.08, 0.08);

            const glowMaterial = new pc.StandardMaterial();
            let glowColor;
            let glowIntensity;
            if (isTransition) {
                glowColor = new pc.Color(1, 0.55, 0); // warm amber-gold
                glowIntensity = 2.8;
            } else {
                glowColor = coreColor; // match core color (strong cyan-azure)
                glowIntensity = 1.0;
            }
            glowMaterial.emissive = glowColor;
            glowMaterial.emissiveIntensity = glowIntensity;
            glowMaterial.opacity = 0.4;
            glowMaterial.blendType = pc.BLEND_NORMAL;
            glowMaterial.depthWrite = false;
            glowMaterial.cull = pc.CULLFACE_NONE;
            glowMaterial.update();
            glow.render.meshInstances[0].material = glowMaterial;
            group.addChild(glow);

            // Concentric rings for transition hotspots
            if (isTransition) {
                const ring1 = new pc.Entity(`hotspot-ring1-${hotspot.id}`);
                ring1.addComponent('render', { type: 'sphere' });
                ring1.setLocalScale(0.12, 0.12, 0.12);
                const ring1Material = new pc.StandardMaterial();
                ring1Material.emissive = glowColor;
                ring1Material.emissiveIntensity = 1.2;
                ring1Material.opacity = 0.3;
                ring1Material.blendType = pc.BLEND_NORMAL;
                ring1Material.depthWrite = false;
                ring1Material.cull = pc.CULLFACE_NONE;
                ring1Material.update();
                ring1.render.meshInstances[0].material = ring1Material;
                group.addChild(ring1);
                group.ring1Entity = ring1;

                const ring2 = new pc.Entity(`hotspot-ring2-${hotspot.id}`);
                ring2.addComponent('render', { type: 'sphere' });
                ring2.setLocalScale(0.15, 0.15, 0.15);
                const ring2Material = new pc.StandardMaterial();
                ring2Material.emissive = glowColor;
                ring2Material.emissiveIntensity = 0.8;
                ring2Material.opacity = 0.2;
                ring2Material.blendType = pc.BLEND_NORMAL;
                ring2Material.depthWrite = false;
                ring2Material.cull = pc.CULLFACE_NONE;
                ring2Material.update();
                ring2.render.meshInstances[0].material = ring2Material;
                group.addChild(ring2);
                group.ring2Entity = ring2;
            }

            const halo = new pc.Entity(`hotspot-halo-${hotspot.id}`);
            halo.addComponent('render', { type: 'sphere' });
            halo.setLocalScale(0.15, 0.15, 0.15);
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
            this.hotspotEntities.push(group);

            this.registerInteractiveObject(group, () => {
                this.onHotspotClick(hotspot, group);
            });
        });
    }

    onHotspotClick(hotspot, entity) {
        this.activeHotspotEntity = entity;

        if (hotspot.isTransition) {
            if (!this.canTransition()) {
                this.showVoWarning('Please wait for the narration and complete the quiz.');
                return;
            }
            sceneManager.switchTo(hotspot.targetScene, hotspot.spawnPosition || null);
            return;
        }

        if (hotspot.type === 'video' && hotspot.videoSrc) {
            this.dom.popupVideo.src = hotspot.videoSrc;
            this.dom.popupVideo.play();
            this.dom.videoPopup.classList.add('active');
        } else {
            document.getElementById('hotspot-title').textContent = hotspot.label;
            document.getElementById('hotspot-description').textContent = hotspot.description;
            this.dom.hotspotPopup.classList.add('active');
        }
    }


    async onLoad() {
        await super.onLoad();

        if (this.isLoaded) return;

        try {
            document.querySelectorAll('.hotspot-label').forEach(el => el.remove());

            window.ThesisApp.debugLog('Loading cafe exterior splat...');

            // Check if splat was preloaded
            if (window._preloadedSplats && window._preloadedSplats['cafe-exterior-splat']) {
                this.splatAsset = window._preloadedSplats['cafe-exterior-splat'];
                console.warn('[CafeExterior] Using preloaded splat');
            } else {
                this.splatAsset = new pc.Asset('cafe-exterior-splat', 'gsplat', {
                    url: `${R2_BASE}/thesisCafeExterior_optimized.sog`
                });

                app.assets.add(this.splatAsset);
                app.assets.load(this.splatAsset);
            }

            await new Promise((resolve) => {
                this.splatAsset.ready(() => {
                    this.splatEntity = new pc.Entity('cafe-exterior-splat');
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

            this.initAmbient(assetUrl('Music/cafeExteriorAmbienceSound.mp3'), 0.5);

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
            cameraEntity.setLocalPosition(-0.306, 1.6, 0.389);
            this.eulerAngles.yaw = 0;
            this.eulerAngles.pitch = 0;

            window.ThesisApp.debugLog('Cafe Exterior scene loaded successfully');
        } catch (error) {
            console.error('Failed to load cafe exterior scene:', error);
            this.isLoaded = false;
            throw error;
        }
        this.isLoaded = true;
    }

    async onUnload() {
        try {
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

            // Destroy hotspot entities and labels
            this.hotspotEntities.forEach(group => { if (group) { if (group.labelElement) group.labelElement.remove(); this.unregisterInteractiveObject(group); group.destroy(); } });
            this.hotspotEntities = [];
            this.activeHotspotEntity = null;

            this.editorBoxes.forEach(b => b.destroy());
            this.editorBoxes = [];
            this.selectedBox = null;

            if (this.debugBoxes) {
                this.debugBoxes.forEach(b => b.destroy());
                this.debugBoxes = [];
            }

            this.stopAmbient();

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

            window.ThesisApp.debugLog('Cafe Exterior scene unloaded');

            await super.onUnload();
        } catch (error) {
            console.error('Error unloading cafe exterior scene:', error);
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

        // Update transition hotspot labels (Item 4 & 5: direction-aware clues + pulsing)
        if (!document.body.classList.contains('video-open')) {
            this.hotspotEntities.forEach(group => {
                if (group.labelElement && group.hotspotData?.isTransition) {
                    const worldPos = group.getPosition();
                    const screen = this.worldToScreen(worldPos);
                    const camPos = cameraEntity.getPosition();
                    const camFwd = cameraEntity.forward;
                    const toHotspot = new pc.Vec3().sub2(worldPos, camPos);
                    const isBehind = toHotspot.dot(camFwd) <= 0;
                    const isOffScreen = screen.x < 0 || screen.x > window.innerWidth || screen.y < 0 || screen.y > window.innerHeight;
                    const newDisplay = isBehind || isOffScreen ? 'none' : 'block';
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

                    // Item 4: Direction-aware clue (throttled to ~4 Hz)
                    this.directionClueTimer = (this.directionClueTimer || 0) + deltaTime;
                    if (this.directionClueTimer >= 0.25) {
                        this.directionClueTimer = 0;
                        const toHotspotNorm = toHotspot.normalize();
                        const angle = Math.acos(Math.max(-1, Math.min(1, camFwd.dot(toHotspotNorm))));
                        const crossRight = camFwd.cross(toHotspotNorm);
                        const rightDot = cameraEntity.right.dot(crossRight);
                        let directionClue;
                        if (angle < Math.PI / 6) {
                            directionClue = "It's right in front of you";
                        } else if (angle < Math.PI / 2.5) {
                            directionClue = rightDot > 0 ? "Look to your right" : "Look to your left";
                        } else if (angle < Math.PI / 1.5) {
                            directionClue = rightDot > 0 ? "It's to your right" : "It's to your left";
                        } else {
                            directionClue = "Turn around — it's behind you";
                        }
                        group._directionClue = directionClue;
                    }
                    const displayText = group._directionClue || group.hotspotData.label;
                    if (group.labelElement.textContent !== displayText) {
                        group.labelElement.textContent = displayText;
                    }

                    // Item 5: Pulse emissive on transition hotspots with out-of-phase rings
                    if (group.hotspotData?.isTransition && this.quizPassed) {
                        const now = Date.now();
                        // Main glow pulse: 1.5–3.5
                        const glow = group.glowEntity;
                        if (glow && glow.render?.meshInstances[0]?.material) {
                            const pulseMat = glow.render.meshInstances[0].material;
                            const emissivePulse = 1.5 + (Math.sin(now * 0.004) * 0.5 + 0.5) * 2;
                            pulseMat.emissiveIntensity = emissivePulse;
                            pulseMat.update();
                        }
                        // Ring 1: pulse out of phase (offset by π/2)
                        const ring1 = group.ring1Entity;
                        if (ring1 && ring1.render?.meshInstances[0]?.material) {
                            const ring1Mat = ring1.render.meshInstances[0].material;
                            const ring1Pulse = 0.8 + (Math.sin(now * 0.003 + Math.PI / 2) * 0.5 + 0.5) * 1.2;
                            ring1Mat.emissiveIntensity = ring1Pulse;
                            ring1Mat.update();
                        }
                        // Ring 2: pulse out of phase (offset by π)
                        const ring2 = group.ring2Entity;
                        if (ring2 && ring2.render?.meshInstances[0]?.material) {
                            const ring2Mat = ring2.render.meshInstances[0].material;
                            const ring2Pulse = 0.5 + (Math.sin(now * 0.0035 + Math.PI) * 0.5 + 0.5) * 0.8;
                            ring2Mat.emissiveIntensity = ring2Pulse;
                            ring2Mat.update();
                        }
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

// Register and create the cafe exterior scene
const cafeExteriorScene = new CafeExteriorScene();
sceneManager.registerScene('cafe-exterior', cafeExteriorScene);
