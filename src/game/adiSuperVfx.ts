import * as THREE from 'three';
import {
  ADI_FINISHER_IMPACT_TIME,
  ADI_FINISHER_LEAP_TIME,
  type AdiSuperBeatSignal,
  type AdiSuperState,
} from './adiSuper';

interface SparkItem {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface BarrageProjectileVisual {
  group: THREE.Group;
  isDuster: boolean;
  orbitAngle: number;
  orbitRadius: number;
  orbitHeight: number;
  fired: boolean;
  fireTime: number;
  hitTime: number;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
}

const SPARK_POOL_SIZE = 72;
const BARRAGE_COUNT = 6;

const _dummy = new THREE.Object3D();
const _sparkColorEmerald = new THREE.Color(0x84cc16);
const _sparkColorGold = new THREE.Color(0xfacc15);
const _sparkColorChalk = new THREE.Color(0xfef9c3);
const _sparkColorOrange = new THREE.Color(0xf97316);

function createSpiralNotebookTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  // Cool olive-slate textured college notebook cover
  const grad = ctx.createLinearGradient(0, 0, 256, 320);
  grad.addColorStop(0, '#3f6212');
  grad.addColorStop(0.55, '#4d7c0f');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 320);

  // Spiral binding strip on left edge
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 28, 320);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  for (let y = 24; y < 306; y += 26) {
    ctx.beginPath();
    ctx.arc(14, y, 9, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
  }

  // Crisp ruled label box
  ctx.fillStyle = '#fefce8';
  ctx.fillRect(46, 56, 184, 118);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 5;
  ctx.strokeRect(46, 56, 184, 118);

  ctx.fillStyle = '#14532d';
  ctx.font = '900 30px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAST BENCH', 138, 102);

  ctx.fillStyle = '#b45309';
  ctx.font = '900 26px Impact, sans-serif';
  ctx.fillText('CLASS NOTES', 138, 140);

  // Diagonal comic bolt accent
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(56, 224);
  ctx.lineTo(132, 206);
  ctx.lineTo(118, 246);
  ctx.lineTo(208, 228);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('ADI · ROLL #LAST', 140, 290);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createFloorEmblemTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  const cx = 256;
  const cy = 256;

  // Glowing olive-lime & golden chalk shockwave circle
  const rad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 242);
  rad.addColorStop(0, 'rgba(250, 204, 21, 0.35)');
  rad.addColorStop(0.55, 'rgba(132, 204, 22, 0.28)');
  rad.addColorStop(0.88, 'rgba(250, 204, 21, 0.72)');
  rad.addColorStop(1, 'rgba(132, 204, 22, 0)');
  ctx.fillStyle = rad;
  ctx.beginPath();
  ctx.arc(cx, cy, 242, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 10;
  ctx.setLineDash([28, 14]);
  ctx.beginPath();
  ctx.arc(cx, cy, 214, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#84cc16';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 174, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fef9c3';
  ctx.font = '900 54px Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAST BENCH', cx, cy - 12);
  ctx.fillStyle = '#facc15';
  ctx.font = '900 44px Impact, sans-serif';
  ctx.fillText('STRIKE!', cx, cy + 44);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class AdiSuperVfx {
  private root: THREE.Group;
  private spotlightCone: THREE.Mesh;
  private spotlightMat: THREE.MeshBasicMaterial;
  private auraRingOuter: THREE.Mesh;
  private auraRingInner: THREE.Mesh;
  private auraRingMat: THREE.MeshBasicMaterial;
  private floorEmblem: THREE.Mesh;
  private floorEmblemMat: THREE.MeshBasicMaterial;
  private floorEmblemTex: THREE.CanvasTexture;
  private impactRing: THREE.Mesh;
  private impactRingMat: THREE.MeshBasicMaterial;
  private impactTimer = 0;

  private notebookTex: THREE.CanvasTexture;
  private notebookGeo: THREE.BoxGeometry;
  private notebookCoverMat: THREE.MeshStandardMaterial;
  private notebookPageMat: THREE.MeshStandardMaterial;
  private dusterWoodGeo: THREE.BoxGeometry;
  private dusterWoodMat: THREE.MeshStandardMaterial;
  private dusterFeltGeo: THREE.BoxGeometry;
  private dusterFeltMat: THREE.MeshStandardMaterial;
  private barrageVisuals: BarrageProjectileVisual[] = [];

  private sparkMesh: THREE.InstancedMesh;
  private sparkItems: SparkItem[] = [];

  constructor(scene: THREE.Scene) {
    this.root = new THREE.Group();
    this.root.visible = false;

    // Dramatic olive-emerald & gold spotlight beam
    this.spotlightMat = new THREE.MeshBasicMaterial({
      color: 0xa3e635,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const coneGeo = new THREE.ConeGeometry(2.3, 8.2, 24, 1, true);
    this.spotlightCone = new THREE.Mesh(coneGeo, this.spotlightMat);
    this.spotlightCone.position.y = 4.0;
    this.root.add(this.spotlightCone);

    // Rising emerald-gold energy rings
    this.auraRingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringGeo = new THREE.RingGeometry(0.95, 1.38, 32);
    this.auraRingOuter = new THREE.Mesh(ringGeo, this.auraRingMat);
    this.auraRingOuter.rotation.x = -Math.PI / 2;
    this.auraRingOuter.position.y = 0.08;
    this.root.add(this.auraRingOuter);

    this.auraRingInner = new THREE.Mesh(ringGeo, this.auraRingMat);
    this.auraRingInner.rotation.x = -Math.PI / 2;
    this.auraRingInner.position.y = 0.55;
    this.root.add(this.auraRingInner);

    // Glowing Last-Bench Strike floor emblem
    this.floorEmblemTex = createFloorEmblemTexture();
    this.floorEmblemMat = new THREE.MeshBasicMaterial({
      map: this.floorEmblemTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.floorEmblem = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), this.floorEmblemMat);
    this.floorEmblem.rotation.x = -Math.PI / 2;
    this.floorEmblem.position.y = 0.05;
    this.root.add(this.floorEmblem);

    // Finisher shockwave ring
    this.impactRingMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.impactRing = new THREE.Mesh(new THREE.RingGeometry(0.65, 1.45, 36), this.impactRingMat);
    this.impactRing.rotation.x = -Math.PI / 2;
    this.impactRing.position.y = 0.12;
    this.impactRing.visible = false;
    this.root.add(this.impactRing);

    // Pre-pooled spiral notebooks & wooden chalk dusters for Phase 2 barrage
    this.notebookTex = createSpiralNotebookTexture();
    this.notebookGeo = new THREE.BoxGeometry(0.38, 0.50, 0.08);
    this.notebookCoverMat = new THREE.MeshStandardMaterial({
      map: this.notebookTex,
      roughness: 0.45,
      metalness: 0.06,
      emissive: new THREE.Color(0x3f6212),
      emissiveIntensity: 0.35,
    });
    this.notebookPageMat = new THREE.MeshStandardMaterial({
      color: 0xfefce8,
      roughness: 0.72,
      metalness: 0.0,
    });
    const nbMats = [
      this.notebookPageMat,
      this.notebookPageMat,
      this.notebookPageMat,
      this.notebookPageMat,
      this.notebookCoverMat,
      this.notebookCoverMat,
    ];

    this.dusterWoodGeo = new THREE.BoxGeometry(0.42, 0.12, 0.16);
    this.dusterWoodMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.65,
      metalness: 0.04,
      emissive: new THREE.Color(0x78350f),
      emissiveIntensity: 0.25,
    });
    this.dusterFeltGeo = new THREE.BoxGeometry(0.41, 0.07, 0.155);
    this.dusterFeltMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.9,
      metalness: 0.0,
    });

    for (let i = 0; i < BARRAGE_COUNT; i++) {
      const grp = new THREE.Group();
      const isDuster = i % 2 === 1;
      if (isDuster) {
        const wood = new THREE.Mesh(this.dusterWoodGeo, this.dusterWoodMat);
        wood.position.y = 0.03;
        const felt = new THREE.Mesh(this.dusterFeltGeo, this.dusterFeltMat);
        felt.position.y = -0.06;
        grp.add(wood, felt);
      } else {
        const nb = new THREE.Mesh(this.notebookGeo, nbMats);
        grp.add(nb);
      }
      grp.visible = false;
      this.root.add(grp);
      this.barrageVisuals.push({
        group: grp,
        isDuster,
        orbitAngle: (i / BARRAGE_COUNT) * Math.PI * 2,
        orbitRadius: 1.35 + (i % 2) * 0.28,
        orbitHeight: 1.55 + (i % 3) * 0.35,
        fired: false,
        fireTime: 1.06 + i * 0.28,
        hitTime: 1.22 + i * 0.28,
        startPos: new THREE.Vector3(),
        targetPos: new THREE.Vector3(),
      });
    }

    // Zero-GC instanced spark / chalk-dust pool
    const sparkGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
    });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, SPARK_POOL_SIZE);
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.root.add(this.sparkMesh);

    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      this.sparkItems.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
        scale: 1,
        color: _sparkColorGold.clone(),
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
      this.sparkMesh.setColorAt(i, _sparkColorGold);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;

    scene.add(this.root);
  }

  public setPrewarmVisible(visible: boolean): void {
    this.root.visible = visible;
    for (const item of this.barrageVisuals) {
      item.group.visible = visible;
    }
    this.impactRing.visible = visible;
  }

  private spawnBurst(x: number, y: number, count: number, speed: number, color: THREE.Color): void {
    let spawned = 0;
    for (let i = 0; i < this.sparkItems.length && spawned < count; i++) {
      const s = this.sparkItems[i];
      if (s.active) continue;
      s.active = true;
      s.pos.set(x, y, (Math.random() - 0.5) * 0.4);
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.45 + Math.random() * 0.75);
      s.vel.set(Math.cos(a) * spd, Math.sin(a) * spd + 1.8, (Math.random() - 0.5) * spd * 0.7);
      s.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      s.rotVel.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      s.maxLife = 0.35 + Math.random() * 0.35;
      s.life = s.maxLife;
      s.scale = 0.65 + Math.random() * 0.85;
      s.color.copy(color);
      spawned++;
    }
  }

  public handleBeatSignals(signals: AdiSuperBeatSignal[], lowQuality: boolean): void {
    const mult = lowQuality ? 0.5 : 1;
    for (const sig of signals) {
      if (sig.kind === 'collar_flex') {
        this.spawnBurst(sig.x, sig.y, Math.round(12 * mult), 4.2, _sparkColorEmerald);
      } else if (sig.kind === 'aura_surge') {
        this.spawnBurst(sig.x, sig.y, Math.round(16 * mult), 5.6, _sparkColorGold);
      } else if (sig.kind === 'barrage_hit') {
        const isDuster = (sig.hitIndex ?? 0) % 2 === 1;
        this.spawnBurst(
          sig.x,
          sig.y,
          Math.round(10 * mult),
          5.8,
          isDuster ? _sparkColorChalk : _sparkColorEmerald,
        );
      } else if (sig.kind === 'finisher_leap') {
        this.spawnBurst(sig.x, 0.25, Math.round(14 * mult), 5.4, _sparkColorGold);
      } else if (sig.kind === 'last_bench_impact') {
        this.impactTimer = 0.78;
        this.impactRing.position.set(sig.x, 0.14, 0);
        this.impactRing.scale.setScalar(0.6);
        this.impactRing.visible = true;
        this.spawnBurst(sig.x, sig.y, Math.round(24 * mult), 8.2, _sparkColorGold);
        this.spawnBurst(sig.x, sig.y, Math.round(14 * mult), 6.8, _sparkColorOrange);
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    superState: AdiSuperState | null,
    attackerX: number,
    _attackerY: number,
    _facing: 1 | -1,
    defenderX: number,
  ): number {
    if (!superState || !superState.active) {
      if (this.impactTimer > 0) {
        this.impactTimer = Math.max(0, this.impactTimer - dt);
        const p = 1 - this.impactTimer / 0.78;
        this.impactRing.scale.setScalar(0.6 + p * 3.8);
        this.impactRingMat.opacity = (1 - p) * 0.8;
        this.impactRing.visible = this.impactTimer > 0;
      } else if (this.root.visible) {
        this.reset();
      }
      this.updateSparks(dt);
      return 0;
    }

    this.root.visible = true;
    const t = superState.elapsed;
    const dur = superState.duration;

    // Fade in and out smoothly for atmospheric stage dimming
    let dimFactor = 0.78;
    if (t < 0.35) dimFactor = (t / 0.35) * 0.78;
    else if (t > dur - 0.55) dimFactor = Math.max(0, ((dur - t) / 0.55) * 0.78);

    // Spotlight tracks Adi during flex & barrage, shifts to impact center during finisher
    const spotX = t < ADI_FINISHER_LEAP_TIME ? attackerX : (attackerX + defenderX) * 0.5;
    this.spotlightCone.position.set(spotX, 4.0, 0);
    this.spotlightMat.opacity = dimFactor * (0.28 + Math.sin(elapsed * 10) * 0.04);

    // Rising aura rings around Adi
    const ringScale = 0.9 + Math.sin(elapsed * 8) * 0.14;
    this.auraRingOuter.position.set(attackerX, 0.09, 0);
    this.auraRingOuter.scale.setScalar(ringScale);
    this.auraRingOuter.rotation.z = elapsed * 2.4;

    this.auraRingInner.position.set(attackerX, 0.35 + ((elapsed * 1.6) % 1.45), 0);
    this.auraRingInner.scale.setScalar(0.75 + Math.cos(elapsed * 9) * 0.1);
    this.auraRingInner.rotation.z = -elapsed * 3.1;
    this.auraRingMat.opacity = t < ADI_FINISHER_IMPACT_TIME ? 0.65 * dimFactor : 0.25 * dimFactor;

    // Floor emblem spins beneath Adi & expands sharply on impact
    const emblemX = t >= ADI_FINISHER_IMPACT_TIME ? defenderX : attackerX;
    this.floorEmblem.position.set(emblemX, 0.05, 0);
    this.floorEmblem.rotation.z = -elapsed * 1.45;
    const emblemScale = t >= ADI_FINISHER_IMPACT_TIME ? 1.45 : 0.95 + Math.sin(elapsed * 6) * 0.06;
    this.floorEmblem.scale.setScalar(emblemScale);
    this.floorEmblemMat.opacity = dimFactor * 0.85;

    // Orbiting & homing spiral notebooks + chalk dusters
    for (let i = 0; i < this.barrageVisuals.length; i++) {
      const b = this.barrageVisuals[i];
      if (t < 0.88 || t > ADI_FINISHER_LEAP_TIME + 0.1) {
        b.group.visible = false;
        b.fired = false;
        continue;
      }

      if (t < b.fireTime) {
        // Orbit energetically around Adi before firing
        b.group.visible = true;
        const a = b.orbitAngle + elapsed * 4.4;
        b.group.position.set(
          attackerX + Math.cos(a) * b.orbitRadius,
          b.orbitHeight + Math.sin(a * 1.5) * 0.18,
          Math.sin(a) * 0.72,
        );
        b.group.rotation.set(elapsed * 5 + i, elapsed * 6, elapsed * 4);
      } else if (t <= b.hitTime + 0.06) {
        if (!b.fired) {
          b.fired = true;
          b.startPos.copy(b.group.position);
          b.targetPos.set(defenderX, 1.25 + (i % 3) * 0.22, 0.15);
        }
        const p = Math.min(1, (t - b.fireTime) / Math.max(0.05, b.hitTime - b.fireTime));
        b.group.visible = true;
        b.group.position.lerpVectors(b.startPos, b.targetPos, p);
        b.group.position.y += Math.sin(p * Math.PI) * 0.42;
        b.group.rotation.set(elapsed * 18, elapsed * 14, elapsed * 22);
      } else {
        b.group.visible = false;
      }
    }

    // Impact ring animation
    if (this.impactTimer > 0) {
      this.impactTimer = Math.max(0, this.impactTimer - dt);
      const p = 1 - this.impactTimer / 0.78;
      this.impactRing.scale.setScalar(0.6 + p * 4.2);
      this.impactRingMat.opacity = (1 - p) * 0.9;
      this.impactRing.visible = this.impactTimer > 0;
    } else {
      this.impactRing.visible = false;
    }

    this.updateSparks(dt);
    return dimFactor;
  }

  private updateSparks(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < this.sparkItems.length; i++) {
      const s = this.sparkItems[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.sparkMesh.setMatrixAt(i, _dummy.matrix);
        anyActive = true;
        continue;
      }
      s.vel.y -= 13.5 * dt;
      s.pos.addScaledVector(s.vel, dt);
      s.rot.addScaledVector(s.rotVel, dt);
      const ratio = s.life / s.maxLife;
      _dummy.position.copy(s.pos);
      _dummy.rotation.set(s.rot.x, s.rot.y, s.rot.z);
      _dummy.scale.setScalar(s.scale * ratio);
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
      this.sparkMesh.setColorAt(i, s.color);
      anyActive = true;
    }
    if (anyActive) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
      if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    }
  }

  public reset(): void {
    this.root.visible = false;
    this.impactTimer = 0;
    this.impactRing.visible = false;
    for (const b of this.barrageVisuals) {
      b.group.visible = false;
      b.fired = false;
    }
    for (let i = 0; i < this.sparkItems.length; i++) {
      this.sparkItems[i].active = false;
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.root);
    this.spotlightCone.geometry.dispose();
    this.spotlightMat.dispose();
    this.auraRingOuter.geometry.dispose();
    this.auraRingMat.dispose();
    this.floorEmblem.geometry.dispose();
    this.floorEmblemTex.dispose();
    this.floorEmblemMat.dispose();
    this.impactRing.geometry.dispose();
    this.impactRingMat.dispose();
    this.notebookTex.dispose();
    this.notebookGeo.dispose();
    this.notebookCoverMat.dispose();
    this.notebookPageMat.dispose();
    this.dusterWoodGeo.dispose();
    this.dusterWoodMat.dispose();
    this.dusterFeltGeo.dispose();
    this.dusterFeltMat.dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
  }
}
