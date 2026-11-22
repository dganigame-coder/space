import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { Body } from './Body.js';
import { blackbody } from '../core/utils.js';

// Main-sequence star: animated granulation, sunspots, limb darkening, HDR corona
// with streamers, and a scene light source for standard PBR materials.
export class Star extends Body {
  constructor(spec, quality) {
    super(spec);
    const r = spec.radius;
    this.isStar = true;
    this.occluder = false;
    this.color = spec.temperature ? blackbody(spec.temperature) : spec.color.clone();
    this.intensity = spec.intensity ?? 5.0;

    this.surfaceMat = this.track(new THREE.ShaderMaterial({
      defines: { OCTAVES: Math.min(quality.octaves, 6) },
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: this.color },
        uIntensity: { value: this.intensity },
        uSeed: { value: spec.seed % 71 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vPos = normalize(position);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        ${NOISE_GLSL}
        uniform float uTime, uIntensity, uSeed;
        uniform vec3 uColor;
        varying vec3 vPos;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vec3 p = normalize(vPos);
          float t = uTime;
          float big = fbm(p * 3.0 + vec3(t * 0.02, 0.0, uSeed), 4);
          float gran = fbm(p * 34.0 + big * 2.0 + vec3(0.0, t * 0.08, 0.0), 3);
          float cells = 1.0 - abs(snoise(p * 60.0 + vec3(t * 0.15)));
          float spots = smoothstep(0.62, 0.78, fbm(p * 2.5 + uSeed + vec3(t * 0.005), OCTAVES) * 0.5 + 0.5);
          float faculae = smoothstep(0.55, 0.7, fbm(p * 6.0 + uSeed + 3.0, 3) * 0.5 + 0.5);
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(cameraPosition - vWorldPos);
          float mu = max(dot(N, V), 0.0);
          float limb = 0.28 + 0.72 * pow(mu, 0.5);
          float I = uIntensity * (0.78 + 0.28 * gran + 0.12 * cells + 0.2 * big);
          I *= 1.0 - spots * 0.82;
          I += faculae * (1.0 - mu) * 0.9;
          vec3 col = uColor * I * limb;
          // Cooler, redder limb
          col *= mix(vec3(1.0, 0.55, 0.3), vec3(1.0), smoothstep(0.0, 0.5, mu));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }));
    this.surface = this.pickable(new THREE.Mesh(new THREE.SphereGeometry(r, 128, 64), this.surfaceMat));
    this.spin.add(this.surface);

    // Corona billboard
    const size = r * 9;
    this.coronaMat = this.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: this.color },
        uIntensity: { value: this.intensity },
        uSize: { value: size },
        uRadius: { value: r },
      },
      vertexShader: /* glsl */ `
        uniform float uSize;
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mv.xy += (uv - 0.5) * uSize;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        ${NOISE_GLSL}
        uniform float uTime, uIntensity, uSize, uRadius;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float rr = length(vUv) * uSize * 0.5 / uRadius;  // in stellar radii
          if (rr < 0.98) discard;
          vec2 dir = normalize(vUv);
          float streamers = fbm(vec3(dir * 2.6, uTime * 0.04), 4) * 0.5 + 0.5;
          float fine = fbm(vec3(dir * 9.0, uTime * 0.07 + rr * 0.3), 3) * 0.5 + 0.5;
          float x = rr - 1.0;
          float inner = exp(-x * 9.0) * 1.6;
          float outer = exp(-x * 1.4) * 0.45 * pow(max(streamers, 0.0), 2.2) * (0.6 + 0.8 * fine);
          float halo = exp(-x * 0.55) * 0.05;
          float edge = smoothstep(1.0, 0.75, length(vUv));
          vec3 col = uColor * (inner + outer + halo) * uIntensity * 0.2 * edge;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }));
    this.corona = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.coronaMat);
    this.corona.frustumCulled = false;
    this.corona.renderOrder = 10;
    this.root.add(this.corona);

    // Light for standard materials (asteroids etc.)
    this.light = new THREE.PointLight(this.color, 3.2, 0, 0);
    this.root.add(this.light);
  }
}
