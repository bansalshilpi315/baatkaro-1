import * as THREE from 'three';
import type { FighterRig } from './characters';
import {
  getBillaSuperDimFactor,
  type BillaSuperBeatSignal,
  type BillaSuperState,
} from './billaSuper';

interface RoachRig {
  root: THREE.Group;
  leftAntenna: THREE.Group;
  rightAntenna: THREE.Group;
  legs: THREE.Group[];
  bodyTilt: THREE.Group;
}

interface SmokeOrbSlot {
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  yOffset: number;
  zOffset: number;
  baseScale: number;
  bobPhase: number;
  burstVx: number;
  burstVy: number;
  burstVz: number;
  burstX: number;
  burstY: number;
  burstZ: number;
}

interface SparkSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  vRot: number;
  life: number;
  maxLife: number;
  scale: number;
}

const SMOKE_PUFF_POOL_SIZE = 26;
const STARBURST_POOL_SIZE = 18;

const _pos = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _color = new THREE.Color();

function createRoachMesh(variant: 'leader_purple' | 'chubby_blue' | 'tall_green'): RoachRig {
  const root = new THREE.Group();
  const bodyTilt = new THREE.Group();
  root.add(bodyTilt);

  const cfg =
    variant === 'leader_purple'
      ? {
          bodyColor: 0xc026d3, // Vibrant purple-pink leader
          bellyColor: 0xf472b6,
          shellScale: [0.22, 0.16, 0.34] as [number, number, number],
          headY: 0.08,
          headZ: 0.25,
          eyeRadius: 0.075,
          antennaLen: 0.28,
          legLen: 0.16,
        }
      : variant === 'chubby_blue'
        ? {
            bodyColor: 0x0284c7, // Chubby sky-cobalt blue cockroach
            bellyColor: 0x7dd3fc,
            shellScale: [0.31, 0.24, 0.32] as [number, number, number],
            headY: 0.12,
            headZ: 0.24,
            eyeRadius: 0.082,
            antennaLen: 0.24,
            legLen: 0.14,
          }
        : {
            bodyColor: 0x16a34a, // Tall skinny emerald-lime green cockroach
            bellyColor: 0x86efac,
            shellScale: [0.16, 0.28, 0.4] as [number, number, number],
            headY: 0.2,
            headZ: 0.28,
            eyeRadius: 0.08,
            antennaLen: 0.36,
            legLen: 0.22,
          };

  const shellMat = new THREE.MeshStandardMaterial({
    color: cfg.bodyColor,
    roughness: 0.36,
    metalness: 0.08,
    emissive: new THREE.Color(cfg.bodyColor),
    emissiveIntensity: 0.28,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: cfg.bellyColor,
    roughness: 0.65,
    metalness: 0.02,
  });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    emissive: new THREE.Color(0xfef08a),
    emissiveIntensity: 0.35,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.45,
  });

  // 1. Primary carapace shell + segmented belly
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), shellMat);
  body.scale.set(cfg.shellScale[0], cfg.shellScale[1], cfg.shellScale[2]);
  bodyTilt.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), bellyMat);
  belly.position.set(0, -cfg.shellScale[1] * 0.42, 0.02);
  belly.scale.set(cfg.shellScale[0] * 0.88, cfg.shellScale[1] * 0.55, cfg.shellScale[2] * 0.85);
  bodyTilt.add(belly);

  // Subtle wing-seam dorsal ridge
  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.03, cfg.shellScale[2] * 1.45),
    darkMat,
  );
  seam.position.set(0, cfg.shellScale[1] * 0.82, -0.02);
  bodyTilt.add(seam);

  // 2. Expressive cartoon head + oversized eyes + mischievous pupils
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), shellMat);
  head.position.set(0, cfg.headY, cfg.headZ);
  bodyTilt.add(head);

  if (variant === 'leader_purple') {
    // Signature tiny cheeky crest tuft on the leader cockroach
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), bellyMat);
    crest.position.set(0, cfg.headY + 0.15, cfg.headZ - 0.02);
    crest.rotation.x = -0.25;
    bodyTilt.add(crest);
  }

  const eyeGeo = new THREE.SphereGeometry(cfg.eyeRadius, 10, 8);
  const pupilGeo = new THREE.SphereGeometry(cfg.eyeRadius * 0.44, 8, 6);
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    eye.position.set(side * 0.072, cfg.headY + 0.06, cfg.headZ + 0.09);
    eye.scale.set(0.95, 1.25, 0.8);
    bodyTilt.add(eye);

    const pupil = new THREE.Mesh(pupilGeo, darkMat);
    pupil.position.set(side * 0.064, cfg.headY + 0.06, cfg.headZ + 0.145);
    bodyTilt.add(pupil);
  });

  // 3. Twitching curved antennae (2 pivoted groups)
  const antGeo = new THREE.CylinderGeometry(0.01, 0.016, cfg.antennaLen, 5);
  const makeAntenna = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.06, cfg.headY + 0.12, cfg.headZ + 0.05);
    const seg = new THREE.Mesh(antGeo, darkMat);
    seg.position.set(side * 0.04, cfg.antennaLen * 0.45, 0.06);
    seg.rotation.z = -side * 0.42;
    seg.rotation.x = 0.55;
    pivot.add(seg);
    bodyTilt.add(pivot);
    return pivot;
  };
  const leftAntenna = makeAntenna(-1);
  const rightAntenna = makeAntenna(1);

  // 4. 6 fast-scuttling cartoon legs
  const legGeo = new THREE.CapsuleGeometry(0.016, cfg.legLen, 4, 6);
  const legs: THREE.Group[] = [];
  const zOffsets = [0.14, 0.0, -0.14];
  for (const side of [-1, 1] as const) {
    for (const zOff of zOffsets) {
      const legPivot = new THREE.Group();
      legPivot.position.set(side * cfg.shellScale[0] * 0.8, -0.02, zOff);
      const legMesh = new THREE.Mesh(legGeo, darkMat);
      legMesh.position.set(side * cfg.legLen * 0.42, -cfg.legLen * 0.45, 0);
      legMesh.rotation.z = side * 0.65;
      legPivot.add(legMesh);
      bodyTilt.add(legPivot);
      legs.push(legPivot);
    }
  }

  root.visible = false;
  return { root, leftAntenna, rightAntenna, legs, bodyTilt };
}

export class BillaSuperVfx {
  public readonly group = new THREE.Group();

  // Phase 1: Neon green-yellow eye bloom rings + local face glow light
  public readonly eyeBloomLight: THREE.PointLight;
  private eyeRingOuter: THREE.Mesh;
  private eyeRingInner: THREE.Mesh;
  private eyeRingOuterMat: THREE.MeshBasicMaterial;
  private eyeRingInnerMat: THREE.MeshBasicMaterial;

  // Phase 2-4: 3 Iconic Pre-Pooled Low-Poly Cartoon Cockroaches
  private roaches: [RoachRig, RoachRig, RoachRig];
  private launchOrigin = new THREE.Vector3();
  private launchOriginCaptured = false;

  // Phase 3: Pre-Pooled Swirling Cartoon Smoke-Cloud Fight Cluster (InstancedMesh)
  private smokeMesh: THREE.InstancedMesh;
  private smokeOrbs: SmokeOrbSlot[] = [];
  private smokePopBurstActive = false;
  private smokePopTimer = 0;

  // Comic starburst impact flashes & pop explosion shockwave ring
  private starburstMesh: THREE.InstancedMesh;
  private sparks: SparkSlot[] = [];
  private sparkCursor = 0;
  private popRing: THREE.Mesh;
  private popRingMat: THREE.MeshBasicMaterial;
  private popRingTimer = 0;
  private readonly popRingDuration = 0.48;

  constructor(scene: THREE.Scene) {
    // 1. Intense Neon Green-Yellow Eye Bloom Light & Twin Concentric Rings
    this.eyeBloomLight = new THREE.PointLight(0xbef264, 0, 7.5, 1.5);
    this.eyeBloomLight.position.set(0, 1.8, 0.8);
    scene.add(this.eyeBloomLight);

    const outerRingGeo = new THREE.RingGeometry(0.19, 0.27, 28);
    this.eyeRingOuterMat = new THREE.MeshBasicMaterial({
      color: 0xa3e635,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.eyeRingOuter = new THREE.Mesh(outerRingGeo, this.eyeRingOuterMat);
    this.eyeRingOuter.visible = false;
    this.group.add(this.eyeRingOuter);

    const innerRingGeo = new THREE.RingGeometry(0.09, 0.145, 24);
    this.eyeRingInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.eyeRingInner = new THREE.Mesh(innerRingGeo, this.eyeRingInnerMat);
    this.eyeRingInner.visible = false;
    this.group.add(this.eyeRingInner);

    // 2. 3 Distinct Low-Poly Cartoon Cockroaches (Pre-Created, Zero Runtime Allocation)
    this.roaches = [
      createRoachMesh('leader_purple'),
      createRoachMesh('chubby_blue'),
      createRoachMesh('tall_green'),
    ];
    for (const r of this.roaches) {
      this.group.add(r.root);
    }

    // 3. Swirling Cartoon Smoke-Cloud Fight Cluster (26 Pre-Pooled Low-Poly Spheres)
    const smokeGeo = new THREE.IcosahedronGeometry(0.56, 1);
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.9,
      metalness: 0,
      emissive: new THREE.Color(0xe2e8f0),
      emissiveIntensity: 0.28,
    });
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, SMOKE_PUFF_POOL_SIZE);
    this.smokeMesh.frustumCulled = false;

    for (let i = 0; i < SMOKE_PUFF_POOL_SIZE; i++) {
      const goldenAngle = i * 2.39996;
      const ringTier = (i % 4) / 3;
      this.smokeOrbs.push({
        orbitAngle: goldenAngle,
        orbitRadius: 0.36 + ringTier * 1.08,
        orbitSpeed: (i % 2 === 0 ? 1 : -1) * (5.6 + (i % 5) * 1.15),
        yOffset: 0.48 + ((i * 0.41) % 1.56),
        zOffset: 0.24 + Math.sin(goldenAngle * 1.7) * 0.78,
        baseScale: 0.96 + (i % 4) * 0.24,
        bobPhase: i * 0.9,
        burstVx: Math.cos(goldenAngle) * (6.2 + (i % 4) * 1.5),
        burstVy: 3.4 + (i % 5) * 1.35,
        burstVz: Math.sin(goldenAngle) * 4.4,
        burstX: 0,
        burstY: 0,
        burstZ: 0,
      });
      // Soft light-grey to bright-white cloud tint variation
      const shade = i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xe5e7eb : 0xd1d5db;
      _color.setHex(shade);
      this.smokeMesh.setColorAt(i, _color);
      _mat4.makeScale(0, 0, 0);
      this.smokeMesh.setMatrixAt(i, _mat4);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    if (this.smokeMesh.instanceColor) this.smokeMesh.instanceColor.needsUpdate = true;
    this.group.add(this.smokeMesh);

    // 4. Comic Starburst Impact Flashes Pool
    const starGeo = new THREE.OctahedronGeometry(0.24, 0);
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.starburstMesh = new THREE.InstancedMesh(starGeo, starMat, STARBURST_POOL_SIZE);
    this.starburstMesh.frustumCulled = false;
    for (let i = 0; i < STARBURST_POOL_SIZE; i++) {
      this.sparks.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rot: 0,
        vRot: 0,
        life: 0,
        maxLife: 0.32,
        scale: 0,
      });
      _mat4.makeScale(0, 0, 0);
      this.starburstMesh.setMatrixAt(i, _mat4);
    }
    this.starburstMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.starburstMesh);

    // 5. Comic Pop Explosion Ring
    const popGeo = new THREE.RingGeometry(0.35, 1.05, 32);
    this.popRingMat = new THREE.MeshBasicMaterial({
      color: 0xbef264,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.popRing = new THREE.Mesh(popGeo, this.popRingMat);
    this.popRing.visible = false;
    this.group.add(this.popRing);

    scene.add(this.group);
  }

  private spawnStarbursts(
    x: number,
    y: number,
    count: number,
    speed: number,
    lowGraphics: boolean,
  ): void {
    const n = lowGraphics ? Math.max(3, Math.floor(count * 0.5)) : count;
    const palette = [0xfef08a, 0xfb923c, 0x4ade80, 0xffffff, 0xf472b6];
    for (let i = 0; i < n; i++) {
      const slot = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % STARBURST_POOL_SIZE;
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.55 + Math.random() * 0.75);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.9;
      slot.y = y + (Math.random() - 0.5) * 0.85;
      slot.z = 0.45 + Math.random() * 0.55;
      slot.vx = Math.cos(a) * spd;
      slot.vy = Math.sin(a) * spd;
      slot.vz = (Math.random() - 0.2) * 2.2;
      slot.rot = Math.random() * Math.PI * 2;
      slot.vRot = (Math.random() - 0.5) * 16;
      slot.life = 0;
      slot.maxLife = 0.26 + Math.random() * 0.18;
      slot.scale = 0.9 + Math.random() * 0.7;
      _color.setHex(palette[i % palette.length]);
      this.starburstMesh.setColorAt(this.sparkCursor === 0 ? STARBURST_POOL_SIZE - 1 : this.sparkCursor - 1, _color);
    }
    if (this.starburstMesh.instanceColor) {
      this.starburstMesh.instanceColor.needsUpdate = true;
    }
  }

  public handleBeatSignals(signals: BillaSuperBeatSignal[], lowGraphics: boolean): void {
    for (const sig of signals) {
      if (sig.kind === 'eye_glow_start') {
        this.launchOriginCaptured = false;
        this.smokePopBurstActive = false;
        this.smokePopTimer = 0;
      } else if (sig.kind === 'roach_launch') {
        this.spawnStarbursts(sig.x, sig.y, 7, 5.2, lowGraphics);
      } else if (sig.kind === 'smoke_start') {
        this.spawnStarbursts(sig.x, sig.y, 8, 5.5, lowGraphics);
      } else if (sig.kind === 'smoke_hit') {
        this.spawnStarbursts(sig.x, sig.y, 6, 6.4, lowGraphics);
      } else if (sig.kind === 'pop_finisher') {
        this.smokePopBurstActive = true;
        this.smokePopTimer = 0;
        this.popRing.position.set(sig.x, sig.y, 0.35);
        this.popRing.scale.set(0.65, 0.65, 1);
        this.popRing.visible = true;
        this.popRingMat.opacity = 0.96;
        this.popRingTimer = this.popRingDuration;
        this.spawnStarbursts(sig.x, sig.y, 16, 9.2, lowGraphics);
      }
    }
  }

  private animateRoachLimbs(r: RoachRig, elapsed: number, seed: number, fast: boolean): void {
    const legSpeed = fast ? 42 : 24;
    const antSpeed = fast ? 28 : 16;
    r.leftAntenna.rotation.z = Math.sin(elapsed * antSpeed + seed) * 0.34;
    r.rightAntenna.rotation.z = -Math.sin(elapsed * antSpeed + seed + 0.9) * 0.34;
    r.leftAntenna.rotation.x = Math.cos(elapsed * antSpeed * 0.7 + seed) * 0.22;
    r.rightAntenna.rotation.x = Math.cos(elapsed * antSpeed * 0.7 + seed + 1.2) * 0.22;
    for (let i = 0; i < r.legs.length; i++) {
      r.legs[i].rotation.x = Math.sin(elapsed * legSpeed + i * 1.4 + seed) * 0.62;
    }
  }

  public update(
    dt: number,
    elapsed: number,
    superState: BillaSuperState | null,
    attackerRig: FighterRig | null,
    attackerX: number,
    attackerFacing: 1 | -1,
    defenderX: number,
  ): number {
    const dimFactor = superState?.active ? getBillaSuperDimFactor(superState.elapsed) : 0;

    // 1. Phase 1: Glowing Neon Green-Yellow Eye Light Rings & Face Bloom Light
    if (superState?.active && superState.elapsed < 1.55 && attackerRig?.billaEyesGroup) {
      attackerRig.billaEyesGroup.getWorldPosition(_worldPos);
      if (!this.launchOriginCaptured || superState.elapsed < 1.22) {
        this.launchOrigin.copy(_worldPos);
        this.launchOriginCaptured = true;
      }

      const fadeOut = superState.elapsed > 1.2 ? Math.max(0, 1 - (superState.elapsed - 1.2) / 0.35) : 1;
      const ramp = Math.min(1, superState.elapsed / 0.32) * fadeOut;
      const pulse = 0.86 + Math.sin(elapsed * 24) * 0.14;

      this.eyeBloomLight.position.set(_worldPos.x + attackerFacing * 0.25, _worldPos.y + 0.05, _worldPos.z + 0.55);
      this.eyeBloomLight.intensity = 10.5 * ramp * pulse;

      // Position concentric glowing halo rings right in front of Billa's popping eyes facing outward/camera
      const ringZ = _worldPos.z + 0.22;
      const ringX = _worldPos.x + attackerFacing * 0.14;
      this.eyeRingOuter.visible = true;
      this.eyeRingOuter.position.set(ringX, _worldPos.y, ringZ);
      this.eyeRingOuter.rotation.set(0, attackerFacing * 0.35, elapsed * 5.2);
      const outerScale = (0.76 + Math.sin(elapsed * 18) * 0.14) * (0.68 + ramp * 0.44);
      this.eyeRingOuter.scale.setScalar(outerScale);
      this.eyeRingOuterMat.opacity = 0.85 * ramp;

      this.eyeRingInner.visible = true;
      this.eyeRingInner.position.set(ringX, _worldPos.y, ringZ + 0.03);
      this.eyeRingInner.rotation.set(0, attackerFacing * 0.35, -elapsed * 7.5);
      this.eyeRingInner.scale.setScalar(0.84 + Math.cos(elapsed * 26) * 0.18);
      this.eyeRingInnerMat.opacity = 0.92 * ramp;
    } else {
      this.eyeBloomLight.intensity = 0;
      this.eyeRingOuter.visible = false;
      this.eyeRingInner.visible = false;
      this.eyeRingOuterMat.opacity = 0;
      this.eyeRingInnerMat.opacity = 0;
    }

    // 2. Phases 2-4: 3 Stylized Cartoon Cockroaches
    if (superState?.active && superState.elapsed >= 1.2) {
      const t = superState.elapsed;
      const originX = this.launchOriginCaptured ? this.launchOrigin.x : attackerX + attackerFacing * 0.28;
      const originY = this.launchOriginCaptured ? this.launchOrigin.y : 1.72;
      const originZ = this.launchOriginCaptured ? this.launchOrigin.z : 0.16;

      if (t < 2.1) {
        // Phase 2 (1.2s - 2.1s): Burst right out of Blue Billa's eyes in fast zippy arcs toward opponent!
        const pRaw = (t - 1.2) / 0.9;
        for (let i = 0; i < 3; i++) {
          const r = this.roaches[i];
          const delay = i * 0.09;
          const p = Math.max(0, Math.min(1, (pRaw - delay) / (1 - delay)));
          if (p <= 0.001) {
            r.root.visible = false;
            continue;
          }
          r.root.visible = true;
          const eased = 1 - Math.pow(1 - p, 2);
          const arcHeight = i === 0 ? 1.35 : i === 1 ? 0.62 : 1.78;
          const zArc = i === 0 ? 0.15 : i === 1 ? 0.72 : -0.58;
          const x = originX + (defenderX - originX) * eased;
          const y = originY * (1 - eased) + 1.12 * eased + Math.sin(p * Math.PI) * arcHeight;
          const z = originZ * (1 - eased) + Math.sin(p * Math.PI) * zArc;
          r.root.position.set(x, y, z);

          // Pop scale cleanly from eye sockets to full cartoon cockroach size
          const sc = 0.35 + Math.min(1, p * 4.5) * 0.85;
          r.root.scale.setScalar(sc);
          r.root.rotation.set(0, attackerFacing === 1 ? Math.PI * 0.5 : -Math.PI * 0.5, 0);
          r.bodyTilt.rotation.x = Math.cos(p * Math.PI) * -0.45;
          r.bodyTilt.rotation.z = Math.sin(elapsed * 22 + i * 2) * 0.24;
          this.animateRoachLimbs(r, elapsed, i * 2.1, true);
        }
      } else if (t < 4.1) {
        // Phase 3 (2.1s - 4.1s): Cockroaches dart & peek mischievously around the churning smoke cloud!
        const cloudT = t - 2.1;
        for (let i = 0; i < 3; i++) {
          const r = this.roaches[i];
          r.root.visible = true;
          const angle = cloudT * (6.8 + i * 1.4) + (i * Math.PI * 2) / 3;
          const peekPulse = 0.75 + Math.max(0, Math.sin(cloudT * 5.2 + i * 2.2)) * 0.92;
          const rx = defenderX + Math.cos(angle) * (1.28 * peekPulse);
          const ry = 1.15 + Math.sin(angle * 1.4 + i) * (0.85 * peekPulse);
          const rz = 0.35 + Math.sin(angle) * 0.82;
          r.root.position.set(rx, Math.max(0.28, ry), rz);
          r.root.scale.setScalar(1.12);
          r.root.rotation.set(0, angle + Math.PI * 0.5, Math.sin(elapsed * 18 + i) * 0.35);
          r.bodyTilt.rotation.set(0.2, 0, 0);
          this.animateRoachLimbs(r, elapsed, i * 1.7, true);
        }
      } else {
        // Phase 4 (4.1s - 4.5s): Cockroaches zip rapidly away outward after comic pop explosion!
        const zipT = Math.min(1, (t - 4.1) / 0.4);
        const dirs = [
          { vx: -attackerFacing * 11, vy: 5.5, vz: 3.5 },
          { vx: attackerFacing * 12, vy: 4.2, vz: 4.2 },
          { vx: -attackerFacing * 8, vy: 8.2, vz: -3.2 },
        ];
        for (let i = 0; i < 3; i++) {
          const r = this.roaches[i];
          r.root.visible = zipT < 0.98;
          const d = dirs[i];
          r.root.position.set(
            defenderX + d.vx * zipT,
            1.15 + d.vy * zipT,
            0.3 + d.vz * zipT,
          );
          r.root.scale.setScalar(Math.max(0.05, 1.15 * (1 - zipT * 0.65)));
          r.root.rotation.y = Math.atan2(d.vx, d.vz);
          r.bodyTilt.rotation.x = -0.35;
          this.animateRoachLimbs(r, elapsed, i * 2.3, true);
        }
      }
    } else {
      for (const r of this.roaches) {
        r.root.visible = false;
      }
    }

    // 3. Swirling Cartoon Smoke-Cloud Fight Cluster (Phase 3 & 4.1s Burst Explosion)
    let smokeDirty = false;
    if (superState?.active && superState.elapsed >= 2.1 && superState.elapsed < 4.1) {
      smokeDirty = true;
      const cloudT = superState.elapsed - 2.1;
      const growIn = 0.58 + 0.42 * Math.min(1, cloudT / 0.14);
      const hitThrob = 1 + Math.abs(Math.sin(cloudT * 18)) * 0.14;

      for (let i = 0; i < SMOKE_PUFF_POOL_SIZE; i++) {
        const orb = this.smokeOrbs[i];
        const a = orb.orbitAngle + cloudT * orb.orbitSpeed;
        const r = orb.orbitRadius * growIn * hitThrob;
        const px = defenderX + Math.cos(a) * r * 1.2;
        const py = 0.24 + orb.yOffset * growIn + Math.sin(elapsed * 10 + orb.bobPhase) * 0.16;
        const pz = orb.zOffset * growIn + Math.sin(a) * 0.58;
        orb.burstX = px;
        orb.burstY = py;
        orb.burstZ = pz;

        const puffScale =
          orb.baseScale * growIn * (0.86 + Math.sin(elapsed * 14 + orb.bobPhase) * 0.22);
        _pos.set(px, py, pz);
        _euler.set(a * 0.7, a, orb.bobPhase);
        _quat.setFromEuler(_euler);
        _scale.setScalar(puffScale);
        _mat4.compose(_pos, _quat, _scale);
        this.smokeMesh.setMatrixAt(i, _mat4);
      }
    } else if (this.smokePopBurstActive) {
      smokeDirty = true;
      this.smokePopTimer += dt;
      const p = Math.min(1, this.smokePopTimer / 0.42);
      if (p >= 1) {
        this.smokePopBurstActive = false;
        for (let i = 0; i < SMOKE_PUFF_POOL_SIZE; i++) {
          _mat4.makeScale(0, 0, 0);
          this.smokeMesh.setMatrixAt(i, _mat4);
        }
      } else {
        for (let i = 0; i < SMOKE_PUFF_POOL_SIZE; i++) {
          const orb = this.smokeOrbs[i];
          const px = orb.burstX + orb.burstVx * this.smokePopTimer;
          const py = Math.max(0.15, orb.burstY + orb.burstVy * this.smokePopTimer);
          const pz = orb.burstZ + orb.burstVz * this.smokePopTimer;
          const s = orb.baseScale * (1 - p) * (1 + p * 0.4);
          _pos.set(px, py, pz);
          _euler.set(p * 4, p * 5 + orb.bobPhase, 0);
          _quat.setFromEuler(_euler);
          _scale.setScalar(Math.max(0.01, s));
          _mat4.compose(_pos, _quat, _scale);
          this.smokeMesh.setMatrixAt(i, _mat4);
        }
      }
    }
    if (smokeDirty) {
      this.smokeMesh.instanceMatrix.needsUpdate = true;
    }

    // 4. Comic Starburst Flashes & Expanding Pop Ring
    let sparkDirty = false;
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i];
      if (!s.active) continue;
      sparkDirty = true;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        _mat4.makeScale(0, 0, 0);
        this.starburstMesh.setMatrixAt(i, _mat4);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.rot += s.vRot * dt;
      const frac = s.life / s.maxLife;
      const sc = s.scale * Math.sin(frac * Math.PI);
      _pos.set(s.x, s.y, s.z);
      _euler.set(s.rot, s.rot * 1.3, s.rot * 0.7);
      _quat.setFromEuler(_euler);
      _scale.set(sc * 1.45, sc * 0.55, sc * 0.55);
      _mat4.compose(_pos, _quat, _scale);
      this.starburstMesh.setMatrixAt(i, _mat4);
    }
    if (sparkDirty) {
      this.starburstMesh.instanceMatrix.needsUpdate = true;
    }

    if (this.popRingTimer > 0) {
      this.popRingTimer = Math.max(0, this.popRingTimer - dt);
      const p = 1 - this.popRingTimer / this.popRingDuration;
      const sc = 0.65 + p * 4.4;
      this.popRing.scale.set(sc, sc, 1);
      this.popRingMat.opacity = Math.max(0, (1 - p) * 0.96);
      if (this.popRingTimer <= 0) {
        this.popRing.visible = false;
      }
    }

    return dimFactor;
  }

  public setPrewarmVisible(visible: boolean): void {
    this.eyeBloomLight.intensity = visible ? 0.001 : 0;
    this.eyeRingOuter.visible = visible;
    this.eyeRingInner.visible = visible;
    this.eyeRingOuterMat.opacity = 0;
    this.eyeRingInnerMat.opacity = 0;
    this.popRing.visible = visible;
    this.popRingMat.opacity = 0;
    for (const r of this.roaches) {
      r.root.visible = visible;
      r.root.position.set(0, visible ? -40 : 0, 0);
    }
  }

  public reset(): void {
    this.eyeBloomLight.intensity = 0;
    this.eyeRingOuter.visible = false;
    this.eyeRingInner.visible = false;
    this.eyeRingOuterMat.opacity = 0;
    this.eyeRingInnerMat.opacity = 0;
    this.popRing.visible = false;
    this.popRingTimer = 0;
    this.launchOriginCaptured = false;
    this.smokePopBurstActive = false;
    this.smokePopTimer = 0;
    for (const r of this.roaches) {
      r.root.visible = false;
    }
    for (let i = 0; i < SMOKE_PUFF_POOL_SIZE; i++) {
      _mat4.makeScale(0, 0, 0);
      this.smokeMesh.setMatrixAt(i, _mat4);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < STARBURST_POOL_SIZE; i++) {
      this.sparks[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.starburstMesh.setMatrixAt(i, _mat4);
    }
    this.starburstMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.eyeBloomLight);
    scene.remove(this.group);
    this.eyeRingOuter.geometry.dispose();
    this.eyeRingOuterMat.dispose();
    this.eyeRingInner.geometry.dispose();
    this.eyeRingInnerMat.dispose();
    this.popRing.geometry.dispose();
    this.popRingMat.dispose();
    this.smokeMesh.geometry.dispose();
    (this.smokeMesh.material as THREE.Material).dispose();
    this.starburstMesh.geometry.dispose();
    (this.starburstMesh.material as THREE.Material).dispose();
    for (const r of this.roaches) {
      r.root.traverse((obj) => {
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
    }
  }
}
