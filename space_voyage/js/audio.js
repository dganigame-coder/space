// Procedural ambient score + engine/warp sound design (Web Audio, no files)
export class Sound {
  constructor() { this.on = true; this.ctx = null; }
  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    const master = this.master = ctx.createGain(); master.gain.value = this.on ? 0.9 : 0; master.connect(ctx.destination);
    // reverb-ish delay
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.45;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1800;
    delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(master);
    this.bus = ctx.createGain(); this.bus.gain.value = 1; this.bus.connect(master); this.bus.connect(delay);
    // drone pad
    this.pad = ctx.createGain(); this.pad.gain.value = 0.0; this.pad.connect(this.bus);
    const lp = this.padLP = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 0.7; lp.connect(this.pad);
    this.oscs = [];
    [55, 82.41, 110.2, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6;
      const g = ctx.createGain(); g.gain.value = [0.09, 0.05, 0.04, 0.025][i];
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03; const lg = ctx.createGain(); lg.gain.value = g.gain.value * 0.6; lfo.connect(lg); lg.connect(g.gain); lfo.start();
      o.connect(g); g.connect(lp); o.start(); this.oscs.push(o);
    });
    // noise for engine and warp
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < d.length; i++) { b = 0.98 * b + 0.02 * (Math.random() * 2 - 1); d[i] = b * 6; }
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    this.engLP = ctx.createBiquadFilter(); this.engLP.type = 'lowpass'; this.engLP.frequency.value = 180;
    this.eng = ctx.createGain(); this.eng.gain.value = 0;
    n.connect(this.engLP); this.engLP.connect(this.eng); this.eng.connect(master);
    const n2 = ctx.createBufferSource(); n2.buffer = buf; n2.loop = true; n2.playbackRate.value = 3;
    this.warpBP = ctx.createBiquadFilter(); this.warpBP.type = 'bandpass'; this.warpBP.Q.value = 4; this.warpBP.frequency.value = 300;
    this.warpG = ctx.createGain(); this.warpG.gain.value = 0;
    n2.connect(this.warpBP); this.warpBP.connect(this.warpG); this.warpG.connect(this.bus);
    n.start(); n2.start();
    this.pad.gain.setTargetAtTime(0.5, ctx.currentTime, 3);
  }
  toggle() { this.on = !this.on; if (this.master) this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.2); return this.on; }
  chapter(i, n = 16) {
    if (!this.ctx) return;
    const roots = [55, 55, 49, 51.9, 46.25, 43.65, 41.2, 38.9, 36.7, 41.2, 43.65, 32.7, 36.7, 34.65, 30.87, 27.5];
    const r = roots[Math.min(roots.length - 1, Math.floor(i / n * roots.length))];
    const ratios = [1, 1.5, 2, 3];
    this.oscs.forEach((o, k) => o.frequency.setTargetAtTime(r * ratios[k], this.ctx.currentTime, 1.5));
    this.padLP.frequency.setTargetAtTime(i / n > 0.62 ? 380 : 650, this.ctx.currentTime, 2);
  }
  update(warp, power, chem, playing) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const p = playing ? 1 : 0.0;
    this.eng.gain.setTargetAtTime((chem ? 0.5 * power : 0.06 * power) * p, t, 0.15);
    this.engLP.frequency.setTargetAtTime(chem ? 260 : 140, t, 0.3);
    this.warpG.gain.setTargetAtTime(warp * 0.35 * p, t, 0.05);
    this.warpBP.frequency.setTargetAtTime(200 + warp * 2400, t, 0.05);
    this.pad.gain.setTargetAtTime(playing ? 0.5 : 0.25, t, 1);
  }
}
