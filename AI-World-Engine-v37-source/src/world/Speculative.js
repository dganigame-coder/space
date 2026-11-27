import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';
import { Body } from './Body.js';
import { Rocket } from './Rocket.js';

// Vertex shaders cannot use screen-space derivatives: strip the bump-mapping helper.
const NOISE_VERT = NOISE_GLSL.replace(/vec3 perturbNormal[\s\S]*?\n}\n/, '');

// Additional hypothetical structures for Theoretical mode:
//   CosmicString  - conical-deficit lensing (Vilenkin 1981): undistorted double images along the string
//   BraneWorlds   - Randall–Sundrum style 3-branes in a warped 5-D bulk with gravitons leaking between them
//   DysonSwarm    - Dyson (1960) partial swarm of stellar collectors around an M dwarf, with IR waste heat
//   WarpBubble    - Alcubierre (1994) warp metric: negative-energy torus and contracted/expanded sky

// Render our sky (skybox only) into a cube map so a shader can re-map it per pixel.
export class SkyCapture {
  constructor(engine, quality) {
    this.engine = engine;
    const size = quality.volumeSteps >= 72 ? 2048 : 1024;
    this.rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.cam = new THREE.CubeCamera(0.1, 5000, this.rt);
    this.captured = false;
  }
  get texture() { return this.rt.texture; }
  capture() {
    const { renderer, scene, skybox } = this.engine;
    const hidden = [];
    for (const child of scene.children) {
      if (skybox && child === skybox.group) continue;
      if (child.visible) { child.visible = false; hidden.push(child); }
    }
    this.cam.position.copy(skybox ? skybox.group.position : this.engine.camera.position);
    const tm = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    this.cam.update(renderer, scene);
    renderer.toneMapping = tm;
    for (const c of hidden) c.visible = true;
    this.captured = true;
  }
  dispose() { this.rt.dispose(); }
}

const FULLSKY_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Rodrigues rotation
const ROT_GLSL = /* glsl */ `
  vec3 rotAxis(vec3 v, vec3 k, float a) {
    float c = cos(a), s = sin(a);
    return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
  }
`;

// ---------------------------------- Cosmic string ----------------------------------
export class CosmicString extends Body {
  constructor(spec, quality, engine) {
    super(spec);
    this.engine = engine;
    this.spinSpeed = 0;
    this.occluder = false;
    this.sky = new SkyCapture(engine, quality);
    // Real GUT-scale strings have deficit angles ~1e-5 rad; exaggerated here so the doubling is visible.
    const deficit = THREE.MathUtils.degToRad(spec.deficitDeg ?? 2.4);
    this.axis = new THREE.Vector3(0.18, 1, -0.12).normalize();
    this.mat = this.track(new THREE.ShaderMaterial({
      depthWrite: false, depthTest: false,
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 }, uSky: { value: this.sky.texture },
        uCenter: { value: new THREE.Vector3() }, uAxis: { value: this.axis },
        uDeficit: { value: deficit }, uGlow: { value: spec.palette[0] }, uScale: { value: spec.radius },
      },
      vertexShader: FULLSKY_VERT,
      fragmentShader: /* glsl */ `
        ${NOISE_GLSL}
        ${ROT_GLSL}
        uniform samplerCube uSky;
        uniform vec3 uCenter, uAxis, uGlow;
        uniform float uTime, uDeficit, uScale;
        varying vec3 vWorldPos;

        // Distant background galaxies placed just behind the string, so their double images are obvious.
        vec3 galaxy(vec3 d, vec3 gd, float size, vec3 tint, float tilt) {
          vec3 gu = normalize(cross(gd, vec3(0.0, 1.0, 0.0)));
          vec3 gv = cross(gu, gd);
          vec2 q = vec2(dot(d, gu), dot(d, gv));
          q = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * q;
          q.y *= 2.4;
          float r = length(q) / size;
          if (dot(d, gd) < 0.0 || r > 3.0) return vec3(0.0);
          float a = atan(q.y, q.x);
          float arms = 0.5 + 0.5 * cos(2.0 * a - 4.5 * log(r + 0.04));
          return tint * (exp(-r * 7.0) * 3.0 + arms * exp(-r * 2.2) * 0.5);
        }
        vec3 background(vec3 d) {
          vec3 col = textureCube(uSky, d).rgb;
          col += galaxy(d, normalize(vec3(0.05, 0.12, -1.0)), 0.035, vec3(1.0, 0.85, 0.7), 0.6);
          col += galaxy(d, normalize(vec3(-0.07, -0.32, -1.0)), 0.025, vec3(0.75, 0.85, 1.0), -0.3);
          col += galaxy(d, normalize(vec3(0.12, 0.45, -1.0)), 0.02, vec3(1.0, 0.75, 0.9), 1.4);
          // A quasar right behind the string
          vec3 qd = normalize(vec3(0.02, -0.08, -1.0));
          col += vec3(0.8, 0.9, 1.0) * pow(max(dot(d, qd), 0.0), 60000.0) * 40.0;
          return col;
        }

        void main() {
          vec3 ro = cameraPosition;
          vec3 d = normalize(vWorldPos - ro);
          vec3 A = normalize(uAxis);
          // Work in the plane perpendicular to the string.
          vec3 w = ro - uCenter;
          vec3 wp = w - A * dot(w, A);         // camera offset from the string, perpendicular part
          vec3 dp = d - A * dot(d, A);
          float dpl = length(dp);
          vec3 toS = -normalize(wp);
          float cosPhi = dpl > 1e-5 ? dot(dp / dpl, toS) : 0.0;
          vec3 side = normalize(cross(A, toS));
          float sgn = sign(dot(dp, side));
          // Rays heading past the string are bent toward it by half the deficit angle (conical space).
          float w8 = smoothstep(-0.05, 0.25, cosPhi);
          vec3 src = rotAxis(d, A, -sgn * 0.5 * uDeficit * w8);
          vec3 col = background(src);

          // Marker for the string core (physically invisible; shown as a faint filament with travelling kinks)
          vec3 n = cross(d, A);
          float nl = length(n);
          if (nl > 1e-4 && cosPhi > 0.0) {
            float dist = abs(dot(w, n / nl));
            vec3 n2 = cross(A, n);
            float tRay = dot(uCenter - ro, n2) / dot(d, n2);
            vec3 pc = ro + d * tRay;
            float along = dot(pc - uCenter, A);
            float width = 0.0025 * tRay + 0.02;
            float core = exp(-pow(dist / width, 2.0));
            float kinks = pow(0.5 + 0.5 * sin(along / uScale * 9.0 - uTime * 1.6), 16.0);
            float fade = exp(-abs(along) / (uScale * 6.0));
            col += uGlow * core * (0.25 + kinks * 1.8) * fade;
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }));
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2000, 64, 32), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -90;
    this.worldAttachments = [this.mesh];
    // Pickable proxy along the string
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(spec.radius * 0.05, spec.radius * 0.05, spec.radius * 4, 8), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.axis);
    this.pickable(proxy);
    this.root.add(proxy);
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    if (!this.sky.captured) { this.mesh.visible = false; this.sky.capture(); this.mesh.visible = true; }
    this.mesh.position.copy(ctx.camera.position);
  }

  dispose() {
    super.dispose();
    this.mesh.geometry.dispose();
    this.mesh.removeFromParent();
    this.sky.dispose();
  }
}

// ---------------------------------- Brane worlds ----------------------------------
export class BraneWorlds extends Body {
  constructor(spec, quality, engine) {
    super(spec);
    this.engine = engine;
    this.spinSpeed = 0.004;
    this.occluder = false;
    const L = spec.radius;
    const count = spec.branes ?? 5;
    const gap = L * 0.42;
    this.branes = [];
    const palettes = [
      ['#7fd3ff', '#ffe2b0'], ['#ff9ad1', '#b18cff'], ['#9dffcf', '#5ab0ff'], ['#ffc07a', '#ff6a5a'], ['#c7b8ff', '#7ae0ff'],
    ];
    const geo = new THREE.PlaneGeometry(L * 2.2, L * 2.2, 160, 160);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const ours = i === Math.floor(count / 2);
      const [a, b] = palettes[i % palettes.length];
      const mat = this.track(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 }, uSeed: { value: i * 17.3 + (spec.seed % 31) }, uL: { value: L },
          uColA: { value: new THREE.Color(a) }, uColB: { value: new THREE.Color(b) },
          uOurs: { value: ours ? 1 : 0 }, uFlash: { value: 0 },
        },
        vertexShader: /* glsl */ `
          ${NOISE_VERT}
          uniform float uTime, uSeed, uL;
          varying vec2 vP;
          varying float vH;
          void main() {
            vec3 p = position;
            vP = p.xz / uL;
            // Brane fluctuations (the brane is a dynamical membrane)
            float h = snoise(vec3(vP * 1.3, uTime * 0.05 + uSeed)) * 0.05 + snoise(vec3(vP * 3.1, uTime * 0.08 - uSeed)) * 0.015;
            p.y += h * uL;
            vH = h;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          ${NOISE_GLSL}
          uniform float uTime, uSeed, uOurs, uFlash;
          uniform vec3 uColA, uColB;
          varying vec2 vP;
          varying float vH;
          void main() {
            float r = length(vP);
            float edge = smoothstep(1.05, 0.55, r);
            vec3 q = vec3(vP * 3.2, uSeed);
            float web = ridged(q, 5);
            float fil = pow(clamp(web, 0.0, 1.0), 3.2);
            float sparks = pow(max(snoise(vec3(vP * 40.0, uSeed)), 0.0), 12.0) * fil * 10.0;
            float knots = pow(clamp(web, 0.0, 1.0), 9.0) * 3.0;
            vec3 col = mix(uColA, uColB, fbm(q * 0.6, 3) * 0.5 + 0.5) * (fil * 0.55 + knots + sparks);
            float sheet = 0.03 + 0.04 * (fbm(vec3(vP * 2.0, uSeed + uTime * 0.02), 3) * 0.5 + 0.5);
            col += uColA * sheet;
            // Our brane is outlined; others are fainter
            col *= mix(0.55, 1.25, uOurs);
            col += uColB * smoothstep(0.02, 0.0, abs(r - 1.0)) * 0.25;
            col += vec3(1.0, 0.95, 0.9) * uFlash * (0.6 + fil);
            gl_FragColor = vec4(col * edge, 1.0);
          }
        `,
      }));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = (i - (count - 1) / 2) * gap;
      mesh.renderOrder = 6;
      this.spin.add(mesh);
      this.branes.push({ mesh, mat, base: mesh.position.y, ours });
    }
    this.pickable(new THREE.Mesh(new THREE.BoxGeometry(L * 2, gap * count, L * 2), new THREE.MeshBasicMaterial({ visible: false })));
    this.spin.add(this.pickables[0]);
    this.gap = gap;

    // Gravitons: the only quanta free to travel through the bulk, streaming between branes.
    const n = quality.volumeSteps >= 48 ? 2600 : 1400;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * L;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * L;
      pos[i * 3 + 1] = Math.random();
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.gravMat = this.track(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSpan: { value: gap * (count - 1) }, uPixelRatio: { value: 1 }, uL: { value: L } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uSpan, uPixelRatio, uL;
        varying float vA;
        void main() {
          float ph = fract(position.y + uTime * (0.03 + aSeed * 0.05));
          vec3 p = vec3(position.x, (ph - 0.5) * uSpan * (aSeed > 0.5 ? 1.0 : -1.0), position.z);
          float edge = smoothstep(1.0, 0.6, length(p.xz) / uL);
          vA = sin(ph * 3.14159) * edge;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (2.0 + aSeed * 3.0) * uPixelRatio * clamp(300.0 / -mv.z, 0.6, 3.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float g = exp(-dot(c, c) * 30.0);
          gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * g * vA * 0.9, 1.0);
        }
      `,
    }));
    this.gravitons = new THREE.Points(g, this.gravMat);
    this.gravitons.frustumCulled = false;
    this.spin.add(this.gravitons);
    this.tilt.rotation.set(0.04, 0, 0.06); // nearly edge-on so the separate branes read as layers
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    this.gravMat.uniforms.uPixelRatio.value = ctx.pixelRatio;
    // Ekpyrotic-style cycle: the two outer branes drift together and collide, releasing a flash.
    const top = this.branes[this.branes.length - 1];
    const next = this.branes[this.branes.length - 2];
    const cyc = (t * 0.045) % 1;
    const approach = Math.pow(Math.sin(cyc * Math.PI), 6);
    top.mesh.position.y = top.base - (top.base - next.base) * approach * 0.97;
    const flash = Math.max(0, approach - 0.9) * 10;
    top.mat.uniforms.uFlash.value = flash;
    next.mat.uniforms.uFlash.value = flash;
  }
}

// ---------------------------------- Dyson swarm ----------------------------------
export class DysonSwarm extends Body {
  constructor(spec, quality) {
    super(spec);
    this.spinSpeed = 0;
    this.occluder = false;
    const R = spec.radius;
    const host = spec.hostRadius ?? R * 0.35;
    const count = quality.volumeSteps >= 72 ? 16000 : quality.volumeSteps >= 48 ? 9000 : 4500;
    const panel = new THREE.CylinderGeometry(1, 1, 0.04, 6);
    panel.rotateX(Math.PI / 2); // face +Z
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8a7650, metalness: 0.85, roughness: 0.28,
      emissive: new THREE.Color(1.0, 0.22, 0.06), emissiveIntensity: 0.9,
    });
    this.panelMat = mat;
    this.swarm = new THREE.InstancedMesh(panel, mat, count);
    this.rings = [];
    const ringCount = 14;
    for (let k = 0; k < ringCount; k++) {
      const incl = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (k / ringCount) * Math.PI + (Math.random() - 0.5) * 0.2, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4));
      const radius = host * (2.2 + (k % 4) * 0.22 + Math.random() * 0.1);
      this.rings.push({ incl, radius, speed: 0.06 / Math.pow(radius / host, 1.5), phase: Math.random() * Math.PI * 2 });
    }
    this.items = [];
    for (let i = 0; i < count; i++) {
      const ring = i % ringCount;
      this.items.push({ ring, a: Math.random() * Math.PI * 2, jitter: (Math.random() - 0.5) * host * 0.08, size: host * (0.06 + Math.random() * 0.05) });
    }
    this.swarm.frustumCulled = false;
    this.root.add(this.swarm);
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._z = new THREE.Vector3(0, 0, 1);

    // Partial geodesic lattice: a megastructure frame under construction (about a third complete).
    const ico = new THREE.IcosahedronGeometry(host * 3.4, 3);
    const edges = new THREE.EdgesGeometry(ico, 1);
    const arr = edges.attributes.position.array;
    const keep = [];
    const dir = new THREE.Vector3(0.6, 0.3, 0.75).normalize();
    for (let i = 0; i < arr.length; i += 6) {
      const mid = new THREE.Vector3((arr[i] + arr[i + 3]) / 2, (arr[i + 1] + arr[i + 4]) / 2, (arr[i + 2] + arr[i + 5]) / 2).normalize();
      if (mid.dot(dir) > 0.25) keep.push(...arr.slice(i, i + 6));
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    this.lattice = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.root.add(this.lattice);
    ico.dispose();
    edges.dispose();
    this.pickable(new THREE.Mesh(new THREE.SphereGeometry(host * 3.4, 16, 8), new THREE.MeshBasicMaterial({ visible: false })));
    this.root.add(this.pickables[0]);
    this.radius = host * 3.4;
    this._update(0);
  }

  _update(t) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const r = this.rings[it.ring];
      const a = it.a + r.phase + t * r.speed;
      this._p.set(Math.cos(a) * (r.radius + it.jitter), it.jitter * 0.6, Math.sin(a) * (r.radius + it.jitter)).applyQuaternion(r.incl);
      // Collectors face the star
      this._q.setFromUnitVectors(this._z, this._p.clone().normalize().negate());
      this._s.setScalar(it.size);
      this._m.compose(this._p, this._q, this._s);
      this.swarm.setMatrixAt(i, this._m);
    }
    this.swarm.instanceMatrix.needsUpdate = true;
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    this._update(t);
    this.lattice.rotation.y = t * 0.01;
  }

  dispose() {
    super.dispose();
    this.panelMat.dispose();
    this.swarm.dispose();
  }
}

// ---------------------------------- Alcubierre warp bubble ----------------------------------
export class WarpBubble extends Body {
  constructor(spec, quality, engine) {
    super(spec);
    this.engine = engine;
    this.spinSpeed = 0;
    this.occluder = false;
    const Rb = spec.radius;
    this.sky = new SkyCapture(engine, quality);
    this.vdir = new THREE.Vector3(1, 0.08, -0.2).normalize();
    const steps = Math.max(24, Math.round(quality.volumeSteps * 1.1));
    this.mat = this.track(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      defines: { STEPS: steps },
      uniforms: {
        uTime: { value: 0 }, uSky: { value: this.sky.texture }, uCenter: { value: new THREE.Vector3() },
        uR: { value: Rb }, uSigma: { value: 5.0 / Rb }, uV: { value: this.vdir }, uBeta: { value: 0.55 },
        uColA: { value: spec.palette[0] }, uColB: { value: spec.palette[1] },
      },
      vertexShader: FULLSKY_VERT,
      fragmentShader: /* glsl */ `
        ${NOISE_GLSL}
        uniform samplerCube uSky;
        uniform vec3 uCenter, uV, uColA, uColB;
        uniform float uTime, uR, uSigma, uBeta;
        varying vec3 vWorldPos;
        // Alcubierre shape function f(rs): ~1 inside the bubble, ~0 outside, steep wall of width ~1/sigma.
        float shapeF(float r) {
          float a = tanh(uSigma * (r + uR)), b = tanh(uSigma * (r - uR));
          return (a - b) / (2.0 * tanh(uSigma * uR));
        }
        float dShape(float r) {
          float a = 1.0 / cosh(uSigma * (r + uR)), b = 1.0 / cosh(uSigma * (r - uR));
          return uSigma * (a * a - b * b) / (2.0 * tanh(uSigma * uR));
        }
        void main() {
          vec3 ro = cameraPosition;
          vec3 rd = normalize(vWorldPos - ro);
          vec2 hit = raySphere(ro, rd, uCenter, uR * 2.2);
          if (hit.y < 0.0) discard;
          float t0 = max(hit.x, 0.0), t1 = hit.y;
          float ds = (t1 - t0) / float(STEPS);
          vec3 energy = vec3(0.0);
          float bend = 0.0;
          for (int i = 0; i < STEPS; i++) {
            vec3 p = ro + rd * (t0 + (float(i) + 0.5) * ds) - uCenter;
            float r = length(p);
            float along = dot(p, uV);
            float rho2 = max(r * r - along * along, 0.0);
            float df = dShape(r);
            // Eulerian energy density  ∝ -(v^2/4)(rho^2/r^2)(df/dr)^2 : a negative-energy torus around the ship.
            float e = (rho2 / max(r * r, 1e-6)) * df * df / (uSigma * uSigma);
            float sw = fbm(p / uR * 3.0 + vec3(uTime * 0.25, 0.0, 0.0), 3) * 0.5 + 0.5;
            energy += mix(uColA, uColB, sw) * e * (0.15 + 1.6 * sw * sw * sw) * ds / uR * 4.0;
            bend += abs(df) * ds;
          }
          // Inside the bubble: sky ahead is blueshifted and squeezed forward; behind, redshifted and stretched.
          vec3 dirIn = rd;
          float inside = clamp(bend * 0.5, 0.0, 1.0);
          float mu = dot(rd, uV);
          vec3 aberr = normalize(rd + uV * uBeta * inside * (1.0 - mu * mu) * 1.6);
          vec3 sky = textureCube(uSky, aberr).rgb;
          float dop = 1.0 + uBeta * inside * dot(aberr, uV);
          sky *= mix(vec3(1.25, 0.8, 0.55), vec3(0.65, 0.85, 1.45), clamp(dop - 0.5, 0.0, 1.0)) * mix(1.0, dop, inside) * 0.85;
          // Shimmering wall (refractive rim)
          vec2 hw = raySphere(ro, rd, uCenter, uR);
          float rim = 0.0;
          if (hw.y > 0.0) {
            vec3 pw = ro + rd * max(hw.x, 0.0) - uCenter;
            rim = pow(1.0 - abs(dot(normalize(pw), rd)), 4.0) * 0.35;
          }
          vec3 col = sky * inside + energy + uColB * rim;
          float alpha = inside;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }));
    this.volume = this.pickable(new THREE.Mesh(new THREE.SphereGeometry(Rb * 2.2, 64, 32), this.mat));
    this.volume.renderOrder = 9;
    this.volume.frustumCulled = false;
    this.root.add(this.volume);

    // The ship riding in the flat interior (it does not move locally; space does).
    this.ship = new Rocket();
    this.ship.stage1.visible = false;
    this.ship.separate();
    this.ship.s2Plume.mesh.visible = false;
    this.ship.engineLight.intensity = 0;
    const shipLen = Rb * 0.45;
    this.ship.group.scale.setScalar(shipLen / 26);
    this.ship.group.position.copy(this.vdir).multiplyScalar(-shipLen * 0.5 - 44 * (shipLen / 26) * 0 );
    this.ship.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.vdir);
    // Centre the stage-2 stack (44..70 m) on the bubble centre
    this.ship.group.position.copy(this.vdir).multiplyScalar(-57 * (shipLen / 26));
    this.root.add(this.ship.group);
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    if (!this.sky.captured) { this.root.visible = false; this.sky.capture(); this.root.visible = true; }
  }

  dispose() {
    super.dispose();
    this.ship.dispose();
    this.sky.dispose();
  }
}
