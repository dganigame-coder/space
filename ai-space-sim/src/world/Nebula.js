import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { Body } from './Body.js';
import { rng, blackbody } from '../core/utils.js';

// Volumetric emission nebula: ray-marched domain-warped fBm with
// emission/absorption, ionisation-front color grading and embedded young stars.
export class Nebula extends Body {
  constructor(spec, quality) {
    super(spec);
    this.occluder = false;
    this.spinSpeed = 0.004;
    const R = spec.radius;
    const [c0, c1, c2, c3] = spec.palette;
    this.mat = this.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      defines: { STEPS: quality.volumeSteps },
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uRadius: { value: R },
        uSeed: { value: (spec.seed % 113) * 0.71 },
        uC0: { value: c0 }, uC1: { value: c1 }, uC2: { value: c2 }, uC3: { value: c3 },
        uDensity: { value: spec.density ?? 1.0 },
        uInvModel: { value: new THREE.Matrix4() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        ${NOISE_GLSL}
        uniform float uTime, uRadius, uSeed, uDensity;
        uniform vec3 uCenter, uC0, uC1, uC2, uC3;
        uniform mat4 uInvModel;
        varying vec3 vWorldPos;

        float density(vec3 p, out float shade) {
          vec3 q = p / uRadius;
          float falloff = 1.0 - smoothstep(0.35, 1.0, length(q * vec3(1.0, 1.6, 1.0)));
          vec3 w = vec3(fbm(q * 1.6 + uSeed, 3), fbm(q * 1.6 + uSeed + 5.0, 3), fbm(q * 1.6 + uSeed + 9.0, 3));
          float n = fbm(q * 2.4 + w * 1.3 + vec3(0.0, uTime * 0.004, 0.0), 5);
          float pillars = ridged(q * 3.2 + w * 0.8, 4);
          shade = w.x * 0.5 + 0.5;
          float d = (n * 0.5 + 0.5) * 0.8 + pillars * 0.35 - 0.62;
          return max(d, 0.0) * falloff * 3.2 * uDensity;
        }

        void main() {
          vec3 ro = cameraPosition;
          vec3 rd = normalize(vWorldPos - ro);
          vec2 t = raySphere(ro, rd, uCenter, uRadius);
          if (t.y < 0.0) discard;
          float t0 = max(t.x, 0.0);
          float t1 = t.y;
          float ds = (t1 - t0) / float(STEPS);
          float jitter = hash13(vec3(gl_FragCoord.xy, uTime));
          float T = 1.0;
          vec3 col = vec3(0.0);
          for (int i = 0; i < STEPS; i++) {
            vec3 p = ro + rd * (t0 + (float(i) + jitter) * ds);
            vec3 lp = (uInvModel * vec4(p, 1.0)).xyz;
            float shade;
            float d = density(lp, shade);
            if (d > 0.001) {
              float r = length(lp) / uRadius;
              // Hot ionised core (teal/blue OIII) -> H-alpha red -> dusty edge
              vec3 emit = mix(uC0, uC1, smoothstep(0.1, 0.55, r));
              emit = mix(emit, uC2, smoothstep(0.35, 0.75, shade));
              emit = mix(emit, uC3, smoothstep(0.6, 1.0, r) * 0.6);
              float e = d * ds * (2.2 / uRadius) * 6.0;
              col += T * emit * e * (1.0 + 2.0 * exp(-r * 4.0));
              T *= exp(-d * ds * (1.4 / uRadius) * 6.0);
              if (T < 0.02) break;
            }
          }
          float a = 1.0 - T;
          gl_FragColor = vec4(col, a * 0.92);
        }
      `,
    }));
    this.volume = this.pickable(new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), this.mat));
    this.volume.renderOrder = 6;
    this.spin.add(this.volume);

    // Embedded young hot stars
    const rand = rng(spec.seed + 7);
    const n = 260;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5).multiplyScalar(R * 1.2 * Math.pow(rand(), 0.6));
      pos.set([u.x, u.y, u.z], i * 3);
      const c = blackbody(9000 + rand() * 25000).multiplyScalar(rand() < 0.08 ? 6 : 1.2 + rand());
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.starsMat = new THREE.PointsMaterial({ size: R * 0.012, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, map: Nebula.dotTexture(), sizeAttenuation: true });
    this.stars = new THREE.Points(g, this.starsMat);
    this.stars.renderOrder = 7;
    this.spin.add(this.stars);
  }

  static dotTexture() {
    if (Nebula._dot) return Nebula._dot;
    const s = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    Nebula._dot = new THREE.CanvasTexture(cv);
    return Nebula._dot;
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    this.spin.updateWorldMatrix(true, false);
    this.mat.uniforms.uInvModel.value.copy(this.spin.matrixWorld).invert();
  }

  dispose() {
    this.starsMat.map = null;
    super.dispose();
  }
}
