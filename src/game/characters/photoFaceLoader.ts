import * as THREE from 'three';
import type { FighterId } from '../types';

export type PhotoFaceFighterId = 'father' | 'samyak' | 'adi' | 'krish' | 'utkarsh';

export const REAL_FACE_PHOTO_URLS: Record<PhotoFaceFighterId, string> = {
  father: '/textures/faces/principal_man.png',
  samyak: '/textures/faces/samyak.png',
  adi: '/textures/faces/adi.png',
  krish: '/textures/faces/krish.png',
  utkarsh: '/textures/faces/utkarsh.png',
};

/** Natural oval head proportions for the D-shaped hemisphere + flat front face plate */
export const PHOTO_HEAD_OVAL_SCALE = {
  x: 1.0,
  y: 1.12,
  z: 0.92,
} as const;

/** Forward Z offset for the flat oval face plate capping the hemisphere rim */
export const PHOTO_FACE_PLATE_Z = 0.008;

/** Grounded dark-hair PBR color for the 3D back head hemisphere */
export const PHOTO_BACK_DOME_COLOR = 0x1e1e22;

export interface PhotoFaceCropSpec {
  /** Normalized left edge of tight face crop (0..1) */
  sx: number;
  /** Normalized top edge of tight face crop (0..1) */
  sy: number;
  /** Normalized width of tight face crop (0..1) */
  sw: number;
  /** Normalized height of tight face crop (0..1) */
  sh: number;
  /** Matching 3D skin hex for lower neck/ear rim grounding */
  skinHex: number;
}

/**
 * Tight, well-centered face crops (~1.30x+ zoom on face/eyes) removing light-grey studio margins,
 * empty borders, and lower collar/shirt regions so each PNG fills the flat oval CircleGeometry
 * edge-to-edge cleanly with just the character's face and hair.
 */
export const PHOTO_FACE_CROP_SPECS: Record<PhotoFaceFighterId, PhotoFaceCropSpec> = {
  father: {
    sx: 0.105,
    sy: 0.085,
    sw: 0.79,
    sh: 0.835,
    skinHex: 0xb67a54,
  },
  samyak: {
    sx: 0.21,
    sy: 0.135,
    sw: 0.58,
    sh: 0.745,
    skinHex: 0xa67452,
  },
  adi: {
    sx: 0.14,
    sy: 0.08,
    sw: 0.72,
    sh: 0.80,
    skinHex: 0xc28a64,
  },
  krish: {
    sx: 0.14,
    sy: 0.08,
    sw: 0.72,
    sh: 0.80,
    skinHex: 0xbc8662,
  },
  utkarsh: {
    sx: 0.14,
    sy: 0.08,
    sw: 0.72,
    sh: 0.80,
    skinHex: 0xc5906a,
  },
};

export function getPhotoFaceCropRect(
  id: PhotoFaceFighterId,
  srcW: number,
  srcH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const spec = PHOTO_FACE_CROP_SPECS[id];
  return {
    sx: Math.round(srcW * spec.sx),
    sy: Math.round(srcH * spec.sy),
    sw: Math.max(1, Math.round(srcW * spec.sw)),
    sh: Math.max(1, Math.round(srcH * spec.sh)),
  };
}

/**
 * Builds the 3D back-of-head semi-sphere (`SphereGeometry(r, 24, 16, 0, 2π, 0, π/2)`)
 * rotated so its rounded dome faces backward along `-Z` and its flat circular rim
 * lies in the `Z = 0` plane facing forward along `+Z`.
 * Scaling the resulting mesh by `(1.0, 1.12, 0.92)` produces a clean oval D-shaped head.
 */
export function createBackHeadHemisphereGeometry(radius: number): THREE.SphereGeometry {
  const geo = new THREE.SphereGeometry(radius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Builds the matching flat circular face plate (`CircleGeometry(r, 32)`) facing `+Z`
 * with zero spherical distortion. Scaled identically `(1.0, 1.12, 1.0)` and placed at `z = 0.008`.
 */
export function createFlatOvalFacePlateGeometry(radius: number): THREE.CircleGeometry {
  return new THREE.CircleGeometry(radius, 32);
}

/**
 * Computes local `head.rotation.y` for photo-mapped fighters so their flat front face stays
 * angled ~25°–35° toward the front camera (`+Z`) during Character Select and 2.5D combat
 * (classic 3/4 arcade readability) without overriding front-facing flex/victory poses.
 */
export function computePhotoHeadLocalYaw(
  facing: 1 | -1,
  bodyYaw: number,
  pelvisRotY: number,
  torsoRotY: number,
  animHeadRotY: number,
): number {
  const parentYaw = bodyYaw + pelvisRotY + torsoRotY;
  const rawWorldYaw = parentYaw + animHeadRotY;
  // Classic 3/4 arcade target: ~44°–48° from +Z (~30° more toward camera than the 75.6° body yaw)
  const preferredWorldAbs = 0.74;
  const maxWorldAbs = 0.94; // Never more side-on than ~54° from +Z (~36° toward camera from profile)

  if (facing === 1) {
    if (rawWorldYaw <= preferredWorldAbs) {
      return animHeadRotY;
    }
    const desiredWorld = Math.min(
      maxWorldAbs,
      preferredWorldAbs + (rawWorldYaw - preferredWorldAbs) * 0.16,
    );
    return desiredWorld - parentYaw;
  }

  if (rawWorldYaw >= -preferredWorldAbs) {
    return animHeadRotY;
  }
  const desiredWorld = Math.max(
    -maxWorldAbs,
    -preferredWorldAbs + (rawWorldYaw + preferredWorldAbs) * 0.16,
  );
  return desiredWorld - parentYaw;
}

interface CroppedFaceResult {
  texture: THREE.CanvasTexture;
}

interface CachedPhotoEntry {
  status: 'idle' | 'loading' | 'loaded' | 'missing';
  rawTexture: THREE.Texture | null;
  croppedTexture: THREE.CanvasTexture | null;
  listeners: Set<(result: CroppedFaceResult) => void>;
  waiters: Set<() => void>;
}

const cache: Record<PhotoFaceFighterId, CachedPhotoEntry> = {
  father: {
    status: 'idle',
    rawTexture: null,
    croppedTexture: null,
    listeners: new Set(),
    waiters: new Set(),
  },
  samyak: {
    status: 'idle',
    rawTexture: null,
    croppedTexture: null,
    listeners: new Set(),
    waiters: new Set(),
  },
  adi: {
    status: 'idle',
    rawTexture: null,
    croppedTexture: null,
    listeners: new Set(),
    waiters: new Set(),
  },
  krish: {
    status: 'idle',
    rawTexture: null,
    croppedTexture: null,
    listeners: new Set(),
    waiters: new Set(),
  },
  utkarsh: {
    status: 'idle',
    rawTexture: null,
    croppedTexture: null,
    listeners: new Set(),
    waiters: new Set(),
  },
};

const failedPortraitUrls = new Set<string>();
let sharedTextureLoader: THREE.TextureLoader | null = null;

export function isPhotoFaceFighter(id: FighterId): id is PhotoFaceFighterId {
  return id === 'father' || id === 'samyak' || id === 'adi' || id === 'krish' || id === 'utkarsh';
}

export function getRealFacePhotoUrl(id: FighterId): string | null {
  if (!isPhotoFaceFighter(id)) return null;
  return REAL_FACE_PHOTO_URLS[id];
}

export function hasPortraitPhotoFailed(url: string): boolean {
  return failedPortraitUrls.has(url);
}

export function markPortraitPhotoFailed(url: string): void {
  failedPortraitUrls.add(url);
}

/**
 * Draws the loaded real face PNG onto a cached 512x512 offscreen Canvas with:
 * 1. Tight, centered face crop (~1.30x+ zoom on face/eyes) trimming away grey margins & collars.
 * 2. Subtle 2–3px soft alpha edge blend along the outermost circular perimeter so the flat face
 *    plate joins seamlessly with the dark-hair 3D hemisphere behind it.
 */
function buildCroppedFacePlateTexture(
  id: PhotoFaceFighterId,
  img: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number },
): CroppedFaceResult | null {
  if (typeof document === 'undefined') return null;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const srcW = Number(img.naturalWidth || img.width || size);
  const srcH = Number(img.naturalHeight || img.height || size);
  if (srcW <= 0 || srcH <= 0) return null;

  const crop = getPhotoFaceCropRect(id, srcW, srcH);

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size, size);

  // Subtle ~2-3px soft outer rim blend at the perimeter of the flat CircleGeometry
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const half = size * 0.5;
  const rimGrad = ctx.createRadialGradient(half, half, half * 0.945, half, half, half);
  rimGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  rimGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.82)');
  rimGrad.addColorStop(0.88, 'rgba(255, 255, 255, 0.35)');
  rimGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return { texture };
}

function resolvePhotoWaiters(entry: CachedPhotoEntry): void {
  for (const waiter of entry.waiters) {
    waiter();
  }
  entry.waiters.clear();
}

function loadSinglePhotoFace(
  id: PhotoFaceFighterId,
  loaderFactory?: () => Pick<THREE.TextureLoader, 'load'>,
): Promise<void> {
  const entry = cache[id];
  if (entry.status === 'loaded' || entry.status === 'missing') {
    return Promise.resolve();
  }
  if ((typeof window === 'undefined' || typeof document === 'undefined') && !loaderFactory) {
    return Promise.resolve();
  }

  const completion = new Promise<void>((resolve) => {
    entry.waiters.add(resolve);
  });

  if (entry.status !== 'idle') return completion;

  entry.status = 'loading';
  const url = REAL_FACE_PHOTO_URLS[id];

  const loader = loaderFactory
    ? loaderFactory()
    : (sharedTextureLoader ?? (sharedTextureLoader = new THREE.TextureLoader()));

  try {
    loader.load(
      url,
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        entry.rawTexture = loadedTex;
        const built = buildCroppedFacePlateTexture(id, loadedTex.image);
        if (!built) {
          entry.status = 'missing';
          failedPortraitUrls.add(url);
          resolvePhotoWaiters(entry);
          return;
        }
        entry.croppedTexture = built.texture;
        entry.status = 'loaded';
        for (const listener of entry.listeners) {
          listener(built);
        }
        entry.listeners.clear();
        resolvePhotoWaiters(entry);
      },
      undefined,
      () => {
        // Missing photo file -> silent graceful fallback to procedural Canvas face & portrait
        entry.status = 'missing';
        failedPortraitUrls.add(url);
        entry.listeners.clear();
        resolvePhotoWaiters(entry);
      },
    );
  } catch {
    entry.status = 'missing';
    failedPortraitUrls.add(url);
    entry.listeners.clear();
    resolvePhotoWaiters(entry);
  }

  return completion;
}

/**
 * Preloads and caches cropped 512x512 flat-face CanvasTextures once on load
 * so mobile browsers stay locked at smooth 60 FPS.
 */
export function preloadRealFaceTextures(
  loaderFactory?: () => Pick<THREE.TextureLoader, 'load'>,
): Promise<void> {
  return Promise.all([
    loadSinglePhotoFace('father', loaderFactory),
    loadSinglePhotoFace('samyak', loaderFactory),
    loadSinglePhotoFace('adi', loaderFactory),
    loadSinglePhotoFace('krish', loaderFactory),
    loadSinglePhotoFace('utkarsh', loaderFactory),
  ]).then(() => undefined);
}

/**
 * Subscribes a flat oval front-face plate material to receive the tightly cropped
 * 512x512 CanvasTexture (cached once on load) with SRGBColorSpace and emissiveMap readability.
 */
export function bindRealPhotoFacePlate(
  id: PhotoFaceFighterId,
  facePlateMat: THREE.MeshStandardMaterial,
): void {
  loadSinglePhotoFace(id);
  const entry = cache[id];

  const applyResult = (res: CroppedFaceResult) => {
    facePlateMat.map = res.texture;
    facePlateMat.emissiveMap = res.texture;
    facePlateMat.needsUpdate = true;
  };

  if (entry.status === 'loaded' && entry.croppedTexture) {
    applyResult({ texture: entry.croppedTexture });
    return;
  }

  if (entry.status === 'missing') {
    return;
  }

  entry.listeners.add(applyResult);
}
