// Zero-dependency procedural Web Audio API sound effects + upbeat Desi arcade music synthesizer
// + Web Audio API AudioBuffer Super Power MP3 player (zero-stutter RAM playback)

import type { FighterId } from './types';

export const SHERU_SUPER_AUDIO_URL = '/audio/supers/sheru.mp3';
export const BILLA_SUPER_AUDIO_URL = '/audio/supers/billa.mp3';
export const NETA_SUPER_AUDIO_URL = '/audio/supers/neta.mp3';
export const ANDA_SUPER_AUDIO_URL = '/audio/supers/anda.mp3';
export const MAUSI_SUPER_AUDIO_URL = '/audio/supers/mausi.mp3';
export const FATHER_SUPER_AUDIO_URL = '/audio/supers/father.mp3';
export const SAMYAK_SUPER_AUDIO_URL = '/audio/supers/ias.mp3';
export const ADI_SUPER_AUDIO_URL = '/audio/supers/adi.mp3';
export const DAHI_KO_AUDIO_URL = '/audio/supers/dahi.mp3';

export const SUPER_AUDIO_URLS: Partial<Record<FighterId, string>> = {
  sheru: SHERU_SUPER_AUDIO_URL,
  billa: BILLA_SUPER_AUDIO_URL,
  neta: NETA_SUPER_AUDIO_URL,
  anda: ANDA_SUPER_AUDIO_URL,
  mausi: MAUSI_SUPER_AUDIO_URL,
  father: FATHER_SUPER_AUDIO_URL,
  samyak: SAMYAK_SUPER_AUDIO_URL,
  adi: ADI_SUPER_AUDIO_URL,
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
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicPlaying = false;

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
      this.bgmGain.gain.setValueAtTime(this.globalMuted ? 0 : 1.0, this.ctx.currentTime);
      this.bgmGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !this.globalMuted && !this.audioPaused) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureSfxContext(ignoreSuperMute = false): AudioContext | null {
    if (this.globalMuted || this.audioPaused || this.sfxMuted) return null;
    if (!ignoreSuperMute && this.superSfxMuted) return null;
    return this.ensureContext();
  }

  /**
   * Preloads & decodes a Super Power MP3 into RAM (cached in module-level superAudioBuffers).
   * Safe to call before user gesture (caches raw ArrayBuffer bytes until AudioContext is available)
   * and fails silently if the MP3 asset is not yet uploaded.
   */
  public preloadSuperAudio(url = SHERU_SUPER_AUDIO_URL): Promise<AudioBuffer | null> {
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
          const res = await fetch(url);
          if (!res.ok) {
            superAudioFailedUrls.add(url);
            return null;
          }
          const contentType = (res.headers?.get?.('content-type') ?? '').toLowerCase();
          if (contentType.includes('text/html') || contentType.includes('application/json')) {
            // Vite SPA fallback returned index.html instead of an audio file
            superAudioFailedUrls.add(url);
            return null;
          }
          rawBytes = await res.arrayBuffer();
          if (!rawBytes || rawBytes.byteLength < 64) {
            superAudioFailedUrls.add(url);
            return null;
          }
          superAudioRawBytes.set(url, rawBytes);
        }

        const ctx = this.ctx ?? this.ensureContext();
        if (!ctx) {
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

  public preloadAllSuperAudios(): Promise<Array<AudioBuffer | null>> {
    return Promise.all([
      this.preloadSuperAudio(SHERU_SUPER_AUDIO_URL),
      this.preloadSuperAudio(BILLA_SUPER_AUDIO_URL),
      this.preloadSuperAudio(NETA_SUPER_AUDIO_URL),
      this.preloadSuperAudio(ANDA_SUPER_AUDIO_URL),
      this.preloadSuperAudio(MAUSI_SUPER_AUDIO_URL),
      this.preloadSuperAudio(FATHER_SUPER_AUDIO_URL),
      this.preloadSuperAudio(SAMYAK_SUPER_AUDIO_URL),
      this.preloadSuperAudio(ADI_SUPER_AUDIO_URL),
      this.preloadSuperAudio(DAHI_KO_AUDIO_URL),
    ]);
  }

  public unlock(): void {
    this.ensureContext();
    void this.preloadAllSuperAudios();
    if (!this.musicMuted && !this.musicPlaying) {
      this.startMusic();
    }
  }

  private duckBgmForSuper(): void {
    const ctx = this.ctx;
    const bgmGain = this.bgmGain;
    if (!ctx || !bgmGain) return;
    try {
      bgmGain.gain.setTargetAtTime(0.15, ctx.currentTime, 0.08);
    } catch {
      // Ignore Web Audio scheduling edge errors
    }
  }

  private restoreBgmFromSuper(): void {
    // Keep BGM ducked until both any active Super Power MP3 and the KO dahi.mp3 have finished
    if (this.superAudioActive || this.dahiAudioActive) return;
    const ctx = this.ctx;
    const bgmGain = this.bgmGain;
    if (!ctx || !bgmGain) return;
    try {
      bgmGain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.2);
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
    if (!this.ctx) return;
    const voiceLevel = this.globalMuted || this.sfxMuted ? 0 : 1.0;
    const bgmLevel =
      this.globalMuted || this.musicMuted
        ? 0
        : this.superAudioActive || this.dahiAudioActive
          ? 0.08
          : 1.0;
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
   * custom MP3 voice-lines, and any HTML5 media elements.
   */
  public setGlobalMuted(mute: boolean, resumeMusicIfUnmuted = true): void {
    this.globalMuted = mute;
    this.syncHtmlMediaMute(mute);
    this.syncActiveGains();
    if (mute) {
      this.stopMusic();
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } else if (!this.audioPaused) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
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
   * Suspends ALL playing audio immediately when the tab is hidden, minimized, or paused.
   */
  public pauseAllAudio(): void {
    this.audioPaused = true;
    this.stopMusic();
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
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
   * Resumes audio after returning from pause / tab switch (honoring current mute settings).
   */
  public resumeAllAudio(shouldPlayMusic = true): void {
    this.audioPaused = false;
    if (this.globalMuted) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.syncActiveGains();
    if (shouldPlayMusic && !this.musicMuted) {
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
      this.stopMusic();
    } else if (!this.globalMuted && !this.audioPaused) {
      this.startMusic();
    }
  }

  public isMusicMuted(): boolean {
    return this.musicMuted || this.globalMuted;
  }

  public startMusic(): void {
    if (
      this.globalMuted ||
      this.audioPaused ||
      this.musicMuted ||
      this.musicPlaying ||
      typeof window === 'undefined'
    ) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.musicPlaying = true;
    this.syncActiveGains();

    // Energetic Desi Dhol-Funk 16-step groove (C minor / Bhairav-inspired arcade riff)
    const bassNotes = [130.81, 0, 130.81, 146.83, 155.56, 0, 130.81, 196.0, 130.81, 0, 174.61, 155.56, 146.83, 0, 196.0, 146.83];
    const leadNotes = [523.25, 0, 587.33, 622.25, 0, 587.33, 523.25, 493.88, 523.25, 0, 698.46, 622.25, 587.33, 0, 523.25, 0];

    const stepTick = () => {
      if (
        !this.musicPlaying ||
        this.musicMuted ||
        this.globalMuted ||
        this.audioPaused ||
        !this.ctx ||
        this.ctx.state !== 'running'
      ) {
        return;
      }
      const now = this.ctx.currentTime;
      const idx = this.musicStep % 16;
      this.musicStep++;

      const bgmDest = this.bgmGain ?? this.ctx.destination;

      // Dhol low thump on beats 0, 4, 8, 11, 14
      if (idx === 0 || idx === 4 || idx === 8 || idx === 11 || idx === 14) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 || idx === 8 ? 115 : 145, now);
        osc.frequency.exponentialRampToValueAtTime(48, now + 0.11);
        gain.gain.setValueAtTime(0.085, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(bgmDest);
        osc.start(now);
        osc.stop(now + 0.13);
      }

      // Funky bass pulse
      const bFreq = bassNotes[idx];
      if (bFreq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bFreq, now);
        gain.gain.setValueAtTime(0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(bgmDest);
        osc.start(now);
        osc.stop(now + 0.15);
      }

      // Crisp arcade shehnai/synth hook
      const lFreq = leadNotes[idx];
      if (lFreq > 0 && idx % 2 === 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1400;
        osc.frequency.setValueAtTime(lFreq, now);
        gain.gain.setValueAtTime(0.025, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(bgmDest);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    };

    this.musicTimer = window.setInterval(stepTick, 145);
  }

  public stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
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
}

export const audioEngine = new DesiAudioEngine();
