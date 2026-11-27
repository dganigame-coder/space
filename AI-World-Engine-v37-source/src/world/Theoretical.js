import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { Body } from './Body.js';
import { rng } from '../core/utils.js';

// ---------------------------------------------------------------------------------------------
// Theoretical objects. Each is rendered from the physics of the hypothesis it comes from,
// not from artistic guesswork:
//   Wormhole  - exact null geodesics of the Ellis (Morris-Thorne) metric via elliptic integrals
//   WhiteHole - Schwarzschild exterior (identical to a black hole) with time-reversed matter flow
//   Multiverse - eternal-inflation bubble universes nucleating in a false vacuum, with collisions
// ---------------------------------------------------------------------------------------------

const ELLIPTIC_GLSL = /* glsl */ `
  // Complete elliptic integral of the first kind via arithmetic-geometric mean.
  float ellK(float k) {
    float a = 1.0, b = sqrt(max(1.0 - k * k, 1e-9));
    for (int i = 0; i < 7; i++) { float an = 0.5 * (a + b); b = sqrt(a * b); a = an; }
    return 1.5707963 / a;
  }
  // Incomplete elliptic integral F(phi, k), Simpson's rule (integrand is smooth for phi < pi/2).
  float ellF(float phi, float k) {
    float h = phi / 16.0;
    float s = 0.0;
    for (int i = 0; i <= 16; i++) {
      float th = h * float(i);
      float w = (i == 0 || i == 16) ? 1.0 : (mod(float(i), 2.0) > 0.5 ? 4.0 : 2.0);
      float sn = sin(th);
      s += w / sqrt(max(1.0 - k * k * sn * sn, 1e-7));
    }
    return s * h / 3.0;
  }
`;

// Procedural sky of the universe on the other side of the throat.
const OTHER_SKY_GLSL = /* glsl */ `
  uniform vec3 uOtherA, uOtherB, uOtherC;
  float starLayer(vec3 d, float scale, float thresh) {
    vec3 q = d * scale;
    vec3 c = floor(q);
    vec3 h = hash33(c);
    vec3 sp = c + 0.2 + 0.6 * h;
    float dist = length(q - sp);
    float on = step(thresh, hash13(c + 7.1));
    return on * exp(-dist * dist * 22.0) * (0.4 + 2.6 * pow(h.y, 6.0));
  }
  vec3 otherSky(vec3 d) {
    vec3 gN = normalize(vec3(0.35, 0.86, -0.36));
    float b = dot(d, gN) + fbm(d * 2.5 + 4.0, 4) * 0.1;
    float band = exp(-b * b * 18.0);
    vec3 core = normalize(vec3(-0.6, 0.15, 0.78));
    float toCore = max(dot(d, core), 0.0);
    float bulge = pow(toCore, 10.0) * exp(-b * b * 6.0);
    float clump = fbm(d * 6.0 + 13.0, 5) * 0.5 + 0.5;
    float dust = smoothstep(0.45, 0.8, fbm(d * 8.0 + 3.0, 5) * 0.5 + 0.5) * exp(-b * b * 90.0);
    vec3 col = mix(uOtherA, uOtherB, clamp(toCore * 1.4, 0.0, 1.0)) * (band * (0.4 + clump) + bulge * 2.2) * (1.0 - dust * 0.85) * 0.22;
    float neb = smoothstep(0.5, 0.95, fbm(d * 1.8 + 9.0, 5) * 0.5 + 0.5);
    col += uOtherC * neb * 0.12 * (0.5 + band);
    // A nearby galaxy hanging in the alien sky
    vec3 gd = normalize(vec3(0.7, 0.35, 0.62));
    vec3 gu = normalize(cross(gd, vec3(0.0, 1.0, 0.0)));
    vec3 gv = cross(gu, gd);
    vec2 g = vec2(dot(d, gu), dot(d, gv) * 2.6) / 0.11;
    float gr = length(g);
    if (dot(d, gd) > 0.0 && gr < 1.6) {
      float ga = atan(g.y, g.x);
      float arms = 0.5 + 0.5 * cos(2.0 * ga - 5.0 * log(gr + 0.05));
      col += mix(uOtherB, vec3(1.0, 0.95, 0.85), exp(-gr * 6.0)) * (exp(-gr * 7.0) * 3.0 + arms * exp(-gr * 2.2) * 0.35);
    }
    col += vec3(1.0, 0.92, 0.85) * starLayer(d, 160.0, 0.82);
    col += mix(vec3(0.7, 0.8, 1.0), uOtherB, 0.4) * starLayer(d, 420.0, 0.7) * 0.6;
    return col;
  }
`;

// ---------------------------------- Wormhole ----------------------------------
export class Wormhole extends Body {
  constructor(spec, quality, engine) {
    super(spec);
    this.engine = engine;
    this.spinSpeed = 0;
    this.occluder = false;
    const a = spec.radius; // throat radius
    const bound = a * 9;
    this.cubeSize = quality.volumeSteps >= 72 ? 2048 : quality.volumeSteps >= 48 ? 1024 : 512;
    this.cubeRT = new THREE.WebGLCubeRenderTarget(this.cubeSize, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.cubeCam = new THREE.CubeCamera(0.1, 5000, this.cubeRT);
    this._captured = false;

    const p = spec.palette;
    this.mat = this.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uA: { value: a },
        uBound: { value: bound },
        uSky: { value: this.cubeRT.texture },
        uOtherA: { value: p[0] }, uOtherB: { value: p[1] }, uOtherC: { value: p[2] },
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
        ${ELLIPTIC_GLSL}
        ${OTHER_SKY_GLSL}
        uniform float uTime, uA, uBound;
        uniform vec3 uCenter;
        uniform samplerCube uSky;
        varying vec3 vWorldPos;

        void main() {
          vec3 ro = cameraPosition;
          vec3 rd = normalize(vWorldPos - ro);
          vec3 rel = ro - uCenter;
          float D = max(length(rel), uA * 1.001);
          vec3 e1 = rel / max(length(rel), 1e-5);
          float radial = dot(rd, e1);
          vec3 perp = rd - radial * e1;
          float pl = length(perp);
          vec3 e2 = pl > 1e-6 ? perp / pl : normalize(cross(e1, vec3(0.0, 1.0, 0.001)));
          float b = D * pl;                 // impact parameter (conserved angular momentum)
          bool inward = radial < 0.0;

          // Total azimuthal sweep of the null geodesic in the Ellis metric r^2 = l^2 + a^2.
          float dphi;
          bool through = false;
          if (b > uA) {
            float k = min(uA / b, 0.99995);
            float F = ellF(asin(clamp(b / D, 0.0, 1.0)), k);
            dphi = inward ? 2.0 * ellK(k) - F : F;
          } else {
            float k = min(b / uA, 0.99995);
            float F = ellF(asin(clamp(uA / D, 0.0, 1.0)), k);
            dphi = inward ? k * (2.0 * ellK(k) - F) : k * F;
            through = inward;
          }
          vec3 dir = cos(dphi) * e1 + sin(dphi) * e2;

          vec3 col = through ? otherSky(dir) : textureCube(uSky, dir).rgb;
          // Light that skims the throat winds around many times: a thin photon ring
          float q = (b - uA) / (0.012 * uA);
          col += vec3(0.75, 0.85, 1.0) * exp(-q * q) * 0.35 * (inward ? 1.0 : 0.0);
          float fade = 1.0 - smoothstep(uBound * 0.55, uBound * 0.98, b);
          gl_FragColor = vec4(col * fade, fade);
        }
      `,
    }));
    this.mat.blending = THREE.CustomBlending;
    this.mat.blendSrc = THREE.OneFactor;
    this.mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    this.volume = this.pickable(new THREE.Mesh(new THREE.SphereGeometry(bound, 96, 48), this.mat));
    this.volume.renderOrder = 8;
    this.volume.frustumCulled = false;
    this.root.add(this.volume);
  }

  // Render our universe's sky into a cube map once; the shader lenses it per pixel.
  _capture() {
    const { renderer, scene, skybox } = this.engine;
    const hidden = [];
    for (const child of scene.children) {
      if (skybox && child === skybox.group) continue;
      if (child.visible) { child.visible = false; hidden.push(child); }
    }
    this.cubeCam.position.copy(skybox ? skybox.group.position : this.engine.camera.position);
    const prevTM = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    this.cubeCam.update(renderer, scene);
    renderer.toneMapping = prevTM;
    for (const c of hidden) c.visible = true;
    this._captured = true;
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    if (!this._captured && this.engine) this._capture();
  }

  dispose() {
    super.dispose();
    this.cubeRT.dispose();
  }
}

// ---------------------------------- White hole ----------------------------------
export class WhiteHole extends Body {
  constructor(spec, quality) {
    super(spec);
    this.spinSpeed = 0;
    const rs = spec.radius;
    const bound = rs * 16;
    this.mat = this.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      defines: { STEPS: Math.round(quality.volumeSteps * 1.8) },
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uRs: { value: rs },
        uBound: { value: bound },
        uHot: { value: spec.palette[0] },
        uWarm: { value: spec.palette[1] },
        uCool: { value: spec.palette[2] },
        uDeep: { value: spec.palette[3] },
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
        uniform float uTime, uRs, uBound;
        uniform vec3 uCenter, uHot, uWarm, uCool, uDeep;
        uniform mat3 uInvRot;
        varying vec3 vWorldPos;

        // Outflow disk: matter is expelled, so the spiral pattern streams outward and the
        // Doppler factor depends on the radial (not orbital) velocity.
        vec4 ejectaSample(vec3 x, vec3 v) {
          float r = length(x.xz);
          float rin = uRs * 1.6, rout = uRs * 11.0;
          if (r < rin || r > rout) return vec4(0.0);
          float k = (r - rin) / (rout - rin);
          float lr = log(r / uRs);
          float ang = atan(x.z, x.x) - lr * 1.8;
          vec3 pc = vec3(cos(ang) * 2.0, sin(ang) * 2.0, (lr - uTime * 0.22) * 3.0);
          float n = fbm(pc, 5) * 0.5 + 0.5;
          float streak = fbm(vec3(ang * 2.0, (lr - uTime * 0.3) * 8.0, 0.0), 3) * 0.5 + 0.5;
          float dens = smoothstep(0.0, 0.05, k) * pow(1.0 - k, 2.2) * (0.25 + n * streak * 1.2);
          vec3 vel = normalize(vec3(x.x, 0.0, x.z)) * 0.9 + normalize(vec3(-x.z, 0.0, x.x)) * 0.3;
          float beta = 0.45 * sqrt(uRs / r);
          float dop = 1.0 / (1.0 - beta * dot(normalize(vel), -v));
          vec3 col = mix(uHot, uWarm, smoothstep(0.0, 0.3, k));
          col = mix(col, uCool, smoothstep(0.3, 1.0, k));
          col *= mix(vec3(1.0, 0.8, 0.7), vec3(0.75, 0.9, 1.3), clamp(dop - 0.6, 0.0, 1.0));
          float I = dens * pow(dop, 3.0) * (0.8 + 2.0 * (1.0 - k)) * 0.32;
          return vec4(col * I, clamp(dens * 1.1, 0.0, 1.0));
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
          bool hitHorizon = false;
          vec3 hitPos = vec3(0.0);
          for (int i = 0; i < STEPS; i++) {
            float r = length(x);
            minR = min(minR, r);
            if (r < uRs) { hitHorizon = true; hitPos = x; break; }
            if (r > uBound * 1.02 && dot(x, v) > 0.0) break;
            float dt = clamp(0.08 * r, 0.02 * uRs, 0.9 * uRs);
            vec3 acc = -1.5 * uRs * h2 * x / pow(r, 5.0);
            vec3 xPrev = x;
            v += acc * dt;
            x += v * dt;
            // Expanding shells of expelled radiation (lensed like everything else)
            for (int s = 0; s < 3; s++) {
              float ph = fract(uTime * 0.05 + float(s) / 3.0);
              float rsh = uRs * (1.3 + ph * 13.0);
              float w = uRs * (0.12 + ph * 0.5);
              float qd = (r - rsh) / w;
              float e = exp(-qd * qd) * (1.0 - ph) * (1.0 - ph);
              if (e < 0.004) continue;
              float tex = fbm(normalize(x) * 3.0 + float(s) * 5.0 + ph, 3) * 0.5 + 0.5;
              col += (1.0 - alpha) * mix(uWarm, uCool, ph) * e * tex * dt / uRs * 0.09;
            }
            // Polar jets
            float cyl = length(x.xz);
            float jet = exp(-cyl * cyl / (uRs * uRs * 0.18 * (1.0 + abs(x.y) / uRs * 0.25))) * smoothstep(uRs, uRs * 2.0, abs(x.y)) * exp(-abs(x.y) / (uRs * 9.0));
            if (jet < 0.003) jet = 0.0;
            float jtex = jet == 0.0 ? 0.0 : fbm(vec3(x.xz / uRs * 2.0, abs(x.y) / uRs * 0.6 - uTime * 0.6), 3) * 0.5 + 0.5;
            col += (1.0 - alpha) * uWarm * jet * jtex * dt / uRs * 0.3;
            if (xPrev.y * x.y < 0.0) {
              vec3 xc = mix(xPrev, x, xPrev.y / (xPrev.y - x.y));
              vec4 d = ejectaSample(xc, normalize(v));
              col += (1.0 - alpha) * d.rgb;
              alpha += (1.0 - alpha) * d.a;
              if (alpha > 0.98) break;
            }
          }
          if (hitHorizon) {
            // The past horizon radiates: blinding, blueshifted, boiling outward
            vec3 nrm = normalize(hitPos);
            float boil = fbm(nrm * 5.0 + vec3(0.0, 0.0, -uTime * 0.4), 5) * 0.5 + 0.5;
            float cells = ridged(nrm * 9.0 - uTime * 0.15, 3);
            vec3 surf = mix(uWarm, uHot, boil) * (0.55 + 0.9 * boil + cells * 0.6);
            col += (1.0 - alpha) * surf;
            alpha = 1.0;
          }
          float rq = (minR - 1.5 * uRs) / (0.1 * uRs);
          float ring = exp(-rq * rq) * (hitHorizon ? 0.0 : 1.0);
          col += (1.0 - alpha) * uHot * ring * 1.1;
          alpha = max(alpha, ring * 0.4);
          gl_FragColor = vec4(col, clamp(alpha + length(col) * 0.15, 0.0, 1.0));
        }
      `,
    }));
    this.volume = this.pickable(new THREE.Mesh(new THREE.SphereGeometry(bound, 64, 32), this.mat));
    this.volume.renderOrder = 8;
    this.spin.add(this.volume);
    this.tilt.rotation.set(spec.inclination ?? 0.32, 0, -0.12);
    this.light = new THREE.PointLight(spec.palette[1], 2, 0, 0);
    this.root.add(this.light);
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    this.spin.updateWorldMatrix(true, false);
    const m = new THREE.Matrix3().setFromMatrix4(this.spin.matrixWorld);
    this.mat.uniforms.uInvRot.value.copy(m).invert();
  }
}

// ---------------------------------- Multiverse ----------------------------------
const VACUA = [
  { name: 'Our observable universe', a: '#6f9bff', b: '#ffd9a8', note: 'Λ ≈ 1.1×10⁻⁵² m⁻² · 3+1 dimensions' },
  { name: 'High-Λ vacuum', a: '#ff6b4a', b: '#ffd36b', note: 'Large cosmological constant: expands too fast for galaxies' },
  { name: 'Low-Λ vacuum', a: '#5ef0d0', b: '#9fb8ff', note: 'Near-zero vacuum energy: dense, long-lived structure' },
  { name: 'Strong-gravity vacuum', a: '#c26bff', b: '#ff7ad9', note: 'Different coupling constants' },
  { name: 'Empty vacuum', a: '#3a4a6a', b: '#8aa0c8', note: 'No stable matter forms' },
  { name: 'Dense-web vacuum', a: '#ffb36b', b: '#ff5a7a', note: 'Enhanced primordial fluctuations' },
];

export class Multiverse extends Body {
  constructor(spec, quality, engine) {
    super(spec);
    this.engine = engine;
    this.spinSpeed = 0.004;
    this.occluder = false;
    const rand = rng(spec.seed || 7);
    const R = spec.radius;
    const steps = Math.max(16, Math.round(quality.volumeSteps * 0.6));
    const count = Math.round(spec.bubbles || 11);

    // Place bubbles; deliberately let some pairs overlap (bubble collisions).
    const bubbles = [];
    for (let i = 0; i < count; i++) {
      const r = i === 0 ? R * 0.2 : R * (0.07 + rand() * 0.17);
      let c;
      if (i > 0 && rand() < 0.45) {
        const host = bubbles[Math.floor(rand() * bubbles.length)];
        const dir = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.7, rand() - 0.5).normalize();
        c = host.c.clone().addScaledVector(dir, (host.r + r) * (0.82 + rand() * 0.1));
      } else {
        c = new THREE.Vector3((rand() - 0.5) * 2, (rand() - 0.5) * 0.9, (rand() - 0.5) * 2).multiplyScalar(R * 0.75);
        if (i === 0) c.set(0, 0, 0);
      }
      bubbles.push({ c, r, vac: i === 0 ? VACUA[0] : VACUA[1 + Math.floor(rand() * (VACUA.length - 1))] });
    }
    // One bubble is caught mid-nucleation and grows in a loop.
    this.nucleus = { c: new THREE.Vector3(R * 0.55, R * 0.18, -R * 0.35), r: R * 0.16, vac: VACUA[2], growing: true };
    bubbles.push(this.nucleus);
    this.bubbleList = bubbles;

    const vertexShader = /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;
    const fragmentShader = /* glsl */ `
      ${NOISE_GLSL}
      uniform float uTime, uR, uSeed, uOurs, uEnergy;
      uniform vec3 uCenter, uColA, uColB;
      uniform vec4 uN[4];
      varying vec3 vWorldPos;
      void main() {
        vec3 ro = cameraPosition;
        vec3 rd = normalize(vWorldPos - ro);
        vec2 t = raySphere(ro, rd, uCenter, uR);
        if (t.y < 0.0 || uR < 0.001) discard;
        float t0 = max(t.x, 0.0);
        float ds = (t.y - t0) / float(STEPS);
        vec3 acc = vec3(0.0);
        // Interior: the bubble's own cosmic web (filaments + galaxy sparks)
        for (int i = 0; i < STEPS; i++) {
          vec3 p = ro + rd * (t0 + (float(i) + 0.5) * ds);
          vec3 l = (p - uCenter) / uR;
          float edge = smoothstep(1.0, 0.82, length(l));
          vec3 q = l * 2.6 + uSeed;
          float web = ridged(q, 4);
          float fil = pow(clamp(web, 0.0, 1.0), 3.0);
          float sparks = pow(max(snoise(q * 9.0), 0.0), 10.0) * fil * 6.0;
          vec3 c = mix(uColA, uColB, clamp(fbm(q * 0.7, 2) * 0.8 + 0.5, 0.0, 1.0));
          acc += c * (fil * 0.55 + sparks) * edge * ds / uR;
        }
        acc *= 0.9;
        // Domain wall: thin relativistic shell between vacua
        if (t.x > 0.0) {
          vec3 ps = ro + rd * t.x;
          vec3 n = normalize(ps - uCenter);
          float fres = pow(1.0 - abs(dot(n, rd)), 2.5);
          float shimmer = fbm(n * 7.0 + uTime * 0.12 + uSeed, 4) * 0.5 + 0.5;
          vec3 wall = mix(uColB, vec3(1.0), 0.45) * fres * (0.45 + 0.9 * shimmer) * (1.0 + uEnergy * 1.4);
          // Collision rings where this bubble intersects a neighbour
          for (int j = 0; j < 4; j++) {
            if (uN[j].w <= 0.0) continue;
            float dd = (length(ps - uN[j].xyz) - uN[j].w) / (0.025 * uR);
            float ring = exp(-dd * dd);
            float inside = smoothstep(0.0, -2.0, dd);
            wall += vec3(1.0, 0.9, 0.75) * ring * 1.3 * (0.5 + shimmer);
            acc *= 1.0 - inside * 0.35;
          }
          acc += wall * (uOurs > 0.5 ? 1.1 : 0.85);
        }
        gl_FragColor = vec4(acc, 1.0);
      }
    `;

    this.bubbleMeshes = [];
    const geo = new THREE.SphereGeometry(1, 64, 32);
    bubbles.forEach((bb, i) => {
      const neighbors = bubbles
        .filter((o) => o !== bb && o.c.distanceTo(bb.c) < (o.r + bb.r) * 0.999)
        .slice(0, 4);
      const nArr = [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0));
      bb.neighbors = neighbors;
      bb.nArr = nArr;
      const mat = this.track(new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        defines: { STEPS: steps },
        uniforms: {
          uTime: { value: 0 },
          uCenter: { value: new THREE.Vector3() },
          uR: { value: bb.r },
          uSeed: { value: i * 13.7 + 2.1 },
          uOurs: { value: i === 0 ? 1 : 0 },
          uEnergy: { value: 0 },
          uColA: { value: new THREE.Color(bb.vac.a) },
          uColB: { value: new THREE.Color(bb.vac.b) },
          uN: { value: nArr },
        },
        vertexShader,
        fragmentShader,
      }));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(bb.c);
      mesh.scale.setScalar(bb.r * 1.002);
      mesh.renderOrder = 6;
      mesh.frustumCulled = false;
      bb.mesh = mesh;
      bb.mat = mat;
      this.spin.add(mesh);
      this.pickable(mesh);
      this.bubbleMeshes.push(mesh);
    });

    // False-vacuum background: the inflating medium between bubbles.
    this.vacuumMat = this.track(new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: { uTime: { value: 0 } },
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
        uniform float uTime;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float slow = fbm(d * 1.6 + vec3(0.0, uTime * 0.01, 0.0), 5) * 0.5 + 0.5;
          float foam = ridged(d * 7.0 + vec3(uTime * 0.03), 4);
          float fine = fbm(d * 40.0 + uTime * 0.2, 2) * 0.5 + 0.5;
          vec3 col = mix(vec3(0.012, 0.004, 0.03), vec3(0.01, 0.03, 0.045), slow);
          col += vec3(0.05, 0.03, 0.09) * pow(foam, 3.0) * 0.6;
          col += vec3(0.02, 0.025, 0.04) * fine * 0.25;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }));
    this.vacuum = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), this.vacuumMat);
    this.vacuum.frustumCulled = false;
    this.vacuum.renderOrder = -98;
    this.worldAttachments = [this.vacuum];
    if (engine?.skybox) {
      this._skyWasVisible = engine.skybox.group.visible;
      engine.skybox.group.visible = false;
    }
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    if (this.engine) this.vacuum.position.copy(this.engine.camera.position);
    // Nucleation cycle: a new universe appears and its wall expands at near light speed (slowed for viewing).
    const n = this.nucleus;
    const ph = (t * 0.035) % 1;
    const grow = Math.min(1, ph / 0.75);
    const r = this.spec.radius * 0.16 * (1 - Math.pow(1 - grow, 3));
    n.mesh.scale.setScalar(Math.max(r, 0.001));
    n.mat.uniforms.uR.value = r;
    n.mat.uniforms.uEnergy.value = (1 - grow) * 0.8;
    const fadeOut = ph > 0.92 ? 1 - (ph - 0.92) / 0.08 : 1;
    n.mat.uniforms.uColA.value.set(n.vac.a).multiplyScalar(fadeOut);
    n.mat.uniforms.uColB.value.set(n.vac.b).multiplyScalar(fadeOut);

    // World-space centres and neighbour spheres for collision rings
    const wp = new THREE.Vector3();
    for (const bb of this.bubbleList) {
      bb.mesh.getWorldPosition(wp);
      bb.mat.uniforms.uCenter.value.copy(wp);
      if (bb !== n) bb.mat.uniforms.uR.value = bb.r;
    }
    for (const bb of this.bubbleList) {
      bb.neighbors.forEach((o, j) => {
        bb.nArr[j].set(o.mat.uniforms.uCenter.value.x, o.mat.uniforms.uCenter.value.y, o.mat.uniforms.uCenter.value.z, o.mat.uniforms.uR.value);
      });
    }
  }

  get info() {
    return { name: this.name, kind: this.kind, radius: this.radius, bubbles: this.bubbleList.length };
  }

  dispose() {
    if (this.engine?.skybox) this.engine.skybox.group.visible = this._skyWasVisible ?? true;
    this.vacuum.geometry.dispose();
    this.vacuumMat.dispose();
    this.vacuum.removeFromParent();
    super.dispose();
  }
}
