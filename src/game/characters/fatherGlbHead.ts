import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const FATHER_GLB_HEAD_URL = './models/father_head.glb';
export const SAMYAK_GLB_HEAD_URL = './models/samyak_head.glb';
export const ADI_GLB_HEAD_URL = './models/adi_head.glb';
export const KRISH_GLB_HEAD_URL = './models/krish_head.glb';
export const UTKARSH_GLB_HEAD_URL = './models/utkarsh_head.glb';

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

/**
 * Easy one-line tweak constants for aligning Adi's custom 3D `.glb` head
 * inside his animated `rig.head` (`headGroup`).
 */
export const ADI_GLB_HEAD_CONFIG = {
  scaleMultiplier: 1.0,
  offsetX: 0.0,
  offsetY: 0.0,
  offsetZ: 0.0,
  rotationY: 0,
};

/**
 * Easy one-line tweak constants for aligning Krish's custom 3D `.glb` head
 * inside his animated `rig.head` (`headGroup`).
 */
export const KRISH_GLB_HEAD_CONFIG = {
  scaleMultiplier: 1.0,
  offsetX: 0.0,
  offsetY: 0.0,
  offsetZ: 0.0,
  rotationY: 0,
};

/**
 * Easy one-line tweak constants for aligning Utkarsh's custom 3D `.glb` head
 * (which includes his sculpted 3D neck) inside his animated `rig.head` (`headGroup`).
 */
export const UTKARSH_GLB_HEAD_CONFIG = {
  scaleMultiplier: 1.0,
  offsetX: 0.0,
  offsetY: 0.0,
  offsetZ: 0.0,
  rotationY: 0,
};

export interface GlbHeadConfig {
  scaleMultiplier: number;
  offsetX?: number;
  offsetY: number;
  offsetZ: number;
  rotationY: number;
}

export interface AdiGlbHeadConfig {
  scaleMultiplier: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotationY: number;
}

export type FatherGlbHeadConfig = GlbHeadConfig;
export type SamyakGlbHeadConfig = GlbHeadConfig;
export type KrishGlbHeadConfig = AdiGlbHeadConfig;
export type UtkarshGlbHeadConfig = AdiGlbHeadConfig;

/**
 * Target local head height inside Principal Man's `rig.head` (which has `scale = 1.42`).
 * Matches his readable 3D arcade ~1.42x head height (~0.49 world units tall).
 */
export const FATHER_TARGET_HEAD_HEIGHT = 0.345;

/**
 * Bottom-neck pivot Y in `rig.head` local space seating cleanly onto his white clerical collar
 * (`whiteCollar` top is at local y ≈ -0.128 inside `rig.head`).
 */
export const FATHER_COLLAR_PIVOT_Y = -0.145;

/**
 * Target local head height inside Samyak's `rig.head` (which has `scale = 1.42`).
 * Matches Principal Man's readable 3D arcade ~1.42x head proportion (~0.49 world units tall).
 */
export const SAMYAK_TARGET_HEAD_HEIGHT = 0.345;

/**
 * Bottom-neck pivot Y in `rig.head` local space seating cleanly onto Samyak's muscular neck & traps
 * (`neck` spans torso y ∈ [0.632, 0.788], so local y = -0.145 seats at torso y ≈ 0.699 with zero gap).
 */
export const SAMYAK_NECK_PIVOT_Y = -0.145;

/**
 * Target local head height inside Adi's `rig.head` (which has `scale = 1.42`).
 * Slightly taller than pure cranium height because `/models/adi_head.glb` includes his neck.
 */
export const ADI_TARGET_HEAD_HEIGHT = 0.395;

/**
 * Bottom-neck pivot Y in `rig.head` local space seating Adi's GLB neck cleanly inside his olive crew-neck collar.
 */
export const ADI_NECK_PIVOT_Y = -0.195;

/**
 * Target local head+neck height inside Krish's `rig.head` (which has `scale = 1.42`).
 * Includes `/models/krish_head.glb`'s sculpted 3D neck with zero duplicate procedural neck.
 */
export const KRISH_TARGET_HEAD_HEIGHT = 0.395;

/**
 * Bottom-neck pivot Y in `rig.head` local space seating `/models/krish_head.glb`'s built-in neck
 * cleanly inside `krish_ribbed_collar` (torso y ≈ 0.610 vs collar y = 0.628) with zero gap or clipping.
 */
export const KRISH_NECK_PIVOT_Y = -0.208;

/**
 * Target local head+neck height inside Utkarsh's `rig.head` (which has `scale = 1.38`).
 * Includes `/models/utkarsh_head.glb`'s sculpted 3D neck with zero procedural neck mesh.
 */
export const UTKARSH_TARGET_HEAD_HEIGHT = 0.378;

/**
 * Bottom-neck pivot Y in `rig.head` local space seating `/models/utkarsh_head.glb`'s built-in neck
 * cleanly inside Utkarsh's open V-neck spread collar (torso y ≈ 0.550 vs collar y = 0.595) with zero gap.
 */
export const UTKARSH_NECK_PIVOT_Y = -0.228;

interface GlbHeadCache {
  status: 'idle' | 'loading' | 'loaded' | 'failed';
  templateScene: THREE.Group | null;
  listeners: Set<(template: THREE.Group) => void>;
  waiters: Set<(loaded: boolean) => void>;
}

function createGlbHeadCache(): GlbHeadCache {
  return {
    status: 'idle',
    templateScene: null,
    listeners: new Set(),
    waiters: new Set(),
  };
}

const fatherGlbCache: GlbHeadCache = createGlbHeadCache();
const samyakGlbCache: GlbHeadCache = createGlbHeadCache();
const adiGlbCache: GlbHeadCache = createGlbHeadCache();
const krishGlbCache: GlbHeadCache = createGlbHeadCache();
const utkarshGlbCache: GlbHeadCache = createGlbHeadCache();

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

function resolveCacheWaiters(cache: GlbHeadCache, loaded: boolean): void {
  for (const waiter of cache.waiters) {
    waiter(loaded);
  }
  cache.waiters.clear();
}

function preloadCachedGlbHead(
  url: string,
  cache: GlbHeadCache,
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
  maxRetries = 0,
  retryBackoffMs = 300,
): Promise<boolean> {
  if (cache.status === 'loaded') return Promise.resolve(true);
  if (cache.status === 'failed') return Promise.resolve(false);
  if (typeof window === 'undefined' && !loaderFactory) return Promise.resolve(false);

  const completion = new Promise<boolean>((resolve) => {
    cache.waiters.add(resolve);
  });

  if (cache.status !== 'idle') {
    return completion;
  }

  cache.status = 'loading';
  let attempt = 0;

  const failPermanently = () => {
    // Silent graceful fallback to existing hemisphere head with zero crash
    cache.status = 'failed';
    cache.listeners.clear();
    resolveCacheWaiters(cache, false);
  };

  const runAttempt = () => {
    const loader = loaderFactory
      ? loaderFactory()
      : (sharedGltfLoader ?? (sharedGltfLoader = new GLTFLoader()));

    const handleFailure = () => {
      if (attempt < maxRetries) {
        attempt += 1;
        globalThis.setTimeout(runAttempt, retryBackoffMs);
        return;
      }
      failPermanently();
    };

    try {
      loader.load(
        url,
        (gltf) => {
          if (!gltf || !gltf.scene) {
            handleFailure();
            return;
          }
          stripEmbeddedLightsAndCameras(gltf.scene);
          cache.templateScene = gltf.scene;
          cache.status = 'loaded';
          for (const listener of cache.listeners) {
            listener(gltf.scene);
          }
          cache.listeners.clear();
          resolveCacheWaiters(cache, true);
        },
        undefined,
        () => {
          handleFailure();
        },
      );
    } catch {
      handleFailure();
    }
  };

  runAttempt();
  return completion;
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
 *    readable 3D arcade ~1.42x head proportion (`targetHeight * config.scaleMultiplier`).
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
  maxRetries = 0,
  retryBackoffMs = 300,
): Promise<boolean> {
  return preloadCachedGlbHead(
    FATHER_GLB_HEAD_URL,
    fatherGlbCache,
    loaderFactory,
    maxRetries,
    retryBackoffMs,
  );
}

/**
 * Preloads and caches `/models/samyak_head.glb` ONCE at module level via `GLTFLoader`.
 * Safe to call repeatedly — deduplicates fetches across mirror matches, rematches, Friend Room, and Super Lab.
 */
export function preloadSamyakGlbHead(
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
  maxRetries = 0,
  retryBackoffMs = 300,
): Promise<boolean> {
  return preloadCachedGlbHead(
    SAMYAK_GLB_HEAD_URL,
    samyakGlbCache,
    loaderFactory,
    maxRetries,
    retryBackoffMs,
  );
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

/**
 * Clones and normalizes Adi's `/models/adi_head.glb` scene via exact `THREE.Box3` math:
 * - Uniformly scales height to `targetHeadHeight * config.scaleMultiplier`
 * - Grounds `rawBox.min.y` flush on `neckJointY + config.offsetY`
 * - Centers X/Z onto `config.offsetX` / `config.offsetZ` and applies `config.rotationY`
 * - Enforces PBR material calibration (`metalness = 0.0`, `roughness = 0.72`, `DoubleSide`, `SRGBColorSpace`)
 */
export function buildFittedAdiGlbHead(
  templateScene: THREE.Object3D,
  config: AdiGlbHeadConfig = ADI_GLB_HEAD_CONFIG,
  targetHeadHeight = ADI_TARGET_HEAD_HEIGHT,
  neckJointY = ADI_NECK_PIVOT_Y,
  flashMaterials?: THREE.MeshStandardMaterial[],
): { glbRoot: THREE.Group; materials: THREE.Material[] } {
  const cloned = templateScene.clone(true);
  stripEmbeddedLightsAndCameras(cloned);
  cloned.updateMatrixWorld(true);

  const rawBox = new THREE.Box3().setFromObject(cloned);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);

  const safeHeight = Math.max(rawSize.y, 0.001);
  const baseScale = (targetHeadHeight / safeHeight) * config.scaleMultiplier;

  // Shift cloned scene in raw units so bottom-neck sits at local y=0 and X/Z center is (0, 0)
  cloned.position.set(
    cloned.position.x - rawCenter.x,
    cloned.position.y - rawBox.min.y,
    cloned.position.z - rawCenter.z,
  );

  const materials: THREE.Material[] = [];
  cloned.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.userData.sharedGeometry = true;

    const calibrateMaterial = (srcMat: THREE.Material): THREE.Material => {
      const mat = srcMat.clone();
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) {
        std.map.colorSpace = THREE.SRGBColorSpace;
        std.map.needsUpdate = true;
      }
      if (typeof std.metalness === 'number') {
        std.metalness = 0.0;
      }
      if (typeof std.roughness === 'number') {
        std.roughness = 0.72;
      }
      std.side = THREE.DoubleSide;
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
      materials.push(mat);
      return mat;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(calibrateMaterial);
    } else if (mesh.material) {
      mesh.material = calibrateMaterial(mesh.material);
    }
  });

  const glbRoot = new THREE.Group();
  glbRoot.name = 'adi_glb_head_root';
  glbRoot.scale.setScalar(baseScale);
  glbRoot.position.set(config.offsetX, neckJointY + config.offsetY, config.offsetZ);
  glbRoot.rotation.y = config.rotationY;
  glbRoot.add(cloned);
  glbRoot.updateMatrixWorld(true);

  return { glbRoot, materials };
}

/**
 * Preloads and caches `/models/adi_head.glb` ONCE at module level via `GLTFLoader`.
 */
export function preloadAdiGlbHead(
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
  maxRetries = 0,
  retryBackoffMs = 300,
): Promise<boolean> {
  return preloadCachedGlbHead(
    ADI_GLB_HEAD_URL,
    adiGlbCache,
    loaderFactory,
    maxRetries,
    retryBackoffMs,
  );
}

/**
 * Attaches a cloned, normalized `/models/adi_head.glb` head inside Adi's animated `rig.head`
 * while keeping `fallbackHeadGroup` visible during loading or if `/models/adi_head.glb` is absent.
 */
export function attachAdiGlbHead(
  headGroup: THREE.Group,
  fallbackHeadGroup: THREE.Group,
  flashMaterials: THREE.MeshStandardMaterial[],
  isDisposed: () => boolean,
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
): void {
  fallbackHeadGroup.visible = true;
  preloadAdiGlbHead(loaderFactory);

  const mountClonedHead = (template: THREE.Group) => {
    if (isDisposed()) return;
    const { glbRoot } = buildFittedAdiGlbHead(
      template,
      ADI_GLB_HEAD_CONFIG,
      ADI_TARGET_HEAD_HEIGHT,
      ADI_NECK_PIVOT_Y,
      flashMaterials,
    );
    headGroup.add(glbRoot);
    fallbackHeadGroup.visible = false;
  };

  if (adiGlbCache.status === 'loaded' && adiGlbCache.templateScene) {
    mountClonedHead(adiGlbCache.templateScene);
    return;
  }

  if (adiGlbCache.status === 'failed') {
    fallbackHeadGroup.visible = true;
    return;
  }

  adiGlbCache.listeners.add(mountClonedHead);
}

/**
 * Clones and normalizes Krish's `/models/krish_head.glb` scene via exact `THREE.Box3` math:
 * 1. Wraps `templateScene.clone(true)` inside `glbRoot = new THREE.Group()`.
 * 2. Computes `rawBox = new THREE.Box3().setFromObject(glbRoot)`, `rawSize`, `rawCenter`.
 * 3. Uniformly scales height to `(targetHeadHeight / Math.max(rawSize.y, 0.001)) * config.scaleMultiplier`.
 * 4. Seats `rawBox.min.y` flush on `neckJointY + config.offsetY` and centers X/Z onto `offsetX`/`offsetZ`,
 *    applying `glbRoot.rotation.y = config.rotationY`.
 * 5. Calibrates every mesh material: `metalness = 0.0`, `roughness = 0.72`, `side = THREE.DoubleSide`,
 *    and `map.colorSpace = THREE.SRGBColorSpace` with `map.needsUpdate = true`.
 */
export function buildFittedKrishGlbHead(
  templateScene: THREE.Object3D,
  config: KrishGlbHeadConfig = KRISH_GLB_HEAD_CONFIG,
  targetHeadHeight = KRISH_TARGET_HEAD_HEIGHT,
  neckJointY = KRISH_NECK_PIVOT_Y,
  flashMaterials?: THREE.MeshStandardMaterial[],
): { glbRoot: THREE.Group; materials: THREE.Material[] } {
  const cloned = templateScene.clone(true);
  stripEmbeddedLightsAndCameras(cloned);

  const glbRoot = new THREE.Group();
  glbRoot.name = 'krish_glb_head_root';
  glbRoot.add(cloned);
  glbRoot.updateMatrixWorld(true);

  const rawBox = new THREE.Box3().setFromObject(glbRoot);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);

  const safeHeight = Math.max(rawSize.y, 0.001);
  const baseScale = (targetHeadHeight / safeHeight) * config.scaleMultiplier;

  // Offset child in raw units so bottom-neck sits at local y=0 and X/Z center is (0, 0)
  // before applying glbRoot.rotation.y, glbRoot.scale, and glbRoot.position
  cloned.position.set(
    cloned.position.x - rawCenter.x,
    cloned.position.y - rawBox.min.y,
    cloned.position.z - rawCenter.z,
  );

  const materials: THREE.Material[] = [];
  cloned.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    const calibrateMaterial = (orig: THREE.Material): THREE.Material => {
      const mat = orig.clone();
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) {
        std.map.colorSpace = THREE.SRGBColorSpace;
        std.map.needsUpdate = true;
      }
      if (typeof std.metalness === 'number') {
        std.metalness = 0.0;
      }
      if (typeof std.roughness === 'number') {
        std.roughness = 0.72;
      }
      std.side = THREE.DoubleSide;
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
      materials.push(mat);
      return mat;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(calibrateMaterial);
    } else if (mesh.material) {
      mesh.material = calibrateMaterial(mesh.material);
    }
  });

  glbRoot.scale.setScalar(baseScale);
  glbRoot.position.set(config.offsetX, neckJointY + config.offsetY, config.offsetZ);
  glbRoot.rotation.y = config.rotationY;
  glbRoot.updateMatrixWorld(true);

  return { glbRoot, materials };
}

/**
 * Preloads and caches `/models/krish_head.glb` ONCE at module level via `GLTFLoader`.
 */
export function preloadKrishGlbHead(
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
  maxRetries = 0,
  retryBackoffMs = 300,
): Promise<boolean> {
  return preloadCachedGlbHead(
    KRISH_GLB_HEAD_URL,
    krishGlbCache,
    loaderFactory,
    maxRetries,
    retryBackoffMs,
  );
}

/**
 * Attaches a cloned, normalized `/models/krish_head.glb` head inside Krish's animated `rig.head`
 * while keeping `fallbackHeadGroup` visible during loading or if `/models/krish_head.glb` is absent.
 */
export function attachKrishGlbHead(
  headGroup: THREE.Group,
  fallbackHeadGroup: THREE.Group,
  flashMaterials: THREE.MeshStandardMaterial[],
  isDisposed: () => boolean,
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
): void {
  fallbackHeadGroup.visible = true;
  preloadKrishGlbHead(loaderFactory);

  const mountClonedHead = (template: THREE.Group) => {
    if (isDisposed()) return;
    const { glbRoot } = buildFittedKrishGlbHead(
      template,
      KRISH_GLB_HEAD_CONFIG,
      KRISH_TARGET_HEAD_HEIGHT,
      KRISH_NECK_PIVOT_Y,
      flashMaterials,
    );
    headGroup.add(glbRoot);
    fallbackHeadGroup.visible = false;
  };

  if (krishGlbCache.status === 'loaded' && krishGlbCache.templateScene) {
    mountClonedHead(krishGlbCache.templateScene);
    return;
  }

  if (krishGlbCache.status === 'failed') {
    fallbackHeadGroup.visible = true;
    return;
  }

  krishGlbCache.listeners.add(mountClonedHead);
}

/**
 * Clones and normalizes Utkarsh's `/models/utkarsh_head.glb` scene via exact `THREE.Box3` math:
 * 1. Wraps `templateScene.clone(true)` inside `glbRoot = new THREE.Group()`.
 * 2. Computes `rawBox = new THREE.Box3().setFromObject(glbRoot)`, `rawSize`, `rawCenter`.
 * 3. Uniformly scales height to `(targetHeadHeight / Math.max(rawSize.y, 0.001)) * config.scaleMultiplier`.
 * 4. Seats `rawBox.min.y` cleanly inside Utkarsh's open V-neck collar at `neckJointY + config.offsetY`
 *    (with ZERO procedural neck mesh underneath), centers X/Z onto `offsetX`/`offsetZ`, and applies `rotationY`.
 * 5. Calibrates every mesh material: `metalness = 0.0`, `roughness = 0.72`, `side = THREE.DoubleSide`,
 *    and `map.colorSpace = THREE.SRGBColorSpace` with `map.needsUpdate = true`.
 */
export function buildFittedUtkarshGlbHead(
  templateScene: THREE.Object3D,
  config: UtkarshGlbHeadConfig = UTKARSH_GLB_HEAD_CONFIG,
  targetHeadHeight = UTKARSH_TARGET_HEAD_HEIGHT,
  neckJointY = UTKARSH_NECK_PIVOT_Y,
  flashMaterials?: THREE.MeshStandardMaterial[],
): { glbRoot: THREE.Group; materials: THREE.Material[] } {
  const cloned = templateScene.clone(true);
  stripEmbeddedLightsAndCameras(cloned);

  const glbRoot = new THREE.Group();
  glbRoot.name = 'utkarsh_glb_head_root';
  glbRoot.add(cloned);
  glbRoot.updateMatrixWorld(true);

  const rawBox = new THREE.Box3().setFromObject(glbRoot);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);

  const safeHeight = Math.max(rawSize.y, 0.001);
  const baseScale = (targetHeadHeight / safeHeight) * config.scaleMultiplier;

  cloned.position.set(
    cloned.position.x - rawCenter.x,
    cloned.position.y - rawBox.min.y,
    cloned.position.z - rawCenter.z,
  );

  const materials: THREE.Material[] = [];
  cloned.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    const calibrateMaterial = (orig: THREE.Material): THREE.Material => {
      const mat = orig.clone();
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) {
        std.map.colorSpace = THREE.SRGBColorSpace;
        std.map.needsUpdate = true;
      }
      if (typeof std.metalness === 'number') {
        std.metalness = 0.0;
      }
      if (typeof std.roughness === 'number') {
        std.roughness = 0.72;
      }
      std.side = THREE.DoubleSide;
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
      materials.push(mat);
      return mat;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(calibrateMaterial);
    } else if (mesh.material) {
      mesh.material = calibrateMaterial(mesh.material);
    }
  });

  glbRoot.scale.setScalar(baseScale);
  glbRoot.position.set(config.offsetX, neckJointY + config.offsetY, config.offsetZ);
  glbRoot.rotation.y = config.rotationY;
  glbRoot.updateMatrixWorld(true);

  return { glbRoot, materials };
}

/**
 * Preloads and caches `/models/utkarsh_head.glb` ONCE at module level via `GLTFLoader`.
 */
export function preloadUtkarshGlbHead(
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
  maxRetries = 0,
  retryBackoffMs = 300,
): Promise<boolean> {
  return preloadCachedGlbHead(
    UTKARSH_GLB_HEAD_URL,
    utkarshGlbCache,
    loaderFactory,
    maxRetries,
    retryBackoffMs,
  );
}

/**
 * Attaches a cloned, normalized `/models/utkarsh_head.glb` head inside Utkarsh's animated `rig.head`
 * while keeping `fallbackHeadGroup` visible during loading or if `/models/utkarsh_head.glb` is absent.
 */
export function attachUtkarshGlbHead(
  headGroup: THREE.Group,
  fallbackHeadGroup: THREE.Group,
  flashMaterials: THREE.MeshStandardMaterial[],
  isDisposed: () => boolean,
  loaderFactory?: () => Pick<GLTFLoader, 'load'>,
): void {
  fallbackHeadGroup.visible = true;
  preloadUtkarshGlbHead(loaderFactory);

  const mountClonedHead = (template: THREE.Group) => {
    if (isDisposed()) return;
    const { glbRoot } = buildFittedUtkarshGlbHead(
      template,
      UTKARSH_GLB_HEAD_CONFIG,
      UTKARSH_TARGET_HEAD_HEIGHT,
      UTKARSH_NECK_PIVOT_Y,
      flashMaterials,
    );
    headGroup.add(glbRoot);
    fallbackHeadGroup.visible = false;
  };

  if (utkarshGlbCache.status === 'loaded' && utkarshGlbCache.templateScene) {
    mountClonedHead(utkarshGlbCache.templateScene);
    return;
  }

  if (utkarshGlbCache.status === 'failed') {
    fallbackHeadGroup.visible = true;
    return;
  }

  utkarshGlbCache.listeners.add(mountClonedHead);
}

export function getFatherGlbHeadStatus(): GlbHeadCache['status'] {
  return fatherGlbCache.status;
}

export function getSamyakGlbHeadStatus(): GlbHeadCache['status'] {
  return samyakGlbCache.status;
}

export function getAdiGlbHeadStatus(): GlbHeadCache['status'] {
  return adiGlbCache.status;
}

export function getKrishGlbHeadStatus(): GlbHeadCache['status'] {
  return krishGlbCache.status;
}

export function getUtkarshGlbHeadStatus(): GlbHeadCache['status'] {
  return utkarshGlbCache.status;
}

export function clearFatherGlbHeadCacheForTests(): void {
  fatherGlbCache.status = 'idle';
  fatherGlbCache.templateScene = null;
  fatherGlbCache.listeners.clear();
  fatherGlbCache.waiters.clear();
}

export function clearSamyakGlbHeadCacheForTests(): void {
  samyakGlbCache.status = 'idle';
  samyakGlbCache.templateScene = null;
  samyakGlbCache.listeners.clear();
  samyakGlbCache.waiters.clear();
}

export function clearAdiGlbHeadCacheForTests(): void {
  adiGlbCache.status = 'idle';
  adiGlbCache.templateScene = null;
  adiGlbCache.listeners.clear();
  adiGlbCache.waiters.clear();
}

export function clearKrishGlbHeadCacheForTests(): void {
  krishGlbCache.status = 'idle';
  krishGlbCache.templateScene = null;
  krishGlbCache.listeners.clear();
  krishGlbCache.waiters.clear();
}

export function clearUtkarshGlbHeadCacheForTests(): void {
  utkarshGlbCache.status = 'idle';
  utkarshGlbCache.templateScene = null;
  utkarshGlbCache.listeners.clear();
  utkarshGlbCache.waiters.clear();
}
