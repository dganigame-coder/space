import * as THREE from 'three';
import { Body } from './Body.js';
import { rng, gaussian, createNoise3D } from '../core/utils.js';

// Shared procedural rock textures (albedo + bump), generated once on a canvas.
function rockTextures() {
  if (rockTextures.cache) return rockTextures.cache;
  const s = 512;
  const noise = createNoise3D(42);
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const img = g.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // Seamless by sampling noise on a torus
      const a = (x / s) * Math.PI * 2, b = (y / s) * Math.PI * 2;
      const nx = Math.cos(a) * 2, ny = Math.sin(a) * 2, nz = Math.cos(b) * 2, nw = Math.sin(b) * 2;
      const n = noise.fbm(nx + nz * 0.7, ny + nw * 0.7, nz - nw, 6) * 0.5 + 0.5;
      const pits = Math.max(0, noise(nx * 6, ny * 6 + nw * 3, nz * 6) - 0.25) * 2.2;
      const v = Math.max(0, Math.min(255, (n - pits * 0.35) * 255));
      const i = (y * s + x) * 4;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const bump = new THREE.CanvasTexture(cv);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  rockTextures.cache = { bump };
  return rockTextures.cache;
}

function rockGeometry(seed, detail = 4, radius = 1, stretch = 1) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const noise = createNoise3D(seed);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = noise.fbm(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4, 5);
    // Crater-ish depressions
    const c = Math.max(0, noise(v.x * 3.5, v.y * 3.5 + seed, v.z * 3.5) - 0.3) * 0.6;
    const r = radius * (1 + n * 0.45 - c);
    v.multiplyScalar(r);
    v.x *= stretch;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function rockMaterial(color) {
  const { bump } = rockTextures();
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.96,
    metalness: 0.02,
    bumpMap: bump,
    bumpScale: 2.2,
    map: null,
  });
}

export class AsteroidBelt extends Body {
  constructor(spec, quality) {
    super(spec);
    this.occluder = false;
    this.spinSpeed = 0;
    const rand = rng(spec.seed);
    const total = spec.count ?? quality.asteroidCount;
    const inner = spec.inner ?? spec.radius * 0.8;
    const outer = spec.outer ?? spec.radius * 1.2;
    const thickness = spec.thickness ?? (outer - inner) * 0.08;
    const sizeScale = spec.rockSize ?? (outer - inner) * 0.012;
    this.meshes = [];
    this.instances = [];
    const variants = 4;
    const per = Math.ceil(total / variants);
    const baseColor = spec.color.clone();
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let k = 0; k < variants; k++) {
      const geo = rockGeometry(spec.seed + k * 13, 2, 1, 1 + rand() * 0.6);
      const mat = rockMaterial(0xffffff);
      const mesh = new THREE.InstancedMesh(geo, mat, per);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < per; i++) {
        const r = inner + (outer - inner) * (0.5 + gaussian(rand) * 0.22);
        const a = rand() * Math.PI * 2;
        const y = gaussian(rand) * thickness;
        const s = sizeScale * (0.25 + Math.pow(rand(), 3) * 2.4);
        const inst = {
          r, a, y, s,
          omega: 0.6 / Math.pow(Math.max(r, 0.5), 1.5),
          rot: new THREE.Euler(rand() * 6, rand() * 6, rand() * 6),
          spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.2),
        };
        this.instances.push({ mesh, i, inst });
        col.copy(baseColor).offsetHSL((rand() - 0.5) * 0.04, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.12);
        mesh.setColorAt(i, col);
        dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        dummy.rotation.copy(inst.rot);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = false;
      this.spin.add(mesh);
      this.meshes.push(mesh);
    }
    this._dummy = dummy;
    this.radius = outer;
    this.pickables = [];
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    const d = this._dummy;
    for (const { mesh, i, inst } of this.instances) {
      const a = inst.a + t * inst.omega * 0.25;
      d.position.set(Math.cos(a) * inst.r, inst.y, Math.sin(a) * inst.r);
      d.rotation.set(inst.rot.x + t * inst.spin.x, inst.rot.y + t * inst.spin.y, inst.rot.z + t * inst.spin.z);
      d.scale.setScalar(inst.s);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const m of this.meshes) m.material.bumpMap = null;
    super.dispose();
  }
}

export class Asteroid extends Body {
  constructor(spec, quality) {
    super(spec);
    const detail = quality.octaves >= 7 ? 6 : 5;
    const geo = rockGeometry(spec.seed, detail, spec.radius, spec.stretch ?? 1.35);
    this.mat = rockMaterial(spec.color);
    this.mesh = this.pickable(new THREE.Mesh(geo, this.mat));
    this.spin.add(this.mesh);
    this.tumble = new THREE.Vector3(0.11, 0.07, 0.04).multiplyScalar(spec.spin ? spec.spin * 4 : 1);
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    this.mesh.rotation.x += this.tumble.x * dt;
    this.mesh.rotation.z += this.tumble.z * dt;
  }

  setTexture(texture) {
    this.mat.map = texture;
    this.mat.needsUpdate = true;
  }

  dispose() {
    this.mat.bumpMap = null;
    super.dispose();
  }
}

// Comet: icy nucleus, glowing coma, and two tails (curved dust + straight ion)
// that always point away from the star.
export class Comet extends Asteroid {
  constructor(spec, quality) {
    super({ ...spec, stretch: 1.6 }, quality);
    const r = spec.radius;
    const n = quality.galaxyStars > 100000 ? 9000 : 4500;
    const rand = rng(spec.seed + 99);
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) seeds.set([rand(), rand(), rand(), rand() < 0.35 ? 1 : 0], i * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), r * 200);
    this.tailMat = this.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSunPos: { value: new THREE.Vector3() },
        uCenter: { value: new THREE.Vector3() },
        uLength: { value: r * (spec.tailLength ?? 60) },
        uR: { value: r },
        uPixelRatio: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime, uLength, uR, uPixelRatio;
        uniform vec3 uSunPos, uCenter;
        varying vec3 vColor;
        varying float vA;
        void main() {
          vec3 away = normalize(uCenter - uSunPos);
          vec3 side = normalize(cross(away, vec3(0.0, 1.0, 0.0)));
          vec3 up = cross(side, away);
          float life = fract(aSeed.x + uTime * (aSeed.w > 0.5 ? 0.09 : 0.04));
          float ion = aSeed.w;
          float dist = life * uLength * (ion > 0.5 ? 1.0 : 0.7);
          float spread = (ion > 0.5 ? 0.025 : 0.09) * dist + uR * 1.5;
          float ang = aSeed.y * 6.2831;
          vec3 p = uCenter + away * dist + (side * cos(ang) + up * sin(ang)) * spread * sqrt(aSeed.z);
          // Dust tail curves backward along the orbit
          if (ion < 0.5) p += side * dist * dist / uLength * 0.35;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float fade = (1.0 - life) * smoothstep(0.0, 0.03, life);
          vA = fade;
          vColor = ion > 0.5 ? vec3(0.35, 0.6, 1.4) : vec3(1.2, 1.0, 0.75);
          gl_PointSize = clamp((ion > 0.5 ? 1.6 : 2.6) * uPixelRatio * (uR * 40.0) / -mv.z, 1.0, 10.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = exp(-dot(c, c) * 14.0) * vA * 0.35;
          gl_FragColor = vec4(vColor * a, 1.0);
        }
      `,
    }));
    this.tail = new THREE.Points(geo, this.tailMat);
    this.tail.frustumCulled = false;
    // Tail lives in world space; attach to root's parent at build time via addToScene hook
    this.worldAttachments = [this.tail];

    this.comaMat = new THREE.SpriteMaterial({ map: null, color: new THREE.Color(0.9, 0.95, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.2)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    this.comaMat.map = new THREE.CanvasTexture(cv);
    this.coma = new THREE.Sprite(this.comaMat);
    this.coma.scale.setScalar(r * 10);
    this.root.add(this.coma);
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    this.tailMat.uniforms.uPixelRatio.value = ctx.pixelRatio;
  }

  dispose() {
    this.tail.geometry.dispose();
    this.tail.material.dispose();
    this.tail.removeFromParent();
    super.dispose();
  }
}
