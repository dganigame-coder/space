import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';

// Two-stage orbital launch vehicle, modelled in metres (scale the group to scene units).
// Proportions follow a medium-lift kerosene/LOX rocket: 3.7 m core, ~70 m stack, 9 sea-level engines
// on stage 1 and a single large vacuum nozzle on stage 2.

function bandTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#e9ecef';
  g.fillRect(0, 0, 8, 1024);
  for (const [a, b, col] of stops) {
    g.fillStyle = col;
    g.fillRect(0, 1024 * (1 - b), 8, 1024 * (b - a));
  }
  // Fine panel seams
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < 1024; y += 37) g.fillRect(0, y, 8, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function latheFromProfile(points, segments = 64) {
  const pts = points.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.computeVertexNormals();
  return geo;
}

const PLUME_VERT = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

// Exhaust plume: hot core, Mach diamonds at sea level, turbulent mixing layer, and
// under-expanded vacuum ballooning as ambient pressure drops (uVac 0 -> 1).
const PLUME_FRAG = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uTime, uThrottle, uVac, uLen, uRad, uDiamonds;
  uniform vec3 uHot, uMid, uCool;
  varying vec3 vLocal;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float a = clamp(-vLocal.y / uLen, 0.0, 1.0);          // 0 at nozzle, 1 at tail
    float edge = abs(dot(normalize(vN), normalize(vV)));  // 1 = looking through the core
    float body = pow(edge, 1.6);
    float turb = fbm(vec3(vLocal.xz / uRad * 1.5, a * 9.0 - uTime * 7.0), 4) * 0.5 + 0.5;
    float flick = 0.85 + 0.15 * sin(uTime * 63.0 + a * 20.0);
    // Shock diamonds fade out with altitude
    float dia = pow(0.5 + 0.5 * cos(a * uDiamonds * 6.2831), 6.0) * (1.0 - uVac) * smoothstep(0.55, 0.05, a);
    float core = exp(-a * mix(5.0, 1.6, uVac));
    vec3 col = mix(uHot, uMid, smoothstep(0.0, 0.35, a));
    col = mix(col, uCool, smoothstep(0.3, 1.0, a));
    float I = (core * 2.4 + dia * 3.0 + turb * 0.6 * (1.0 - a)) * body * flick * uThrottle;
    I *= smoothstep(1.0, 0.6, a) * smoothstep(0.0, 0.02, a + 0.01);
    gl_FragColor = vec4(col * I, 1.0);
  }
`;

export class Rocket {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Launch vehicle';
    this.stage1 = new THREE.Group();
    this.stage2 = new THREE.Group();
    this.group.add(this.stage1, this.stage2);
    this.materials = [];

    const paint = new THREE.MeshStandardMaterial({
      map: bandTexture([[0.0, 0.035, '#2a2b2e'], [0.6, 0.64, '#17181a'], [0.75, 0.755, '#1d1e20']]),
      roughness: 0.42, metalness: 0.05,
    });
    const soot = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.85, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.35, metalness: 0.9 });
    const copper = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.4, metalness: 0.95, emissive: 0x200800 });
    const fairingMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.38, metalness: 0.02 });
    this.materials.push(paint, soot, metal, copper, fairingMat);

    // Stage 1: 0 .. 44 m
    const s1 = new THREE.Mesh(latheFromProfile([[0, 0], [1.85, 0], [1.85, 44], [0, 44]], 72), paint);
    this.stage1.add(s1);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.1, 1.6, 72, 1, true), soot);
    skirt.position.y = 0.8;
    this.stage1.add(skirt);
    // Octaweb: 8 + 1 engines with regeneratively cooled bells
    const bellGeo = latheFromProfile([[0.18, 0], [0.3, -0.25], [0.46, -1.0], [0.52, -1.7], [0.5, -1.72]], 28);
    this.s1Nozzles = [];
    for (let i = 0; i < 9; i++) {
      const bell = new THREE.Mesh(bellGeo, copper);
      if (i < 8) {
        const a = (i / 8) * Math.PI * 2;
        bell.position.set(Math.cos(a) * 1.18, 0, Math.sin(a) * 1.18);
      }
      this.stage1.add(bell);
      this.s1Nozzles.push(bell.position.clone().setY(-1.7));
    }
    // Grid fins & landing legs (stowed)
    const finGeo = new THREE.BoxGeometry(1.2, 1.4, 0.08);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const fin = new THREE.Mesh(finGeo, metal);
      fin.position.set(Math.cos(a) * 2.0, 42.6, Math.sin(a) * 2.0);
      fin.rotation.y = -a;
      this.stage1.add(fin);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.5, 0.3), soot);
      leg.position.set(Math.cos(a) * 1.95, 5.2, Math.sin(a) * 1.95);
      leg.rotation.y = -a;
      this.stage1.add(leg);
    }

    // Stage 2: 44 .. 70 m (interstage, tank, fairing)
    const inter = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 4.5, 72, 1, true), soot);
    inter.position.y = 46.25;
    this.stage2.add(inter);
    const s2 = new THREE.Mesh(latheFromProfile([[0, 48.5], [1.85, 48.5], [1.85, 57], [0, 57]], 72), paint);
    this.stage2.add(s2);
    const fairing = new THREE.Mesh(latheFromProfile([
      [0, 57], [2.6, 57], [2.6, 63.5], [2.45, 65.5], [2.05, 67.6], [1.4, 69.2], [0.7, 70.1], [0, 70.4],
    ], 72), fairingMat);
    this.stage2.add(fairing);
    const mvac = new THREE.Mesh(latheFromProfile([[0.25, 0], [0.4, -0.4], [0.95, -2.2], [1.2, -3.6], [1.18, -3.62]], 40), copper);
    mvac.position.y = 47.8;
    mvac.visible = false; // hidden inside the interstage until separation
    this.stage2.add(mvac);
    this.mvac = mvac;

    // Plumes
    this.s1Plume = this._makePlume({ len: 55, rad: 2.2, hot: [3.2, 2.6, 1.8], mid: [2.4, 1.0, 0.25], cool: [0.5, 0.18, 0.06], diamonds: 6 });
    this.s1Plume.mesh.position.y = -1.6;
    this.stage1.add(this.s1Plume.mesh);
    this.s2Plume = this._makePlume({ len: 40, rad: 1.3, hot: [2.6, 2.4, 2.8], mid: [1.2, 0.7, 1.6], cool: [0.25, 0.2, 0.55], diamonds: 0 });
    this.s2Plume.mesh.position.y = 47.8 - 3.6;
    this.s2Plume.mesh.visible = false;
    this.stage2.add(this.s2Plume.mesh);

    // Engine light illuminates the vehicle, smoke and pad.
    this.engineLight = new THREE.PointLight(0xffa860, 0, 400, 2);
    this.unit = 1; // scene units per metre (light falloff does not inherit parent scale)
    this.engineLight.position.y = -6;
    this.group.add(this.engineLight);
    this.hemi = new THREE.HemisphereLight(0x8fb4ff, 0x3a3226, 0.0);
    this.group.add(this.hemi);
    this.separated = false;
  }

  _makePlume({ len, rad, hot, mid, cool, diamonds }) {
    const geo = new THREE.CylinderGeometry(rad * 0.55, rad * 1.6, len, 48, 24, true);
    geo.translate(0, -len / 2, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }, uThrottle: { value: 0 }, uVac: { value: 0 },
        uLen: { value: len }, uRad: { value: rad }, uDiamonds: { value: diamonds },
        uHot: { value: new THREE.Vector3(...hot) }, uMid: { value: new THREE.Vector3(...mid) }, uCool: { value: new THREE.Vector3(...cool) },
      },
      vertexShader: PLUME_VERT,
      fragmentShader: PLUME_FRAG,
    });
    this.materials.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    return { mesh, mat, len };
  }

  // throttle 0..1, vac 0 (sea level) .. 1 (vacuum)
  setEngine(t, throttle, vac) {
    const active = this.separated ? this.s2Plume : this.s1Plume;
    for (const p of [this.s1Plume, this.s2Plume]) p.mat.uniforms.uTime.value = t;
    active.mat.uniforms.uThrottle.value = throttle;
    active.mat.uniforms.uVac.value = vac;
    // Under-expanded exhaust balloons as ambient pressure falls
    const s = 1 + vac * vac * (this.separated ? 9 : 6);
    active.mesh.scale.set(s, 1 + vac * (this.separated ? 4 : 2.5), s);
    this.engineLight.intensity = throttle * (this.separated ? 300 : 1400) * (1 - vac * 0.6) * this.unit * this.unit;
    this.engineLight.distance = 400 * this.unit;
  }

  separate() {
    if (this.separated) return;
    this.separated = true;
    this.s1Plume.mat.uniforms.uThrottle.value = 0;
    this.s1Plume.mesh.visible = false;
    this.s2Plume.mesh.visible = true;
    this.mvac.visible = true;
    const inter = this.stage2.children[0]; // interstage stays with stage 1
    this.stage2.remove(inter);
    this.stage1.add(inter);
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of this.materials) { m.map?.dispose(); m.dispose(); }
    this.group.removeFromParent();
  }
}

// GPU smoke trail: particles live in the planet's frame, grow and fade with age, are lit by the sun
// and glow orange near the engines.
export class ExhaustTrail {
  constructor(count = 1400) {
    this.count = count;
    this.head = 0;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const birth = new Float32Array(count).fill(-1e4);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) seed[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uUnit: { value: 1 }, uViewH: { value: 800 },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uNozzle: { value: new THREE.Vector3() },
        uGlow: { value: 0 }, uDaylight: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aVel;
        attribute float aBirth, aSeed, aScale;
        uniform float uTime, uUnit, uViewH;
        uniform vec3 uNozzle;
        varying float vAge, vSeed, vNear;
        void main() {
          float age = uTime - aBirth;
          vAge = age;
          vSeed = aSeed;
          // Drag: displacement saturates
          vec3 p = position + aVel * (1.0 - exp(-age * 0.6)) / 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float size = (6.0 + age * 14.0) * aScale * uUnit * (0.7 + aSeed * 0.6);
          gl_PointSize = clamp(size * uViewH / max(-mv.z, 1e-9), 0.0, 900.0);
          vNear = exp(-length(p - uNozzle) / (uUnit * 60.0 * aScale));
          gl_Position = projectionMatrix * mv;
          if (age < 0.0 || age > 16.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform float uGlow, uDaylight;
        varying float vAge, vSeed, vNear;
        void main() {
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(c, c);
          if (r2 > 1.0) discard;
          // Sphere-ish normal for soft lighting of each puff
          vec3 n = vec3(c.x, -c.y, sqrt(1.0 - r2));
          float lit = 0.45 + 0.55 * max(dot(n, normalize(vec3(0.3, 0.6, 0.6))), 0.0);
          float a = (1.0 - r2) * (1.0 - r2) * smoothstep(16.0, 4.0, vAge) * smoothstep(0.0, 0.15, vAge) * 0.42;
          vec3 smoke = vec3(0.86, 0.85, 0.83) * lit * mix(0.06, 1.0, uDaylight);
          vec3 fire = vec3(2.4, 1.1, 0.35) * vNear * uGlow;
          gl_FragColor = vec4(smoke * a + fire * a, a);
        }
      `,
    });
    this.mat.blending = THREE.CustomBlending;
    this.mat.blendSrc = THREE.OneFactor;
    this.mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 11;
  }

  emit(t, p, v, scale = 1) {
    const i = this.head;
    this.head = (this.head + 1) % this.count;
    const P = this.geo.attributes.position, V = this.geo.attributes.aVel;
    P.setXYZ(i, p.x, p.y, p.z);
    V.setXYZ(i, v.x, v.y, v.z);
    this.geo.attributes.aBirth.setX(i, t);
    this.geo.attributes.aScale.setX(i, scale);
    P.needsUpdate = V.needsUpdate = this.geo.attributes.aBirth.needsUpdate = this.geo.attributes.aScale.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.points.removeFromParent();
  }
}
