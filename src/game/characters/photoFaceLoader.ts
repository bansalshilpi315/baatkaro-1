import * as THREE from 'three';
import type { FighterId } from '../types';

export type PhotoFaceFighterId = 'father' | 'samyak' | 'principal';

export const REAL_FACE_PHOTO_URLS: Record<PhotoFaceFighterId, string> = {
  father: '/textures/faces/father.png',
  samyak: '/textures/faces/samyak.png',
  principal: '/textures/faces/principal_man.png',
};

export interface PhotoFaceCropSpec {
  /** Normalized left edge of tight face crop (0..1) */
  sx: number;
  /** Normalized top edge of tight face crop (0..1) */
  sy: number;
  /** Normalized width of tight face crop (0..1) */
  sw: number;
  /** Normalized height of tight face crop (0..1) */
  sh: number;
  /** Matching 3D skin hex to seamlessly blend outer feathered edges */
  skinHex: number;
}

/**
 * Tight crown-to-chin & cheek-to-cheek face crop rects trimming away grey studio margins & collar
 * so the real face spans the full ~194-degree front-projected 3D head shell with 1:1 likeness.
 */
export const PHOTO_FACE_CROP_SPECS: Record<PhotoFaceFighterId, PhotoFaceCropSpec> = {
  father: {
    sx: 0.215,
    sy: 0.055,
    sw: 0.57,
    sh: 0.84,
    skinHex: 0xa87654,
  },
  samyak: {
    sx: 0.205,
    sy: 0.075,
    sw: 0.59,
    sh: 0.855,
    skinHex: 0xa67452,
  },
  principal: {
    sx: 0.245,
    sy: 0.065,
    sw: 0.51,
    sh: 0.75,
    skinHex: 0xb67a54,
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
 * Builds a ~194-degree cheek-to-cheek, crown-to-chin curved front-face sphere shell
 * along local +Z using orthographic front-projection UVs (`u = 0.5 + px*0.5`, `v = 0.5 + py*0.5`).
 * Eliminates equirectangular horizontal stretching so eyes, sunglasses, nose, mouth, and beard
 * preserve exact 1:1 likeness from the real photo across both front and 3/4 combat angles.
 */
export function createFrontProjectedFaceShellGeometry(radius: number): THREE.SphereGeometry {
  const geo = new THREE.SphereGeometry(
    radius,
    36,
    28,
    -Math.PI * 0.04,
    Math.PI * 1.08,
    Math.PI * 0.04,
    Math.PI * 0.92,
  );
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) / radius;
    const py = pos.getY(i) / radius;
    const pz = pos.getZ(i) / radius;
    let ux = px;
    let uy = py;
    if (pz < 0) {
      const len = Math.hypot(ux, uy) || 1;
      const push = Math.min(1.04, 1.0 + (-pz) * 0.45);
      ux = (ux / len) * push;
      uy = (uy / len) * push;
    }
    const u = THREE.MathUtils.clamp(0.5 + ux * 0.5, 0.002, 0.998);
    const v = THREE.MathUtils.clamp(0.5 + uy * 0.5, 0.002, 0.998);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

interface FeatheredFaceResult {
  texture: THREE.CanvasTexture;
  sampledSkinHex: number;
}

interface CachedPhotoEntry {
  status: 'idle' | 'loading' | 'loaded' | 'missing';
  rawTexture: THREE.Texture | null;
  featheredTexture: THREE.CanvasTexture | null;
  sampledSkinHex: number | null;
  listeners: Set<(result: FeatheredFaceResult) => void>;
}

const cache: Record<PhotoFaceFighterId, CachedPhotoEntry> = {
  father: {
    status: 'idle',
    rawTexture: null,
    featheredTexture: null,
    sampledSkinHex: null,
    listeners: new Set(),
  },
  samyak: {
    status: 'idle',
    rawTexture: null,
    featheredTexture: null,
    sampledSkinHex: null,
    listeners: new Set(),
  },
  principal: {
    status: 'idle',
    rawTexture: null,
    featheredTexture: null,
    sampledSkinHex: null,
    listeners: new Set(),
  },
};

const failedPortraitUrls = new Set<string>();
let sharedTextureLoader: THREE.TextureLoader | null = null;

export function isPhotoFaceFighter(id: FighterId): id is PhotoFaceFighterId {
  return id === 'father' || id === 'samyak' || id === 'principal';
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

function sampleCheekSkinHex(
  ctx: CanvasRenderingContext2D,
  size: number,
  fallbackHex: number,
): number {
  try {
    // Sample left & right cheek patches (below eyes/sunglasses, above jaw/beard line)
    const patches: Array<[number, number]> = [
      [Math.round(size * 0.24), Math.round(size * 0.58)],
      [Math.round(size * 0.72), Math.round(size * 0.58)],
    ];
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    const patchSize = 18;
    for (const [px, py] of patches) {
      const data = ctx.getImageData(px, py, patchSize, patchSize).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 200) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }
    }
    if (count === 0) return fallbackHex;
    // Slight 0.86 shading compensation matches front-lit photo cheeks to curved side-of-head lighting
    const avgR = Math.round((r / count) * 0.86);
    const avgG = Math.round((g / count) * 0.86);
    const avgB = Math.round((b / count) * 0.86);
    return (avgR << 16) | (avgG << 8) | avgB;
  } catch {
    return fallbackHex;
  }
}

/**
 * Generates an offscreen Canvas texture from a loaded real face photo:
 * 1. Tightly crops onto the crown-to-chin & cheek-to-cheek oval, trimming studio grey margins & collar.
 * 2. Samples the real cheek skin color so the 3D head base/sides match with zero visible color seam.
 * 3. Keeps 100% opaque coverage over forehead, eyes/sunglasses, cheeks, nose, lips & chin/beard,
 *    feathering softly ONLY along the outer hairline & behind-cheek perimeter.
 */
function buildFeatheredFaceTexture(
  id: PhotoFaceFighterId,
  img: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number },
): FeatheredFaceResult | null {
  if (typeof document === 'undefined') return null;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const srcW = Number(img.naturalWidth || img.width || size);
  const srcH = Number(img.naturalHeight || img.height || size);
  if (srcW <= 0 || srcH <= 0) return null;

  const crop = getPhotoFaceCropRect(id, srcW, srcH);

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size, size);

  const sampledSkinHex = sampleCheekSkinHex(ctx, size, PHOTO_FACE_CROP_SPECS[id].skinHex);

  // Full-face oval alpha feather mask:
  // 100% opaque across entire front face (forehead, eyes/sunglasses, cheeks, mouth & chin/beard);
  // smooth feather ONLY at the outermost hairline / behind-cheek perimeter so zero grey corners appear.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(size * 0.5, size * 0.5);
  ctx.scale(0.95, 0.99);
  const maskGrad = ctx.createRadialGradient(0, 0, size * 0.36, 0, 0, size * 0.5);
  maskGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  maskGrad.addColorStop(0.76, 'rgba(255, 255, 255, 1.0)');
  maskGrad.addColorStop(0.88, 'rgba(255, 255, 255, 0.76)');
  maskGrad.addColorStop(0.96, 'rgba(255, 255, 255, 0.16)');
  maskGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = maskGrad;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const feathered = new THREE.CanvasTexture(canvas);
  feathered.colorSpace = THREE.SRGBColorSpace;
  feathered.anisotropy = 4;
  feathered.needsUpdate = true;
  return { texture: feathered, sampledSkinHex };
}

function loadSinglePhotoFace(id: PhotoFaceFighterId): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const entry = cache[id];
  if (entry.status !== 'idle') return;

  entry.status = 'loading';
  const url = REAL_FACE_PHOTO_URLS[id];

  if (!sharedTextureLoader) {
    sharedTextureLoader = new THREE.TextureLoader();
  }

  sharedTextureLoader.load(
    url,
    (loadedTex) => {
      loadedTex.colorSpace = THREE.SRGBColorSpace;
      entry.rawTexture = loadedTex;
      const built = buildFeatheredFaceTexture(id, loadedTex.image);
      if (!built) {
        entry.status = 'missing';
        failedPortraitUrls.add(url);
        return;
      }
      entry.featheredTexture = built.texture;
      entry.sampledSkinHex = built.sampledSkinHex;
      entry.status = 'loaded';
      for (const listener of entry.listeners) {
        listener(built);
      }
      entry.listeners.clear();
    },
    undefined,
    () => {
      // Missing photo file -> silent graceful fallback to procedural Canvas face & portrait
      entry.status = 'missing';
      failedPortraitUrls.add(url);
      entry.listeners.clear();
    },
  );
}

/**
 * Preloads and caches real photo face textures once at startup via THREE.TextureLoader
 * with SRGBColorSpace and silent graceful fallback if a file is not yet placed.
 */
export function preloadRealFaceTextures(): void {
  loadSinglePhotoFace('father');
  loadSinglePhotoFace('samyak');
  loadSinglePhotoFace('principal');
}

/**
 * Subscribes a full-coverage curved 3D front-face photo shell mesh to receive the feathered
 * real-photo CanvasTexture as soon as loaded (immediately if already cached).
 * When the photo loads:
 * - Hides fallback procedural 3D nose/jaw/beard meshes so they never clip through the photo.
 * - Switches the underlying base head sphere material to the exact sampled photo skin tone
 *   so no procedural cartoon face features ghost behind the feathered edge.
 */
export function bindRealPhotoFaceShell(
  id: PhotoFaceFighterId,
  shellMesh: THREE.Mesh,
  shellMat: THREE.MeshStandardMaterial,
  hideOnPhotoLoaded?: THREE.Object3D[],
  baseHeadMat?: THREE.MeshStandardMaterial,
): void {
  loadSinglePhotoFace(id);
  const entry = cache[id];

  const applyResult = (res: FeatheredFaceResult) => {
    shellMat.map = res.texture;
    shellMat.needsUpdate = true;
    shellMesh.visible = true;
    if (baseHeadMat) {
      baseHeadMat.map = null;
      baseHeadMat.color.setHex(res.sampledSkinHex);
      baseHeadMat.needsUpdate = true;
    }
    if (hideOnPhotoLoaded) {
      for (const obj of hideOnPhotoLoaded) {
        obj.visible = false;
      }
    }
  };

  if (entry.status === 'loaded' && entry.featheredTexture && entry.sampledSkinHex !== null) {
    applyResult({
      texture: entry.featheredTexture,
      sampledSkinHex: entry.sampledSkinHex,
    });
    return;
  }

  if (entry.status === 'missing') {
    shellMesh.visible = false;
    return;
  }

  entry.listeners.add(applyResult);
}
