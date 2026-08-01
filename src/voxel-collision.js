// VoxelCollision — extracted from @playcanvas/supersplat-viewer source
// MIT License — PlayCanvas Ltd

const SOLID_LEAF_MARKER = 0xFF000000 >>> 0;

function popcount(n) {
    n >>>= 0;
    n -= ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
}

class VoxelCollision {
    constructor(metadata, nodes, leafData) {
        this._gridMinX = metadata.gridBounds.min[0];
        this._gridMinY = metadata.gridBounds.min[1];
        this._gridMinZ = metadata.gridBounds.min[2];
        const res = metadata.voxelResolution;
        this._numVoxelsX = Math.round((metadata.gridBounds.max[0] - metadata.gridBounds.min[0]) / res);
        this._numVoxelsY = Math.round((metadata.gridBounds.max[1] - metadata.gridBounds.min[1]) / res);
        this._numVoxelsZ = Math.round((metadata.gridBounds.max[2] - metadata.gridBounds.min[2]) / res);
        this._voxelResolution = res;
        this._leafSize = metadata.leafSize;
        this._treeDepth = metadata.treeDepth;
        this._nodes = nodes;
        this._leafData = leafData;
    }

    get gridMinX() { return this._gridMinX; }
    get gridMinY() { return this._gridMinY; }
    get gridMinZ() { return this._gridMinZ; }
    get numVoxelsX() { return this._numVoxelsX; }
    get numVoxelsY() { return this._numVoxelsY; }
    get numVoxelsZ() { return this._numVoxelsZ; }
    get voxelResolution() { return this._voxelResolution; }
    get leafSize() { return this._leafSize; }
    get treeDepth() { return this._treeDepth; }
    get nodes() { return this._nodes; }
    get leafData() { return this._leafData; }

    isVoxelSolid(ix, iy, iz) {
        if (this._nodes.length === 0 ||
            ix < 0 || iy < 0 || iz < 0 ||
            ix >= this._numVoxelsX || iy >= this._numVoxelsY || iz >= this._numVoxelsZ) {
            return false;
        }
        const { _leafSize: leafSize, _treeDepth: treeDepth } = this;
        const blockX = Math.floor(ix / leafSize);
        const blockY = Math.floor(iy / leafSize);
        const blockZ = Math.floor(iz / leafSize);
        let nodeIndex = 0;
        for (let level = treeDepth - 1; level >= 0; level--) {
            const node = this._nodes[nodeIndex] >>> 0;
            if (node === SOLID_LEAF_MARKER) return true;
            const childMask = (node >>> 24) & 0xFF;
            if (childMask === 0) return this._checkLeafByIndex(node, ix, iy, iz);
            const bitX = (blockX >>> level) & 1;
            const bitY = (blockY >>> level) & 1;
            const bitZ = (blockZ >>> level) & 1;
            const octant = (bitZ << 2) | (bitY << 1) | bitX;
            if ((childMask & (1 << octant)) === 0) return false;
            const baseOffset = node & 0x00FFFFFF;
            const prefix = (1 << octant) - 1;
            const childOffset = popcount(childMask & prefix);
            nodeIndex = baseOffset + childOffset;
        }
        const node = this._nodes[nodeIndex] >>> 0;
        if (node === SOLID_LEAF_MARKER) return true;
        return this._checkLeafByIndex(node, ix, iy, iz);
    }

    _checkLeafByIndex(node, ix, iy, iz) {
        const leafDataIndex = node & 0x00FFFFFF;
        const vx = ix & 3;
        const vy = iy & 3;
        const vz = iz & 3;
        const bitIndex = vz * 16 + vy * 4 + vx;
        if (bitIndex < 32) {
            const lo = this._leafData[leafDataIndex * 2] >>> 0;
            return ((lo >>> bitIndex) & 1) === 1;
        }
        const hi = this._leafData[leafDataIndex * 2 + 1] >>> 0;
        return ((hi >>> (bitIndex - 32)) & 1) === 1;
    }

    isFreeAt(x, y, z) {
        if (this._nodes.length === 0) return false;
        const res = this._voxelResolution;
        const ix = Math.floor((x - this._gridMinX) / res);
        const iy = Math.floor((y - this._gridMinY) / res);
        const iz = Math.floor((z - this._gridMinZ) / res);
        if (ix < 0 || iy < 0 || iz < 0 ||
            ix >= this._numVoxelsX || iy >= this._numVoxelsY || iz >= this._numVoxelsZ) {
            return false;
        }
        return !this.isVoxelSolid(ix, iy, iz);
    }

    queryRay(ox, oy, oz, dx, dy, dz, maxDist) {
        if (this._nodes.length === 0) return null;
        const res = this._voxelResolution;
        const gMinX = this._gridMinX, gMinY = this._gridMinY, gMinZ = this._gridMinZ;
        const gMaxX = gMinX + this._numVoxelsX * res;
        const gMaxY = gMinY + this._numVoxelsY * res;
        const gMaxZ = gMinZ + this._numVoxelsZ * res;
        const EPS = 1e-12;
        let tNear = 0, tFar = maxDist;
        if (Math.abs(dx) > EPS) {
            let t1 = (gMinX - ox) / dx, t2 = (gMaxX - ox) / dx;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            if (t1 > tNear) tNear = t1;
            tFar = Math.min(tFar, t2);
            if (tNear > tFar) return null;
        } else if (ox < gMinX || ox >= gMaxX) return null;
        if (Math.abs(dy) > EPS) {
            let t1 = (gMinY - oy) / dy, t2 = (gMaxY - oy) / dy;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            if (t1 > tNear) tNear = t1;
            tFar = Math.min(tFar, t2);
            if (tNear > tFar) return null;
        } else if (oy < gMinY || oy >= gMaxY) return null;
        if (Math.abs(dz) > EPS) {
            let t1 = (gMinZ - oz) / dz, t2 = (gMaxZ - oz) / dz;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            if (t1 > tNear) tNear = t1;
            tFar = Math.min(tFar, t2);
            if (tNear > tFar) return null;
        } else if (oz < gMinZ || oz >= gMaxZ) return null;
        const entryX = ox + dx * tNear;
        const entryY = oy + dy * tNear;
        const entryZ = oz + dz * tNear;
        let ix = Math.max(0, Math.min(Math.floor((entryX - gMinX) / res), this._numVoxelsX - 1));
        let iy = Math.max(0, Math.min(Math.floor((entryY - gMinY) / res), this._numVoxelsY - 1));
        let iz = Math.max(0, Math.min(Math.floor((entryZ - gMinZ) / res), this._numVoxelsZ - 1));
        const stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
        const stepY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
        const stepZ = dz > 0 ? 1 : (dz < 0 ? -1 : 0);
        const invDx = Math.abs(dx) > EPS ? 1.0 / dx : 0;
        const invDy = Math.abs(dy) > EPS ? 1.0 / dy : 0;
        const invDz = Math.abs(dz) > EPS ? 1.0 / dz : 0;
        let tMaxX = Math.abs(dx) > EPS ? (gMinX + (ix + (dx > 0 ? 1 : 0)) * res - ox) * invDx : Infinity;
        let tMaxY = Math.abs(dy) > EPS ? (gMinY + (iy + (dy > 0 ? 1 : 0)) * res - oy) * invDy : Infinity;
        let tMaxZ = Math.abs(dz) > EPS ? (gMinZ + (iz + (dz > 0 ? 1 : 0)) * res - oz) * invDz : Infinity;
        const tDeltaX = Math.abs(dx) > EPS ? res * Math.abs(invDx) : Infinity;
        const tDeltaY = Math.abs(dy) > EPS ? res * Math.abs(invDy) : Infinity;
        const tDeltaZ = Math.abs(dz) > EPS ? res * Math.abs(invDz) : Infinity;
        let currentT = tNear;
        const maxSteps = this._numVoxelsX + this._numVoxelsY + this._numVoxelsZ;
        for (let step = 0; step < maxSteps; step++) {
            if (this.isVoxelSolid(ix, iy, iz)) {
                return { x: ox + dx * currentT, y: oy + dy * currentT, z: oz + dz * currentT };
            }
            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) { currentT = tMaxX; ix += stepX; tMaxX += tDeltaX; }
                else { currentT = tMaxZ; iz += stepZ; tMaxZ += tDeltaZ; }
            } else if (tMaxY < tMaxZ) {
                currentT = tMaxY; iy += stepY; tMaxY += tDeltaY;
            } else {
                currentT = tMaxZ; iz += stepZ; tMaxZ += tDeltaZ;
            }
            if (ix < 0 || iy < 0 || iz < 0 ||
                ix >= this._numVoxelsX || iy >= this._numVoxelsY || iz >= this._numVoxelsZ ||
                currentT > maxDist) return null;
        }
        return null;
    }
}

async function loadVoxelCollision(jsonUrl) {
    const metaResponse = await fetch(jsonUrl);
    if (!metaResponse.ok) throw new Error(`Failed to fetch voxel metadata: ${metaResponse.statusText}`);
    const metadata = await metaResponse.json();
    const binUrl = jsonUrl.replace('.voxel.json', '.voxel.bin');
    const binResponse = await fetch(binUrl);
    if (!binResponse.ok) throw new Error(`Failed to fetch voxel binary: ${binResponse.statusText}`);
    const buffer = await binResponse.arrayBuffer();
    const view = new Uint32Array(buffer);
    const nodes = view.slice(0, metadata.nodeCount);
    const leafData = view.slice(metadata.nodeCount, metadata.nodeCount + metadata.leafDataCount);
    return new VoxelCollision(metadata, nodes, leafData);
}
