import * as THREE from 'three';
import type { FighterState } from './types';
import {
  UTKARSH_ORBIT_START_TIME,
  type UtkarshSuperBeatSignal,
  type UtkarshSuperState,
} from './utkarshSuper';

interface ElectricParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface TrailSample {
  x: number;
  y: number;
  z: number;
}

const TRAIL_SAMPLE_COUNT = 24;
const BOLT_STRAND_COUNT = 3;
const SNEAKER_ARC_COUNT = 4;
const SNEAKER_ARC_VERTS = 7;
const AFTERIMAGE_COUNT = 5;
const PARTICLE_POOL_SIZE = 48;

const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpAxis = new THREE.Vector3(0, 1, 0);
const _tmpMat4 = new THREE.Matrix4();

/**
 * Pre-allocated & pre-warmed 3D VFX pool for Utkarsh's "LIGHTNING ORBIT BLITZ!":
 * - 3 jagged cyan-blue & electric-white `THREE.Line` lightning bolts trailing continuously BEHIND Utkarsh
 * - Glowing cyan-white ribbon mesh strip trailing behind Utkarsh along his 360° circular orbit path
 * - 5 translucent glowing cyan-white electric afterimage silhouettes staggered behind him
 * - 4 jagged sneaker crackle arcs during Phase 1 laugh taunt
 * - Expanding electric shockwave ring + 48 pooled radial spark particles on strikes & finisher
 */
export class UtkarshSuperVfx {
  private group = new THREE.Group();

  // Trail position history (index 0 = newest / Utkarsh's body, index N-1 = tail behind him)
  private trailHistory: TrailSample[] = [];
  private trailCount = 0;

  // 3 jagged behind-body lightning bolt lines (2 cyan-blue, 1 electric-white core)
  private boltLines: THREE.Line[] = [];
  private boltPositions: Float32Array[] = [];

  // Glowing behind-body jagged lightning ribbon mesh (readable at all WebGL line widths!)
  private ribbonGeo: THREE.BufferGeometry;
  private ribbonPositions: Float32Array;
  private ribbonMat: THREE.MeshBasicMaterial;
  private ribbonMesh: THREE.Mesh;

  // 5 electric speed afterimages positioned along the circular trail behind Utkarsh
  private afterimages: THREE.Mesh[] = [];
  private afterimageMats: THREE.MeshBasicMaterial[] = [];

  // 4 sneaker crackle lightning arcs during Phase 1 laugh taunt
  private sneakerArcs: THREE.Line[] = [];
  private sneakerArcPositions: Float32Array[] = [];

  // Expanding cyan-white electric shockwave ring on finisher / strikes
  private shockwaveRing: THREE.Mesh;
  private shockwaveMat: THREE.MeshBasicMaterial;
  private shockwaveTimer = 0;
  private readonly shockwaveDuration = 0.56;

  // Radial electric spark pool
  private particleMesh: THREE.InstancedMesh;
  private particles: ElectricParticleSlot[] = [];
  private particleCursor = 0;
  private isPrewarming = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'utkarsh_super_vfx_root';
    scene.add(this.group);

    for (let i = 0; i < TRAIL_SAMPLE_COUNT; i++) {
      this.trailHistory.push({ x: 0, y: 1.0, z: 0 });
    }

    // 1. Pre-allocate 3 behind-body jagged lightning bolt lines
    const boltColors = [0x06b6d4, 0x38bdf8, 0xffffff];
    for (let b = 0; b < BOLT_STRAND_COUNT; b++) {
      const arr = new Float32Array(TRAIL_SAMPLE_COUNT * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.LineBasicMaterial({
        color: boltColors[b],
        transparent: true,
        opacity: b === 2 ? 0.98 : 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      this.group.add(line);
      this.boltLines.push(line);
      this.boltPositions.push(arr);
    }

    // 2. Pre-allocate glowing behind-body jagged lightning ribbon mesh (2 verts per trail sample)
    this.ribbonPositions = new Float32Array(TRAIL_SAMPLE_COUNT * 2 * 3);
    this.ribbonGeo = new THREE.BufferGeometry();
    this.ribbonGeo.setAttribute('position', new THREE.BufferAttribute(this.ribbonPositions, 3));
    const indices: number[] = [];
    for (let i = 0; i < TRAIL_SAMPLE_COUNT - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    this.ribbonGeo.setIndex(indices);
    this.ribbonMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ribbonMesh = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
    this.ribbonMesh.frustumCulled = false;
    this.ribbonMesh.visible = false;
    this.group.add(this.ribbonMesh);

    // 3. Pre-allocate 5 glowing cyan-white electric afterimages
    const afterimageGeo = new THREE.CapsuleGeometry(0.24, 0.92, 6, 10);
    for (let i = 0; i < AFTERIMAGE_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xe0f2fe : 0x06b6d4,
        transparent: true,
        opacity: 0.45 * (1 - i / AFTERIMAGE_COUNT),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(afterimageGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.afterimages.push(mesh);
      this.afterimageMats.push(mat);
    }

    // 4. Pre-allocate 4 sneaker crackle arcs (Phase 1 laugh taunt)
    for (let i = 0; i < SNEAKER_ARC_COUNT; i++) {
      const arr = new Float32Array(SNEAKER_ARC_VERTS * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? 0x38bdf8 : 0xffffff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      this.group.add(line);
      this.sneakerArcs.push(line);
      this.sneakerArcPositions.push(arr);
    }

    // 5. Pre-allocate electric shockwave ring
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.shockwaveRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 1.05, 36), this.shockwaveMat);
    this.shockwaveRing.rotation.x = -Math.PI / 2;
    this.shockwaveRing.position.y = 0.06;
    this.shockwaveRing.visible = false;
    this.group.add(this.shockwaveRing);

    // 6. Pre-allocate radial electric spark InstancedMesh
    const pGeo = new THREE.OctahedronGeometry(0.095, 0);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_POOL_SIZE);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.visible = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -20,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        scale: 0,
        color: new THREE.Color(0x38bdf8),
      });
      _tmpMat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _tmpMat4);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.particleMesh);
  }

  public setPrewarmVisible(visible: boolean): void {
    this.isPrewarming = visible;
    for (const line of this.boltLines) line.visible = visible;
    this.ribbonMesh.visible = visible;
    for (const img of this.afterimages) img.visible = visible;
    for (const arc of this.sneakerArcs) arc.visible = visible;
    this.shockwaveRing.visible = visible;
    this.particleMesh.visible = visible;
    if (visible) {
      for (const img of this.afterimages) img.position.set(0, -15, 0);
      this.shockwaveRing.position.set(0, -15, 0);
    } else {
      this.reset();
    }
  }

  public handleBeatSignals(signals: UtkarshSuperBeatSignal[]): void {
    for (const sig of signals) {
      if (sig.kind === 'sneaker_sparks' || sig.kind === 'orbit_start') {
        this.spawnSparks(sig.x, sig.y, 12, 6.2);
      } else if (sig.kind === 'orbit_strike') {
        this.spawnSparks(sig.x, sig.y, 10, 7.6);
      } else if (sig.kind === 'electric_finisher') {
        this.shockwaveTimer = this.shockwaveDuration;
        this.shockwaveRing.position.set(sig.x, 0.06, 0);
        this.shockwaveRing.visible = true;
        this.spawnSparks(sig.x, sig.y, 26, 9.8);
      }
    }
  }

  private spawnSparks(x: number, y: number, count: number, speed: number): void {
    this.particleMesh.visible = true;
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const spd = speed * (0.45 + Math.random() * 0.75);
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = (Math.random() - 0.5) * 0.8;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.sin(angle) * spd + 1.6;
      slot.vz = (Math.random() - 0.5) * 4.5;
      slot.life = 0;
      slot.maxLife = 0.28 + Math.random() * 0.22;
      slot.scale = 0.75 + Math.random() * 0.85;
      slot.color.setHex(i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0x38bdf8 : 0x06b6d4);
    }
  }

  private pushTrailSample(x: number, y: number, z: number): void {
    for (let i = TRAIL_SAMPLE_COUNT - 1; i > 0; i--) {
      this.trailHistory[i].x = this.trailHistory[i - 1].x;
      this.trailHistory[i].y = this.trailHistory[i - 1].y;
      this.trailHistory[i].z = this.trailHistory[i - 1].z;
    }
    this.trailHistory[0].x = x;
    this.trailHistory[0].y = y;
    this.trailHistory[0].z = z;
    this.trailCount = Math.min(TRAIL_SAMPLE_COUNT, this.trailCount + 1);
  }

  public update(
    sup: UtkarshSuperState | null,
    attackerState: FighterState | null,
    elapsed: number,
    dt: number,
  ): void {
    if (this.isPrewarming) return;

    if (sup && attackerState && sup.phase !== 'done') {
      const t = sup.elapsed;

      // Phase 1 (0.0s–1.7s): Cyan-white sneaker crackle arcs around Utkarsh's feet
      const showSneakerArcs = t < UTKARSH_ORBIT_START_TIME;
      for (let a = 0; a < SNEAKER_ARC_COUNT; a++) {
        const arc = this.sneakerArcs[a];
        arc.visible = showSneakerArcs;
        if (showSneakerArcs) {
          const arr = this.sneakerArcPositions[a];
          const baseAngle = (a / SNEAKER_ARC_COUNT) * Math.PI * 2 + elapsed * 7.5;
          for (let v = 0; v < SNEAKER_ARC_VERTS; v++) {
            const frac = v / (SNEAKER_ARC_VERTS - 1);
            const r = 0.14 + frac * 0.56;
            const jitter = v === 0 ? 0 : Math.sin(elapsed * 48 + a * 5 + v * 3.1) * 0.12;
            const ang = baseAngle + frac * 0.65;
            arr[v * 3] = attackerState.x + Math.cos(ang) * r + jitter;
            arr[v * 3 + 1] = 0.1 + frac * 0.42 + Math.abs(jitter) * 0.8;
            arr[v * 3 + 2] = Math.sin(ang) * r * 0.7;
          }
          arc.geometry.attributes.position.needsUpdate = true;
        }
      }

      // Phase 2 (1.7s–3.4s): Behind-body jagged cyan-blue & electric-white lightning bolts + ribbon + afterimages
      if (sup.orbitActive) {
        const bodyY = attackerState.y + 1.05;
        this.pushTrailSample(attackerState.x, bodyY, sup.attackerZ);

        // Fill remaining slots smoothly on the very first few frames
        for (let i = this.trailCount; i < TRAIL_SAMPLE_COUNT; i++) {
          this.trailHistory[i].x = this.trailHistory[this.trailCount - 1].x;
          this.trailHistory[i].y = this.trailHistory[this.trailCount - 1].y;
          this.trailHistory[i].z = this.trailHistory[this.trailCount - 1].z;
        }

        // Update 3 jagged lightning bolts streaming continuously BEHIND Utkarsh
        for (let b = 0; b < BOLT_STRAND_COUNT; b++) {
          const arr = this.boltPositions[b];
          const verticalOffset = (b - 1) * 0.24;
          const jitterAmp = b === 2 ? 0.11 : 0.2;
          for (let i = 0; i < TRAIL_SAMPLE_COUNT; i++) {
            const sample = this.trailHistory[i];
            const tailWeight = i === 0 ? 0 : Math.sin((i / (TRAIL_SAMPLE_COUNT - 1)) * Math.PI);
            const jx = Math.sin(elapsed * 58 + i * 2.7 + b * 4.1) * jitterAmp * tailWeight;
            const jy = Math.cos(elapsed * 64 + i * 3.3 + b * 2.5) * jitterAmp * tailWeight;
            const jz = Math.sin(elapsed * 52 + i * 2.1 + b * 5.2) * jitterAmp * tailWeight;
            arr[i * 3] = sample.x + jx;
            arr[i * 3 + 1] = sample.y + verticalOffset + jy;
            arr[i * 3 + 2] = sample.z + jz;
          }
          this.boltLines[b].visible = true;
          this.boltLines[b].geometry.attributes.position.needsUpdate = true;
        }

        // Update glowing jagged ribbon mesh behind Utkarsh
        for (let i = 0; i < TRAIL_SAMPLE_COUNT; i++) {
          const sample = this.trailHistory[i];
          const taper = 1 - i / (TRAIL_SAMPLE_COUNT - 1);
          const halfH = (0.36 * taper + 0.03) * (0.8 + 0.35 * Math.sin(elapsed * 45 + i * 2.4));
          const zigY = Math.sin(elapsed * 55 + i * 2.9) * 0.12 * taper;
          const idx = i * 6;
          this.ribbonPositions[idx] = sample.x;
          this.ribbonPositions[idx + 1] = sample.y + halfH + zigY;
          this.ribbonPositions[idx + 2] = sample.z;
          this.ribbonPositions[idx + 3] = sample.x;
          this.ribbonPositions[idx + 4] = sample.y - halfH + zigY;
          this.ribbonPositions[idx + 5] = sample.z;
        }
        this.ribbonGeo.attributes.position.needsUpdate = true;
        this.ribbonMesh.visible = true;

        // Update 5 electric afterimages along Utkarsh's trailing circular arc
        for (let i = 0; i < AFTERIMAGE_COUNT; i++) {
          const sampleIdx = Math.min(TRAIL_SAMPLE_COUNT - 1, (i + 1) * 4);
          const s = this.trailHistory[sampleIdx];
          const img = this.afterimages[i];
          img.visible = this.trailCount > sampleIdx;
          img.position.set(s.x, s.y - 0.05, s.z);
          const scale = 1 - i * 0.08;
          img.scale.set(scale, scale, scale);
          this.afterimageMats[i].opacity = 0.42 * (1 - i / AFTERIMAGE_COUNT);
        }
      } else {
        this.trailCount = 0;
        for (const line of this.boltLines) line.visible = false;
        this.ribbonMesh.visible = false;
        for (const img of this.afterimages) img.visible = false;
      }
    } else {
      this.trailCount = 0;
      for (const arc of this.sneakerArcs) arc.visible = false;
      for (const line of this.boltLines) line.visible = false;
      this.ribbonMesh.visible = false;
      for (const img of this.afterimages) img.visible = false;
    }

    // Update electric shockwave ring
    if (this.shockwaveTimer > 0) {
      this.shockwaveTimer = Math.max(0, this.shockwaveTimer - dt);
      const p = 1 - this.shockwaveTimer / this.shockwaveDuration;
      const sc = 0.65 + p * 4.5;
      this.shockwaveRing.scale.set(sc, sc, 1);
      this.shockwaveMat.opacity = (1 - p) * 0.9;
      if (this.shockwaveTimer <= 0) {
        this.shockwaveRing.visible = false;
      }
    }

    // Update radial spark bursts
    let anyActive = false;
    let dirty = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _tmpMat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _tmpMat4);
        continue;
      }
      anyActive = true;
      p.vy -= 12 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const sc = p.scale * (1 - p.life / p.maxLife);
      _tmpPos.set(p.x, p.y, p.z);
      _tmpScale.set(sc, sc, sc);
      _tmpQuat.setFromAxisAngle(_tmpAxis, p.life * 14);
      _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
      this.particleMesh.setMatrixAt(i, _tmpMat4);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
    if (!anyActive && !dirty) {
      this.particleMesh.visible = false;
    }
  }

  public reset(): void {
    this.trailCount = 0;
    for (const arc of this.sneakerArcs) arc.visible = false;
    for (const line of this.boltLines) line.visible = false;
    this.ribbonMesh.visible = false;
    for (const img of this.afterimages) img.visible = false;
    this.shockwaveTimer = 0;
    this.shockwaveRing.visible = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles[i].active = false;
      _tmpMat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _tmpMat4);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.particleMesh.visible = false;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Line).isLine) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
  }
}
