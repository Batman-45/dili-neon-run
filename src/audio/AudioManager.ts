/**
 * High-performance Web Audio API synthesizer for Dili: Neon Run.
 * Generates low-latency, royalty-free cyberpunk sound effects without external audio files.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Streak counter for musical bit collection
  private bitStreakIndex: number = 0;
  private lastBitPickupTime: number = 0;
  private readonly pentatonicScale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5, D5, E5, G5, A5, C6

  constructor() {}

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public unlockAudio(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  public playJump(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.15);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playSlide(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const now = ctx.currentTime;
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(250, now + 0.2);
    filter.Q.value = 3.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.2);
  }

  public playDash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playDashSmash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playNearMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    [1046.5, 1567.98].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.25, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.18);
    });
  }

  public playStumble(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.setValueAtTime(90, now + 0.06);
    osc.frequency.setValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playCrash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.45);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // ==========================================
  // PHASE 4: COLLECTIBLES & POWER-UP AUDIO
  // ==========================================

  public playBitPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // Reset streak if more than 0.6s since last bit
    if (now - this.lastBitPickupTime > 0.6) {
      this.bitStreakIndex = 0;
    } else {
      this.bitStreakIndex = (this.bitStreakIndex + 1) % this.pentatonicScale.length;
    }
    this.lastBitPickupTime = now;

    const freq = this.pentatonicScale[this.bitStreakIndex];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playShieldActivate(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playShieldBreak(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Shatter sound: noise + dissonant decay
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playMagnetActivate(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.15);
    osc.frequency.linearRampToValueAtTime(450, now + 0.3);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playBoostActivate(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playMultiplierActivate(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    [659.25, 880, 1318.51].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      gain.gain.setValueAtTime(0.28, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.16);
    });
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public isSoundMuted(): boolean {
    return this.isMuted;
  }

  // ==========================================
  // PHASE 5: UI / SCREEN SOUNDS
  // ==========================================

  /** Short positive confirmation blip — for PLAY, RESUME, etc. */
  public playMenuClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Short descending blip — for BACK / dismiss actions. */
  public playMenuBack(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.1);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** Countdown tone — call with step 3, 2, 1 for three-beat buildup. */
  public playCountdownTone(step: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const freqs: Record<number, number> = { 3: 523.25, 2: 659.25, 1: 1046.5 };
    const freq = freqs[step] ?? 1046.5;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = step === 1 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(step === 1 ? 0.38 : 0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + (step === 1 ? 0.35 : 0.18));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (step === 1 ? 0.35 : 0.2));
  }

  /** Celebratory ascending arpeggio on new personal best. */
  public playNewBest(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.22, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.07 + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.22);
    });
  }

  /** Subtle pause thunk. */
  public playPause(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ==========================================
  // AMBIENT LOOP (Start Screen)
  // ==========================================

  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  /** Start a low, evolving ambient drone for the title/start screen. */
  public startAmbientLoop(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.ambientOsc) return;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0, ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.5);
    this.ambientGain.connect(this.masterGain);

    // Deep sub drone
    this.ambientOsc = ctx.createOscillator();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.setValueAtTime(55, ctx.currentTime);
    this.ambientOsc.connect(this.ambientGain);
    this.ambientOsc.start();

    // Slow LFO modulation for movement
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
    lfoGain.gain.setValueAtTime(8, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(this.ambientOsc.frequency);
    lfo.start();
  }

  /** Fade out and stop the ambient drone. */
  public stopAmbientLoop(): void {
    if (!this.ambientGain || !this.ambientOsc || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.ambientGain.gain.linearRampToValueAtTime(0, now + 0.6);
    const osc = this.ambientOsc;
    const gainNode = this.ambientGain;
    setTimeout(() => {
      try { osc.stop(); } catch (_) {}
      try { gainNode.disconnect(); } catch (_) {}
    }, 700);
    this.ambientOsc = null;
    this.ambientGain = null;
  }

  /** Cleanly suspend audio when browser tab is hidden/backgrounded */
  public suspendAudio(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  /** Cleanly resume audio when browser tab is restored/visible */
  public resumeAudio(): void {
    if (!this.isMuted && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
}

