/**
 * Centralized CrazyGames HTML5 SDK v3 wrapper (`CG_SDK`) for DESI DANGAL.
 *
 * - Safely initializes `window.CrazyGames.SDK.init()` and detects environment
 *   (`"crazygames" | "local" | "disabled"`).
 * - Wraps every SDK call in `try/catch` with graceful local/Vercel fallbacks so
 *   the game runs cleanly both inside CrazyGames's iframe sandbox and standalone.
 * - Coordinates gameplay lifecycle hooks, muteAudio settings sync, rewarded ads
 *   (with a 2-second simulated fallback when `environment === "disabled"`), and
 *   3-minute cooldown-gated midgame ads on post-match transitions.
 */

export type CrazyGamesEnvironment = 'crazygames' | 'local' | 'disabled';

export interface CrazyGamesSettings {
  muteAudio?: boolean;
  disableChat?: boolean;
}

export interface CrazyGamesAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

export interface CrazyGamesDataApi {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear?: () => void;
}

export interface CrazyGamesGameApi {
  sdkGameLoadingStart?: () => void;
  sdkGameLoadingStop?: () => void;
  gameplayStart?: () => void;
  gameplayStop?: () => void;
  happytime?: () => void;
  settings?: CrazyGamesSettings;
  addSettingsChangeListener?: (listener: (settings: CrazyGamesSettings) => void) => void;
  removeSettingsChangeListener?: (listener: (settings: CrazyGamesSettings) => void) => void;
}

export interface CrazyGamesAdApi {
  requestAd?: (type: 'midgame' | 'rewarded', callbacks?: CrazyGamesAdCallbacks) => void;
}

export interface CrazyGamesSdkV3 {
  environment?: CrazyGamesEnvironment;
  init?: () => Promise<void> | void;
  game?: CrazyGamesGameApi;
  ad?: CrazyGamesAdApi;
  data?: CrazyGamesDataApi;
}

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: CrazyGamesSdkV3;
    };
  }
}

export const MIDGAME_AD_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes strict minimum interval
export const SIMULATED_REWARDED_AD_MS = 2000;
export const AD_UNAVAILABLE_TOAST = 'Ad not available right now, try again!';

export interface RewardedAdRequestOptions {
  onAdStarted?: () => void;
  onRewardGranted: () => void;
  onAdFinished?: () => void;
  onAdError?: (toastMessage: string) => void;
  onSimulatedTick?: (secondsLeft: number) => void;
  simulatedDurationMs?: number;
}

export interface MidgameAdRequestOptions {
  onAdStarted?: () => void;
  onAdFinished?: () => void;
  onAdError?: () => void;
  nowMs?: number;
}

export type MuteSettingListener = (muteAudio: boolean) => void;

function resolveGlobalSdk(): CrazyGamesSdkV3 | null {
  try {
    if (typeof window !== 'undefined' && window.CrazyGames?.SDK) {
      return window.CrazyGames.SDK;
    }
  } catch {
    // Restricted global access
  }
  return null;
}

export class CrazyGamesSdkManager {
  private initialized = false;
  private initPromise: Promise<CrazyGamesEnvironment> | null = null;
  private environment: CrazyGamesEnvironment = 'disabled';
  private loadingActive = false;
  private loadingCompleted = false;
  private gameplayActive = false;
  private adInProgress = false;
  private lastMidgameAdAt = 0;
  private muteListeners = new Set<MuteSettingListener>();
  private sdkSettingsBound = false;
  private settingsListenerRef: ((settings: CrazyGamesSettings) => void) | null = null;

  public getEnvironment(): CrazyGamesEnvironment {
    return this.environment;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public isCrazyGamesHosted(): boolean {
    return this.environment === 'crazygames';
  }

  public isAdInProgress(): boolean {
    return this.adInProgress;
  }

  public isGameplayActive(): boolean {
    return this.gameplayActive;
  }

  public getLastMidgameAdTimestamp(): number {
    return this.lastMidgameAdAt;
  }

  /**
   * Returns CrazyGames `SDK.data` when available and initialized so `SaveStore`
   * can persist reliably inside CrazyGames's iframe sandbox without triggering
   * "CrazySDK is not initialized yet" errors during initial React mount.
   */
  public getDataApi(): CrazyGamesDataApi | null {
    if (!this.initialized || this.environment === 'disabled') return null;
    const sdk = resolveGlobalSdk();
    if (!sdk?.data) return null;
    if (
      typeof sdk.data.getItem !== 'function' ||
      typeof sdk.data.setItem !== 'function'
    ) {
      return null;
    }
    return sdk.data;
  }

  /**
   * Safely initializes CrazyGames SDK v3 once and resolves the active environment.
   */
  public async init(): Promise<CrazyGamesEnvironment> {
    if (this.initialized) return this.environment;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const sdk = resolveGlobalSdk();
      if (!sdk) {
        this.environment = 'disabled';
        this.initialized = true;
        return this.environment;
      }

      try {
        if (typeof sdk.init === 'function') {
          await sdk.init();
        }
        const env = sdk.environment;
        if (env === 'crazygames' || env === 'local' || env === 'disabled') {
          this.environment = env;
        } else {
          this.environment = 'disabled';
        }
      } catch {
        this.environment = 'disabled';
      }

      this.initialized = true;
      this.bindSettingsListener(sdk);
      return this.environment;
    })();

    return this.initPromise;
  }

  private bindSettingsListener(sdk: CrazyGamesSdkV3): void {
    if (this.sdkSettingsBound) return;
    try {
      if (typeof sdk.game?.addSettingsChangeListener === 'function') {
        this.settingsListenerRef = (settings: CrazyGamesSettings) => {
          if (typeof settings?.muteAudio === 'boolean') {
            this.emitMuteSetting(settings.muteAudio);
          }
        };
        sdk.game.addSettingsChangeListener(this.settingsListenerRef);
        this.sdkSettingsBound = true;
      }
    } catch {
      // Ignore unsupported settings listener
    }
  }

  private emitMuteSetting(muteAudio: boolean): void {
    for (const listener of this.muteListeners) {
      try {
        listener(muteAudio);
      } catch {
        // Isolate subscriber errors
      }
    }
  }

  /**
   * Reads `window.CrazyGames.SDK.game.settings.muteAudio` safely (null if unset/unavailable).
   */
  public getMuteAudioSetting(): boolean | null {
    if (!this.initialized || this.environment === 'disabled') return null;
    try {
      const sdk = resolveGlobalSdk();
      const val = sdk?.game?.settings?.muteAudio;
      return typeof val === 'boolean' ? val : null;
    } catch {
      return null;
    }
  }

  /**
   * Subscribes to CrazyGames portal `muteAudio` setting updates.
   * Returns an unsubscribe function.
   */
  public onMuteAudioSettingChange(listener: MuteSettingListener): () => void {
    this.muteListeners.add(listener);
    return () => {
      this.muteListeners.delete(listener);
    };
  }

  /**
   * Signals that startup asset preloading has begun.
   */
  public loadingStart(): void {
    if (this.loadingActive || this.loadingCompleted) return;
    this.loadingActive = true;
    try {
      const sdk = resolveGlobalSdk();
      if (this.initialized && this.environment !== 'disabled') {
        sdk?.game?.sdkGameLoadingStart?.();
      }
    } catch {
      // Never crash outside CrazyGames
    }
  }

  /**
   * Signals that 100% of startup assets have finished loading and the Menu is interactive.
   */
  public loadingStop(): void {
    if (this.loadingCompleted) return;
    this.loadingCompleted = true;
    this.loadingActive = false;
    try {
      const sdk = resolveGlobalSdk();
      if (this.initialized && this.environment !== 'disabled') {
        sdk?.game?.sdkGameLoadingStop?.();
      }
    } catch {
      // Never crash outside CrazyGames
    }
  }

  /**
   * Signals active interactive gameplay (fight rounds, Friend Room combat, Test Supers, or resuming from Pause).
   */
  public gameplayStart(): void {
    if (this.gameplayActive) return;
    this.gameplayActive = true;
    try {
      const sdk = resolveGlobalSdk();
      if (this.environment !== 'disabled') {
        sdk?.game?.gameplayStart?.();
      }
    } catch {
      // Safe no-op outside CrazyGames
    }
  }

  /**
   * Signals paused/menu/non-combat state (Pause, Settings, Character Select, Main Menu, KO/Victory).
   */
  public gameplayStop(): void {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    try {
      const sdk = resolveGlobalSdk();
      if (this.environment !== 'disabled') {
        sdk?.game?.gameplayStop?.();
      }
    } catch {
      // Safe no-op outside CrazyGames
    }
  }

  /**
   * Signals celebratory moments (match victory or permanently unlocking a new fighter).
   */
  public happytime(): void {
    try {
      const sdk = resolveGlobalSdk();
      if (this.environment !== 'disabled') {
        sdk?.game?.happytime?.();
      }
    } catch {
      // Safe no-op outside CrazyGames
    }
  }

  /**
   * Requests a CrazyGames v3 Rewarded Ad (`sdk.ad.requestAd("rewarded", callbacks)`).
   * - Automatically triggers `onAdStarted` (mute + pause) and `onAdFinished` (restore audio).
   * - Grants reward ONLY inside `adFinished`, never inside `adError`.
   * - Falls back cleanly to a 2-second simulated ad preview when `environment === "disabled"`
   *   so local/Vercel testing works seamlessly everywhere.
   */
  public async requestRewardedAd(
    options: RewardedAdRequestOptions,
  ): Promise<{ ok: boolean; simulated: boolean }> {
    if (this.adInProgress) {
      return { ok: false, simulated: false };
    }

    if (!this.initialized) {
      await this.init();
    }

    const sdk = resolveGlobalSdk();
    const canUseLiveSdk =
      this.environment !== 'disabled' && typeof sdk?.ad?.requestAd === 'function';

    this.adInProgress = true;

    if (canUseLiveSdk && sdk?.ad?.requestAd) {
      return new Promise<{ ok: boolean; simulated: boolean }>((resolve) => {
        let settled = false;
        let startedCalled = false;

        const finishOnce = (granted: boolean) => {
          if (settled) return;
          settled = true;
          this.adInProgress = false;
          try {
            options.onAdFinished?.();
          } catch {
            // Ensure ad completion settles
          }
          if (granted) {
            try {
              options.onRewardGranted();
            } catch {
              // Ignore callback errors
            }
          } else {
            try {
              options.onAdError?.(AD_UNAVAILABLE_TOAST);
            } catch {
              // Ignore callback errors
            }
          }
          resolve({ ok: granted, simulated: false });
        };

        try {
          sdk.ad!.requestAd!('rewarded', {
            adStarted: () => {
              if (startedCalled) return;
              startedCalled = true;
              try {
                options.onAdStarted?.();
              } catch {
                // Safe mute/pause hook
              }
            },
            adFinished: () => {
              finishOnce(true);
            },
            adError: () => {
              finishOnce(false);
            },
          });
        } catch {
          finishOnce(false);
        }
      });
    }

    // Standalone / Vercel / Disabled environment fallback: crisp 2-second simulated preview
    const totalMs = Math.max(0, options.simulatedDurationMs ?? SIMULATED_REWARDED_AD_MS);
    try {
      options.onAdStarted?.();
    } catch {
      // Safe fallback
    }

    if (totalMs <= 0) {
      this.adInProgress = false;
      options.onAdFinished?.();
      options.onRewardGranted();
      return { ok: true, simulated: true };
    }

    return new Promise<{ ok: boolean; simulated: boolean }>((resolve) => {
      const totalSeconds = Math.max(1, Math.ceil(totalMs / 1000));
      let secondsLeft = totalSeconds;
      options.onSimulatedTick?.(secondsLeft);

      const stepMs = Math.max(10, Math.round(totalMs / totalSeconds));
      const timer = globalThis.setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft > 0) {
          options.onSimulatedTick?.(secondsLeft);
          return;
        }
        globalThis.clearInterval(timer);
        this.adInProgress = false;
        try {
          options.onAdFinished?.();
        } catch {
          // Safe restore
        }
        try {
          options.onRewardGranted();
        } catch {
          // Safe reward callback
        }
        resolve({ ok: true, simulated: true });
      }, stepMs);
    });
  }

  /**
   * Checks whether the strict 3-minute midgame ad cooldown has elapsed.
   */
  public canShowMidgameAd(nowMs = Date.now()): boolean {
    if (this.lastMidgameAdAt === 0) return true;
    return nowMs - this.lastMidgameAdAt >= MIDGAME_AD_COOLDOWN_MS;
  }

  /**
   * Requests a CrazyGames v3 Midgame Ad (`sdk.ad.requestAd("midgame", callbacks)`)
   * strictly on natural post-match transitions (never mid-fight, max once per 3 minutes).
   * Returns `true` if a live midgame ad ran, or `false` if skipped (cooldown / disabled env).
   */
  public async requestMidgameAd(options: MidgameAdRequestOptions = {}): Promise<boolean> {
    if (this.adInProgress) return false;

    const nowMs = options.nowMs ?? Date.now();
    if (!this.canShowMidgameAd(nowMs)) {
      return false;
    }

    if (!this.initialized) {
      await this.init();
    }

    const sdk = resolveGlobalSdk();
    const canUseLiveSdk =
      this.environment !== 'disabled' && typeof sdk?.ad?.requestAd === 'function';

    if (!canUseLiveSdk || !sdk?.ad?.requestAd) {
      return false;
    }

    this.adInProgress = true;
    this.lastMidgameAdAt = nowMs;

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        this.adInProgress = false;
        try {
          if (ok) {
            options.onAdFinished?.();
          } else {
            options.onAdError?.();
            options.onAdFinished?.();
          }
        } catch {
          // Ensure transition always continues
        }
        resolve(ok);
      };

      try {
        sdk.ad!.requestAd!('midgame', {
          adStarted: () => {
            try {
              options.onAdStarted?.();
            } catch {
              // Safe audio mute hook
            }
          },
          adFinished: () => {
            settle(true);
          },
          adError: () => {
            settle(false);
          },
        });
      } catch {
        settle(false);
      }
    });
  }

  /**
   * Resets internal state cleanly for deterministic unit tests.
   */
  public resetForTests(): void {
    try {
      const sdk = resolveGlobalSdk();
      if (this.settingsListenerRef && sdk?.game?.removeSettingsChangeListener) {
        sdk.game.removeSettingsChangeListener(this.settingsListenerRef);
      }
    } catch {
      // Ignore cleanup errors in tests
    }
    this.initialized = false;
    this.initPromise = null;
    this.environment = 'disabled';
    this.loadingActive = false;
    this.loadingCompleted = false;
    this.gameplayActive = false;
    this.adInProgress = false;
    this.lastMidgameAdAt = 0;
    this.sdkSettingsBound = false;
    this.settingsListenerRef = null;
    this.muteListeners.clear();
  }
}

export const CG_SDK = new CrazyGamesSdkManager();
