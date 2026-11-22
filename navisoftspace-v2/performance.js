const QUALITY_PRESETS = {
  ultra: { maxPixelRatio: 2.0, targetFps: 60, minScale: 0.75 },
  high: { maxPixelRatio: 1.5, targetFps: 60, minScale: 0.65 },
  balanced: { maxPixelRatio: 1.25, targetFps: 45, minScale: 0.55 },
  performance: { maxPixelRatio: 1.0, targetFps: 30, minScale: 0.5 }
};

export class PerformanceManager {
  constructor(renderer, quality = 'balanced') {
    this.renderer = renderer;
    this.quality = QUALITY_PRESETS[quality] ? quality : 'balanced';
    this.preset = QUALITY_PRESETS[this.quality];
    this.renderScale = Math.min(window.devicePixelRatio || 1, this.preset.maxPixelRatio);
    this.frameTimes = [];
    this.lastAdjustment = 0;
    this.running = false;
  }

  static detectQuality() {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    if (mobile || cores <= 4 || memory <= 4) return 'balanced';
    if (cores >= 8 && memory >= 8) return 'ultra';
    return 'high';
  }

  getRenderScale() { return this.renderScale; }

  start(onScaleChange) {
    if (this.running) return;
    this.running = true;

    const sample = () => {
      if (!this.running) return;
      const now = performance.now();
      this.frameTimes.push(now);
      while (this.frameTimes.length > 60) this.frameTimes.shift();

      if (this.frameTimes.length >= 30 && now - this.lastAdjustment > 1500) {
        const first = this.frameTimes[0];
        const fps = (this.frameTimes.length - 1) / ((now - first) / 1000);
        let nextScale = this.renderScale;

        if (fps < this.preset.targetFps * 0.82) {
          nextScale = Math.max(this.preset.minScale, this.renderScale - 0.1);
        } else if (fps > this.preset.targetFps * 0.97 && this.renderScale < this.preset.maxPixelRatio) {
          nextScale = Math.min(this.preset.maxPixelRatio, this.renderScale + 0.05);
        }

        if (Math.abs(nextScale - this.renderScale) > 0.001) {
          this.renderScale = nextScale;
          this.lastAdjustment = now;
          onScaleChange?.(this.renderScale);
        }
      }

      requestAnimationFrame(sample);
    };

    requestAnimationFrame(sample);
  }

  stop() { this.running = false; }
}
