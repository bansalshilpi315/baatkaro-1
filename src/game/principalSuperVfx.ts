import * as THREE from 'three';
import {
  PRINCIPAL_LEVITATE_Y,
  PRINCIPAL_PAPER_COUNT,
  type PrincipalSuperBeatSignal,
  type PrincipalSuperState,
} from './principalSuper';

const SPARK_POOL_SIZE = 72;
const CONFETTI_POOL_SIZE = 44;
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
 * Generates crisp pre-built red-bordered official notice CanvasTextures cycling
 * "RUSTICATE", "DISCIPLINE", and "RUSTICATED" across the 14 swirling papers.
 */
function createPrincipalNoticeTexture(stampWord: 'RUSTICATE' | 'DISCIPLINE' | 'RUSTICATED'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#FFF7F5';
  ctx.fillRect(0, 0, 256, 320);

  // Glowing crimson warning border + crisp inner rule
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 306);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 216, 280);

  // Header strip
  ctx.fillStyle = '#B91C1C';
  ctx.fillRect(28, 30, 200, 38);
  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 18px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRINCIPAL NOTICE', 128, 50);

  // Faint printed form lines
  ctx.fillStyle = 'rgba(127, 29, 29, 0.25)';
  ctx.fillRect(36, 86, 184, 5);
  ctx.fillRect(36, 102, 152, 5);
  ctx.fillRect(36, 224, 184, 5);
  ctx.fillRect(36, 240, 140, 5);
  ctx.fillRect(36, 256, 166, 5);

  // Bold tilted crimson stamp box
  ctx.save();
  ctx.translate(128, 158);
  ctx.rotate(-0.13);
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(-104, -34, 208, 68);
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 4;
  ctx.strokeRect(-98, -28, 196, 56);
  ctx.fillStyle = '#FFFFFF';
  ctx.font =
    stampWord === 'RUSTICATED'
      ? '900 28px Impact, "Arial Black", sans-serif'
      : '900 30px Impact, "Arial Black", sans-serif';
  ctx.fillText(stampWord, 0, 2);
  ctx.restore();

  // Gold-red Principal seal
  ctx.beginPath();
  ctx.arc(188, 272, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#DC2626';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#F59E0B';
  ctx.stroke();
  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 10px sans-serif';
  ctx.fillText('ORDER', 188, 273);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates the giant glowing red "FINAL RUSTICATION!" Notice Stamp texture
 * that slams straight down onto the opponent at 4.5s.
 */
function createFinalRusticationTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, '#991B1B');
  grad.addColorStop(0.5, '#EF4444');
  grad.addColorStop(1, '#7F1D1D');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);

  ctx.strokeStyle = '#FDE047';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, 492, 300);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.strokeRect(26, 26, 460, 268);

  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 26px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRINCIPAL MAN · DISCIPLINE ORDER', 256, 68);

  ctx.fillStyle = '#450A0A';
  ctx.font = '900 50px Impact, "Arial Black", sans-serif';
  ctx.fillText('FINAL RUSTICATION!', 260, 174);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('FINAL RUSTICATION!', 256, 170);

  ctx.fillStyle = '#FDE047';
  ctx.fillRect(54, 232, 404, 6);
  ctx.fillStyle = '#FECACA';
  ctx.font = '900 21px "Arial Black", sans-serif';
  ctx.fillText('DIARY SIGNED · CALL PARENTS TOMORROW', 256, 266);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Pre-pooled zero-GC 3D VFX manager for Principal Man's
 * "RUSTICATION ORDER!" Super Power:
 * - Pulsing golden-orange levitation aura sphere + dual spinning halo rings + warm spotlight
 * - Swirling admin-paper wind motes & paper sheets during levitation
 * - 14 pre-pooled glowing red-bordered notices cycling "RUSTICATE", "DISCIPLINE", "RUSTICATED"
 * - Giant glowing red "FINAL RUSTICATION!" Master Stamp slamming down at 4.5s
 * - Expanding red shockwave floor ring + spark & paper confetti bursts
 */
export class PrincipalSuperVfx {
  private root: THREE.Group;

  private spotLight: THREE.SpotLight;
  private spotTarget: THREE.Object3D;
  private auraLight: THREE.PointLight;
  private spotlightBeam: THREE.Mesh;
  private spotlightBeamMat: THREE.MeshBasicMaterial;

  // Pulsing golden-orange levitation aura around Principal Man
  private auraSphere: THREE.Mesh;
  private auraSphereMat: THREE.MeshBasicMaterial;
  private auraRingOuter: THREE.Mesh;
  private auraRingOuterMat: THREE.MeshBasicMaterial;
  private auraRingInner: THREE.Mesh;
  private auraRingInnerMat: THREE.MeshBasicMaterial;

  // 14 pre-pooled glowing red-bordered notice papers (3 label variants)
  private paperTextures: THREE.CanvasTexture[];
  private paperGeo: THREE.BoxGeometry;
  private paperMaterials: THREE.MeshStandardMaterial[];
  private papers: PooledPaper[] = [];

  // Giant glowing red "FINAL RUSTICATION!" Notice Stamp
  private masterGroup: THREE.Group;
  private masterTex: THREE.CanvasTexture;
  private masterMat: THREE.MeshStandardMaterial;
  private masterRimMat: THREE.MeshStandardMaterial;

  // Expanding red ground shockwave ring on slam
  private shockRing: THREE.Mesh;
  private shockRingMat: THREE.MeshBasicMaterial;
  private shockTimer = 0;

  // Pooled golden-orange/red sparks + fluttering paper confetti
  private sparkMesh: THREE.InstancedMesh;
  private sparks: SparkSlot[] = [];
  private sparkCursor = 0;

  private confettiMesh: THREE.InstancedMesh;
  private confetti: ConfettiSlot[] = [];
  private confettiCursor = 0;

  private windEmitAccum = 0;
  private dimFactor = 0;
  private isActive = false;

  constructor(scene: THREE.Scene) {
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);

    // 1. Golden-orange overhead spotlight & aura light
    this.spotTarget = new THREE.Object3D();
    this.root.add(this.spotTarget);

    this.spotLight = new THREE.SpotLight(0xfdba74, 0, 26, Math.PI * 0.25, 0.55, 1.1);
    this.spotLight.position.set(0, 10.5, 3.2);
    this.spotLight.target = this.spotTarget;
    this.root.add(this.spotLight);

    this.auraLight = new THREE.PointLight(0xf97316, 0, 15, 1.25);
    this.root.add(this.auraLight);

    const beamGeo = new THREE.CylinderGeometry(0.68, 2.45, 10.4, 20, 1, true);
    this.spotlightBeamMat = new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.spotlightBeam = new THREE.Mesh(beamGeo, this.spotlightBeamMat);
    this.root.add(this.spotlightBeam);

    // 2. Pulsing golden-orange levitation aura sphere + dual halo rings
    this.auraSphereMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.auraSphere = new THREE.Mesh(new THREE.SphereGeometry(1.18, 22, 16), this.auraSphereMat);
    this.root.add(this.auraSphere);

    this.auraRingOuterMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.auraRingOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.98, 1.32, 32),
      this.auraRingOuterMat,
    );
    this.auraRingOuter.rotation.x = -Math.PI / 2;
    this.root.add(this.auraRingOuter);

    this.auraRingInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.auraRingInner = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.76, 28),
      this.auraRingInnerMat,
    );
    this.auraRingInner.rotation.x = -Math.PI / 2;
    this.root.add(this.auraRingInner);

    // 3. 14 pre-pooled glowing red-bordered notices cycling "RUSTICATE", "DISCIPLINE", "RUSTICATED"
    this.paperTextures = [
      createPrincipalNoticeTexture('RUSTICATE'),
      createPrincipalNoticeTexture('DISCIPLINE'),
      createPrincipalNoticeTexture('RUSTICATED'),
    ];
    this.paperGeo = new THREE.BoxGeometry(0.54, 0.68, 0.02);
    this.paperMaterials = this.paperTextures.map(
      (tex) =>
        new THREE.MeshStandardMaterial({
          map: tex,
          color: 0xffffff,
          emissive: new THREE.Color(0xef4444),
          emissiveIntensity: 0.38,
          roughness: 0.36,
          metalness: 0.05,
        }),
    );

    for (let i = 0; i < PRINCIPAL_PAPER_COUNT; i++) {
      const mat = this.paperMaterials[i % this.paperMaterials.length];
      const mesh = new THREE.Mesh(this.paperGeo, mat);
      mesh.visible = false;
      this.root.add(mesh);
      const launchTime = BARRAGE_START + i * 0.088;
      const travelTime = 0.28 + (i % 3) * 0.035;
      this.papers.push({
        mesh,
        orbitAngleOffset: (i / PRINCIPAL_PAPER_COUNT) * Math.PI * 2,
        orbitRadius: 1.42 + (i % 3) * 0.32,
        orbitHeightOffset: ((i % 4) - 1.5) * 0.34,
        launchTime,
        arriveTime: Math.min(4.32, launchTime + travelTime),
        arcHeight: 0.45 + (i % 4) * 0.28,
        arcZ: ((i % 5) - 2) * 0.32,
        startX: 0,
        startY: PRINCIPAL_LEVITATE_Y + 1.0,
        startZ: 0,
        launched: false,
      });
    }

    // 4. Giant glowing red "FINAL RUSTICATION!" Notice Stamp
    this.masterGroup = new THREE.Group();
    this.masterTex = createFinalRusticationTexture();
    this.masterMat = new THREE.MeshStandardMaterial({
      map: this.masterTex,
      color: 0xffffff,
      emissive: new THREE.Color(0xef4444),
      emissiveIntensity: 0.62,
      roughness: 0.3,
      metalness: 0.14,
    });
    this.masterRimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: new THREE.Color(0xdc2626),
      emissiveIntensity: 0.65,
      roughness: 0.24,
      metalness: 0.62,
    });

    const masterBoard = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 1.66, 0.16),
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

    const stampStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, 0.46, 14),
      this.masterRimMat,
    );
    stampStem.position.set(0, 1.02, 0);
    const stampKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 14, 10),
      this.masterRimMat,
    );
    stampKnob.position.set(0, 1.34, 0);
    this.masterGroup.add(stampStem, stampKnob);
    this.masterGroup.visible = false;
    this.root.add(this.masterGroup);

    // 5. Big red ground shockwave ring on stamp slam
    this.shockRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.shockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 1.25, 36),
      this.shockRingMat,
    );
    this.shockRing.rotation.x = -Math.PI / 2;
    this.shockRing.position.y = 0.06;
    this.shockRing.visible = false;
    this.root.add(this.shockRing);

    // 6. Pooled golden-orange & red spark InstancedMesh
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
        color: new THREE.Color(0xf97316),
      });
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, this.sparks[i].color);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.root.add(this.sparkMesh);

    // 7. Pooled swirling admin-paper wind & post-slam paper confetti InstancedMesh
    const confettiGeo = new THREE.PlaneGeometry(0.28, 0.36);
    const confettiMat = new THREE.MeshStandardMaterial({
      map: this.paperTextures[0],
      color: 0xffffff,
      emissive: new THREE.Color(0xdc2626),
      emissiveIntensity: 0.24,
      side: THREE.DoubleSide,
      roughness: 0.52,
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
    this.auraSphere.visible = visible;
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
    this.windEmitAccum = 0;
    this.root.visible = false;
    this.spotLight.intensity = 0;
    this.auraLight.intensity = 0;
    this.spotlightBeamMat.opacity = 0;
    this.auraSphereMat.opacity = 0;
    this.auraSphere.visible = false;
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
      slot.x = x + (Math.random() - 0.5) * 0.38;
      slot.y = y + (Math.random() - 0.5) * 0.38;
      slot.z = 0.22 + (Math.random() - 0.5) * 0.6;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.sin(angle) * spd + 1.8;
      slot.vz = (Math.random() - 0.5) * 3.0;
      slot.life = 0;
      slot.maxLife = 0.28 + Math.random() * 0.26;
      slot.scale = 0.75 + Math.random() * 0.85;
      slot.color.setHex(i % 3 === 0 ? 0xfbbf24 : i % 3 === 1 ? 0xf97316 : 0xef4444);
    }
  }

  private spawnConfetti(x: number, y: number, count: number, swirlingWind = false): void {
    for (let i = 0; i < count; i++) {
      const slot = this.confetti[this.confettiCursor];
      this.confettiCursor = (this.confettiCursor + 1) % CONFETTI_POOL_SIZE;
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.5;
      const spd = swirlingWind ? 1.8 + Math.random() * 2.2 : 2.8 + Math.random() * 4.5;
      slot.active = true;
      slot.x = x + (swirlingWind ? Math.cos(angle) * 1.1 : (Math.random() - 0.5) * 0.5);
      slot.y = y + (swirlingWind ? -0.4 + Math.random() * 1.1 : 0.3 + Math.random() * 0.5);
      slot.z = swirlingWind ? Math.sin(angle) * 0.8 : (Math.random() - 0.5) * 0.8;
      slot.vx = Math.cos(angle + (swirlingWind ? 1.3 : 0)) * spd;
      slot.vy = swirlingWind ? 2.4 + Math.random() * 2.4 : 3.4 + Math.random() * 3.8;
      slot.vz = Math.sin(angle + (swirlingWind ? 1.3 : 0)) * spd * 0.65;
      slot.rx = Math.random() * Math.PI;
      slot.ry = Math.random() * Math.PI;
      slot.rz = Math.random() * Math.PI;
      slot.life = 0;
      slot.maxLife = swirlingWind ? 0.65 + Math.random() * 0.35 : 0.85 + Math.random() * 0.45;
      slot.scale = swirlingWind ? 0.68 + Math.random() * 0.32 : 0.9 + Math.random() * 0.45;
    }
  }

  public handleBeatSignals(signals: PrincipalSuperBeatSignal[], lowGraphics: boolean): void {
    const scaleFactor = lowGraphics ? 0.55 : 1;
    for (const sig of signals) {
      if (sig.kind === 'levitate_start') {
        for (const p of this.papers) {
          p.launched = false;
          p.mesh.visible = false;
        }
        this.spawnSparks(sig.x, sig.y, Math.round(18 * scaleFactor), 5.8);
        this.spawnConfetti(sig.x, sig.y - 0.3, Math.round(8 * scaleFactor), true);
      } else if (sig.kind === 'papers_summon') {
        this.spawnSparks(sig.x, sig.y, Math.round(18 * scaleFactor), 6.2);
      } else if (sig.kind === 'barrage_start') {
        this.spawnSparks(sig.x, sig.y, Math.round(16 * scaleFactor), 6.8);
      } else if (sig.kind === 'paper_hit') {
        this.spawnSparks(sig.x, sig.y, Math.round(10 * scaleFactor), 6.4);
        this.spawnConfetti(sig.x, sig.y, Math.round(4 * scaleFactor), false);
      } else if (sig.kind === 'master_notice_impact') {
        this.shockTimer = 0.62;
        this.shockRing.position.set(sig.x, 0.06, 0);
        this.shockRing.scale.set(0.55, 0.55, 1);
        this.shockRing.visible = true;
        this.shockRingMat.opacity = 0.96;
        this.spawnSparks(sig.x, sig.y, Math.round(32 * scaleFactor), 9.5);
        this.spawnConfetti(sig.x, sig.y, Math.round(28 * scaleFactor), false);
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    sup: PrincipalSuperState | null,
    attackerX: number,
    attackerY: number,
    attackerFacing: 1 | -1,
    defenderX: number,
    lowGraphics = false,
  ): number {
    const running = Boolean(sup && sup.active);
    if (running) {
      this.isActive = true;
      this.root.visible = true;
    }

    if (!this.isActive) return 0;

    // Emit swirling admin-paper wind around levitating Principal Man in Phase 1 & 2
    if (running && sup && sup.elapsed < 2.65) {
      this.windEmitAccum += dt;
      const emitInterval = lowGraphics ? 0.24 : 0.14;
      if (this.windEmitAccum >= emitInterval) {
        this.windEmitAccum = 0;
        this.spawnConfetti(attackerX, attackerY + 0.9, lowGraphics ? 1 : 2, true);
      }
    }

    // Update sparks
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

    // Update paper confetti & swirling wind sheets
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
      c.vx *= Math.max(0, 1 - dt * 1.7);
      c.vz *= Math.max(0, 1 - dt * 1.7);
      c.vy -= 5.2 * dt;
      c.x += c.vx * dt + Math.sin(elapsed * 9 + i) * dt * 0.75;
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

    // Update big red ground shockwave ring
    if (this.shockTimer > 0) {
      anyActive = true;
      this.shockTimer = Math.max(0, this.shockTimer - dt);
      const p = 1 - this.shockTimer / 0.62;
      const sc = 0.55 + (1 - (1 - p) * (1 - p)) * 4.2;
      this.shockRing.scale.set(sc, sc, 1);
      this.shockRingMat.opacity = Math.max(0, (1 - p) * 0.96);
      if (this.shockTimer <= 0) {
        this.shockRing.visible = false;
      }
    }

    if (!running || !sup) {
      this.dimFactor = Math.max(0, this.dimFactor - dt * 2.8);
      this.spotLight.intensity = Math.max(0, this.spotLight.intensity - dt * 70);
      this.auraLight.intensity = Math.max(0, this.auraLight.intensity - dt * 35);
      this.spotlightBeamMat.opacity = Math.max(0, this.spotlightBeamMat.opacity - dt * 0.8);
      this.auraSphereMat.opacity = 0;
      this.auraSphere.visible = false;
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

    // Smooth arena dim envelope
    const fadeIn = smoothstep(t / 0.4);
    const fadeOut = t > 4.65 ? 1 - smoothstep((t - 4.65) / 0.55) : 1;
    this.dimFactor = fadeIn * fadeOut * 0.84;

    const centerY = attackerY + 1.15;
    this.spotLight.position.set(attackerX, 10.6, 2.8);
    this.spotTarget.position.set(attackerX, centerY, 0);
    this.spotTarget.updateMatrixWorld();
    this.spotLight.intensity = 15 * fadeIn * fadeOut;

    const auraPulse = 0.85 + Math.sin(elapsed * 10.5) * 0.18;
    this.auraLight.position.set(attackerX, centerY + 0.15, 1.35);
    this.auraLight.intensity = (4.8 + Math.sin(elapsed * 11) * 1.4) * fadeIn * fadeOut;

    this.spotlightBeam.position.set(attackerX, 5.1, 0);
    this.spotlightBeamMat.opacity = 0.13 * fadeIn * fadeOut;

    // Pulsing golden-orange levitation aura sphere + dual halo rings
    const ringAlpha = smoothstep(t / 0.45) * fadeOut;
    this.auraSphere.visible = ringAlpha > 0.02;
    this.auraSphere.position.set(attackerX, attackerY + 1.1, 0);
    this.auraSphere.scale.set(0.92 * auraPulse, 1.28 * auraPulse, 0.92 * auraPulse);
    this.auraSphereMat.opacity = 0.2 * ringAlpha;

    this.auraRingOuter.position.set(attackerX, attackerY + 0.16, 0);
    this.auraRingOuter.rotation.z = elapsed * 2.5;
    this.auraRingOuter.scale.setScalar(auraPulse);
    this.auraRingOuterMat.opacity = 0.72 * ringAlpha;

    this.auraRingInner.position.set(attackerX, attackerY + 0.08, 0);
    this.auraRingInner.rotation.z = -elapsed * 3.8;
    this.auraRingInnerMat.opacity = 0.78 * ringAlpha;

    // Phase 2 & 3: 14 glowing red-bordered notices orbiting in rapid 3D vortex -> cascading homing barrage
    if (t >= 1.5 && t < 4.55) {
      const summonT = smoothstep((t - 1.5) / 0.52);
      const orbitSpeed = t < BARRAGE_START ? 4.8 + summonT * 2.4 : 6.8;

      for (let i = 0; i < this.papers.length; i++) {
        const p = this.papers[i];
        const angle = p.orbitAngleOffset + (t - 1.5) * orbitSpeed * attackerFacing;
        const orbitX = attackerX + Math.cos(angle) * p.orbitRadius;
        const orbitY =
          attackerY +
          1.15 +
          p.orbitHeightOffset +
          (1 - summonT) * 3.6 +
          Math.sin(angle * 2) * 0.14;
        const orbitZ = Math.sin(angle) * p.orbitRadius * 0.74;

        if (t < p.launchTime) {
          p.launched = false;
          p.mesh.visible = true;
          p.mesh.position.set(orbitX, orbitY, orbitZ);
          p.mesh.rotation.set(
            Math.sin(elapsed * 4 + i) * 0.18,
            -angle + Math.PI * 0.5,
            Math.cos(elapsed * 5 + i) * 0.14,
          );
          const sc = 0.45 + summonT * 0.64;
          p.mesh.scale.set(sc, sc, 1);
        } else if (t <= p.arriveTime) {
          if (!p.launched) {
            p.launched = true;
            p.startX = orbitX;
            p.startY = orbitY;
            p.startZ = orbitZ;
          }
          const flightT = smoothstep(
            (t - p.launchTime) / Math.max(0.08, p.arriveTime - p.launchTime),
          );
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
          p.mesh.scale.set(1.14, 1.14, 1);
        } else {
          p.mesh.visible = false;
        }
      }
    } else {
      for (const p of this.papers) {
        p.mesh.visible = false;
      }
    }

    // Phase 3 Finisher (4.22s..5.02s): Giant glowing red "FINAL RUSTICATION!" Notice Stamp
    if (t >= 4.22 && t <= 5.02) {
      this.masterGroup.visible = true;
      if (t < MASTER_IMPACT_TIME) {
        const slamT = smoothstep((t - 4.22) / (MASTER_IMPACT_TIME - 4.22));
        const accel = slamT * slamT;
        const dropY = THREE.MathUtils.lerp(7.3, 1.05, accel);
        this.masterGroup.position.set(defenderX, dropY, 0.35);
        this.masterGroup.rotation.set(0, 0, THREE.MathUtils.lerp(-0.18, -0.05, slamT));
        const sc = THREE.MathUtils.lerp(0.75, 1.2, slamT);
        this.masterGroup.scale.set(sc, sc, 1);
      } else {
        const holdT = (t - MASTER_IMPACT_TIME) / (5.02 - MASTER_IMPACT_TIME);
        const bounce = Math.exp(-holdT * 10) * Math.sin(holdT * 26) * 0.14;
        const shrink = holdT > 0.65 ? 1 - smoothstep((holdT - 0.65) / 0.35) : 1;
        this.masterGroup.position.set(defenderX, 1.05 + Math.abs(bounce), 0.35);
        this.masterGroup.rotation.set(0, 0, -0.05);
        this.masterGroup.scale.set(1.2 * shrink, 1.2 * shrink, 1);
      }
    } else {
      this.masterGroup.visible = false;
    }

    return this.dimFactor;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.root);
    for (const tex of this.paperTextures) tex.dispose();
    this.paperGeo.dispose();
    for (const mat of this.paperMaterials) mat.dispose();
    this.masterTex.dispose();
    this.masterMat.dispose();
    this.masterRimMat.dispose();
    this.spotlightBeam.geometry.dispose();
    this.spotlightBeamMat.dispose();
    this.auraSphere.geometry.dispose();
    this.auraSphereMat.dispose();
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
