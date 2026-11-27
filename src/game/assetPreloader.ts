import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { audioEngine } from './audio';
import {
  preloadAdiGlbHead,
  preloadFatherGlbHead,
  preloadKrishGlbHead,
  preloadSamyakGlbHead,
} from './characters/fatherGlbHead';
import { preloadRealFaceTextures } from './characters/photoFaceLoader';

export const SPLASH_STAGE1_MIN_MS = 2000;
export const PRELOADER_FALLBACK_TIMEOUT_MS = 8000;

export interface PreloadProgressInfo {
  percent: number;
  statusText: string;
  timedOut: boolean;
}

export interface PreloadOptions {
  timeoutMs?: number;
  onProgress?: (info: PreloadProgressInfo) => void;
  runLoader?: (manager: THREE.LoadingManager) => Promise<void>;
}

/**
 * Preloads all custom 3D `.glb` head models, face photo textures, and audio buffers
 * through a shared `THREE.LoadingManager` + `GLTFLoader`, reporting 0..100% progress
 * and guaranteeing completion within `timeoutMs` (default 8000ms) so startup never hangs.
 */
export async function preloadStartupAssets(
  options: PreloadOptions = {},
): Promise<PreloadProgressInfo> {
  const timeoutMs = options.timeoutMs ?? PRELOADER_FALLBACK_TIMEOUT_MS;
  const onProgress = options.onProgress;

  let managerLoaded = 0;
  let managerTotal = 0;
  let audioDone = false;
  let threeDone = false;
  let settled = false;
  let lastReportedPct = 0;

  const emit = (statusText: string, forcePct?: number, timedOut = false) => {
    const threeRatio =
      threeDone
        ? 1
        : managerTotal > 0
          ? Math.min(1, managerLoaded / managerTotal)
          : 0.12;
    const audioRatio = audioDone ? 1 : 0.2;
    const computedPct =
      forcePct !== undefined
        ? forcePct
        : Math.round((threeRatio * 0.72 + audioRatio * 0.28) * 100);
    const clampedPct = Math.max(lastReportedPct, Math.min(100, computedPct));
    lastReportedPct = clampedPct;
    onProgress?.({
      percent: clampedPct,
      statusText,
      timedOut,
    });
  };

  emit('Loading 3D Fighters & Arena...', 5);

  const manager = new THREE.LoadingManager();
  manager.onStart = (_url, itemsLoaded, itemsTotal) => {
    managerLoaded = itemsLoaded;
    managerTotal = Math.max(managerTotal, itemsTotal);
    emit('Loading 3D Fighters & Arena...');
  };
  manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
    managerLoaded = itemsLoaded;
    managerTotal = Math.max(managerTotal, itemsTotal);
    emit('Caching 3D Head Models & Textures...');
  };
  manager.onError = () => {
    emit('Finalizing Arena Assets...');
  };
  manager.onLoad = () => {
    threeDone = true;
    emit(audioDone ? 'Arena Ready!' : 'Caching Fighter Audio...');
  };

  const defaultRunLoader = async (mgr: THREE.LoadingManager): Promise<void> => {
    const createGltfLoader = () => new GLTFLoader(mgr);
    const createTexLoader = () => new THREE.TextureLoader(mgr);

    const threeAssetsTask = Promise.all([
      preloadFatherGlbHead(createGltfLoader),
      preloadSamyakGlbHead(createGltfLoader),
      preloadAdiGlbHead(createGltfLoader),
      preloadKrishGlbHead(createGltfLoader),
      preloadRealFaceTextures(createTexLoader),
    ]).then(() => {
      threeDone = true;
      emit(audioDone ? 'Arena Ready!' : 'Caching Fighter Audio...');
    });

    const audioTask = audioEngine
      .preloadAllSuperAudios()
      .catch(() => [])
      .then(() => {
        audioDone = true;
        emit(threeDone ? 'Arena Ready!' : 'Loading 3D Fighters & Arena...');
      });

    await Promise.all([threeAssetsTask, audioTask]);
  };

  const workPromise = (options.runLoader ? options.runLoader(manager) : defaultRunLoader(manager))
    .catch(() => undefined)
    .then(() => {
      threeDone = true;
      audioDone = true;
    });

  return new Promise<PreloadProgressInfo>((resolve) => {
    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      const finalInfo: PreloadProgressInfo = {
        percent: 100,
        statusText: 'Arena Ready!',
        timedOut,
      };
      onProgress?.(finalInfo);
      resolve(finalInfo);
    };

    const timer = globalThis.setTimeout(() => {
      finish(true);
    }, timeoutMs);

    void workPromise.then(() => {
      globalThis.clearTimeout(timer);
      finish(false);
    });
  });
}
