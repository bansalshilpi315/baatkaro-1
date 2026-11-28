import * as THREE from 'three';
import type { FighterRig } from './characters/rig';
import {
  KRISH_LEAP_START_TIME,
  KRISH_REATTACH_TIME,
  KRISH_SMASH_IMPACT_TIME,
  KRISH_SMASH_START_TIME,
  type KrishSuperBeatSignal,
  type KrishSuperState,
} from './krishSuper';
import type { FighterState } from './types';

interface FlyingBookSlot {
  mesh: THREE.Mesh;
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  life: number;
  maxLife: number;
}

interface BagParticleSlot {
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

const BOOK_POOL_SIZE = 12;
const PARTICLE_POOL_SIZE = 36;
const _tmpPos = new THREE.Vector3();
const _tmpRight = new THREE.Vector3();
const _tmpLeft = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpAxis = new THREE.Vector3(0, 1, 0);
const _tmpMat4 = new THREE.Matrix4();

function createBookCoverTexture(title: string, bgHex: string, stripeHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 128, 160);
  ctx.fillStyle = stripeHex;
  ctx.fillRect(0, 18, 128, 22);
  ctx.fillRect(0, 134, 128, 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 112, 144);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 64, 88);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#fde047';
  ctx.fillText('10KG EDITION', 64, 112);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBackpackCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#181a1f';
  ctx.fillRect(0, 0, 128, 128);
  // Ballistic nylon crosshatch weave
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 128; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  // Zipper seam + olive-gold badge
  ctx.fillStyle = '#0d0e11';
  ctx.fillRect(14, 48, 100, 6);
  ctx.fillStyle = '#a3e635';
  ctx.fillRect(46, 22, 36, 10);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Pre-allocated & pre-warmed 3D VFX pool for Krish's "10KG HEAVY BAG SMASH!":
 * - Detached scaled-up 3D black backpack (`krish_held_10kg_bag`) held in right hand -> raised overhead with both hands -> smashed down!
 * - Golden-olive windup power aura rings around Krish
 * - Expanding golden ground shockwave ring on smash impact
 * - 12 pooled 3D flying notebooks/textbooks bursting outward on smash
 * - 36 pooled golden-olive impact sparks
 */
export class KrishSuperVfx {
  private group = new THREE.Group();
  private heldBagGroup = new THREE.Group();
  private bagGlowMat: THREE.MeshBasicMaterial;
  private auraRings: THREE.Mesh[] = [];
  private auraMats: THREE.MeshBasicMaterial[] = [];

  private shockwaveRing: THREE.Mesh;
  private shockwaveMat: THREE.MeshBasicMaterial;
  private shockwaveFlash: THREE.Mesh;
  private shockwaveFlashMat: THREE.MeshBasicMaterial;
  private shockwaveTimer = 0;
  private readonly shockwaveDuration = 0.62;

  private books: FlyingBookSlot[] = [];
  private bookGeos: THREE.BufferGeometry[] = [];
  private bookMats: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  private particleMesh: THREE.InstancedMesh;
  private particles: BagParticleSlot[] = [];
  private particleCursor = 0;
  private isPrewarming = false;

  constructor(scene: THREE.Scene) {
    this.group.name = 'krish_super_vfx_root';
    scene.add(this.group);

    // 1. Pre-allocated detached 10KG 3D black backpack (scaled slightly larger in grip)
    this.heldBagGroup.name = 'krish_held_10kg_bag';
    const bagTex = createBackpackCanvasTexture();
    this.textures.push(bagTex);

    const bagMat = new THREE.MeshStandardMaterial({
      map: bagTex,
      color: 0x22252b,
      roughness: 0.78,
      metalness: 0.08,
    });
    const bagTrimMat = new THREE.MeshStandardMaterial({
      color: 0x0f1115,
      roughness: 0.84,
      metalness: 0.14,
    });
    const zipMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.3,
      metalness: 0.8,
    });

    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.26), bagMat);
    mainBody.castShadow = true;
    this.heldBagGroup.add(mainBody);

    const topDome = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.44, 14), bagMat);
    topDome.rotation.z = Math.PI / 2;
    topDome.scale.set(0.58, 1, 1);
    topDome.position.set(0, 0.24, 0);
    this.heldBagGroup.add(topDome);

    const frontPocket = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.11), bagTrimMat);
    frontPocket.position.set(0, -0.09, 0.15);
    this.heldBagGroup.add(frontPocket);

    const zipBar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.02), zipMat);
    zipBar.position.set(0, 0.04, 0.21);
    this.heldBagGroup.add(zipBar);

    const handleLoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.085, 0.018, 8, 16, Math.PI),
      bagTrimMat,
    );
    handleLoop.position.set(0, 0.34, 0);
    this.heldBagGroup.add(handleLoop);

    // Golden-olive heavy-energy rim glow around the 10KG backpack during Super
    this.bagGlowMat = new THREE.MeshBasicMaterial({
      color: 0xbef264,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const bagAuraShell = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.66, 0.35), this.bagGlowMat);
    this.heldBagGroup.add(bagAuraShell);

    this.heldBagGroup.visible = false;
    this.group.add(this.heldBagGroup);

    // 2. Golden-olive power windup aura rings
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(0.85 + i * 0.24, 0.045, 8, 28);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xfacc15 : 0xa3e635,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.visible = false;
      this.group.add(ring);
      this.auraRings.push(ring);
      this.auraMats.push(ringMat);
    }

    // 3. Expanding golden ground shockwave ring + impact flash
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.shockwaveRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 1.05, 36), this.shockwaveMat);
    this.shockwaveRing.rotation.x = -Math.PI / 2;
    this.shockwaveRing.position.y = 0.05;
    this.shockwaveRing.visible = false;
    this.group.add(this.shockwaveRing);

    this.shockwaveFlashMat = new THREE.MeshBasicMaterial({
      color: 0xfef9c3,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.shockwaveFlash = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), this.shockwaveFlashMat);
    this.shockwaveFlash.rotation.x = -Math.PI / 2;
    this.shockwaveFlash.position.y = 0.06;
    this.shockwaveFlash.visible = false;
    this.group.add(this.shockwaveFlash);

    // 4. Pooled 3D scattering notebooks & heavy textbooks
    const bookGeo = new THREE.BoxGeometry(0.32, 0.065, 0.42);
    this.bookGeos.push(bookGeo);
    const pageMat = new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.85 });
    this.bookMats.push(pageMat);

    const coverSpecs = [
      { title: 'MATHS', bg: '#1d4ed8', stripe: '#facc15' },
      { title: 'PHYSICS', bg: '#b91c1c', stripe: '#fef08a' },
      { title: 'NOTES', bg: '#15803d', stripe: '#bef264' },
      { title: 'HISTORY', bg: '#92400e', stripe: '#fde68a' },
    ];
    const coverMatSets = coverSpecs.map((spec) => {
      const tex = createBookCoverTexture(spec.title, spec.bg, spec.stripe);
      this.textures.push(tex);
      const coverMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 });
      const spineMat = new THREE.MeshStandardMaterial({ color: spec.bg, roughness: 0.72 });
      this.bookMats.push(coverMat, spineMat);
      return [pageMat, spineMat, coverMat, coverMat, pageMat, pageMat];
    });

    for (let i = 0; i < BOOK_POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(bookGeo, coverMatSets[i % coverMatSets.length]);
      mesh.visible = false;
      this.group.add(mesh);
      this.books.push({
        mesh,
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        vrx: 0,
        vry: 0,
        vrz: 0,
        life: 0,
        maxLife: 1.0,
      });
    }

    // 5. Pooled InstancedMesh golden-olive impact sparks
    const pGeo = new THREE.OctahedronGeometry(0.11, 0);
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
        maxLife: 0.5,
        scale: 0,
        color: new THREE.Color(0xfacc15),
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
    this.heldBagGroup.visible = visible;
    for (const r of this.auraRings) r.visible = visible;
    this.shockwaveRing.visible = visible;
    this.shockwaveFlash.visible = visible;
    for (const b of this.books) b.mesh.visible = visible;
    this.particleMesh.visible = visible;
    if (visible) {
      this.heldBagGroup.position.set(0, -15, 0);
      this.shockwaveRing.position.set(0, -15, 0);
      this.shockwaveFlash.position.set(0, -15, 0);
      for (const b of this.books) b.mesh.position.set(0, -15, 0);
    } else {
      this.reset();
    }
  }

  public handleBeatSignals(signals: KrishSuperBeatSignal[]): void {
    for (const sig of signals) {
      if (sig.kind === 'unstrap_bag' || sig.kind === 'leap_raise') {
        this.spawnSparks(sig.x, sig.y, 12, 0xbef264, 5.2);
      } else if (sig.kind === 'bag_smash_impact') {
        this.shockwaveTimer = this.shockwaveDuration;
        this.shockwaveRing.position.set(sig.x, 0.06, 0);
        this.shockwaveFlash.position.set(sig.x, 0.07, 0);
        this.shockwaveRing.visible = true;
        this.shockwaveFlash.visible = true;
        this.spawnFlyingBooks(sig.x, 0.95);
        this.spawnSparks(sig.x, 0.85, 24, 0xfacc15, 8.8);
      }
    }
  }

  private spawnFlyingBooks(originX: number, originY: number): void {
    for (let i = 0; i < BOOK_POOL_SIZE; i++) {
      const slot = this.books[i];
      const angle = (i / BOOK_POOL_SIZE) * Math.PI * 2 + (i % 3) * 0.22;
      const horiz = 3.2 + (i % 4) * 1.45;
      slot.active = true;
      slot.x = originX + Math.cos(angle) * 0.25;
      slot.y = originY + 0.15;
      slot.z = Math.sin(angle) * 0.25;
      slot.vx = Math.cos(angle) * horiz;
      slot.vy = 4.8 + (i % 3) * 1.7;
      slot.vz = Math.sin(angle) * horiz * 0.85;
      slot.rx = (i * 0.7) % Math.PI;
      slot.ry = (i * 1.1) % Math.PI;
      slot.rz = (i * 0.5) % Math.PI;
      slot.vrx = 6 + (i % 4) * 2.5;
      slot.vry = 5 + (i % 3) * 2.4;
      slot.vrz = 4.5 + (i % 5) * 1.8;
      slot.life = 0;
      slot.maxLife = 0.85 + (i % 3) * 0.18;
      slot.mesh.visible = true;
      slot.mesh.scale.set(1, 1, 1);
    }
  }

  private spawnSparks(x: number, y: number, count: number, colorHex: number, speed: number): void {
    this.particleMesh.visible = true;
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35;
      const spd = speed * (0.45 + Math.random() * 0.75);
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = (Math.random() - 0.5) * 0.6;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.abs(Math.sin(angle)) * spd * 0.8 + 2.2;
      slot.vz = (Math.random() - 0.5) * 3.8;
      slot.life = 0;
      slot.maxLife = 0.34 + Math.random() * 0.24;
      slot.scale = 0.8 + Math.random() * 0.85;
      slot.color.setHex(i % 2 === 0 ? colorHex : 0xfef08a);
    }
  }

  public update(
    sup: KrishSuperState | null,
    attackerRig: FighterRig | null,
    attackerState: FighterState | null,
    dt: number,
  ): void {
    if (this.isPrewarming) return;

    // 1. Update detached 10KG backpack & golden-olive windup rings
    if (sup && attackerRig && attackerState && sup.phase !== 'done') {
      const t = sup.elapsed;
      if (sup.bagDetached) {
        this.heldBagGroup.visible = true;
        attackerRig.root.updateMatrixWorld(true);
        attackerRig.rightFistAnchor.getWorldPosition(_tmpRight);
        attackerRig.leftFistAnchor.getWorldPosition(_tmpLeft);

        if (t < KRISH_LEAP_START_TIME) {
          // Held firmly in Krish's right hand swinging back with power
          const scaleBump = 1.15 + Math.min(1, t / 0.6) * 0.14;
          this.heldBagGroup.position.copy(_tmpRight);
          this.heldBagGroup.position.x -= sup.attackerFacing * 0.12;
          this.heldBagGroup.position.y -= 0.12;
          this.heldBagGroup.rotation.set(0.35, sup.attackerFacing * 0.5, -sup.attackerFacing * 0.45);
          this.heldBagGroup.scale.setScalar(scaleBump);
          this.bagGlowMat.opacity = 0.28 + Math.sin(t * 14) * 0.12;
        } else if (t < KRISH_SMASH_START_TIME) {
          // Raised HIGH overhead with BOTH hands mid-leap!
          _tmpPos.copy(_tmpRight).add(_tmpLeft).multiplyScalar(0.5);
          _tmpPos.y += 0.24;
          this.heldBagGroup.position.copy(_tmpPos);
          this.heldBagGroup.rotation.set(-0.25, sup.attackerFacing * Math.PI * 0.5, 0);
          this.heldBagGroup.scale.setScalar(1.32);
          this.bagGlowMat.opacity = 0.48 + Math.sin(t * 22) * 0.16;
        } else if (t < KRISH_SMASH_IMPACT_TIME + 0.24) {
          // Slamming straight downward onto opponent!
          const slamT = Math.min(
            1,
            (t - KRISH_SMASH_START_TIME) / (KRISH_SMASH_IMPACT_TIME - KRISH_SMASH_START_TIME),
          );
          _tmpPos.copy(_tmpRight).add(_tmpLeft).multiplyScalar(0.5);
          _tmpPos.x += sup.attackerFacing * (0.28 + slamT * 0.35);
          _tmpPos.y = Math.max(0.45, _tmpPos.y + 0.18 * (1 - slamT));
          this.heldBagGroup.position.copy(_tmpPos);
          this.heldBagGroup.rotation.set(
            -0.25 + slamT * 1.45,
            sup.attackerFacing * Math.PI * 0.5,
            0,
          );
          this.heldBagGroup.scale.setScalar(1.36);
          this.bagGlowMat.opacity = 0.62;
        } else {
          // Swinging bag smoothly back over right shoulder to re-attach
          const returnT = Math.min(
            1,
            (t - (KRISH_SMASH_IMPACT_TIME + 0.24)) /
              Math.max(0.08, KRISH_REATTACH_TIME - (KRISH_SMASH_IMPACT_TIME + 0.24)),
          );
          this.heldBagGroup.position.copy(_tmpRight);
          this.heldBagGroup.position.x -= sup.attackerFacing * (0.2 * returnT);
          this.heldBagGroup.scale.setScalar(1.22 - 0.22 * returnT);
          this.heldBagGroup.rotation.set(0.2, sup.attackerFacing * Math.PI * 0.5, 0);
          this.bagGlowMat.opacity = 0.32 * (1 - returnT);
        }
      } else {
        this.heldBagGroup.visible = false;
      }

      // Golden-olive power windup aura rings around Krish during Phase 1 & Phase 2
      const showAura = t < KRISH_SMASH_IMPACT_TIME;
      for (let i = 0; i < this.auraRings.length; i++) {
        const ring = this.auraRings[i];
        ring.visible = showAura;
        if (showAura) {
          const cycle = (t * 2.2 + i * 0.33) % 1;
          ring.position.set(attackerState.x, attackerState.y + 0.25 + cycle * 1.85, 0);
          const sc = 0.72 + Math.sin(cycle * Math.PI) * 0.58;
          ring.scale.set(sc, sc, 1);
          ring.rotation.z = t * (i % 2 === 0 ? 4.5 : -5.2);
          this.auraMats[i].opacity = (1 - Math.abs(cycle - 0.5) * 2) * 0.68;
        }
      }
    } else {
      this.heldBagGroup.visible = false;
      for (const ring of this.auraRings) ring.visible = false;
    }

    // 2. Update expanding golden ground shockwave ring
    if (this.shockwaveTimer > 0) {
      this.shockwaveTimer = Math.max(0, this.shockwaveTimer - dt);
      const p = 1 - this.shockwaveTimer / this.shockwaveDuration;
      const s = 0.6 + p * 4.4;
      this.shockwaveRing.scale.set(s, s, 1);
      this.shockwaveMat.opacity = (1 - p) * 0.88;
      const fs = 0.5 + p * 2.6;
      this.shockwaveFlash.scale.set(fs, fs, 1);
      this.shockwaveFlashMat.opacity = Math.max(0, (1 - p * 1.8) * 0.75);
      if (this.shockwaveTimer <= 0) {
        this.shockwaveRing.visible = false;
        this.shockwaveFlash.visible = false;
      }
    }

    // 3. Update scattering 3D notebooks/textbooks
    for (const slot of this.books) {
      if (!slot.active) continue;
      slot.life += dt;
      if (slot.life >= slot.maxLife) {
        slot.active = false;
        slot.mesh.visible = false;
        continue;
      }
      slot.vy -= 16 * dt;
      slot.x += slot.vx * dt;
      slot.y = Math.max(0.06, slot.y + slot.vy * dt);
      slot.z += slot.vz * dt;
      if (slot.y <= 0.065) {
        slot.vy = Math.abs(slot.vy) * 0.28;
        slot.vx *= 0.82;
        slot.vz *= 0.82;
      }
      slot.rx += slot.vrx * dt;
      slot.ry += slot.vry * dt;
      slot.rz += slot.vrz * dt;
      const fade = slot.life > slot.maxLife * 0.65 ? 1 - (slot.life - slot.maxLife * 0.65) / (slot.maxLife * 0.35) : 1;
      slot.mesh.position.set(slot.x, slot.y, slot.z);
      slot.mesh.rotation.set(slot.rx, slot.ry, slot.rz);
      slot.mesh.scale.setScalar(Math.max(0.01, fade));
    }

    // 4. Update pooled sparks
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
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const sc = p.scale * (1 - p.life / p.maxLife);
      _tmpPos.set(p.x, p.y, p.z);
      _tmpScale.set(sc, sc, sc);
      _tmpQuat.setFromAxisAngle(_tmpAxis, p.life * 10);
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
    this.heldBagGroup.visible = false;
    for (const r of this.auraRings) r.visible = false;
    this.shockwaveTimer = 0;
    this.shockwaveRing.visible = false;
    this.shockwaveFlash.visible = false;
    for (const slot of this.books) {
      slot.active = false;
      slot.mesh.visible = false;
    }
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
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
    for (const tex of this.textures) tex.dispose();
  }
}
