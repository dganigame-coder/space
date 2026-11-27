// Ambient space pad: three detuned oscillators through a resonant low-pass with LFO,
// filtered "solar wind" noise, and a generated convolution reverb tail.
export class AmbientSynth {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
  }

  init() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(4.5, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 320;
    this.filter.Q.value = 2.2;
    const dry = ctx.createGain();
    dry.gain.value = 0.6;
    this.filter.connect(dry).connect(this.master);
    this.filter.connect(this.reverb);

    this.oscs = [
      { type: 'sine', ratio: 1, detune: 0, gain: 0.5 },
      { type: 'triangle', ratio: 1.5, detune: 7, gain: 0.22 },
      { type: 'sawtooth', ratio: 2, detune: -9, gain: 0.05 },
    ].map((o) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = o.type;
      osc.frequency.value = 55 * o.ratio;
      osc.detune.value = o.detune;
      g.gain.value = o.gain;
      osc.connect(g).connect(this.filter);
      osc.start();
      return { osc, ratio: o.ratio };
    });

    this.lfo = ctx.createOscillator();
    this.lfoGain = ctx.createGain();
    this.lfo.frequency.value = 0.08;
    this.lfoGain.gain.value = 140;
    this.lfo.connect(this.lfoGain).connect(this.filter.frequency);
    this.lfo.start();

    // Solar wind noise
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.18;
    noise.connect(this.windFilter).connect(windGain).connect(this.reverb);
    noise.start();

    this.ready = true;
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.11, ctx.currentTime + 3);
  }

  _impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(m ? 0 : 0.11, now, 0.4);
  }

  // Duck the pad while narration speaks.
  duck(on) {
    if (!this.ready || this.muted) return;
    this.master.gain.setTargetAtTime(on ? 0.045 : 0.11, this.ctx.currentTime, 0.3);
  }

  apply(params) {
    if (!this.ready || !params) return;
    const now = this.ctx.currentTime;
    const base = Math.min(220, Math.max(30, +params.baseFreq || 55));
    for (const { osc, ratio } of this.oscs) osc.frequency.setTargetAtTime(base * ratio, now, 1.2);
    if (params.filterCutoff) this.filter.frequency.setTargetAtTime(Math.min(4000, Math.max(80, +params.filterCutoff)), now, 1.2);
    if (params.lfoRate) this.lfo.frequency.setTargetAtTime(Math.min(4, Math.max(0.02, +params.lfoRate * 0.15)), now, 1.2);
    this.windFilter.frequency.setTargetAtTime(base * 8, now, 2);
  }

  // Short riser used during hyperspace jumps.
  whoosh() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    const len = ctx.sampleRate * 2.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(200, now);
    f.frequency.exponentialRampToValueAtTime(2600, now + 1.2);
    f.frequency.exponentialRampToValueAtTime(150, now + 2.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.16, now + 1.0);
    g.gain.linearRampToValueAtTime(0, now + 2.4);
    src.connect(f).connect(g).connect(this.reverb);
    g.connect(this.master);
    src.start(now);
    src.stop(now + 2.5);
  }
}
