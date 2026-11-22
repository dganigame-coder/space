import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { Body } from './Body.js';
import { createAtmosphere } from './Atmosphere.js';
import { Rings } from './Rings.js';

const VERT = /* glsl */ `
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
`;

const FRAG = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uTime, uSeed, uBands, uFlow, uStorm, uContrast;
  uniform vec3 uSunPos, uSunColor, uC0, uC1, uC2, uC3, uC4, uStormColor;
  uniform vec3 uRingCenter, uRingNormal;
  uniform float uRingInner, uRingOuter, uHasRings;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vec3 p = normalize(vPos);
    float lat = p.y;
    // Differential zonal flow: alternating jets per band
    float jet = sin(lat * uBands * 0.5 + uSeed) ;
    vec3 q = rotateY(p, uTime * uFlow * (0.6 + 0.4 * jet));
    vec3 w = vec3(fbm(q * vec3(2.0, 7.0, 2.0) + uSeed, 4), fbm(q * vec3(2.0, 7.0, 2.0) + uSeed + 7.0, 4), 0.0);
    float turb = fbm(q * vec3(5.0, 16.0, 5.0) + vec3(w.xy, 0.0) * 0.9 + uSeed, OCTAVES);
    float band = lat * uBands + turb * 1.1 * uContrast + fbm(vec3(lat * 4.0, uSeed, 1.0), 3) * 2.2;
    float b1 = sin(band) * 0.5 + 0.5;
    float b2 = sin(band * 2.3 + 1.7) * 0.5 + 0.5;
    vec3 col = mix(uC0, uC1, b1);
    col = mix(col, uC2, b2 * 0.55);
    col = mix(col, uC3, smoothstep(0.25, 0.9, turb * 0.5 + 0.5) * 0.45 * uContrast);
    // Fine filaments
    float fil = fbm(q * vec3(12.0, 40.0, 12.0) + w * 2.0, 3);
    col *= 0.88 + 0.24 * fil;
    // Restore saturation lost to band mixing
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = max(mix(vec3(lum), col, 1.0 + 0.35 * uContrast), 0.0);

    // Great storm (anticyclonic oval)
    if (uStorm > 0.0) {
      vec3 sc = normalize(vec3(cos(uSeed) * 0.92, -0.36, sin(uSeed) * 0.92));
      vec3 sq = rotateY(p, uTime * uFlow * 0.8);
      vec3 dv = sq - sc;
      float d = length(dv * vec3(0.55, 1.4, 0.55));
      float swirl = fbm(sq * 18.0 + vec3(d * 8.0 - uTime * 0.3), 3);
      float storm = smoothstep(0.17, 0.05, d + swirl * 0.03);
      col = mix(col, uStormColor * (0.85 + 0.3 * swirl), storm * uStorm);
      col = mix(col, uC4, smoothstep(0.2, 0.17, d) * smoothstep(0.12, 0.17, d) * 0.4 * uStorm);
    }
    // Polar hood darkening / tint
    col = mix(col, uC4 * 0.6, smoothstep(0.72, 0.98, abs(lat)) * 0.55);

    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uSunPos - vWorldPos);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndl = dot(N, L);
    float diff = smoothstep(-0.08, 1.0, ndl);
    float limb = pow(max(dot(N, V), 0.0), 0.32);

    // Ring shadow cast onto the planet
    float shadow = 1.0;
    if (uHasRings > 0.5) {
      float denom = dot(L, uRingNormal);
      if (abs(denom) > 1e-4) {
        float tt = dot(uRingCenter - vWorldPos, uRingNormal) / denom;
        if (tt > 0.0) {
          vec3 hit = vWorldPos + L * tt;
          float rr = length(hit - uRingCenter);
          float k = (rr - uRingInner) / (uRingOuter - uRingInner);
          if (k > 0.0 && k < 1.0) {
            float dens = 0.55 + 0.45 * sin(k * 60.0) * sin(k * 17.0);
            dens *= smoothstep(0.0, 0.05, k) * smoothstep(1.0, 0.92, k);
            dens *= 1.0 - smoothstep(0.52, 0.55, k) * smoothstep(0.6, 0.57, k);
            shadow = 1.0 - clamp(dens, 0.0, 1.0) * 0.75;
          }
        }
      }
    }

    vec3 lit = col * uSunColor * diff * limb * shadow;
    // Rayleigh-ish forward haze at the limb
    float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    lit += uC1 * rim * smoothstep(-0.2, 0.4, ndl) * 0.25;
    gl_FragColor = vec4(lit, 1.0);
  }
`;

export class GasGiant extends Body {
  constructor(spec, quality) {
    super(spec);
    const r = spec.radius;
    const [c0, c1, c2, c3, c4] = spec.palette;
    this.mat = this.track(new THREE.ShaderMaterial({
      defines: { OCTAVES: Math.min(quality.octaves, 7) },
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: (spec.seed % 89) * 0.37 },
        uBands: { value: spec.bands ?? 18 },
        uFlow: { value: spec.flow ?? 0.02 },
        uStorm: { value: spec.storm ? 1 : 0 },
        uContrast: { value: spec.contrast ?? 1 },
        uStormColor: { value: spec.stormColor || c3.clone() },
        uSunPos: { value: new THREE.Vector3() },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uC0: { value: c0 }, uC1: { value: c1 }, uC2: { value: c2 }, uC3: { value: c3 }, uC4: { value: c4 },
        uRingCenter: { value: new THREE.Vector3() },
        uRingNormal: { value: new THREE.Vector3(0, 1, 0) },
        uRingInner: { value: 0 },
        uRingOuter: { value: 0 },
        uHasRings: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    }));
    const geo = new THREE.SphereGeometry(r, 192, 96);
    geo.scale(1, spec.oblateness ?? 0.94, 1);
    this.surface = this.pickable(new THREE.Mesh(geo, this.mat));
    this.spin.add(this.surface);

    if (spec.atmosphere) {
      this.atmo = createAtmosphere({
        radius: r,
        thickness: spec.atmosphere.thickness ?? 0.035,
        color: spec.atmosphere.color,
        density: spec.atmosphere.density ?? 0.6,
        mie: 0.2,
        steps: 10,
      });
      this.track(this.atmo.material);
      this.tilt.add(this.atmo);
    }

    if (spec.rings) {
      this.rings = new Rings({ ...spec.rings, planetRadius: r, seed: spec.seed }, quality);
      this.tilt.add(this.rings.mesh);
      this.track(this.rings.material);
      const u = this.mat.uniforms;
      u.uHasRings.value = 1;
      u.uRingInner.value = this.rings.inner;
      u.uRingOuter.value = this.rings.outer;
    }
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    if (this.rings) {
      const u = this.mat.uniforms;
      this.root.getWorldPosition(u.uRingCenter.value);
      u.uRingNormal.value.set(0, 1, 0).applyQuaternion(this.tilt.getWorldQuaternion(new THREE.Quaternion()));
      this.rings.material.uniforms.uCenter.value.copy(u.uRingCenter.value);
    }
  }

  setTexture(texture) {
    // Gas giants keep their procedural flow; AI texture tints the palette subtly.
    this._tex = texture;
  }
}
