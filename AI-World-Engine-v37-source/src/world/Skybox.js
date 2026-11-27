import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { blackbody, rng, gaussian } from '../core/utils.js';

// Procedural deep-space backdrop: Milky Way band with dust lanes, faint nebulosity
// and a star field with physically based color temperatures. Follows the camera.
export class Skybox {
  constructor(engine) {
    this.engine = engine;
    engine.skybox = this;
    this.group = new THREE.Group();
    this.group.renderOrder = -100;
    this.galacticNormal = new THREE.Vector3(0.28, 1, 0.18).normalize();
    this.galacticCenter = new THREE.Vector3(-0.85, -0.1, -0.5).normalize();

    this._buildSky();
    this._buildStars(engine.quality);
    engine.scene.add(this.group);
    engine.addUpdater((t) => this.update(t));
    engine.onQualityChange((q) => this._buildStars(q));
  }

  _buildSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uGalNormal: { value: this.galacticNormal },
        uGalCenter: { value: this.galacticCenter },
        uIntensity: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        ${NOISE_GLSL}
        uniform vec3 uGalNormal, uGalCenter;
        uniform float uIntensity;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float b = dot(d, uGalNormal);
          float toCore = max(dot(d, uGalCenter), 0.0);
          float warp = fbm(d * 3.0, 4) * 0.12;
          float bb = b + warp;
          float band = exp(-bb * bb * 34.0);
          float bulge = pow(toCore, 6.0) * exp(-bb * bb * 9.0);
          float clump = fbm(d * 7.0 + 3.0, 5) * 0.5 + 0.5;
          float stars = band * (0.35 + 0.9 * clump) + bulge * 1.6;
          float dust = smoothstep(0.42, 0.75, fbm(d * 9.0 + 11.0, 5) * 0.5 + 0.5) * exp(-b * b * 160.0);
          stars *= 1.0 - dust * 0.85;
          vec3 bandCol = mix(vec3(0.55, 0.62, 0.85), vec3(1.0, 0.78, 0.55), clamp(toCore * 1.2, 0.0, 1.0));
          vec3 col = bandCol * stars * 0.055;
          // Faint emission nebulosity
          float neb = smoothstep(0.55, 0.95, fbm(d * 2.2 + 21.0, 5) * 0.5 + 0.5);
          col += mix(vec3(0.35, 0.05, 0.18), vec3(0.04, 0.16, 0.24), fbm(d * 1.3, 3) * 0.5 + 0.5) * neb * 0.035 * (0.4 + band);
          // Deep space floor
          col += vec3(0.0012, 0.0016, 0.003);
          gl_FragColor = vec4(col * uIntensity, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    this.group.add(this.sky);
  }

  _buildStars(quality) {
    if (this.stars) {
      this.group.remove(this.stars);
      this.stars.geometry.dispose();
      this.stars.material.dispose();
    }
    const count = quality.galaxyStars > 100000 ? 26000 : 14000;
    const rand = rng(1337);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const v = new THREE.Vector3();
    const n = this.galacticNormal;
    for (let i = 0; i < count; i++) {
      // 45% concentrated toward the galactic plane
      v.set(gaussian(rand), gaussian(rand), gaussian(rand)).normalize();
      if (rand() < 0.45) {
        const b = v.dot(n);
        v.addScaledVector(n, -b * 0.85).normalize();
      }
      v.multiplyScalar(900);
      pos.set([v.x, v.y, v.z], i * 3);
      // Temperature distribution skewed toward cooler stars
      const tK = 2800 + Math.pow(rand(), 2.2) * 22000;
      const c = blackbody(tK);
      const mag = Math.pow(rand(), 9.0);
      const brightness = 0.35 + mag * 9.0;
      col.set([c.r * brightness, c.g * brightness, c.b * brightness], i * 3);
      size[i] = 1.0 + mag * 3.5 + rand() * 0.6;
      phase[i] = rand() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true, // projected to the far plane (xyww): hidden behind planets, never clipped
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uDim: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime, uPixelRatio, uDim;
        varying vec3 vColor;
        void main() {
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
          float tw = 0.85 + 0.15 * sin(uTime * (0.6 + fract(aPhase) * 1.8) + aPhase * 7.0);
          vColor = aColor * tw * uDim;
          gl_PointSize = aSize * uPixelRatio;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = dot(c, c);
          float core = exp(-d * 28.0);
          if (core < 0.01) discard;
          gl_FragColor = vec4(vColor * core, 1.0);
        }
      `,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -99;
    this.group.add(this.stars);
  }

  setIntensity(v) { this.sky.material.uniforms.uIntensity.value = v; }

  update(t) {
    this.group.position.copy(this.engine.camera.position);
    this.stars.material.uniforms.uTime.value = t;
    this.stars.material.uniforms.uPixelRatio.value = this.engine.pixelRatio || 1;
  }
}
