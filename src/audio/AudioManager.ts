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

  // In-Game Procedural BGM
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmBuffer: AudioBuffer | null = null;
  private bgmStartTime: number = 0;
  private bgmPlaybackOffset: number = 0;
  private isBgmPlaying: boolean = false;
  private readonly bgmTargetGain: number = 0.22;

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

  // ==========================================
  // IN-GAME PROCEDURAL SYNTHWAVE BGM
  // ==========================================

  /**
   * Starts playing the in-game procedural synthwave BGM with a smooth ~0.4s fade-in.
   */
  public startInGameBGM(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // 1. Generate procedural buffer once and cache
    if (!this.bgmBuffer) {
      this.bgmBuffer = this.generateBgmBuffer(ctx);
    }

    // 2. Stop any existing source cleanly
    this.stopBgmSource();

    // 3. Ensure BGM gain node connected to masterGain
    if (!this.bgmGain) {
      this.bgmGain = ctx.createGain();
      this.bgmGain.connect(this.masterGain);
    }

    // 4. Create and start new buffer source node
    this.bgmSource = ctx.createBufferSource();
    this.bgmSource.buffer = this.bgmBuffer;
    this.bgmSource.loop = true;
    this.bgmSource.connect(this.bgmGain);

    const now = ctx.currentTime;
    this.bgmStartTime = now;
    this.bgmPlaybackOffset = 0;
    this.isBgmPlaying = true;

    // Smooth ~0.4s fade-in to target gain
    this.bgmGain.gain.setValueAtTime(0, now);
    this.bgmGain.gain.linearRampToValueAtTime(this.bgmTargetGain, now + 0.4);

    this.bgmSource.start(now, 0);
  }

  /**
   * Pauses in-game BGM by capturing current playback offset and disconnecting source.
   */
  public pauseInGameBGM(): void {
    if (!this.isBgmPlaying || !this.bgmSource || !this.bgmGain || !this.ctx || !this.bgmBuffer) return;

    const now = this.ctx.currentTime;
    const elapsed = Math.max(0, now - this.bgmStartTime);
    this.bgmPlaybackOffset = elapsed % this.bgmBuffer.duration;
    this.isBgmPlaying = false;

    // Fast ramp to 0 to prevent clicks
    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
    this.bgmGain.gain.linearRampToValueAtTime(0, now + 0.06);

    const src = this.bgmSource;
    setTimeout(() => {
      try { src.stop(); } catch (_) {}
      try { src.disconnect(); } catch (_) {}
    }, 80);
    this.bgmSource = null;
  }

  /**
   * Resumes in-game BGM from the saved musical offset with a smooth gain ramp.
   */
  public resumeInGameBGM(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.bgmBuffer || this.isBgmPlaying) return;

    this.stopBgmSource();

    if (!this.bgmGain) {
      this.bgmGain = ctx.createGain();
      this.bgmGain.connect(this.masterGain);
    }

    this.bgmSource = ctx.createBufferSource();
    this.bgmSource.buffer = this.bgmBuffer;
    this.bgmSource.loop = true;
    this.bgmSource.connect(this.bgmGain);

    const now = ctx.currentTime;
    this.bgmStartTime = now - this.bgmPlaybackOffset;
    this.isBgmPlaying = true;

    // Smoothly ramp back up to target gain in ~0.25s
    this.bgmGain.gain.setValueAtTime(0, now);
    this.bgmGain.gain.linearRampToValueAtTime(this.bgmTargetGain, now + 0.25);

    this.bgmSource.start(now, this.bgmPlaybackOffset);
  }

  /**
   * Fades out and cleanly stops the in-game BGM.
   */
  public stopInGameBGM(fadeDuration: number = 0.3): void {
    this.isBgmPlaying = false;
    this.bgmPlaybackOffset = 0;

    if (!this.bgmSource || !this.bgmGain || !this.ctx) {
      this.stopBgmSource();
      return;
    }

    const now = this.ctx.currentTime;
    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
    this.bgmGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

    const src = this.bgmSource;
    setTimeout(() => {
      try { src.stop(); } catch (_) {}
      try { src.disconnect(); } catch (_) {}
    }, Math.round(fadeDuration * 1000) + 50);
    this.bgmSource = null;
  }

  private stopBgmSource(): void {
    if (this.bgmSource) {
      try { this.bgmSource.stop(); } catch (_) {}
      try { this.bgmSource.disconnect(); } catch (_) {}
      this.bgmSource = null;
    }
  }

  /**
   * Generates a 4-bar driving cyberpunk synthwave loop (126 BPM, D minor)
   * into a stereo AudioBuffer. Pre-rendered once and cached.
   */
  private generateBgmBuffer(ctx: AudioContext): AudioBuffer {
    const bpm = 126;
    const beats = 16; // 4 bars of 4/4
    const sampleRate = ctx.sampleRate;
    const loopDuration = beats * (60 / bpm);
    const totalFrames = Math.round(loopDuration * sampleRate);
    const actualDuration = totalFrames / sampleRate;

    const buffer = ctx.createBuffer(2, totalFrames, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const beatSec = actualDuration / beats;
    const stepSec = beatSec / 4; // 16th note

    // --- 1. KICK DRUM (Four-on-the-floor: beats 0..15) ---
    for (let b = 0; b < beats; b++) {
      const startFrame = Math.round(b * beatSec * sampleRate);
      const kickLen = Math.round(0.16 * sampleRate);
      let phase = 0;
      for (let i = 0; i < kickLen && startFrame + i < totalFrames; i++) {
        const t = i / sampleRate;
        const freq = 135 * Math.exp(-t * 26) + 44;
        phase += (2 * Math.PI * freq) / sampleRate;
        const env = Math.max(0, 1 - t / 0.16) * Math.exp(-t * 14) * 0.52;
        const sample = Math.sin(phase) * env;
        left[startFrame + i] += sample;
        right[startFrame + i] += sample;
      }
    }

    // --- 2. SNARE / CLAP (Backbeats: beats 2, 6, 10, 14) ---
    const snareBeats = [2, 6, 10, 14];
    for (const b of snareBeats) {
      const startFrame = Math.round(b * beatSec * sampleRate);
      const snareLen = Math.round(0.18 * sampleRate);
      let phase = 0;
      for (let i = 0; i < snareLen && startFrame + i < totalFrames; i++) {
        const t = i / sampleRate;
        const toneFreq = 185 * Math.exp(-t * 20) + 70;
        phase += (2 * Math.PI * toneFreq) / sampleRate;
        const toneEnv = Math.exp(-t * 22) * 0.28;
        const noiseEnv = Math.exp(-t * 18) * 0.26;
        const noiseL = (Math.random() * 2 - 1) * noiseEnv;
        const noiseR = (Math.random() * 2 - 1) * noiseEnv;
        const tone = Math.sin(phase) * toneEnv;
        left[startFrame + i] += tone + noiseL;
        right[startFrame + i] += tone + noiseR;
      }
    }

    // --- 3. CLOSED HI-HAT (Off-beat 8ths) ---
    for (let b = 0; b < beats; b++) {
      const startFrame = Math.round((b + 0.5) * beatSec * sampleRate);
      const hatLen = Math.round(0.04 * sampleRate);
      for (let i = 0; i < hatLen && startFrame + i < totalFrames; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 85) * 0.12;
        left[startFrame + i] += (Math.random() * 2 - 1) * env;
        right[startFrame + i] += (Math.random() * 2 - 1) * env;
      }
    }

    // --- 4. ROLLING 16TH-NOTE BASSLINE (D-minor progression) ---
    const bassNotes: number[] = [];
    for (let s = 0; s < 64; s++) {
      if (s < 12) bassNotes.push(73.42); // D2
      else if (s < 14) bassNotes.push(87.31); // F2
      else if (s < 16) bassNotes.push(98.00); // G2
      else if (s < 24) bassNotes.push(73.42); // D2
      else if (s < 28) bassNotes.push(87.31); // F2
      else if (s < 32) bassNotes.push(73.42); // D2
      else if (s < 40) bassNotes.push(98.00); // G2
      else if (s < 48) bassNotes.push(110.00); // A2
      else if (s < 56) bassNotes.push(130.81); // C3
      else if (s < 60) bassNotes.push(110.00); // A2
      else bassNotes.push(73.42); // D2
    }

    for (let s = 0; s < 64; s++) {
      const freq = bassNotes[s];
      const startFrame = Math.round(s * stepSec * sampleRate);
      const stepLen = Math.round(stepSec * 1.05 * sampleRate);
      let phase = 0;
      const isKickBeat = s % 4 === 0;

      for (let i = 0; i < stepLen && startFrame + i < totalFrames; i++) {
        const t = i / sampleRate;
        phase += (2 * Math.PI * freq) / sampleRate;

        // Attack & decay envelope
        const attack = Math.min(t / 0.005, 1);
        const decay = Math.exp(-t * 13);
        // Sidechain ducking on the kick beat
        const ducking = isKickBeat ? Math.min(t / 0.04, 1) : 1;
        const env = attack * decay * ducking * 0.38;

        // Rich analog synth wave (fundamental + 2nd + 3rd harmonic)
        const wave = Math.sin(phase) + 0.38 * Math.sin(phase * 2) + 0.12 * Math.sin(phase * 3);
        const sample = wave * env;
        left[startFrame + i] += sample;
        right[startFrame + i] += sample;
      }
    }

    // --- 5. CYBER ARPEGGIO PLUCK (16th notes with stereo ping-pong) ---
    const arpNotes = [
      293.66, 440.00, 349.23, 587.33, 523.25, 440.00, 349.23, 392.00,
      440.00, 293.66, 349.23, 523.25, 440.00, 392.00, 349.23, 329.63,
      293.66, 440.00, 349.23, 659.25, 523.25, 440.00, 349.23, 392.00,
      440.00, 349.23, 392.00, 523.25, 440.00, 392.00, 349.23, 293.66,
      392.00, 587.33, 440.00, 698.46, 587.33, 440.00, 392.00, 440.00,
      440.00, 659.25, 523.25, 783.99, 659.25, 523.25, 440.00, 392.00,
      523.25, 659.25, 587.33, 783.99, 659.25, 523.25, 440.00, 392.00,
      440.00, 392.00, 349.23, 329.63, 293.66, 349.23, 392.00, 440.00,
    ];

    for (let s = 0; s < 64; s++) {
      const freq = arpNotes[s];
      const startFrame = Math.round(s * stepSec * sampleRate);
      const arpLen = Math.round(0.18 * sampleRate);
      let phase = 0;
      const leftPan = s % 2 === 0 ? 0.8 : 0.35;
      const rightPan = s % 2 === 0 ? 0.35 : 0.8;

      for (let i = 0; i < arpLen && startFrame + i < totalFrames; i++) {
        const t = i / sampleRate;
        phase += (2 * Math.PI * freq) / sampleRate;
        const env = Math.exp(-t * 18) * 0.18;
        // Triangle/sine pluck
        const wave = Math.sin(phase) * 0.7 + (Math.abs((phase % (2 * Math.PI)) / Math.PI - 1) * 2 - 1) * 0.3;
        const sample = wave * env;
        left[startFrame + i] += sample * leftPan;
        right[startFrame + i] += sample * rightPan;
      }
    }

    // --- 6. SMOOTH LOOP BOUNDARIES & MASTER PEAK CLAMPING ---
    const fadeFrames = 96;
    for (let i = 0; i < fadeFrames; i++) {
      const factor = i / fadeFrames;
      left[i] *= factor;
      right[i] *= factor;
      left[totalFrames - 1 - i] *= factor;
      right[totalFrames - 1 - i] *= factor;
    }

    let peak = 0;
    for (let i = 0; i < totalFrames; i++) {
      const absL = Math.abs(left[i]);
      const absR = Math.abs(right[i]);
      if (absL > peak) peak = absL;
      if (absR > peak) peak = absR;
    }
    if (peak > 0.84) {
      const scale = 0.84 / peak;
      for (let i = 0; i < totalFrames; i++) {
        left[i] *= scale;
        right[i] *= scale;
      }
    }

    return buffer;
  }
}


