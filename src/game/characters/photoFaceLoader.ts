import * as THREE from 'three';
import type { FighterId } from '../types';

export type PhotoFaceFighterId = 'father' | 'samyak';

export const REAL_FACE_PHOTO_URLS: Record<PhotoFaceFighterId, string> = {
  father: '/textures/faces/father.png',
  samyak: '/textures/faces/samyak.png',
};

interface CachedPhotoEntry {
  status: 'idle' | 'loading' | 'loaded' | 'missing';
  rawTexture: THREE.Texture | null;
  featheredTexture: THREE.CanvasTexture | null;
  listeners: Set<(tex: THREE.CanvasTexture) => void>;
}

const cache: Record<PhotoFaceFighterId, CachedPhotoEntry> = {
  father: {
    status: 'idle',
    rawTexture: null,
    featheredTexture: null,
    listeners: new Set(),
  },
  samyak: {
    status: 'idle',
    rawTexture: null,
    featheredTexture: null,
    listeners: new Set(),
  },
};

const failedPortraitUrls = new Set<string>();
let sharedTextureLoader: THREE.TextureLoader | null = null;

export function isPhotoFaceFighter(id: FighterId): id is PhotoFaceFighterId {
  return id === 'father' || id === 'samyak';
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
 * Generates an offscreen Canvas texture from a loaded real face photo with a smooth
 * elliptical radial alpha feather mask so photo edges melt seamlessly into the 3D
 * head skin tone and sculpted 3D hair with zero harsh square borders.
 */
function buildFeatheredFaceTexture(
  img: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number },
): THREE.CanvasTexture | null {
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

  // Center-crop slightly higher (portrait head framing) so eyes, nose, mouth, and beard align naturally
  const cropSide = Math.min(srcW, srcH);
  const sx = (srcW - cropSide) * 0.5;
  const sy = Math.max(0, (srcH - cropSide) * 0.22);

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, size, size);

  // Soft elliptical radial alpha mask (crisp opaque core over facial features, smooth feather into 3D skin/hair)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(size * 0.5, size * 0.52);
  ctx.scale(0.84, 1.0);
  const maskGrad = ctx.createRadialGradient(0, 0, size * 0.18, 0, 0, size * 0.47);
  maskGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  maskGrad.addColorStop(0.64, 'rgba(255, 255, 255, 0.98)');
  maskGrad.addColorStop(0.82, 'rgba(255, 255, 255, 0.52)');
  maskGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = maskGrad;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const feathered = new THREE.CanvasTexture(canvas);
  feathered.colorSpace = THREE.SRGBColorSpace;
  feathered.anisotropy = 4;
  feathered.needsUpdate = true;
  return feathered;
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
      const feathered = buildFeatheredFaceTexture(loadedTex.image);
      if (!feathered) {
        entry.status = 'missing';
        failedPortraitUrls.add(url);
        return;
      }
      entry.featheredTexture = feathered;
      entry.status = 'loaded';
      for (const listener of entry.listeners) {
        listener(feathered);
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
}

/**
 * Subscribes a curved 3D front-face photo shell mesh to receive the feathered real-photo
 * CanvasTexture as soon as loaded (immediately if already cached). If the photo loads,
 * hides optional fallback 3D nose meshes so they never clip through the mapped photo.
 */
export function bindRealPhotoFaceShell(
  id: PhotoFaceFighterId,
  shellMesh: THREE.Mesh,
  shellMat: THREE.MeshStandardMaterial,
  hideOnPhotoLoaded?: THREE.Object3D[],
): void {
  loadSinglePhotoFace(id);
  const entry = cache[id];

  const applyTexture = (tex: THREE.CanvasTexture) => {
    shellMat.map = tex;
    shellMat.needsUpdate = true;
    shellMesh.visible = true;
    if (hideOnPhotoLoaded) {
      for (const obj of hideOnPhotoLoaded) {
        obj.visible = false;
      }
    }
  };

  if (entry.status === 'loaded' && entry.featheredTexture) {
    applyTexture(entry.featheredTexture);
    return;
  }

  if (entry.status === 'missing') {
    shellMesh.visible = false;
    return;
  }

  entry.listeners.add(applyTexture);
}
