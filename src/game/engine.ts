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
import {
  animateFighterRig,
  buildFighterRig,
  FIGHTER_CONFIGS,
  preloadAdiGlbHead,
  preloadFatherGlbHead,
  preloadKrishGlbHead,
  preloadRealFaceTextures,
  preloadSamyakGlbHead,
  type FighterRig,
} from './characters';
import { getActiveStrikeTrailInfo } from './characters/kinematics';
import { StrikeTrailRibbon } from './characters/strikeTrail';
import {
  buildMatchResultSnapshot,
  computeCpuInput,
  createEmptyInput,
  createMatchState,
  shouldAllowFloatingCallout,
  stepMatch,
} from './combat';
import {
  DIALOGUE_OUTWARD_NUDGE_PX,
  INTRO_ROUND1_CALLOUT_SECONDS,
  clampDialogueScreenPosition,
  clearAllMidFightDialogues,
  computeDialogueBubbleOpacity,
  createDialogueTracker,
  formatCompactDialogueLine,
  getDialogueHudTopSafePx,
  getIntroDialoguePhase,
  pauseDialogueTimers,
  pruneExpiredDialogues,
  resumeDialogueTimers,
  triggerMidFightDialogue,
  type ActiveFighterDialogue,
  type DialogueTracker,
} from './dialogue';
import { ADI_SUPER_BANNER } from './adiSuper';
import { AdiSuperVfx } from './adiSuperVfx';
import { ANDA_SUPER_BANNER } from './andaSuper';
import { AndaSuperVfx } from './andaSuperVfx';
import { BILLA_SUPER_BANNER } from './billaSuper';
import { BillaSuperVfx } from './billaSuperVfx';
import { FATHER_SUPER_BANNER } from './fatherSuper';
import { FatherSuperVfx } from './fatherSuperVfx';
import { MAUSI_SUPER_BANNER } from './mausiSuper';
import { MausiSuperVfx } from './mausiSuperVfx';
import { NETA_SUPER_BANNER } from './netaSuper';
import { NetaSuperVfx } from './netaSuperVfx';
import { SAMYAK_SUPER_BANNER } from './samyakSuper';
import { SamyakSuperVfx } from './samyakSuperVfx';
import { SHERU_SUPER_BANNER } from './sheruSuper';
import { SheruSuperVfx } from './sheruSuperVfx';
import { buildStage, type StageInstance } from './stages';
import {
  applyRemoteInputPacket,
  applyStateSnapshotToGuest,
  consumeRemoteInput,
  createRemoteInputBuffer,
  packMatchStateSnapshot,
  resetRemoteInputBuffer,
  type FriendRoomPacket,
  type GuestActionName,
  type GuestInterpolationTarget,
  type OnlineRole,
  type RemoteInputBuffer,
  type SyncedSuperSignals,
} from './friendRoomProtocol';
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
  onClearCallouts: () => void;
  onHeadline: (headline: string) => void;
  onMatchFinish: (result: MatchResultSnapshot) => void;
  onSuperPreviewStateChange?: (isPlaying: boolean) => void;
  deferAssetPreload?: boolean;
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
const _andaStormDimColor = new THREE.Color(0x09162e);
const _andaFlashColor = new THREE.Color(0xdbeafe);
const _mausiFestiveDimColor = new THREE.Color(0x2d1404);
const _fatherCrimsonDimColor = new THREE.Color(0x1f0709);
const _samyakBlueGoldDimColor = new THREE.Color(0x071324);
const _adiOliveGoldDimColor = new THREE.Color(0x0b1708);

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
  father: [
    'Uniform kahan hai?! Diary nikaal!',
    'Silence in assembly! Call parents!',
    'Line seedhi karo — discipline first!',
  ],
  samyak: [
    '5 AM deadlift, sham ko Polity — ready?',
    'Body bhi, dimaag bhi — feel IAS power!',
    '18 hrs study, 2 hrs gym — Prelims fail!',
  ],
  adi: [
    'Last bench se direct knockout dunga!',
    'Attendance kam, combo 100% solid!',
    'Plaid shirt press, ab tera test hai!',
  ],
  krish: [
    'Backbench se aaya — desk bhi hilega!',
    'Bag shoulder pe, combo ready — aaja!',
    'Heavyweight swag, zero tension — fight!',
  ],
};

const KNOCKDOWN_QUIPS: Record<FighterId, string[]> = {
  sheru: ['Arre mera Armani suit!', 'Audit karwaunga iska!'],
  billa: ['Meow!! Yeh cheating hai!', 'Mera swatter kidhar gaya?!'],
  neta: ['Yeh janta pe atyachaar hai!', 'Chashma bach gaya!'],
  anda: ['Arre shell bachao!', 'Farsh pe tel kisne giraya!'],
  mausi: ['Haye meri kamar! Ab dekh!', 'Belan se double badla lungi!'],
  father: ['This is gross indiscipline!', 'Wait till I sign your diary!'],
  samyak: ['Arre mera pre-workout gir gaya!', 'Prelims jhatka, Mains phod dunga!'],
  adi: ['Plaid shirt pe dhool mat daal!', 'Back-bencher comeback dekhna!'],
  krish: ['Mera bag strap kharab mat kar!', 'Sweatshirt jhaad li, rush dekh!'],
};

const MID_FIGHT_ROASTS: Record<FighterId, string[]> = {
  sheru: [
    'Ye le 18% GST ke saath pitai!',
    'Tera portfolio laal kar diya!',
    'Bill tera, swag mera — vasool!',
  ],
  billa: [
    'Phatak! Machhar jaise uda diya!',
    'Meow! Swatter ka swaad kaisa laga?',
    'Chai thandi, thappad garam!',
  ],
  neta: [
    'Janta ka faisla seedha mukke se!',
    'Dharna mode ON — ab bhaag mat!',
    'Chanda nahi, seedha danda milega!',
  ],
  anda: [
    'Hard-boiled Power! No cracks!',
    'Omelette se pehle flat kar diya!',
    'Protein punch seedha muh pe!',
  ],
  mausi: [
    'Aaj belan ka VIP treatment milega!',
    'Meetha kam, sutai zyada!',
    'Aunty se panga? Belan combo!',
  ],
  father: [
    'Red remark in your diary — sealed!',
    'Principal office after the bell!',
    'Zero discipline, full suspension!',
  ],
  samyak: [
    'Laxmikanth 7th Ed seedha muh pe!',
    'Article 21: defense suspended!',
    'No pain, no AIR 1 — beast mode!',
  ],
  adi: [
    'Last-Bench Notebook seedha muh pe!',
    'Proxy lagwa di, defense gayab!',
    'Zero syllabus, 100% swag combo!',
  ],
  krish: [
    'Backbench Desk Slam on the floor!',
    'Last row power halka mat samajh!',
    'Full brawler energy — guard gaya!',
  ],
};

const VICTORY_QUIPS: Record<FighterId, string[]> = {
  sheru: ['Full paisa vasool, bhai!', 'Market closed — Sheru on top!'],
  billa: ['Swatter supremacy! Meow!', 'Clean sweep — ekdum jhakaas!'],
  neta: ['Janta ki jeet! Cutting chai lao!', 'Jhola-chaap power zindabad!'],
  anda: ['Hard-boiled champion, boss!', 'Shell intact, opposition cracked!'],
  mausi: ['Ab ja aur garma-garam laddoo kha!', 'Belan ke aage koi tikta hai?'],
  father: ['Assembly dismissed! Pin-drop silence!', 'Rustication stands — call parents!'],
  samyak: ['First attempt knockout — AIR 1!', 'Gym pump solid, Polity solid!'],
  adi: ['Last bench se top score — GG!', 'Notebook band — Adi on top!'],
  krish: ['Backbench rush — class dismissed!', 'Last-row heavyweight — Krish wins!'],
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

  private currentScreen: GameScreen = 'loading';
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

  // Pre-pooled 3D Super Power VFX managers (all 8 fighters)
  private sheruSuperVfx: SheruSuperVfx;
  private billaSuperVfx: BillaSuperVfx;
  private netaSuperVfx: NetaSuperVfx;
  private andaSuperVfx: AndaSuperVfx;
  private mausiSuperVfx: MausiSuperVfx;
  private fatherSuperVfx: FatherSuperVfx;
  private samyakSuperVfx: SamyakSuperVfx;
  private adiSuperVfx: AdiSuperVfx;

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
  private diaryNoteTex: THREE.CanvasTexture;
  private diaryNoteGeo: THREE.BoxGeometry;
  private diaryNoteMat: THREE.MeshStandardMaterial;
  private polityBookTex: THREE.CanvasTexture;
  private polityBookGeo: THREE.BoxGeometry;
  private polityBookCoverMat: THREE.MeshStandardMaterial;
  private polityBookSpineMat: THREE.MeshStandardMaterial;
  private polityBookPageMat: THREE.MeshStandardMaterial;
  private polityBookMats: THREE.MeshStandardMaterial[];
  private adiNotebookTex: THREE.CanvasTexture;
  private adiNotebookGeo: THREE.BoxGeometry;
  private adiNotebookCoverMat: THREE.MeshStandardMaterial;
  private adiNotebookSpineMat: THREE.MeshStandardMaterial;
  private adiNotebookPageMat: THREE.MeshStandardMaterial;
  private adiNotebookMats: THREE.MeshStandardMaterial[];

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
  private koBannerAudioTriggered = false;

  // Live 3D Super Power Preview sandbox state ("Test Supers Before Fighting")
  private previewPendingSuper = false;
  private previewSuperWasActive = false;
  private previewResetTimer = 0;
  private lastNotifiedPreviewPlaying = false;

  // Online 2-Player Friend Room (PeerJS WebRTC) state
  private onlineRole: OnlineRole = 'offline';
  private onlineSendPacket: ((pkt: FriendRoomPacket) => void) | null = null;
  private remoteP2Input: RemoteInputBuffer = createRemoteInputBuffer();
  private hostBroadcastTimer = 0;
  private hostSnapshotSeq = 0;
  private guestLastSeq = -1;
  private guestTargets: [GuestInterpolationTarget, GuestInterpolationTarget] = [
    { x: -2.4, y: 0, initialized: false },
    { x: 2.4, y: 0, initialized: false },
  ];
  private guestLastMoveDir: -1 | 0 | 1 = 0;
  private guestLastDown = false;
  private pendingBroadcastDialogues: Array<{ slot: 0 | 1; text: string }> = [];

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
    this.renderer.toneMappingExposure = 1.05;
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

    // Calibrated Studio 3-Point Arcade Lighting Rig
    // 1. Subtle hemisphere fill light
    this.hemiLight = new THREE.HemisphereLight(0xa5d8ff, 0x5c2b16, 0.78);
    this.scene.add(this.hemiLight);

    // 2. Warm directional key light from front-top
    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 2.05);
    this.keyLight.position.set(5.5, 11, 8.5);
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

    // 3. Crisp cool arcade rim/backlight from behind to carve sharp edge-highlights on fighter silhouettes
    this.rimLight = new THREE.DirectionalLight(0xbae6fd, 1.45);
    this.rimLight.position.set(-5.0, 6.2, -8.0);
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
    this.billaSuperVfx = new BillaSuperVfx(this.scene);
    this.netaSuperVfx = new NetaSuperVfx(this.scene);
    this.andaSuperVfx = new AndaSuperVfx(this.scene);
    this.mausiSuperVfx = new MausiSuperVfx(this.scene);
    this.fatherSuperVfx = new FatherSuperVfx(this.scene);
    this.samyakSuperVfx = new SamyakSuperVfx(this.scene);
    this.adiSuperVfx = new AdiSuperVfx(this.scene);

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

    // Crisp red-stamped School Diary Warning Slip projectile for Father Roy Dolphus ("DIARY NOTE")
    this.diaryNoteTex = this.createDiaryNoteTexture();
    this.diaryNoteGeo = new THREE.BoxGeometry(0.46, 0.34, 0.024);
    this.diaryNoteMat = new THREE.MeshStandardMaterial({
      map: this.diaryNoteTex,
      color: 0xffffff,
      emissive: 0x991b1b,
      emissiveIntensity: 0.2,
      roughness: 0.62,
      metalness: 0.04,
    });

    // Thick heavy red Indian Polity (Laxmikanth) textbook projectile for Samyak ("LAXMIKANT SLAM")
    this.polityBookTex = this.createPolityBookTexture();
    this.polityBookGeo = new THREE.BoxGeometry(0.46, 0.58, 0.14);
    this.polityBookCoverMat = new THREE.MeshStandardMaterial({
      map: this.polityBookTex,
      color: 0xffffff,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.22,
      roughness: 0.44,
      metalness: 0.08,
    });
    this.polityBookSpineMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.52,
      metalness: 0.06,
    });
    this.polityBookPageMat = new THREE.MeshStandardMaterial({
      color: 0xf8f4e6,
      roughness: 0.85,
      metalness: 0.02,
    });
    this.polityBookMats = [
      this.polityBookPageMat, // +X right page edges
      this.polityBookSpineMat, // -X spine
      this.polityBookPageMat, // +Y top page edges
      this.polityBookPageMat, // -Y bottom page edges
      this.polityBookCoverMat, // +Z front cover
      this.polityBookCoverMat, // -Z back cover
    ];

    // Spiral college notebook projectile for Adi ("NOTEBOOK SMASH")
    this.adiNotebookTex = this.createAdiNotebookTexture();
    this.adiNotebookGeo = new THREE.BoxGeometry(0.42, 0.54, 0.085);
    this.adiNotebookCoverMat = new THREE.MeshStandardMaterial({
      map: this.adiNotebookTex,
      color: 0xffffff,
      emissive: 0x365314,
      emissiveIntensity: 0.24,
      roughness: 0.45,
      metalness: 0.08,
    });
    this.adiNotebookSpineMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.38,
      metalness: 0.42,
    });
    this.adiNotebookPageMat = new THREE.MeshStandardMaterial({
      color: 0xfefce8,
      roughness: 0.84,
      metalness: 0.02,
    });
    this.adiNotebookMats = [
      this.adiNotebookPageMat,
      this.adiNotebookSpineMat,
      this.adiNotebookPageMat,
      this.adiNotebookPageMat,
      this.adiNotebookCoverMat,
      this.adiNotebookCoverMat,
    ];

    this.matchState = createMatchState(this.p1Id, this.p2Id, false);
    this.loadStage(this.stageId);
    this.loadFighters(this.p1Id, this.p2Id);

    if (!this.callbacks.deferAssetPreload) {
      // Preload all Super Power MP3 bytes & optional real face photo textures once at startup
      void audioEngine.preloadAllSuperAudios();
      preloadRealFaceTextures();
      preloadFatherGlbHead();
      preloadSamyakGlbHead();
      preloadAdiGlbHead();
      preloadKrishGlbHead();
    }

    if (!this.isSoftwareGl) {
      // Pre-warm all Super VFX, strike trail & shockwave shader programs during init to avoid mid-fight spikes
      this.sheruSuperVfx.setPrewarmVisible(true);
      this.billaSuperVfx.setPrewarmVisible(true);
      this.netaSuperVfx.setPrewarmVisible(true);
      this.andaSuperVfx.setPrewarmVisible(true);
      this.mausiSuperVfx.setPrewarmVisible(true);
      this.fatherSuperVfx.setPrewarmVisible(true);
      this.samyakSuperVfx.setPrewarmVisible(true);
      this.adiSuperVfx.setPrewarmVisible(true);
      this.shockwaveRing.visible = true;
      this.strikeTrails[0].mesh.visible = true;
      this.renderer.compile(this.scene, this.camera);
      this.sheruSuperVfx.setPrewarmVisible(false);
      this.billaSuperVfx.setPrewarmVisible(false);
      this.netaSuperVfx.setPrewarmVisible(false);
      this.andaSuperVfx.setPrewarmVisible(false);
      this.mausiSuperVfx.setPrewarmVisible(false);
      this.fatherSuperVfx.setPrewarmVisible(false);
      this.samyakSuperVfx.setPrewarmVisible(false);
      this.adiSuperVfx.setPrewarmVisible(false);
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

  public setOnlineMode(role: OnlineRole, sendPacket?: (pkt: FriendRoomPacket) => void): void {
    this.onlineRole = role;
    this.onlineSendPacket = role === 'offline' ? null : (sendPacket ?? null);
    resetRemoteInputBuffer(this.remoteP2Input);
    this.hostBroadcastTimer = 0;
    this.hostSnapshotSeq = 0;
    this.guestLastSeq = -1;
    this.guestLastMoveDir = 0;
    this.guestLastDown = false;
    this.guestTargets[0].initialized = false;
    this.guestTargets[1].initialized = false;
    this.pendingBroadcastDialogues = [];
  }

  public receiveFriendPacket(pkt: FriendRoomPacket): void {
    if (this.onlineRole === 'host') {
      if (pkt.type === 'INPUT') {
        applyRemoteInputPacket(this.remoteP2Input, pkt);
      } else if (pkt.type === 'SKIP_INTRO') {
        this.skipPreFightIntro();
      }
      return;
    }

    if (this.onlineRole === 'guest') {
      if (pkt.type === 'STATE') {
        if (pkt.seq <= this.guestLastSeq) return;
        this.guestLastSeq = pkt.seq;
        applyStateSnapshotToGuest(this.matchState, pkt, this.guestTargets);
      } else if (pkt.type === 'EVENTS') {
        if (pkt.events && pkt.events.length > 0) {
          this.handleCombatEvents(pkt.events, true);
        }
        if (pkt.superSignals) {
          this.processSuperSignals(pkt.superSignals);
        }
        if (pkt.dialogues && pkt.dialogues.length > 0) {
          const nowMs = performance.now();
          for (const d of pkt.dialogues) {
            triggerMidFightDialogue(this.dialogueTracker, d.slot, d.text, nowMs);
          }
        }
        if (pkt.koDahi) {
          audioEngine.playDahiKoAudio();
        }
      } else if (pkt.type === 'MATCH_END') {
        if (!this.resultDispatched) {
          this.resultDispatched = true;
          this.currentScreen = 'victory';
          audioEngine.playVictoryFanfare();
          this.callbacks.onMatchFinish(pkt.result);
        }
      } else if (pkt.type === 'SKIP_INTRO') {
        this.skipPreFightIntro();
      }
    }
  }

  public setScreen(screen: GameScreen): void {
    this.currentScreen = screen;
    if (screen === 'playing') {
      this.clearInputs();
      resumeDialogueTimers(this.dialogueTracker, performance.now());
    } else if (screen === 'paused') {
      this.clearInputs();
      pauseDialogueTimers(this.dialogueTracker, performance.now());
    } else if (
      screen === 'select' ||
      screen === 'title' ||
      screen === 'notice' ||
      screen === 'loading' ||
      screen === 'auth'
    ) {
      // Explicitly exited to menu: reset Super VFX, preview flags, mid-fight dialogues, callouts, and stop active Super audio
      this.previewPendingSuper = false;
      this.previewSuperWasActive = false;
      this.previewResetTimer = 0;
      this.notifyPreviewState(false);
      clearAllMidFightDialogues(this.dialogueTracker);
      this.callbacks.onClearCallouts();
      this.resetAllSuperVfx();
      audioEngine.stopSuperAudio();
      audioEngine.stopDahiKoAudio();
    }
  }

  private resetAllSuperVfx(): void {
    this.sheruSuperVfx.reset();
    this.billaSuperVfx.reset();
    this.netaSuperVfx.reset();
    this.andaSuperVfx.reset();
    this.mausiSuperVfx.reset();
    this.fatherSuperVfx.reset();
    this.samyakSuperVfx.reset();
    this.adiSuperVfx.reset();
    this.strikeTrails[0].reset();
    this.strikeTrails[1].reset();
  }

  private isAnySuperSequenceActive(): boolean {
    const [p1, p2] = this.matchState.fighters;
    return Boolean(
      this.matchState.activeSuperSlot !== null ||
        this.matchState.sheruSuper?.active ||
        this.matchState.billaSuper?.active ||
        this.matchState.netaSuper?.active ||
        this.matchState.andaSuper?.active ||
        this.matchState.mausiSuper?.active ||
        this.matchState.fatherSuper?.active ||
        this.matchState.samyakSuper?.active ||
        this.matchState.adiSuper?.active ||
        p1.action === 'super' ||
        p2.action === 'super',
    );
  }

  private notifyPreviewState(isPlaying: boolean): void {
    if (this.lastNotifiedPreviewPlaying !== isPlaying) {
      this.lastNotifiedPreviewPlaying = isPlaying;
      this.callbacks.onSuperPreviewStateChange?.(isPlaying);
    }
  }

  private createSuperPreviewState(p1: FighterId): MatchState {
    const dummyId: FighterId = p1 === 'sheru' ? 'billa' : 'sheru';
    const state = createMatchState(p1, dummyId, true);
    state.fighters[0].x = -2.2;
    state.fighters[0].y = 0;
    state.fighters[0].facing = 1;
    state.fighters[0].hp = state.fighters[0].maxHp;
    state.fighters[0].shakti = 100;
    state.fighters[1].x = 2.2;
    state.fighters[1].y = 0;
    state.fighters[1].facing = -1;
    state.fighters[1].hp = state.fighters[1].maxHp;
    state.fighters[1].shakti = 0;
    state.roundTime = 60;
    return state;
  }

  public startSuperPreview(p1: FighterId, stage: StageId): void {
    const dummyId: FighterId = p1 === 'sheru' ? 'billa' : 'sheru';
    this.p1Id = p1;
    this.p2Id = dummyId;
    if (stage !== this.stageId) {
      this.stageId = stage;
      this.loadStage(stage);
    }
    this.loadFighters(p1, dummyId);
    this.clearProjectiles();
    this.resetAllSuperVfx();
    audioEngine.stopSuperAudio();
    audioEngine.stopDahiKoAudio();
    void audioEngine.preloadAllSuperAudios();

    this.matchState = this.createSuperPreviewState(p1);
    this.previewPendingSuper = false;
    this.previewSuperWasActive = false;
    this.previewResetTimer = 0;
    this.moveCalloutText = null;
    this.moveCalloutTimer = 0;
    clearAllMidFightDialogues(this.dialogueTracker);
    this.callbacks.onClearCallouts();
    this.trauma = 0;
    this.currentScreen = 'super_preview';

    // Snap camera immediately to clean wide sandbox framing above the compact bottom bar
    this.camPos.set(0, 2.25, 8.2);
    this.camLook.set(0, 1.15, 0);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.updateMatrixWorld(true);

    this.clearInputs();
    this.notifyPreviewState(false);
    this.emitHud(true);
  }

  public setSuperPreviewFighter(id: FighterId): void {
    if (this.currentScreen !== 'super_preview') return;
    const dummyId: FighterId = id === 'sheru' ? 'billa' : 'sheru';
    this.p1Id = id;
    this.p2Id = dummyId;
    this.loadFighters(id, dummyId);
    this.clearProjectiles();
    this.resetAllSuperVfx();
    audioEngine.stopSuperAudio();
    audioEngine.stopDahiKoAudio();

    this.matchState = this.createSuperPreviewState(id);
    this.previewPendingSuper = false;
    this.previewSuperWasActive = false;
    this.previewResetTimer = 0;
    this.moveCalloutText = null;
    this.moveCalloutTimer = 0;
    clearAllMidFightDialogues(this.dialogueTracker);
    this.callbacks.onClearCallouts();
    this.trauma = 0;
    this.notifyPreviewState(false);
    this.emitHud(true);
  }

  public triggerPreviewSuper(): void {
    if (this.currentScreen !== 'super_preview') return;
    if (this.previewPendingSuper || this.previewSuperWasActive || this.isAnySuperSequenceActive()) {
      return;
    }
    this.clearProjectiles();
    this.resetAllSuperVfx();
    audioEngine.stopSuperAudio();
    audioEngine.stopDahiKoAudio();
    this.callbacks.onClearCallouts();
    clearAllMidFightDialogues(this.dialogueTracker);

    this.matchState = this.createSuperPreviewState(this.p1Id);
    this.previewPendingSuper = true;
    this.previewSuperWasActive = false;
    this.previewResetTimer = 0;
    this.notifyPreviewState(true);
    this.emitHud(true);
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
    syncSeed?: number,
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
    this.billaSuperVfx.reset();
    this.netaSuperVfx.reset();
    this.andaSuperVfx.reset();
    this.mausiSuperVfx.reset();
    this.fatherSuperVfx.reset();
    this.samyakSuperVfx.reset();
    this.adiSuperVfx.reset();
    this.strikeTrails[0].reset();
    this.strikeTrails[1].reset();
    // Explicit match start/restart: stop any prior Super/KO audio and ensure buffers are preloaded
    audioEngine.stopSuperAudio();
    audioEngine.stopDahiKoAudio();
    this.koBannerAudioTriggered = false;
    void audioEngine.preloadAllSuperAudios();
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
    this.introTauntSeed = typeof syncSeed === 'number' ? syncSeed : Math.floor(Math.random() * 100);
    this.moveCalloutText = null;
    this.moveCalloutTimer = 0;
    clearAllMidFightDialogues(this.dialogueTracker);
    this.callbacks.onClearCallouts();
    this.lastTrackedRound = this.matchState.roundNumber;
    this.resultDispatched = false;
    this.trauma = 0;
    this.currentScreen = 'playing';

    // Reset online sync counters cleanly for the new match
    resetRemoteInputBuffer(this.remoteP2Input);
    this.hostBroadcastTimer = 0;
    this.hostSnapshotSeq = 0;
    this.guestLastSeq = -1;
    this.guestLastMoveDir = 0;
    this.guestLastDown = false;
    this.guestTargets[0] = { x: this.matchState.fighters[0].x, y: 0, initialized: true };
    this.guestTargets[1] = { x: this.matchState.fighters[1].x, y: 0, initialized: true };
    this.pendingBroadcastDialogues = [];

    // Snap camera immediately to either the Round 1 over-the-shoulder opening or standard 2.5D fight frame
    const [f1, f2] = this.matchState.fighters;
    const initialCam = skipIntro
      ? computeFixedZoomCameraTarget(f1.x, f2.x)
      : computeIntroCameraTarget(1, 0, this.matchState.introDuration, f1.x, f2.x);
    this.camPos.set(initialCam.x, initialCam.y, initialCam.z);
    this.camLook.set(initialCam.lookX, initialCam.lookY, initialCam.lookZ);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.updateMatrixWorld(true);

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
    this.hemiLight.intensity = stage.hemiIntensity * 0.92;
    // Blend stage rim toward crisp cool arcade backlight so fighters always get clean silhouette edge highlights
    this.rimLight.color.setHex(stage.rimLightColor).lerp(new THREE.Color(0xbae6fd), 0.72);
    this.rimLight.intensity = Math.max(1.35, stage.rimLightIntensity * 1.15);
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

  private createDiaryNoteTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    // Crisp off-white school diary warning slip with ruled lines & bold red stamp
    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, 192, 128);
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 7;
    ctx.strokeRect(5, 5, 182, 118);

    // Subtle school notebook blue ruled lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.lineWidth = 1.5;
    for (let y = 26; y <= 108; y += 14) {
      ctx.beginPath();
      ctx.moveTo(14, y);
      ctx.lineTo(178, y);
      ctx.stroke();
    }

    // Header band
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(14, 14, 164, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DIARY NOTE', 96, 26);

    // Tilted red warning stamp
    ctx.save();
    ctx.translate(96, 74);
    ctx.rotate(-0.14);
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 3;
    ctx.strokeRect(-62, -20, 124, 40);
    ctx.fillStyle = '#DC2626';
    ctx.font = '900 18px sans-serif';
    ctx.fillText('WARNING!', 0, -3);
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('CALL PARENTS', 0, 12);
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createPolityBookTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 320;
    const ctx = c.getContext('2d')!;
    // Iconic deep red hardcover "INDIAN POLITY · LAXMIKANTH" UPSC textbook cover
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(0, 0, 256, 320);

    // Subtle dark spine strip on left
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(0, 0, 26, 320);

    // Gold ornamental UPSC border
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 16, 222, 288);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 24, 206, 272);

    // Top edition ribbon
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(40, 38, 178, 28);
    ctx.fillStyle = '#450A0A';
    ctx.font = '900 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('UPSC · IAS EDITION', 129, 52);

    // Main bold title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 32px sans-serif';
    ctx.fillText('INDIAN', 129, 118);
    ctx.fillStyle = '#FEF08A';
    ctx.font = '900 38px sans-serif';
    ctx.fillText('POLITY', 129, 160);

    // Gold Ashoka-style seal divider
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(52, 194);
    ctx.lineTo(206, 194);
    ctx.stroke();

    // Author / iconic textbook name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 22px sans-serif';
    ctx.fillText('LAXMIKANTH', 129, 234);

    ctx.fillStyle = '#FCA5A5';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('HEAVYWEIGHT 7TH ED.', 129, 266);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createAdiNotebookTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 320;
    const ctx = c.getContext('2d')!;
    // Olive-slate college spiral notebook cover for Adi's "NOTEBOOK SMASH"
    const grad = ctx.createLinearGradient(0, 0, 256, 320);
    grad.addColorStop(0, '#3f6212');
    grad.addColorStop(0.58, '#4d7c0f');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 320);

    // Metallic spiral binding edge
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 28, 320);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    for (let y = 24; y < 306; y += 26) {
      ctx.beginPath();
      ctx.arc(14, y, 9, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    }

    // Crisp cream sticker label
    ctx.fillStyle = '#fefce8';
    ctx.fillRect(46, 54, 184, 120);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.strokeRect(46, 54, 184, 120);

    ctx.fillStyle = '#1e293b';
    ctx.font = '900 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LAST BENCH', 138, 92);
    ctx.fillStyle = '#3f6212';
    ctx.font = '900 30px sans-serif';
    ctx.fillText('ADI', 138, 134);

    // Subtle plaid stripe accent at bottom
    ctx.fillStyle = '#facc15';
    ctx.fillRect(46, 214, 184, 10);
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(46, 232, 184, 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('CLASS TOPPER SMASH', 138, 272);

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
        } else if (proj.kind === 'diary') {
          mesh = new THREE.Mesh(this.diaryNoteGeo, this.diaryNoteMat);
        } else if (proj.kind === 'polity') {
          mesh = new THREE.Mesh(this.polityBookGeo, this.polityBookMats);
        } else if (proj.kind === 'notebook') {
          mesh = new THREE.Mesh(this.adiNotebookGeo, this.adiNotebookMats);
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
      } else if (proj.kind === 'diary') {
        mesh.rotation.z = -proj.spin * 1.1;
        mesh.rotation.y = Math.sin(proj.spin * 0.85) * 0.48;
        mesh.rotation.x = Math.cos(proj.spin * 0.65) * 0.28;
        // Crisp red-stamped paper flutter trail
        this.spawnParticles(proj.x, proj.y, 1, 0xfef2f2, 2.2);
        this.spawnParticles(proj.x, proj.y, 1, 0xef4444, 2.6);
      } else if (proj.kind === 'polity') {
        mesh.rotation.z = -proj.spin * 1.18;
        mesh.rotation.y = Math.sin(proj.spin * 0.72) * 0.44;
        mesh.rotation.x = Math.cos(proj.spin * 0.55) * 0.25;
        // Fluttering textbook page & gold spark trail behind the heavy red Laxmikanth book
        this.spawnParticles(proj.x, proj.y, 1, 0xfefce8, 2.4);
        this.spawnParticles(proj.x, proj.y, 1, 0xdc2626, 2.7);
        this.spawnParticles(proj.x, proj.y, 1, 0xfacc15, 2.5);
      } else if (proj.kind === 'notebook') {
        mesh.rotation.z = -proj.spin * 1.24;
        mesh.rotation.y = Math.sin(proj.spin * 0.8) * 0.42;
        mesh.rotation.x = Math.cos(proj.spin * 0.6) * 0.22;
        // Olive-lime & chalk-gold spark trail behind Adi's spinning spiral notebook
        this.spawnParticles(proj.x, proj.y, 1, 0x84cc16, 2.4);
        this.spawnParticles(proj.x, proj.y, 1, 0xfefce8, 2.2);
        this.spawnParticles(proj.x, proj.y, 1, 0xfacc15, 2.6);
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
    this.camera.updateMatrixWorld();
    _projVec.set(x, y, 0).applyMatrix4(this.camera.matrixWorldInverse);
    if (_projVec.z >= -0.25) return null;
    _projVec.applyMatrix4(this.camera.projectionMatrix);
    if (_projVec.z < -1 || _projVec.z > 1) return null;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return {
      sx: (_projVec.x * 0.5 + 0.5) * w,
      sy: (-_projVec.y * 0.5 + 0.5) * h,
    };
  }

  private handleCombatEvents(events: CombatEvent[], isGuestReplay = false): void {
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
        } else if (
          ev.type === 'heavy_hit' &&
          attacker?.id === 'father' &&
          ev.moveCallout === 'DIARY NOTE!'
        ) {
          audioEngine.playHeavyHit();
          this.spawnParticles(ev.x, ev.y, 12, 0xef4444, 6.0);
          this.spawnParticles(ev.x, ev.y, 10, 0xfef2f2, 5.2);
        } else if (ev.type === 'heavy_hit' && attacker?.id === 'samyak' && ev.moveCallout === 'LAXMIKANT SLAM!') {
          audioEngine.playHeavyHit();
          this.spawnParticles(ev.x, ev.y, 14, 0xdc2626, 6.4);
          this.spawnParticles(ev.x, ev.y, 12, 0xfefce8, 5.6);
          this.spawnParticles(ev.x, ev.y, 10, 0xfacc15, 6.2);
        } else if (ev.type === 'heavy_hit' && attacker?.id === 'adi' && ev.moveCallout === 'NOTEBOOK SMASH!') {
          audioEngine.playHeavyHit();
          this.spawnParticles(ev.x, ev.y, 14, 0x84cc16, 6.2);
          this.spawnParticles(ev.x, ev.y, 10, 0xfefce8, 5.4);
          this.spawnParticles(ev.x, ev.y, 10, 0xfacc15, 6.0);
        } else if (ev.type === 'heavy_hit' && attacker?.id === 'krish' && ev.moveCallout === 'DESK SLAM!') {
          audioEngine.playHeavyHit();
          this.shockwaveRing.position.set(ev.x, 0.055, 0);
          this.shockwaveRing.scale.set(0.7, 0.7, 1);
          this.shockwaveRing.visible = true;
          this.shockwaveTimer = this.shockwaveDuration;
          this.spawnParticles(ev.x, ev.y, 14, 0x65a30d, 6.2);
          this.spawnParticles(ev.x, ev.y, 10, 0xfacc15, 5.6);
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
          !isGuestReplay &&
          (ev.type === 'heavy_hit' || ev.type === 'grab_throw' || ev.type === 'dharna_counter') &&
          this.matchState.phase === 'fighting' &&
          this.matchState.activeSuperSlot === null &&
          attacker &&
          attacker.hp > 0
        ) {
          const roasts = MID_FIGHT_ROASTS[attacker.id];
          const text = roasts[(this.introTauntSeed + Math.floor(this.elapsed * 5)) % roasts.length];
          triggerMidFightDialogue(this.dialogueTracker, attacker.slot, text, performance.now());
          if (this.onlineRole === 'host') {
            this.pendingBroadcastDialogues.push({ slot: attacker.slot, text });
          }
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
          !isGuestReplay &&
          this.matchState.phase === 'fighting' &&
          this.matchState.activeSuperSlot === null &&
          caster &&
          caster.hp > 0
        ) {
          const roasts = MID_FIGHT_ROASTS[caster.id];
          const text = roasts[(this.introTauntSeed + Math.floor(this.elapsed * 3) + 1) % roasts.length];
          triggerMidFightDialogue(this.dialogueTracker, caster.slot, text, performance.now());
          if (this.onlineRole === 'host') {
            this.pendingBroadcastDialogues.push({ slot: caster.slot, text });
          }
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
        } else if (caster?.id === 'father') {
          // Crimson stamp & crisp paper burst on DIARY NOTE launch
          this.spawnParticles(ev.x, ev.y, 10, 0xef4444, 5.4);
          this.spawnParticles(ev.x, ev.y + 0.08, 8, 0xfef2f2, 4.4);
        } else if (caster?.id === 'samyak') {
          // Red Indian Polity cover & golden page sparks on LAXMIKANT SLAM launch
          this.spawnParticles(ev.x, ev.y, 12, 0xdc2626, 5.8);
          this.spawnParticles(ev.x, ev.y + 0.1, 10, 0xfacc15, 5.0);
        } else if (caster?.id === 'adi') {
          // Olive-lime & chalk-gold sparks on NOTEBOOK SMASH launch
          this.spawnParticles(ev.x, ev.y, 12, 0x84cc16, 5.6);
          this.spawnParticles(ev.x, ev.y + 0.1, 10, 0xfacc15, 4.8);
        } else if (caster?.id === 'krish') {
          // Olive-gold brawler burst on Backbench Desk Slam lunge
          this.spawnParticles(ev.x, ev.y, 12, 0x65a30d, 5.8);
          this.spawnParticles(ev.x, ev.y + 0.1, 10, 0xfacc15, 5.0);
        } else {
          this.spawnParticles(ev.x, ev.y, 12, 0xf97316, 4.8);
        }
      } else if (ev.type === 'super') {
        const caster = this.matchState.fighters[ev.attackerSlot];
        if (
          caster?.id === 'sheru' ||
          caster?.id === 'billa' ||
          caster?.id === 'neta' ||
          caster?.id === 'anda' ||
          caster?.id === 'mausi' ||
          caster?.id === 'father' ||
          caster?.id === 'samyak' ||
          caster?.id === 'adi' ||
          caster?.id === 'krish'
        ) {
          audioEngine.playFighterSuperAudio(caster.id);
          this.trauma = Math.min(1, this.trauma + 0.45);
        } else {
          audioEngine.playSuper();
          this.trauma = Math.min(1, this.trauma + 0.65);
        }
        // Clear mid-fight speech bubbles & any lingering floating comic text the instant a Super starts
        clearAllMidFightDialogues(this.dialogueTracker);
        this.callbacks.onClearCallouts();
        this.stage?.triggerExcitement(1.8);
        const superBurstColor =
          caster?.id === 'billa'
            ? 0x4ade80
            : caster?.id === 'neta'
              ? 0xf97316
              : caster?.id === 'anda'
                ? 0x38bdf8
                : caster?.id === 'mausi'
                  ? 0xfbbf24
                  : caster?.id === 'father'
                    ? 0xef4444
                    : caster?.id === 'samyak'
                      ? 0x38bdf8
                      : caster?.id === 'adi'
                        ? 0x84cc16
                        : caster?.id === 'krish'
                          ? 0x65a30d
                          : 0xfde047;
        this.spawnParticles(ev.x, ev.y, 24, superBurstColor, 8.0);
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
          !isGuestReplay &&
          this.matchState.phase === 'fighting' &&
          this.matchState.activeSuperSlot === null
        ) {
          const fallen = this.matchState.fighters[ev.attackerSlot];
          if (fallen && fallen.hp > 0) {
            const quips = KNOCKDOWN_QUIPS[fallen.id];
            const text = quips[(this.introTauntSeed + Math.floor(this.elapsed * 3)) % quips.length];
            triggerMidFightDialogue(this.dialogueTracker, fallen.slot, text, performance.now());
            if (this.onlineRole === 'host') {
              this.pendingBroadcastDialogues.push({ slot: fallen.slot, text });
            }
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

      if (ev.word && shouldAllowFloatingCallout(this.matchState, ev)) {
        const pt = this.projectToScreen(ev.x, ev.y + (ev.isSuperSignature ? 0.72 : 0.55));
        if (pt) {
          this.callbacks.onCallout({
            id: this.nextCalloutId++,
            text: ev.word,
            color: ev.color ?? '#FACC15',
            screenX: pt.sx,
            screenY: pt.sy,
            isSignature: ev.isSuperSignature,
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
    opacity = 1,
    trackedEntry?: ActiveFighterDialogue,
    dt = 0.016,
  ): ComicSpeechBubble {
    const f = this.matchState.fighters[slot];
    const other = this.matchState.fighters[1 - slot];
    // Anchor strictly well ABOVE the top of each fighter's head/hat (`headTopY + 0.85`)
    // so the bubble NEVER overlaps faces or heads!
    const standingHeadTopY: Record<FighterId, number> = {
      sheru: 2.28,
      billa: 2.12,
      neta: 2.24,
      anda: 2.22,
      mausi: 2.18,
      father: 2.26,
      samyak: 2.28,
      adi: 2.24,
      krish: 2.22,
    };
    const headTopY = f.action === 'knockdown' ? 0.92 : standingHeadTopY[f.id];
    const w = Math.max(this.container.clientWidth, 320);
    const h = Math.max(this.container.clientHeight, 240);
    const compactText = formatCompactDialogueLine(text);
    const isCompact = h <= 520;
    const bubbleW = isCompact ? 228 : w < 640 ? 256 : 310;
    const bubbleH = isCompact ? 34 : 40;
    const topSafeY = getDialogueHudTopSafePx(h);

    const isIntroCloseUp =
      this.matchState.phase === 'intro' && this.matchState.roundNumber === 1;

    let rawX: number;
    let rawY: number;
    let tailSide: 'center' | 'left' | 'right' = 'center';

    if (isIntroCloseUp) {
      // Position compact 1-line punchline pill cleanly near the fighter's upper HUD corner
      const headPt = this.projectToScreen(f.x, f.y + headTopY * 0.82);
      if (slot === 0) {
        const anchorX = headPt ? headPt.sx : w * 0.18;
        rawX = Math.max(anchorX + bubbleW * 0.62, w * 0.34);
        tailSide = 'left';
      } else {
        const anchorX = headPt ? headPt.sx : w * 0.82;
        rawX = Math.min(anchorX - bubbleW * 0.62, w * 0.66);
        tailSide = 'right';
      }
      rawY = topSafeY + bubbleH + 6;
    } else {
      const anchorY = f.y + headTopY + 0.85;
      const pt = this.projectToScreen(f.x, anchorY);
      const isOnLeft = f.x < other.x || (f.x === other.x && slot === 0);
      const outwardNudge = isOnLeft ? -DIALOGUE_OUTWARD_NUDGE_PX : DIALOGUE_OUTWARD_NUDGE_PX;
      const fallbackX = slot === 0 ? w * 0.28 : w * 0.72;
      const fallbackY = topSafeY + bubbleH + 4;
      rawX = (pt ? pt.sx : fallbackX) + outwardNudge;
      // Pin compact bubble neatly in the upper HUD zone so the 3D arena center stays clear
      rawY = Math.min(pt ? pt.sy : fallbackY, topSafeY + bubbleH + 22);
    }

    const clamped = clampDialogueScreenPosition(
      rawX,
      rawY,
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
      text: compactText,
      screenX: finalX,
      screenY: finalY,
      opacity: Number(Math.max(0, Math.min(1, opacity)).toFixed(3)),
      tailSide,
    };
  }

  private emitHud(force = false, dt = 0.016): void {
    const [p1, p2] = this.matchState.fighters;
    const introElapsed = Math.max(0, this.matchState.introDuration - this.matchState.phaseTimer);
    const nowMs = performance.now();

    let bannerText: string | null = null;
    let bannerTone: 'round' | 'ko' | 'winner' = 'round';
    const speechBubbles: ComicSpeechBubble[] = [];
    let canSkipIntro = false;

    const isSuperCinematic = Boolean(
      this.matchState.activeSuperSlot !== null ||
        this.matchState.sheruSuper?.active ||
        this.matchState.billaSuper?.active ||
        this.matchState.netaSuper?.active ||
        this.matchState.andaSuper?.active ||
        this.matchState.mausiSuper?.active ||
        this.matchState.fatherSuper?.active ||
        this.matchState.samyakSuper?.active ||
        this.matchState.adiSuper?.active ||
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
            this.buildSpeechBubble(
              0,
              taunts[this.introTauntSeed % taunts.length],
              -1,
              computeDialogueBubbleOpacity(introPhase.slotElapsedMs),
              undefined,
              dt,
            ),
          );
        } else if (introPhase.activeSlot === 1) {
          const taunts = INTRO_TAUNTS[p2.id];
          speechBubbles.push(
            this.buildSpeechBubble(
              1,
              taunts[(this.introTauntSeed + 1) % taunts.length],
              -2,
              computeDialogueBubbleOpacity(introPhase.slotElapsedMs),
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
              1,
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
            ? 'TIME UP! — TIME KHATAM!'
            : 'K.O.! — DAHI KHATAM!';
        if (!isSuperCinematic) {
          for (const slotEntry of this.dialogueTracker.slots) {
            if (slotEntry) {
              const op = computeDialogueBubbleOpacity(nowMs - slotEntry.startedAt);
              if (op > 0.01) {
                speechBubbles.push(
                  this.buildSpeechBubble(
                    slotEntry.slot,
                    slotEntry.text,
                    slotEntry.id,
                    op,
                    slotEntry,
                    dt,
                  ),
                );
              }
            }
          }
        }
      }
    } else if (this.matchState.phase === 'fighting' && !isSuperCinematic) {
      for (const slotEntry of this.dialogueTracker.slots) {
        if (slotEntry) {
          const op = computeDialogueBubbleOpacity(nowMs - slotEntry.startedAt);
          if (op > 0.01) {
            speechBubbles.push(
              this.buildSpeechBubble(
                slotEntry.slot,
                slotEntry.text,
                slotEntry.id,
                op,
                slotEntry,
                dt,
              ),
            );
          }
        }
      }
    }

    let superBanner: SuperBannerInfo | null = null;
    if (this.matchState.activeSuperSlot !== null) {
      const caster = this.matchState.fighters[this.matchState.activeSuperSlot];
      const isSheru = caster.id === 'sheru';
      const isBilla = caster.id === 'billa';
      const isNeta = caster.id === 'neta';
      const isAnda = caster.id === 'anda';
      const isMausi = caster.id === 'mausi';
      const isFather = caster.id === 'father';
      const isSamyak = caster.id === 'samyak';
      const isAdi = caster.id === 'adi';
      const bannerWindow = isSheru
        ? 1.85
        : isSamyak
          ? 1.75
          : isFather || isAdi
            ? 1.65
            : isMausi
              ? 1.6
              : isNeta
                ? 1.55
                : isAnda
                  ? 1.45
                  : isBilla
                    ? 1.4
                    : 1.15;
      if (this.matchState.activeSuperElapsed < bannerWindow) {
        const cfg = FIGHTER_CONFIGS[caster.id];
        superBanner = {
          fighterId: caster.id,
          fighterName: cfg.name,
          superName: isSheru
            ? SHERU_SUPER_BANNER
            : isBilla
              ? BILLA_SUPER_BANNER
              : isNeta
                ? NETA_SUPER_BANNER
                : isAnda
                  ? ANDA_SUPER_BANNER
                  : isMausi
                    ? MAUSI_SUPER_BANNER
                    : isFather
                      ? FATHER_SUPER_BANNER
                      : isSamyak
                        ? SAMYAK_SUPER_BANNER
                        : isAdi
                          ? ADI_SUPER_BANNER
                          : cfg.superName,
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
    let target =
      this.currentScreen === 'super_preview'
        ? { x: 0, y: 2.25, z: 8.2, lookX: 0, lookY: 1.15, lookZ: 0 }
        : computeFixedZoomCameraTarget(p1.x, p2.x);
    let posLambda = 6.2;
    let zLambda = 10.0;
    let lookLambda = 6.2;

    if (this.currentScreen !== 'super_preview' && this.matchState.phase === 'intro') {
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
      const superKind =
        attacker.id === 'sheru'
          ? 'sheru'
          : attacker.id === 'billa'
            ? 'billa'
            : attacker.id === 'neta'
              ? 'neta'
              : attacker.id === 'anda'
                ? 'anda'
                : attacker.id === 'mausi'
                  ? 'mausi'
                  : attacker.id === 'father'
                    ? 'father'
                    : attacker.id === 'samyak'
                      ? 'samyak'
                      : attacker.id === 'adi'
                        ? 'adi'
                        : 'generic';
      target = computeSuperCameraTarget(
        this.matchState.activeSuperElapsed,
        this.matchState.activeSuperDuration,
        attacker.x,
        attacker.facing,
        defender.x,
        attacker.id === 'sheru',
        superKind,
        attacker.y,
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

  private processSuperSignals(bundle: SyncedSuperSignals): boolean {
    let anySignal = false;

    const signals = bundle.sheru;
    if (signals && signals.length > 0) {
      anySignal = true;
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
          audioEngine.notifySuperAnimationEnd();
        }
      }
    }

    const billaSignals = bundle.billa;
    if (billaSignals && billaSignals.length > 0) {
      anySignal = true;
      this.billaSuperVfx.handleBeatSignals(billaSignals, this.graphics === 'low');
      for (const sig of billaSignals) {
        if (sig.kind === 'eye_glow_start') {
          this.trauma = Math.min(1, this.trauma + 0.28);
          this.stage?.triggerExcitement(1.6);
        } else if (sig.kind === 'roach_launch') {
          this.trauma = Math.min(1, this.trauma + 0.32);
          this.spawnParticles(sig.x, sig.y, 12, 0xa3e635, 6.4);
        } else if (sig.kind === 'smoke_start') {
          this.trauma = Math.min(1, this.trauma + 0.42);
          this.stage?.triggerExcitement(1.8);
        } else if (sig.kind === 'smoke_hit') {
          this.trauma = Math.min(1, this.trauma + 0.34);
          this.spawnImpactRing(sig.x, sig.y, false);
          this.spawnStarburstSparks(sig.x, sig.y, false);
          this.spawnParticles(sig.x, sig.y, 10, 0xfde047, 6.2);
        } else if (sig.kind === 'pop_finisher') {
          this.callbacks.onClearCallouts();
          this.trauma = 0.96;
          this.spawnImpactRing(sig.x, sig.y, true);
          this.spawnStarburstSparks(sig.x, sig.y, true);
          this.spawnParticles(sig.x, sig.y, 26, 0x4ade80, 9.0);
          this.stage?.triggerExcitement(2.4);
        } else if (sig.kind === 'super_end') {
          audioEngine.notifySuperAnimationEnd();
        }
      }
    }

    const netaSignals = bundle.neta;
    if (netaSignals && netaSignals.length > 0) {
      anySignal = true;
      this.netaSuperVfx.handleBeatSignals(netaSignals, this.graphics === 'low');
      for (const sig of netaSignals) {
        if (sig.kind === 'levitate_start') {
          this.trauma = Math.min(1, this.trauma + 0.28);
          this.stage?.triggerExcitement(1.6);
        } else if (sig.kind === 'command_point') {
          this.trauma = Math.min(1, this.trauma + 0.3);
          this.spawnParticles(sig.x, sig.y, 14, 0xf97316, 5.8);
        } else if (sig.kind === 'stampede_start') {
          this.stage?.triggerExcitement(2.0);
        } else if (sig.kind === 'van_hit') {
          this.trauma = Math.min(1, this.trauma + 0.52);
          this.spawnImpactRing(sig.x, sig.y, true);
          this.spawnStarburstSparks(sig.x, sig.y, false);
          this.spawnParticles(sig.x, sig.y, 16, 0xfb923c, 7.6);
        } else if (sig.kind === 'van_finisher') {
          this.trauma = 1.0;
          this.spawnImpactRing(sig.x, sig.y, true);
          this.spawnStarburstSparks(sig.x, sig.y, true);
          this.spawnParticles(sig.x, sig.y, 28, 0xfacc15, 9.4);
          this.stage?.triggerExcitement(2.5);
        } else if (sig.kind === 'super_end') {
          audioEngine.notifySuperAnimationEnd();
        }
      }
    }

    const andaSignals = bundle.anda;
    if (andaSignals && andaSignals.length > 0) {
      anySignal = true;
      this.andaSuperVfx.handleBeatSignals(andaSignals, this.graphics === 'low');
      for (const sig of andaSignals) {
        if (sig.kind === 'hat_bow_start') {
          this.trauma = Math.min(1, this.trauma + 0.22);
          this.stage?.triggerExcitement(1.6);
        } else if (sig.kind === 'lightning_strike') {
          this.trauma = Math.min(1, this.trauma + 0.42);
          this.spawnImpactRing(sig.x, sig.y, false);
          this.spawnStarburstSparks(sig.x, sig.y, false);
          this.spawnParticles(sig.x, sig.y, 14, 0x38bdf8, 7.0);
        } else if (sig.kind === 'wall_impact') {
          this.trauma = 1.0;
          this.spawnImpactRing(sig.x, sig.y, true);
          this.spawnStarburstSparks(sig.x, sig.y, true);
          this.spawnParticles(sig.x, sig.y, 28, 0xc8452e, 9.2);
          this.stage?.triggerExcitement(2.5);
        } else if (sig.kind === 'wall_shatter') {
          this.trauma = Math.min(1, this.trauma + 0.52);
          this.spawnParticles(sig.x, sig.y, 22, 0xd97706, 8.2);
          this.stage?.triggerExcitement(2.0);
        } else if (sig.kind === 'super_end') {
          audioEngine.notifySuperAnimationEnd();
        }
      }
    }

    const mausiSignals = bundle.mausi;
    if (mausiSignals && mausiSignals.length > 0) {
      anySignal = true;
      this.mausiSuperVfx.handleBeatSignals(mausiSignals, this.graphics === 'low');
      for (const sig of mausiSignals) {
        if (sig.kind === 'gulp_start') {
          this.trauma = Math.min(1, this.trauma + 0.22);
          this.stage?.triggerExcitement(1.5);
        } else if (sig.kind === 'aura_ignite') {
          this.trauma = Math.min(1, this.trauma + 0.36);
          this.spawnImpactRing(sig.x, sig.y, false);
          this.spawnParticles(sig.x, sig.y, 16, 0xfbbf24, 6.8);
          this.stage?.triggerExcitement(1.8);
        } else if (sig.kind === 'levitate_start') {
          this.stage?.triggerExcitement(1.9);
        } else if (sig.kind === 'laddoo_hit') {
          this.trauma = Math.min(1, this.trauma + 0.28);
          this.spawnImpactRing(sig.x, sig.y, false);
          this.spawnStarburstSparks(sig.x, sig.y, false);
          this.spawnParticles(sig.x, sig.y, 10, 0xfbbf24, 6.4);
        } else if (sig.kind === 'mega_impact') {
          this.trauma = 1.0;
          this.spawnImpactRing(sig.x, sig.y, true);
          this.spawnStarburstSparks(sig.x, sig.y, true);
          this.spawnParticles(sig.x, sig.y, 30, 0xf97316, 9.5);
          this.stage?.triggerExcitement(2.6);
        } else if (sig.kind === 'super_end') {
          audioEngine.notifySuperAnimationEnd();
        }
      }
    }

    const fatherSignals = bundle.father;
    if (fatherSignals && fatherSignals.length > 0) {
      anySignal = true;
      this.fatherSuperVfx.handleBeatSignals(fatherSignals, this.graphics === 'low');
      for (const sig of fatherSignals) {
        if (sig.kind === 'levitate_start') {
          this.trauma = Math.min(1, this.trauma + 0.25);
          this.stage?.triggerExcitement(1.6);
        } else if (sig.kind === 'papers_summon') {
          this.trauma = Math.min(1, this.trauma + 0.34);
          this.spawnImpactRing(sig.x, sig.y, false);
          this.spawnParticles(sig.x, sig.y, 16, 0xef4444, 6.2);
          this.stage?.triggerExcitement(1.9);
        } else if (sig.kind === 'barrage_start') {
          this.stage?.triggerExcitement(2.1);
        } else if (sig.kind === 'paper_hit') {
          this.trauma = Math.min(1, this.trauma + 0.28);
          this.spawnImpactRing(sig.x, sig.y, false);
          this.spawnStarburstSparks(sig.x, sig.y, false);
          this.spawnParticles(sig.x, sig.y, 10, 0xef4444, 6.0);
        } else if (sig.kind === 'master_notice_impact') {
          this.trauma = 1.0;
          this.spawnImpactRing(sig.x, sig.y, true);
          this.spawnStarburstSparks(sig.x, sig.y, true);
          this.spawnParticles(sig.x, sig.y, 28, 0xdc2626, 9.4);
          this.spawnParticles(sig.x, sig.y + 0.2, 16, 0xfacc15, 7.6);
          this.stage?.triggerExcitement(2.6);
        } else if (sig.kind === 'super_end') {
          audioEngine.notifySuperAnimationEnd();
        }
      }
    }

    const samyakSignals = bundle.samyak;
    if (samyakSignals && samyakSignals.length > 0) {
      anySignal = true;
      this.samyakSuperVfx.handleBeatSignals(samyakSignals, this.graphics === 'low');
      for (const sig of samyakSignals) {
        if (sig.kind === 'flex_start') {
          this.trauma = Math.min(1, this.trauma + 0.3);
          this.spawnParticles(sig.x, sig.y, 16, 0x38bdf8, 6.2);
          this.stage?.triggerExcitement(1.7);
        } else if (sig.kind === 'lens_glint') {
          this.trauma = Math.min(1, this.trauma + 0.24);
          this.spawnImpactRing(sig.x, sig.y, false);
          this.spawnParticles(sig.x, sig.y, 14, 0xfacc15, 6.6);
          this.stage?.triggerExcitement(1.9);
        } else if (sig.kind === 'barrage_summon') {
          this.stage?.triggerExcitement(2.1);
        } else if (sig.kind === 'barrage_hit') {
          const isHeavyDumbbell = (sig.hitIndex ?? 0) % 2 === 1;
          this.trauma = Math.min(1, this.trauma + (isHeavyDumbbell ? 0.36 : 0.26));
          this.spawnImpactRing(sig.x, sig.y, isHeavyDumbbell);
          this.spawnStarburstSparks(sig.x, sig.y, false);
          this.spawnParticles(
            sig.x,
            sig.y,
            isHeavyDumbbell ? 14 : 10,
            isHeavyDumbbell ? 0x38bdf8 : 0xfacc15,
            6.8,
          );
        } else if (sig.kind === 'slam_leap') {
          this.trauma = Math.min(1, this.trauma + 0.28);
          this.spawnParticles(sig.x, 0.16, 14, 0xfacc15, 5.8);
          this.stage?.triggerExcitement(2.2);
        } else if (sig.kind === 'air1_slam_impact') {
          this.trauma = 1.0;
          this.spawnImpactRing(sig.x, sig.y, true);
          this.spawnStarburstSparks(sig.x, sig.y, true);
          this.spawnParticles(sig.x, sig.y, 28, 0xfacc15, 9.6);
          this.spawnParticles(sig.x, sig.y + 0.2, 18, 0x38bdf8, 8.2);
          this.stage?.triggerExcitement(2.8);
        } else if (sig.kind === 'super_end') {
          audioEngine.notifySuperAnimationEnd();
        }
      }
    }

    const adiSignals = bundle.adi;
    if (adiSignals && adiSignals.length > 0) {
      anySignal = true;
      this.adiSuperVfx.handleBeatSignals(adiSignals, this.graphics === 'low');
      for (const sig of adiSignals) {
        if (sig.kind === 'collar_flex') {
          this.trauma = Math.min(1, this.trauma + 0.28);
          this.spawnParticles(sig.x, sig.y, 16, 0x84cc16, 6.0);
          this.stage?.triggerExcitement(1.7);
        } else if (sig.kind === 'aura_surge') {
          this.trauma = Math.min(1, this.trauma + 0.24);
          this.spawnImpactRing(sig.x, sig.y, false);
          this.spawnParticles(sig.x, sig.y, 14, 0xfacc15, 6.4);
          this.stage?.triggerExcitement(1.9);
        } else if (sig.kind === 'barrage_summon') {
          this.stage?.triggerExcitement(2.1);
        } else if (sig.kind === 'barrage_hit') {
          const isChalkDuster = (sig.hitIndex ?? 0) % 2 === 1;
          this.trauma = Math.min(1, this.trauma + (isChalkDuster ? 0.34 : 0.25));
          this.spawnImpactRing(sig.x, sig.y, isChalkDuster);
          this.spawnStarburstSparks(sig.x, sig.y, false);
          this.spawnParticles(
            sig.x,
            sig.y,
            isChalkDuster ? 14 : 10,
            isChalkDuster ? 0xfefce8 : 0x84cc16,
            6.5,
          );
        } else if (sig.kind === 'finisher_leap') {
          this.trauma = Math.min(1, this.trauma + 0.28);
          this.spawnParticles(sig.x, 0.16, 14, 0xfacc15, 5.8);
          this.stage?.triggerExcitement(2.2);
        } else if (sig.kind === 'last_bench_impact') {
          this.trauma = 1.0;
          this.spawnImpactRing(sig.x, sig.y, true);
          this.spawnStarburstSparks(sig.x, sig.y, true);
          this.spawnParticles(sig.x, sig.y, 26, 0xfacc15, 9.4);
          this.spawnParticles(sig.x, sig.y + 0.2, 18, 0x84cc16, 8.2);
          this.stage?.triggerExcitement(2.8);
        } else if (sig.kind === 'super_end') {
          audioEngine.notifySuperAnimationEnd();
        }
      }
    }

    return anySignal;
  }

  private tick = (): void => {
    if (this.disposed) return;

    if (this.currentScreen === 'loading') {
      this.lastTime = performance.now();
      this.frameId = window.setTimeout(this.tick, 80);
      return;
    }

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.currentScreen !== 'paused') {
      this.elapsed += dt;
      this.stage?.update(this.elapsed, dt);

      if (this.currentScreen === 'playing' || this.currentScreen === 'super_preview') {
        const isSuperPreview = this.currentScreen === 'super_preview';
        const isGuestOnline = !isSuperPreview && this.onlineRole === 'guest';
        const isHostOnline = !isSuperPreview && this.onlineRole === 'host';

        let forceHud = false;

        if (isGuestOnline) {
          // Guest sends local touch/keyboard controls immediately to Host over WebRTC DataChannel
          const localInput = this.samplePlayerInput();
          const moveDir: -1 | 0 | 1 =
            localInput.right && !localInput.left
              ? 1
              : localInput.left && !localInput.right
                ? -1
                : 0;
          const actions: GuestActionName[] = [];
          if (localInput.up) actions.push('up');
          if (localInput.punch) actions.push('punch');
          if (localInput.kick) actions.push('kick');
          if (localInput.grab) actions.push('grab');
          if (localInput.special) actions.push('special');
          if (localInput.superMove) actions.push('superMove');

          const dirChanged =
            moveDir !== this.guestLastMoveDir || localInput.down !== this.guestLastDown;
          if (actions.length > 0) {
            this.guestLastMoveDir = moveDir;
            this.guestLastDown = localInput.down;
            for (const action of actions) {
              this.onlineSendPacket?.({
                type: 'INPUT',
                moveDir,
                down: localInput.down,
                action,
              });
            }
          } else if (dirChanged) {
            this.guestLastMoveDir = moveDir;
            this.guestLastDown = localInput.down;
            this.onlineSendPacket?.({
              type: 'INPUT',
              moveDir,
              down: localInput.down,
            });
          }

          // Smooth 60 FPS position & visual timer interpolation between 28 Hz Host snapshots
          for (let i = 0; i < 2; i++) {
            const f = this.matchState.fighters[i];
            const tgt = this.guestTargets[i];
            if (tgt.initialized) {
              f.x = THREE.MathUtils.damp(f.x, tgt.x, 22, dt);
              f.y = THREE.MathUtils.damp(f.y, tgt.y, 22, dt);
            }
            if (f.actionDuration > 0 && f.actionTimer < f.actionDuration) {
              f.actionTimer = Math.min(f.actionDuration, f.actionTimer + dt);
            }
            if (f.action === 'walk') {
              f.walkCycle += dt * 11;
            }
            if (f.hitFlashTimer > 0) {
              f.hitFlashTimer = Math.max(0, f.hitFlashTimer - dt);
            }
          }
          if (this.matchState.phase === 'intro' && this.matchState.phaseTimer > 0) {
            this.matchState.phaseTimer = Math.max(0, this.matchState.phaseTimer - dt);
          }
          if (this.matchState.activeSuperSlot !== null) {
            this.matchState.activeSuperElapsed = Math.min(
              this.matchState.activeSuperDuration,
              this.matchState.activeSuperElapsed + dt,
            );
          }
          for (const proj of this.matchState.projectiles) {
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            proj.spin += dt * 12;
          }
        } else {
          // Offline VS CPU, Super Preview, or Host-Authoritative Online 2P simulation
          let p1Input: FighterInput;
          let p2Input: FighterInput;
          if (isSuperPreview) {
            p1Input = createEmptyInput();
            if (this.previewPendingSuper) {
              p1Input.superMove = true;
              this.previewPendingSuper = false;
            }
            p2Input = createEmptyInput();
          } else if (isHostOnline) {
            // CPU AI completely disabled in Friend Room mode — P2 is 100% controlled by Guest's phone
            p1Input = this.samplePlayerInput();
            p2Input = consumeRemoteInput(this.remoteP2Input);
          } else {
            p1Input = this.samplePlayerInput();
            p2Input = computeCpuInput(
              this.matchState,
              this.difficulty,
              dt,
              Math.random,
              this.stageId,
            );
          }

          this.pendingBroadcastDialogues.length = 0;
          const events = stepMatch(this.matchState, [p1Input, p2Input], dt);
          if (events.length > 0) {
            this.handleCombatEvents(events, false);
          }

          if (isSuperPreview) {
            this.matchState.roundTime = 60;
            this.matchState.phase = 'fighting';
            if (this.matchState.fighters[1].hp < 1) {
              this.matchState.fighters[1].hp = 1;
            }
          }

          // Trigger custom "DAHI KHATAM!" KO MP3 once at the exact frame the KO banner slams on screen
          let koDahiFired = false;
          if (
            !isSuperPreview &&
            this.matchState.phase === 'ko_freeze' &&
            this.matchState.koSubPhase === 'impact_slowmo' &&
            this.matchState.finishReason === 'ko'
          ) {
            if (!this.koBannerAudioTriggered) {
              this.koBannerAudioTriggered = true;
              koDahiFired = true;
              audioEngine.playDahiKoAudio();
            }
          } else if (this.matchState.phase !== 'ko_freeze') {
            this.koBannerAudioTriggered = false;
          }

          const signalBundle: SyncedSuperSignals = {};
          if (this.matchState.sheruSuperSignals.length > 0) {
            signalBundle.sheru = this.matchState.sheruSuperSignals;
          }
          if (this.matchState.billaSuperSignals.length > 0) {
            signalBundle.billa = this.matchState.billaSuperSignals;
          }
          if (this.matchState.netaSuperSignals.length > 0) {
            signalBundle.neta = this.matchState.netaSuperSignals;
          }
          if (this.matchState.andaSuperSignals.length > 0) {
            signalBundle.anda = this.matchState.andaSuperSignals;
          }
          if (this.matchState.mausiSuperSignals.length > 0) {
            signalBundle.mausi = this.matchState.mausiSuperSignals;
          }
          if (this.matchState.fatherSuperSignals.length > 0) {
            signalBundle.father = this.matchState.fatherSuperSignals;
          }
          if (this.matchState.samyakSuperSignals.length > 0) {
            signalBundle.samyak = this.matchState.samyakSuperSignals;
          }
          if (this.matchState.adiSuperSignals.length > 0) {
            signalBundle.adi = this.matchState.adiSuperSignals;
          }

          const anySignal = this.processSuperSignals(signalBundle);
          forceHud = events.length > 0 || anySignal;

          // Broadcast Host-authoritative state (~28 Hz) & immediate one-shot event packets to Guest
          if (isHostOnline && this.onlineSendPacket) {
            if (
              events.length > 0 ||
              anySignal ||
              this.pendingBroadcastDialogues.length > 0 ||
              koDahiFired
            ) {
              this.onlineSendPacket({
                type: 'EVENTS',
                events: events.length > 0 ? events : undefined,
                superSignals: anySignal ? signalBundle : undefined,
                dialogues:
                  this.pendingBroadcastDialogues.length > 0
                    ? [...this.pendingBroadcastDialogues]
                    : undefined,
                koDahi: koDahiFired || undefined,
              });
            }

            this.hostBroadcastTimer -= dt;
            if (this.hostBroadcastTimer <= 0 || forceHud || koDahiFired) {
              this.hostBroadcastTimer = 0.036; // ~28 Hz compact state snapshots
              this.onlineSendPacket(
                packMatchStateSnapshot(this.matchState, ++this.hostSnapshotSeq),
              );
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
        if (
          this.matchState.activeSuperSlot !== null ||
          this.matchState.sheruSuper?.active ||
          this.matchState.billaSuper?.active ||
          this.matchState.netaSuper?.active ||
          this.matchState.andaSuper?.active ||
          this.matchState.mausiSuper?.active ||
          this.matchState.fatherSuper?.active ||
          this.matchState.samyakSuper?.active ||
          this.matchState.adiSuper?.active
        ) {
          clearAllMidFightDialogues(this.dialogueTracker);
        } else {
          pruneExpiredDialogues(this.dialogueTracker, performance.now());
        }

        // Update camera BEFORE emitting HUD so speech bubbles project with exact current-frame matrices
        this.updateCamera(dt);
        this.hudThrottleTimer -= dt;
        this.emitHud(forceHud, dt);

        if (isSuperPreview) {
          const superActiveNow = this.isAnySuperSequenceActive();
          if (superActiveNow) {
            this.previewSuperWasActive = true;
            this.previewResetTimer = 0.72;
            this.notifyPreviewState(true);
          } else if (this.previewSuperWasActive) {
            this.previewResetTimer = Math.max(0, this.previewResetTimer - dt);
            if (this.previewResetTimer <= 0) {
              this.matchState = this.createSuperPreviewState(this.p1Id);
              this.clearProjectiles();
              this.callbacks.onClearCallouts();
              this.previewSuperWasActive = false;
              this.notifyPreviewState(false);
              this.emitHud(true, dt);
            }
          }
        } else if (!isGuestOnline && this.matchState.phase === 'finished' && !this.resultDispatched) {
          this.resultDispatched = true;
          this.currentScreen = 'victory';
          audioEngine.playVictoryFanfare();
          const result = buildMatchResultSnapshot(this.matchState, this.stageId, this.difficulty);
          if (isHostOnline && this.onlineSendPacket) {
            this.onlineSendPacket({ type: 'MATCH_END', result });
          }
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

      // Update Sheru, Blue Billa, and Garib Sena Neta Super 3D VFX & smooth arena spotlight dimming/restoration
      const sheruSuper = this.matchState.sheruSuper;
      const sheruSlot = sheruSuper?.attackerSlot ?? 0;
      const sheruRig = sheruSuper?.active ? this.rigs[sheruSlot] : null;
      const sheruX = sheruSuper?.active ? this.matchState.fighters[sheruSlot].x : 0;
      if (sheruRig) {
        sheruRig.root.updateMatrixWorld(true);
      }
      const sheruDim = this.sheruSuperVfx.update(
        dt,
        this.elapsed,
        sheruSuper,
        sheruRig,
        sheruX,
      );

      const billaSuper = this.matchState.billaSuper;
      const billaSlot = billaSuper?.attackerSlot ?? 0;
      const billaDefSlot = billaSuper?.defenderSlot ?? 1;
      const billaRig = billaSuper?.active ? this.rigs[billaSlot] : null;
      const billaFighter = this.matchState.fighters[billaSlot];
      const billaDef = this.matchState.fighters[billaDefSlot];
      if (billaRig) {
        billaRig.root.updateMatrixWorld(true);
      }
      const billaDim = this.billaSuperVfx.update(
        dt,
        this.elapsed,
        billaSuper,
        billaRig,
        billaFighter?.x ?? 0,
        billaFighter?.facing ?? 1,
        billaDef?.x ?? 2,
      );

      const netaSuper = this.matchState.netaSuper;
      const netaSlot = netaSuper?.attackerSlot ?? 0;
      const netaDefSlot = netaSuper?.defenderSlot ?? 1;
      const netaFighter = this.matchState.fighters[netaSlot];
      const netaDef = this.matchState.fighters[netaDefSlot];
      const netaDim = this.netaSuperVfx.update(
        dt,
        this.elapsed,
        netaSuper,
        netaFighter?.x ?? 0,
        netaFighter?.y ?? 0,
        netaFighter?.facing ?? 1,
        netaDef?.x ?? 2,
        this.graphics === 'low',
      );

      const andaSuper = this.matchState.andaSuper;
      const andaSlot = andaSuper?.attackerSlot ?? 0;
      const andaDefSlot = andaSuper?.defenderSlot ?? 1;
      const andaFighter = this.matchState.fighters[andaSlot];
      const andaDef = this.matchState.fighters[andaDefSlot];
      const andaVfxResult = this.andaSuperVfx.update(
        dt,
        this.elapsed,
        andaSuper,
        andaFighter?.x ?? 0,
        andaDef?.x ?? 2,
      );

      const mausiSuper = this.matchState.mausiSuper;
      const mausiSlot = mausiSuper?.attackerSlot ?? 0;
      const mausiDefSlot = mausiSuper?.defenderSlot ?? 1;
      const mausiRig = mausiSuper?.active ? this.rigs[mausiSlot] : null;
      const mausiFighter = this.matchState.fighters[mausiSlot];
      const mausiDef = this.matchState.fighters[mausiDefSlot];
      if (mausiRig) {
        mausiRig.root.updateMatrixWorld(true);
      }
      const mausiDim = this.mausiSuperVfx.update(
        dt,
        this.elapsed,
        mausiSuper,
        mausiRig,
        mausiFighter?.x ?? 0,
        mausiFighter?.y ?? 0,
        mausiFighter?.facing ?? 1,
        mausiDef?.x ?? 2,
      );

      const fatherSuper = this.matchState.fatherSuper;
      const fatherSlot = fatherSuper?.attackerSlot ?? 0;
      const fatherDefSlot = fatherSuper?.defenderSlot ?? 1;
      const fatherFighter = this.matchState.fighters[fatherSlot];
      const fatherDef = this.matchState.fighters[fatherDefSlot];
      const fatherDim = this.fatherSuperVfx.update(
        dt,
        this.elapsed,
        fatherSuper,
        fatherFighter?.x ?? 0,
        fatherFighter?.y ?? 0,
        fatherFighter?.facing ?? 1,
        fatherDef?.x ?? 2,
      );

      const samyakSuper = this.matchState.samyakSuper;
      const samyakSlot = samyakSuper?.attackerSlot ?? 0;
      const samyakDefSlot = samyakSuper?.defenderSlot ?? 1;
      const samyakFighter = this.matchState.fighters[samyakSlot];
      const samyakDef = this.matchState.fighters[samyakDefSlot];
      const samyakDim = this.samyakSuperVfx.update(
        dt,
        this.elapsed,
        samyakSuper,
        samyakFighter?.x ?? 0,
        samyakFighter?.y ?? 0,
        samyakFighter?.facing ?? 1,
        samyakDef?.x ?? 2,
      );

      const adiSuper = this.matchState.adiSuper;
      const adiSlot = adiSuper?.attackerSlot ?? 0;
      const adiDefSlot = adiSuper?.defenderSlot ?? 1;
      const adiFighter = this.matchState.fighters[adiSlot];
      const adiDef = this.matchState.fighters[adiDefSlot];
      const adiDim = this.adiSuperVfx.update(
        dt,
        this.elapsed,
        adiSuper,
        adiFighter?.x ?? 0,
        adiFighter?.y ?? 0,
        adiFighter?.facing ?? 1,
        adiDef?.x ?? 2,
      );

      const dimFactor = Math.max(
        sheruDim,
        billaDim,
        netaDim,
        andaVfxResult.dimFactor,
        mausiDim,
        fatherDim,
        samyakDim,
        adiDim,
      );
      if (this.stage) {
        const lightningFlash = andaVfxResult.skyFlash;
        const dimTargetColor =
          andaVfxResult.dimFactor > 0.01
            ? _andaStormDimColor
            : adiDim > 0.01
              ? _adiOliveGoldDimColor
              : samyakDim > 0.01
                ? _samyakBlueGoldDimColor
                : fatherDim > 0.01
                  ? _fatherCrimsonDimColor
                  : mausiDim > 0.01
                    ? _mausiFestiveDimColor
                    : _superDimColor;

        this.keyLight.intensity =
          this.stage.keyLightIntensity * (1 - dimFactor * 0.82) + lightningFlash * 2.4;
        this.hemiLight.intensity =
          this.stage.hemiIntensity * 0.92 * (1 - dimFactor * 0.78) + lightningFlash * 1.1;
        this.rimLight.intensity =
          Math.max(1.35, this.stage.rimLightIntensity * 1.15) * (1 - dimFactor * 0.65);
        this.scene.environmentIntensity = 1 - dimFactor * 0.78;
        this.renderer.toneMappingExposure = 1.05 * (1 - dimFactor * 0.18 + lightningFlash * 0.25);

        _stageBgColor.setHex(this.stage.backgroundColor).lerp(dimTargetColor, dimFactor * 0.84);
        if (lightningFlash > 0.01) {
          _stageBgColor.lerp(_andaFlashColor, Math.min(0.76, lightningFlash * 0.76));
        }
        if (this.scene.background instanceof THREE.Color) {
          this.scene.background.copy(_stageBgColor);
        }
        if (this.scene.fog instanceof THREE.Fog) {
          _stageFogColor.setHex(this.stage.fogColor).lerp(dimTargetColor, dimFactor * 0.84);
          if (lightningFlash > 0.01) {
            _stageFogColor.lerp(_andaFlashColor, Math.min(0.68, lightningFlash * 0.68));
          }
          this.scene.fog.color.copy(_stageFogColor);
        }
      }

      this.syncProjectiles();
      this.updateParticles(dt);
      if (this.currentScreen !== 'playing' && this.currentScreen !== 'super_preview') {
        this.updateCamera(dt);
      }
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
    audioEngine.stopDahiKoAudio();
    this.sheruSuperVfx.dispose(this.scene);
    this.billaSuperVfx.dispose(this.scene);
    this.netaSuperVfx.dispose(this.scene);
    this.andaSuperVfx.dispose(this.scene);
    this.mausiSuperVfx.dispose(this.scene);
    this.fatherSuperVfx.dispose(this.scene);
    this.samyakSuperVfx.dispose(this.scene);
    this.adiSuperVfx.dispose(this.scene);
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
    this.diaryNoteTex.dispose();
    this.diaryNoteGeo.dispose();
    this.diaryNoteMat.dispose();
    this.polityBookTex.dispose();
    this.polityBookGeo.dispose();
    this.polityBookCoverMat.dispose();
    this.polityBookSpineMat.dispose();
    this.polityBookPageMat.dispose();
    this.adiNotebookTex.dispose();
    this.adiNotebookGeo.dispose();
    this.adiNotebookCoverMat.dispose();
    this.adiNotebookSpineMat.dispose();
    this.adiNotebookPageMat.dispose();
    this.pmremTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
