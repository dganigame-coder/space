import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { Body } from './Body.js';

// Schwarzschild black hole: per-pixel null-geodesic integration bends light around
// the event horizon, producing the lensed accretion disk, photon ring and shadow.
export class BlackHole extends Body {
  constructor(spec, quality) {
    super(spec);
    this.spinSpeed = 0;
    const rs = spec.radius;           // Schwarzschild radius in scene units
    const bound = rs * 14;
    this.mat = this.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      defines: { STEPS: Math.round(quality.volumeSteps * 2.2) },
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uRs: { value: rs },
        uBound: { value: bound },
        uDiskIn: { value: rs * 2.6 },
        uDiskOut: { value: rs * 9.5 },
        uHot: { value: spec.palette[0] },
        uWarm: { value: spec.palette[1] },
        uCool: { value: spec.palette[2] },
        uInvRot: { value: new THREE.Matrix3() },
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
        uniform float uTime, uRs, uBound, uDiskIn, uDiskOut;
        uniform vec3 uCenter, uHot, uWarm, uCool;
        uniform mat3 uInvRot;
        varying vec3 vWorldPos;

        vec4 diskSample(vec3 x, vec3 v) {
          float r = length(x.xz);
          if (r < uDiskIn || r > uDiskOut) return vec4(0.0);
          float k = (r - uDiskIn) / (uDiskOut - uDiskIn);
          float omega = 1.6 / pow(r / uRs, 1.5);
          float ang = atan(x.z, x.x) + uTime * omega;
          vec3 pc = vec3(cos(ang) * r, sin(ang) * r, r * 0.6) / uRs;
          float n = fbm(pc * 0.9 + vec3(0.0, 0.0, uTime * 0.05), 5) * 0.5 + 0.5;
          float streaks = fbm(vec3(r / uRs * 3.0, cos(ang) * 1.2, sin(ang) * 1.2), 4) * 0.5 + 0.5;
          float dens = smoothstep(0.0, 0.08, k) * pow(1.0 - k, 1.6) * (0.35 + 0.9 * n * streaks);
          // Temperature falls with radius
          vec3 col = mix(uHot, uWarm, smoothstep(0.0, 0.35, k));
          col = mix(col, uCool, smoothstep(0.35, 1.0, k));
          // Relativistic Doppler beaming: approaching side brighter and bluer
          vec3 vel = normalize(vec3(-x.z, 0.0, x.x));
          float beta = 0.55 * sqrt(uRs / r);
          float dop = 1.0 / (1.0 - beta * dot(vel, -v));
          float beam = pow(dop, 3.0);
          col *= mix(vec3(1.0, 0.75, 0.55), vec3(0.8, 0.9, 1.25), clamp(dop - 0.6, 0.0, 1.0));
          float I = dens * beam * (0.9 + 1.8 * (1.0 - k));
          return vec4(col * I, clamp(dens * 1.2, 0.0, 1.0));
        }

        void main() {
          vec3 roW = cameraPosition;
          vec3 rdW = normalize(vWorldPos - roW);
          vec2 tb = raySphere(roW, rdW, uCenter, uBound);
          if (tb.y < 0.0) discard;
          float t0 = max(tb.x, 0.0);
          vec3 x = uInvRot * (roW + rdW * t0 - uCenter);
          vec3 v = uInvRot * rdW;
          vec3 h = cross(x, v);
          float h2 = dot(h, h);
          vec3 col = vec3(0.0);
          float alpha = 0.0;
          float minR = 1e9;
          bool captured = false;
          for (int i = 0; i < STEPS; i++) {
            float r = length(x);
            minR = min(minR, r);
            if (r < uRs) { captured = true; break; }
            if (r > uBound * 1.02 && dot(x, v) > 0.0) break;
            float dt = clamp(0.08 * r, 0.02 * uRs, 0.9 * uRs);
            vec3 acc = -1.5 * uRs * h2 * x / pow(r, 5.0);
            vec3 xPrev = x;
            v += acc * dt;
            x += v * dt;
            if (xPrev.y * x.y < 0.0) {
              vec3 xc = mix(xPrev, x, xPrev.y / (xPrev.y - x.y));
              vec4 d = diskSample(xc, normalize(v));
              col += (1.0 - alpha) * d.rgb;
              alpha += (1.0 - alpha) * d.a;
              if (alpha > 0.98) break;
            }
          }
          if (captured) {
            alpha = 1.0;
          }
          // Photon ring glow near 1.5 rs
          float rq = (minR - 1.5 * uRs) / (0.12 * uRs);
          float ring = exp(-rq * rq) * (captured ? 0.0 : 1.0);
          col += (1.0 - alpha) * uWarm * ring * 1.1;
          alpha = max(alpha, ring * 0.4);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }));
    this.volume = this.pickable(new THREE.Mesh(new THREE.SphereGeometry(bound, 64, 32), this.mat));
    this.volume.renderOrder = 8;
    this.spin.add(this.volume);
    this.tilt.rotation.set(spec.inclination ?? 0.18, 0, 0.08);
    this.light = new THREE.PointLight(spec.palette[1], 1.5, 0, 0);
    this.root.add(this.light);
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    this.spin.updateWorldMatrix(true, false);
    const m = new THREE.Matrix3().setFromMatrix4(this.spin.matrixWorld);
    this.mat.uniforms.uInvRot.value.copy(m).invert();
  }
}
