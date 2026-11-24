import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audioEngine } from './audio';
import {
  CAMERA_PAN_MAX_X,
  CAMERA_PAN_MIN_X,
  computeFixedZoomCameraTarget,
  computeIntroCameraTarget,
  computeKoWinnerCameraTarget,
  computeSuperCameraTarget,
} from './camera';
import { animateFighterRig, buildFighterRig, FIGHTER_CONFIGS, type FighterRig } from './characters';
import { getActiveStrikeTrailInfo } from './characters/kinematics';
import { StrikeTrailRibbon } from './characters/strikeTrail';
import {
  buildMatchResultSnapshot,
  computeCpuInput,
  createEmptyInput,
  createMatchState,
  stepMatch,
} from './combat';
import {
  INTRO_ROUND1_CALLOUT_SECONDS,
  clampDialogueScreenPosition,
  clearAllMidFightDialogues,
  createDialogueTracker,
  getIntroDialoguePhase,
  pauseDialogueTimers,
  pruneExpiredDialogues,
  resumeDialogueTimers,
  triggerMidFightDialogue,
  type ActiveFighterDialogue,
  type DialogueTracker,
} from './dialogue';
import { SHERU_SUPER_BANNER } from './sheruSuper';
import { SheruSuperVfx } from './sheruSuperVfx';
import { buildStage, type StageInstance } from './stages';
import type {
  CombatEvent,
  ComicSpeechBubble,
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
  SuperBannerInfo,
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

interface ImpactRingSlot {
  active: boolean;
  group: THREE.Group;
  innerMat: THREE.MeshBasicMaterial;
  outerMat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
}

const PARTICLE_POOL_SIZE = 72;
const IMPACT_RING_POOL_SIZE = 6;
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _stageBgColor = new THREE.Color();
const _stageFogColor = new THREE.Color();
const _superDimColor = new THREE.Color(0x0b0805);

const INTRO_TAUNTS: Record<FighterId, string[]> = {
  sheru: [
    'Tera budget khatam, meri entry shuru!',
    'Aaj Sensex bhi neeche, tu bhi neeche!',
    'Suit dekh, attitude dekh — ab pitai dekh!',
  ],
  billa: [
    'Aaj teri chhutti, swatter tayyar hai!',
    'Machhar samjha kya? Phatak se uda dunga!',
    'Chai garam, swatter kadak — aaja bhid le!',
  ],
  neta: [
    'Aam aadmi ka gussa mat jaga beta!',
    'Jhola halka hai, par jhatka bhari padega!',
    'Seedha dharna aur full hisaab hoga aaj!',
  ],
  anda: [
    'Crack mat bolna, hard-boiled hoon main!',
    'Deewar se gira par akad nahi tooti!',
    'Omelette tera banega, mera nahi!',
  ],
  mausi: [
    'Laddoo khayega ya belan khayega beta?',
    'Aaj full desi ghee wali sutai hogi!',
    'Dukaan band karwaunga? Pehle belan jhel!',
  ],
};

const KNOCKDOWN_QUIPS: Record<FighterId, string[]> = {
  sheru: ['Arre mera Armani suit!', 'Audit karwaunga iska!'],
  billa: ['Meow!! Yeh cheating hai!', 'Mera swatter kidhar gaya?!'],
  neta: ['Yeh janta pe atyachaar hai!', 'Chashma bach gaya!'],
  anda: ['Arre shell bachao!', 'Kisi ne farsh pe tel giraya!'],
  mausi: ['Haye meri kamar! Ab dekh!', 'Belan se double badla lungi!'],
};

const MID_FIGHT_ROASTS: Record<FighterId, string[]> = {
  sheru: [
    'Ye le 18% GST ke saath pitai!',
    'Tera portfolio laal kar diya bhai!',
    'Bill tera, swag mera — paisa vasool!',
  ],
  billa: [
    'Phatak! Machhar jaise uda diya!',
    'Meow! Swatter ka swaad kaisa laga?',
    'Aaj chai thandi, par thappad garam!',
  ],
  neta: [
    'Janta ka faisla seedha mukke se!',
    'Dharna mode ON — ab bhaag mat!',
    'Chanda nahi, seedha danda milega!',
  ],
  anda: [
    'Hard-boiled Power! Crack nahi hone dunga!',
    'Omelette banne se pehle hi flat kar diya!',
    'Protein punch seedha muh pe!',
  ],
  mausi: [
    'Aaj belan ka VIP treatment milega!',
    'Meetha kam, sutai zyada — shabaash!',
    'Aunty se panga? Seedha chappal-belan combo!',
  ],
};

const VICTORY_QUIPS: Record<FighterId, string[]> = {
  sheru: ['Full paisa vasool, bhai!', 'Market closed — Sheru on top!'],
  billa: ['Swatter supremacy! Meow!', 'Clean sweep — ekdum jhakaas!'],
  neta: ['Janta ki jeet! Cutting chai lao!', 'Jhola-chaap power zindabad!'],
  anda: ['Hard-boiled champion, boss!', 'Shell intact, opposition cracked!'],
  mausi: ['Ab ja aur garma-garam laddoo kha!', 'Belan ke aage koi tikta hai kya?'],
};

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

  // Pooled white-and-gold circular contact shockwave rings for punches, kicks, and throws
  private impactRings: ImpactRingSlot[] = [];
  private impactRingCursor = 0;
  private impactInnerGeo: THREE.RingGeometry;
  private impactOuterGeo: THREE.RingGeometry;

  // Sheru Bhai's "Trillion Dollar Beatdown" Super VFX manager
  private sheruSuperVfx: SheruSuperVfx;

  // Pooled glowing white-to-gold curved motion trail ribbons (1 per fighter, 18 tris each)
  private strikeTrails: [StrikeTrailRibbon, StrikeTrailRibbon];

  // 3D Projectile visual map + pre-allocated shared geometries/materials/textures (zero mid-fight spikes)
  private projectileMeshes = new Map<number, THREE.Object3D>();
  private activeProjectileIds = new Set<number>();
  private projectileGroup = new THREE.Group();
  private currencyNoteTex: THREE.CanvasTexture;
  private currencyNoteGeo: THREE.BoxGeometry;
  private currencyNoteMat: THREE.MeshStandardMaterial;
  private belanBarrelGeo: THREE.LatheGeometry;
  private belanBarrelMat: THREE.MeshStandardMaterial;
  private belanHandleGeo: THREE.CylinderGeometry;
  private belanHandleMat: THREE.MeshStandardMaterial;
  private swatterMeshTex: THREE.CanvasTexture;
  private swatterHandleGeo: THREE.CylinderGeometry;
  private swatterGripGeo: THREE.CylinderGeometry;
  private swatterPaddleGeo: THREE.BoxGeometry;
  private swatterHandleMat: THREE.MeshStandardMaterial;
  private swatterGripMat: THREE.MeshStandardMaterial;
  private swatterPaddleMat: THREE.MeshStandardMaterial;

  // Loop & lifecycle
  private frameId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private hudThrottleTimer = 0;
  private nextCalloutId = 1;
  private resultDispatched = false;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  // Dynamic fight callouts & decoupled per-fighter 4.0s comic speech bubble tracker
  private moveCalloutText: string | null = null;
  private moveCalloutTimer = 0;
  private dialogueTracker: DialogueTracker = createDialogueTracker();
  private lastTrackedRound = 1;
  private introTauntSeed = 0;

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
    this.keyLight.shadow.camera.far = 34;
    this.keyLight.shadow.camera.left = -14;
    this.keyLight.shadow.camera.right = 14;
    this.keyLight.shadow.camera.top = 10;
    this.keyLight.shadow.camera.bottom = -4;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

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

    // Pooled expanding white-and-gold circular shockwave rings for exact fist/foot contact hits
    this.impactInnerGeo = new THREE.RingGeometry(0.08, 0.24, 24);
    this.impactOuterGeo = new THREE.RingGeometry(0.22, 0.36, 28);
    for (let i = 0; i < IMPACT_RING_POOL_SIZE; i++) {
      const grp = new THREE.Group();
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const innerRing = new THREE.Mesh(this.impactInnerGeo, innerMat);
      const outerRing = new THREE.Mesh(this.impactOuterGeo, outerMat);
      outerRing.position.z = -0.01;
      grp.add(innerRing, outerRing);
      grp.visible = false;
      this.scene.add(grp);
      this.impactRings.push({
        active: false,
        group: grp,
        innerMat,
        outerMat,
        life: 0,
        maxLife: 0.24,
        maxScale: 2.2,
      });
    }

    this.sheruSuperVfx = new SheruSuperVfx(this.scene);

    this.strikeTrails = [new StrikeTrailRibbon(), new StrikeTrailRibbon()];
    this.scene.add(this.strikeTrails[0].mesh);
    this.scene.add(this.strikeTrails[1].mesh);

    // Pre-create shared projectile texture, geometries, and materials once at scene init
    this.currencyNoteTex = this.createCurrencyNoteTexture();
    this.currencyNoteGeo = new THREE.BoxGeometry(0.52, 0.26, 0.025);
    this.currencyNoteMat = new THREE.MeshStandardMaterial({
      map: this.currencyNoteTex,
      color: 0xffffff,
      emissive: 0x15803d,
      emissiveIntensity: 0.22,
      roughness: 0.42,
      metalness: 0.12,
    });
    const belanPts: THREE.Vector2[] = [
      new THREE.Vector2(0.002, -0.5),
      new THREE.Vector2(0.038, -0.48),
      new THREE.Vector2(0.034, -0.34),
      new THREE.Vector2(0.068, -0.3),
      new THREE.Vector2(0.082, 0.0),
      new THREE.Vector2(0.068, 0.3),
      new THREE.Vector2(0.034, 0.34),
      new THREE.Vector2(0.038, 0.48),
      new THREE.Vector2(0.002, 0.5),
    ];
    this.belanBarrelGeo = new THREE.LatheGeometry(belanPts, 12);
    this.belanBarrelMat = new THREE.MeshStandardMaterial({ color: 0xc68b49, roughness: 0.52 });
    this.belanHandleGeo = new THREE.CylinderGeometry(0.04, 0.038, 0.16, 8);
    this.belanHandleMat = new THREE.MeshStandardMaterial({ color: 0x9b642c, roughness: 0.48 });

    // Low-poly composite 3D cartoon fly-swatter projectile (long handle + dark grip + perforated paddle)
    this.swatterMeshTex = this.createSwatterPaddleTexture();
    this.swatterHandleGeo = new THREE.CylinderGeometry(0.028, 0.034, 0.62, 8);
    this.swatterGripGeo = new THREE.CylinderGeometry(0.042, 0.038, 0.18, 8);
    this.swatterPaddleGeo = new THREE.BoxGeometry(0.42, 0.46, 0.032);
    this.swatterHandleMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.42 });
    this.swatterGripMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.65 });
    this.swatterPaddleMat = new THREE.MeshStandardMaterial({
      map: this.swatterMeshTex,
      color: 0xffffff,
      emissive: 0x22c55e,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    });

    this.matchState = createMatchState(this.p1Id, this.p2Id, false);
    this.loadStage(this.stageId);
    this.loadFighters(this.p1Id, this.p2Id);

    // Preload Super Power MP3 bytes early so Web Audio decode is instant when unlocked
    void audioEngine.preloadSuperAudio();

    if (!this.isSoftwareGl) {
      // Pre-warm all Super VFX, strike trail & shockwave shader programs during init to avoid mid-fight spikes
      this.sheruSuperVfx.setPrewarmVisible(true);
      this.shockwaveRing.visible = true;
      this.strikeTrails[0].mesh.visible = true;
      this.renderer.compile(this.scene, this.camera);
      this.sheruSuperVfx.setPrewarmVisible(false);
      this.shockwaveRing.visible = false;
      this.strikeTrails[0].mesh.visible = false;
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
      if (
        code === 'KeyJ' ||
        code === 'KeyK' ||
        code === 'KeyI' ||
        code === 'KeyE' ||
        code === 'KeyB' ||
        code === 'KeyL'
      ) {
        audioEngine.unlock();
      }
      if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') this.oneShotQueue.up = true;
      if (code === 'KeyJ') this.oneShotQueue.punch = true;
      if (code === 'KeyK') this.oneShotQueue.kick = true;
      if (code === 'KeyI') this.oneShotQueue.grab = true;
      if (code === 'KeyE' || code === 'KeyB') this.oneShotQueue.special = true;
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
      resumeDialogueTimers(this.dialogueTracker, performance.now());
    } else if (screen === 'paused') {
      pauseDialogueTimers(this.dialogueTracker, performance.now());
    } else if (screen === 'select' || screen === 'title' || screen === 'notice') {
      // Explicitly exited to menu: reset Super VFX, mid-fight dialogues, and stop active Super audio
      clearAllMidFightDialogues(this.dialogueTracker);
      this.sheruSuperVfx.reset();
      audioEngine.stopSuperAudio();
    }
  }

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
    if (
      this.matchState.phase === 'intro' &&
      this.matchState.roundNumber === 1 &&
      this.matchState.phaseTimer > INTRO_ROUND1_CALLOUT_SECONDS
    ) {
      this.matchState.phaseTimer = INTRO_ROUND1_CALLOUT_SECONDS;
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
    initialP1Shakti = 0,
    testOverrides?: { p1RoundsWon?: number; p2RoundsWon?: number; p1Hp?: number; p2Hp?: number },
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
    this.sheruSuperVfx.reset();
    this.strikeTrails[0].reset();
    this.strikeTrails[1].reset();
    // Explicit match start/restart: stop any prior Super audio and ensure buffer is preloaded
    audioEngine.stopSuperAudio();
    void audioEngine.preloadSuperAudio();
    this.matchState = createMatchState(p1, p2, skipIntro);
    if (initialP1Shakti > 0) {
      this.matchState.fighters[0].shakti = Math.min(100, initialP1Shakti);
    }
    if (testOverrides) {
      if (typeof testOverrides.p1RoundsWon === 'number') {
        this.matchState.p1RoundsWon = Math.max(0, Math.min(1, testOverrides.p1RoundsWon));
        if (this.matchState.p1RoundsWon > 0) this.matchState.roundNumber = 2;
      }
      if (typeof testOverrides.p2RoundsWon === 'number') {
        this.matchState.p2RoundsWon = Math.max(0, Math.min(1, testOverrides.p2RoundsWon));
        if (this.matchState.p2RoundsWon > 0) {
          this.matchState.roundNumber = Math.max(this.matchState.roundNumber, 2);
        }
      }
      if (typeof testOverrides.p1Hp === 'number') {
        this.matchState.fighters[0].hp = Math.max(
          1,
          Math.min(this.matchState.fighters[0].maxHp, testOverrides.p1Hp),
        );
      }
      if (typeof testOverrides.p2Hp === 'number') {
        this.matchState.fighters[1].hp = Math.max(
          1,
          Math.min(this.matchState.fighters[1].maxHp, testOverrides.p2Hp),
        );
      }
    }
    this.introTauntSeed = Math.floor(Math.random() * 100);
    this.moveCalloutText = null;
    this.moveCalloutTimer = 0;
    clearAllMidFightDialogues(this.dialogueTracker);
    this.lastTrackedRound = this.matchState.roundNumber;
    this.resultDispatched = false;
    this.trauma = 0;
    this.currentScreen = 'playing';

    // Snap camera immediately to either the Round 1 over-the-shoulder opening or standard 2.5D fight frame
    const [f1, f2] = this.matchState.fighters;
    const initialCam = skipIntro
      ? computeFixedZoomCameraTarget(f1.x, f2.x)
      : computeIntroCameraTarget(1, 0, this.matchState.introDuration, f1.x, f2.x);
    this.camPos.set(initialCam.x, initialCam.y, initialCam.z);
    this.camLook.set(initialCam.lookX, initialCam.lookY, initialCam.lookZ);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

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
      this.strikeTrails[i].reset();
    }
  }

  private clearProjectiles(): void {
    this.projectileMeshes.forEach((mesh) => {
      this.projectileGroup.remove(mesh);
    });
    this.projectileMeshes.clear();
  }

  private spawnImpactRing(x: number, y: number, isHeavy: boolean): void {
    const slot = this.impactRings[this.impactRingCursor];
    this.impactRingCursor = (this.impactRingCursor + 1) % IMPACT_RING_POOL_SIZE;
    slot.active = true;
    slot.life = 0;
    slot.maxLife = isHeavy ? 0.28 : 0.21;
    slot.maxScale = isHeavy ? 2.85 : 1.95;
    slot.group.position.set(x, y, 0.32);
    slot.group.scale.set(0.35, 0.35, 1);
    slot.group.visible = true;
    slot.innerMat.opacity = 0.96;
    slot.outerMat.opacity = 0.92;
  }

  private spawnStarburstSparks(x: number, y: number, isHeavy: boolean): void {
    // Crisp white-and-gold starburst radiating cleanly from exact fist/foot contact
    const rays = isHeavy ? 10 : 7;
    const speed = isHeavy ? 7.6 : 5.8;
    for (let i = 0; i < rays; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = (i / rays) * Math.PI * 2 + Math.random() * 0.25;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = 0.28 + (Math.random() - 0.5) * 0.2;
      slot.vx = Math.cos(angle) * speed * (0.75 + Math.random() * 0.45);
      slot.vy = Math.sin(angle) * speed * (0.75 + Math.random() * 0.45);
      slot.vz = (Math.random() - 0.5) * 1.4;
      slot.life = 0;
      slot.maxLife = isHeavy ? 0.26 : 0.19;
      slot.scale = isHeavy ? 0.95 : 0.72;
      slot.color.setHex(i % 2 === 0 ? 0xffffff : 0xfacc15);
    }
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

    for (let i = 0; i < IMPACT_RING_POOL_SIZE; i++) {
      const r = this.impactRings[i];
      if (!r.active) continue;
      r.life += dt;
      if (r.life >= r.maxLife) {
        r.active = false;
        r.group.visible = false;
        continue;
      }
      const p = r.life / r.maxLife;
      const easeOut = 1 - (1 - p) * (1 - p);
      const sc = 0.35 + easeOut * r.maxScale;
      r.group.scale.set(sc, sc, 1);
      r.group.quaternion.copy(this.camera.quaternion);
      r.innerMat.opacity = Math.max(0, (1 - p) * 0.95);
      r.outerMat.opacity = Math.max(0, (1 - p * 0.92) * 0.92);
    }
  }

  private createCurrencyNoteTexture(): THREE.CanvasTexture {
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
    return tex;
  }

  private createSwatterPaddleTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    // Neon-green cartoon fly-swatter paddle with dark rim and perforated mesh grid
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 118, 118);
    ctx.fillStyle = '#14532D';
    for (let gx = 20; gx <= 104; gx += 16) {
      for (let gy = 20; gy <= 104; gy += 16) {
        ctx.fillRect(gx, gy, 9, 9);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private syncProjectiles(): void {
    const activeIds = this.activeProjectileIds;
    activeIds.clear();
    for (const proj of this.matchState.projectiles) {
      activeIds.add(proj.uid);
      let mesh = this.projectileMeshes.get(proj.uid);
      if (!mesh) {
        if (proj.kind === 'belan') {
          const grp = new THREE.Group();
          const barrel = new THREE.Mesh(this.belanBarrelGeo, this.belanBarrelMat);
          const h1 = new THREE.Mesh(this.belanHandleGeo, this.belanHandleMat);
          h1.position.y = 0.41;
          const h2 = new THREE.Mesh(this.belanHandleGeo, this.belanHandleMat);
          h2.position.y = -0.41;
          grp.add(barrel, h1, h2);
          mesh = grp;
        } else if (proj.kind === 'swatter') {
          const grp = new THREE.Group();
          const handle = new THREE.Mesh(this.swatterHandleGeo, this.swatterHandleMat);
          handle.position.y = -0.14;
          const grip = new THREE.Mesh(this.swatterGripGeo, this.swatterGripMat);
          grip.position.y = -0.44;
          const paddle = new THREE.Mesh(this.swatterPaddleGeo, this.swatterPaddleMat);
          paddle.position.y = 0.34;
          grp.add(handle, grip, paddle);
          mesh = grp;
        } else {
          mesh = new THREE.Mesh(this.currencyNoteGeo, this.currencyNoteMat);
        }
        this.projectileGroup.add(mesh);
        this.projectileMeshes.set(proj.uid, mesh);
      }
      mesh.position.set(proj.x, proj.y, 0.18);
      if (proj.kind === 'belan') {
        mesh.rotation.z = proj.spin;
        // Golden flour & laddoo sparkle trail along the spinning belan's flight path
        this.spawnParticles(proj.x, proj.y, 1, 0xfff5d6, 2.2);
        this.spawnParticles(proj.x, proj.y, 1, 0xf0c420, 2.8);
      } else if (proj.kind === 'swatter') {
        mesh.rotation.z = -proj.spin;
        mesh.rotation.y = Math.sin(proj.spin * 0.5) * 0.25;
        // Comic star-spark trail behind the fast-spinning fly-swatter!
        this.spawnParticles(proj.x, proj.y, 1, 0x4ade80, 2.5);
        this.spawnParticles(proj.x, proj.y, 1, 0xfef08a, 3.0);
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
        const attacker = this.matchState.fighters[ev.attackerSlot];
        if (attacker?.id === 'mausi' && attacker.action === 'punch') {
          audioEngine.playBelanBonk();
          this.spawnParticles(ev.x, ev.y, 6, 0xf0c420, 5.0);
        } else {
          audioEngine.playPunchHit();
        }
        this.spawnImpactRing(ev.x, ev.y, false);
        this.spawnStarburstSparks(ev.x, ev.y, false);
        this.trauma = Math.min(1, this.trauma + 0.28);
      } else if (
        ev.type === 'heavy_hit' ||
        ev.type === 'grab' ||
        ev.type === 'grab_throw' ||
        ev.type === 'dharna_counter'
      ) {
        const attacker = this.matchState.fighters[ev.attackerSlot];
        if (ev.type === 'heavy_hit' && attacker?.id === 'mausi' && ev.moveCallout === 'BELAN THROW!') {
          audioEngine.playBelanBonk();
          this.spawnParticles(ev.x, ev.y, 12, 0xf0c420, 6.4);
          this.spawnParticles(ev.x, ev.y, 8, 0xfff5d6, 5.2);
        } else if (ev.type === 'heavy_hit' && attacker?.id === 'billa' && ev.moveCallout === 'SWATTER THROW!') {
          audioEngine.playSwatterSlap();
          this.spawnParticles(ev.x, ev.y, 12, 0x4ade80, 6.4);
          this.spawnParticles(ev.x, ev.y, 10, 0xfef08a, 5.8);
        } else if (ev.type === 'dharna_counter') {
          audioEngine.playHeavyHit();
          this.shockwaveRing.position.set(ev.x, 0.06, 0);
          this.shockwaveRing.scale.set(0.75, 0.75, 1);
          this.shockwaveRing.visible = true;
          this.shockwaveTimer = this.shockwaveDuration;
          this.spawnParticles(ev.x, ev.y, 14, 0xf97316, 6.2);
        } else {
          audioEngine.playHeavyHit();
        }
        this.spawnImpactRing(ev.x, ev.y, true);
        this.spawnStarburstSparks(ev.x, ev.y, true);
        this.trauma = Math.min(1, this.trauma + (ev.type === 'grab_throw' ? 0.58 : 0.52));
        this.stage?.triggerExcitement(1.5);
        if (
          (ev.type === 'heavy_hit' || ev.type === 'grab_throw' || ev.type === 'dharna_counter') &&
          this.matchState.phase === 'fighting' &&
          this.matchState.activeSuperSlot === null &&
          attacker &&
          attacker.hp > 0
        ) {
          const roasts = MID_FIGHT_ROASTS[attacker.id];
          const text = roasts[(this.introTauntSeed + Math.floor(this.elapsed * 5)) % roasts.length];
          triggerMidFightDialogue(this.dialogueTracker, attacker.slot, text, performance.now());
        }
      } else if (ev.type === 'block') {
        audioEngine.playBlock();
        this.trauma = Math.min(1, this.trauma + 0.14);
        this.spawnParticles(ev.x, ev.y, 8, 0x38bdf8, 4.4);
      } else if (ev.type === 'special') {
        const caster = this.matchState.fighters[ev.attackerSlot];
        if (caster?.id === 'billa') {
          audioEngine.playSwatterSlap();
        } else if (caster?.id === 'mausi') {
          audioEngine.playBelanBonk();
        } else {
          audioEngine.playSpecial();
        }
        this.stage?.triggerExcitement(1.5);
        if (
          this.matchState.phase === 'fighting' &&
          this.matchState.activeSuperSlot === null &&
          caster &&
          caster.hp > 0
        ) {
          const roasts = MID_FIGHT_ROASTS[caster.id];
          const text = roasts[(this.introTauntSeed + Math.floor(this.elapsed * 3) + 1) % roasts.length];
          triggerMidFightDialogue(this.dialogueTracker, caster.slot, text, performance.now());
        }
        if (caster?.id === 'sheru') {
          // Golden aura shockwave burst + emerald cash glint for PAISA FLEX!
          this.spawnImpactRing(ev.x, ev.y, true);
          this.spawnParticles(ev.x, ev.y, 16, 0xfde047, 6.2);
          this.spawnParticles(ev.x, ev.y + 0.1, 10, 0x4ade80, 4.8);
        } else if (caster?.id === 'billa') {
          // Neon-green & bright-yellow giant flyswatter launch sparks!
          this.spawnParticles(ev.x, ev.y, 12, 0x4ade80, 5.8);
          this.spawnParticles(ev.x, ev.y + 0.12, 10, 0xfde047, 5.0);
        } else if (caster?.id === 'mausi') {
          // Golden flour & laddoo sparkle burst on Belan Throw launch!
          this.spawnParticles(ev.x, ev.y, 12, 0xf0c420, 5.6);
          this.spawnParticles(ev.x, ev.y + 0.08, 10, 0xfff5d6, 4.6);
        } else {
          this.spawnParticles(ev.x, ev.y, 12, 0xf97316, 4.8);
        }
      } else if (ev.type === 'super') {
        const caster = this.matchState.fighters[ev.attackerSlot];
        if (caster?.id === 'sheru') {
          audioEngine.playSheruSuperAudio();
          this.trauma = Math.min(1, this.trauma + 0.45);
        } else {
          audioEngine.playSuper();
          this.trauma = Math.min(1, this.trauma + 0.65);
        }
        // Only clear mid-fight bubbles early when a cinematic Super Power cutscene starts
        clearAllMidFightDialogues(this.dialogueTracker);
        this.stage?.triggerExcitement(1.8);
        this.spawnParticles(ev.x, ev.y, 24, 0xfde047, 8.0);
      } else if (ev.type === 'ko') {
        audioEngine.playKo();
        this.trauma = 1.0;
        this.stage?.triggerExcitement(1.5);
        this.spawnImpactRing(ev.x, ev.y, true);
        this.spawnStarburstSparks(ev.x, ev.y, true);
        this.spawnParticles(ev.x, ev.y, 20, 0xfacc15, 8.8);
      } else if (ev.type === 'knockdown_land') {
        // Dust puff + subtle thud micro-shake when knocked-down fighter hits the arena floor
        this.trauma = Math.min(1, this.trauma + 0.24);
        this.spawnParticles(ev.x, 0.14, 14, 0xe7ddd0, 4.4);
        this.spawnParticles(ev.x, 0.18, 8, 0xd6cbb8, 3.2);
        if (
          this.matchState.phase === 'fighting' &&
          this.matchState.activeSuperSlot === null
        ) {
          const fallen = this.matchState.fighters[ev.attackerSlot];
          if (fallen && fallen.hp > 0) {
            const quips = KNOCKDOWN_QUIPS[fallen.id];
            const text = quips[(this.introTauntSeed + Math.floor(this.elapsed * 3)) % quips.length];
            triggerMidFightDialogue(this.dialogueTracker, fallen.slot, text, performance.now());
          }
        }
      } else if (ev.type === 'jump') {
        audioEngine.playJump();
        this.spawnParticles(ev.x, 0.12, 5, 0xe7e5e4, 2.5);
      } else if (ev.type === 'land') {
        if (ev.word === 'SQUASH!' || ev.word === 'CRACK!') {
          // Anda Bhai ANDA SQUASH flat-flop shockwave + comedic dust & eggshell sparks!
          audioEngine.playHeavyHit();
          this.trauma = Math.min(1, this.trauma + 0.42);
          this.stage?.triggerExcitement(1.5);
          this.shockwaveRing.position.set(ev.x, 0.048, 0);
          this.shockwaveRing.scale.set(0.65, 0.65, 1);
          this.shockwaveRing.visible = true;
          this.shockwaveTimer = this.shockwaveDuration;
          this.spawnImpactRing(ev.x, 0.42, true);
          this.spawnParticles(ev.x, 0.16, 16, 0xffd426, 6.4);
          this.spawnParticles(ev.x, 0.22, 14, 0xfbe0c3, 5.4);
        } else {
          this.spawnParticles(ev.x, 0.1, 6, 0xd6d3d1, 2.8);
        }
      } else if (ev.type === 'whiff') {
        audioEngine.playWhiff();
      }

      if (ev.moveCallout) {
        this.moveCalloutText = ev.moveCallout;
        this.moveCalloutTimer = 1.05;
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

  private buildSpeechBubble(
    slot: 0 | 1,
    text: string,
    id: number,
    trackedEntry?: ActiveFighterDialogue,
    dt = 0.016,
  ): ComicSpeechBubble {
    const f = this.matchState.fighters[slot];
    const headHeight = f.action === 'knockdown' ? 1.18 : f.id === 'billa' ? 2.15 : 2.38;
    const pt = this.projectToScreen(f.x, f.y + headHeight);
    const w = Math.max(this.container.clientWidth, 320);
    const h = Math.max(this.container.clientHeight, 240);
    const bubbleW = w < 640 ? 224 : 268;
    const bubbleH = w < 640 ? 78 : 88;
    const topSafeY = Math.min(200, Math.max(176, Math.round(h * 0.45)));
    const fallbackX = slot === 0 ? w * 0.3 : w * 0.7;
    const fallbackY = topSafeY + 12;

    const clamped = clampDialogueScreenPosition(
      pt ? pt.sx : fallbackX,
      pt ? pt.sy : fallbackY,
      w,
      h,
      bubbleW,
      bubbleH,
      topSafeY,
    );

    let finalX = clamped.x;
    let finalY = clamped.y;
    if (trackedEntry) {
      if (trackedEntry.smoothX === null || trackedEntry.smoothY === null) {
        trackedEntry.smoothX = clamped.x;
        trackedEntry.smoothY = clamped.y;
      } else {
        trackedEntry.smoothX = THREE.MathUtils.damp(trackedEntry.smoothX, clamped.x, 14, dt);
        trackedEntry.smoothY = THREE.MathUtils.damp(trackedEntry.smoothY, clamped.y, 14, dt);
      }
      const reClamped = clampDialogueScreenPosition(
        trackedEntry.smoothX,
        trackedEntry.smoothY,
        w,
        h,
        bubbleW,
        bubbleH,
        topSafeY,
      );
      finalX = reClamped.x;
      finalY = reClamped.y;
    }

    return {
      id,
      slot,
      speakerName: FIGHTER_CONFIGS[f.id].name,
      text,
      screenX: finalX,
      screenY: finalY,
    };
  }

  private emitHud(force = false, dt = 0.016): void {
    const [p1, p2] = this.matchState.fighters;
    const introElapsed = Math.max(0, this.matchState.introDuration - this.matchState.phaseTimer);

    let bannerText: string | null = null;
    let bannerTone: 'round' | 'ko' | 'winner' = 'round';
    const speechBubbles: ComicSpeechBubble[] = [];
    let canSkipIntro = false;

    const isSuperCinematic = Boolean(
      this.matchState.activeSuperSlot !== null ||
        this.matchState.sheruSuper?.active ||
        p1.action === 'super' ||
        p2.action === 'super',
    );

    if (this.matchState.phase === 'intro') {
      if (this.matchState.roundNumber === 1) {
        const introPhase = getIntroDialoguePhase(1, introElapsed);
        canSkipIntro = introPhase.canSkipIntro;
        if (introPhase.activeSlot === 0) {
          const taunts = INTRO_TAUNTS[p1.id];
          speechBubbles.push(
            this.buildSpeechBubble(0, taunts[this.introTauntSeed % taunts.length], -1, undefined, dt),
          );
        } else if (introPhase.activeSlot === 1) {
          const taunts = INTRO_TAUNTS[p2.id];
          speechBubbles.push(
            this.buildSpeechBubble(
              1,
              taunts[(this.introTauntSeed + 1) % taunts.length],
              -2,
              undefined,
              dt,
            ),
          );
        } else if (introPhase.showRoundBanner) {
          bannerText = 'ROUND 1';
          bannerTone = 'round';
        }
      } else {
        if (introElapsed < 1.1) {
          bannerText =
            this.matchState.roundNumber >= 3
              ? 'FINAL ROUND'
              : `ROUND ${this.matchState.roundNumber}`;
          bannerTone = 'round';
        } else {
          bannerText = 'FIGHT!';
          bannerTone = 'round';
        }
      }
    } else if (this.matchState.phase === 'ko_freeze') {
      if (this.matchState.koSubPhase === 'winner_celebration') {
        bannerTone = 'winner';
        if (this.matchState.roundWinnerSlot === 0 || this.matchState.roundWinnerSlot === 1) {
          const winFighter = this.matchState.fighters[this.matchState.roundWinnerSlot];
          const winCfg = FIGHTER_CONFIGS[winFighter.id];
          bannerText = `${winCfg.name.toUpperCase()} WINS`;
          const quips = VICTORY_QUIPS[winFighter.id];
          speechBubbles.push(
            this.buildSpeechBubble(
              winFighter.slot,
              quips[(this.introTauntSeed + this.matchState.roundNumber) % quips.length],
              -(10 + this.matchState.roundNumber),
              undefined,
              dt,
            ),
          );
        } else {
          bannerText = 'DRAW ROUND';
        }
      } else {
        bannerTone = 'ko';
        bannerText =
          this.matchState.finishReason === 'timeout'
            ? 'TIME UP!'
            : this.matchState.koCalloutText || 'GHEE KHATAM!';
        if (!isSuperCinematic) {
          for (const slotEntry of this.dialogueTracker.slots) {
            if (slotEntry) {
              speechBubbles.push(
                this.buildSpeechBubble(slotEntry.slot, slotEntry.text, slotEntry.id, slotEntry, dt),
              );
            }
          }
        }
      }
    } else if (this.matchState.phase === 'fighting' && !isSuperCinematic) {
      for (const slotEntry of this.dialogueTracker.slots) {
        if (slotEntry) {
          speechBubbles.push(
            this.buildSpeechBubble(slotEntry.slot, slotEntry.text, slotEntry.id, slotEntry, dt),
          );
        }
      }
    }

    let superBanner: SuperBannerInfo | null = null;
    if (this.matchState.activeSuperSlot !== null) {
      const caster = this.matchState.fighters[this.matchState.activeSuperSlot];
      const isSheru = caster.id === 'sheru';
      const bannerWindow = isSheru ? 1.85 : 1.15;
      if (this.matchState.activeSuperElapsed < bannerWindow) {
        const cfg = FIGHTER_CONFIGS[caster.id];
        superBanner = {
          fighterId: caster.id,
          fighterName: cfg.name,
          superName: isSheru ? SHERU_SUPER_BANNER : cfg.superName,
          slot: caster.slot,
        };
      }
    }

    const throttleInterval = speechBubbles.length > 0 ? 0.016 : 0.08;
    if (force || this.hudThrottleTimer <= 0) {
      this.hudThrottleTimer = throttleInterval;
      this.callbacks.onHudUpdate({
        p1Hp: Math.round(p1.hp),
        p1MaxHp: p1.maxHp,
        p1Shakti: Math.round(p1.shakti),
        p1SpecialCd: Number(p1.specialCooldown.toFixed(2)),
        p1SpecialMaxCd: p1.specialMaxCooldown,
        p1Combo: p1.comboCount,
        p2Hp: Math.round(p2.hp),
        p2MaxHp: p2.maxHp,
        p2Shakti: Math.round(p2.shakti),
        p2SpecialCd: Number(p2.specialCooldown.toFixed(2)),
        p2SpecialMaxCd: p2.specialMaxCooldown,
        p2Combo: p2.comboCount,
        roundNumber: this.matchState.roundNumber,
        p1RoundsWon: this.matchState.p1RoundsWon,
        p2RoundsWon: this.matchState.p2RoundsWon,
        roundTime: Math.ceil(this.matchState.roundTime),
        phase: this.matchState.phase,
        isSuperCinematic,
        bannerText,
        bannerTone,
        superBanner,
        moveCallout: this.moveCalloutTimer > 0 ? this.moveCalloutText : null,
        speechBubbles,
        canSkipIntro,
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
      // Frame both the celebrating winner and the defeated fighter lying on the floor behind the darkened overlay
      const midX = THREE.MathUtils.clamp((p1.x + p2.x) * 0.5, CAMERA_PAN_MIN_X, CAMERA_PAN_MAX_X);
      const targetX = midX;
      const targetY = 2.25;
      const targetZ = 7.4;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetX, 3.8, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetY, 3.8, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetZ, 3.8, dt);
      this.camLook.x = THREE.MathUtils.damp(this.camLook.x, midX, 4.2, dt);
      this.camLook.y = THREE.MathUtils.damp(this.camLook.y, 1.2, 4.2, dt);
      this.camLook.z = THREE.MathUtils.damp(this.camLook.z, 0, 4.2, dt);
      this.keyLight.position.x = this.camPos.x + 6;
      this.keyLight.target.position.x = this.camPos.x;
      this.keyLight.target.updateMatrixWorld();
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    // Choose target camera pose based on phase:
    // 1. Pre-Fight Intro Sweep (3/4 over-the-shoulder P1 -> CPU -> standard fighting angle)
    // 2. Super Power Cutscene Camera (dramatic low-angle close-up -> dynamic high-angle 3D orbit -> smooth return)
    // 3. KO Winner Celebration (gentle zoom-in on winner)
    // 4. Active Fight & KO Impact Slow-Mo (strictly fixed zoom horizontal panning)
    let target = computeFixedZoomCameraTarget(p1.x, p2.x);
    let posLambda = 6.2;
    let zLambda = 10.0;
    let lookLambda = 6.2;

    if (this.matchState.phase === 'intro') {
      const introElapsed = Math.max(0, this.matchState.introDuration - this.matchState.phaseTimer);
      target = computeIntroCameraTarget(
        this.matchState.roundNumber,
        introElapsed,
        this.matchState.introDuration,
        p1.x,
        p2.x,
      );
      posLambda = 6.4;
      zLambda = 6.4;
      lookLambda = 7.2;
    } else if (this.matchState.activeSuperSlot !== null) {
      const attacker = this.matchState.fighters[this.matchState.activeSuperSlot];
      const defender = this.matchState.fighters[1 - this.matchState.activeSuperSlot];
      target = computeSuperCameraTarget(
        this.matchState.activeSuperElapsed,
        this.matchState.activeSuperDuration,
        attacker.x,
        attacker.facing,
        defender.x,
        attacker.id === 'sheru',
      );
      posLambda = 7.2;
      zLambda = 7.2;
      lookLambda = 8.4;
    } else if (
      this.matchState.phase === 'ko_freeze' &&
      this.matchState.koSubPhase === 'winner_celebration' &&
      (this.matchState.roundWinnerSlot === 0 || this.matchState.roundWinnerSlot === 1)
    ) {
      const winner = this.matchState.fighters[this.matchState.roundWinnerSlot];
      target = computeKoWinnerCameraTarget(winner.x, winner.facing);
      posLambda = 4.5;
      zLambda = 4.5;
      lookLambda = 5.2;
    }

    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, target.x, posLambda, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, target.y, zLambda, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, target.z, zLambda, dt);

    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, target.lookX, lookLambda, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, target.lookY, zLambda, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, target.lookZ, zLambda, dt);

    // Keep key directional light & shadow frustum centered on horizontal pan
    this.keyLight.position.x = this.camPos.x + 6;
    this.keyLight.target.position.x = this.camPos.x;
    this.keyLight.target.updateMatrixWorld();

    // Trauma camera shake layered cleanly on top
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

        // Process Sheru Bhai Super beat signals (cash/coin explosions, micro-shake, crowd cheer, audio restore)
        const signals = this.matchState.sheruSuperSignals;
        if (signals.length > 0) {
          this.sheruSuperVfx.handleBeatSignals(signals, this.graphics === 'low');
          for (const sig of signals) {
            if (sig.kind === 'spotlight_start') {
              this.trauma = Math.min(1, this.trauma + 0.35);
              this.stage?.triggerExcitement(1.6);
            } else if (sig.kind === 'flurry_hit') {
              this.trauma = Math.min(1, this.trauma + 0.22);
              this.spawnParticles(sig.x, sig.y, 8, 0xfde047, 5.6);
            } else if (sig.kind === 'standing_hit') {
              this.trauma = Math.min(1, this.trauma + 0.55);
              this.spawnParticles(sig.x, sig.y, 18, 0xfacc15, 7.2);
              this.stage?.triggerExcitement(1.6);
            } else if (sig.kind === 'lying_kick' || sig.kind === 'lying_slap') {
              this.trauma = Math.min(1, this.trauma + 0.42);
              this.spawnParticles(sig.x, sig.y, 14, 0xfde047, 6.2);
            } else if (sig.kind === 'finisher_snap') {
              this.trauma = 1.0;
              this.spawnParticles(sig.x, sig.y, 28, 0xfde047, 9.2);
              this.stage?.triggerExcitement(2.5);
            } else if (sig.kind === 'super_end') {
              // Never cut off active Super MP3 early — let source.onended restore BGM naturally
              audioEngine.notifySuperAnimationEnd();
            }
          }
        }

        if (this.moveCalloutTimer > 0) {
          this.moveCalloutTimer = Math.max(0, this.moveCalloutTimer - dt);
          if (this.moveCalloutTimer <= 0) this.moveCalloutText = null;
        }
        if (this.matchState.roundNumber !== this.lastTrackedRound) {
          this.lastTrackedRound = this.matchState.roundNumber;
          clearAllMidFightDialogues(this.dialogueTracker);
        }
        if (this.matchState.activeSuperSlot !== null || this.matchState.sheruSuper?.active) {
          clearAllMidFightDialogues(this.dialogueTracker);
        } else {
          pruneExpiredDialogues(this.dialogueTracker, performance.now());
        }

        this.hudThrottleTimer -= dt;
        this.emitHud(events.length > 0 || signals.length > 0, dt);

        if (this.matchState.phase === 'finished' && !this.resultDispatched) {
          this.resultDispatched = true;
          this.currentScreen = 'victory';
          audioEngine.playVictoryFanfare();
          const result = buildMatchResultSnapshot(this.matchState, this.stageId, this.difficulty);
          this.callbacks.onMatchFinish(result);
        }
      }

      // Animate 3D fighter rigs (hide held belan/swatter while thrown projectile is airborne)
      let p1PropThrown = false;
      let p2PropThrown = false;
      for (const proj of this.matchState.projectiles) {
        if (proj.kind === 'belan' || proj.kind === 'swatter') {
          if (proj.ownerSlot === 0) p1PropThrown = true;
          else p2PropThrown = true;
        }
      }
      for (let i = 0; i < 2; i++) {
        const rig = this.rigs[i];
        if (rig) {
          const fighterState = this.matchState.fighters[i];
          animateFighterRig(
            rig,
            fighterState,
            this.elapsed,
            dt,
            i === 0 ? p1PropThrown : p2PropThrown,
          );
          const trailInfo = getActiveStrikeTrailInfo(fighterState);
          if (trailInfo.limb !== null) {
            rig.root.updateMatrixWorld(true);
          }
          this.strikeTrails[i].update(rig, trailInfo.limb, trailInfo.intensity, dt);
        }
      }

      // Update Sheru Bhai Super 3D VFX & smooth arena spotlight dimming/restoration
      const sheruSuper = this.matchState.sheruSuper;
      const attackerSlot = sheruSuper?.attackerSlot ?? 0;
      const attackerRig = sheruSuper?.active ? this.rigs[attackerSlot] : null;
      const attackerX = sheruSuper?.active ? this.matchState.fighters[attackerSlot].x : 0;
      if (attackerRig) {
        attackerRig.root.updateMatrixWorld(true);
      }
      const dimFactor = this.sheruSuperVfx.update(
        dt,
        this.elapsed,
        sheruSuper,
        attackerRig,
        attackerX,
      );
      if (this.stage) {
        this.keyLight.intensity = this.stage.keyLightIntensity * (1 - dimFactor * 0.82);
        this.hemiLight.intensity = this.stage.hemiIntensity * (1 - dimFactor * 0.78);
        this.rimLight.intensity = this.stage.rimLightIntensity * (1 - dimFactor * 0.65);
        this.scene.environmentIntensity = 1 - dimFactor * 0.78;
        this.renderer.toneMappingExposure = 1.08 * (1 - dimFactor * 0.18);
        _stageBgColor.setHex(this.stage.backgroundColor).lerp(_superDimColor, dimFactor * 0.82);
        if (this.scene.background instanceof THREE.Color) {
          this.scene.background.copy(_stageBgColor);
        }
        if (this.scene.fog instanceof THREE.Fog) {
          _stageFogColor.setHex(this.stage.fogColor).lerp(_superDimColor, dimFactor * 0.82);
          this.scene.fog.color.copy(_stageFogColor);
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

    audioEngine.stopSuperAudio();
    this.sheruSuperVfx.dispose(this.scene);
    for (const trail of this.strikeTrails) {
      this.scene.remove(trail.mesh);
      trail.dispose();
    }
    this.stage?.dispose();
    this.rigs.forEach((r) => r?.dispose());
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.shockwaveRing.geometry.dispose();
    (this.shockwaveRing.material as THREE.Material).dispose();
    this.impactInnerGeo.dispose();
    this.impactOuterGeo.dispose();
    for (const r of this.impactRings) {
      r.innerMat.dispose();
      r.outerMat.dispose();
    }
    this.currencyNoteTex.dispose();
    this.currencyNoteGeo.dispose();
    this.currencyNoteMat.dispose();
    this.belanBarrelGeo.dispose();
    this.belanBarrelMat.dispose();
    this.belanHandleGeo.dispose();
    this.belanHandleMat.dispose();
    this.swatterMeshTex.dispose();
    this.swatterHandleGeo.dispose();
    this.swatterGripGeo.dispose();
    this.swatterPaddleGeo.dispose();
    this.swatterHandleMat.dispose();
    this.swatterGripMat.dispose();
    this.swatterPaddleMat.dispose();
    this.pmremTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
