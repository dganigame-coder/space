import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic PRNG (mulberry32) so the same target always looks the same.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function safeColor(input, fallback = '#38bdf8') {
  try {
    if (input === undefined || input === null || input === '') return new THREE.Color(fallback);
    const c = new THREE.Color();
    c.set(input);
    return c;
  } catch {
    return new THREE.Color(fallback);
  }
}

// Linear-space color from a stellar temperature (Kelvin), normalised to max channel 1.
export function blackbody(kelvin) {
  const t = clamp(kelvin, 1000, 40000) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = new THREE.Color().setRGB(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255, THREE.SRGBColorSpace);
  const m = Math.max(c.r, c.g, c.b) || 1;
  return c.multiplyScalar(1 / m);
}

// Build a 5-stop palette from a single base color by shifting lightness/hue.
export function paletteFromColor(base, rand = Math.random) {
  const hsl = {};
  base.getHSL(hsl);
  const stops = [];
  const offsets = [-0.28, -0.12, 0, 0.14, 0.3];
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Color();
    c.setHSL(
      (hsl.h + (rand() - 0.5) * 0.06 + 1) % 1,
      clamp(hsl.s * (0.7 + rand() * 0.5), 0, 1),
      clamp(hsl.l + offsets[i], 0.04, 0.92)
    );
    stops.push(c);
  }
  return stops;
}

export function toColors(list, fallbackBase, rand) {
  if (Array.isArray(list) && list.length >= 3) {
    const cols = list.slice(0, 5).map((c) => safeColor(c));
    while (cols.length < 5) cols.push(cols[cols.length - 1].clone().offsetHSL(0, 0, 0.1));
    return cols;
  }
  return paletteFromColor(fallbackBase, rand);
}

export function disposeObject(root) {
  root.traverse((child) => {
    child.geometry?.dispose?.();
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const m of mats) {
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture) v.dispose();
      }
      if (m.uniforms) {
        for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) u.value.dispose();
      }
      m.dispose();
    }
  });
}

export const isMobile = () =>
  window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

// Small 3D value-noise for CPU-side geometry displacement (asteroids, comets).
export function createNoise3D(seed = 1) {
  const rand = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => {
    const u = (h & 15) < 8 ? x : y;
    const v = (h & 15) < 4 ? y : (h & 15) === 12 || (h & 15) === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };
  const noise = (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
           lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
      w
    );
  };
  noise.fbm = (x, y, z, oct = 4) => {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f, z * f); f *= 2.02; a *= 0.5; }
    return s;
  };
  return noise;
}
