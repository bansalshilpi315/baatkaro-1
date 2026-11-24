import * as THREE from 'three';
import type { FighterRig } from './characters';
import type { MausiSuperBeatSignal, MausiSuperState } from './mausiSuper';
import {
  MAUSI_LADDOO_COUNT,
  MAUSI_MEGA_IMPACT_TIME,
  MAUSI_MEGA_LAUNCH_TIME,
  getMausiSuperDimFactor,
} from './mausiSuper';

interface BarrageLaddooSlot {
  root: THREE.Group;
  core: THREE.Mesh;
  trail: THREE.Mesh;
  launchTime: number;
  hitTime: number;
  arcHeight: number;
  zSpread: number;
  useLeftHand: boolean;
}

interface GoldenWindSlot {
  angle: number;
  radius: number;
  speed: number;
  yPhase: number;
  scaleY: number;
}

interface BesanBurstSlot {
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

const WIND_POOL_SIZE = 26;
const BESAN_BURST_POOL_SIZE = 48;

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _mouthPos = new THREE.Vector3();
const _flightDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _color = new THREE.Color();

/**
 * Generates a rich bumpy golden-saffron Motichoor/Besan Laddoo texture
 * with toasted boondi pearls, pistachio flecks, and cream melon seeds.
 */
function createGoldenLaddooTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(0, 0, 256, 256);

  const boondiColors = ['#FBBF24', '#F59E0B', '#FDE047', '#EA580C', '#FB923C'];
  for (let i = 0; i < 240; i++) {
    const x = (i * 47 + 13) % 256;
    const y = (i * 89 + 29) % 256;
    const r = 6 + (i % 5) * 1.8;
    ctx.fillStyle = boondiColors[i % boondiColors.length];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Subtle specular pearl glint
    ctx.fillStyle = 'rgba(255, 251, 220, 0.35)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny festive green pistachio & cream melon-seed (magaj) flecks
  for (let i = 0; i < 24; i++) {
    const x = (i * 73 + 17) % 244 + 6;
    const y = (i * 113 + 31) % 244 + 6;
    ctx.fillStyle = i % 3 === 0 ? '#4ADE80' : '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 2.6, (i % 5) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class MausiSuperVfx {
  private group = new THREE.Group();
  private disposables: Array<{ dispose: () => void }> = [];

  // Warm festive golden-orange spotlight & Power Laddoo glow PointLight
  private festiveSpotLight: THREE.SpotLight;
  private powerLaddooLight: THREE.PointLight;

  // Phase 1: Hero Glowing Power Laddoo + 8 Orbiting Sparkles
  private heroLaddooGroup: THREE.Group;
  private heroOrbitSparks: THREE.Mesh[] = [];

  // Phases 1-3: Fiery Golden-Orange Pulsing Energy Aura & Levitation Rings
  private groundAuraRing: THREE.Mesh;
  private groundAuraMat: THREE.MeshBasicMaterial;
  private footAuraRing: THREE.Mesh;
  private footAuraMat: THREE.MeshBasicMaterial;
  private bodyAuraShell: THREE.Mesh;
  private bodyAuraMat: THREE.MeshBasicMaterial;

  private windMesh: THREE.InstancedMesh;
  private windSlots: GoldenWindSlot[] = [];

  // Phase 3: 14 Pre-Pooled Glowing Barrage Laddoos + 1 Oversized Mega Laddoo
  private laddooTex: THREE.CanvasTexture;
  private barrageLaddoos: BarrageLaddooSlot[] = [];
  private megaLaddooGroup: THREE.Group;
  private megaLaddooCore: THREE.Mesh;

  // Huge Golden Mega-Laddoo Impact Shockwave Ring + Besan Sparkle Burst Pool
  private shockRing: THREE.Mesh;
  private shockRingMat: THREE.MeshBasicMaterial;
  private shockRingTimer = 0;
  private readonly shockRingDuration = 0.56;

  private burstMesh: THREE.InstancedMesh;
  private burstSlots: BesanBurstSlot[] = [];
  private burstCursor = 0;

  constructor(scene: THREE.Scene) {
    // 1. Warm Festive Golden-Orange SpotLight & Power Laddoo PointLight
    this.festiveSpotLight = new THREE.SpotLight(0xfbbf24, 0, 28, Math.PI * 0.28, 0.55, 1.2);
    this.festiveSpotLight.position.set(0, 9.0, 2.8);
    this.festiveSpotLight.target.position.set(0, 1.8, 0);
    scene.add(this.festiveSpotLight);
    scene.add(this.festiveSpotLight.target);

    this.powerLaddooLight = new THREE.PointLight(0xfde047, 0, 10, 1.4);
    this.powerLaddooLight.position.set(0, 2.0, 1.0);
    scene.add(this.powerLaddooLight);

    // 2. Shared Golden Besan Laddoo Texture & Materials
    this.laddooTex = createGoldenLaddooTexture();
    const laddooCoreMat = new THREE.MeshStandardMaterial({
      map: this.laddooTex,
      color: 0xffffff,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 1.05,
      roughness: 0.42,
      metalness: 0.08,
    });
    const laddooHaloMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cometTrailMat = new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposables.push(this.laddooTex, laddooCoreMat, laddooHaloMat, cometTrailMat, sparkleMat);

    // 3. Phase 1 Hero Glowing Power Laddoo (composite textured sphere + glowing halo + 8 orbiting sparkles)
    this.heroLaddooGroup = new THREE.Group();
    const heroSphereGeo = new THREE.IcosahedronGeometry(0.24, 2);
    const heroHaloGeo = new THREE.SphereGeometry(0.35, 12, 10);
    const orbitSparkGeo = new THREE.OctahedronGeometry(0.055, 0);
    this.disposables.push(heroSphereGeo, heroHaloGeo, orbitSparkGeo);

    const heroCore = new THREE.Mesh(heroSphereGeo, laddooCoreMat);
    const heroHalo = new THREE.Mesh(heroHaloGeo, laddooHaloMat);
    this.heroLaddooGroup.add(heroCore, heroHalo);

    for (let i = 0; i < 8; i++) {
      const spark = new THREE.Mesh(orbitSparkGeo, sparkleMat);
      this.heroOrbitSparks.push(spark);
      this.heroLaddooGroup.add(spark);
    }
    this.heroLaddooGroup.visible = false;
    this.group.add(this.heroLaddooGroup);

    // 4. Fiery Golden-Orange Pulsing Energy Aura & Levitation Rings
    const groundRingGeo = new THREE.RingGeometry(0.72, 1.56, 32);
    this.groundAuraMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.groundAuraRing = new THREE.Mesh(groundRingGeo, this.groundAuraMat);
    this.groundAuraRing.rotation.x = -Math.PI / 2;
    this.groundAuraRing.position.set(0, 0.055, 0);
    this.groundAuraRing.visible = false;
    this.group.add(this.groundAuraRing);

    const footRingGeo = new THREE.TorusGeometry(0.84, 0.082, 8, 28);
    this.footAuraMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.footAuraRing = new THREE.Mesh(footRingGeo, this.footAuraMat);
    this.footAuraRing.rotation.x = Math.PI / 2;
    this.footAuraRing.visible = false;
    this.group.add(this.footAuraRing);

    const bodyAuraGeo = new THREE.SphereGeometry(1.15, 16, 12);
    this.bodyAuraMat = new THREE.MeshBasicMaterial({
      color: 0xff6b00,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.bodyAuraShell = new THREE.Mesh(bodyAuraGeo, this.bodyAuraMat);
    this.bodyAuraShell.scale.set(0.95, 1.24, 0.92);
    this.bodyAuraShell.visible = false;
    this.group.add(this.bodyAuraShell);
    this.disposables.push(
      groundRingGeo,
      this.groundAuraMat,
      footRingGeo,
      this.footAuraMat,
      bodyAuraGeo,
      this.bodyAuraMat,
    );

    // Swirling Golden Upward Energy Streaks (InstancedMesh)
    const windGeo = new THREE.BoxGeometry(0.068, 0.48, 0.068);
    const windMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposables.push(windGeo, windMat);
    this.windMesh = new THREE.InstancedMesh(windGeo, windMat, WIND_POOL_SIZE);
    this.windMesh.frustumCulled = false;
    for (let i = 0; i < WIND_POOL_SIZE; i++) {
      this.windSlots.push({
        angle: (i / WIND_POOL_SIZE) * Math.PI * 2,
        radius: 0.62 + (i % 4) * 0.25,
        speed: 4.6 + (i % 5) * 0.72,
        yPhase: (i / WIND_POOL_SIZE) * 2.6,
        scaleY: 0.75 + (i % 3) * 0.32,
      });
      _mat4.makeScale(0, 0, 0);
      this.windMesh.setMatrixAt(i, _mat4);
    }
    this.windMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.windMesh);

    // 5. 14 Pre-Pooled Glowing Golden 3D Barrage Laddoos (with Orange-Gold Comet Trails!)
    const barrageSphereGeo = new THREE.IcosahedronGeometry(0.24, 1);
    const barrageHaloGeo = new THREE.SphereGeometry(0.32, 10, 8);
    const barrageTrailGeo = new THREE.ConeGeometry(0.22, 1.15, 8, 1, true);
    barrageTrailGeo.translate(0, -0.58, 0); // Base at laddoo, tip trailing behind -Y
    this.disposables.push(barrageSphereGeo, barrageHaloGeo, barrageTrailGeo);

    for (let i = 0; i < MAUSI_LADDOO_COUNT; i++) {
      const root = new THREE.Group();
      const core = new THREE.Mesh(barrageSphereGeo, laddooCoreMat);
      const halo = new THREE.Mesh(barrageHaloGeo, laddooHaloMat);
      const trail = new THREE.Mesh(barrageTrailGeo, cometTrailMat);
      root.add(core, halo, trail);
      root.visible = false;
      this.group.add(root);

      // Distribute 14 laddoos rapidly across 2.50s..4.02s (alternating curved high arcs & snappy straight volleys)
      const launchTime = 2.5 + i * 0.095;
      const flightDur = i % 3 === 0 ? 0.34 : i % 3 === 1 ? 0.26 : 0.31;
      const arcHeight = i % 3 === 1 ? 0.22 : i % 3 === 0 ? 1.55 : 0.92;
      const zSpread = ((i % 5) - 2) * 0.22;

      this.barrageLaddoos.push({
        root,
        core,
        trail,
        launchTime,
        hitTime: launchTime + flightDur,
        arcHeight,
        zSpread,
        useLeftHand: i % 2 === 1,
      });
    }

    // 6. Oversized Glowing Mega Laddoo Finisher (Composite Group)
    this.megaLaddooGroup = new THREE.Group();
    const megaCoreGeo = new THREE.IcosahedronGeometry(0.72, 2);
    const megaHaloGeo = new THREE.SphereGeometry(0.95, 14, 12);
    const megaOuterGeo = new THREE.TorusGeometry(0.96, 0.08, 8, 24);
    const megaTrailGeo = new THREE.ConeGeometry(0.68, 2.35, 10, 1, true);
    megaTrailGeo.translate(0, -1.2, 0);
    this.disposables.push(megaCoreGeo, megaHaloGeo, megaOuterGeo, megaTrailGeo);

    this.megaLaddooCore = new THREE.Mesh(megaCoreGeo, laddooCoreMat);
    const megaHalo = new THREE.Mesh(megaHaloGeo, laddooHaloMat);
    const megaRing = new THREE.Mesh(megaOuterGeo, sparkleMat);
    const megaTrail = new THREE.Mesh(megaTrailGeo, cometTrailMat);
    this.megaLaddooGroup.add(this.megaLaddooCore, megaHalo, megaRing, megaTrail);
    this.megaLaddooGroup.visible = false;
    this.group.add(this.megaLaddooGroup);

    // 7. Huge Golden Shockwave Burst Ring
    const shockGeo = new THREE.RingGeometry(0.42, 1.25, 32);
    this.shockRingMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(shockGeo, this.shockRingMat);
    this.shockRing = new THREE.Mesh(shockGeo, this.shockRingMat);
    this.shockRing.rotation.x = -Math.PI / 2;
    this.shockRing.position.set(0, 0.08, 0);
    this.shockRing.visible = false;
    this.group.add(this.shockRing);

    // 8. Golden Besan & Sparkle Burst Particle Pool (InstancedMesh)
    const burstGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const burstMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposables.push(burstGeo, burstMat);
    this.burstMesh = new THREE.InstancedMesh(burstGeo, burstMat, BESAN_BURST_POOL_SIZE);
    this.burstMesh.frustumCulled = false;

    for (let i = 0; i < BESAN_BURST_POOL_SIZE; i++) {
      this.burstSlots.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.42,
        scale: 0,
        color: new THREE.Color(0xfbbf24),
      });
      _mat4.makeScale(0, 0, 0);
      this.burstMesh.setMatrixAt(i, _mat4);
      this.burstMesh.setColorAt(i, _color.setHex(0xfbbf24));
    }
    this.burstMesh.instanceMatrix.needsUpdate = true;
    if (this.burstMesh.instanceColor) this.burstMesh.instanceColor.needsUpdate = true;
    this.group.add(this.burstMesh);

    scene.add(this.group);
  }

  public setPrewarmVisible(visible: boolean): void {
    this.heroLaddooGroup.visible = visible;
    this.groundAuraRing.visible = visible;
    this.footAuraRing.visible = visible;
    this.bodyAuraShell.visible = visible;
    this.megaLaddooGroup.visible = visible;
    this.shockRing.visible = visible;
    this.barrageLaddoos[0].root.visible = visible;
    if (visible) {
      this.heroLaddooGroup.position.set(0, -40, 0);
      this.megaLaddooGroup.position.set(0, -40, 0);
      this.barrageLaddoos[0].root.position.set(0, -40, 0);
    } else {
      this.reset();
    }
  }

  private spawnBesanBurst(x: number, y: number, count: number, speed: number): void {
    const palette = [0xfde047, 0xfbbf24, 0xf97316, 0xfef3c7, 0xf59e0b];
    for (let i = 0; i < count; i++) {
      const slot = this.burstSlots[this.burstCursor];
      this.burstCursor = (this.burstCursor + 1) % BESAN_BURST_POOL_SIZE;
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.45;
      const spd = speed * (0.45 + Math.random() * 0.8);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.55;
      slot.y = y + (Math.random() - 0.5) * 0.55;
      slot.z = (Math.random() - 0.5) * 0.7;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.sin(angle) * spd * 0.75 + 2.2;
      slot.vz = (Math.random() - 0.5) * spd * 0.85;
      slot.life = 0;
      slot.maxLife = 0.34 + Math.random() * 0.25;
      slot.scale = 0.7 + Math.random() * 0.9;
      slot.color.setHex(palette[i % palette.length]);
    }
  }

  public handleBeatSignals(signals: MausiSuperBeatSignal[], lowGraphics: boolean): void {
    const scale = lowGraphics ? 0.55 : 1.0;
    for (const sig of signals) {
      if (sig.kind === 'aura_ignite') {
        this.spawnBesanBurst(sig.x, sig.y, Math.round(16 * scale), 6.5);
      } else if (sig.kind === 'laddoo_hit') {
        this.spawnBesanBurst(sig.x, sig.y, Math.round(12 * scale), 6.2);
      } else if (sig.kind === 'mega_impact') {
        this.shockRing.position.set(sig.x, 0.08, 0);
        this.shockRing.scale.set(0.65, 0.65, 1);
        this.shockRing.visible = true;
        this.shockRingTimer = this.shockRingDuration;
        this.spawnBesanBurst(sig.x, sig.y, Math.round(30 * scale), 9.5);
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    superState: MausiSuperState | null,
    attackerRig: FighterRig | null,
    attackerX: number,
    attackerY: number,
    attackerFacing: 1 | -1,
    defenderX: number,
  ): number {
    const dimFactor = superState?.active ? getMausiSuperDimFactor(superState.elapsed) : 0;

    // 1. Warm festive golden-orange spotlight & Power Laddoo PointLight
    if (superState?.active) {
      const t = superState.elapsed;
      const focusX = t < 2.4 ? attackerX : (attackerX + defenderX) * 0.5;
      this.festiveSpotLight.position.set(focusX, 9.0, 2.8);
      this.festiveSpotLight.target.position.set(focusX, 1.65, 0);
      this.festiveSpotLight.target.updateMatrixWorld();
      this.festiveSpotLight.intensity = dimFactor * 25;
    } else {
      this.festiveSpotLight.intensity = 0;
      this.powerLaddooLight.intensity = 0;
    }

    // 2. Phase 1 Hero Glowing Power Laddoo (0.0s - 1.15s: held in hand -> pops into Mausi's mouth!)
    if (superState?.active && superState.elapsed < 1.16) {
      const t = superState.elapsed;
      this.heroLaddooGroup.visible = true;
      if (attackerRig) {
        attackerRig.rightFistAnchor.getWorldPosition(_worldPos);
        attackerRig.head.getWorldPosition(_mouthPos);
        _mouthPos.y += 0.16;
        _mouthPos.x += attackerFacing * 0.22;
      } else {
        _worldPos.set(attackerX + attackerFacing * 0.6, 1.55, 0.25);
        _mouthPos.set(attackerX + attackerFacing * 0.22, 1.98, 0.1);
      }

      if (t < 0.72) {
        // Presented proudly right above Mausi's raised palm with shimmering bob
        this.heroLaddooGroup.position.set(
          _worldPos.x + attackerFacing * 0.08,
          _worldPos.y + 0.16 + Math.sin(elapsed * 12) * 0.04,
          _worldPos.z + 0.14,
        );
        const popIn = Math.min(1, t / 0.22);
        this.heroLaddooGroup.scale.setScalar(0.95 * popIn + Math.sin(elapsed * 20) * 0.07);
      } else {
        // Arcs straight into Mausi's mouth and shrinks right as she gulps it!
        const gulpT = Math.min(1, (t - 0.72) / 0.42);
        const arcY = Math.sin(gulpT * Math.PI) * 0.32;
        this.heroLaddooGroup.position.set(
          THREE.MathUtils.lerp(_worldPos.x, _mouthPos.x, gulpT),
          THREE.MathUtils.lerp(_worldPos.y + 0.14, _mouthPos.y, gulpT) + arcY,
          THREE.MathUtils.lerp(_worldPos.z + 0.14, _mouthPos.z, gulpT),
        );
        const shrink = Math.max(0.08, 1 - Math.pow(gulpT, 2.2) * 0.85);
        this.heroLaddooGroup.scale.setScalar(shrink);
      }

      this.heroLaddooGroup.rotation.y = elapsed * 4.5;
      for (let i = 0; i < this.heroOrbitSparks.length; i++) {
        const a = elapsed * 6.5 + (i / this.heroOrbitSparks.length) * Math.PI * 2;
        const r = 0.42 + Math.sin(elapsed * 9 + i) * 0.07;
        this.heroOrbitSparks[i].position.set(
          Math.cos(a) * r,
          Math.sin(a * 1.6) * 0.26,
          Math.sin(a) * r,
        );
        this.heroOrbitSparks[i].rotation.set(a, a * 1.4, 0);
      }

      this.powerLaddooLight.position.copy(this.heroLaddooGroup.position);
      this.powerLaddooLight.intensity = 14;
    } else {
      this.heroLaddooGroup.visible = false;
    }

    // 3. Fiery Golden-Orange Pulsing Aura & Levitation Rings (ignites at t >= 1.15s through touchdown)
    const auraActive = Boolean(superState?.active && superState.elapsed >= 1.12 && superState.elapsed < 4.92);
    if (auraActive && superState) {
      const t = superState.elapsed;
      const rampIn = Math.min(1, (t - 1.12) / 0.25);
      const fadeOut = t > 4.42 ? Math.max(0, 1 - (t - 4.42) / 0.5) : 1;
      const alpha = rampIn * fadeOut;
      const pulse = 0.92 + Math.sin(elapsed * 18) * 0.12;

      this.groundAuraRing.visible = true;
      this.groundAuraRing.position.set(attackerX, 0.055, 0);
      this.groundAuraRing.rotation.z = elapsed * 3.8;
      this.groundAuraRing.scale.setScalar(1.0 + Math.sin(elapsed * 11) * 0.14);
      this.groundAuraMat.opacity = 0.72 * alpha;

      this.footAuraRing.visible = true;
      this.footAuraRing.position.set(attackerX, Math.max(0.14, attackerY + 0.08), 0);
      this.footAuraRing.rotation.z = -elapsed * 5.6;
      this.footAuraRing.scale.setScalar((0.92 + Math.cos(elapsed * 14) * 0.12) * pulse);
      this.footAuraMat.opacity = 0.88 * alpha;

      this.bodyAuraShell.visible = true;
      this.bodyAuraShell.position.set(attackerX, attackerY + 1.18, 0);
      this.bodyAuraShell.rotation.y = elapsed * 4.2;
      this.bodyAuraShell.scale.set(1.06 * pulse, 1.3 * (1 + Math.sin(elapsed * 22) * 0.08), 1.06 * pulse);
      this.bodyAuraMat.opacity = 0.24 * alpha;

      if (t >= 1.16) {
        this.powerLaddooLight.position.set(attackerX, attackerY + 1.35, 0.9);
        this.powerLaddooLight.intensity = 12 * alpha * pulse;
      }

      // Swirling upward golden wind energy streaks
      for (let i = 0; i < WIND_POOL_SIZE; i++) {
        const w = this.windSlots[i];
        const angle = w.angle + elapsed * w.speed;
        const yCycle = (w.yPhase + elapsed * 3.8) % 2.9;
        const wy = Math.max(0.12, attackerY - 1.35 + yCycle);
        const rad = w.radius * (0.85 + Math.sin(yCycle * 2) * 0.2);
        const wx = attackerX + Math.cos(angle) * rad;
        const wz = Math.sin(angle) * rad;
        const fadeY = Math.sin((yCycle / 2.9) * Math.PI) * alpha;
        _pos.set(wx, wy, wz);
        _euler.set(0, -angle, 0.16);
        _quat.setFromEuler(_euler);
        _scale.set(fadeY, w.scaleY * fadeY, fadeY);
        _mat4.compose(_pos, _quat, _scale);
        this.windMesh.setMatrixAt(i, _mat4);
      }
      this.windMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.groundAuraRing.visible = false;
      this.footAuraRing.visible = false;
      this.bodyAuraShell.visible = false;
      for (let i = 0; i < WIND_POOL_SIZE; i++) {
        _mat4.makeScale(0, 0, 0);
        this.windMesh.setMatrixAt(i, _mat4);
      }
      this.windMesh.instanceMatrix.needsUpdate = true;
    }

    // 4. Phase 3 Rapid Storm of 14 Glowing Golden 3D Laddoos (2.5s - 4.28s)
    if (superState?.active && superState.elapsed >= 2.48 && superState.elapsed < 4.4) {
      const t = superState.elapsed;
      const startBaseX = attackerX + attackerFacing * 0.65;
      const startBaseY = attackerY + 1.28;
      const endX = superState.targetX;

      for (let i = 0; i < this.barrageLaddoos.length; i++) {
        const slot = this.barrageLaddoos[i];
        if (t < slot.launchTime || t > slot.hitTime) {
          slot.root.visible = false;
          continue;
        }
        slot.root.visible = true;
        const p = (t - slot.launchTime) / (slot.hitTime - slot.launchTime);
        const sx = startBaseX;
        const sy = startBaseY + (slot.useLeftHand ? 0.14 : -0.06);
        const sz = slot.useLeftHand ? -0.34 : 0.34;
        const ey = 0.9 + (i % 4) * 0.26;

        const cx = THREE.MathUtils.lerp(sx, endX, p);
        const cy = THREE.MathUtils.lerp(sy, ey, p) + Math.sin(p * Math.PI) * slot.arcHeight;
        const cz = THREE.MathUtils.lerp(sz, slot.zSpread, p);
        slot.root.position.set(cx, cy, cz);

        // Orient comet trail cleanly behind the flight tangent vector!
        const pNext = Math.min(1, p + 0.05);
        const nx = THREE.MathUtils.lerp(sx, endX, pNext);
        const ny = THREE.MathUtils.lerp(sy, ey, pNext) + Math.sin(pNext * Math.PI) * slot.arcHeight;
        const nz = THREE.MathUtils.lerp(sz, slot.zSpread, pNext);
        _flightDir.set(nx - cx, ny - cy, nz - cz).normalize();
        if (_flightDir.lengthSq() > 0.0001) {
          slot.root.quaternion.setFromUnitVectors(_upAxis, _flightDir);
        }
        slot.core.rotation.y = elapsed * 14 + i;
      }
    } else {
      for (const slot of this.barrageLaddoos) {
        slot.root.visible = false;
      }
    }

    // 5. Oversized Glowing Mega Laddoo Finisher (4.02s launch -> 4.30s heavy slam!)
    if (
      superState?.active &&
      superState.elapsed >= MAUSI_MEGA_LAUNCH_TIME &&
      superState.elapsed <= MAUSI_MEGA_IMPACT_TIME + 0.06
    ) {
      const t = superState.elapsed;
      const p = Math.min(
        1,
        (t - MAUSI_MEGA_LAUNCH_TIME) / (MAUSI_MEGA_IMPACT_TIME - MAUSI_MEGA_LAUNCH_TIME),
      );
      const sx = attackerX + attackerFacing * 0.85;
      const sy = attackerY + 1.55;
      const ex = superState.targetX;
      const ey = 0.92;

      const eased = p * p * (3 - 2 * p);
      const mx = THREE.MathUtils.lerp(sx, ex, eased);
      const my = THREE.MathUtils.lerp(sy, ey, eased) + Math.sin(p * Math.PI) * 1.15;
      this.megaLaddooGroup.visible = true;
      this.megaLaddooGroup.position.set(mx, my, 0);

      const grow = 0.65 + Math.min(1, p * 2.2) * 0.55;
      this.megaLaddooGroup.scale.setScalar(grow);

      const pNext = Math.min(1, p + 0.05);
      const nx = THREE.MathUtils.lerp(sx, ex, pNext);
      const ny = THREE.MathUtils.lerp(sy, ey, pNext) + Math.sin(pNext * Math.PI) * 1.15;
      _flightDir.set(nx - mx, ny - my, 0).normalize();
      if (_flightDir.lengthSq() > 0.0001) {
        this.megaLaddooGroup.quaternion.setFromUnitVectors(_upAxis, _flightDir);
      }
      this.megaLaddooCore.rotation.y = elapsed * 11;
    } else {
      this.megaLaddooGroup.visible = false;
    }

    // 6. Huge Golden Mega-Laddoo Impact Shockwave Ring
    if (this.shockRingTimer > 0) {
      this.shockRingTimer = Math.max(0, this.shockRingTimer - dt);
      const p = 1 - this.shockRingTimer / this.shockRingDuration;
      const ringScale = 0.75 + p * 4.6;
      this.shockRing.scale.set(ringScale, ringScale * 0.78, 1);
      this.shockRingMat.opacity = (1 - p) * 0.92;
      if (this.shockRingTimer <= 0) {
        this.shockRing.visible = false;
      }
    }

    // 7. Update Golden Besan & Sparkle Burst Particle Pool
    let burstDirty = false;
    for (let i = 0; i < BESAN_BURST_POOL_SIZE; i++) {
      const s = this.burstSlots[i];
      if (!s.active) continue;
      burstDirty = true;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        _mat4.makeScale(0, 0, 0);
        this.burstMesh.setMatrixAt(i, _mat4);
        continue;
      }
      s.vy -= 14 * dt;
      s.x += s.vx * dt;
      s.y = Math.max(0.08, s.y + s.vy * dt);
      s.z += s.vz * dt;

      const fade = 1 - s.life / s.maxLife;
      _pos.set(s.x, s.y, s.z);
      _euler.set(s.life * 14, s.life * 12, i);
      _quat.setFromEuler(_euler);
      _scale.setScalar(s.scale * fade);
      _mat4.compose(_pos, _quat, _scale);
      this.burstMesh.setMatrixAt(i, _mat4);
      this.burstMesh.setColorAt(i, s.color);
    }
    if (burstDirty) {
      this.burstMesh.instanceMatrix.needsUpdate = true;
      if (this.burstMesh.instanceColor) this.burstMesh.instanceColor.needsUpdate = true;
    }

    return dimFactor;
  }

  public reset(): void {
    this.festiveSpotLight.intensity = 0;
    this.powerLaddooLight.intensity = 0;
    this.heroLaddooGroup.visible = false;
    this.groundAuraRing.visible = false;
    this.footAuraRing.visible = false;
    this.bodyAuraShell.visible = false;
    this.megaLaddooGroup.visible = false;
    this.shockRing.visible = false;
    this.shockRingTimer = 0;
    for (const slot of this.barrageLaddoos) {
      slot.root.visible = false;
    }
    for (let i = 0; i < WIND_POOL_SIZE; i++) {
      _mat4.makeScale(0, 0, 0);
      this.windMesh.setMatrixAt(i, _mat4);
    }
    this.windMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < BESAN_BURST_POOL_SIZE; i++) {
      this.burstSlots[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.burstMesh.setMatrixAt(i, _mat4);
    }
    this.burstMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    scene.remove(this.festiveSpotLight);
    scene.remove(this.festiveSpotLight.target);
    scene.remove(this.powerLaddooLight);
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
