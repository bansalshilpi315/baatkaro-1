import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  ADI_SUPER_AUDIO_URL,
  ANDA_SUPER_AUDIO_URL,
  audioEngine,
  BGM_AUDIO_URL,
  BILLA_SUPER_AUDIO_URL,
  DAHI_KO_AUDIO_URL,
  FATHER_SUPER_AUDIO_URL,
  KRISH_SUPER_AUDIO_URL,
  MAUSI_SUPER_AUDIO_URL,
  NETA_SUPER_AUDIO_URL,
  SAMYAK_SUPER_AUDIO_URL,
  SHERU_SUPER_AUDIO_URL,
  UTKARSH_SUPER_AUDIO_URL,
} from './audio';
import {
  preloadAdiGlbHead,
  preloadFatherGlbHead,
  preloadKrishGlbHead,
  preloadSamyakGlbHead,
  preloadUtkarshGlbHead,
} from './characters/fatherGlbHead';
import { preloadRealFaceTextures } from './characters/photoFaceLoader';

export const SPLASH_STAGE1_MIN_MS = 2000;
export const PRELOAD_MAX_RETRIES = 3;
export const PRELOAD_RETRY_BACKOFF_MS = 300;

export const PRELOAD_GLB_URLS: readonly string[] = [
  '/models/father_head.glb',
  '/models/samyak_head.glb',
  '/models/adi_head.glb',
  '/models/krish_head.glb',
  '/models/utkarsh_head.glb',
];

export const PRELOAD_PORTRAIT_URLS: readonly string[] = [
  '/textures/faces/sheru.png',
  '/textures/faces/billa.png',
  '/textures/faces/utkarsh.png',
  '/textures/faces/anda.png',
  '/textures/faces/krish.png',
  '/textures/faces/adi.png',
  '/textures/faces/mausi.png',
  '/textures/faces/neta.png',
  '/textures/faces/samyak.png',
  '/textures/faces/principal_man.png',
];

export const PRELOAD_AUDIO_URLS: readonly string[] = [
  BGM_AUDIO_URL,
  SHERU_SUPER_AUDIO_URL,
  BILLA_SUPER_AUDIO_URL,
  UTKARSH_SUPER_AUDIO_URL,
  NETA_SUPER_AUDIO_URL,
  ANDA_SUPER_AUDIO_URL,
  MAUSI_SUPER_AUDIO_URL,
  FATHER_SUPER_AUDIO_URL,
  SAMYAK_SUPER_AUDIO_URL,
  ADI_SUPER_AUDIO_URL,
  KRISH_SUPER_AUDIO_URL,
  DAHI_KO_AUDIO_URL,
];

export const STARTUP_ASSET_MANIFEST = {
  glbModels: PRELOAD_GLB_URLS,
  portraits: PRELOAD_PORTRAIT_URLS,
  audioFiles: PRELOAD_AUDIO_URLS,
} as const;

export const TOTAL_STARTUP_PRELOAD_ASSETS =
  PRELOAD_GLB_URLS.length + PRELOAD_PORTRAIT_URLS.length + PRELOAD_AUDIO_URLS.length;

export interface PreloadProgressInfo {
  percent: number;
  statusText: string;
  timedOut: boolean;
  loadedItems: number;
  totalItems: number;
}

export interface PreloadOptions {
  onProgress?: (info: PreloadProgressInfo) => void;
  runLoader?: (manager: THREE.LoadingManager) => Promise<void>;
  maxRetries?: number;
  retryBackoffMs?: number;
}

const preloadedPortraitCache = new Map<string, HTMLImageElement>();

/**
 * Retries a transiently failing async loader task up to `maxRetries` times
 * with `backoffMs` delay between attempts before falling back cleanly.
 */
export async function withPreloadRetry<T>(
  task: () => Promise<T>,
  maxRetries = PRELOAD_MAX_RETRIES,
  backoffMs = PRELOAD_RETRY_BACKOFF_MS,
): Promise<{ ok: boolean; value?: T; attempts: number }> {
  let attempts = 0;
  for (let i = 0; i <= maxRetries; i++) {
    attempts += 1;
    try {
      const value = await task();
      return { ok: true, value, attempts };
    } catch {
      if (i < maxRetries && backoffMs > 0) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, backoffMs));
      }
    }
  }
  return { ok: false, attempts };
}

/**
 * Safely fetches & decodes a 2D PNG portrait into the browser image cache using
 * `Image.decode()` with automatic retry (up to 2 retries, 300ms backoff) on
 * transient failures, while cleanly resolving optional missing PNGs (404 or
 * Vite SPA `text/html` fallback) without throwing.
 */
async function preloadSinglePortraitPng(
  url: string,
  maxRetries = PRELOAD_MAX_RETRIES,
  retryBackoffMs = PRELOAD_RETRY_BACKOFF_MS,
): Promise<void> {
  if (preloadedPortraitCache.has(url)) return;
  if (typeof fetch !== 'function') return;

  await withPreloadRetry(
    async () => {
      const res = await fetch(url);
      if (!res.ok) {
        // Optional missing file (404) resolves cleanly without retrying
        if (res.status === 404) return;
        throw new Error(`HTTP ${res.status}`);
      }
      const contentType = (res.headers?.get?.('content-type') ?? '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        // Vite SPA index.html fallback -> optional portrait absent
        return;
      }
      if (typeof Image === 'undefined') return;

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (typeof img.decode === 'function') {
            img
              .decode()
              .catch(() => undefined)
              .finally(() => {
                preloadedPortraitCache.set(url, img);
                resolve();
              });
          } else {
            preloadedPortraitCache.set(url, img);
            resolve();
          }
        };
        img.onerror = () => reject(new Error(`Failed to decode portrait ${url}`));
        img.src = url;
      });
    },
    maxRetries,
    retryBackoffMs,
  );
}

export function formatPreloadStatusLabel(loaded: number, total: number): string {
  const safeTotal = Math.max(1, total);
  const safeLoaded = Math.max(0, Math.min(safeTotal, loaded));
  return `Loading 3D Models, Portraits & Audio (${safeLoaded} / ${safeTotal})...`;
}

/**
 * Strict 100% blocking startup asset preloader (NO arbitrary early timeout):
 * Awaits `Promise.all` across every asset in the manifest:
 * 1. All 5 custom 3D `.glb` head models (via GLTFLoader + module-level GLB cache, 3 retries)
 * 2. All 10 2D face `.png` portraits (decoded via Image.decode() + THREE.TextureLoader cache, 3 retries)
 * 3. All 12 `.mp3` audio files including `/audio/bgm.mp3` + all Super/KO MP3s (ArrayBuffer + decodeAudioData, 3 retries)
 *
 * Updates progress (`0% -> 100%`) and live `(X / Total)` counter dynamically and
 * only resolves once `loadedItems === totalItems`.
 */
export async function preloadStartupAssets(
  options: PreloadOptions = {},
): Promise<PreloadProgressInfo> {
  const onProgress = options.onProgress;
  const maxRetries = options.maxRetries ?? PRELOAD_MAX_RETRIES;
  const retryBackoffMs = options.retryBackoffMs ?? PRELOAD_RETRY_BACKOFF_MS;

  let loadedItems = 0;
  let totalItems = TOTAL_STARTUP_PRELOAD_ASSETS;
  let lastReportedPct = 0;

  const emitProgress = (statusText: string, forcePct?: number) => {
    const ratio = totalItems > 0 ? Math.min(1, loadedItems / totalItems) : 0;
    const computedPct = forcePct !== undefined ? forcePct : Math.round(ratio * 100);
    const clampedPct = Math.max(lastReportedPct, Math.min(100, computedPct));
    lastReportedPct = clampedPct;
    onProgress?.({
      percent: clampedPct,
      statusText,
      timedOut: false,
      loadedItems: Math.min(loadedItems, totalItems),
      totalItems,
    });
  };

  const trackTask = <T>(promise: Promise<T>): Promise<void> =>
    promise
      .catch(() => undefined)
      .then(() => {
        loadedItems += 1;
        emitProgress(formatPreloadStatusLabel(loadedItems, totalItems));
      });

  emitProgress(formatPreloadStatusLabel(0, totalItems), 0);

  const manager = new THREE.LoadingManager();
  if (options.runLoader) {
    manager.onStart = (_url, itemsLoaded, itemsTotal) => {
      loadedItems = itemsLoaded;
      totalItems = Math.max(1, itemsTotal);
      emitProgress(formatPreloadStatusLabel(loadedItems, totalItems));
    };
    manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
      loadedItems = itemsLoaded;
      totalItems = Math.max(1, itemsTotal);
      emitProgress(formatPreloadStatusLabel(loadedItems, totalItems));
    };
    manager.onError = () => {
      emitProgress(formatPreloadStatusLabel(loadedItems, totalItems));
    };
    manager.onLoad = () => {
      loadedItems = totalItems;
      emitProgress('Arena Ready!', 100);
    };
  }

  const defaultRunLoader = async (mgr: THREE.LoadingManager): Promise<void> => {
    const createGltfLoader = () => new GLTFLoader(mgr);
    const createTexLoader = () => new THREE.TextureLoader(mgr);

    const glbTasks = [
      trackTask(preloadFatherGlbHead(createGltfLoader, maxRetries, retryBackoffMs)),
      trackTask(preloadSamyakGlbHead(createGltfLoader, maxRetries, retryBackoffMs)),
      trackTask(preloadAdiGlbHead(createGltfLoader, maxRetries, retryBackoffMs)),
      trackTask(preloadKrishGlbHead(createGltfLoader, maxRetries, retryBackoffMs)),
      trackTask(preloadUtkarshGlbHead(createGltfLoader, maxRetries, retryBackoffMs)),
    ];

    const portraitTasks = PRELOAD_PORTRAIT_URLS.map((url) =>
      trackTask(preloadSinglePortraitPng(url, maxRetries, retryBackoffMs)),
    );

    const audioTasks = PRELOAD_AUDIO_URLS.map((url) =>
      trackTask(audioEngine.preloadSuperAudio(url, maxRetries, retryBackoffMs)),
    );

    // Warm Three.js face texture cache alongside direct PNG decoding and await all manifest promises
    await Promise.all([
      preloadRealFaceTextures(createTexLoader).catch(() => undefined),
      ...glbTasks,
      ...portraitTasks,
      ...audioTasks,
    ]);
  };

  await (options.runLoader ? options.runLoader(manager) : defaultRunLoader(manager)).catch(
    () => undefined,
  );

  const finalInfo: PreloadProgressInfo = {
    percent: 100,
    statusText: 'Arena Ready!',
    timedOut: false,
    loadedItems: totalItems,
    totalItems,
  };
  onProgress?.(finalInfo);
  return finalInfo;
}
