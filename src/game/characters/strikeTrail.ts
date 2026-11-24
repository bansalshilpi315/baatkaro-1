import * as THREE from 'three';
import type { FighterRig } from './rig';
import type { StrikeTrailLimb } from './kinematics';

const TRAIL_SEGMENTS = 10;
const VERTEX_COUNT = TRAIL_SEGMENTS * 2;
const INDEX_COUNT = (TRAIL_SEGMENTS - 1) * 6;

const _tipPos = new THREE.Vector3();
const _basePos = new THREE.Vector3();
const _velDir = new THREE.Vector3();
const _sideDir = new THREE.Vector3();
const _toCam = new THREE.Vector3(0, 0, 1);

let sharedTrailTex: THREE.CanvasTexture | null = null;

function getStrikeTrailTexture(): THREE.CanvasTexture {
  if (sharedTrailTex) return sharedTrailTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;

  // Soft white-to-gold smear ribbon alpha profile:
  // u = 0 (leading tip, bright white-gold) -> u = 1 (trailing tail, smooth transparent fade)
  // v = 0..1 (soft feathered cross-section edge so the smear looks sleek & luminous)
  const img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    const v = y / 63;
    const edgeProfile = Math.sin(v * Math.PI); // 0 at outer edges, 1 along ribbon core
    const edgeSoft = Math.pow(edgeProfile, 0.52);
    // Crisp white-hot core along center band, golden-amber outer edge
    const coreGlow = Math.pow(edgeProfile, 1.8);
    for (let x = 0; x < 64; x++) {
      const u = x / 63;
      const headBoost = Math.pow(1 - u, 0.95);
      const alpha = Math.max(0, Math.min(255, Math.round(headBoost * edgeSoft * 255)));
      const idx = (y * 64 + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = Math.round(212 + 43 * coreGlow);
      img.data[idx + 2] = Math.round(70 + 185 * coreGlow * (1 - u * 0.75));
      img.data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);

  sharedTrailTex = new THREE.CanvasTexture(c);
  sharedTrailTex.colorSpace = THREE.SRGBColorSpace;
  sharedTrailTex.wrapS = THREE.ClampToEdgeWrapping;
  sharedTrailTex.wrapT = THREE.ClampToEdgeWrapping;
  return sharedTrailTex;
}

/**
 * Pooled, zero-GC, low-poly 3D curved motion trail ribbon for martial-arts strikes.
 * Tracks the active striking fist or foot anchor in world space and renders a sleek
 * white-to-gold luminous smear arc (only 18 triangles per fighter).
 */
export class StrikeTrailRibbon {
  public readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;

  // Pre-allocated ring history of world-space tip & inner-edge points
  private readonly historyOuter: THREE.Vector3[] = [];
  private readonly historyInner: THREE.Vector3[] = [];
  private sampleCount = 0;
  private activeLimb: StrikeTrailLimb | null = null;
  private fadeTimer = 0;
  private readonly fadeDuration = 0.11;
  private sampleAccum = 0;

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(VERTEX_COUNT * 3);
    this.colors = new Float32Array(VERTEX_COUNT * 3);
    const uvs = new Float32Array(VERTEX_COUNT * 2);
    const indices = new Uint16Array(INDEX_COUNT);

    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const u = i / (TRAIL_SEGMENTS - 1);
      // Pre-bake white (#FFFFFF) at leading edge -> rich gold (#FACC15) -> amber (#F59E0B) at tail
      const r = 1.0;
      const g = 1.0 - u * 0.28;
      const b = Math.max(0.05, 1.0 - Math.pow(u, 0.55) * 0.94);

      const v0 = i * 2;
      const v1 = v0 + 1;
      uvs[v0 * 2] = u;
      uvs[v0 * 2 + 1] = 0;
      uvs[v1 * 2] = u;
      uvs[v1 * 2 + 1] = 1;

      this.colors[v0 * 3] = r;
      this.colors[v0 * 3 + 1] = g;
      this.colors[v0 * 3 + 2] = b;
      this.colors[v1 * 3] = r;
      this.colors[v1 * 3 + 1] = g;
      this.colors[v1 * 3 + 2] = b;

      this.historyOuter.push(new THREE.Vector3());
      this.historyInner.push(new THREE.Vector3());
    }

    let ptr = 0;
    for (let i = 0; i < TRAIL_SEGMENTS - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices[ptr++] = a;
      indices[ptr++] = b;
      indices[ptr++] = c;
      indices[ptr++] = b;
      indices[ptr++] = d;
      indices[ptr++] = c;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.material = new THREE.MeshBasicMaterial({
      map: getStrikeTrailTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
  }

  public reset(): void {
    this.sampleCount = 0;
    this.activeLimb = null;
    this.fadeTimer = 0;
    this.sampleAccum = 0;
    this.mesh.visible = false;
    this.material.opacity = 0;
  }

  private getLimbAnchors(
    rig: FighterRig,
    limb: StrikeTrailLimb,
  ): { tip: THREE.Object3D; base: THREE.Object3D; halfWidth: number } {
    switch (limb) {
      case 'leftFist':
        return { tip: rig.leftFistAnchor, base: rig.leftElbow, halfWidth: 0.22 };
      case 'rightFist':
        return { tip: rig.rightFistAnchor, base: rig.rightElbow, halfWidth: 0.24 };
      case 'leftFoot':
        return { tip: rig.leftFootAnchor, base: rig.leftKnee, halfWidth: 0.27 };
      case 'rightFoot':
        return { tip: rig.rightFootAnchor, base: rig.rightKnee, halfWidth: 0.28 };
    }
  }

  public update(
    rig: FighterRig,
    limb: StrikeTrailLimb | null,
    intensity: number,
    dt: number,
  ): void {
    if (limb && intensity > 0.02) {
      if (this.activeLimb !== limb) {
        this.activeLimb = limb;
        this.sampleCount = 0;
        this.sampleAccum = 0;
      }

      const { tip, base, halfWidth } = this.getLimbAnchors(rig, limb);
      tip.getWorldPosition(_tipPos);
      base.getWorldPosition(_basePos);

      // Build ribbon cross-vector from limb axis blended with camera-facing perpendicular
      // so the curved arc reads brightly from the 2.5D arcade fighting camera!
      _sideDir.subVectors(_tipPos, _basePos);
      if (_sideDir.lengthSq() < 1e-5) {
        _sideDir.set(0, 1, 0);
      } else {
        _sideDir.normalize();
      }

      if (this.sampleCount > 0) {
        _velDir.subVectors(_tipPos, this.historyOuter[0]);
        if (_velDir.lengthSq() > 1e-4) {
          _velDir.normalize();
          // Cross motion direction with camera forward (+Z) for thick smear normal
          const perpX = -_velDir.y * _toCam.z;
          const perpY = _velDir.x * _toCam.z;
          _sideDir.set(
            _sideDir.x * 0.45 + perpX * 0.55,
            _sideDir.y * 0.45 + perpY * 0.55,
            _sideDir.z * 0.25,
          );
          if (_sideDir.lengthSq() > 1e-5) _sideDir.normalize();
        }
      }

      const width = halfWidth * (0.78 + 0.56 * intensity);
      this.sampleAccum += dt;
      const movedDistSq =
        this.sampleCount > 0 ? _tipPos.distanceToSquared(this.historyOuter[0]) : 1;
      const shouldShift =
        this.sampleCount === 0 || this.sampleAccum >= 0.008 || movedDistSq > 0.0016;

      if (shouldShift) {
        this.sampleAccum = 0;
        const maxShift = Math.min(this.sampleCount, TRAIL_SEGMENTS - 1);
        for (let i = maxShift; i > 0; i--) {
          this.historyOuter[i].copy(this.historyOuter[i - 1]);
          this.historyInner[i].copy(this.historyInner[i - 1]);
        }
        if (this.sampleCount < TRAIL_SEGMENTS) {
          this.sampleCount++;
        }
      }

      // Bias Z slightly forward (+0.26) so glowing smear arcs pop cleanly in front of fighter meshes
      const zBias = 0.26;
      this.historyOuter[0].set(
        _tipPos.x + _sideDir.x * width,
        _tipPos.y + _sideDir.y * width,
        _tipPos.z + _sideDir.z * width + zBias,
      );
      this.historyInner[0].set(
        _tipPos.x - _sideDir.x * width * 0.85,
        _tipPos.y - _sideDir.y * width * 0.85,
        _tipPos.z - _sideDir.z * width * 0.85 + zBias,
      );

      if (this.sampleCount === 1) {
        // Seed curved trailing crescent on first active frame so even fast flicks read immediately
        this.historyOuter[1].copy(this.historyOuter[0]).lerp(_basePos, 0.35);
        this.historyInner[1].copy(this.historyInner[0]).lerp(_basePos, 0.45);
        this.historyOuter[1].z = this.historyOuter[0].z;
        this.historyInner[1].z = this.historyInner[0].z;
        this.historyOuter[2].copy(this.historyOuter[0]).lerp(_basePos, 0.72);
        this.historyInner[2].copy(this.historyInner[0]).lerp(_basePos, 0.82);
        this.historyOuter[2].z = this.historyOuter[0].z;
        this.historyInner[2].z = this.historyInner[0].z;
        this.sampleCount = 3;
      }

      this.fadeTimer = this.fadeDuration;
      this.writeGeometry(Math.min(0.96, 0.96 * Math.sqrt(intensity)));
      return;
    }

    // Smooth short-lived trail fade-out after active frames end
    if (this.fadeTimer > 0 && this.sampleCount >= 2) {
      this.fadeTimer = Math.max(0, this.fadeTimer - dt);
      const fadeAlpha = this.fadeTimer / this.fadeDuration;
      if (fadeAlpha <= 0.02) {
        this.reset();
      } else {
        this.writeGeometry(fadeAlpha * 0.78);
      }
    } else if (this.mesh.visible) {
      this.reset();
    }
  }

  private writeGeometry(opacity: number): void {
    const pos = this.positions;
    const lastIdx = Math.max(0, this.sampleCount - 1);

    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const srcIdx = Math.min(i, lastIdx);
      const outer = this.historyOuter[srcIdx];
      const inner = this.historyInner[srcIdx];

      // Taper ribbon width cleanly toward tail end for a razor-sharp arcade crescent look
      const tailT = i / (TRAIL_SEGMENTS - 1);
      const taper = 1 - tailT * 0.72;
      const midX = (outer.x + inner.x) * 0.5;
      const midY = (outer.y + inner.y) * 0.5;
      const midZ = (outer.z + inner.z) * 0.5;

      const v0 = i * 2 * 3;
      const v1 = (i * 2 + 1) * 3;

      pos[v0] = midX + (outer.x - midX) * taper;
      pos[v0 + 1] = midY + (outer.y - midY) * taper;
      pos[v0 + 2] = midZ + (outer.z - midZ) * taper;

      pos[v1] = midX + (inner.x - midX) * taper;
      pos[v1 + 1] = midY + (inner.y - midY) * taper;
      pos[v1 + 2] = midZ + (inner.z - midZ) * taper;
    }

    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.material.opacity = opacity;
    this.mesh.visible = opacity > 0.02;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
