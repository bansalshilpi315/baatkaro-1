import * as THREE from 'three';
import {
  FATHER_LEVITATE_Y,
  FATHER_PAPER_COUNT,
  type FatherSuperBeatSignal,
  type FatherSuperState,
} from './fatherSuper';

const SPARK_POOL_SIZE = 72;
const CONFETTI_POOL_SIZE = 32;
const BARRAGE_START = 2.8;
const MASTER_IMPACT_TIME = 4.5;

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _axis = new THREE.Vector3(0, 1, 0);
const _euler = new THREE.Euler();

interface PooledPaper {
  mesh: THREE.Mesh;
  orbitAngleOffset: number;
  orbitRadius: number;
  orbitHeightOffset: number;
  launchTime: number;
  arriveTime: number;
  arcHeight: number;
  arcZ: number;
  startX: number;
  startY: number;
  startZ: number;
  launched: boolean;
}

interface SparkSlot {
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

interface ConfettiSlot {
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
  life: number;
  maxLife: number;
  scale: number;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Generates a crisp pre-built red-bordered official notice CanvasTexture featuring
 * bold legible "RUSTICATE" text and principal seal for the 14 orbiting/barrage papers.
 */
function createRusticatePaperTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext('2d')!;

  // Crisp off-white official parchment paper
  ctx.fillStyle = '#FFF7F5';
  ctx.fillRect(0, 0, 256, 320);

  // Thick bright crimson warning border + inner hairline
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 306);
  ctx.strokeStyle = '#991B1B';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 216, 280);

  // Official top header bar
  ctx.fillStyle = '#B91C1C';
  ctx.fillRect(28, 30, 200, 38);
  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 20px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OFFICIAL NOTICE', 128, 50);

  // Faint printed form lines
  ctx.fillStyle = 'rgba(127, 29, 29, 0.24)';
  ctx.fillRect(36, 86, 184, 5);
  ctx.fillRect(36, 102, 152, 5);
  ctx.fillRect(36, 224, 184, 5);
  ctx.fillRect(36, 240, 140, 5);
  ctx.fillRect(36, 256, 166, 5);

  // Bold tilted crimson stamp box with crisp "RUSTICATE" text
  ctx.save();
  ctx.translate(128, 158);
  ctx.rotate(-0.14);
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(-102, -34, 204, 68);
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 4;
  ctx.strokeRect(-96, -28, 192, 56);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 32px Impact, "Arial Black", sans-serif';
  ctx.fillText('RUSTICATE', 0, 2);
  ctx.restore();

  // Official circular gold-red Principal seal at bottom right
  ctx.beginPath();
  ctx.arc(188, 272, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#DC2626';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#F59E0B';
  ctx.stroke();
  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 11px sans-serif';
  ctx.fillText('SEAL', 188, 273);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates the giant glowing crimson-gold "RUSTICATED!" Master Notice / Stamp texture
 * that slams straight down onto the opponent at 4.5s.
 */
function createMasterRusticatedTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const ctx = c.getContext('2d')!;

  // Rich crimson-to-maroon stamp banner backing
  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, '#991B1B');
  grad.addColorStop(0.5, '#DC2626');
  grad.addColorStop(1, '#7F1D1D');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);

  // Double gold official frame
  ctx.strokeStyle = '#FDE047';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, 492, 300);
  ctx.strokeStyle = '#FEF9C3';
  ctx.lineWidth = 4;
  ctx.strokeRect(26, 26, 460, 268);

  // Header
  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 28px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("PRINCIPAL'S FINAL ORDER", 256, 68);

  // Giant bold "RUSTICATED!" text with dark drop shadow
  ctx.fillStyle = '#450A0A';
  ctx.font = '900 72px Impact, "Arial Black", sans-serif';
  ctx.fillText('RUSTICATED!', 260, 174);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('RUSTICATED!', 256, 170);

  // Bottom bar
  ctx.fillStyle = '#FDE047';
  ctx.fillRect(58, 232, 396, 6);
  ctx.fillStyle = '#FECACA';
  ctx.font = '900 22px "Arial Black", sans-serif';
  ctx.fillText('NO RE-ADMISSION · CALL PARENTS', 256, 266);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Pre-pooled zero-GC 3D VFX manager for Father Roy Dolphus's
 * "RUSTICATION ORDER!" Super Power:
 * - Crimson-gold dramatic spotlight + aura point light
 * - Two spinning crimson-gold levitation halo rings around hovering Father
 * - 14 pre-pooled glowing red-bordered "RUSTICATE" official notices
 * - Giant glowing crimson-gold "RUSTICATED!" Master Notice / Stamp slamming down at 4.5s
 * - Expanding crimson shockwave floor ring + crimson-gold spark & paper confetti InstancedMeshes
 */
export class FatherSuperVfx {
  private root: THREE.Group;

  // Dramatic crimson-gold spotlight + hovering rim point light
  private spotLight: THREE.SpotLight;
  private spotTarget: THREE.Object3D;
  private auraLight: THREE.PointLight;
  private spotlightBeam: THREE.Mesh;
  private spotlightBeamMat: THREE.MeshBasicMaterial;

  // Spinning levitation aura rings beneath/around hovering Father
  private auraRingOuter: THREE.Mesh;
  private auraRingOuterMat: THREE.MeshBasicMaterial;
  private auraRingInner: THREE.Mesh;
  private auraRingInnerMat: THREE.MeshBasicMaterial;

  // 14 pre-pooled glowing "RUSTICATE" official notice papers
  private paperTex: THREE.CanvasTexture;
  private paperGeo: THREE.BoxGeometry;
  private paperMat: THREE.MeshStandardMaterial;
  private papers: PooledPaper[] = [];

  // Giant glowing crimson-gold "RUSTICATED!" Master Notice / Stamp slab
  private masterGroup: THREE.Group;
  private masterTex: THREE.CanvasTexture;
  private masterMat: THREE.MeshStandardMaterial;
  private masterRimMat: THREE.MeshStandardMaterial;

  // Expanding crimson ground shockwave ring on Master Notice slam
  private shockRing: THREE.Mesh;
  private shockRingMat: THREE.MeshBasicMaterial;
  private shockTimer = 0;

  // Pooled crimson-gold sparks + fluttering white/red paper confetti InstancedMeshes
  private sparkMesh: THREE.InstancedMesh;
  private sparks: SparkSlot[] = [];
  private sparkCursor = 0;

  private confettiMesh: THREE.InstancedMesh;
  private confetti: ConfettiSlot[] = [];
  private confettiCursor = 0;

  private dimFactor = 0;
  private isActive = false;

  constructor(scene: THREE.Scene) {
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);

    // 1. Crimson-gold overhead Spotlight & PointLight
    this.spotTarget = new THREE.Object3D();
    this.root.add(this.spotTarget);

    this.spotLight = new THREE.SpotLight(0xfef08a, 0, 26, Math.PI * 0.24, 0.55, 1.1);
    this.spotLight.position.set(0, 10.5, 3.2);
    this.spotLight.target = this.spotTarget;
    this.root.add(this.spotLight);

    this.auraLight = new THREE.PointLight(0xef4444, 0, 14, 1.3);
    this.root.add(this.auraLight);

    // Soft translucent crimson-gold vertical spotlight cone
    const beamGeo = new THREE.CylinderGeometry(0.65, 2.3, 10.2, 20, 1, true);
    this.spotlightBeamMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.spotlightBeam = new THREE.Mesh(beamGeo, this.spotlightBeamMat);
    this.root.add(this.spotlightBeam);

    // 2. Spinning crimson-gold levitation rings
    this.auraRingOuterMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.auraRingOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.24, 32),
      this.auraRingOuterMat,
    );
    this.auraRingOuter.rotation.x = -Math.PI / 2;
    this.root.add(this.auraRingOuter);

    this.auraRingInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.auraRingInner = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 28),
      this.auraRingInnerMat,
    );
    this.auraRingInner.rotation.x = -Math.PI / 2;
    this.root.add(this.auraRingInner);

    // 3. 14 pre-pooled glowing red-bordered "RUSTICATE" papers
    this.paperTex = createRusticatePaperTexture();
    this.paperGeo = new THREE.BoxGeometry(0.52, 0.66, 0.02);
    this.paperMat = new THREE.MeshStandardMaterial({
      map: this.paperTex,
      color: 0xffffff,
      emissive: new THREE.Color(0xdc2626),
      emissiveIntensity: 0.36,
      roughness: 0.38,
      metalness: 0.05,
    });

    for (let i = 0; i < FATHER_PAPER_COUNT; i++) {
      const mesh = new THREE.Mesh(this.paperGeo, this.paperMat);
      mesh.visible = false;
      this.root.add(mesh);
      const launchTime = BARRAGE_START + i * 0.088;
      const travelTime = 0.28 + (i % 3) * 0.035;
      this.papers.push({
        mesh,
        orbitAngleOffset: (i / FATHER_PAPER_COUNT) * Math.PI * 2,
        orbitRadius: 1.38 + (i % 3) * 0.32,
        orbitHeightOffset: ((i % 4) - 1.5) * 0.34,
        launchTime,
        arriveTime: Math.min(4.32, launchTime + travelTime),
        arcHeight: 0.45 + (i % 4) * 0.28,
        arcZ: ((i % 5) - 2) * 0.32,
        startX: 0,
        startY: FATHER_LEVITATE_Y + 1.0,
        startZ: 0,
        launched: false,
      });
    }

    // 4. Giant glowing crimson-gold "RUSTICATED!" Master Notice / Stamp
    this.masterGroup = new THREE.Group();
    this.masterTex = createMasterRusticatedTexture();
    this.masterMat = new THREE.MeshStandardMaterial({
      map: this.masterTex,
      color: 0xffffff,
      emissive: new THREE.Color(0xef4444),
      emissiveIntensity: 0.55,
      roughness: 0.32,
      metalness: 0.12,
    });
    this.masterRimMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.65,
    });

    const masterBoard = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.62, 0.16),
      [
        this.masterRimMat,
        this.masterRimMat,
        this.masterRimMat,
        this.masterRimMat,
        this.masterMat,
        this.masterMat,
      ],
    );
    masterBoard.castShadow = true;
    this.masterGroup.add(masterBoard);

    // Ornate stamp handle behind/above the slab so it reads like a colossal Principal Stamp!
    const stampStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, 0.46, 14),
      this.masterRimMat,
    );
    stampStem.position.set(0, 1.0, 0);
    const stampKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 14, 10),
      this.masterRimMat,
    );
    stampKnob.position.set(0, 1.32, 0);
    this.masterGroup.add(stampStem, stampKnob);
    this.masterGroup.visible = false;
    this.root.add(this.masterGroup);

    // 5. Dramatic crimson shockwave ring on the arena floor
    this.shockRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.shockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 1.15, 36),
      this.shockRingMat,
    );
    this.shockRing.rotation.x = -Math.PI / 2;
    this.shockRing.position.y = 0.06;
    this.shockRing.visible = false;
    this.root.add(this.shockRing);

    // 6. Pooled crimson-gold spark InstancedMesh
    const sparkGeo = new THREE.OctahedronGeometry(0.14, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, SPARK_POOL_SIZE);
    this.sparkMesh.frustumCulled = false;
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      this.sparks.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        scale: 0,
        color: new THREE.Color(0xef4444),
      });
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, this.sparks[i].color);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.root.add(this.sparkMesh);

    // 7. Pooled fluttering paper confetti InstancedMesh
    const confettiGeo = new THREE.PlaneGeometry(0.28, 0.36);
    const confettiMat = new THREE.MeshStandardMaterial({
      map: this.paperTex,
      color: 0xffffff,
      emissive: new THREE.Color(0xdc2626),
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
      roughness: 0.55,
    });
    this.confettiMesh = new THREE.InstancedMesh(confettiGeo, confettiMat, CONFETTI_POOL_SIZE);
    this.confettiMesh.frustumCulled = false;
    for (let i = 0; i < CONFETTI_POOL_SIZE; i++) {
      this.confetti.push({
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
        life: 0,
        maxLife: 1.0,
        scale: 0,
      });
      _mat4.makeScale(0, 0, 0);
      this.confettiMesh.setMatrixAt(i, _mat4);
    }
    this.confettiMesh.instanceMatrix.needsUpdate = true;
    this.root.add(this.confettiMesh);
  }

  public setPrewarmVisible(visible: boolean): void {
    this.root.visible = visible;
    this.masterGroup.visible = visible;
    this.shockRing.visible = visible;
    for (const p of this.papers) {
      p.mesh.visible = visible;
    }
  }

  public reset(): void {
    this.isActive = false;
    this.dimFactor = 0;
    this.shockTimer = 0;
    this.root.visible = false;
    this.spotLight.intensity = 0;
    this.auraLight.intensity = 0;
    this.spotlightBeamMat.opacity = 0;
    this.auraRingOuterMat.opacity = 0;
    this.auraRingInnerMat.opacity = 0;
    this.masterGroup.visible = false;
    this.shockRing.visible = false;
    for (const p of this.papers) {
      p.mesh.visible = false;
      p.launched = false;
    }
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      this.sparks[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < CONFETTI_POOL_SIZE; i++) {
      this.confetti[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.confettiMesh.setMatrixAt(i, _mat4);
    }
    this.confettiMesh.instanceMatrix.needsUpdate = true;
  }

  private spawnSparks(x: number, y: number, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const slot = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.75);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.35;
      slot.y = y + (Math.random() - 0.5) * 0.35;
      slot.z = 0.25 + (Math.random() - 0.5) * 0.6;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.sin(angle) * spd + 1.8;
      slot.vz = (Math.random() - 0.5) * 3.0;
      slot.life = 0;
      slot.maxLife = 0.28 + Math.random() * 0.24;
      slot.scale = 0.75 + Math.random() * 0.85;
      slot.color.setHex(i % 3 === 0 ? 0xfde047 : i % 3 === 1 ? 0xef4444 : 0xffffff);
    }
  }

  private spawnConfetti(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const slot = this.confetti[this.confettiCursor];
      this.confettiCursor = (this.confettiCursor + 1) % CONFETTI_POOL_SIZE;
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 2.6 + Math.random() * 4.4;
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.5;
      slot.y = y + 0.3 + Math.random() * 0.5;
      slot.z = (Math.random() - 0.5) * 0.8;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = 3.2 + Math.random() * 3.8;
      slot.vz = Math.sin(angle) * spd * 0.65;
      slot.rx = Math.random() * Math.PI;
      slot.ry = Math.random() * Math.PI;
      slot.rz = Math.random() * Math.PI;
      slot.life = 0;
      slot.maxLife = 0.75 + Math.random() * 0.45;
      slot.scale = 0.85 + Math.random() * 0.45;
    }
  }

  public handleBeatSignals(signals: FatherSuperBeatSignal[], lowGraphics: boolean): void {
    const scaleFactor = lowGraphics ? 0.55 : 1;
    for (const sig of signals) {
      if (sig.kind === 'levitate_start') {
        for (const p of this.papers) {
          p.launched = false;
          p.mesh.visible = false;
        }
        this.spawnSparks(sig.x, sig.y, Math.round(14 * scaleFactor), 5.6);
      } else if (sig.kind === 'papers_summon') {
        this.spawnSparks(sig.x, sig.y, Math.round(18 * scaleFactor), 6.2);
      } else if (sig.kind === 'barrage_start') {
        this.spawnSparks(sig.x, sig.y, Math.round(16 * scaleFactor), 6.8);
      } else if (sig.kind === 'paper_hit') {
        this.spawnSparks(sig.x, sig.y, Math.round(10 * scaleFactor), 6.4);
        this.spawnConfetti(sig.x, sig.y, Math.round(3 * scaleFactor));
      } else if (sig.kind === 'master_notice_impact') {
        this.shockTimer = 0.58;
        this.shockRing.position.set(sig.x, 0.06, 0);
        this.shockRing.scale.set(0.5, 0.5, 1);
        this.shockRing.visible = true;
        this.shockRingMat.opacity = 0.95;
        this.spawnSparks(sig.x, sig.y, Math.round(32 * scaleFactor), 9.4);
        this.spawnConfetti(sig.x, sig.y, Math.round(24 * scaleFactor));
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    sup: FatherSuperState | null,
    attackerX: number,
    attackerY: number,
    attackerFacing: 1 | -1,
    defenderX: number,
  ): number {
    const running = Boolean(sup && sup.active);
    if (running) {
      this.isActive = true;
      this.root.visible = true;
    }

    if (!this.isActive) return 0;

    // Update crimson-gold sparks
    let sparksDirty = false;
    let anyActive = running;
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      const s = this.sparks[i];
      if (!s.active) continue;
      anyActive = true;
      sparksDirty = true;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        _mat4.makeScale(0, 0, 0);
        this.sparkMesh.setMatrixAt(i, _mat4);
        continue;
      }
      s.vy -= 11 * dt;
      s.x += s.vx * dt;
      s.y = Math.max(0.06, s.y + s.vy * dt);
      s.z += s.vz * dt;
      const sc = s.scale * (1 - s.life / s.maxLife);
      _pos.set(s.x, s.y, s.z);
      _scale.set(sc, sc, sc);
      _quat.setFromAxisAngle(_axis, s.life * 14);
      _mat4.compose(_pos, _quat, _scale);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, s.color);
    }
    if (sparksDirty) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
      if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    }

    // Update fluttering paper confetti
    let confettiDirty = false;
    for (let i = 0; i < CONFETTI_POOL_SIZE; i++) {
      const c = this.confetti[i];
      if (!c.active) continue;
      anyActive = true;
      confettiDirty = true;
      c.life += dt;
      if (c.life >= c.maxLife) {
        c.active = false;
        _mat4.makeScale(0, 0, 0);
        this.confettiMesh.setMatrixAt(i, _mat4);
        continue;
      }
      // Gentle paper flutter air resistance
      c.vx *= Math.max(0, 1 - dt * 1.9);
      c.vz *= Math.max(0, 1 - dt * 1.9);
      c.vy -= 5.8 * dt;
      c.x += c.vx * dt + Math.sin(elapsed * 9 + i) * dt * 0.7;
      c.y = Math.max(0.08, c.y + c.vy * dt);
      c.z += c.vz * dt;
      c.rx += dt * 7.5;
      c.ry += dt * 5.2;
      c.rz += dt * 6.4;
      const sc = c.scale * (1 - (c.life / c.maxLife) * 0.45);
      _pos.set(c.x, c.y, c.z);
      _euler.set(c.rx, c.ry, c.rz);
      _quat.setFromEuler(_euler);
      _scale.set(sc, sc, sc);
      _mat4.compose(_pos, _quat, _scale);
      this.confettiMesh.setMatrixAt(i, _mat4);
    }
    if (confettiDirty) {
      this.confettiMesh.instanceMatrix.needsUpdate = true;
    }

    // Update ground shockwave ring
    if (this.shockTimer > 0) {
      anyActive = true;
      this.shockTimer = Math.max(0, this.shockTimer - dt);
      const p = 1 - this.shockTimer / 0.58;
      const sc = 0.55 + (1 - (1 - p) * (1 - p)) * 3.8;
      this.shockRing.scale.set(sc, sc, 1);
      this.shockRingMat.opacity = Math.max(0, (1 - p) * 0.94);
      if (this.shockTimer <= 0) {
        this.shockRing.visible = false;
      }
    }

    if (!running || !sup) {
      this.dimFactor = Math.max(0, this.dimFactor - dt * 2.8);
      this.spotLight.intensity = Math.max(0, this.spotLight.intensity - dt * 70);
      this.auraLight.intensity = Math.max(0, this.auraLight.intensity - dt * 35);
      this.spotlightBeamMat.opacity = Math.max(0, this.spotlightBeamMat.opacity - dt * 0.8);
      this.auraRingOuterMat.opacity = 0;
      this.auraRingInnerMat.opacity = 0;
      this.masterGroup.visible = false;
      for (const p of this.papers) {
        p.mesh.visible = false;
      }
      if (!anyActive && this.dimFactor <= 0.001) {
        this.isActive = false;
        this.root.visible = false;
      }
      return this.dimFactor;
    }

    const t = sup.elapsed;

    // Smooth arena dim envelope (dims smoothly in 0..0.4s, restores smoothly 4.7s..5.2s)
    const fadeIn = smoothstep(t / 0.42);
    const fadeOut = t > 4.7 ? 1 - smoothstep((t - 4.7) / 0.5) : 1;
    this.dimFactor = fadeIn * fadeOut * 0.86;

    // Crimson-gold spotlight tracking hovering Father Roy Dolphus
    const centerY = attackerY + 1.15;
    this.spotLight.position.set(attackerX, 10.6, 2.8);
    this.spotTarget.position.set(attackerX, centerY, 0);
    this.spotTarget.updateMatrixWorld();
    this.spotLight.intensity = 42 * fadeIn * fadeOut;

    this.auraLight.position.set(attackerX, centerY + 0.15, 0.7);
    this.auraLight.intensity = (14 + Math.sin(elapsed * 12) * 3.5) * fadeIn * fadeOut;

    this.spotlightBeam.position.set(attackerX, 5.1, 0);
    this.spotlightBeamMat.opacity = 0.13 * fadeIn * fadeOut;

    // Spinning crimson-gold levitation rings under Father
    const ringAlpha = smoothstep(t / 0.55) * fadeOut;
    this.auraRingOuter.position.set(attackerX, attackerY + 0.16, 0);
    this.auraRingOuter.rotation.z = elapsed * 2.4;
    this.auraRingOuterMat.opacity = 0.65 * ringAlpha;

    this.auraRingInner.position.set(attackerX, attackerY + 0.08, 0);
    this.auraRingInner.rotation.z = -elapsed * 3.6;
    this.auraRingInnerMat.opacity = 0.72 * ringAlpha;

    // Phase 2 & 3: 14 glowing red-bordered "RUSTICATE" papers descending -> orbiting -> homing barrage!
    if (t >= 1.5 && t < 4.55) {
      const summonT = smoothstep((t - 1.5) / 0.55);
      const orbitSpeed = t < BARRAGE_START ? 4.4 + summonT * 2.2 : 6.6;

      for (let i = 0; i < this.papers.length; i++) {
        const p = this.papers[i];
        const angle = p.orbitAngleOffset + (t - 1.5) * orbitSpeed * attackerFacing;
        const orbitX = attackerX + Math.cos(angle) * p.orbitRadius;
        const orbitY =
          attackerY +
          1.15 +
          p.orbitHeightOffset +
          (1 - summonT) * 3.6 +
          Math.sin(angle * 2) * 0.12;
        const orbitZ = Math.sin(angle) * p.orbitRadius * 0.72;

        if (t < p.launchTime) {
          p.launched = false;
          p.mesh.visible = true;
          p.mesh.position.set(orbitX, orbitY, orbitZ);
          p.mesh.rotation.set(
            Math.sin(elapsed * 4 + i) * 0.18,
            -angle + Math.PI * 0.5,
            Math.cos(elapsed * 5 + i) * 0.14,
          );
          const sc = 0.45 + summonT * 0.62;
          p.mesh.scale.set(sc, sc, 1);
        } else if (t <= p.arriveTime) {
          if (!p.launched) {
            p.launched = true;
            p.startX = orbitX;
            p.startY = orbitY;
            p.startZ = orbitZ;
          }
          const flightT = smoothstep((t - p.launchTime) / Math.max(0.08, p.arriveTime - p.launchTime));
          const targetY = 1.05 + (i % 3) * 0.25;
          const x = THREE.MathUtils.lerp(p.startX, defenderX, flightT);
          const y =
            THREE.MathUtils.lerp(p.startY, targetY, flightT) +
            Math.sin(flightT * Math.PI) * p.arcHeight;
          const z =
            THREE.MathUtils.lerp(p.startZ, 0.12, flightT) +
            Math.sin(flightT * Math.PI) * p.arcZ;
          p.mesh.visible = true;
          p.mesh.position.set(x, y, z);
          p.mesh.rotation.set(flightT * 10, flightT * 8, flightT * 14);
          p.mesh.scale.set(1.12, 1.12, 1);
        } else {
          p.mesh.visible = false;
        }
      }
    } else {
      for (const p of this.papers) {
        p.mesh.visible = false;
      }
    }

    // Phase 3 Finisher (4.22s..5.02s): Giant glowing crimson-gold "RUSTICATED!" Master Notice / Stamp
    if (t >= 4.22 && t <= 5.02) {
      this.masterGroup.visible = true;
      if (t < MASTER_IMPACT_TIME) {
        // Materialize high above defender and slam straight down!
        const slamT = smoothstep((t - 4.22) / (MASTER_IMPACT_TIME - 4.22));
        const accel = slamT * slamT;
        const dropY = THREE.MathUtils.lerp(7.2, 1.05, accel);
        this.masterGroup.position.set(defenderX, dropY, 0.35);
        this.masterGroup.rotation.set(0, 0, THREE.MathUtils.lerp(-0.18, -0.05, slamT));
        const sc = THREE.MathUtils.lerp(0.75, 1.18, slamT);
        this.masterGroup.scale.set(sc, sc, 1);
      } else {
        // Impact bounce & authoritative stamp hold before clean fade-out
        const holdT = (t - MASTER_IMPACT_TIME) / (5.02 - MASTER_IMPACT_TIME);
        const bounce = Math.exp(-holdT * 10) * Math.sin(holdT * 26) * 0.14;
        const shrink = holdT > 0.65 ? 1 - smoothstep((holdT - 0.65) / 0.35) : 1;
        this.masterGroup.position.set(defenderX, 1.05 + Math.abs(bounce), 0.35);
        this.masterGroup.rotation.set(0, 0, -0.05);
        this.masterGroup.scale.set(1.18 * shrink, 1.18 * shrink, 1);
      }
    } else {
      this.masterGroup.visible = false;
    }

    return this.dimFactor;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.root);
    this.paperTex.dispose();
    this.paperGeo.dispose();
    this.paperMat.dispose();
    this.masterTex.dispose();
    this.masterMat.dispose();
    this.masterRimMat.dispose();
    this.spotlightBeam.geometry.dispose();
    this.spotlightBeamMat.dispose();
    this.auraRingOuter.geometry.dispose();
    this.auraRingOuterMat.dispose();
    this.auraRingInner.geometry.dispose();
    this.auraRingInnerMat.dispose();
    this.shockRing.geometry.dispose();
    this.shockRingMat.dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.confettiMesh.geometry.dispose();
    (this.confettiMesh.material as THREE.Material).dispose();
  }
}
