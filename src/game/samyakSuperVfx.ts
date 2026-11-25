import * as THREE from 'three';
import {
  SAMYAK_BOOK_COUNT,
  SAMYAK_DUMBBELL_COUNT,
  SAMYAK_SLAM_IMPACT_TIME,
  type SamyakSuperBeatSignal,
  type SamyakSuperState,
} from './samyakSuper';

const SPARK_POOL_SIZE = 72;
const PAGE_POOL_SIZE = 28;
const BARRAGE_SUMMON_TIME = 1.8;
const BARRAGE_FIRE_START = 2.22;

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _axis = new THREE.Vector3(0, 1, 0);
const _euler = new THREE.Euler();

interface PooledOrbitalProp {
  obj: THREE.Object3D;
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
  isDumbbell: boolean;
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

interface PageSlot {
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
 * Generates crisp pre-built UPSC textbook cover CanvasTextures ("POLITY", "NCERT", "HISTORY", "UPSC").
 */
function createUpscBookTexture(
  title: string,
  subtitle: string,
  bgTop: string,
  bgBottom: string,
  bandColor: string,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 320);

  // Spine crease strip on left
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(0, 0, 22, 320);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(22, 0, 4, 320);

  // Crisp gold border frame
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 8;
  ctx.strokeRect(28, 16, 212, 288);

  // Top UPSC edition badge band
  ctx.fillStyle = bandColor;
  ctx.fillRect(34, 28, 200, 40);
  ctx.fillStyle = '#FEF9C3';
  ctx.font = '900 18px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CIVIL SERVICES', 134, 49);

  // Bold book subject title
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 42px Impact, "Arial Black", sans-serif';
  ctx.fillText(title, 136, 148);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(title, 134, 145);

  // Subtitle bar
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(52, 186, 164, 5);
  ctx.fillStyle = '#FEF08A';
  ctx.font = '900 18px "Arial Black", sans-serif';
  ctx.fillText(subtitle, 134, 214);

  // Bottom AIR 1 emblem seal
  ctx.beginPath();
  ctx.arc(134, 264, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#FACC15';
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 14px "Arial Black", sans-serif';
  ctx.fillText('IAS', 134, 265);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates the glowing golden "IAS · AIR 1" arena floor emblem seal texture for the Phase 3 slam.
 */
function createAir1SealTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const cx = 256;
  const cy = 256;

  ctx.clearRect(0, 0, 512, 512);

  // Radial golden-blue energy glow
  const glow = ctx.createRadialGradient(cx, cy, 24, cx, cy, 248);
  glow.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
  glow.addColorStop(0.45, 'rgba(245, 158, 11, 0.58)');
  glow.addColorStop(0.75, 'rgba(56, 189, 248, 0.34)');
  glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 248, 0, Math.PI * 2);
  ctx.fill();

  // Concentric ceremonial gold seal rings
  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, 214, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 190, 0, Math.PI * 2);
  ctx.stroke();

  // Dark medallion center for high contrast text
  ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
  ctx.beginPath();
  ctx.arc(cx, cy, 174, 0, Math.PI * 2);
  ctx.fill();

  // Star accents around rim
  ctx.fillStyle = '#FACC15';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sx = cx + Math.cos(a) * 150;
    const sy = cy + Math.sin(a) * 150;
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bold "IAS" + "AIR 1" typography
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#38BDF8';
  ctx.font = '900 54px "Arial Black", Impact, sans-serif';
  ctx.fillText('IAS', cx, cy - 48);

  ctx.fillStyle = '#FACC15';
  ctx.fillRect(cx - 108, cy - 8, 216, 6);

  ctx.fillStyle = '#FEF9C3';
  ctx.font = '900 84px Impact, "Arial Black", sans-serif';
  ctx.fillText('AIR 1', cx, cy + 52);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Pre-pooled zero-GC 3D VFX manager for Samyak's "MISSION IAS: BEAST MODE!" Super Power:
 * - Dramatic golden-blue spotlight + pulsing aura rings & cylinder around Samyak
 * - Sharp anime-style white sunglasses lens glint/flash during Phase 1 flex
 * - 8 pre-pooled 3D UPSC books ("POLITY", "NCERT", "HISTORY", "UPSC") + 6 heavy black iron gym dumbbells
 * - Glowing golden "IAS · AIR 1" floor seal + shockwave ring + heavy barbell impact wave on Phase 3 slam
 * - Pooled golden-blue spark & fluttering textbook page InstancedMeshes
 */
export class SamyakSuperVfx {
  private root: THREE.Group;

  // Dramatic golden-blue spotlight & pulsing body aura
  private spotLight: THREE.SpotLight;
  private spotTarget: THREE.Object3D;
  private auraLight: THREE.PointLight;
  private spotlightBeam: THREE.Mesh;
  private spotlightBeamMat: THREE.MeshBasicMaterial;
  private auraShell: THREE.Mesh;
  private auraShellMat: THREE.MeshBasicMaterial;
  private auraRingOuter: THREE.Mesh;
  private auraRingOuterMat: THREE.MeshBasicMaterial;
  private auraRingInner: THREE.Mesh;
  private auraRingInnerMat: THREE.MeshBasicMaterial;

  // Sharp anime-style white sunglasses lens glint/flash
  private glintGroup: THREE.Group;
  private glintMat: THREE.MeshBasicMaterial;
  private glintTimer = 0;

  // Pre-pooled 3D UPSC books + heavy iron gym dumbbells
  private bookTextures: THREE.CanvasTexture[] = [];
  private bookGeo: THREE.BoxGeometry;
  private bookPageMat: THREE.MeshStandardMaterial;
  private bookCoverMats: THREE.MeshStandardMaterial[] = [];
  private dumbbellHandleGeo: THREE.CylinderGeometry;
  private dumbbellPlateGeo: THREE.CylinderGeometry;
  private dumbbellCollarGeo: THREE.CylinderGeometry;
  private dumbbellHandleMat: THREE.MeshStandardMaterial;
  private dumbbellPlateMat: THREE.MeshStandardMaterial;
  private orbitalProps: PooledOrbitalProp[] = [];

  // Phase 3 Finisher: Glowing golden "IAS · AIR 1" floor seal + shockwave + barbell impact wave
  private air1SealTex: THREE.CanvasTexture;
  private air1SealMesh: THREE.Mesh;
  private air1SealMat: THREE.MeshBasicMaterial;
  private shockRing: THREE.Mesh;
  private shockRingMat: THREE.MeshBasicMaterial;
  private shockTimer = 0;
  private barbellWaveGroup: THREE.Group;
  private barbellBarMat: THREE.MeshStandardMaterial;
  private barbellPlateMat: THREE.MeshStandardMaterial;
  private barbellTimer = 0;

  // Pooled golden-blue sparks + fluttering textbook page confetti InstancedMeshes
  private sparkMesh: THREE.InstancedMesh;
  private sparks: SparkSlot[] = [];
  private sparkCursor = 0;

  private pageMesh: THREE.InstancedMesh;
  private pages: PageSlot[] = [];
  private pageCursor = 0;

  private dimFactor = 0;
  private isActive = false;

  constructor(scene: THREE.Scene) {
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);

    // 1. Golden-blue dramatic spotlight & body aura light
    this.spotTarget = new THREE.Object3D();
    this.root.add(this.spotTarget);

    this.spotLight = new THREE.SpotLight(0xfef08a, 0, 26, Math.PI * 0.24, 0.55, 1.1);
    this.spotLight.position.set(0, 10.5, 3.2);
    this.spotLight.target = this.spotTarget;
    this.root.add(this.spotLight);

    this.auraLight = new THREE.PointLight(0x38bdf8, 0, 14, 1.3);
    this.root.add(this.auraLight);

    // Golden-blue vertical spotlight beam
    this.spotlightBeamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.spotlightBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 2.35, 10.2, 20, 1, true),
      this.spotlightBeamMat,
    );
    this.root.add(this.spotlightBeam);

    // Pulsing golden-blue energy aura cylinder + concentric ground rings
    this.auraShellMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.auraShell = new THREE.Mesh(
      new THREE.CylinderGeometry(1.04, 0.62, 1.05, 24, 1, true),
      this.auraShellMat,
    );
    this.root.add(this.auraShell);

    this.auraRingOuterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.auraRingOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.28, 32),
      this.auraRingOuterMat,
    );
    this.auraRingOuter.rotation.x = -Math.PI / 2;
    this.root.add(this.auraRingOuter);

    this.auraRingInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.auraRingInner = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.74, 28),
      this.auraRingInnerMat,
    );
    this.auraRingInner.rotation.x = -Math.PI / 2;
    this.root.add(this.auraRingInner);

    // 2. Sharp anime-style white sunglasses lens glint/flash (4-point star flare)
    this.glintGroup = new THREE.Group();
    this.glintMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const hBeam = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.085), this.glintMat);
    const vBeam = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.95), this.glintMat);
    const diagA = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.045), this.glintMat);
    diagA.rotation.z = Math.PI / 4;
    const diagB = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.045), this.glintMat);
    diagB.rotation.z = -Math.PI / 4;
    const coreFlash = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), this.glintMat);
    this.glintGroup.add(hBeam, vBeam, diagA, diagB, coreFlash);
    this.glintGroup.visible = false;
    this.root.add(this.glintGroup);

    // 3. Pre-pooled 3D UPSC Books (POLITY, NCERT, HISTORY, UPSC) + Heavy Black Iron Gym Dumbbells
    const bookSpecs = [
      { title: 'POLITY', sub: 'LAXMIKANTH', top: '#B91C1C', bot: '#7F1D1D', band: '#991B1B' },
      { title: 'NCERT', sub: 'CLASS VI-XII', top: '#1D4ED8', bot: '#1E3A8A', band: '#1E40AF' },
      { title: 'HISTORY', sub: 'SPECTRUM', top: '#047857', bot: '#064E3B', band: '#065F46' },
      { title: 'UPSC', sub: 'MISSION IAS', top: '#1E293B', bot: '#0F172A', band: '#B45309' },
    ];
    this.bookGeo = new THREE.BoxGeometry(0.46, 0.58, 0.13);
    this.bookPageMat = new THREE.MeshStandardMaterial({
      color: 0xfaf6ec,
      roughness: 0.72,
      metalness: 0.02,
      emissive: new THREE.Color(0xfef08a),
      emissiveIntensity: 0.18,
    });

    for (const spec of bookSpecs) {
      const tex = createUpscBookTexture(spec.title, spec.sub, spec.top, spec.bot, spec.band);
      this.bookTextures.push(tex);
      this.bookCoverMats.push(
        new THREE.MeshStandardMaterial({
          map: tex,
          color: 0xffffff,
          emissive: new THREE.Color(0x38bdf8),
          emissiveIntensity: 0.24,
          roughness: 0.38,
          metalness: 0.08,
        }),
      );
    }

    // Shared gym dumbbell geometries & PBR materials
    this.dumbbellHandleGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.44, 10);
    this.dumbbellHandleGeo.rotateZ(Math.PI / 2);
    this.dumbbellPlateGeo = new THREE.CylinderGeometry(0.175, 0.175, 0.095, 8);
    this.dumbbellPlateGeo.rotateZ(Math.PI / 2);
    this.dumbbellCollarGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.04, 10);
    this.dumbbellCollarGeo.rotateZ(Math.PI / 2);

    this.dumbbellHandleMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.24,
      metalness: 0.88,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 0.18,
    });
    this.dumbbellPlateMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.48,
      metalness: 0.62,
      emissive: new THREE.Color(0xfacc15),
      emissiveIntensity: 0.16,
    });

    const totalProps = SAMYAK_BOOK_COUNT + SAMYAK_DUMBBELL_COUNT;
    let bookIdx = 0;
    let dbIdx = 0;
    for (let i = 0; i < totalProps; i++) {
      // Interleave UPSC books and heavy black iron dumbbells cleanly around the orbital ring
      const useDumbbell = dbIdx < SAMYAK_DUMBBELL_COUNT && (i % 2 === 1 || bookIdx >= SAMYAK_BOOK_COUNT);
      let obj: THREE.Object3D;

      if (useDumbbell) {
        dbIdx += 1;
        const dbGroup = new THREE.Group();
        const handle = new THREE.Mesh(this.dumbbellHandleGeo, this.dumbbellHandleMat);
        const plateL1 = new THREE.Mesh(this.dumbbellPlateGeo, this.dumbbellPlateMat);
        plateL1.position.x = -0.22;
        const plateL2 = new THREE.Mesh(this.dumbbellPlateGeo, this.dumbbellPlateMat);
        plateL2.scale.set(0.84, 0.84, 0.82);
        plateL2.position.x = -0.31;
        const plateR1 = new THREE.Mesh(this.dumbbellPlateGeo, this.dumbbellPlateMat);
        plateR1.position.x = 0.22;
        const plateR2 = new THREE.Mesh(this.dumbbellPlateGeo, this.dumbbellPlateMat);
        plateR2.scale.set(0.84, 0.84, 0.82);
        plateR2.position.x = 0.31;
        const collarL = new THREE.Mesh(this.dumbbellCollarGeo, this.dumbbellHandleMat);
        collarL.position.x = -0.15;
        const collarR = new THREE.Mesh(this.dumbbellCollarGeo, this.dumbbellHandleMat);
        collarR.position.x = 0.15;
        dbGroup.add(handle, plateL1, plateL2, plateR1, plateR2, collarL, collarR);
        obj = dbGroup;
      } else {
        const coverMat = this.bookCoverMats[bookIdx % this.bookCoverMats.length];
        bookIdx += 1;
        obj = new THREE.Mesh(this.bookGeo, [
          this.bookPageMat,
          coverMat,
          this.bookPageMat,
          this.bookPageMat,
          coverMat,
          coverMat,
        ]);
      }

      obj.visible = false;
      this.root.add(obj);

      const launchTime = BARRAGE_FIRE_START + i * 0.068;
      const travelTime = 0.25 + (i % 3) * 0.032;
      this.orbitalProps.push({
        obj,
        orbitAngleOffset: (i / totalProps) * Math.PI * 2,
        orbitRadius: 1.42 + (i % 3) * 0.3,
        orbitHeightOffset: ((i % 4) - 1.5) * 0.32,
        launchTime,
        arriveTime: Math.min(3.45, launchTime + travelTime),
        arcHeight: 0.42 + (i % 4) * 0.25,
        arcZ: ((i % 5) - 2) * 0.28,
        startX: 0,
        startY: 1.5,
        startZ: 0,
        launched: false,
        isDumbbell: useDumbbell,
      });
    }

    // 4. Phase 3 Finisher: Glowing golden "IAS · AIR 1" Floor Seal + Shockwave + Barbell Impact Wave
    this.air1SealTex = createAir1SealTexture();
    this.air1SealMat = new THREE.MeshBasicMaterial({
      map: this.air1SealTex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.air1SealMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), this.air1SealMat);
    this.air1SealMesh.rotation.x = -Math.PI / 2;
    this.air1SealMesh.position.y = 0.05;
    this.air1SealMesh.visible = false;
    this.root.add(this.air1SealMesh);

    this.shockRingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.shockRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 1.22, 36), this.shockRingMat);
    this.shockRing.rotation.x = -Math.PI / 2;
    this.shockRing.position.y = 0.07;
    this.shockRing.visible = false;
    this.root.add(this.shockRing);

    // Colossal glowing golden-iron barbell impact wave slamming across ground on AIR 1 landing
    this.barbellWaveGroup = new THREE.Group();
    this.barbellBarMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: new THREE.Color(0xfacc15),
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0.85,
      transparent: true,
      opacity: 0.92,
    });
    this.barbellPlateMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 0.75,
      roughness: 0.32,
      metalness: 0.72,
      transparent: true,
      opacity: 0.92,
    });
    const bbShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 3.1, 12),
      this.barbellBarMat,
    );
    bbShaft.rotation.z = Math.PI / 2;
    this.barbellWaveGroup.add(bbShaft);
    [-1, 1].forEach((side) => {
      const pOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.56, 0.14, 18),
        this.barbellPlateMat,
      );
      pOuter.rotation.z = Math.PI / 2;
      pOuter.position.x = side * 1.18;
      const pInner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.44, 0.14, 18),
        this.barbellBarMat,
      );
      pInner.rotation.z = Math.PI / 2;
      pInner.position.x = side * 1.38;
      this.barbellWaveGroup.add(pOuter, pInner);
    });
    this.barbellWaveGroup.visible = false;
    this.root.add(this.barbellWaveGroup);

    // 5. Pooled golden-blue spark InstancedMesh
    const sparkGeo = new THREE.OctahedronGeometry(0.14, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.94,
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
        color: new THREE.Color(0xfacc15),
      });
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, this.sparks[i].color);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.root.add(this.sparkMesh);

    // 6. Pooled fluttering textbook page InstancedMesh
    const pageGeo = new THREE.PlaneGeometry(0.24, 0.32);
    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: new THREE.Color(0xfde047),
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
      roughness: 0.55,
    });
    this.pageMesh = new THREE.InstancedMesh(pageGeo, pageMat, PAGE_POOL_SIZE);
    this.pageMesh.frustumCulled = false;
    for (let i = 0; i < PAGE_POOL_SIZE; i++) {
      this.pages.push({
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
        maxLife: 0.9,
        scale: 0,
      });
      _mat4.makeScale(0, 0, 0);
      this.pageMesh.setMatrixAt(i, _mat4);
    }
    this.pageMesh.instanceMatrix.needsUpdate = true;
    this.root.add(this.pageMesh);
  }

  public setPrewarmVisible(visible: boolean): void {
    this.root.visible = visible;
    this.glintGroup.visible = visible;
    this.air1SealMesh.visible = visible;
    this.shockRing.visible = visible;
    this.barbellWaveGroup.visible = visible;
    for (const p of this.orbitalProps) {
      p.obj.visible = visible;
    }
  }

  public reset(): void {
    this.isActive = false;
    this.dimFactor = 0;
    this.glintTimer = 0;
    this.shockTimer = 0;
    this.barbellTimer = 0;
    this.root.visible = false;
    this.spotLight.intensity = 0;
    this.auraLight.intensity = 0;
    this.spotlightBeamMat.opacity = 0;
    this.auraShellMat.opacity = 0;
    this.auraRingOuterMat.opacity = 0;
    this.auraRingInnerMat.opacity = 0;
    this.glintGroup.visible = false;
    this.glintMat.opacity = 0;
    this.air1SealMesh.visible = false;
    this.air1SealMat.opacity = 0;
    this.shockRing.visible = false;
    this.barbellWaveGroup.visible = false;
    for (const p of this.orbitalProps) {
      p.obj.visible = false;
      p.launched = false;
    }
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      this.sparks[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < PAGE_POOL_SIZE; i++) {
      this.pages[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.pageMesh.setMatrixAt(i, _mat4);
    }
    this.pageMesh.instanceMatrix.needsUpdate = true;
  }

  private spawnSparks(x: number, y: number, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const slot = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.78);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.36;
      slot.y = y + (Math.random() - 0.5) * 0.36;
      slot.z = 0.25 + (Math.random() - 0.5) * 0.6;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.sin(angle) * spd + 2.0;
      slot.vz = (Math.random() - 0.5) * 3.0;
      slot.life = 0;
      slot.maxLife = 0.26 + Math.random() * 0.24;
      slot.scale = 0.75 + Math.random() * 0.9;
      slot.color.setHex(i % 3 === 0 ? 0xfacc15 : i % 3 === 1 ? 0x38bdf8 : 0xffffff);
    }
  }

  private spawnPages(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const slot = this.pages[this.pageCursor];
      this.pageCursor = (this.pageCursor + 1) % PAGE_POOL_SIZE;
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.45;
      const spd = 2.4 + Math.random() * 4.2;
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.45;
      slot.y = y + 0.25 + Math.random() * 0.45;
      slot.z = (Math.random() - 0.5) * 0.75;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = 2.8 + Math.random() * 3.6;
      slot.vz = Math.sin(angle) * spd * 0.6;
      slot.rx = Math.random() * Math.PI;
      slot.ry = Math.random() * Math.PI;
      slot.rz = Math.random() * Math.PI;
      slot.life = 0;
      slot.maxLife = 0.68 + Math.random() * 0.45;
      slot.scale = 0.8 + Math.random() * 0.4;
    }
  }

  public handleBeatSignals(signals: SamyakSuperBeatSignal[], lowGraphics: boolean): void {
    const scaleFactor = lowGraphics ? 0.55 : 1;
    for (const sig of signals) {
      if (sig.kind === 'flex_start') {
        for (const p of this.orbitalProps) {
          p.launched = false;
          p.obj.visible = false;
        }
        this.spawnSparks(sig.x, sig.y, Math.round(16 * scaleFactor), 5.8);
      } else if (sig.kind === 'lens_glint') {
        this.glintTimer = 0.52;
        this.glintGroup.visible = true;
        this.glintMat.opacity = 1;
        this.spawnSparks(sig.x, sig.y, Math.round(12 * scaleFactor), 4.6);
      } else if (sig.kind === 'barrage_summon') {
        this.spawnSparks(sig.x, sig.y, Math.round(18 * scaleFactor), 6.5);
      } else if (sig.kind === 'barrage_hit') {
        this.spawnSparks(sig.x, sig.y, Math.round(11 * scaleFactor), 6.8);
        this.spawnPages(sig.x, sig.y, Math.round(3 * scaleFactor));
      } else if (sig.kind === 'slam_leap') {
        this.spawnSparks(sig.x, 0.35, Math.round(14 * scaleFactor), 5.5);
      } else if (sig.kind === 'air1_slam_impact') {
        this.shockTimer = 0.65;
        this.barbellTimer = 0.62;
        this.shockRing.position.set(sig.x, 0.07, 0);
        this.shockRing.scale.set(0.55, 0.55, 1);
        this.shockRing.visible = true;
        this.shockRingMat.opacity = 0.96;

        this.air1SealMesh.position.set(sig.x, 0.05, 0);
        this.air1SealMesh.scale.set(0.4, 0.4, 1);
        this.air1SealMesh.visible = true;
        this.air1SealMat.opacity = 0.98;

        this.barbellWaveGroup.position.set(sig.x, 0.58, 0.15);
        this.barbellWaveGroup.scale.set(0.55, 0.55, 0.55);
        this.barbellWaveGroup.visible = true;

        this.spawnSparks(sig.x, sig.y, Math.round(34 * scaleFactor), 9.6);
        this.spawnPages(sig.x, sig.y, Math.round(16 * scaleFactor));
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    sup: SamyakSuperState | null,
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

    // Update golden-blue sparks
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
      s.vy -= 11.5 * dt;
      s.x += s.vx * dt;
      s.y = Math.max(0.06, s.y + s.vy * dt);
      s.z += s.vz * dt;
      const sc = s.scale * (1 - s.life / s.maxLife);
      _pos.set(s.x, s.y, s.z);
      _scale.set(sc, sc, sc);
      _quat.setFromAxisAngle(_axis, s.life * 15);
      _mat4.compose(_pos, _quat, _scale);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, s.color);
    }
    if (sparksDirty) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
      if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    }

    // Update fluttering textbook pages
    let pagesDirty = false;
    for (let i = 0; i < PAGE_POOL_SIZE; i++) {
      const p = this.pages[i];
      if (!p.active) continue;
      anyActive = true;
      pagesDirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.pageMesh.setMatrixAt(i, _mat4);
        continue;
      }
      p.vx *= Math.max(0, 1 - dt * 1.8);
      p.vz *= Math.max(0, 1 - dt * 1.8);
      p.vy -= 6.0 * dt;
      p.x += p.vx * dt + Math.sin(elapsed * 10 + i) * dt * 0.65;
      p.y = Math.max(0.08, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.rx += dt * 7.8;
      p.ry += dt * 5.6;
      p.rz += dt * 6.8;
      const sc = p.scale * (1 - (p.life / p.maxLife) * 0.45);
      _pos.set(p.x, p.y, p.z);
      _euler.set(p.rx, p.ry, p.rz);
      _quat.setFromEuler(_euler);
      _scale.set(sc, sc, sc);
      _mat4.compose(_pos, _quat, _scale);
      this.pageMesh.setMatrixAt(i, _mat4);
    }
    if (pagesDirty) {
      this.pageMesh.instanceMatrix.needsUpdate = true;
    }

    // Update sunglasses anime lens glint flare
    if (this.glintTimer > 0) {
      anyActive = true;
      this.glintTimer = Math.max(0, this.glintTimer - dt);
      const p = 1 - this.glintTimer / 0.52;
      const flash = p < 0.25 ? p / 0.25 : Math.max(0, 1 - (p - 0.25) / 0.75);
      const sweepOffset = (p - 0.5) * 0.18 * attackerFacing;
      this.glintGroup.position.set(
        attackerX + attackerFacing * 0.12 + sweepOffset,
        attackerY + 2.11,
        0.31,
      );
      this.glintGroup.rotation.z = p * 0.72;
      const sc = 0.34 + flash * 0.54;
      this.glintGroup.scale.set(sc, sc, 1);
      this.glintMat.opacity = flash * 0.95;
      if (this.glintTimer <= 0) {
        this.glintGroup.visible = false;
      }
    }

    // Update ground shockwave ring & "IAS · AIR 1" emblem seal
    if (this.shockTimer > 0) {
      anyActive = true;
      this.shockTimer = Math.max(0, this.shockTimer - dt);
      const p = 1 - this.shockTimer / 0.65;
      const sc = 0.55 + (1 - (1 - p) * (1 - p)) * 4.1;
      this.shockRing.scale.set(sc, sc, 1);
      this.shockRingMat.opacity = Math.max(0, (1 - p) * 0.95);

      const sealSc = 0.45 + smoothstep(Math.min(1, p * 2.4)) * 1.05;
      this.air1SealMesh.scale.set(sealSc, sealSc, 1);
      this.air1SealMesh.rotation.z = p * 0.35;
      this.air1SealMat.opacity = p > 0.6 ? Math.max(0, (1 - (p - 0.6) / 0.4) * 0.95) : 0.95;

      if (this.shockTimer <= 0) {
        this.shockRing.visible = false;
        this.air1SealMesh.visible = false;
      }
    }

    // Update colossal heavy barbell impact wave
    if (this.barbellTimer > 0) {
      anyActive = true;
      this.barbellTimer = Math.max(0, this.barbellTimer - dt);
      const p = 1 - this.barbellTimer / 0.62;
      const sc = 0.7 + smoothstep(Math.min(1, p * 2.2)) * 0.85;
      this.barbellWaveGroup.scale.set(sc, sc, sc);
      this.barbellWaveGroup.position.y = 0.58 + Math.sin(p * Math.PI) * 0.42;
      this.barbellWaveGroup.rotation.y = p * Math.PI * 1.6;
      const alpha = p > 0.55 ? Math.max(0, 1 - (p - 0.55) / 0.45) : 0.94;
      this.barbellBarMat.opacity = alpha;
      this.barbellPlateMat.opacity = alpha;
      if (this.barbellTimer <= 0) {
        this.barbellWaveGroup.visible = false;
      }
    }

    if (!running || !sup) {
      this.dimFactor = Math.max(0, this.dimFactor - dt * 2.8);
      this.spotLight.intensity = Math.max(0, this.spotLight.intensity - dt * 70);
      this.auraLight.intensity = Math.max(0, this.auraLight.intensity - dt * 35);
      this.spotlightBeamMat.opacity = Math.max(0, this.spotlightBeamMat.opacity - dt * 0.8);
      this.auraShellMat.opacity = 0;
      this.auraRingOuterMat.opacity = 0;
      this.auraRingInnerMat.opacity = 0;
      for (const p of this.orbitalProps) {
        p.obj.visible = false;
      }
      if (!anyActive && this.dimFactor <= 0.001) {
        this.isActive = false;
        this.root.visible = false;
      }
      return this.dimFactor;
    }

    const t = sup.elapsed;
    const fadeIn = smoothstep(t / 0.36);
    const fadeOut = t > 4.35 ? 1 - smoothstep((t - 4.35) / 0.45) : 1;
    this.dimFactor = fadeIn * fadeOut * 0.84;

    // Dramatic golden-blue spotlight tracking Samyak
    const centerY = attackerY + 1.15;
    this.spotLight.position.set(attackerX, 10.6, 2.8);
    this.spotTarget.position.set(attackerX, centerY, 0);
    this.spotTarget.updateMatrixWorld();
    this.spotLight.intensity = 16 * fadeIn * fadeOut;

    this.auraLight.position.set(attackerX, centerY + 0.2, 1.15);
    this.auraLight.intensity = (4.8 + Math.sin(elapsed * 14) * 1.4) * fadeIn * fadeOut;

    this.spotlightBeam.position.set(attackerX, 5.1, 0);
    this.spotlightBeamMat.opacity = 0.11 * fadeIn * fadeOut;

    // Pulsing golden-blue beast-mode ground energy aura rising around Samyak's stance
    const auraStrength = t < 3.6 ? fadeIn * fadeOut : fadeOut * 0.55;
    const auraPulse = 1 + Math.sin(elapsed * 14) * 0.09;
    this.auraShell.position.set(attackerX, attackerY + 0.56, 0);
    this.auraShell.scale.set(auraPulse, 1 + Math.sin(elapsed * 11) * 0.08, auraPulse);
    this.auraShell.rotation.y = elapsed * 3.8;
    this.auraShellMat.opacity = (t < 1.8 ? 0.11 : 0.07) * auraStrength;

    this.auraRingOuter.position.set(attackerX, attackerY + 0.12, 0);
    this.auraRingOuter.rotation.z = elapsed * 3.0;
    this.auraRingOuterMat.opacity = 0.72 * auraStrength;

    this.auraRingInner.position.set(attackerX, attackerY + 0.06, 0);
    this.auraRingInner.rotation.z = -elapsed * 4.2;
    this.auraRingInnerMat.opacity = 0.78 * auraStrength;

    // Phase 2 (1.8s–3.5s): Swirling orbital ring of 3D UPSC books + black iron gym dumbbells -> rapid homing barrage!
    if (t >= BARRAGE_SUMMON_TIME && t < 3.55) {
      const summonT = smoothstep((t - BARRAGE_SUMMON_TIME) / 0.36);
      const orbitSpeed = t < BARRAGE_FIRE_START ? 5.2 + summonT * 2.4 : 7.4;

      for (let i = 0; i < this.orbitalProps.length; i++) {
        const p = this.orbitalProps[i];
        const angle = p.orbitAngleOffset + (t - BARRAGE_SUMMON_TIME) * orbitSpeed * attackerFacing;
        const orbitX = attackerX + Math.cos(angle) * p.orbitRadius;
        const orbitY =
          attackerY +
          1.35 +
          p.orbitHeightOffset +
          (1 - summonT) * 1.9 +
          Math.sin(angle * 2) * 0.12;
        const orbitZ = Math.sin(angle) * p.orbitRadius * 0.72;

        if (t < p.launchTime) {
          p.launched = false;
          p.obj.visible = true;
          p.obj.position.set(orbitX, orbitY, orbitZ);
          p.obj.rotation.set(
            elapsed * (p.isDumbbell ? 5.5 : 2.6) + i,
            -angle + Math.PI * 0.5,
            Math.cos(elapsed * 4.5 + i) * 0.4,
          );
          const sc = (0.45 + summonT * 0.62) * (p.isDumbbell ? 1.05 : 1.0);
          p.obj.scale.set(sc, sc, sc);
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
          const targetY = 1.05 + (i % 3) * 0.24;
          const x = THREE.MathUtils.lerp(p.startX, defenderX, flightT);
          const y =
            THREE.MathUtils.lerp(p.startY, targetY, flightT) +
            Math.sin(flightT * Math.PI) * p.arcHeight;
          const z =
            THREE.MathUtils.lerp(p.startZ, 0.14, flightT) +
            Math.sin(flightT * Math.PI) * p.arcZ;
          p.obj.visible = true;
          p.obj.position.set(x, y, z);
          p.obj.rotation.set(flightT * 12, flightT * 10, flightT * 16);
          p.obj.scale.set(1.12, 1.12, 1.12);
        } else {
          p.obj.visible = false;
        }
      }
    } else {
      for (const p of this.orbitalProps) {
        p.obj.visible = false;
      }
    }

    // Subtle dive-trail flare right before AIR 1 slam impact
    if (t >= 3.85 && t < SAMYAK_SLAM_IMPACT_TIME) {
      this.auraShell.position.set(attackerX, attackerY + 1.0, 0);
      this.auraShellMat.opacity = 0.28;
    }

    return this.dimFactor;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.root);
    for (const tex of this.bookTextures) tex.dispose();
    for (const mat of this.bookCoverMats) mat.dispose();
    this.bookGeo.dispose();
    this.bookPageMat.dispose();
    this.dumbbellHandleGeo.dispose();
    this.dumbbellPlateGeo.dispose();
    this.dumbbellCollarGeo.dispose();
    this.dumbbellHandleMat.dispose();
    this.dumbbellPlateMat.dispose();
    this.air1SealTex.dispose();
    this.air1SealMesh.geometry.dispose();
    this.air1SealMat.dispose();
    this.shockRing.geometry.dispose();
    this.shockRingMat.dispose();
    this.barbellBarMat.dispose();
    this.barbellPlateMat.dispose();
    this.barbellWaveGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    this.glintGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    this.glintMat.dispose();
    this.spotlightBeam.geometry.dispose();
    this.spotlightBeamMat.dispose();
    this.auraShell.geometry.dispose();
    this.auraShellMat.dispose();
    this.auraRingOuter.geometry.dispose();
    this.auraRingOuterMat.dispose();
    this.auraRingInner.geometry.dispose();
    this.auraRingInnerMat.dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.pageMesh.geometry.dispose();
    (this.pageMesh.material as THREE.Material).dispose();
  }
}
