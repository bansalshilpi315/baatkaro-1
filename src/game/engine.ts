import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audioEngine } from './audio';
import { animateFighterRig, buildFighterRig, FIGHTER_CONFIGS, type FighterRig } from './characters';
import {
  buildMatchResultSnapshot,
  computeCpuInput,
  createEmptyInput,
  createMatchState,
  stepMatch,
} from './combat';
import { buildStage, type StageInstance } from './stages';
import type {
  CombatEvent,
  Difficulty,
  FighterId,
  FighterInput,
  FloatingCallout,
  GameScreen,
  GraphicsQuality,
  HudSnapshot,
  MatchResultSnapshot,
  MatchState,
  StageId,
} from './types';

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onCallout: (callout: FloatingCallout) => void;
  onHeadline: (headline: string) => void;
  onMatchFinish: (result: MatchResultSnapshot) => void;
}

interface ParticleSlot {
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

const PARTICLE_POOL_SIZE = 72;
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _projVec = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class DesiShowdownEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmremTexture: THREE.Texture;

  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private stage: StageInstance | null = null;
  private rigs: [FighterRig | null, FighterRig | null] = [null, null];
  private matchState: MatchState;

  private currentScreen: GameScreen = 'notice';
  private p1Id: FighterId = 'sheru';
  private p2Id: FighterId = 'billa';
  private stageId: StageId = 'mohalla';
  private difficulty: Difficulty = 'normal';
  private graphics: GraphicsQuality = 'high';

  // Camera state
  private camPos = new THREE.Vector3(0, 3.0, 10.5);
  private camLook = new THREE.Vector3(0, 1.5, 0);
  private trauma = 0;

  // Input state (keyboard + touch combined)
  private keysHeld = new Set<string>();
  private oneShotQueue = {
    up: false,
    punch: false,
    kick: false,
    grab: false,
    special: false,
    superMove: false,
  };
  private touchMove = { left: false, right: false, up: false, down: false };

  // Pooled InstancedMesh particles
  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  // Reusable floor shockwave ring for Anda Bhai's Deewar Drop slam
  private shockwaveRing: THREE.Mesh;
  private shockwaveTimer = 0;
  private readonly shockwaveDuration = 0.42;

  // 3D Projectile visual map
  private projectileMeshes = new Map<number, THREE.Object3D>();
  private projectileGroup = new THREE.Group();
  private currencyNoteTex: THREE.CanvasTexture | null = null;

  // Loop & lifecycle
  private frameId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private hudThrottleTimer = 0;
  private nextCalloutId = 1;
  private resultDispatched = false;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = Math.max(container.clientWidth, 320);
    const h = Math.max(container.clientHeight, 240);
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    // Procedural Studio Environment Map for crisp metallic gold/ceramic reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.pmremTexture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.2, 120);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // 3-Point Arcade Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x7c2d12, 0.85);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff3d1, 2.0);
    this.keyLight.position.set(6, 11, 8);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 32;
    this.keyLight.shadow.camera.left = -10;
    this.keyLight.shadow.camera.right = 10;
    this.keyLight.shadow.camera.top = 10;
    this.keyLight.shadow.camera.bottom = -4;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xf59e0b, 1.0);
    this.rimLight.position.set(-6, 5, -7);
    this.scene.add(this.rimLight);

    // Pooled Zero-GC Particle InstancedMesh
    const pGeo = new THREE.OctahedronGeometry(0.14, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_POOL_SIZE);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
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
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.particleMesh);
    this.scene.add(this.projectileGroup);

    // Expanding ground shockwave ring for Anda Bhai's Deewar Drop "CRACK!" slam
    const shockGeo = new THREE.RingGeometry(0.42, 0.96, 28);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xffd426,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.shockwaveRing = new THREE.Mesh(shockGeo, shockMat);
    this.shockwaveRing.rotation.x = -Math.PI / 2;
    this.shockwaveRing.position.set(0, 0.045, 0);
    this.shockwaveRing.visible = false;
    this.scene.add(this.shockwaveRing);

    this.matchState = createMatchState(this.p1Id, this.p2Id, false);
    this.loadStage(this.stageId);
    this.loadFighters(this.p1Id, this.p2Id);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Input & Dynamic Viewport Resize listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearInputs);
    document.addEventListener('visibilitychange', this.clearInputs);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);

    window.addEventListener('resize', this.handleViewportResize);
    window.addEventListener('orientationchange', this.handleViewportResize);
    window.visualViewport?.addEventListener('resize', this.handleViewportResize);
    document.addEventListener('fullscreenchange', this.handleViewportResize);
    document.addEventListener('webkitfullscreenchange', this.handleViewportResize);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.lastTime = performance.now();
    this.tick();
  }

  private resizeRafId = 0;

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private handleViewportResize = (): void => {
    this.handleResize();
    if (this.resizeRafId) {
      cancelAnimationFrame(this.resizeRafId);
    }
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = 0;
      this.handleResize();
    });
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const rawW = this.container.clientWidth || window.innerWidth;
    const rawH = this.container.clientHeight || window.innerHeight;
    const w = Math.max(Math.round(rawW), 1);
    const h = Math.max(Math.round(rawH), 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public clearInputs = (): void => {
    this.keysHeld.clear();
    this.touchMove = { left: false, right: false, up: false, down: false };
    this.oneShotQueue = {
      up: false,
      punch: false,
      kick: false,
      grab: false,
      special: false,
      superMove: false,
    };
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.currentScreen !== 'playing') return;
    const code = e.code;
    if (
      code === 'KeyA' ||
      code === 'KeyD' ||
      code === 'KeyW' ||
      code === 'KeyS' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    if (!this.keysHeld.has(code)) {
      if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') this.oneShotQueue.up = true;
      if (code === 'KeyJ') this.oneShotQueue.punch = true;
      if (code === 'KeyK') this.oneShotQueue.kick = true;
      if (code === 'KeyI') this.oneShotQueue.grab = true;
      if (code === 'KeyB') this.oneShotQueue.special = true;
      if (code === 'KeyL') this.oneShotQueue.superMove = true;
    }
    this.keysHeld.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  // Touch controls API called from HUD
  public setTouchDirection(dir: { left: boolean; right: boolean; up: boolean; down: boolean }): void {
    if (dir.up && !this.touchMove.up) {
      this.oneShotQueue.up = true;
    }
    this.touchMove = dir;
  }

  public triggerTouchAction(action: 'punch' | 'kick' | 'grab' | 'special' | 'superMove'): void {
    audioEngine.unlock();
    this.oneShotQueue[action] = true;
  }

  public setScreen(screen: GameScreen): void {
    this.currentScreen = screen;
    if (screen === 'playing') {
      this.clearInputs();
    }
  }

  private introTagline = 'DESH JAANNA CHAHTA HAI!';

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.graphics = quality;
    this.stage?.setLowGraphics(quality === 'low');
    if (this.isSoftwareGl) return;
    const pr = quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = quality === 'high';
    this.keyLight.castShadow = quality === 'high';
    this.handleResize();
  }

  public skipPreFightIntro(): void {
    if (this.matchState.phase === 'intro' && this.matchState.phaseTimer > 0.45) {
      this.matchState.phaseTimer = 0.42;
      this.emitHud(true);
    }
  }

  public setPreviewSelection(p1: FighterId, p2: FighterId, stage: StageId, difficulty: Difficulty): void {
    this.difficulty = difficulty;
    if (stage !== this.stageId) {
      this.stageId = stage;
      this.loadStage(stage);
    }
    if (p1 !== this.p1Id || p2 !== this.p2Id) {
      this.p1Id = p1;
      this.p2Id = p2;
      this.loadFighters(p1, p2);
      this.matchState = createMatchState(p1, p2, false);
    }
  }

  public startMatch(
    p1: FighterId,
    p2: FighterId,
    stage: StageId,
    difficulty: Difficulty,
    skipIntro = false,
  ): void {
    this.p1Id = p1;
    this.p2Id = p2;
    this.difficulty = difficulty;
    if (stage !== this.stageId) {
      this.stageId = stage;
      this.loadStage(stage);
    }
    this.loadFighters(p1, p2);
    this.clearProjectiles();
    this.matchState = createMatchState(p1, p2, skipIntro);
    const taglines = [
      'DESH JAANNA CHAHTA HAI!',
      '9 PM MAHA-SHOWDOWN · FULL PAISA VASOOL!',
      'CHAI THANDI HO JAYEGI, LADAI SHURU KARO!',
      'EXIT POLLS CONFUSED · PUBLIC EXCITED!',
    ];
    this.introTagline = taglines[Math.floor(Math.random() * taglines.length)];
    this.resultDispatched = false;
    this.trauma = 0;
    this.currentScreen = 'playing';
    this.clearInputs();
    this.emitHud(true);
  }

  private loadStage(id: StageId): void {
    if (this.stage) {
      this.scene.remove(this.stage.group);
      this.stage.dispose();
    }
    const maxAniso = this.isSoftwareGl ? 1 : Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const stage = buildStage(id, maxAniso);
    stage.setLowGraphics(this.graphics === 'low');
    this.stage = stage;
    this.scene.add(stage.group);
    this.scene.background = new THREE.Color(stage.backgroundColor);
    this.scene.fog = new THREE.Fog(stage.fogColor, stage.fogNear, stage.fogFar);

    this.keyLight.color.setHex(stage.keyLightColor);
    this.keyLight.intensity = stage.keyLightIntensity;
    this.hemiLight.color.setHex(stage.hemiSkyColor);
    this.hemiLight.groundColor.setHex(stage.hemiGroundColor);
    this.hemiLight.intensity = stage.hemiIntensity;
    this.rimLight.color.setHex(stage.rimLightColor);
    this.rimLight.intensity = stage.rimLightIntensity;
  }

  private loadFighters(p1: FighterId, p2: FighterId): void {
    for (let i = 0; i < 2; i++) {
      const existing = this.rigs[i];
      if (existing) {
        this.scene.remove(existing.root);
        existing.dispose();
      }
      const rig = buildFighterRig(i === 0 ? p1 : p2);
      this.rigs[i] = rig;
      this.scene.add(rig.root);
    }
  }

  private clearProjectiles(): void {
    this.projectileMeshes.forEach((mesh) => {
      this.projectileGroup.remove(mesh);
    });
    this.projectileMeshes.clear();
  }

  private spawnParticles(x: number, y: number, count: number, colorHex: number, speed = 5.2): void {
    const budget = this.graphics === 'low' ? Math.max(4, Math.floor(count * 0.5)) : count;
    for (let i = 0; i < budget; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.45 + Math.random() * 0.85);
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = (Math.random() - 0.5) * 0.5;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = Math.sin(angle) * spd + 1.8;
      slot.vz = (Math.random() - 0.5) * 2.5;
      slot.life = 0;
      slot.maxLife = 0.25 + Math.random() * 0.25;
      slot.scale = 0.65 + Math.random() * 0.9;
      slot.color.setHex(colorHex);
    }
  }

  private updateParticles(dt: number): void {
    let dirty = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const s = p.scale * (1 - p.life / p.maxLife);
      _pos.set(p.x, p.y, p.z);
      _scale.set(s, s, s);
      _quat.setFromAxisAngle(_projVec.set(0, 1, 1).normalize(), p.life * 12);
      _mat4.compose(_pos, _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }

    if (this.shockwaveTimer > 0) {
      this.shockwaveTimer = Math.max(0, this.shockwaveTimer - dt);
      const progress = 1 - this.shockwaveTimer / this.shockwaveDuration;
      const scale = 0.65 + progress * 2.75;
      this.shockwaveRing.scale.set(scale, scale, 1);
      (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - progress) * 0.88);
      if (this.shockwaveTimer <= 0) {
        this.shockwaveRing.visible = false;
      }
    }
  }

  private getCurrencyNoteTexture(): THREE.CanvasTexture {
    if (this.currencyNoteTex) return this.currencyNoteTex;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    // Crisp parody ₹ banknote styling
    ctx.fillStyle = '#DCFCE7';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#16A34A';
    ctx.fillRect(4, 4, 120, 56);
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, 112, 48);
    // Gold center emblem + rupee symbol
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(64, 32, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14532D';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₹', 64, 33);
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('500', 26, 20);
    ctx.fillText('500', 102, 46);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.currencyNoteTex = tex;
    return tex;
  }

  private syncProjectiles(): void {
    const activeIds = new Set<number>();
    for (const proj of this.matchState.projectiles) {
      activeIds.add(proj.uid);
      let mesh = this.projectileMeshes.get(proj.uid);
      if (!mesh) {
        if (proj.kind === 'belan') {
          const grp = new THREE.Group();
          const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.72, 10),
            new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.45 }),
          );
          const h1 = new THREE.Mesh(
            new THREE.CylinderGeometry(0.038, 0.038, 0.24, 8),
            new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 }),
          );
          h1.position.y = 0.45;
          const h2 = h1.clone();
          h2.position.y = -0.45;
          grp.add(barrel, h1, h2);
          mesh = grp;
        } else {
          const noteTex = this.getCurrencyNoteTexture();
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.52, 0.26, 0.025),
            new THREE.MeshStandardMaterial({
              map: noteTex,
              color: 0xffffff,
              emissive: 0x15803d,
              emissiveIntensity: 0.22,
              roughness: 0.42,
              metalness: 0.12,
            }),
          );
        }
        this.projectileGroup.add(mesh);
        this.projectileMeshes.set(proj.uid, mesh);
      }
      mesh.position.set(proj.x, proj.y, 0.18);
      if (proj.kind === 'belan') {
        mesh.rotation.z = proj.spin;
      } else {
        mesh.rotation.z = Math.sin(proj.spin * 1.4) * 0.65;
        mesh.rotation.y = proj.spin * 1.15;
        mesh.rotation.x = Math.cos(proj.spin * 0.9) * 0.35;
      }
    }

    for (const [uid, obj] of this.projectileMeshes.entries()) {
      if (!activeIds.has(uid)) {
        this.projectileGroup.remove(obj);
        this.projectileMeshes.delete(uid);
      }
    }
  }

  private projectToScreen(x: number, y: number): { sx: number; sy: number } | null {
    _projVec.set(x, y, 0);
    _projVec.project(this.camera);
    if (_projVec.z < -1 || _projVec.z > 1) return null;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return {
      sx: (_projVec.x * 0.5 + 0.5) * w,
      sy: (-_projVec.y * 0.5 + 0.5) * h,
    };
  }

  private handleCombatEvents(events: CombatEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'hit') {
        audioEngine.playPunchHit();
        this.trauma = Math.min(1, this.trauma + 0.28);
        this.spawnParticles(ev.x, ev.y, 10, 0xfacc15, 5.2);
      } else if (ev.type === 'heavy_hit' || ev.type === 'grab' || ev.type === 'dharna_counter') {
        audioEngine.playHeavyHit();
        this.trauma = Math.min(1, this.trauma + 0.52);
        this.stage?.triggerExcitement(1.25);
        this.spawnParticles(ev.x, ev.y, 18, 0xfb7185, 6.8);
      } else if (ev.type === 'block') {
        audioEngine.playBlock();
        this.trauma = Math.min(1, this.trauma + 0.14);
        this.spawnParticles(ev.x, ev.y, 8, 0x38bdf8, 4.4);
      } else if (ev.type === 'special') {
        const caster = this.matchState.fighters[ev.attackerSlot];
        if (caster?.id === 'billa') {
          audioEngine.playSwatterSlap();
        } else {
          audioEngine.playSpecial();
        }
        this.stage?.triggerExcitement(0.95);
        if (caster?.id === 'sheru') {
          // Golden sparkle burst + emerald cash glint for Paisa Flex!
          this.spawnParticles(ev.x, ev.y, 14, 0xfde047, 5.8);
          this.spawnParticles(ev.x, ev.y + 0.1, 8, 0x4ade80, 4.4);
        } else if (caster?.id === 'billa') {
          // Neon-green & bright-yellow giant flyswatter slap sparks!
          this.spawnParticles(ev.x, ev.y, 14, 0x4ade80, 6.2);
          this.spawnParticles(ev.x, ev.y + 0.12, 10, 0xfde047, 5.0);
        } else {
          this.spawnParticles(ev.x, ev.y, 12, 0xf97316, 4.8);
        }
      } else if (ev.type === 'super') {
        audioEngine.playSuper();
        this.trauma = Math.min(1, this.trauma + 0.65);
        this.stage?.triggerExcitement(1.65);
        this.spawnParticles(ev.x, ev.y, 24, 0xfde047, 8.0);
      } else if (ev.type === 'ko') {
        audioEngine.playKo();
        this.trauma = 1.0;
        this.stage?.triggerExcitement(2.0);
        this.spawnParticles(ev.x, ev.y, 28, 0xfacc15, 8.8);
      } else if (ev.type === 'jump') {
        audioEngine.playJump();
        this.spawnParticles(ev.x, 0.12, 5, 0xe7e5e4, 2.5);
      } else if (ev.type === 'land') {
        if (ev.word === 'CRACK!') {
          // Anda Bhai Deewar Drop slam shockwave + comic CRACK! eggshell & gold sparks!
          audioEngine.playHeavyHit();
          this.trauma = Math.min(1, this.trauma + 0.42);
          this.stage?.triggerExcitement(1.1);
          this.shockwaveRing.position.set(ev.x, 0.048, 0);
          this.shockwaveRing.scale.set(0.65, 0.65, 1);
          this.shockwaveRing.visible = true;
          this.shockwaveTimer = this.shockwaveDuration;
          this.spawnParticles(ev.x, 0.16, 16, 0xffd426, 6.4);
          this.spawnParticles(ev.x, 0.22, 12, 0xfbe0c3, 5.4);
        } else {
          this.spawnParticles(ev.x, 0.1, 6, 0xd6d3d1, 2.8);
        }
      } else if (ev.type === 'whiff') {
        audioEngine.playWhiff();
      }

      if (ev.word) {
        const pt = this.projectToScreen(ev.x, ev.y + 0.55);
        if (pt) {
          this.callbacks.onCallout({
            id: this.nextCalloutId++,
            text: ev.word,
            color: ev.color ?? '#FACC15',
            screenX: pt.sx,
            screenY: pt.sy,
          });
        }
      }
      if (ev.headline) {
        this.callbacks.onHeadline(ev.headline);
      }
    }
  }

  private samplePlayerInput(): FighterInput {
    const input = createEmptyInput();
    input.left =
      this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') || this.touchMove.left;
    input.right =
      this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') || this.touchMove.right;
    input.down =
      this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') || this.touchMove.down;

    input.up = this.oneShotQueue.up;
    input.punch = this.oneShotQueue.punch;
    input.kick = this.oneShotQueue.kick;
    input.grab = this.oneShotQueue.grab;
    input.special = this.oneShotQueue.special;
    input.superMove = this.oneShotQueue.superMove;

    this.oneShotQueue.up = false;
    this.oneShotQueue.punch = false;
    this.oneShotQueue.kick = false;
    this.oneShotQueue.grab = false;
    this.oneShotQueue.special = false;
    this.oneShotQueue.superMove = false;
    return input;
  }

  private emitHud(force = false): void {
    const [p1, p2] = this.matchState.fighters;
    let bannerText: string | null = null;
    let showBroadcastIntro = false;
    if (this.matchState.phase === 'intro') {
      if (this.matchState.phaseTimer > 0.55) {
        showBroadcastIntro = true;
      } else {
        bannerText = 'FIGHT KARO!';
      }
    } else if (this.matchState.phase === 'ko_freeze') {
      bannerText = this.matchState.finishReason === 'timeout' ? 'TIME UP!' : 'K.O.!';
    }

    if (force || this.hudThrottleTimer <= 0) {
      this.hudThrottleTimer = 0.08;
      this.callbacks.onHudUpdate({
        p1Hp: Math.round(p1.hp),
        p1MaxHp: p1.maxHp,
        p1Shakti: Math.round(p1.shakti),
        p1SpecialCd: Number(p1.specialCooldown.toFixed(1)),
        p1SpecialMaxCd: p1.specialMaxCooldown,
        p1Combo: p1.comboCount,
        p2Hp: Math.round(p2.hp),
        p2MaxHp: p2.maxHp,
        p2Shakti: Math.round(p2.shakti),
        p2SpecialCd: Number(p2.specialCooldown.toFixed(1)),
        p2SpecialMaxCd: p2.specialMaxCooldown,
        p2Combo: p2.comboCount,
        roundTime: Math.ceil(this.matchState.roundTime),
        phase: this.matchState.phase,
        bannerText,
        showBroadcastIntro,
        introTagline: this.introTagline,
      });
    }
  }

  private updateCamera(dt: number): void {
    if (this.currentScreen === 'notice' || this.currentScreen === 'loading' || this.currentScreen === 'title') {
      // Smooth wide cinematic camera pan across the living 3D stage
      const angle = this.elapsed * 0.24;
      const targetX = Math.sin(angle) * 4.4;
      const targetZ = 9.0 + Math.cos(angle * 0.65) * 1.0;
      const targetY = 2.95 + Math.sin(angle * 0.85) * 0.22;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetX, 3.0, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetY, 3.0, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetZ, 3.0, dt);
      this.camLook.x = THREE.MathUtils.damp(this.camLook.x, Math.sin(angle) * 0.8, 3.6, dt);
      this.camLook.y = THREE.MathUtils.damp(this.camLook.y, 1.5, 3.6, dt);
      this.camLook.z = THREE.MathUtils.damp(this.camLook.z, -1.0, 3.6, dt);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    if (this.currentScreen === 'select') {
      // Clean heroic face-off shot centered between P1 and CPU fighters!
      const sway = Math.sin(this.elapsed * 0.55) * 0.55;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, sway, 4.0, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, 2.2, 4.0, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, 7.6, 4.0, dt);
      this.camLook.x = THREE.MathUtils.damp(this.camLook.x, 0, 5.0, dt);
      this.camLook.y = THREE.MathUtils.damp(this.camLook.y, 1.38, 5.0, dt);
      this.camLook.z = THREE.MathUtils.damp(this.camLook.z, 0, 5.0, dt);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    const [p1, p2] = this.matchState.fighters;

    if (this.currentScreen === 'victory') {
      const winner = this.matchState.winnerSlot === 1 ? p2 : p1;
      // Offset winner cleanly to the left-third of viewport so THE DAILY JUMLA newspaper sits on right!
      const targetX = winner.x + 1.55;
      const targetY = 1.95;
      const targetZ = 5.4;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetX, 4.2, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetY, 4.2, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetZ, 4.2, dt);
      this.camLook.x = THREE.MathUtils.damp(this.camLook.x, winner.x + 1.0, 4.5, dt);
      this.camLook.y = THREE.MathUtils.damp(this.camLook.y, 1.45, 4.5, dt);
      this.camLook.z = THREE.MathUtils.damp(this.camLook.z, 0, 4.5, dt);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    // Active 2.5D arcade fighting camera tracking midpoint + dynamic zoom + decaying trauma shake
    const midX = THREE.MathUtils.clamp((p1.x + p2.x) * 0.5, -3.5, 3.5);
    const sep = Math.abs(p1.x - p2.x);
    const maxY = Math.max(p1.y, p2.y);
    const targetZ = THREE.MathUtils.clamp(8.0 + sep * 0.56, 8.2, 12.6);
    const targetY = 2.45 + maxY * 0.25;

    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, midX, 6.5, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetY, 5.5, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetZ, 5.5, dt);

    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, midX, 7.5, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, 1.45 + maxY * 0.22, 6.0, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, 0, 6.0, dt);

    // Trauma camera shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 2.8);
      const sq = this.trauma * this.trauma;
      shakeX = (Math.random() * 2 - 1) * 0.36 * sq;
      shakeY = (Math.random() * 2 - 1) * 0.26 * sq;
    }

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camLook.x + shakeX * 0.4, this.camLook.y + shakeY * 0.4, this.camLook.z);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.currentScreen !== 'paused') {
      this.elapsed += dt;
      this.stage?.update(this.elapsed, dt);

      if (this.currentScreen === 'playing') {
        const p1Input = this.samplePlayerInput();
        const p2Input = computeCpuInput(this.matchState, this.difficulty, dt);
        const events = stepMatch(this.matchState, [p1Input, p2Input], dt);
        if (events.length > 0) {
          this.handleCombatEvents(events);
        }
        this.hudThrottleTimer -= dt;
        this.emitHud(events.length > 0);

        if (this.matchState.phase === 'finished' && !this.resultDispatched) {
          this.resultDispatched = true;
          this.currentScreen = 'victory';
          audioEngine.playVictoryFanfare();
          const result = buildMatchResultSnapshot(this.matchState, this.stageId, this.difficulty);
          this.callbacks.onMatchFinish(result);
        }
      }

      // Animate 3D fighter rigs
      const activeBelanSlots = new Set<number>();
      for (const proj of this.matchState.projectiles) {
        if (proj.kind === 'belan') activeBelanSlots.add(proj.ownerSlot);
      }
      for (let i = 0; i < 2; i++) {
        const rig = this.rigs[i];
        if (rig) {
          animateFighterRig(
            rig,
            this.matchState.fighters[i],
            this.elapsed,
            dt,
            activeBelanSlots.has(i),
          );
        }
      }

      this.syncProjectiles();
      this.updateParticles(dt);
      this.updateCamera(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public getP1Config() {
    return FIGHTER_CONFIGS[this.p1Id];
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    cancelAnimationFrame(this.resizeRafId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearInputs);
    document.removeEventListener('visibilitychange', this.clearInputs);
    window.removeEventListener('resize', this.handleViewportResize);
    window.removeEventListener('orientationchange', this.handleViewportResize);
    window.visualViewport?.removeEventListener('resize', this.handleViewportResize);
    document.removeEventListener('fullscreenchange', this.handleViewportResize);
    document.removeEventListener('webkitfullscreenchange', this.handleViewportResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);

    this.stage?.dispose();
    this.rigs.forEach((r) => r?.dispose());
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.shockwaveRing.geometry.dispose();
    (this.shockwaveRing.material as THREE.Material).dispose();
    this.currencyNoteTex?.dispose();
    this.pmremTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
