import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const FATHER_GLB_HEAD_URL = '/models/father_head.glb';
export const SAMYAK_GLB_HEAD_URL = '/models/samyak_head.glb';

/**
 * Easy one-line tweak constants for aligning Principal Man's TRELLIS GLB head
 * inside his existing headGroup (orientation, neck seating height, Z alignment, scale).
 */
export const FATHER_GLB_HEAD_CONFIG = {
  scaleMultiplier: 1.0,
  offsetY: 0.0,
  offsetZ: 0.0,
  rotationY: 0,
};

/**
 * Easy one-line tweak constants for aligning Samyak's TRELLIS GLB head
 * inside his existing headGroup (orientation, neck seating height, Z alignment, scale).
 */
export const SAMYAK_GLB_HEAD_CONFIG = {
  scaleMultiplier: 1.0,
  offsetY: 0.0,
  offsetZ: 0.0,
  rotationY: 0,
};

export interface GlbHeadConfig {
  scaleMultiplier: number;
  offsetY: number;
  offsetZ: number;
  rotationY: number;
}

export type FatherGlbHeadConfig = GlbHeadConfig;
export type SamyakGlbHeadConfig = GlbHeadConfig;

/**
 * Target local head height inside Principal Man's `rig.head` (which has `scale = 1.42`).
 * Matches his FightKaro-style readable ~1.42x head height (~0.49 world units tall).
 */
export const FATHER_TARGET_HEAD_HEIGHT = 0.345;

/**
 * Bottom-neck pivot Y in `rig.head` local space seating cleanly onto his white clerical collar
 * (`whiteCollar` top is at local y ≈ -0.128 inside `rig.head`).
 */
export const FATHER_COLLAR_PIVOT_Y = -0.145;

/**
 * Target local head height inside Samyak's `rig.head` (which has `scale = 1.42`).
 * Matches Principal Man's FightKaro-style readable ~1.42x head proportion (~0.49 world units tall).
 */
export const SAMYAK_TARGET_HEAD_HEIGHT = 0.345;

/**
 * Bottom-neck pivot Y in `rig.head` local space seating cleanly onto Samyak's muscular neck & traps
 * (`neck` spans torso y ∈ [0.632, 0.788], so local y = -0.145 seats at torso y ≈ 0.699 with zero gap).
 */
export const SAMYAK_NECK_PIVOT_Y = -0.145;

interface GlbHeadCache {
  status: 'idle' | 'loading' | 'loaded' | 'failed';
  templateScene: THREE.Group | null;
  listeners: Set<(template: THREE.Group) => void>;
}

function createGlbHeadCache(): GlbHeadCache {
  return {
    status: 'idle',
    templateScene: null,
    listeners: new Set(),
  };
}

const fatherGlbCache: GlbHeadCache = createGlbHeadCache();
const samyakGlbCache: GlbHeadCache = createGlbHeadCache();

let sharedGltfLoader: GLTFLoader | null = null;

/**
 * Removes embedded KHR_lights_punctual / Camera nodes from exported GLB scenes
 * so they never pollute or blow out the stage lighting or duplicate lights in mirror matches.
 */
export function stripEmbeddedLightsAndCameras(root: THREE.Object3D): void {
  const toRemove: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (obj === root) return;
    if ((obj as THREE.Light).isLight || (obj as THREE.Camera).isCamera) {
      toRemove.push(obj);
    }
  });
  for (const node of toRemove) {
    node.parent?.remove(node);
  }
}

function buildFittedGlbHead(
  templateScene: THREE.Object3D,
  config: GlbHeadConfig,
  flashMaterials: THREE.MeshStandardMaterial[] | undefined,
  targetHeight: number,
  neckPivotY: number,
  namePrefix: string,
): THREE.Group {
  const cloned = templateScene.clone(true);
  stripEmbeddedLightsAndCameras(cloned);

  // Measure raw unrotated bounding box of the cloned GLB scene
  cloned.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(cloned);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const safeHeight = size.y > 1e-4 ? size.y : 1;
  const normScale = (targetHeight / safeHeight) * config.scaleMultiplier;

  // Inner group centers X/Z and places bottom-neck (`box.min.y`) cleanly at local Y = 0
  const alignGroup = new THREE.Group();
  alignGroup.name = `${namePrefix}_glb_head_aligned`;
  cloned.scale.multiplyScalar(normScale);
  cloned.position.set(
    cloned.position.x * normScale - center.x * normScale,
    cloned.position.y * normScale - box.min.y * normScale,
    cloned.position.z * normScale - center.z * normScale,
  );
  alignGroup.add(cloned);

  // Calibrate PBR materials & shadows on every child mesh
  cloned.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.userData.sharedGeometry = true;

    const tuneMaterial = (srcMat: THREE.Material): THREE.Material => {
      const mat = srcMat.clone();
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) {
        std.map.colorSpace = THREE.SRGBColorSpace;
        std.map.needsUpdate = true;
      }
      if (typeof std.roughness === 'number') {
        std.roughness = 0.72;
      }
      if (typeof std.metalness === 'number') {
        std.metalness = 0.0;
      }
      if ('envMapIntensity' in std) {
        std.envMapIntensity = 0.22;
      }
      if (std.emissive && std.emissive.isColor) {
        std.emissive.setHex(0xffffff);
        if (std.map) {
          std.emissiveMap = std.map;
        }
        std.emissiveIntensity = 0.08;
        std.userData.baseEmissiveIntensity = 0.08;
        if (flashMaterials) {
          flashMaterials.push(std);
        }
      }
      std.needsUpdate = true;
      return mat;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(tuneMaterial);
    } else if (mesh.material) {
      mesh.material = tuneMaterial(mesh.material);
    }
  });

  // Outer pivot sits on the neck/collar and applies orientation + easy offsets
  const outerPivot = new THREE.Group();
  outerPivot.name = `${namePrefix}_glb_head_pivot`;
  outerPivot.position.set(0, neckPivotY + config.offsetY, config.offsetZ);
  outerPivot.rotation.y = config.rotationY;
  outerPivot.add(alignGroup);
  outerPivot.updateMatrixWorld(true);

  return outerPivot;
}

function preloadCachedGlbHead(
  url: string,
  cache: GlbHeadCache,
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
): void {
  if (typeof window === 'undefined' && !loaderFactory) return;
  if (cache.status !== 'idle') return;

  cache.status = 'loading';
  const loader = loaderFactory
    ? loaderFactory()
    : (sharedGltfLoader ?? (sharedGltfLoader = new GLTFLoader()));

  try {
    loader.load(
      url,
      (gltf) => {
        if (!gltf || !gltf.scene) {
          cache.status = 'failed';
          cache.listeners.clear();
          return;
        }
        stripEmbeddedLightsAndCameras(gltf.scene);
        cache.templateScene = gltf.scene;
        cache.status = 'loaded';
        for (const listener of cache.listeners) {
          listener(gltf.scene);
        }
        cache.listeners.clear();
      },
      undefined,
      () => {
        // Silent graceful fallback to existing hemisphere head with zero crash
        cache.status = 'failed';
        cache.listeners.clear();
      },
    );
  } catch {
    cache.status = 'failed';
    cache.listeners.clear();
  }
}

/**
 * Clones and normalizes Principal Man's loaded GLB head scene.
 */
export function buildFittedFatherGlbHead(
  templateScene: THREE.Object3D,
  config: FatherGlbHeadConfig = FATHER_GLB_HEAD_CONFIG,
  flashMaterials?: THREE.MeshStandardMaterial[],
  targetHeight = FATHER_TARGET_HEAD_HEIGHT,
  collarPivotY = FATHER_COLLAR_PIVOT_Y,
): THREE.Group {
  return buildFittedGlbHead(
    templateScene,
    config,
    flashMaterials,
    targetHeight,
    collarPivotY,
    'father',
  );
}

/**
 * Clones and normalizes Samyak's loaded GLB head scene:
 * 1. Strips embedded lights/cameras.
 * 2. Computes bounding box (`Box3.setFromObject`), normalizes uniform scale so height matches
 *    FightKaro-style ~1.42x head proportion (`targetHeight * config.scaleMultiplier`).
 * 3. Centers horizontally on X & Z and seats bottom-neck pivot onto `neckPivotY + config.offsetY`.
 * 4. Calibrates PBR materials (`SRGBColorSpace`, `roughness: 0.72`, `metalness: 0.0`).
 */
export function buildFittedSamyakGlbHead(
  templateScene: THREE.Object3D,
  config: SamyakGlbHeadConfig = SAMYAK_GLB_HEAD_CONFIG,
  flashMaterials?: THREE.MeshStandardMaterial[],
  targetHeight = SAMYAK_TARGET_HEAD_HEIGHT,
  neckPivotY = SAMYAK_NECK_PIVOT_Y,
): THREE.Group {
  return buildFittedGlbHead(
    templateScene,
    config,
    flashMaterials,
    targetHeight,
    neckPivotY,
    'samyak',
  );
}

/**
 * Preloads and caches `/models/father_head.glb` ONCE at module level via `GLTFLoader`.
 */
export function preloadFatherGlbHead(
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
): void {
  preloadCachedGlbHead(FATHER_GLB_HEAD_URL, fatherGlbCache, loaderFactory);
}

/**
 * Preloads and caches `/models/samyak_head.glb` ONCE at module level via `GLTFLoader`.
 * Safe to call repeatedly — deduplicates fetches across mirror matches, rematches, Friend Room, and Super Lab.
 */
export function preloadSamyakGlbHead(
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
): void {
  preloadCachedGlbHead(SAMYAK_GLB_HEAD_URL, samyakGlbCache, loaderFactory);
}

/**
 * Attaches a cloned, normalized `/models/father_head.glb` head into Principal Man's
 * existing `headGroup` while keeping `fallbackHeadGroup` visible during loading (or permanently
 * if the GLB fails to load).
 */
export function attachFatherGlbHead(
  headGroup: THREE.Group,
  fallbackHeadGroup: THREE.Group,
  flashMaterials: THREE.MeshStandardMaterial[],
  isDisposed: () => boolean,
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
): void {
  fallbackHeadGroup.visible = true;
  preloadFatherGlbHead(loaderFactory);

  const mountClonedHead = (template: THREE.Group) => {
    if (isDisposed()) return;
    const fitted = buildFittedFatherGlbHead(
      template,
      FATHER_GLB_HEAD_CONFIG,
      flashMaterials,
    );
    headGroup.add(fitted);
    fallbackHeadGroup.visible = false;
  };

  if (fatherGlbCache.status === 'loaded' && fatherGlbCache.templateScene) {
    mountClonedHead(fatherGlbCache.templateScene);
    return;
  }

  if (fatherGlbCache.status === 'failed') {
    fallbackHeadGroup.visible = true;
    return;
  }

  fatherGlbCache.listeners.add(mountClonedHead);
}

/**
 * Attaches a cloned, normalized `/models/samyak_head.glb` head into Samyak's
 * existing `headGroup` while keeping `fallbackHeadGroup` visible during loading (or permanently
 * if the GLB fails to load).
 */
export function attachSamyakGlbHead(
  headGroup: THREE.Group,
  fallbackHeadGroup: THREE.Group,
  flashMaterials: THREE.MeshStandardMaterial[],
  isDisposed: () => boolean,
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
): void {
  fallbackHeadGroup.visible = true;
  preloadSamyakGlbHead(loaderFactory);

  const mountClonedHead = (template: THREE.Group) => {
    if (isDisposed()) return;
    const fitted = buildFittedSamyakGlbHead(
      template,
      SAMYAK_GLB_HEAD_CONFIG,
      flashMaterials,
    );
    headGroup.add(fitted);
    fallbackHeadGroup.visible = false;
  };

  if (samyakGlbCache.status === 'loaded' && samyakGlbCache.templateScene) {
    mountClonedHead(samyakGlbCache.templateScene);
    return;
  }

  if (samyakGlbCache.status === 'failed') {
    fallbackHeadGroup.visible = true;
    return;
  }

  samyakGlbCache.listeners.add(mountClonedHead);
}

export function getFatherGlbHeadStatus(): GlbHeadCache['status'] {
  return fatherGlbCache.status;
}

export function getSamyakGlbHeadStatus(): GlbHeadCache['status'] {
  return samyakGlbCache.status;
}

export function clearFatherGlbHeadCacheForTests(): void {
  fatherGlbCache.status = 'idle';
  fatherGlbCache.templateScene = null;
  fatherGlbCache.listeners.clear();
}

export function clearSamyakGlbHeadCacheForTests(): void {
  samyakGlbCache.status = 'idle';
  samyakGlbCache.templateScene = null;
  samyakGlbCache.listeners.clear();
}
