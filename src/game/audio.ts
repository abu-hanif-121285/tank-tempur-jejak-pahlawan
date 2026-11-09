export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private musicTimer: number | null = null;
  private enabled = true;
  private started = false;

  start() {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    this.started = true;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.enabled ? 0.55 : 0;
    master.connect(ctx.destination);
    this.master = master;

    // Continuous low diesel engine drone.
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0.012;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 180;
    engineGain.connect(engineFilter);
    engineFilter.connect(master);
    this.engineGain = engineGain;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 48;
    osc.connect(engineGain);
    osc.start();
    this.engineOsc = osc;

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 27;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.45;
    sub.connect(subGain);
    subGain.connect(engineGain);
    sub.start();
    this.engineSub = sub;

    // Quiet, slow cinematic battle pulse.
    let beat = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.master || !this.enabled) return;
      const now = this.ctx.currentTime;
      const drum = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      drum.type = "sine";
      drum.frequency.setValueAtTime(beat % 4 === 0 ? 68 : 52, now);
      drum.frequency.exponentialRampToValueAtTime(28, now + 0.24);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(beat % 4 === 0 ? 0.035 : 0.018, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      drum.connect(gain);
      gain.connect(this.master);
      drum.start(now);
      drum.stop(now + 0.38);

      if (beat % 2 === 0) {
        const pad = this.ctx.createOscillator();
        const padGain = this.ctx.createGain();
        pad.type = "triangle";
        pad.frequency.value = beat % 8 === 0 ? 110 : 98;
        padGain.gain.setValueAtTime(0.0001, now);
        padGain.gain.exponentialRampToValueAtTime(0.009, now + 0.3);
        padGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
        pad.connect(padGain);
        padGain.connect(this.master);
        pad.start(now);
        pad.stop(now + 1.8);
      }
      beat++;
    }, 900);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(enabled ? 0.55 : 0, this.ctx.currentTime, 0.05);
    }
  }

  setEngine(intensity: number) {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineSub) return;
    const t = this.ctx.currentTime;
    const amount = Math.max(0, Math.min(1, intensity));
    this.engineGain.gain.setTargetAtTime(0.012 + amount * 0.035, t, 0.12);
    this.engineOsc.frequency.setTargetAtTime(48 + amount * 32, t, 0.15);
    this.engineSub.frequency.setTargetAtTime(27 + amount * 12, t, 0.15);
  }

  private noise(duration: number) {
    if (!this.ctx) return null;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  fire() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const now = ctx.currentTime;
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = "sine";
    boom.frequency.setValueAtTime(130, now);
    boom.frequency.exponentialRampToValueAtTime(32, now + 0.28);
    boomGain.gain.setValueAtTime(0.42, now);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    boom.connect(boomGain);
    boomGain.connect(this.master);
    boom.start(now);
    boom.stop(now + 0.52);

    const hiss = this.noise(0.55);
    if (hiss) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3800, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.45);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.36, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      hiss.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      hiss.start(now);
      hiss.stop(now + 0.56);
    }
  }

  impact() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const now = ctx.currentTime;
    const hiss = this.noise(0.22);
    if (!hiss) return;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    hiss.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    hiss.start(now);
    hiss.stop(now + 0.23);
  }

  private tone(freq: number, at: number, duration = 0.18, volume = 0.08, type: OscillatorType = "sine") {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  success() {
    if (!this.enabled) return;
    this.tone(392, 0, 0.18, 0.09, "triangle");
    this.tone(523, 0.13, 0.18, 0.09, "triangle");
    this.tone(784, 0.26, 0.34, 0.1, "triangle");
  }

  wrong() {
    if (!this.enabled) return;
    this.tone(220, 0, 0.22, 0.08, "sawtooth");
    this.tone(165, 0.16, 0.32, 0.07, "sawtooth");
  }

  dispose() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    try {
      this.engineOsc?.stop();
      this.engineSub?.stop();
    } catch { /* already stopped */ }
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineSub = null;
    this.started = false;
  }
}
