import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  ADI_SUPER_AUDIO_URL,
  ANDA_SUPER_AUDIO_URL,
  audioEngine,
  BILLA_SUPER_AUDIO_URL,
  DAHI_KO_AUDIO_URL,
  FATHER_SUPER_AUDIO_URL,
  KRISH_SUPER_AUDIO_URL,
  MAUSI_SUPER_AUDIO_URL,
  NETA_SUPER_AUDIO_URL,
  SAMYAK_SUPER_AUDIO_URL,
  SHERU_SUPER_AUDIO_URL,
} from './audio';
import {
  preloadAdiGlbHead,
  preloadFatherGlbHead,
  preloadKrishGlbHead,
  preloadSamyakGlbHead,
} from './characters/fatherGlbHead';
import { preloadRealFaceTextures } from './characters/photoFaceLoader';

export const SPLASH_STAGE1_MIN_MS = 2000;
export const PRELOADER_FALLBACK_TIMEOUT_MS = 8000;

export const PRELOAD_GLB_URLS: readonly string[] = [
  '/models/father_head.glb',
  '/models/samyak_head.glb',
  '/models/adi_head.glb',
  '/models/krish_head.glb',
];

export const PRELOAD_PORTRAIT_URLS: readonly string[] = [
  '/textures/faces/sheru.png',
  '/textures/faces/billa.png',
  '/textures/faces/anda.png',
  '/textures/faces/krish.png',
  '/textures/faces/adi.png',
  '/textures/faces/mausi.png',
  '/textures/faces/neta.png',
  '/textures/faces/samyak.png',
  '/textures/faces/principal_man.png',
];

export const PRELOAD_AUDIO_URLS: readonly string[] = [
  SHERU_SUPER_AUDIO_URL,
  BILLA_SUPER_AUDIO_URL,
  NETA_SUPER_AUDIO_URL,
  ANDA_SUPER_AUDIO_URL,
  MAUSI_SUPER_AUDIO_URL,
  FATHER_SUPER_AUDIO_URL,
  SAMYAK_SUPER_AUDIO_URL,
  ADI_SUPER_AUDIO_URL,
  KRISH_SUPER_AUDIO_URL,
  DAHI_KO_AUDIO_URL,
];

export const TOTAL_STARTUP_PRELOAD_ASSETS =
  PRELOAD_GLB_URLS.length + PRELOAD_PORTRAIT_URLS.length + PRELOAD_AUDIO_URLS.length;

export interface PreloadProgressInfo {
  percent: number;
  statusText: string;
  timedOut: boolean;
  loadedItems?: number;
  totalItems?: number;
}

export interface PreloadOptions {
  timeoutMs?: number;
  onProgress?: (info: PreloadProgressInfo) => void;
  runLoader?: (manager: THREE.LoadingManager) => Promise<void>;
}

const preloadedPortraitCache = new Map<string, HTMLImageElement>();

/**
 * Safely fetches & decodes a 2D PNG portrait into the browser image cache.
 * Gracefully ignores missing optional PNGs (including Vite SPA text/html 200 fallbacks)
 * so the preloader never stalls or throws on optional fighter portraits.
 */
async function preloadSinglePortraitPng(url: string): Promise<void> {
  if (preloadedPortraitCache.has(url)) return;
  if (typeof fetch !== 'function') return;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const contentType = (res.headers?.get?.('content-type') ?? '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return;
    }
    if (typeof Image === 'undefined') return;
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        preloadedPortraitCache.set(url, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  } catch {
    // Missing optional portrait settles cleanly
  }
}

export function formatPreloadStatusLabel(loaded: number, total: number): string {
  const safeTotal = Math.max(1, total);
  const safeLoaded = Math.max(0, Math.min(safeTotal, loaded));
  return `Loading 3D Heads, Portraits & Audio (${safeLoaded}/${safeTotal})...`;
}

/**
 * Preloads ALL 3 startup asset pools together before Title/Select:
 * 1. All 4 custom 3D `.glb` head models (via GLTFLoader + THREE.LoadingManager)
 * 2. All 9 2D face `.png` portraits (plus Three.js TextureLoader cache)
 * 3. All 10 `.mp3` Super Power & KO audio buffers
 *
 * Reports unified 0..100% progress with `(X/Y)` counts and guarantees completion
 * within `timeoutMs` (default 8000ms) with per-file error resilience.
 */
export async function preloadStartupAssets(
  options: PreloadOptions = {},
): Promise<PreloadProgressInfo> {
  const timeoutMs = options.timeoutMs ?? PRELOADER_FALLBACK_TIMEOUT_MS;
  const onProgress = options.onProgress;

  let loadedItems = 0;
  let totalItems = TOTAL_STARTUP_PRELOAD_ASSETS;
  let settled = false;
  let lastReportedPct = 0;

  const emitProgress = (statusText: string, forcePct?: number, timedOut = false) => {
    const ratio = totalItems > 0 ? Math.min(1, loadedItems / totalItems) : 0;
    const computedPct = forcePct !== undefined ? forcePct : Math.round(ratio * 100);
    const clampedPct = Math.max(lastReportedPct, Math.min(100, computedPct));
    lastReportedPct = clampedPct;
    onProgress?.({
      percent: clampedPct,
      statusText,
      timedOut,
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

    // Warm Three.js face texture cache alongside direct PNG preloading
    void preloadRealFaceTextures(createTexLoader).catch(() => undefined);

    const glbTasks = [
      trackTask(preloadFatherGlbHead(createGltfLoader)),
      trackTask(preloadSamyakGlbHead(createGltfLoader)),
      trackTask(preloadAdiGlbHead(createGltfLoader)),
      trackTask(preloadKrishGlbHead(createGltfLoader)),
    ];

    const portraitTasks = PRELOAD_PORTRAIT_URLS.map((url) =>
      trackTask(preloadSinglePortraitPng(url)),
    );

    const audioTasks = PRELOAD_AUDIO_URLS.map((url) =>
      trackTask(audioEngine.preloadSuperAudio(url)),
    );

    await Promise.all([...glbTasks, ...portraitTasks, ...audioTasks]);
  };

  const workPromise = (options.runLoader ? options.runLoader(manager) : defaultRunLoader(manager))
    .catch(() => undefined);

  return new Promise<PreloadProgressInfo>((resolve) => {
    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      const finalInfo: PreloadProgressInfo = {
        percent: 100,
        statusText: 'Arena Ready!',
        timedOut,
        loadedItems: totalItems,
        totalItems,
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
