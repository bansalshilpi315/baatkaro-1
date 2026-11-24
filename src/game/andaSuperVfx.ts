import * as THREE from 'three';
import type { AndaSuperBeatSignal, AndaSuperState } from './andaSuper';
import {
  ANDA_LIGHTNING_HIT_TIMES,
  ANDA_WALL_DROP_START,
  ANDA_WALL_IMPACT_TIME,
  ANDA_WALL_SHATTER_TIME,
  getAndaSkyFlash,
  getAndaSuperDimFactor,
  getAndaWallDropY,
} from './andaSuper';

interface BrickDebrisSlot {
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
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  color: THREE.Color;
}

interface ElectricSparkSlot {
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

const BRICK_DEBRIS_POOL_SIZE = 28;
const ELECTRIC_SPARK_POOL_SIZE = 36;

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

/**
 * Generates a crisp warm-terracotta red brick texture with off-white mortar lines
 * in staggered running-bond masonry for Anda Bhai's giant falling brick wall.
 */
function createRedBrickWallTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  // Crisp off-white mortar base
  ctx.fillStyle = '#EFE9DD';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cols = 4;
  const mortar = 8;
  const rowH = 512 / rows;
  const colW = 512 / cols;
  const brickPalette = ['#C8452E', '#B73B26', '#D55238', '#A8321F', '#C1402B', '#CF4B32'];

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 1 ? colW * 0.5 : 0;
    for (let col = -1; col <= cols; col++) {
      const bx = col * colW + offset + mortar * 0.5;
      const by = r * rowH + mortar * 0.5;
      const bw = colW - mortar;
      const bh = rowH - mortar;

      const idx = Math.abs(r * 7 + col * 5) % brickPalette.length;
      ctx.fillStyle = brickPalette[idx];
      ctx.fillRect(bx, by, bw, bh);

      // Warm sunlit upper brick bevel highlight
      ctx.fillStyle = 'rgba(255, 224, 198, 0.24)';
      ctx.fillRect(bx, by, bw, 7);
      // Shaded lower edge for tactile 3D relief
      ctx.fillStyle = 'rgba(72, 16, 8, 0.28)';
      ctx.fillRect(bx, by + bh - 7, bw, 7);
      // Subtle porous terracotta speckles
      ctx.fillStyle = 'rgba(58, 18, 10, 0.16)';
      ctx.fillRect(bx + ((r * 19 + col * 23) % 70) + 10, by + 18, 14, 5);
      ctx.fillRect(bx + ((r * 31 + col * 13) % 60) + 28, by + 34, 18, 4);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.25, 1.15);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds one jagged 3D lightning bolt group (pure-white inner core + glowing cyan outer halo
 * + forked side arc) spanning from y = 13.5 straight down to y = 0.25.
 */
function createLightningBoltMesh(
  seed: number,
  coreMat: THREE.MeshBasicMaterial,
  haloMat: THREE.MeshBasicMaterial,
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const group = new THREE.Group();
  const points: THREE.Vector3[] = [];
  const segCount = 9;
  for (let i = 0; i <= segCount; i++) {
    const t = i / segCount;
    const y = 13.6 * (1 - t) + 0.22 * t;
    const spread = i === 0 || i === segCount ? 0 : Math.sin(t * Math.PI) * 0.92;
    const zig = (i % 2 === 0 ? 1 : -1) * (0.45 + ((i * 17 + seed * 13) % 10) * 0.055);
    const zZig = Math.cos(i * 1.9 + seed) * 0.35 * spread;
    points.push(new THREE.Vector3(zig * spread, y, zZig));
  }

  const upAxis = new THREE.Vector3(0, 1, 0);
  const segDir = new THREE.Vector3();
  const mid = new THREE.Vector3();

  const addSegment = (a: THREE.Vector3, b: THREE.Vector3, coreR: number, haloR: number) => {
    segDir.subVectors(b, a);
    const len = segDir.length();
    if (len < 0.01) return;
    mid.addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(upAxis, segDir.clone().normalize());

    const coreGeo = new THREE.CylinderGeometry(coreR * 0.85, coreR, len * 1.06, 6);
    const haloGeo = new THREE.CylinderGeometry(haloR * 0.85, haloR, len * 1.08, 6);
    disposables.push(coreGeo, haloGeo);

    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.copy(mid);
    coreMesh.quaternion.copy(quat);
    group.add(coreMesh);

    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.copy(mid);
    haloMesh.quaternion.copy(quat);
    group.add(haloMesh);
  };

  for (let i = 0; i < points.length - 1; i++) {
    addSegment(points[i], points[i + 1], 0.085, 0.24);
    // Add 2 dramatic jagged side forks mid-bolt
    if (i === 2 || i === 5) {
      const sideDir = (i + seed) % 2 === 0 ? 1 : -1;
      const forkMid = points[i]
        .clone()
        .add(new THREE.Vector3(sideDir * 0.95, -1.1, sideDir * 0.25));
      const forkTip = forkMid
        .clone()
        .add(new THREE.Vector3(sideDir * 0.65, -1.35, -sideDir * 0.2));
      addSegment(points[i], forkMid, 0.045, 0.13);
      addSegment(forkMid, forkTip, 0.032, 0.095);
    }
  }

  group.visible = false;
  return group;
}

/**
 * Builds a chunky, composite 3D red-brick wall (bottom-center pivoted at y = 0)
 * with terracotta-brick CanvasTexture, chamfered stone coping ledge, plinth base,
 * and sculpted protruding brick quoins.
 */
function createGiantBrickWallMesh(
  brickTex: THREE.CanvasTexture,
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const root = new THREE.Group();

  const brickMat = new THREE.MeshStandardMaterial({
    map: brickTex,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.25,
  });
  const copingStoneMat = new THREE.MeshStandardMaterial({
    color: 0xd6cfc2,
    roughness: 0.78,
    metalness: 0.04,
    envMapIntensity: 0.3,
  });
  const accentBrickMat = new THREE.MeshStandardMaterial({
    color: 0xb93c26,
    roughness: 0.82,
    metalness: 0.02,
  });
  const crackMat = new THREE.MeshStandardMaterial({
    color: 0x291712,
    roughness: 0.95,
    metalness: 0,
  });
  disposables.push(brickMat, copingStoneMat, accentBrickMat, crackMat);

  // 1. Primary chunky red-brick masonry body (bottom rests at y = 0.18 above base plinth)
  const mainBodyGeo = new THREE.BoxGeometry(3.45, 2.86, 1.32);
  disposables.push(mainBodyGeo);
  const mainBody = new THREE.Mesh(mainBodyGeo, brickMat);
  mainBody.position.set(0, 1.61, 0);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  root.add(mainBody);

  // 2. Heavy concrete/stone base plinth resting flush on y = 0
  const plinthGeo = new THREE.BoxGeometry(3.68, 0.22, 1.48);
  disposables.push(plinthGeo);
  const plinth = new THREE.Mesh(plinthGeo, copingStoneMat);
  plinth.position.set(0, 0.11, 0);
  plinth.castShadow = true;
  root.add(plinth);

  // 3. Beveled stone coping ledge crowning the top of the Great Wall
  const copingGeo = new THREE.BoxGeometry(3.74, 0.26, 1.54);
  const copingCapGeo = new THREE.BoxGeometry(3.52, 0.14, 1.34);
  disposables.push(copingGeo, copingCapGeo);
  const coping = new THREE.Mesh(copingGeo, copingStoneMat);
  coping.position.set(0, 3.16, 0);
  coping.castShadow = true;
  root.add(coping);

  const copingCap = new THREE.Mesh(copingCapGeo, copingStoneMat);
  copingCap.position.set(0, 3.34, 0);
  root.add(copingCap);

  // 4. Protruding corner brick quoins along left & right edges for unmistakable chunky silhouette
  const quoinGeo = new THREE.BoxGeometry(0.28, 0.34, 1.42);
  disposables.push(quoinGeo);
  for (const side of [-1, 1] as const) {
    for (let r = 0; r < 4; r++) {
      const quoin = new THREE.Mesh(quoinGeo, accentBrickMat);
      quoin.position.set(side * 1.7, 0.56 + r * 0.72, 0);
      quoin.castShadow = true;
      root.add(quoin);
    }
  }

  // 5. Stylized comic stress cracks etched on the front face
  const crackGeo = new THREE.BoxGeometry(0.06, 0.72, 0.04);
  disposables.push(crackGeo);
  const c1 = new THREE.Mesh(crackGeo, crackMat);
  c1.position.set(-0.62, 1.95, 0.66);
  c1.rotation.z = 0.34;
  root.add(c1);

  const c2 = new THREE.Mesh(crackGeo, crackMat);
  c2.position.set(0.75, 1.25, 0.66);
  c2.rotation.z = -0.28;
  root.add(c2);

  root.visible = false;
  return root;
}

export class AndaSuperVfx {
  private group = new THREE.Group();
  private disposables: Array<{ dispose: () => void }> = [];

  // Stormy overhead light & cyan-white lightning flash PointLight
  private stormSpotLight: THREE.SpotLight;
  private lightningLight: THREE.PointLight;

  // Phase 2: 3 Pre-Built Jagged 3D Lightning Bolts + Expanding Floor Warning Shadow
  private bolts: THREE.Group[] = [];
  private boltCoreMat: THREE.MeshBasicMaterial;
  private boltHaloMat: THREE.MeshBasicMaterial;
  private boltFlashTimers: number[] = [0, 0, 0];
  private warningShadow: THREE.Mesh;
  private warningShadowMat: THREE.MeshBasicMaterial;

  // Phase 3: Massive Red-Brick Wall + Expanding Dust Ring + Flying Brick Rubble & Electric Sparks
  private wallMesh: THREE.Group;
  private brickTex: THREE.CanvasTexture;
  private dustRing: THREE.Mesh;
  private dustRingMat: THREE.MeshBasicMaterial;
  private dustRingTimer = 0;
  private readonly dustRingDuration = 0.52;

  private debrisMesh: THREE.InstancedMesh;
  private debrisSlots: BrickDebrisSlot[] = [];
  private debrisCursor = 0;

  private sparkMesh: THREE.InstancedMesh;
  private sparkSlots: ElectricSparkSlot[] = [];
  private sparkCursor = 0;

  constructor(scene: THREE.Scene) {
    // 1. Stormy dark-blue overhead SpotLight + cyan-white Lightning PointLight
    this.stormSpotLight = new THREE.SpotLight(0x93c5fd, 0, 26, Math.PI * 0.24, 0.55, 1.2);
    this.stormSpotLight.position.set(0, 9.2, 2.8);
    this.stormSpotLight.target.position.set(0, 1.2, 0);
    scene.add(this.stormSpotLight);
    scene.add(this.stormSpotLight.target);

    this.lightningLight = new THREE.PointLight(0xbae6fd, 0, 16, 1.2);
    this.lightningLight.position.set(0, 4.5, 1.5);
    scene.add(this.lightningLight);

    // 2. 3 Pre-Built Jagged 3D Cyan-White Lightning Bolts
    this.boltCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
    });
    this.boltHaloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposables.push(this.boltCoreMat, this.boltHaloMat);

    for (let i = 0; i < 3; i++) {
      const bolt = createLightningBoltMesh(i + 1, this.boltCoreMat, this.boltHaloMat, this.disposables);
      this.bolts.push(bolt);
      this.group.add(bolt);
    }

    // 3. Expanding Dark Warning Shadow on Arena Floor Beneath Opponent
    const warnGeo = new THREE.CircleGeometry(1.95, 28);
    this.warningShadowMat = new THREE.MeshBasicMaterial({
      color: 0x050814,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.disposables.push(warnGeo, this.warningShadowMat);
    this.warningShadow = new THREE.Mesh(warnGeo, this.warningShadowMat);
    this.warningShadow.rotation.x = -Math.PI / 2;
    this.warningShadow.position.set(0, 0.036, 0);
    this.warningShadow.visible = false;
    this.group.add(this.warningShadow);

    // 4. Massive Chunky Red-Brick Wall (Pre-Built Composite Group + CanvasTexture)
    this.brickTex = createRedBrickWallTexture();
    this.disposables.push(this.brickTex);
    this.wallMesh = createGiantBrickWallMesh(this.brickTex, this.disposables);
    this.group.add(this.wallMesh);

    // 5. Expanding Floor Impact Dust Ring
    const dustRingGeo = new THREE.RingGeometry(0.45, 1.28, 32);
    this.dustRingMat = new THREE.MeshBasicMaterial({
      color: 0xe7ddd0,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(dustRingGeo, this.dustRingMat);
    this.dustRing = new THREE.Mesh(dustRingGeo, this.dustRingMat);
    this.dustRing.rotation.x = -Math.PI / 2;
    this.dustRing.position.set(0, 0.055, 0);
    this.dustRing.visible = false;
    this.group.add(this.dustRing);

    // 6. Pre-Pooled 3D Flying Loose Brick Debris (InstancedMesh)
    const debrisGeo = new THREE.BoxGeometry(0.46, 0.24, 0.26);
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.02,
    });
    this.disposables.push(debrisGeo, debrisMat);
    this.debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, BRICK_DEBRIS_POOL_SIZE);
    this.debrisMesh.frustumCulled = false;

    for (let i = 0; i < BRICK_DEBRIS_POOL_SIZE; i++) {
      this.debrisSlots.push({
        active: false,
        x: 0,
        y: -100,
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
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        color: new THREE.Color(0xc8452e),
      });
      _mat4.makeScale(0, 0, 0);
      this.debrisMesh.setMatrixAt(i, _mat4);
      this.debrisMesh.setColorAt(i, _color.setHex(0xc8452e));
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
    this.group.add(this.debrisMesh);

    // 7. Pre-Pooled Electric Cyan & Impact Sparks (InstancedMesh)
    const sparkGeo = new THREE.OctahedronGeometry(0.16, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposables.push(sparkGeo, sparkMat);
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, ELECTRIC_SPARK_POOL_SIZE);
    this.sparkMesh.frustumCulled = false;

    for (let i = 0; i < ELECTRIC_SPARK_POOL_SIZE; i++) {
      this.sparkSlots.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.35,
        scale: 0,
        color: new THREE.Color(0x38bdf8),
      });
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, _color.setHex(0x38bdf8));
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    this.group.add(this.sparkMesh);

    scene.add(this.group);
  }

  public setPrewarmVisible(visible: boolean): void {
    this.wallMesh.visible = visible;
    this.warningShadow.visible = visible;
    this.dustRing.visible = visible;
    this.bolts[0].visible = visible;
    if (visible) {
      this.wallMesh.position.set(0, -40, 0);
      this.bolts[0].position.set(0, -40, 0);
    } else {
      this.reset();
    }
  }

  private spawnSparks(x: number, y: number, count: number, colorHex: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const slot = this.sparkSlots[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % ELECTRIC_SPARK_POOL_SIZE;
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.5;
      const spd = speed * (0.55 + Math.random() * 0.75);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.7;
      slot.y = y + (Math.random() - 0.5) * 0.6;
      slot.z = (Math.random() - 0.5) * 0.7;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.abs(Math.sin(angle)) * spd * 0.9 + 1.8;
      slot.vz = (Math.random() - 0.5) * spd * 0.85;
      slot.life = 0;
      slot.maxLife = 0.28 + Math.random() * 0.22;
      slot.scale = 0.75 + Math.random() * 0.75;
      slot.color.setHex(colorHex);
    }
  }

  private spawnBrickDebris(x: number, y: number, count: number, burstSpeed: number): void {
    const palette = [0xc8452e, 0xb73b26, 0xd55238, 0xd6cfc2, 0xa8321f];
    for (let i = 0; i < count; i++) {
      const slot = this.debrisSlots[this.debrisCursor];
      this.debrisCursor = (this.debrisCursor + 1) % BRICK_DEBRIS_POOL_SIZE;
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const spd = burstSpeed * (0.45 + Math.random() * 0.8);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 2.4;
      slot.y = y + Math.random() * 2.1;
      slot.z = (Math.random() - 0.5) * 1.1;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = 3.2 + Math.random() * burstSpeed * 0.95;
      slot.vz = Math.sin(angle) * spd * 0.7;
      slot.rx = Math.random() * Math.PI;
      slot.ry = Math.random() * Math.PI;
      slot.rz = Math.random() * Math.PI;
      slot.vrx = (Math.random() - 0.5) * 14;
      slot.vry = (Math.random() - 0.5) * 12;
      slot.vrz = (Math.random() - 0.5) * 14;
      slot.life = 0;
      slot.maxLife = 0.75 + Math.random() * 0.4;
      slot.scaleX = 0.7 + Math.random() * 0.75;
      slot.scaleY = 0.75 + Math.random() * 0.6;
      slot.scaleZ = 0.7 + Math.random() * 0.65;
      slot.color.setHex(palette[i % palette.length]);
    }
  }

  public handleBeatSignals(signals: AndaSuperBeatSignal[], lowGraphics: boolean): void {
    const scale = lowGraphics ? 0.55 : 1.0;
    for (const sig of signals) {
      if (sig.kind === 'lightning_strike') {
        const bIdx = (sig.boltIndex ?? 0) % 3;
        this.boltFlashTimers[bIdx] = 0.34;
        const bolt = this.bolts[bIdx];
        bolt.position.set(sig.x + ((bIdx - 1) * 0.28), 0, (bIdx - 1) * 0.14);
        bolt.rotation.y = bIdx * 1.2 + Math.random() * 0.4;
        this.spawnSparks(sig.x, 1.25, Math.round(14 * scale), 0x38bdf8, 7.6);
        this.spawnSparks(sig.x, 0.45, Math.round(8 * scale), 0xe0f2fe, 5.8);
      } else if (sig.kind === 'wall_impact') {
        this.dustRing.position.set(sig.x, 0.055, 0);
        this.dustRing.scale.set(0.6, 0.6, 1);
        this.dustRing.visible = true;
        this.dustRingTimer = this.dustRingDuration;
        this.spawnBrickDebris(sig.x, 0.35, Math.round(12 * scale), 6.2);
        this.spawnSparks(sig.x, 0.55, Math.round(16 * scale), 0xfef08a, 8.2);
        this.spawnSparks(sig.x, 0.65, Math.round(10 * scale), 0xef4444, 6.4);
      } else if (sig.kind === 'wall_shatter') {
        this.dustRing.position.set(sig.x, 0.055, 0);
        this.dustRing.scale.set(0.85, 0.85, 1);
        this.dustRing.visible = true;
        this.dustRingTimer = this.dustRingDuration;
        this.spawnBrickDebris(sig.x, 0.55, Math.round(24 * scale), 8.8);
        this.spawnSparks(sig.x, 1.1, Math.round(12 * scale), 0xfde047, 7.0);
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    superState: AndaSuperState | null,
    attackerX: number,
    defenderX: number,
  ): { dimFactor: number; skyFlash: number } {
    const dimFactor = superState?.active ? getAndaSuperDimFactor(superState.elapsed) : 0;
    const skyFlash = superState?.active ? getAndaSkyFlash(superState.elapsed) : 0;

    // 1. Stormy blue spotlight & cyan-white lightning flash PointLight
    if (superState?.active) {
      const t = superState.elapsed;
      const focusX = t < 1.4 ? attackerX : superState.targetX;
      this.stormSpotLight.position.set(focusX, 9.2, 2.8);
      this.stormSpotLight.target.position.set(focusX, 1.35, 0);
      this.stormSpotLight.target.updateMatrixWorld();
      this.stormSpotLight.intensity = dimFactor * 24;

      this.lightningLight.position.set(superState.targetX, 4.2, 1.6);
      this.lightningLight.intensity = skyFlash * 38;
    } else {
      this.stormSpotLight.intensity = 0;
      this.lightningLight.intensity = 0;
    }

    // 2. Jagged 3D Lightning Bolts (visible during active strike flash timers)
    for (let i = 0; i < this.bolts.length; i++) {
      if (this.boltFlashTimers[i] > 0) {
        this.boltFlashTimers[i] = Math.max(0, this.boltFlashTimers[i] - dt);
        const flicker = Math.sin(elapsed * 75 + i * 3) > -0.45;
        this.bolts[i].visible = this.boltFlashTimers[i] > 0 && flicker;
        const lifeFrac = this.boltFlashTimers[i] / 0.34;
        const widthScale = 0.65 + lifeFrac * 0.75;
        this.bolts[i].scale.set(widthScale, 1, widthScale);
      } else {
        this.bolts[i].visible = false;
      }
    }

    // 3. Expanding Dark Warning Shadow beneath Opponent during Phase 2 & Wall Drop
    if (superState?.active && superState.elapsed >= 1.4 && superState.elapsed < ANDA_WALL_SHATTER_TIME) {
      const t = superState.elapsed;
      const growT = Math.min(1, (t - 1.4) / (ANDA_WALL_IMPACT_TIME - 1.4));
      const pulse = 1 + Math.sin(elapsed * 18) * 0.04;
      this.warningShadow.visible = true;
      this.warningShadow.position.set(superState.targetX, 0.036, 0);
      const sx = (0.38 + growT * 0.92) * pulse;
      const sy = (0.28 + growT * 0.42) * pulse;
      this.warningShadow.scale.set(sx, sy, 1);
      this.warningShadowMat.opacity = 0.32 + growT * 0.44;
    } else {
      this.warningShadow.visible = false;
      this.warningShadowMat.opacity = 0;
    }

    // 4. Massive 3D Red-Brick Wall Drop & Impact Squash
    if (
      superState?.active &&
      superState.elapsed >= ANDA_WALL_DROP_START &&
      superState.elapsed < ANDA_WALL_SHATTER_TIME
    ) {
      const t = superState.elapsed;
      const wallY = getAndaWallDropY(t);
      this.wallMesh.visible = true;
      this.wallMesh.position.set(superState.targetX, wallY, 0);

      // Brief heavy elastic squash right on floor crash (2.74s..2.94s), subtle rumble before shatter
      let sx = 1.0;
      let sy = 1.0;
      let sz = 1.0;
      if (t >= ANDA_WALL_IMPACT_TIME) {
        const afterImpact = t - ANDA_WALL_IMPACT_TIME;
        const bounce = Math.exp(-afterImpact * 14) * Math.sin(afterImpact * 36);
        sx = 1 + Math.max(0, bounce) * 0.12;
        sy = 1 - Math.max(0, bounce) * 0.14;
        sz = 1 + Math.max(0, bounce) * 0.1;
        // Subtle tremor right before shattering at 3.54s
        if (t > ANDA_WALL_SHATTER_TIME - 0.22) {
          this.wallMesh.position.x += Math.sin(elapsed * 68) * 0.07;
        }
      }
      this.wallMesh.scale.set(sx, sy, sz);
    } else {
      this.wallMesh.visible = false;
    }

    // Also keep lightning strike warning bolts synced if triggered right on Phase 2 timestamps
    if (superState?.active && superState.elapsed >= ANDA_LIGHTNING_HIT_TIMES[0] && superState.elapsed < 2.55) {
      this.warningShadow.position.x = defenderX;
    }

    // 5. Expanding Dust Shockwave Ring
    if (this.dustRingTimer > 0) {
      this.dustRingTimer = Math.max(0, this.dustRingTimer - dt);
      const p = 1 - this.dustRingTimer / this.dustRingDuration;
      const ringScale = 0.65 + p * 3.8;
      this.dustRing.scale.set(ringScale, ringScale * 0.72, 1);
      this.dustRingMat.opacity = (1 - p) * 0.78;
      if (this.dustRingTimer <= 0) {
        this.dustRing.visible = false;
      }
    }

    // 6. Update Flying 3D Brick Debris Pool
    let debrisDirty = false;
    for (let i = 0; i < BRICK_DEBRIS_POOL_SIZE; i++) {
      const s = this.debrisSlots[i];
      if (!s.active) continue;
      debrisDirty = true;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        _mat4.makeScale(0, 0, 0);
        this.debrisMesh.setMatrixAt(i, _mat4);
        continue;
      }
      s.vy -= 22 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      if (s.y < 0.12) {
        s.y = 0.12;
        s.vy = Math.abs(s.vy) * 0.36;
        s.vx *= 0.72;
        s.vz *= 0.72;
      }
      s.rx += s.vrx * dt;
      s.ry += s.vry * dt;
      s.rz += s.vrz * dt;

      const fade = s.life > s.maxLife * 0.68 ? 1 - (s.life - s.maxLife * 0.68) / (s.maxLife * 0.32) : 1;
      _pos.set(s.x, s.y, s.z);
      _euler.set(s.rx, s.ry, s.rz);
      _quat.setFromEuler(_euler);
      _scale.set(s.scaleX * fade, s.scaleY * fade, s.scaleZ * fade);
      _mat4.compose(_pos, _quat, _scale);
      this.debrisMesh.setMatrixAt(i, _mat4);
      this.debrisMesh.setColorAt(i, s.color);
    }
    if (debrisDirty) {
      this.debrisMesh.instanceMatrix.needsUpdate = true;
      if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
    }

    // 7. Update Electric & Impact Sparks Pool
    let sparkDirty = false;
    for (let i = 0; i < ELECTRIC_SPARK_POOL_SIZE; i++) {
      const s = this.sparkSlots[i];
      if (!s.active) continue;
      sparkDirty = true;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        _mat4.makeScale(0, 0, 0);
        this.sparkMesh.setMatrixAt(i, _mat4);
        continue;
      }
      s.vy -= 14 * dt;
      s.x += s.vx * dt;
      s.y = Math.max(0.08, s.y + s.vy * dt);
      s.z += s.vz * dt;

      const fade = 1 - s.life / s.maxLife;
      _pos.set(s.x, s.y, s.z);
      _euler.set(s.life * 16, s.life * 14, i);
      _quat.setFromEuler(_euler);
      _scale.setScalar(s.scale * fade);
      _mat4.compose(_pos, _quat, _scale);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, s.color);
    }
    if (sparkDirty) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
      if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    }

    return { dimFactor, skyFlash };
  }

  public reset(): void {
    this.stormSpotLight.intensity = 0;
    this.lightningLight.intensity = 0;
    this.wallMesh.visible = false;
    this.warningShadow.visible = false;
    this.warningShadowMat.opacity = 0;
    this.dustRing.visible = false;
    this.dustRingTimer = 0;
    for (let i = 0; i < this.bolts.length; i++) {
      this.bolts[i].visible = false;
      this.boltFlashTimers[i] = 0;
    }
    for (let i = 0; i < BRICK_DEBRIS_POOL_SIZE; i++) {
      this.debrisSlots[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.debrisMesh.setMatrixAt(i, _mat4);
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < ELECTRIC_SPARK_POOL_SIZE; i++) {
      this.sparkSlots[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    scene.remove(this.stormSpotLight);
    scene.remove(this.stormSpotLight.target);
    scene.remove(this.lightningLight);
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
