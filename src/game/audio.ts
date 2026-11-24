// Zero-dependency procedural Web Audio API sound effects + upbeat Desi arcade music synthesizer

class DesiAudioEngine {
  private ctx: AudioContext | null = null;
  private sfxMuted = false;
  private musicMuted = false;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicPlaying = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureSfxContext(): AudioContext | null {
    if (this.sfxMuted) return null;
    return this.ensureContext();
  }

  public unlock(): void {
    this.ensureContext();
    if (!this.musicMuted && !this.musicPlaying) {
      this.startMusic();
    }
  }

  public setMuted(mute: boolean): void {
    this.sfxMuted = mute;
  }

  public isMuted(): boolean {
    return this.sfxMuted;
  }

  public setMusicMuted(mute: boolean): void {
    this.musicMuted = mute;
    if (mute) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public startMusic(): void {
    if (this.musicMuted || this.musicPlaying || typeof window === 'undefined') return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.musicPlaying = true;

    // Energetic Desi Dhol-Funk 16-step groove (C minor / Bhairav-inspired arcade riff)
    const bassNotes = [130.81, 0, 130.81, 146.83, 155.56, 0, 130.81, 196.0, 130.81, 0, 174.61, 155.56, 146.83, 0, 196.0, 146.83];
    const leadNotes = [523.25, 0, 587.33, 622.25, 0, 587.33, 523.25, 493.88, 523.25, 0, 698.46, 622.25, 587.33, 0, 523.25, 0];

    const stepTick = () => {
      if (!this.musicPlaying || this.musicMuted || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const idx = this.musicStep % 16;
      this.musicStep++;

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
        gain.connect(this.ctx.destination);
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
        gain.connect(this.ctx.destination);
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
        gain.connect(this.ctx.destination);
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
    const ctx = this.ensureSfxContext();
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
