import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { Body } from './Body.js';
import { createAtmosphere } from './Atmosphere.js';

export const PLANET_KINDS = { terran: 0, barren: 1, desert: 2, ice: 3, lava: 4, cloudy: 5 };

const SURFACE_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  void main() {
    vPos = normalize(position);
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SURFACE_FRAG = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uTime, uSeed, uRadius, uSeaLevel, uBump, uMapMix, uDetail;
  uniform float uCloudRot, uCloudCover, uCloudShadow, uCityLights, uHasClouds;
  uniform vec3 uSunPos, uSunColor;
  uniform vec3 uC0, uC1, uC2, uC3, uC4;
  uniform sampler2D uMap;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;

  float terrain(vec3 p) {
    vec3 q = p * 1.5 + uSeed;
    vec3 w = vec3(fbm(q, 3), fbm(q + vec3(5.2, 1.3, 2.8), 3), fbm(q + vec3(1.7, 9.2, 4.1), 3));
    float h = fbm(q * 1.3 + w * 1.15, OCTAVES);
  #if KIND == 0
    h += 0.35 * ridged(q * 2.2 + w, 5) * smoothstep(0.0, 0.3, h);
  #elif KIND == 1
    h = h * 0.35 + craterField(p * 3.5 + uSeed) * 0.55 + craterField(p * 9.0 + uSeed * 1.7) * 0.22 + craterField(p * 22.0 + uSeed * 2.3) * 0.08;
  #elif KIND == 2
    h = h * 0.6 + craterField(p * 4.0 + uSeed) * 0.3 + craterField(p * 12.0 + uSeed) * 0.1 + 0.25 * ridged(q * 1.6, 4) * smoothstep(0.1, 0.5, h);
  #elif KIND == 3
    h = h * 0.3 + 0.25 * pow(max(1.0 - abs(snoise(p * 5.0 + uSeed + w)), 0.0), 14.0) + craterField(p * 6.0 + uSeed) * 0.08;
  #elif KIND == 4
    h = h * 0.8;
  #endif
    return h;
  }

  void main() {
    vec3 p = normalize(vPos);
    vec3 N0 = normalize(vWorldNormal);
    vec3 L = normalize(uSunPos - vWorldPos);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float geo = dot(N0, L);
    float lat = abs(p.y);

    float h = terrain(p);
    vec3 albedo;
    float water = 0.0;
    float bumpH = h;
    vec3 emission = vec3(0.0);
    float rough = 1.0;

  #if KIND == 0
    float sea = uSeaLevel;
    float moist = fbm(p * 2.3 + uSeed + 11.0, 4) * 0.5 + 0.5;
    if (h < sea) {
      float d = smoothstep(sea - 0.4, sea, h);
      albedo = mix(uC0, uC1, d * d * d);
      water = 1.0;
      bumpH = sea + (h - sea) * 0.02;
    } else {
      float e = clamp((h - sea) / max(0.6 - sea, 0.1), 0.0, 1.0);
      float lush = smoothstep(0.38, 0.66, moist + (1.0 - lat) * 0.18 - lat * 0.25);
      vec3 arid = vec3(0.30, 0.20, 0.09);
      vec3 low = mix(arid, uC2, lush);
      albedo = mix(low, uC3, smoothstep(0.18, 0.62, e));
      albedo = mix(vec3(0.42, 0.36, 0.22), albedo, smoothstep(0.0, 0.025, e));
      albedo = mix(albedo, uC4, smoothstep(0.72, 0.92, e));
      float cities = smoothstep(0.62, 0.82, snoise(p * 38.0 + uSeed) * 0.5 + 0.5) * smoothstep(0.35, 0.0, e) * smoothstep(0.3, 0.6, moist);
      cities *= 0.4 + 0.6 * smoothstep(0.55, 0.9, snoise(p * 140.0) * 0.5 + 0.5);
      emission += vec3(1.0, 0.55, 0.22) * cities * uCityLights * 1.8;
    }
    float ice = smoothstep(0.78, 0.84, lat + fbm(p * 5.0 + uSeed, 3) * 0.08);
    albedo = mix(albedo, vec3(0.85, 0.89, 0.95), ice);
    water *= 1.0 - ice;
    emission *= 1.0 - ice;
  #elif KIND == 1
    float maria = smoothstep(0.05, 0.35, fbm(p * 1.2 + uSeed + 3.0, 4));
    albedo = mix(uC2, uC0, maria * 0.85);
    albedo = mix(albedo, uC3, smoothstep(0.1, 0.35, h) * 0.6);
    albedo *= 0.8 + 0.35 * (fbm(p * 30.0, 3) * 0.5 + 0.5);
  #elif KIND == 2
    float dust = fbm(p * 2.0 + uSeed + 5.0, 5) * 0.5 + 0.5;
    albedo = mix(uC0, uC2, smoothstep(0.3, 0.7, dust));
    albedo = mix(albedo, uC3, smoothstep(0.15, 0.45, h) * 0.5);
    albedo = mix(albedo, uC1, smoothstep(-0.2, -0.45, h) * 0.6);
    albedo *= 0.85 + 0.3 * (fbm(p * 26.0, 3) * 0.5 + 0.5);
    float cap = smoothstep(0.9, 0.94, lat + fbm(p * 6.0, 3) * 0.05);
    albedo = mix(albedo, vec3(0.86, 0.85, 0.82), cap);
  #elif KIND == 3
    float lineae = pow(max(1.0 - abs(snoise(p * 4.0 + uSeed * 1.3)), 0.0), 22.0) + 0.6 * pow(max(1.0 - abs(snoise(p * 9.0 + uSeed)), 0.0), 28.0);
    albedo = mix(uC3, uC4, fbm(p * 3.0 + uSeed, 4) * 0.5 + 0.5);
    albedo = mix(albedo, uC1, clamp(lineae, 0.0, 1.0) * 0.8);
    albedo = mix(albedo, uC0, smoothstep(0.1, 0.4, fbm(p * 1.4 + 7.0, 3)) * 0.35);
    rough = 0.5;
  #elif KIND == 4
    vec3 wl = vec3(fbm(p * 2.0 + uSeed, 3), fbm(p * 2.0 + uSeed + 4.0, 3), 0.0);
    float c1 = pow(max(1.0 - abs(snoise(p * 4.0 + wl * 1.5 + uSeed)), 0.0), 38.0);
    float c2 = pow(max(1.0 - abs(snoise(p * 11.0 + wl * 2.0)), 0.0), 48.0) * 0.6;
    float crack = smoothstep(0.08, 0.7, c1 + c2);
    float pools = smoothstep(-0.32, -0.5, h);
    float heat = clamp(crack + pools, 0.0, 1.3);
    float flicker = 0.88 + 0.12 * sin(uTime * 1.3 + h * 20.0);
    // Cooled basalt crust, slightly tinted by the AI palette
    vec3 basalt = mix(vec3(0.045, 0.04, 0.038), vec3(0.16, 0.13, 0.11), fbm(p * 8.0, 3) * 0.5 + 0.5);
    albedo = mix(basalt, uC0 * 0.4, 0.25);
    albedo = mix(albedo, vec3(0.32, 0.18, 0.1), smoothstep(0.0, 0.25, c1 + c2) * 0.35); // warm crust near fissures
    emission += mix(vec3(1.6, 0.28, 0.03), vec3(4.5, 1.8, 0.35), clamp(heat - 0.6, 0.0, 1.0)) * heat * flicker;
    bumpH = h - heat * 0.08;
  #elif KIND == 5
    vec3 q = rotateY(p, uTime * 0.01);
    float band = fbm(q * vec3(2.0, 5.0, 2.0) + fbm(q * 3.0 + uSeed, 4) * 1.4, 5);
    albedo = mix(uC1, uC3, band * 0.5 + 0.5);
    albedo = mix(albedo, uC4, smoothstep(0.2, 0.6, band) * 0.4);
    bumpH = band * 0.08;
  #endif

    // AI texture blend (keeps procedural micro-relief on top)
    if (uMapMix > 0.0) {
      vec3 tex = texture2D(uMap, vUv).rgb;
      albedo = mix(albedo, tex, uMapMix);
    }

    // Close-range micro detail (fields, rock, scrub) when the camera is near the ground.
    if (uDetail > 0.0) {
      float dc = length(cameraPosition - vWorldPos) / uRadius;
      float k = uDetail * smoothstep(0.03, 0.0006, dc);
      if (k > 0.002) {
        float n1 = fbm(p * 900.0 + uSeed, 4);
        float n2 = fbm(p * 6500.0 + uSeed * 1.3, 3);
        float n3 = snoise(p * 32000.0);
        float landK = k * (1.0 - water);
        albedo *= 1.0 + landK * (n1 * 0.45 + n2 * 0.25 + n3 * 0.08);
        albedo = mix(albedo, albedo * vec3(0.85, 1.05, 0.8), landK * smoothstep(0.0, 0.5, n2) * 0.4);
        bumpH += landK * (n1 * 0.004 + n2 * 0.0007 + n3 * 0.0001);
      }
    }
    vec3 N = perturbNormal(vWorldPos, N0, bumpH * uRadius * uBump);
    float ndl = max(dot(N, L), 0.0);
    float day = smoothstep(-0.06, 0.18, geo);

    float cloudSh = 0.0;
    if (uHasClouds > 0.5) {
      cloudSh = cloudDensity(p, uCloudRot, uSeed, uCloudCover, 4) * uCloudShadow;
    }

    vec3 col = albedo * uSunColor * ndl * day * (1.0 - cloudSh);

    // Ocean: sun glint with Fresnel, plus subtle sky reflection
    if (water > 0.0) {
      vec3 H = normalize(L + V);
      float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N0, V), 0.0), 5.0);
      float wave = snoise(p * 180.0 + uTime * 0.2) * 0.02;
      float spec = pow(max(dot(normalize(N0 + wave), H), 0.0), 320.0) * 1.3 + pow(max(dot(N0, H), 0.0), 30.0) * 0.08;
      col += uSunColor * spec * water * day * (1.0 - cloudSh);
      col += vec3(0.02, 0.05, 0.1) * fres * water * day;
    }
  #if KIND == 3
    vec3 Hh = normalize(L + V);
    col += uSunColor * pow(max(dot(N, Hh), 0.0), 60.0) * 0.25 * day;
  #endif

    // Night side: city lights / lava glow only where unlit
    float night = 1.0 - smoothstep(-0.12, 0.08, geo);
  #if KIND == 4
    col += emission;
  #else
    col += emission * night * (1.0 - cloudSh * 0.8);
  #endif
    col += albedo * 0.0025; // faint starlight
    gl_FragColor = vec4(col, 1.0);
  }
`;

const CLOUD_FRAG = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uTime, uSeed, uCloudRot, uCloudCover, uOpacity;
  uniform vec3 uSunPos, uSunColor, uCloudColor;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  void main() {
    vec3 p = normalize(vPos);
    float d = cloudDensity(p, uCloudRot, uSeed, uCloudCover, OCTAVES);
    if (d < 0.01) discard;
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uSunPos - vWorldPos);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndl = dot(N, L);
    float lit = smoothstep(-0.12, 0.2, ndl) * (0.18 + 0.82 * clamp(ndl, 0.0, 1.0));
    // Self-shadowing: denser clouds are slightly darker at their core
    float thick = cloudDensity(p + L * 0.004, uCloudRot, uSeed, uCloudCover, 3);
    float shade = mix(1.0, 0.72, thick * 0.6);
    // Warm sunset tint along the terminator
    vec3 tint = mix(vec3(1.0, 0.55, 0.3), vec3(1.0), smoothstep(0.0, 0.3, ndl));
    vec3 col = uCloudColor * uSunColor * tint * lit * shade * 0.85;
    if (dot(V, N) < 0.0) col *= 0.5 + 0.3 * (1.0 - d); // seen from below: shaded undersides
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float alpha = d * uOpacity * (1.0 - rim * 0.5);
    gl_FragColor = vec4(col, alpha);
  }
`;

export class Planet extends Body {
  constructor(spec, quality) {
    super(spec);
    const r = spec.radius;
    const kindId = PLANET_KINDS[spec.surface] ?? 0;
    const [c0, c1, c2, c3, c4] = spec.palette;
    const segs = quality.octaves >= 7 ? 192 : 128;

    this.surfaceMat = this.track(new THREE.ShaderMaterial({
      defines: { KIND: kindId, OCTAVES: quality.octaves },
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: spec.seed % 97 },
        uRadius: { value: r },
        uSeaLevel: { value: spec.seaLevel ?? 0.02 },
        uBump: { value: spec.bump ?? (kindId === 0 ? 0.045 : 0.06) },
        uMapMix: { value: 0 },
        uDetail: { value: 0 },
        uMap: { value: null },
        uCloudRot: { value: 0 },
        uCloudCover: { value: spec.clouds?.cover ?? 0.5 },
        uCloudShadow: { value: spec.clouds ? 0.45 : 0 },
        uHasClouds: { value: spec.clouds ? 1 : 0 },
        uCityLights: { value: spec.cityLights ? 1 : 0 },
        uSunPos: { value: new THREE.Vector3() },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uC0: { value: c0 }, uC1: { value: c1 }, uC2: { value: c2 }, uC3: { value: c3 }, uC4: { value: c4 },
      },
      vertexShader: SURFACE_VERT,
      fragmentShader: SURFACE_FRAG,
    }));
    this.surface = this.pickable(new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs / 2), this.surfaceMat));
    this.spin.add(this.surface);

    if (spec.clouds) {
      this.cloudMat = this.track(new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        defines: { OCTAVES: Math.min(quality.octaves, 7) },
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: spec.seed % 97 },
          uCloudRot: { value: 0 },
          uCloudCover: { value: spec.clouds.cover ?? 0.5 },
          uOpacity: { value: spec.clouds.opacity ?? 0.95 },
          uCloudColor: { value: spec.clouds.color || new THREE.Color(1, 1, 1) },
          uSunPos: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color(1, 1, 1) },
        },
        vertexShader: SURFACE_VERT,
        fragmentShader: CLOUD_FRAG,
      }));
      this.cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(r * 1.012, segs, segs / 2), this.cloudMat);
      this.cloudMesh.renderOrder = 2;
      this.spin.add(this.cloudMesh);
      this.cloudSpeed = spec.clouds.speed ?? 0.012;
      this.cloudRot = 0;
    }

    if (spec.atmosphere) {
      this.atmo = createAtmosphere({
        radius: r,
        thickness: spec.atmosphere.thickness ?? 0.05,
        color: spec.atmosphere.color,
        density: spec.atmosphere.density ?? 1,
        mie: spec.atmosphere.mie ?? 0.35,
        steps: quality.volumeSteps > 40 ? 14 : 10,
      });
      this.track(this.atmo.material);
      this.root.add(this.atmo);
    }
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    if (this.cloudMat) {
      // Clouds drift relative to the surface; both shaders share the same rotation for aligned shadows.
      this.cloudRot += this.cloudSpeed * dt;
      this.cloudMat.uniforms.uCloudRot.value = this.cloudRot;
      this.surfaceMat.uniforms.uCloudRot.value = this.cloudRot;
    }
    if (this.atmo && ctx.camera) {
      // Inside the shell we see the back faces; depth testing is unnecessary because the shader
      // intersects the planet sphere itself.
      const outer = this.atmo.geometry.parameters.radius;
      const d = ctx.camera.position.distanceTo(this.root.getWorldPosition(new THREE.Vector3()));
      const inside = d < outer * 1.001;
      const m = this.atmo.material;
      if (inside !== this._atmoInside) {
        this._atmoInside = inside;
        m.side = inside ? THREE.BackSide : THREE.FrontSide;
        m.depthTest = !inside;
        m.needsUpdate = true;
      }
      m.uniforms.uInside.value = inside ? 1 - THREE.MathUtils.smoothstep(d, this.radius * 1.002, outer) : 0;
    }
    if (this._fade && this._fade.t < 1) {
      this._fade.t = Math.min(1, this._fade.t + dt / 1.6);
      this.surfaceMat.uniforms.uMapMix.value = this._fade.t * this._fade.target;
    }
  }

  setTexture(texture) {
    this.surfaceMat.uniforms.uMap.value = texture;
    this._fade = { t: 0, target: 0.82 };
  }
}
