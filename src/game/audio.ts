// Tiny synthesized sound engine — no audio assets, pure WebAudio.

type Wave = OscillatorType;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNodes: OscillatorNode[] = [];
  private ambientStarted = false;
  private ambientAllowed = false;
  enabled = true;
  volume = 0.6;

  configure(opts: { enabled?: boolean; volume?: number }) {
    if (opts.enabled !== undefined) this.enabled = opts.enabled;
    if (opts.volume !== undefined) {
      this.volume = opts.volume;
      if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
    }
    if (this.enabled && this.ambientAllowed) this.startAmbient();
  }

  private ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.ambientAllowed = true;
    if (this.enabled) {
      this.ensure();
      this.startAmbient();
    }
  }

  /** A very quiet two-note bed so the app never feels silent between interactions. */
  startAmbient() {
    if (!this.enabled || !this.ambientAllowed || this.ambientStarted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.ambientStarted = true;

    const bed = ctx.createGain();
    bed.gain.value = 0;
    bed.connect(this.master);

    const low = ctx.createOscillator();
    low.type = "sine";
    low.frequency.value = 55;

    const mid = ctx.createOscillator();
    mid.type = "triangle";
    mid.frequency.value = 82.5;
    mid.detune.value = 4;

    const pad = ctx.createGain();
    pad.gain.value = 0.32;
    low.connect(pad);
    mid.connect(pad);
    pad.connect(bed);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.055;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.004;
    lfo.connect(lfoDepth).connect(bed.gain);

    low.start();
    mid.start();
    lfo.start();
    bed.gain.linearRampToValueAtTime(0.013, ctx.currentTime + 2.4);

    this.ambientGain = bed;
    this.ambientNodes = [low, mid, lfo];
  }

  stopAmbient() {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const node of this.ambientNodes) {
      try {
        node.stop(ctx.currentTime + 0.4);
      } catch {
        // already stopped
      }
    }
    this.ambientNodes = [];
    this.ambientStarted = false;
    const bed = this.ambientGain;
    this.ambientGain = null;
    if (bed) {
      bed.gain.cancelScheduledValues(ctx.currentTime);
      bed.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    }
  }

  private tone(freq: number, dur: number, type: Wave = "square", gain = 0.14, slideTo?: number, delay = 0) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, gain = 0.16, cut = 900) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cut;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
  }

  jump() { this.tone(220, 0.12, "square", 0.08, 440); }
  spring() { this.tone(160, 0.22, "square", 0.1, 900); }
  coin() { this.tone(880, 0.07, "square", 0.09); this.tone(1320, 0.1, "square", 0.09, undefined, 0.06); }
  die() { this.noise(0.22, 0.18, 700); this.tone(320, 0.28, "sawtooth", 0.1, 60); }
  bump() { this.tone(120, 0.08, "square", 0.12, 70); }
  checkpoint() { this.tone(520, 0.09, "square", 0.1); this.tone(780, 0.12, "square", 0.1, undefined, 0.08); }
  flip() { this.tone(700, 0.18, "triangle", 0.11, 180); }
  reverse() { this.tone(500, 0.1, "sawtooth", 0.07, 250); this.tone(250, 0.1, "sawtooth", 0.07, 500, 0.1); }
  reveal() { this.tone(1040, 0.1, "triangle", 0.1, 400); }
  land() { this.noise(0.06, 0.06, 500); }
  spike() { this.noise(0.12, 0.12, 1400); }
  shift() { this.tone(340, 0.14, "square", 0.1, 690); }
  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, "square", 0.1, undefined, i * 0.09));
    this.tone(1318, 0.3, "square", 0.08, undefined, 0.38);
  }
  click() { this.tone(660, 0.05, "square", 0.06); }
  denied() { this.tone(190, 0.12, "square", 0.1, 120); }
  buy() { this.tone(700, 0.08, "square", 0.09); this.tone(1050, 0.14, "square", 0.09, undefined, 0.07); }

  // ——— UI layer: every screen gets audible feedback ———
  hover() { this.tone(1180, 0.024, "sine", 0.012); }
  nav() { this.tone(520, 0.055, "triangle", 0.045, 780); }
  select() { this.tone(740, 0.045, "square", 0.04); this.tone(980, 0.05, "square", 0.028, undefined, 0.035); }
  toggle() { this.tone(420, 0.09, "square", 0.05, 640); }
  open() { this.tone(340, 0.075, "triangle", 0.05, 650); }
  close() { this.tone(620, 0.085, "triangle", 0.05, 290); }
  type() { this.tone(980 + Math.random() * 120, 0.018, "square", 0.012); }
  slider() { this.tone(360, 0.035, "sine", 0.04, 480); }
  toast() { this.tone(760, 0.055, "triangle", 0.035, 1040); }
  success() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.13, "triangle", 0.075, undefined, i * 0.07));
  }
  achievement() {
    [660, 880, 1100].forEach((f, i) => this.tone(f, 0.14, "square", 0.06, undefined, i * 0.08));
  }
  private lastFieldError = 0;
  fieldError() {
    const now = Date.now();
    if (now - this.lastFieldError < 120) return;
    this.lastFieldError = now;
    this.tone(190, 0.055, "square", 0.045, 145);
  }
  pause() { this.tone(520, 0.09, "triangle", 0.055, 300); }
  resume() { this.tone(300, 0.09, "triangle", 0.055, 620); }
  restart() { this.tone(620, 0.09, "square", 0.055, 180); }
  levelStart() {
    this.tone(180, 0.14, "triangle", 0.06, 260);
    this.tone(360, 0.1, "triangle", 0.045, 520, 0.12);
  }
  boot() {
    [196, 294, 392, 587].forEach((f, i) => this.tone(f, 0.14, "triangle", 0.05, undefined, i * 0.08));
  }
}

export const sfx = new SoundEngine();
