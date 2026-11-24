import * as THREE from 'three';
import type { FighterRig } from './characters';
import type { SheruSuperBeatSignal, SheruSuperState } from './sheruSuper';
import { getSheruSuperDimFactor } from './sheruSuper';

interface BurstItem {
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
  scale: number;
}

const BILL_POOL_SIZE = 48;
const COIN_POOL_SIZE = 48;

const _pos = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();

function createTrillionBillTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;

  // Rich emerald-green & metallic-gold trillion-dollar parody bill
  ctx.fillStyle = '#DCFCE7';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#15803D';
  ctx.fillRect(4, 4, 120, 56);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 4;
  ctx.strokeRect(7, 7, 114, 50);

  // Center golden medallion with bold $
  ctx.fillStyle = '#FDE047';
  ctx.beginPath();
  ctx.arc(64, 32, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#14532D';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 64, 33);

  ctx.fillStyle = '#FEF08A';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('1T', 24, 21);
  ctx.fillText('1T', 104, 45);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SheruSuperVfx {
  public readonly group = new THREE.Group();
  public readonly spotlight: THREE.SpotLight;
  private spotlightBeam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private auraRing: THREE.Mesh;
  private auraMat: THREE.MeshBasicMaterial;
  private finisherRing: THREE.Mesh;
  private finisherRingMat: THREE.MeshBasicMaterial;
  private finisherRingTimer = 0;
  private readonly finisherRingDuration = 0.85;

  private leftPawGlow: THREE.Mesh;
  private rightPawGlow: THREE.Mesh;
  private pawGlowMat: THREE.MeshBasicMaterial;

  private billTex: THREE.CanvasTexture;
  private billMesh: THREE.InstancedMesh;
  private bills: BurstItem[] = [];
  private billCursor = 0;

  private coinMesh: THREE.InstancedMesh;
  private coins: BurstItem[] = [];
  private coinCursor = 0;

  constructor(scene: THREE.Scene) {
    // 1. Bright golden overhead SpotLight dropping onto Sheru Bhai
    this.spotlight = new THREE.SpotLight(0xffe066, 0, 28, Math.PI * 0.23, 0.58, 1.3);
    this.spotlight.position.set(0, 8.2, 2.2);
    this.spotlight.target.position.set(0, 1.0, 0);
    scene.add(this.spotlight);
    scene.add(this.spotlight.target);

    // Translucent volumetric-feel spotlight beam cone
    const beamGeo = new THREE.CylinderGeometry(0.45, 2.15, 7.8, 16, 1, true);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.spotlightBeam = new THREE.Mesh(beamGeo, this.beamMat);
    this.spotlightBeam.position.set(0, 3.9, 0);
    this.spotlightBeam.visible = false;
    this.group.add(this.spotlightBeam);

    // 2. Phase 1 Pulsing Golden Aura Ring around Sheru
    const auraGeo = new THREE.RingGeometry(0.75, 1.38, 32);
    this.auraMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.auraRing = new THREE.Mesh(auraGeo, this.auraMat);
    this.auraRing.rotation.x = -Math.PI / 2;
    this.auraRing.position.set(0, 0.06, 0);
    this.auraRing.visible = false;
    this.group.add(this.auraRing);

    // 3. Phase 4 Massive Expanding Golden Shockwave Ring
    const finGeo = new THREE.RingGeometry(0.42, 1.12, 36);
    this.finisherRingMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.finisherRing = new THREE.Mesh(finGeo, this.finisherRingMat);
    this.finisherRing.rotation.x = -Math.PI / 2;
    this.finisherRing.position.set(0, 0.07, 0);
    this.finisherRing.visible = false;
    this.group.add(this.finisherRing);

    // 4. Golden Paw Glow Orbs (zero changes to Sheru's model geometry!)
    const pawGeo = new THREE.SphereGeometry(0.24, 10, 8);
    this.pawGlowMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.leftPawGlow = new THREE.Mesh(pawGeo, this.pawGlowMat);
    this.rightPawGlow = new THREE.Mesh(pawGeo, this.pawGlowMat);
    this.leftPawGlow.visible = false;
    this.rightPawGlow.visible = false;
    this.group.add(this.leftPawGlow, this.rightPawGlow);

    // 5. Zero-GC InstancedMesh 3D Dollar/Trillion Bills Pool
    this.billTex = createTrillionBillTexture();
    const billGeo = new THREE.PlaneGeometry(0.46, 0.23);
    const billMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.billTex,
      emissive: 0x15803d,
      emissiveIntensity: 0.22,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    this.billMesh = new THREE.InstancedMesh(billGeo, billMat, BILL_POOL_SIZE);
    this.billMesh.frustumCulled = false;
    for (let i = 0; i < BILL_POOL_SIZE; i++) {
      this.bills.push(this.createEmptyItem());
      _mat4.makeScale(0, 0, 0);
      this.billMesh.setMatrixAt(i, _mat4);
    }
    this.billMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.billMesh);

    // 6. Zero-GC InstancedMesh 3D Gold Coins Pool
    const coinGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.032, 10);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      metalness: 0.9,
      roughness: 0.18,
    });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, COIN_POOL_SIZE);
    this.coinMesh.frustumCulled = false;
    for (let i = 0; i < COIN_POOL_SIZE; i++) {
      this.coins.push(this.createEmptyItem());
      _mat4.makeScale(0, 0, 0);
      this.coinMesh.setMatrixAt(i, _mat4);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.coinMesh);

    scene.add(this.group);
  }

  private createEmptyItem(): BurstItem {
    return {
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
      scale: 0,
    };
  }

  public spawnCashBurst(
    x: number,
    y: number,
    billCount: number,
    coinCount: number,
    speed: number,
    lowGraphics: boolean,
  ): void {
    const bCount = lowGraphics ? Math.max(3, Math.floor(billCount * 0.5)) : billCount;
    const cCount = lowGraphics ? Math.max(3, Math.floor(coinCount * 0.5)) : coinCount;

    for (let i = 0; i < bCount; i++) {
      const slot = this.bills[this.billCursor];
      this.billCursor = (this.billCursor + 1) % BILL_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.45 + Math.random() * 0.9);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.4;
      slot.y = y + (Math.random() - 0.5) * 0.4;
      slot.z = (Math.random() - 0.5) * 0.8;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.abs(Math.sin(angle)) * spd * 0.85 + 2.6;
      slot.vz = (Math.random() - 0.5) * 3.4;
      slot.rx = Math.random() * Math.PI;
      slot.ry = Math.random() * Math.PI;
      slot.rz = Math.random() * Math.PI;
      slot.vrx = (Math.random() - 0.5) * 14;
      slot.vry = (Math.random() - 0.5) * 14;
      slot.vrz = (Math.random() - 0.5) * 12;
      slot.life = 0;
      slot.maxLife = 0.85 + Math.random() * 0.55;
      slot.scale = 0.85 + Math.random() * 0.45;
    }

    for (let i = 0; i < cCount; i++) {
      const slot = this.coins[this.coinCursor];
      this.coinCursor = (this.coinCursor + 1) % COIN_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.55 + Math.random() * 0.95);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.35;
      slot.y = y + (Math.random() - 0.5) * 0.35;
      slot.z = (Math.random() - 0.5) * 0.7;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.abs(Math.sin(angle)) * spd + 3.2;
      slot.vz = (Math.random() - 0.5) * 3.2;
      slot.rx = Math.random() * Math.PI;
      slot.ry = Math.random() * Math.PI;
      slot.rz = Math.random() * Math.PI;
      slot.vrx = (Math.random() - 0.5) * 18;
      slot.vry = (Math.random() - 0.5) * 18;
      slot.vrz = (Math.random() - 0.5) * 16;
      slot.life = 0;
      slot.maxLife = 0.75 + Math.random() * 0.45;
      slot.scale = 0.8 + Math.random() * 0.45;
    }
  }

  public triggerFinisherShockwave(x: number): void {
    this.finisherRing.position.set(x, 0.07, 0);
    this.finisherRing.scale.set(0.75, 0.75, 1);
    this.finisherRing.visible = true;
    this.finisherRingMat.opacity = 0.95;
    this.finisherRingTimer = this.finisherRingDuration;
  }

  public handleBeatSignals(
    signals: SheruSuperBeatSignal[],
    lowGraphics: boolean,
  ): void {
    for (const sig of signals) {
      if (sig.kind === 'flurry_hit') {
        this.spawnCashBurst(sig.x, sig.y, 4, 3, 4.6, lowGraphics);
      } else if (sig.kind === 'standing_hit') {
        this.spawnCashBurst(sig.x, sig.y, 7, 5, 5.8, lowGraphics);
      } else if (sig.kind === 'lying_kick' || sig.kind === 'lying_slap') {
        this.spawnCashBurst(sig.x, sig.y, 6, 5, 5.2, lowGraphics);
      } else if (sig.kind === 'finisher_snap') {
        this.triggerFinisherShockwave(sig.x);
        this.spawnCashBurst(sig.x, sig.y, 44, 44, 8.6, lowGraphics);
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    superState: SheruSuperState | null,
    attackerRig: FighterRig | null,
    attackerX: number,
  ): number {
    const dimFactor = superState?.active ? getSheruSuperDimFactor(superState.elapsed) : 0;

    // 1. Update Golden Spotlight & Volumetric Cone Beam
    if (superState?.active && dimFactor > 0.01) {
      this.spotlight.position.set(attackerX, 8.2, 2.2);
      this.spotlight.target.position.set(attackerX, 1.0, 0);
      this.spotlight.target.updateMatrixWorld();
      this.spotlight.intensity = 18 * dimFactor;

      this.spotlightBeam.visible = true;
      this.spotlightBeam.position.set(attackerX, 3.9, 0);
      this.beamMat.opacity = 0.12 * dimFactor * (0.92 + Math.sin(elapsed * 9) * 0.08);
    } else {
      this.spotlight.intensity = 0;
      this.spotlightBeam.visible = false;
      this.beamMat.opacity = 0;
    }

    // 2. Phase 1 Pulsing Golden Aura Ring
    if (superState?.active && superState.phase === 'beat_drop') {
      const pulse = (superState.elapsed * 2.2) % 1;
      const sc = 0.9 + pulse * 1.9;
      this.auraRing.visible = true;
      this.auraRing.position.set(attackerX, 0.06, 0);
      this.auraRing.scale.set(sc, sc, 1);
      this.auraRing.rotation.z = elapsed * 4.5;
      this.auraMat.opacity = (1 - pulse) * 0.85;
    } else {
      this.auraRing.visible = false;
      this.auraMat.opacity = 0;
    }

    // 3. Golden Paw Glow Orbs during Phase 2 Flurry and Phase 4 Snap prep
    if (
      superState?.active &&
      attackerRig &&
      (superState.phase === 'paw_flurry' ||
        (superState.phase === 'finisher' && superState.elapsed < 6.45))
    ) {
      const showBoth = superState.phase === 'paw_flurry';
      const glowScale = showBoth
        ? 0.95 + Math.sin(elapsed * 32) * 0.25
        : 1.05 + Math.sin(elapsed * 18) * 0.22;

      attackerRig.rightElbow.getWorldPosition(_worldPos);
      this.rightPawGlow.position.set(_worldPos.x, _worldPos.y - 0.16, _worldPos.z);
      this.rightPawGlow.scale.setScalar(glowScale);
      this.rightPawGlow.visible = true;

      if (showBoth) {
        attackerRig.leftElbow.getWorldPosition(_worldPos);
        this.leftPawGlow.position.set(_worldPos.x, _worldPos.y - 0.16, _worldPos.z);
        this.leftPawGlow.scale.setScalar(glowScale);
        this.leftPawGlow.visible = true;
      } else {
        this.leftPawGlow.visible = false;
      }
    } else {
      this.leftPawGlow.visible = false;
      this.rightPawGlow.visible = false;
    }

    // 4. Expanding Finisher Shockwave Ring
    if (this.finisherRingTimer > 0) {
      this.finisherRingTimer = Math.max(0, this.finisherRingTimer - dt);
      const p = 1 - this.finisherRingTimer / this.finisherRingDuration;
      const sc = 0.75 + p * 5.2;
      this.finisherRing.scale.set(sc, sc, 1);
      this.finisherRingMat.opacity = Math.max(0, (1 - p) * 0.95);
      if (this.finisherRingTimer <= 0) {
        this.finisherRing.visible = false;
      }
    }

    // 5. Update Instanced Bills (flutter physics) & Gold Coins (heavy arc physics)
    this.updatePool(this.bills, this.billMesh, dt, 7.2, true);
    this.updatePool(this.coins, this.coinMesh, dt, 16.5, false);

    return dimFactor;
  }

  private updatePool(
    items: BurstItem[],
    mesh: THREE.InstancedMesh,
    dt: number,
    gravity: number,
    flutter: boolean,
  ): void {
    let dirty = false;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, _mat4);
        continue;
      }
      p.vy -= gravity * dt;
      if (flutter) {
        p.vx *= Math.max(0, 1 - dt * 1.4);
        p.vz *= Math.max(0, 1 - dt * 1.4);
        p.vy = Math.max(-2.4, p.vy);
      }
      p.x += p.vx * dt;
      p.y = Math.max(0.06, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.rx += p.vrx * dt;
      p.ry += p.vry * dt;
      p.rz += p.vrz * dt;

      const fade = 1 - Math.pow(p.life / p.maxLife, 2);
      const s = p.scale * fade;
      _pos.set(p.x, p.y, p.z);
      _euler.set(p.rx, p.ry, p.rz);
      _quat.setFromEuler(_euler);
      _scale.set(s, s, s);
      _mat4.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _mat4);
    }
    if (dirty) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public reset(): void {
    this.spotlight.intensity = 0;
    this.spotlightBeam.visible = false;
    this.auraRing.visible = false;
    this.finisherRing.visible = false;
    this.finisherRingTimer = 0;
    this.leftPawGlow.visible = false;
    this.rightPawGlow.visible = false;
    for (let i = 0; i < this.bills.length; i++) {
      this.bills[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.billMesh.setMatrixAt(i, _mat4);
    }
    this.billMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.coins.length; i++) {
      this.coins[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.coinMesh.setMatrixAt(i, _mat4);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.spotlight);
    scene.remove(this.spotlight.target);
    scene.remove(this.group);
    this.spotlightBeam.geometry.dispose();
    this.beamMat.dispose();
    this.auraRing.geometry.dispose();
    this.auraMat.dispose();
    this.finisherRing.geometry.dispose();
    this.finisherRingMat.dispose();
    this.leftPawGlow.geometry.dispose();
    this.pawGlowMat.dispose();
    this.billMesh.geometry.dispose();
    (this.billMesh.material as THREE.Material).dispose();
    this.billTex.dispose();
    this.coinMesh.geometry.dispose();
    (this.coinMesh.material as THREE.Material).dispose();
  }
}
