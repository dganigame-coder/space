import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, isMobile } from './utils.js';

// Quality presets. `pixelRatio: 'native'` uses device DPR, 'uhd' targets a 3840px wide drawing buffer.
export const QUALITY_PRESETS = {
  performance: { label: 'Performance', pixelRatio: 1, msaa: 0, bloom: true, octaves: 5, volumeSteps: 28, galaxyStars: 60000, asteroidCount: 900 },
  high:        { label: 'High',        pixelRatio: 'native', msaa: 4, bloom: true, octaves: 7, volumeSteps: 48, galaxyStars: 140000, asteroidCount: 2200 },
  ultra:       { label: 'Ultra 4K',    pixelRatio: 'uhd', msaa: 4, bloom: true, octaves: 8, volumeSteps: 72, galaxyStars: 240000, asteroidCount: 4000 },
};

const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.035 },
    uAberration: { value: 0.0016 },
    uWarp: { value: 0 },
    uSunScreen: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVisible: { value: 0 },
    uSunColor: { value: new THREE.Color(1, 0.9, 0.75) },
    uFlare: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uAberration, uWarp, uSunVisible, uFlare;
    uniform vec2 uResolution, uSunScreen;
    uniform vec3 uSunColor;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    vec3 sampleScene(vec2 uv) {
      vec2 dir = uv - 0.5;
      float ca = uAberration * (1.0 + uWarp * 6.0);
      vec3 c;
      c.r = texture2D(tDiffuse, uv + dir * ca).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - dir * ca).b;
      return c;
    }

    vec3 lensFlare(vec2 uv) {
      if (uSunVisible <= 0.001 || uFlare <= 0.0) return vec3(0.0);
      float aspect = uResolution.x / uResolution.y;
      vec2 sun = uSunScreen;
      vec2 d = (uv - sun) * vec2(aspect, 1.0);
      float dist = length(d);
      vec3 col = vec3(0.0);
      // Starburst
      float ang = atan(d.y, d.x);
      float rays = pow(abs(sin(ang * 6.0 + 0.3)), 18.0) + 0.5 * pow(abs(sin(ang * 11.0 + 1.1)), 30.0);
      col += uSunColor * rays * 0.035 / (dist * 22.0 + 0.5);
      // Anamorphic streak
      col += vec3(0.55, 0.7, 1.0) * exp(-abs(d.y) * 220.0) * exp(-abs(d.x) * 2.6) * 0.09;
      // Ghosts along the optical axis
      vec2 axis = vec2(0.5) - sun;
      for (int i = 0; i < 5; i++) {
        float f = float(i);
        float k = 0.35 + f * 0.33;
        vec2 gp = sun + axis * k * 2.0;
        float gd = length((uv - gp) * vec2(aspect, 1.0));
        float size = 0.025 + 0.02 * mod(f * 1.7, 3.0);
        float ring = smoothstep(size, size * 0.6, gd) * 0.035;
        vec3 tint = mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 0.5, 0.3), fract(f * 0.37));
        col += tint * ring;
      }
      // Halo
      float halo = smoothstep(0.03, 0.0, abs(length((uv - vec2(0.5) + axis * 0.4) * vec2(aspect, 1.0)) - 0.32));
      col += vec3(0.4, 0.55, 1.0) * halo * 0.01;
      return col * uSunVisible * uFlare;
    }

    void main() {
      vec2 uv = vUv;
      vec3 color;
      if (uWarp > 0.001) {
        // Hyperspace radial blur
        vec3 acc = vec3(0.0);
        vec2 c = vec2(0.5);
        for (int i = 0; i < 10; i++) {
          float s = 1.0 - uWarp * 0.09 * float(i) / 10.0;
          acc += sampleScene(c + (uv - c) * s);
        }
        color = acc / 10.0;
      } else {
        color = sampleScene(uv);
      }
      color += lensFlare(uv);
      // Vignette
      vec2 vd = uv - 0.5;
      float vig = 1.0 - dot(vd, vd) * uVignette * 2.2;
      color *= clamp(vig, 0.0, 1.0);
      // Film grain (luma-weighted, temporal)
      float n = hash(uv * uResolution + fract(uTime) * 97.0) - 0.5;
      color += n * uGrain * (0.25 + 0.75 * sqrt(max(dot(color, vec3(0.299, 0.587, 0.114)), 0.0)));
      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

export class Engine {
  constructor(container) {
    this.container = container;
    this.qualityKey = isMobile() ? 'performance' : 'high';
    this.quality = QUALITY_PRESETS[this.qualityKey];
    this.updaters = new Set();
    this.clock = new THREE.Clock();
    this.time = 0;
    this.fps = 60;
    this._frameCount = 0;
    this._fpsTime = 0;
    this.listeners = { quality: new Set(), frame: new Set() };
    this.settings = { bloom: true, cinematic: true, flare: true };

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!this.renderer.capabilities.isWebGL2) {
      throw new Error('WebGL2 is required for the hyper-real renderer.');
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const canvas = this.renderer.domElement;
    canvas.id = 'scene-canvas';
    canvas.setAttribute('aria-label', '3D space scene');
    container.prepend(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 30000);
    this.camera.position.set(0, 4, 16);

    this._buildComposer();
    this.resize();

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(container);
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
  }

  _buildComposer() {
    const samples = this.quality.msaa;
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples });
    this.composer?.dispose?.();
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.5, 0.95);
    this.cinematicPass = new ShaderPass(CinematicShader);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.cinematicPass);
    this.composer.addPass(this.outputPass);
    this._applySettings();
  }

  _applySettings() {
    this.bloomPass.enabled = this.settings.bloom && this.quality.bloom;
    this.cinematicPass.enabled = true;
    const u = this.cinematicPass.uniforms;
    u.uVignette.value = this.settings.cinematic ? 0.32 : 0.0;
    u.uGrain.value = this.settings.cinematic ? 0.03 : 0.0;
    u.uAberration.value = this.settings.cinematic ? 0.0007 : 0.0;
    u.uFlare.value = this.settings.flare ? 1 : 0;
  }

  setSetting(key, value) {
    this.settings[key] = value;
    this._applySettings();
  }

  resolvePixelRatio() {
    const w = Math.max(1, this.container.clientWidth);
    const dpr = window.devicePixelRatio || 1;
    const pr = this.quality.pixelRatio;
    if (pr === 'native') return Math.min(dpr, 2);
    if (pr === 'uhd') {
      const maxSize = this.renderer.capabilities.maxTextureSize || 4096;
      return clamp(Math.min(3840, maxSize) / w, 1, 4);
    }
    return pr;
  }

  setQuality(key) {
    if (!QUALITY_PRESETS[key]) return;
    const msaaChanged = QUALITY_PRESETS[key].msaa !== this.quality.msaa;
    this.qualityKey = key;
    this.quality = QUALITY_PRESETS[key];
    if (msaaChanged) this._buildComposer();
    this.resize();
    this.listeners.quality.forEach((fn) => fn(this.quality, key));
  }

  onQualityChange(fn) { this.listeners.quality.add(fn); }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const pr = this.resolvePixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cinematicPass.uniforms.uResolution.value.set(w * pr, h * pr);
    this.pixelRatio = pr;
    this.drawingSize = { w: Math.round(w * pr), h: Math.round(h * pr) };
  }

  addUpdater(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  start() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(this.clock.getDelta(), 1 / 20);
      this.time += dt;
      this._frameCount++;
      const now = performance.now();
      this._fpsStart ??= now;
      if (now - this._fpsStart >= 500) {
        this.fps = (this._frameCount * 1000) / (now - this._fpsStart);
        this._frameCount = 0;
        this._fpsStart = now;
        this.listeners.frame.forEach((fn) => fn(this));
      }
      this.cinematicPass.uniforms.uTime.value = this.time;
      for (const fn of this.updaters) fn(this.time, dt);
      this.composer.render(dt);
    };
    loop();
  }

  onStats(fn) { this.listeners.frame.add(fn); }

  // Offscreen 4K still: re-renders the full pipeline at 3840x2160 and returns a PNG data URL.
  capture(width = 3840, height = 2160) {
    const maxSize = this.renderer.capabilities.maxTextureSize || 4096;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const w = Math.round(width * scale), h = Math.round(height * scale);
    const prevPR = this.renderer.getPixelRatio();
    const prevAspect = this.camera.aspect;
    const cw = this.container.clientWidth, ch = this.container.clientHeight;

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(1);
    this.composer.setSize(w, h);
    this.cinematicPass.uniforms.uResolution.value.set(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const fn of this.updaters) fn(this.time, 0);
    this.composer.render(0);
    let url = null;
    try {
      url = this.renderer.domElement.toDataURL('image/png');
    } finally {
      this.renderer.setPixelRatio(prevPR);
      this.renderer.setSize(cw, ch, false);
      this.camera.aspect = prevAspect;
      this.resize();
    }
    return { url, width: w, height: h };
  }
}
