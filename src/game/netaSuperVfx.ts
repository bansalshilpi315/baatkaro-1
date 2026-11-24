import * as THREE from 'three';
import { getContactShadowTexture } from './characters/rig';
import {
  NETA_CONVOY_HIT_TIMES,
  NETA_LEAD_VAN_HIT_TIME,
  NETA_VAN_COUNT,
  getNetaSuperDimFactor,
  type NetaSuperBeatSignal,
  type NetaSuperState,
} from './netaSuper';

interface DesiVanRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  wheels: THREE.Group[];
  sirenMat: THREE.MeshStandardMaterial;
  headlightConeMat: THREE.MeshBasicMaterial;
  zOffset: number;
  hitTime: number;
  speed: number;
}

interface DustPuffSlot {
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
}

interface WindStreakSlot {
  angle: number;
  radius: number;
  speed: number;
  yPhase: number;
  scaleY: number;
}

const DUST_POOL_SIZE = 44;
const WIND_POOL_SIZE = 28;

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _color = new THREE.Color();

function createGaribSenaStripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;

  // White Omni body panel background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, 256, 64);

  // Iconic bold saffron-orange & crimson campaign side stripes
  ctx.fillStyle = '#F97316';
  ctx.fillRect(0, 6, 256, 16);
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(0, 22, 256, 28);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(0, 50, 256, 8);

  // Crisp bold "GARIB SENA" lettering across red stripe
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 22px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ GARIB SENA ★', 128, 36);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createDesiOmniVan(
  stripeTex: THREE.CanvasTexture,
  sharedGeos: {
    bodyGeo: THREE.BoxGeometry;
    roofGeo: THREE.BoxGeometry;
    bumperGeo: THREE.BoxGeometry;
    windshieldGeo: THREE.BoxGeometry;
    sideWindowGeo: THREE.BoxGeometry;
    stripeGeo: THREE.PlaneGeometry;
    headlightGeo: THREE.BoxGeometry;
    taillightGeo: THREE.BoxGeometry;
    coneGeo: THREE.ConeGeometry;
    tireGeo: THREE.CylinderGeometry;
    hubGeo: THREE.CylinderGeometry;
    spokeGeo: THREE.BoxGeometry;
    megaStemGeo: THREE.CylinderGeometry;
    megaHornGeo: THREE.ConeGeometry;
    sirenGeo: THREE.CylinderGeometry;
    shadowGeo: THREE.CircleGeometry;
  },
  sharedMats: {
    whiteBodyMat: THREE.MeshStandardMaterial;
    bumperMat: THREE.MeshStandardMaterial;
    glassMat: THREE.MeshStandardMaterial;
    stripeMat: THREE.MeshStandardMaterial;
    headlightMat: THREE.MeshStandardMaterial;
    taillightMat: THREE.MeshStandardMaterial;
    tireMat: THREE.MeshStandardMaterial;
    hubMat: THREE.MeshStandardMaterial;
    megaphoneMat: THREE.MeshStandardMaterial;
    shadowMat: THREE.MeshBasicMaterial;
  },
  vanIndex: number,
  zOffset: number,
  hitTime: number,
  speed: number,
): DesiVanRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Ground contact shadow sitting flush on arena floor (y = 0.025)
  const contactShadow = new THREE.Mesh(sharedGeos.shadowGeo, sharedMats.shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.025, 0);
  contactShadow.scale.set(1.68, 0.88, 1);
  root.add(contactShadow);

  // 1. Primary Boxy Desi White Omni-Style Body (facing +X in local space)
  const mainBody = new THREE.Mesh(sharedGeos.bodyGeo, sharedMats.whiteBodyMat);
  mainBody.position.set(0, 0.82, 0);
  mainBody.castShadow = true;
  bodyPivot.add(mainBody);

  // Slightly inset beveled roof cap
  const roofCap = new THREE.Mesh(sharedGeos.roofGeo, sharedMats.whiteBodyMat);
  roofCap.position.set(-0.04, 1.44, 0);
  bodyPivot.add(roofCap);

  // Front & rear dark charcoal bumpers
  const frontBumper = new THREE.Mesh(sharedGeos.bumperGeo, sharedMats.bumperMat);
  frontBumper.position.set(1.26, 0.34, 0);
  bodyPivot.add(frontBumper);
  const rearBumper = new THREE.Mesh(sharedGeos.bumperGeo, sharedMats.bumperMat);
  rearBumper.position.set(-1.26, 0.34, 0);
  bodyPivot.add(rearBumper);

  // 2. Dark Tinted Front Windshield & Side Windows
  const windshield = new THREE.Mesh(sharedGeos.windshieldGeo, sharedMats.glassMat);
  windshield.position.set(1.21, 1.06, 0);
  windshield.rotation.z = 0.14;
  bodyPivot.add(windshield);

  [-1, 1].forEach((side) => {
    const sideWin = new THREE.Mesh(sharedGeos.sideWindowGeo, sharedMats.glassMat);
    sideWin.position.set(-0.05, 1.06, side * 0.595);
    bodyPivot.add(sideWin);

    // Bold Red/Orange "GARIB SENA" Side Livery Stripe Panel
    const stripe = new THREE.Mesh(sharedGeos.stripeGeo, sharedMats.stripeMat);
    stripe.position.set(0, 0.62, side * 0.602);
    stripe.rotation.y = side === 1 ? 0 : Math.PI;
    bodyPivot.add(stripe);
  });

  // 3. Glowing Warm-White Headlights + Additive Headlight Cones + Red Taillights
  const headlightConeMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  [-0.36, 0.36].forEach((hz) => {
    const hl = new THREE.Mesh(sharedGeos.headlightGeo, sharedMats.headlightMat);
    hl.position.set(1.25, 0.56, hz);
    bodyPivot.add(hl);

    const cone = new THREE.Mesh(sharedGeos.coneGeo, headlightConeMat);
    cone.rotation.z = Math.PI / 2;
    cone.position.set(2.35, 0.52, hz);
    bodyPivot.add(cone);

    const tl = new THREE.Mesh(sharedGeos.taillightGeo, sharedMats.taillightMat);
    tl.position.set(-1.25, 0.58, hz);
    bodyPivot.add(tl);
  });

  // 4. Roof Megaphone Loudhailer + Flashing Campaign Siren Beacon
  const megaStem = new THREE.Mesh(sharedGeos.megaStemGeo, sharedMats.bumperMat);
  megaStem.position.set(0.45, 1.56, 0);
  bodyPivot.add(megaStem);

  const megaHorn = new THREE.Mesh(sharedGeos.megaHornGeo, sharedMats.megaphoneMat);
  megaHorn.rotation.z = Math.PI / 2;
  megaHorn.position.set(0.68, 1.66, 0);
  bodyPivot.add(megaHorn);

  const sirenMat = new THREE.MeshStandardMaterial({
    color: vanIndex % 2 === 0 ? 0xef4444 : 0xf97316,
    emissive: new THREE.Color(vanIndex % 2 === 0 ? 0xef4444 : 0xf97316),
    emissiveIntensity: 1.8,
    roughness: 0.22,
  });
  const siren = new THREE.Mesh(sharedGeos.sirenGeo, sirenMat);
  siren.position.set(-0.22, 1.56, 0);
  bodyPivot.add(siren);

  // 5. Four Spinning Wheels (Bottom tangent flush at y = 0!)
  const wheels: THREE.Group[] = [];
  const wheelOffsets: Array<[number, number]> = [
    [0.74, 0.56],
    [0.74, -0.56],
    [-0.76, 0.56],
    [-0.76, -0.56],
  ];
  for (const [wx, wz] of wheelOffsets) {
    const wGroup = new THREE.Group();
    wGroup.position.set(wx, 0.27, wz);

    const tire = new THREE.Mesh(sharedGeos.tireGeo, sharedMats.tireMat);
    tire.rotation.x = Math.PI / 2;
    wGroup.add(tire);

    const hub = new THREE.Mesh(sharedGeos.hubGeo, sharedMats.hubMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = wz > 0 ? 0.02 : -0.02;
    wGroup.add(hub);

    // Visible hub spoke bar so wheel rotation reads unmistakably in motion
    const spoke = new THREE.Mesh(sharedGeos.spokeGeo, sharedMats.bumperMat);
    spoke.position.z = wz > 0 ? 0.095 : -0.095;
    wGroup.add(spoke);

    root.add(wGroup);
    wheels.push(wGroup);
  }

  // Keep reference to stripeTex used by sharedMats.stripeMat
  void stripeTex;
  root.visible = false;
  return { root, bodyPivot, wheels, sirenMat, headlightConeMat, zOffset, hitTime, speed };
}

export class NetaSuperVfx {
  public readonly group = new THREE.Group();

  // Phase 1-3: Warm Saffron Levitation Spotlight + Aura Rings + Upward Wind Streaks
  public readonly spotlight: THREE.SpotLight;
  private groundAuraRing: THREE.Mesh;
  private groundAuraMat: THREE.MeshBasicMaterial;
  private footAuraRing: THREE.Mesh;
  private footAuraMat: THREE.MeshBasicMaterial;

  private windMesh: THREE.InstancedMesh;
  private windSlots: WindStreakSlot[] = [];

  // Phase 2-3: 5 Pre-Pooled Stylized Low-Poly Desi White Mini-Vans
  private vans: DesiVanRig[] = [];
  private stripeTex: THREE.CanvasTexture;
  private sharedDisposables: Array<{ dispose: () => void }> = [];

  // Pre-Pooled Tire Dust & Metal Impact Sparks (InstancedMesh)
  private dustMesh: THREE.InstancedMesh;
  private dustSlots: DustPuffSlot[] = [];
  private dustCursor = 0;
  private dustSpawnAccum = 0;

  constructor(scene: THREE.Scene) {
    // 1. Warm Saffron Levitation SpotLight
    this.spotlight = new THREE.SpotLight(0xfb923c, 0, 26, Math.PI * 0.25, 0.6, 1.25);
    this.spotlight.position.set(0, 8.8, 2.4);
    this.spotlight.target.position.set(0, 2.0, 0);
    scene.add(this.spotlight);
    scene.add(this.spotlight.target);

    // Ground & Under-Feet Glowing Golden-Saffron Levitation Aura Rings
    const groundRingGeo = new THREE.RingGeometry(0.68, 1.48, 32);
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
    this.groundAuraRing.position.set(0, 0.06, 0);
    this.groundAuraRing.visible = false;
    this.group.add(this.groundAuraRing);

    const footRingGeo = new THREE.TorusGeometry(0.76, 0.075, 8, 28);
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

    // 2. Swirling Upward Levitation Wind Particles (Pre-Pooled InstancedMesh)
    const windGeo = new THREE.BoxGeometry(0.06, 0.44, 0.06);
    const windMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.windMesh = new THREE.InstancedMesh(windGeo, windMat, WIND_POOL_SIZE);
    this.windMesh.frustumCulled = false;
    for (let i = 0; i < WIND_POOL_SIZE; i++) {
      this.windSlots.push({
        angle: (i / WIND_POOL_SIZE) * Math.PI * 2,
        radius: 0.55 + (i % 4) * 0.24,
        speed: 4.2 + (i % 5) * 0.75,
        yPhase: (i / WIND_POOL_SIZE) * 2.8,
        scaleY: 0.7 + (i % 3) * 0.35,
      });
      _mat4.makeScale(0, 0, 0);
      this.windMesh.setMatrixAt(i, _mat4);
    }
    this.windMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.windMesh);

    // 3. Shared Geometries & PBR Materials for 5 Pre-Pooled Desi White Mini-Vans
    this.stripeTex = createGaribSenaStripeTexture();
    const sharedGeos = {
      bodyGeo: new THREE.BoxGeometry(2.42, 1.12, 1.16),
      roofGeo: new THREE.BoxGeometry(2.16, 0.14, 1.02),
      bumperGeo: new THREE.BoxGeometry(0.16, 0.2, 1.2),
      windshieldGeo: new THREE.BoxGeometry(0.08, 0.48, 0.98),
      sideWindowGeo: new THREE.BoxGeometry(1.76, 0.42, 0.06),
      stripeGeo: new THREE.PlaneGeometry(2.22, 0.34),
      headlightGeo: new THREE.BoxGeometry(0.1, 0.18, 0.22),
      taillightGeo: new THREE.BoxGeometry(0.1, 0.22, 0.18),
      coneGeo: new THREE.ConeGeometry(0.55, 2.2, 12, 1, true),
      tireGeo: new THREE.CylinderGeometry(0.27, 0.27, 0.18, 12),
      hubGeo: new THREE.CylinderGeometry(0.14, 0.14, 0.19, 10),
      spokeGeo: new THREE.BoxGeometry(0.22, 0.05, 0.03),
      megaStemGeo: new THREE.CylinderGeometry(0.035, 0.045, 0.18, 6),
      megaHornGeo: new THREE.ConeGeometry(0.16, 0.42, 10, 1, true),
      sirenGeo: new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10),
      shadowGeo: new THREE.CircleGeometry(0.92, 20),
    };

    const sharedMats = {
      whiteBodyMat: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.36,
        metalness: 0.08,
        envMapIntensity: 0.55,
      }),
      bumperMat: new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.78,
        metalness: 0.12,
      }),
      glassMat: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.14,
        metalness: 0.38,
        envMapIntensity: 1.0,
      }),
      stripeMat: new THREE.MeshStandardMaterial({
        map: this.stripeTex,
        color: 0xffffff,
        roughness: 0.48,
        metalness: 0.04,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
      headlightMat: new THREE.MeshStandardMaterial({
        color: 0xfef9c3,
        emissive: new THREE.Color(0xfde047),
        emissiveIntensity: 2.2,
        roughness: 0.15,
      }),
      taillightMat: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: new THREE.Color(0xdc2626),
        emissiveIntensity: 1.4,
        roughness: 0.25,
      }),
      tireMat: new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.88,
        metalness: 0.05,
      }),
      hubMat: new THREE.MeshStandardMaterial({
        color: 0xd4d4d8,
        roughness: 0.26,
        metalness: 0.72,
      }),
      megaphoneMat: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.32,
        metalness: 0.45,
        side: THREE.DoubleSide,
      }),
      shadowMat: new THREE.MeshBasicMaterial({
        map: getContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      }),
    };

    Object.values(sharedGeos).forEach((g) => this.sharedDisposables.push(g));
    Object.values(sharedMats).forEach((m) => this.sharedDisposables.push(m));

    // Staggered convoy: 4 convoy vans + 1 centered Lead Finisher Van
    const zOffsets = [-0.34, 0.3, -0.22, 0.36, 0.0];
    const hitTimes = [...NETA_CONVOY_HIT_TIMES, NETA_LEAD_VAN_HIT_TIME];
    const speeds = [23.5, 24.5, 25.0, 25.5, 27.5];

    for (let i = 0; i < NETA_VAN_COUNT; i++) {
      const van = createDesiOmniVan(
        this.stripeTex,
        sharedGeos,
        sharedMats,
        i,
        zOffsets[i],
        hitTimes[i],
        speeds[i],
      );
      this.vans.push(van);
      this.group.add(van.root);
    }

    // 4. Tire Dust Puffs & Metal Impact Sparks Pool (InstancedMesh)
    const dustGeo = new THREE.IcosahedronGeometry(0.24, 1);
    const dustMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0,
      emissive: new THREE.Color(0x44403c),
      emissiveIntensity: 0.16,
    });
    this.dustMesh = new THREE.InstancedMesh(dustGeo, dustMat, DUST_POOL_SIZE);
    this.dustMesh.frustumCulled = false;
    for (let i = 0; i < DUST_POOL_SIZE; i++) {
      this.dustSlots.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.45,
        scale: 0,
      });
      _mat4.makeScale(0, 0, 0);
      this.dustMesh.setMatrixAt(i, _mat4);
    }
    this.dustMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.dustMesh);

    scene.add(this.group);
  }

  private spawnDustOrSparks(
    x: number,
    y: number,
    z: number,
    count: number,
    speed: number,
    hexColor: number,
    lowGraphics: boolean,
  ): void {
    const n = lowGraphics ? Math.max(2, Math.floor(count * 0.5)) : count;
    for (let i = 0; i < n; i++) {
      const idx = this.dustCursor;
      this.dustCursor = (this.dustCursor + 1) % DUST_POOL_SIZE;
      const slot = this.dustSlots[idx];
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.45 + Math.random() * 0.8);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.45;
      slot.y = y + Math.random() * 0.25;
      slot.z = z + (Math.random() - 0.5) * 0.45;
      slot.vx = Math.cos(a) * spd;
      slot.vy = 1.6 + Math.random() * spd * 0.7;
      slot.vz = Math.sin(a) * spd * 0.6;
      slot.life = 0;
      slot.maxLife = 0.34 + Math.random() * 0.24;
      slot.scale = 0.75 + Math.random() * 0.6;
      _color.setHex(hexColor);
      this.dustMesh.setColorAt(idx, _color);
    }
    if (this.dustMesh.instanceColor) {
      this.dustMesh.instanceColor.needsUpdate = true;
    }
  }

  public handleBeatSignals(signals: NetaSuperBeatSignal[], lowGraphics: boolean): void {
    for (const sig of signals) {
      if (sig.kind === 'van_hit') {
        this.spawnDustOrSparks(sig.x, sig.y, 0.2, 10, 6.2, 0xfb923c, lowGraphics);
        this.spawnDustOrSparks(sig.x, 0.25, 0, 6, 4.4, 0xe7e5e4, lowGraphics);
      } else if (sig.kind === 'van_finisher') {
        this.spawnDustOrSparks(sig.x, sig.y, 0.2, 18, 9.0, 0xfacc15, lowGraphics);
        this.spawnDustOrSparks(sig.x, 0.25, 0, 10, 5.8, 0xd6d3d1, lowGraphics);
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    superState: NetaSuperState | null,
    attackerX: number,
    attackerY: number,
    attackerFacing: 1 | -1,
    defenderX: number,
    lowGraphics: boolean,
  ): number {
    const dimFactor = superState?.active ? getNetaSuperDimFactor(superState.elapsed) : 0;

    // 1. Warm Saffron Levitation Spotlight + Under-Feet Aura Rings + Swirling Wind Streaks
    if (superState?.active && dimFactor > 0.01) {
      this.spotlight.position.set(attackerX, 8.8, 2.4);
      this.spotlight.target.position.set(attackerX, attackerY + 1.0, 0);
      this.spotlight.target.updateMatrixWorld();
      this.spotlight.intensity = 16.5 * dimFactor;

      const levRatio = Math.min(1, attackerY / 1.8);
      const pulse = (elapsed * 1.9) % 1;

      this.groundAuraRing.visible = true;
      this.groundAuraRing.position.set(attackerX, 0.06, 0);
      this.groundAuraRing.scale.setScalar(0.85 + pulse * 1.45);
      this.groundAuraRing.rotation.z = elapsed * 3.8;
      this.groundAuraMat.opacity = (1 - pulse) * 0.82 * dimFactor;

      this.footAuraRing.visible = true;
      this.footAuraRing.position.set(attackerX, Math.max(0.18, attackerY - 0.08), 0);
      this.footAuraRing.scale.setScalar(0.85 + Math.sin(elapsed * 12) * 0.12 + levRatio * 0.25);
      this.footAuraRing.rotation.z = -elapsed * 6.5;
      this.footAuraMat.opacity = 0.88 * dimFactor;

      // Swirling upward golden-saffron wind streaks beneath & around levitating Neta
      const streakCeiling = Math.max(1.2, attackerY + 1.1);
      for (let i = 0; i < WIND_POOL_SIZE; i++) {
        const w = this.windSlots[i];
        const yLoop = (w.yPhase + elapsed * 2.4) % streakCeiling;
        const a = w.angle + elapsed * w.speed;
        const radiusTaper = w.radius * (1.15 - (yLoop / streakCeiling) * 0.4);
        const px = attackerX + Math.cos(a) * radiusTaper;
        const pz = Math.sin(a) * radiusTaper;
        const edgeFade = Math.sin((yLoop / streakCeiling) * Math.PI);
        _pos.set(px, 0.12 + yLoop, pz);
        _euler.set(0, -a, 0.28);
        _quat.setFromEuler(_euler);
        _scale.set(edgeFade, w.scaleY * edgeFade, edgeFade);
        _mat4.compose(_pos, _quat, _scale);
        this.windMesh.setMatrixAt(i, _mat4);
      }
      this.windMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.spotlight.intensity = 0;
      this.groundAuraRing.visible = false;
      this.footAuraRing.visible = false;
      this.groundAuraMat.opacity = 0;
      this.footAuraMat.opacity = 0;
      for (let i = 0; i < WIND_POOL_SIZE; i++) {
        _mat4.makeScale(0, 0, 0);
        this.windMesh.setMatrixAt(i, _mat4);
      }
      this.windMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Fleet of 5 Stylized Low-Poly Desi White Mini-Vans Racing Across Ground Floor
    if (superState?.active && superState.elapsed >= 1.38) {
      const t = superState.elapsed;
      const targetX = superState.targetX || defenderX;
      this.dustSpawnAccum += dt;
      const emitDustNow = this.dustSpawnAccum >= 0.055;
      if (emitDustNow) this.dustSpawnAccum = 0;

      for (let i = 0; i < this.vans.length; i++) {
        const van = this.vans[i];
        // Front bumper (x = +1.26) reaches targetX at exact van.hitTime!
        const dtFromHit = t - van.hitTime;
        const centerX = targetX - attackerFacing * 1.1 + attackerFacing * (dtFromHit * van.speed);

        const inVisibleRange = centerX >= -21 && centerX <= 21;
        van.root.visible = inVisibleRange;
        if (!inVisibleRange) continue;

        van.root.position.set(centerX, 0, van.zOffset);
        van.root.rotation.y = attackerFacing === 1 ? 0 : Math.PI;

        // Suspension bounce & slight forward-lean while racing at top speed
        van.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 26 + i * 1.9)) * 0.055;
        van.bodyPivot.rotation.z = -0.025 + Math.sin(elapsed * 18 + i) * 0.018;

        // Spin all 4 wheels rapidly matching forward travel direction
        const wheelSpin = -dtFromHit * van.speed * 3.7;
        for (const w of van.wheels) {
          w.rotation.z = wheelSpin;
        }

        // Flashing siren beacon + bright headlight cone
        van.sirenMat.emissiveIntensity = 1.2 + Math.abs(Math.sin(elapsed * 22 + i * 1.5)) * 2.2;
        van.headlightConeMat.opacity = 0.24 * Math.max(0.35, dimFactor);

        // Kick up tire dust puffs behind rear wheels on arena surface
        if (emitDustNow && Math.abs(centerX - targetX) < 12) {
          const rearWheelX = centerX - attackerFacing * 1.05;
          this.spawnDustOrSparks(rearWheelX, 0.14, van.zOffset, 1, 2.2, 0xd6d3d1, lowGraphics);
        }
      }
    } else {
      for (const van of this.vans) {
        van.root.visible = false;
      }
    }

    // 3. Update Pooled Tire Dust Puffs & Metal Impact Sparks
    let dustDirty = false;
    for (let i = 0; i < this.dustSlots.length; i++) {
      const d = this.dustSlots[i];
      if (!d.active) continue;
      dustDirty = true;
      d.life += dt;
      if (d.life >= d.maxLife) {
        d.active = false;
        _mat4.makeScale(0, 0, 0);
        this.dustMesh.setMatrixAt(i, _mat4);
        continue;
      }
      d.vy -= 5.8 * dt;
      d.x += d.vx * dt;
      d.y = Math.max(0.08, d.y + d.vy * dt);
      d.z += d.vz * dt;
      const frac = d.life / d.maxLife;
      const s = d.scale * (1 - frac * 0.85) * (0.7 + frac * 0.65);
      _pos.set(d.x, d.y, d.z);
      _euler.set(d.life * 6, d.life * 5, 0);
      _quat.setFromEuler(_euler);
      _scale.setScalar(Math.max(0.01, s));
      _mat4.compose(_pos, _quat, _scale);
      this.dustMesh.setMatrixAt(i, _mat4);
    }
    if (dustDirty) {
      this.dustMesh.instanceMatrix.needsUpdate = true;
    }

    return dimFactor;
  }

  public setPrewarmVisible(visible: boolean): void {
    this.spotlight.intensity = visible ? 0.001 : 0;
    this.groundAuraRing.visible = visible;
    this.footAuraRing.visible = visible;
    this.groundAuraMat.opacity = 0;
    this.footAuraMat.opacity = 0;
    for (const van of this.vans) {
      van.root.visible = visible;
      van.root.position.set(0, visible ? -40 : 0, 0);
    }
  }

  public reset(): void {
    this.spotlight.intensity = 0;
    this.groundAuraRing.visible = false;
    this.footAuraRing.visible = false;
    this.groundAuraMat.opacity = 0;
    this.footAuraMat.opacity = 0;
    this.dustSpawnAccum = 0;
    for (const van of this.vans) {
      van.root.visible = false;
    }
    for (let i = 0; i < WIND_POOL_SIZE; i++) {
      _mat4.makeScale(0, 0, 0);
      this.windMesh.setMatrixAt(i, _mat4);
    }
    this.windMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < DUST_POOL_SIZE; i++) {
      this.dustSlots[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.dustMesh.setMatrixAt(i, _mat4);
    }
    this.dustMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.spotlight);
    scene.remove(this.spotlight.target);
    scene.remove(this.group);
    this.groundAuraRing.geometry.dispose();
    this.groundAuraMat.dispose();
    this.footAuraRing.geometry.dispose();
    this.footAuraMat.dispose();
    this.windMesh.geometry.dispose();
    (this.windMesh.material as THREE.Material).dispose();
    this.dustMesh.geometry.dispose();
    (this.dustMesh.material as THREE.Material).dispose();
    this.stripeTex.dispose();
    for (const van of this.vans) {
      van.sirenMat.dispose();
      van.headlightConeMat.dispose();
    }
    for (const item of this.sharedDisposables) {
      item.dispose();
    }
  }
}
