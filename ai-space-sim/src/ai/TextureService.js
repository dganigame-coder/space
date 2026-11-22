import * as THREE from 'three';
import { CONFIG } from '../../config.js';

const NEGATIVE = '3d sphere, globe, framed picture, borders, centered planet, outer space, stars, studio lighting, heavy shadows, vignette, perspective, white background, text, watermark, grid, tiles';

// Optional AI albedo synthesis. Runs with bounded concurrency and never blocks scene creation:
// bodies render procedurally first and cross-fade to the AI texture when it arrives.
export class TextureService {
  constructor(renderer) {
    this.renderer = renderer;
    this.queue = [];
    this.active = 0;
    this.concurrency = 2;
    this.generation = 0;
  }

  cancelAll() {
    this.generation++;
    this.queue.length = 0;
  }

  request(promptText) {
    const gen = this.generation;
    return new Promise((resolve, reject) => {
      this.queue.push({ promptText, resolve, reject, gen });
      this._pump();
    });
  }

  _pump() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift();
      if (job.gen !== this.generation) { job.reject(new Error('cancelled')); continue; }
      this.active++;
      this._load(job.promptText)
        .then((tex) => (job.gen === this.generation ? job.resolve(tex) : (tex.dispose(), job.reject(new Error('stale')))))
        .catch(job.reject)
        .finally(() => { this.active--; this._pump(); });
    }
  }

  _finish(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  async _load(promptText) {
    if (CONFIG.AWS_IMAGE_URL_API) return this._loadAws(promptText);
    return this._loadPollinations(promptText);
  }

  async _loadAws(promptText, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(CONFIG.AWS_IMAGE_URL_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText, negative_prompt: NEGATIVE, width: 2048, height: 1024 }),
        });
        if (res.status === 402 || res.status === 429) throw Object.assign(new Error(`quota ${res.status}`), { fatal: true });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        if (!result.success || !result.image) throw new Error('unsuccessful generation');
        const b64 = result.image.includes('base64,') ? result.image.split('base64,')[1] : result.image;
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }), { imageOrientation: 'flipY' });
        const tex = new THREE.Texture(bitmap);
        tex.flipY = false;
        return this._finish(tex);
      } catch (err) {
        if (err.fatal || attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      }
    }
  }

  _loadPollinations(promptText) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      const seed = Math.floor(Math.random() * 1e6);
      img.src = `${CONFIG.POLLINATIONS_IMAGE_URL}${encodeURIComponent(promptText)}?width=2048&height=1024&nologo=true&seed=${seed}`;
      const timer = setTimeout(() => reject(new Error('texture timeout')), 45000);
      img.onload = () => { clearTimeout(timer); resolve(this._finish(new THREE.Texture(img))); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('texture load failed')); };
    });
  }

  static surfacePrompt(spec) {
    const palette = spec.colorDescription || spec.prompt || 'natural mineral surface';
    return `flat equirectangular planetary surface albedo map of ${spec.name}: ${palette}. ${spec.prompt}. orthographic satellite mosaic, seamless horizontal wrap, physically accurate colors, ultra detailed 8k, no borders, no globe, no stars`;
  }
}
