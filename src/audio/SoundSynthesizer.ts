/**
 * Aurion Procedural Web Audio API Synthesizer
 * Generates all steampunk mechanical, nature magic, and MMORPG combat sounds in real-time.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private shieldOsc: OscillatorNode | null = null;
  private shieldGain: GainNode | null = null;
  private shieldFilter: BiquadFilterNode | null = null;
  private isShieldPlaying: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.shieldGain) {
      this.shieldGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public startShieldSound() {
    if (this.isMuted || this.isShieldPlaying) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      this.shieldOsc = this.ctx.createOscillator();
      this.shieldFilter = this.ctx.createBiquadFilter();
      this.shieldGain = this.ctx.createGain();

      this.shieldOsc.type = 'sawtooth';
      this.shieldOsc.frequency.setValueAtTime(80, now);
      this.shieldOsc.frequency.exponentialRampToValueAtTime(220, now + 0.3);

      this.shieldFilter.type = 'lowpass';
      this.shieldFilter.frequency.setValueAtTime(300, now);
      this.shieldFilter.frequency.exponentialRampToValueAtTime(1400, now + 0.4);
      this.shieldFilter.Q.setValueAtTime(6.0, now);

      this.shieldGain.gain.setValueAtTime(0.01, now);
      this.shieldGain.gain.linearRampToValueAtTime(0.12, now + 0.2);

      this.shieldOsc.connect(this.shieldFilter);
      this.shieldFilter.connect(this.shieldGain);
      this.shieldGain.connect(this.ctx.destination);

      this.shieldOsc.start(now);
      this.isShieldPlaying = true;
    } catch {
      // ignore
    }
  }

  public stopShieldSound() {
    if (!this.isShieldPlaying) return;
    if (this.ctx && this.shieldGain && this.shieldOsc) {
      const now = this.ctx.currentTime;
      this.shieldGain.gain.linearRampToValueAtTime(0.001, now + 0.15);
      setTimeout(() => {
        try {
          this.shieldOsc?.stop();
          this.shieldOsc?.disconnect();
          this.shieldFilter?.disconnect();
          this.shieldGain?.disconnect();
        } catch {
          // ignore
        }
        this.shieldOsc = null;
        this.shieldGain = null;
        this.shieldFilter = null;
        this.isShieldPlaying = false;
      }, 160);
    } else {
      this.isShieldPlaying = false;
    }
  }

  public playMountSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playLootPickup() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [659.25, 880, 1318.51]; // E5, A5, E6 (Bright magical loot chime)
    freqs.forEach((f, i) => {
      const st = now + i * 0.05;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, st);
      gain.gain.setValueAtTime(0.25, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(st);
      osc.stop(st + 0.3);
    });
  }

  public playNpcInteract() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(554.37, now + 0.15);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playSkillCast(type: string) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'melee') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
    } else if (type === 'projectile') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
    } else if (type === 'aoe') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.linearRampToValueAtTime(783.99, now + 0.2);
    }

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playHitSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playMobDeath() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playLevelUp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];

    notes.forEach((freq, index) => {
      const startTime = now + index * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = index === notes.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  public playQuestComplete() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, i) => {
      const st = now + i * 0.06;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, st);
      gain.gain.setValueAtTime(0.2, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(st);
      osc.stop(st + 0.35);
    });
  }

  public playItemEquip() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playItemPickup() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playLegendaryDrop() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [392.0, 493.88, 587.33, 783.99, 987.77, 1174.66];
    notes.forEach((freq, idx) => {
      const st = now + idx * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.24, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.65);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(st);
      osc.stop(st + 0.65);
    });
  }

  public playInventorySort() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [400, 600, 800].forEach((freq, idx) => {
      const st = now + idx * 0.03;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.08, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(st);
      osc.stop(st + 0.05);
    });
  }

  public playComboHit(comboCount: number, isCrit: boolean = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Rising musical frequency based on combo chain
    const baseFreq = isCrit ? 330 : 220;
    const semitones = Math.min(36, comboCount * 1.5);
    const targetFreq = baseFreq * Math.pow(2, semitones / 12);

    osc.type = comboCount >= 10 ? 'sawtooth' : isCrit ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(targetFreq * 0.85, now);
    osc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.06);

    const volume = Math.min(0.28, 0.12 + comboCount * 0.005);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.16 : 0.12));

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + (isCrit ? 0.16 : 0.12));
  }

  public playComboMilestone(milestoneOrRank: number | string) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Aurion resonant power surge triad
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((f, idx) => {
      const st = now + idx * 0.04;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, st);
      gain.gain.setValueAtTime(0.18, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(st);
      osc.stop(st + 0.4);
    });
  }

  public playDirectionalDamageSound(angleRad?: number, isCrit: boolean = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isCrit ? 180 : 130, now);
    osc.frequency.exponentialRampToValueAtTime(isCrit ? 25 : 35, now + (isCrit ? 0.25 : 0.18));

    gain.gain.setValueAtTime(isCrit ? 0.35 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.25 : 0.18));

    // Stereo panning if StereoPannerNode is supported in browser
    if (angleRad !== undefined && typeof this.ctx.createStereoPanner === 'function') {
      try {
        const panner = this.ctx.createStereoPanner();
        // angleRad: 0 is front, PI/2 is right, -PI/2 is left
        const panValue = Math.max(-1, Math.min(1, Math.sin(angleRad)));
        panner.pan.setValueAtTime(panValue, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + (isCrit ? 0.25 : 0.18));
        return;
      } catch {
        // fallback to standard mono routing
      }
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + (isCrit ? 0.25 : 0.18));
  }
}

export const soundSynth = new SoundSynthesizer();

