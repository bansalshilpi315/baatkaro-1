// Zero-dependency procedural Web Audio API sound effects + upbeat Desi arcade music synthesizer
// + Web Audio API AudioBuffer Super Power MP3 player (zero-stutter RAM playback)

import type { FighterId } from './types';

export const BGM_AUDIO_URL = '/audio/bgm.mp3';
export const BGM_DEFAULT_GAIN = 0.35;
export const BGM_DUCKED_GAIN = 0.1;

export const SHERU_SUPER_AUDIO_URL = '/audio/supers/sheru.mp3';
export const BILLA_SUPER_AUDIO_URL = '/audio/supers/billa.mp3';
export const UTKARSH_SUPER_AUDIO_URL = '/audio/supers/utkarsh.mp3';
export const NETA_SUPER_AUDIO_URL = '/audio/supers/neta.mp3';
export const ANDA_SUPER_AUDIO_URL = '/audio/supers/anda.mp3';
export const MAUSI_SUPER_AUDIO_URL = '/audio/supers/mausi.mp3';
export const FATHER_SUPER_AUDIO_URL = '/audio/supers/father.mp3';
export const SAMYAK_SUPER_AUDIO_URL = '/audio/supers/ias.mp3';
export const ADI_SUPER_AUDIO_URL = '/audio/supers/adi.mp3';
export const KRISH_SUPER_AUDIO_URL = '/audio/supers/krish.mp3';
export const DAHI_KO_AUDIO_URL = '/audio/supers/dahi.mp3';

export const SUPER_AUDIO_URLS: Partial<Record<FighterId, string>> = {
  sheru: SHERU_SUPER_AUDIO_URL,
  billa: BILLA_SUPER_AUDIO_URL,
  utkarsh: UTKARSH_SUPER_AUDIO_URL,
  neta: NETA_SUPER_AUDIO_URL,
  anda: ANDA_SUPER_AUDIO_URL,
  mausi: MAUSI_SUPER_AUDIO_URL,
  father: FATHER_SUPER_AUDIO_URL,
  samyak: SAMYAK_SUPER_AUDIO_URL,
  adi: ADI_SUPER_AUDIO_URL,
  krish: KRISH_SUPER_AUDIO_URL,
};

export function getSuperAudioUrl(fighterId: FighterId): string | null {
  return SUPER_AUDIO_URLS[fighterId] ?? null;
}

// Persistent module-level caches for decoded Super Power AudioBuffers & fetched bytes
const superAudioBuffers = new Map<string, AudioBuffer>();
const superAudioRawBytes = new Map<string, ArrayBuffer>();
const superAudioFailedUrls = new Set<string>();
const superAudioLoadPromises = new Map<string, Promise<AudioBuffer | null>>();

export function clearSuperAudioCacheForTests(): void {
  superAudioBuffers.clear();
  superAudioRawBytes.clear();
  superAudioFailedUrls.clear();
  superAudioLoadPromises.clear();
}

export class DesiAudioEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private globalMuted = false;
  private audioPaused = false;
  private sfxMuted = false;
  private superSfxMuted = false;
  private musicMuted = false;
  private musicPlaying = false;
  private musicDesired = false;
  private bootReady = true;
  private portraitBlocked = false;

  // Gapless continuous /audio/bgm.mp3 Web Audio BufferSource + HTMLAudio fallback
  private bgmBufferSource: AudioBufferSourceNode | null = null;
  private bgmHtmlAudio: HTMLAudioElement | null = null;
  private bgmUsingMp3 = false;

  // Active Web Audio API Super MP3 playback state
  private activeSuperSource: AudioBufferSourceNode | null = null;
  private activeSuperGain: GainNode | null = null;
  private superAudioActive = false;
  private superPlaybackToken = 0;

  // Active Web Audio API KO ("DAHI KHATAM!") MP3 playback state
  private activeDahiSource: AudioBufferSourceNode | null = null;
  private activeDahiGain: GainNode | null = null;
  private dahiAudioActive = false;
  private dahiAudioPending = false;
  private dahiPlaybackToken = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.bgmGain = this.ctx.createGain();
      const initialBgmGain = this.globalMuted || this.musicMuted ? 0 : BGM_DEFAULT_GAIN;
      this.bgmGain.gain.setValueAtTime(initialBgmGain, this.ctx.currentTime);
      this.bgmGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !this.globalMuted && !this.audioPaused) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureSfxContext(ignoreSuperMute = false): AudioContext | null {
    if (
      this.globalMuted ||
      this.audioPaused ||
      this.sfxMuted ||
      !this.bootReady ||
      this.portraitBlocked
    ) {
      return null;
    }
    if (!ignoreSuperMute && this.superSfxMuted) return null;
    return this.ensureContext();
  }

  /**
   * Preloads & decodes an MP3 into RAM (cached in module-level superAudioBuffers)
   * with automatic retry (up to 2 retries, 300ms backoff) on transient network errors.
   * Safe to call before user gesture (caches raw ArrayBuffer bytes until AudioContext is available)
   * and fails silently if the MP3 asset is not yet uploaded or empty.
   */
  public preloadSuperAudio(
    url = SHERU_SUPER_AUDIO_URL,
    maxRetries = 2,
    retryBackoffMs = 300,
  ): Promise<AudioBuffer | null> {
    if (superAudioBuffers.has(url)) {
      return Promise.resolve(superAudioBuffers.get(url)!);
    }
    if (superAudioFailedUrls.has(url) || typeof fetch !== 'function') {
      return Promise.resolve(null);
    }
    const existing = superAudioLoadPromises.get(url);
    if (existing) {
      return existing;
    }

    const loadTask = (async (): Promise<AudioBuffer | null> => {
      try {
        let rawBytes = superAudioRawBytes.get(url);
        if (!rawBytes) {
          let lastStatus: number | null = null;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const res = await fetch(url);
              lastStatus = res.status;
              if (!res.ok) {
                // Retry on 5xx / transient errors, skip immediately on hard 404
                if (res.status === 404 || attempt >= maxRetries) {
                  superAudioFailedUrls.add(url);
                  return null;
                }
                await new Promise((r) => globalThis.setTimeout(r, retryBackoffMs));
                continue;
              }
              const contentType = (res.headers?.get?.('content-type') ?? '').toLowerCase();
              if (contentType.includes('text/html') || contentType.includes('application/json')) {
                // Vite SPA fallback returned index.html instead of an audio file
                superAudioFailedUrls.add(url);
                return null;
              }
              const bytes = await res.arrayBuffer();
              if (!bytes || bytes.byteLength < 64) {
                // Empty placeholder MP3 file: treat cleanly as optional missing audio
                superAudioFailedUrls.add(url);
                return null;
              }
              rawBytes = bytes;
              superAudioRawBytes.set(url, rawBytes);
              break;
            } catch {
              if (attempt >= maxRetries) {
                if (lastStatus === 404) superAudioFailedUrls.add(url);
                return null;
              }
              await new Promise((r) => globalThis.setTimeout(r, retryBackoffMs));
            }
          }
        }

        if (!rawBytes) return null;

        const ctx = this.ctx ?? this.ensureContext();
        if (!ctx || typeof ctx.decodeAudioData !== 'function') {
          // Keep rawBytes cached so decode runs as soon as AudioContext becomes available
          return null;
        }

        const decoded = await ctx.decodeAudioData(rawBytes.slice(0));
        superAudioBuffers.set(url, decoded);
        superAudioRawBytes.delete(url);
        return decoded;
      } catch {
        // Crash-safe silent fallback when MP3 is absent or undecodable
        superAudioFailedUrls.add(url);
        return null;
      } finally {
        superAudioLoadPromises.delete(url);
      }
    })();

    superAudioLoadPromises.set(url, loadTask);
    return loadTask;
  }

  public preloadBgmAudio(maxRetries = 2, retryBackoffMs = 300): Promise<AudioBuffer | null> {
    return this.preloadSuperAudio(BGM_AUDIO_URL, maxRetries, retryBackoffMs);
  }

  public preloadAllSuperAudios(): Promise<Array<AudioBuffer | null>> {
    return Promise.all([
      this.preloadBgmAudio(),
      this.preloadSuperAudio(SHERU_SUPER_AUDIO_URL),
      this.preloadSuperAudio(BILLA_SUPER_AUDIO_URL),
      this.preloadSuperAudio(UTKARSH_SUPER_AUDIO_URL),
      this.preloadSuperAudio(NETA_SUPER_AUDIO_URL),
      this.preloadSuperAudio(ANDA_SUPER_AUDIO_URL),
      this.preloadSuperAudio(MAUSI_SUPER_AUDIO_URL),
      this.preloadSuperAudio(FATHER_SUPER_AUDIO_URL),
      this.preloadSuperAudio(SAMYAK_SUPER_AUDIO_URL),
      this.preloadSuperAudio(ADI_SUPER_AUDIO_URL),
      this.preloadSuperAudio(KRISH_SUPER_AUDIO_URL),
      this.preloadSuperAudio(DAHI_KO_AUDIO_URL),
    ]);
  }

  /**
   * Controls whether startup boot preloading has completed (100% loaded).
   * While false, BGM and SFX remain strictly silent.
   */
  public setBootReady(ready: boolean): void {
    this.bootReady = ready;
    if (!ready) {
      this.syncActiveGains();
    }
  }

  public isBootReady(): boolean {
    return this.bootReady;
  }

  /**
   * Controls whether the mobile portrait rotation overlay is actively blocking gameplay.
   * While true, all audio is suspended silently; returning to landscape resumes cleanly.
   */
  public setPortraitBlocked(blocked: boolean): void {
    if (this.portraitBlocked === blocked) return;
    this.portraitBlocked = blocked;
    if (blocked) {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
      if (this.bgmHtmlAudio && !this.bgmHtmlAudio.paused) {
        this.bgmHtmlAudio.pause();
      }
    } else if (this.bootReady && !this.globalMuted && !this.audioPaused) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.syncActiveGains();
      if (!this.musicMuted) {
        this.startMusic();
      }
    }
  }

  public isPortraitBlocked(): boolean {
    return this.portraitBlocked;
  }

  public unlock(): void {
    if (!this.bootReady || this.portraitBlocked) return;
    this.ensureContext();
    void this.preloadAllSuperAudios().then(() => {
      // If bgm.mp3 decoded right after first user gesture and music is active/desired, start gapless MP3 cleanly
      if (
        this.bootReady &&
        !this.portraitBlocked &&
        this.musicDesired &&
        !this.bgmUsingMp3 &&
        !this.audioPaused &&
        !this.globalMuted &&
        !this.musicMuted &&
        superAudioBuffers.has(BGM_AUDIO_URL)
      ) {
        this.startGaplessBgmBuffer();
      }
    });
    if (!this.globalMuted && !this.musicMuted && !this.audioPaused) {
      this.startMusic();
    }
  }

  /**
   * Attempts to start continuous `/audio/bgm.mp3` immediately after 100% boot finishes
   * if AudioContext is already unlocked and device is not blocked in portrait mode.
   */
  public tryAutoStartMusic(): void {
    if (
      !this.bootReady ||
      this.portraitBlocked ||
      this.globalMuted ||
      this.musicMuted ||
      this.audioPaused
    ) {
      return;
    }
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'running') {
      this.startMusic();
    }
  }

  private getTargetBgmGain(): number {
    if (this.globalMuted || this.musicMuted) return 0;
    if (this.superAudioActive || this.dahiAudioActive) return BGM_DUCKED_GAIN;
    return BGM_DEFAULT_GAIN;
  }

  private duckBgmForSuper(): void {
    const ctx = this.ctx;
    const bgmGain = this.bgmGain;
    if (this.bgmHtmlAudio) {
      this.bgmHtmlAudio.volume = this.globalMuted || this.musicMuted ? 0 : BGM_DUCKED_GAIN;
    }
    if (!ctx || !bgmGain) return;
    try {
      const target = this.globalMuted || this.musicMuted ? 0 : BGM_DUCKED_GAIN;
      bgmGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    } catch {
      // Ignore Web Audio scheduling edge errors
    }
  }

  private restoreBgmFromSuper(): void {
    // Keep BGM ducked until both any active Super Power MP3 and the KO dahi.mp3 have finished
    if (this.superAudioActive || this.dahiAudioActive) return;
    const target = this.getTargetBgmGain();
    if (this.bgmHtmlAudio) {
      this.bgmHtmlAudio.volume = target;
    }
    const ctx = this.ctx;
    const bgmGain = this.bgmGain;
    if (!ctx || !bgmGain) return;
    try {
      bgmGain.gain.setTargetAtTime(target, ctx.currentTime, 0.2);
    } catch {
      // Ignore Web Audio scheduling edge errors
    }
  }

  private startDecodedSuperBuffer(
    ctx: AudioContext,
    buffer: AudioBuffer,
    token: number,
  ): void {
    if (token !== this.superPlaybackToken || this.superAudioActive) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(this.globalMuted || this.sfxMuted ? 0 : 1.0, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);

      this.activeSuperSource = source;
      this.activeSuperGain = gain;
      this.superAudioActive = true;

      source.onended = () => {
        if (this.activeSuperSource === source) {
          this.activeSuperSource = null;
          this.activeSuperGain = null;
          this.superAudioActive = false;
          this.superSfxMuted = false;
          this.restoreBgmFromSuper();
        }
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // Ignore disconnect cleanup errors
        }
      };

      source.start(0);
    } catch {
      this.activeSuperSource = null;
      this.activeSuperGain = null;
      this.superAudioActive = false;
    }
  }

  public isSuperAudioDecoded(url: string): boolean {
    return superAudioBuffers.has(url);
  }

  /**
   * Silently wakes/resumes AudioContext on Super activation frame 0 without
   * playing any audio yet, so the frame-locked next-rAF `playFighterSuperAudio`
   * starts with zero wake-up jitter.
   */
  public prepareForSuperAudio(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended' && !this.globalMuted && !this.audioPaused) {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * Plays a Super Power MP3 from decoded RAM AudioBuffer on the browser's audio thread.
   * Ducks BGM ONCE via setTargetAtTime(0.15, now, 0.08) and restores cleanly on source.onended.
   * Guards against overlapping playback if triggered again while active.
   */
  public playSuperAudio(url = SHERU_SUPER_AUDIO_URL): void {
    // Guard against overlapping Super playback if already active
    if (this.superAudioActive) return;

    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended' && !this.globalMuted && !this.audioPaused) {
      ctx.resume().catch(() => {});
    }

    // Duck BGM smoothly ONCE and mute generic synth combat SFX
    this.duckBgmForSuper();
    this.superSfxMuted = true;

    if (!ctx) return;

    const token = ++this.superPlaybackToken;
    const cached = superAudioBuffers.get(url);
    if (cached) {
      this.startDecodedSuperBuffer(ctx, cached, token);
      return;
    }

    // Fallback: decode & start as soon as preload resolves (or synth fallback if MP3 is absent)
    void this.preloadSuperAudio(url).then((decoded) => {
      if (token !== this.superPlaybackToken) return;
      if (!decoded || !this.ctx) {
        if (!this.superAudioActive) {
          this.superSfxMuted = false;
          this.restoreBgmFromSuper();
          if (this.ctx && typeof this.ctx.createOscillator === 'function') {
            try {
              this.playSuper();
            } catch {
              // Ignore synth fallback errors in restricted audio contexts
            }
          }
        }
        return;
      }
      this.startDecodedSuperBuffer(this.ctx, decoded, token);
    });
  }

  public playSheruSuperAudio(): void {
    this.playSuperAudio(SHERU_SUPER_AUDIO_URL);
  }

  public playBillaSuperAudio(): void {
    this.playSuperAudio(BILLA_SUPER_AUDIO_URL);
  }

  public playNetaSuperAudio(): void {
    this.playSuperAudio(NETA_SUPER_AUDIO_URL);
  }

  public playAndaSuperAudio(): void {
    this.playSuperAudio(ANDA_SUPER_AUDIO_URL);
  }

  public playMausiSuperAudio(): void {
    this.playSuperAudio(MAUSI_SUPER_AUDIO_URL);
  }

  public playFatherSuperAudio(): void {
    this.playSuperAudio(FATHER_SUPER_AUDIO_URL);
  }

  public playAdiSuperAudio(): void {
    this.playSuperAudio(ADI_SUPER_AUDIO_URL);
  }

  public playKrishSuperAudio(): void {
    this.playSuperAudio(KRISH_SUPER_AUDIO_URL);
  }

  public playUtkarshSuperAudio(): void {
    this.playSuperAudio(UTKARSH_SUPER_AUDIO_URL);
  }

  public playFighterSuperAudio(fighterId: FighterId): void {
    const url = getSuperAudioUrl(fighterId);
    if (url) {
      this.playSuperAudio(url);
    } else {
      this.playSuper();
    }
  }

  /**
   * Called when the Super animation finishes:
   * NEVER stops or cuts off an active AudioBufferSourceNode — lets it finish naturally via onended.
   * Only restores BGM/SFX if no custom MP3 AudioBufferSourceNode is playing (e.g. missing MP3 fallback).
   */
  public notifySuperAnimationEnd(): void {
    if (this.superAudioActive) {
      return;
    }
    this.superSfxMuted = false;
    this.restoreBgmFromSuper();
  }

  /**
   * Explicitly stops Super audio ONLY when the player restarts the match, exits to Select/Title,
   * or the engine is disposed.
   */
  public stopSuperAudio(): void {
    this.superPlaybackToken += 1;
    const source = this.activeSuperSource;
    const gain = this.activeSuperGain;
    this.activeSuperSource = null;
    this.activeSuperGain = null;
    this.superAudioActive = false;
    this.superSfxMuted = false;

    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Ignore if already stopped
      }
      try {
        source.disconnect();
      } catch {
        // Ignore
      }
    }
    if (gain) {
      try {
        gain.disconnect();
      } catch {
        // Ignore
      }
    }

    this.restoreBgmFromSuper();
  }

  public stopSheruSuperAudio(): void {
    this.stopSuperAudio();
  }

  public isSuperAudioPlaying(): boolean {
    return this.superAudioActive;
  }

  private startDecodedDahiBuffer(
    ctx: AudioContext,
    buffer: AudioBuffer,
    token: number,
  ): void {
    if (token !== this.dahiPlaybackToken || this.dahiAudioActive) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(this.globalMuted || this.sfxMuted ? 0 : 1.0, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);

      this.activeDahiSource = source;
      this.activeDahiGain = gain;
      this.dahiAudioActive = true;
      this.dahiAudioPending = false;

      source.onended = () => {
        if (this.activeDahiSource === source) {
          this.activeDahiSource = null;
          this.activeDahiGain = null;
          this.dahiAudioActive = false;
          this.restoreBgmFromSuper();
        }
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // Ignore disconnect cleanup errors
        }
      };

      source.start(0);
    } catch {
      this.activeDahiSource = null;
      this.activeDahiGain = null;
      this.dahiAudioActive = false;
      this.dahiAudioPending = false;
      this.restoreBgmFromSuper();
    }
  }

  /**
   * Plays the custom "DAHI KHATAM!" KO MP3 (/audio/supers/dahi.mp3) from the shared RAM AudioBuffer cache.
   * Ducks BGM smoothly to 15% via setTargetAtTime, lets the audio finish naturally on source.onended
   * (never cut off on transition to "<CHARACTER> WINS" or Newspaper screen), guards against duplicate
   * rapid triggers on the same KO, and fails silently without ducking BGM if the MP3 is not uploaded yet.
   */
  public playDahiKoAudio(): void {
    if (this.dahiAudioActive || this.dahiAudioPending) return;
    if (superAudioFailedUrls.has(DAHI_KO_AUDIO_URL)) return;

    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended' && !this.globalMuted && !this.audioPaused) {
      ctx.resume().catch(() => {});
    }
    if (!ctx) return;

    const token = ++this.dahiPlaybackToken;
    const cached = superAudioBuffers.get(DAHI_KO_AUDIO_URL);
    if (cached) {
      this.duckBgmForSuper();
      this.startDecodedDahiBuffer(ctx, cached, token);
      return;
    }

    this.dahiAudioPending = true;
    void this.preloadSuperAudio(DAHI_KO_AUDIO_URL).then((decoded) => {
      if (token !== this.dahiPlaybackToken) return;
      this.dahiAudioPending = false;
      if (!decoded || !this.ctx || this.dahiAudioActive) return;
      this.duckBgmForSuper();
      this.startDecodedDahiBuffer(this.ctx, decoded, token);
    });
  }

  /**
   * Explicitly stops "DAHI KHATAM!" KO audio ONLY when the player clicks Rematch,
   * exits to Character Select / Title, or the engine is disposed.
   */
  public stopDahiKoAudio(): void {
    this.dahiPlaybackToken += 1;
    const source = this.activeDahiSource;
    const gain = this.activeDahiGain;
    this.activeDahiSource = null;
    this.activeDahiGain = null;
    this.dahiAudioActive = false;
    this.dahiAudioPending = false;

    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Ignore if already stopped
      }
      try {
        source.disconnect();
      } catch {
        // Ignore
      }
    }
    if (gain) {
      try {
        gain.disconnect();
      } catch {
        // Ignore
      }
    }

    this.restoreBgmFromSuper();
  }

  public isDahiKoAudioPlaying(): boolean {
    return this.dahiAudioActive;
  }

  private syncHtmlMediaMute(mute: boolean): void {
    if (typeof document === 'undefined') return;
    try {
      const mediaEls = document.querySelectorAll('audio, video');
      mediaEls.forEach((el) => {
        const media = el as HTMLMediaElement;
        media.muted = mute;
        if (mute && !media.paused) {
          media.pause();
        }
      });
    } catch {
      // Ignore DOM media errors
    }
  }

  private syncActiveGains(): void {
    const bgmLevel = this.getTargetBgmGain();
    if (this.bgmHtmlAudio) {
      this.bgmHtmlAudio.muted = this.globalMuted || this.musicMuted;
      this.bgmHtmlAudio.volume = bgmLevel;
    }
    if (!this.ctx) return;
    const voiceLevel = this.globalMuted || this.sfxMuted ? 0 : 1.0;
    if (this.bgmGain) {
      try {
        this.bgmGain.gain.setTargetAtTime(bgmLevel, this.ctx.currentTime, 0.025);
      } catch {
        // Ignore
      }
    }
    if (this.activeSuperGain) {
      try {
        this.activeSuperGain.gain.setTargetAtTime(voiceLevel, this.ctx.currentTime, 0.025);
      } catch {
        // Ignore
      }
    }
    if (this.activeDahiGain) {
      try {
        this.activeDahiGain.gain.setTargetAtTime(voiceLevel, this.ctx.currentTime, 0.025);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Global master mute toggle (Poki / CrazyGames QA requirement):
   * Immediately silences/restores ALL active BGM, Web Audio contexts, SFX,
   * custom MP3 voice-lines, and any HTML5 media elements WITHOUT resetting BGM track position.
   */
  public setGlobalMuted(mute: boolean, resumeMusicIfUnmuted = true): void {
    this.globalMuted = mute;
    this.syncHtmlMediaMute(mute);
    this.syncActiveGains();
    if (mute) {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } else if (!this.audioPaused && this.bootReady && !this.portraitBlocked) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.bgmHtmlAudio && this.musicDesired && !this.musicMuted) {
        this.bgmHtmlAudio.muted = false;
        this.bgmHtmlAudio.volume = this.getTargetBgmGain();
        this.bgmHtmlAudio.play().catch(() => {});
      }
      if (resumeMusicIfUnmuted && !this.musicMuted) {
        this.startMusic();
      }
    }
  }

  public isGlobalMuted(): boolean {
    return this.globalMuted;
  }

  /**
   * Suspends ALL playing audio immediately when the tab is hidden, minimized, or paused
   * WITHOUT resetting continuous BGM playback position.
   */
  public pauseAllAudio(): void {
    this.audioPaused = true;
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
    if (this.bgmHtmlAudio && !this.bgmHtmlAudio.paused) {
      this.bgmHtmlAudio.pause();
    }
    if (typeof document !== 'undefined') {
      try {
        document.querySelectorAll('audio').forEach((el) => {
          if (!el.paused) el.pause();
        });
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Resumes audio after returning from pause / tab switch from the exact paused position
   * (honoring current mute settings, boot gate, and portrait overlay).
   */
  public resumeAllAudio(shouldPlayMusic = true): void {
    this.audioPaused = false;
    if (this.globalMuted || !this.bootReady || this.portraitBlocked) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.syncActiveGains();
    if (shouldPlayMusic && !this.musicMuted) {
      if (this.bgmHtmlAudio && this.musicDesired) {
        this.bgmHtmlAudio.muted = false;
        this.bgmHtmlAudio.volume = this.getTargetBgmGain();
        this.bgmHtmlAudio.play().catch(() => {});
      }
      this.startMusic();
    }
  }

  public setMuted(mute: boolean): void {
    this.sfxMuted = mute;
    this.syncActiveGains();
  }

  public isMuted(): boolean {
    return this.sfxMuted || this.globalMuted;
  }

  public setMusicMuted(mute: boolean): void {
    this.musicMuted = mute;
    this.syncActiveGains();
    if (mute) {
      // Preserve continuous gapless BGM playback position by muting bgmGainNode (gain=0)
      if (this.bgmHtmlAudio) {
        this.bgmHtmlAudio.muted = true;
      }
    } else if (!this.globalMuted && !this.audioPaused && this.bootReady && !this.portraitBlocked) {
      if (this.bgmHtmlAudio && this.musicDesired) {
        this.bgmHtmlAudio.muted = false;
        this.bgmHtmlAudio.volume = this.getTargetBgmGain();
        this.bgmHtmlAudio.play().catch(() => {});
      }
      this.startMusic();
    }
  }

  public isMusicMuted(): boolean {
    return this.musicMuted || this.globalMuted;
  }

  public isBgmLooping(): boolean {
    return Boolean(this.bgmBufferSource?.loop || this.bgmHtmlAudio?.loop);
  }

  public isUsingMp3Bgm(): boolean {
    return this.bgmUsingMp3;
  }

  /**
   * Starts sample-accurate gapless looping of decoded `/audio/bgm.mp3` via
   * a dedicated Web Audio `AudioBufferSourceNode` (`source.loop = true`) routed
   * through `bgmGain` (~0.35). Never restarts if already playing.
   */
  private startGaplessBgmBuffer(): boolean {
    if (this.bgmBufferSource) {
      this.bgmUsingMp3 = true;
      this.musicPlaying = true;
      this.syncActiveGains();
      return true;
    }
    const buffer = superAudioBuffers.get(BGM_AUDIO_URL);
    const ctx = this.ctx ?? this.ensureContext();
    if (!buffer || !ctx || !this.bgmGain) return false;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.bgmGain);
      this.bgmGain.gain.setValueAtTime(this.getTargetBgmGain(), ctx.currentTime);
      source.start(0);
      this.bgmBufferSource = source;
      this.bgmUsingMp3 = true;
      this.musicPlaying = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * HTML5 `<audio loop>` fallback used ONLY when Web Audio decoding is unavailable
   * while `/audio/bgm.mp3` exists.
   */
  private startHtmlAudioBgmFallback(): boolean {
    if (typeof Audio === 'undefined' || superAudioFailedUrls.has(BGM_AUDIO_URL)) {
      return false;
    }
    if (!superAudioRawBytes.has(BGM_AUDIO_URL)) {
      return false;
    }
    try {
      if (!this.bgmHtmlAudio) {
        const el = new Audio(BGM_AUDIO_URL);
        el.loop = true;
        el.preload = 'auto';
        this.bgmHtmlAudio = el;
      }
      this.bgmHtmlAudio.muted = this.globalMuted || this.musicMuted;
      this.bgmHtmlAudio.volume = this.getTargetBgmGain();
      void this.bgmHtmlAudio.play().catch(() => {});
      this.bgmUsingMp3 = true;
      this.musicPlaying = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Starts ONLY `/audio/bgm.mp3` via gapless Web Audio `AudioBufferSourceNode` (`loop = true`).
   * Legacy procedural/synth BGM fallback has been completely removed so no wrong/old tune can ever play.
   */
  public startMusic(): void {
    if (!this.bootReady || this.portraitBlocked) {
      return;
    }
    this.musicDesired = true;
    if (this.globalMuted || this.audioPaused || this.musicMuted || typeof window === 'undefined') {
      return;
    }

    // Never restart or cut continuous BGM if gapless MP3 loop is already running
    if (this.bgmBufferSource) {
      this.syncActiveGains();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.musicPlaying = true;
      return;
    }

    const ctx = this.ensureContext();

    // 1. Primary path: sample-accurate gapless Web Audio API AudioBufferSourceNode loop
    if (superAudioBuffers.has(BGM_AUDIO_URL) && this.startGaplessBgmBuffer()) {
      return;
    }

    // 2. If raw bytes were preloaded before AudioContext was unlocked, decode & start gapless loop
    if (superAudioRawBytes.has(BGM_AUDIO_URL)) {
      if (ctx && typeof ctx.decodeAudioData === 'function') {
        void this.preloadBgmAudio().then((decoded) => {
          if (
            decoded &&
            this.bootReady &&
            !this.portraitBlocked &&
            this.musicDesired &&
            !this.audioPaused &&
            !this.globalMuted &&
            !this.musicMuted
          ) {
            this.startGaplessBgmBuffer();
          }
        });
        return;
      }
      // Fallback to <audio loop> only when Web Audio decodeAudioData is unavailable
      if (this.startHtmlAudioBgmFallback()) {
        return;
      }
    }

    // 3. If /audio/bgm.mp3 has not yet been fetched and hasn't failed, fetch & decode cleanly
    if (!superAudioFailedUrls.has(BGM_AUDIO_URL) && typeof fetch === 'function') {
      void this.preloadBgmAudio().then((decoded) => {
        if (
          decoded &&
          this.bootReady &&
          !this.portraitBlocked &&
          this.musicDesired &&
          !this.audioPaused &&
          !this.globalMuted &&
          !this.musicMuted
        ) {
          this.startGaplessBgmBuffer();
        }
      });
    }
  }

  /**
   * Stops and tears down BGM completely (called ONLY on full app unmount / dispose).
   */
  public stopMusic(): void {
    this.musicDesired = false;
    this.musicPlaying = false;
    this.bgmUsingMp3 = false;
    if (this.bgmBufferSource) {
      try {
        this.bgmBufferSource.stop();
      } catch {
        // Ignore if already stopped
      }
      try {
        this.bgmBufferSource.disconnect();
      } catch {
        // Ignore
      }
      this.bgmBufferSource = null;
    }
    if (this.bgmHtmlAudio) {
      try {
        this.bgmHtmlAudio.pause();
        this.bgmHtmlAudio.currentTime = 0;
      } catch {
        // Ignore
      }
      this.bgmHtmlAudio = null;
    }
  }

  private pitchJitter(base: number): number {
    return base * (0.93 + Math.random() * 0.14);
  }

  private playNoiseBurst(duration: number, filterFreq: number, gainPeak: number): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-i / sampleCount) * 4);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playUiClick(): void {
    const ctx = this.ensureSfxContext(true);
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.055);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playWhiff(): void {
    this.playNoiseBurst(0.08, this.pitchJitter(950), 0.09);
  }

  public playJump(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.pitchJitter(190), now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playPunchHit(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.pitchJitter(175), now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
    this.playNoiseBurst(0.09, 1400, 0.22);
  }

  public playHeavyHit(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.pitchJitter(145), now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    this.playNoiseBurst(0.15, 920, 0.3);
  }

  public playBlock(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(this.pitchJitter(640), now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playSpecial(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [330, 440, 587];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + idx * 0.04;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, t + 0.1);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  public playSwatterSlap(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Quick cartoon whoosh followed by a sharp plastic flyswatter SLAP crack
    this.playNoiseBurst(0.07, 1900, 0.16);

    const slapTime = now + 0.055;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.pitchJitter(540), slapTime);
    osc.frequency.exponentialRampToValueAtTime(88, slapTime + 0.095);
    gain.gain.setValueAtTime(0.36, slapTime);
    gain.gain.exponentialRampToValueAtTime(0.001, slapTime + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(slapTime);
    osc.stop(slapTime + 0.12);

    // High-snap plastic crack burst
    const sampleCount = Math.floor(ctx.sampleRate * 0.085);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-i / sampleCount) * 6.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2650;
    filter.Q.value = 1.4;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.38, slapTime);
    nGain.gain.exponentialRampToValueAtTime(0.001, slapTime + 0.085);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    src.start(slapTime);
  }

  public playBelanBonk(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Hollow wooden rolling-pin primary resonant BONK!
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const startFreq = this.pitchJitter(410);
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(175, now + 0.085);
    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.115);

    // Secondary bright wooden overtone knock
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(startFreq * 2.05, now);
    osc2.frequency.exponentialRampToValueAtTime(startFreq * 1.18, now + 0.048);
    gain2.gain.setValueAtTime(0.22, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.06);

    // Crisp dry wooden impact tap burst
    this.playNoiseBurst(0.045, 1350, 0.26);
  }

  public playSuper(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [220, 330, 440, 660, 880];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + idx * 0.035;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.4, t + 0.25);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    this.playNoiseBurst(0.25, 700, 0.24);
  }

  public playKo(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [130, 92, 65].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 2 ? 'sine' : 'triangle';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq * 1.3, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.45);
      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.52);
    });
    this.playNoiseBurst(0.32, 600, 0.34);
  }

  public playVictoryFanfare(): void {
    const ctx = this.ensureSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const melody = [392, 440, 523.25, 587.33, 659.25, 783.99];
    melody.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.085;
      const dur = idx === melody.length - 1 ? 0.45 : 0.11;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  }

  public playUnlockFanfare(): void {
    const ctx = this.ensureSfxContext(true);
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      const t = now + idx * 0.065;
      const dur = idx === notes.length - 1 ? 0.42 : 0.14;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  }
}

export const audioEngine = new DesiAudioEngine();
