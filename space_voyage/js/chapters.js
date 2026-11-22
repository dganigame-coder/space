import * as THREE from 'three';
import {
  makePlanet, makeStar, makeGlare, makeAsteroids, makePointCloud, makeGalaxy, makeNebula,
  makeBlackHole, makeCMB, makeShell, makeGalaxyField, makeCosmicWeb, bbColor, rng, gauss,
} from './objects.js?v3';
import { buildExoChapters } from './exo.js?v3';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const KM_AU = 1.495978707e8;
const KM_LY = 9.4607e12;

const SUN_COL = new THREE.Color(1.0, 0.97, 0.92);

function curve(pts) { return new THREE.CatmullRomCurve3(pts.map(p => V(...p)), false, 'centripetal'); }

function distantSun(grp, dir, dist, size, color = '#fff4e0', inten = 4) {
  const g = makeGlare(color, size, inten);
  g.position.copy(dir.clone().normalize().multiplyScalar(dist));
  grp.add(g);
  return g;
}

function orbitLine(radius, color = 0x4d7fb3, opacity = 0.25, seg = 256) {
  const pts = [];
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)); }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
}

function shellPoints({ count, rMin, rMax, color = [0.6, 0.7, 0.9], size = 20, seed = 2, flatten = 1, center = V(0, 0, 0), bright = 1 }) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const rad = rMin + (rMax - rMin) * Math.pow(r(), 0.7);
    pos.set([s * Math.cos(th) * rad + center.x, u * rad * flatten + center.y, s * Math.sin(th) * rad + center.z], i * 3);
    const b = (0.4 + r() * 0.6) * bright;
    col.set([color[0] * b, color[1] * b, color[2] * b], i * 3);
    sz[i] = size * (0.5 + r());
  }
  return makePointCloud({ positions: pos, colors: col, sizes: sz });
}

function ringPoints({ count, rMin, rMax, thick, color, size, seed = 4 }) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const rad = rMin + (rMax - rMin) * r(); const th = r() * Math.PI * 2;
    pos.set([Math.cos(th) * rad, gauss(r) * thick, Math.sin(th) * rad], i * 3);
    const b = 0.4 + r() * 0.6; col.set([color[0] * b, color[1] * b, color[2] * b], i * 3);
    sz[i] = size * (0.5 + r());
  }
  return makePointCloud({ positions: pos, colors: col, sizes: sz });
}

// Planet presets
const P = {
  io: { type: 1, c1: '#e8cf62', c2: '#b8742a', c3: '#3a2a18', seed: 2.1 },
  europa: { type: 4, c1: '#ece6da', c2: '#8a5236', c3: '#c8b69c', seed: 5.4 },
  ganymede: { type: 1, c1: '#8c8378', c2: '#56504a', c3: '#c4b9a8', seed: 3.3 },
  callisto: { type: 1, c1: '#5f564d', c2: '#3a332c', c3: '#9a8f80', seed: 8.8 },
  titan: { type: 1, c1: '#c48c3e', c2: '#a8702c', c3: '#d6a456', seed: 1.9 },
  triton: { type: 4, c1: '#ddd0c8', c2: '#9a7468', c3: '#f0e6dc', seed: 6.1 },
  pluto: { type: 7, c1: '#b89a7c', c2: '#6e4f3a', c3: '#d9c4aa', seed: 4.2 },
  charon: { type: 1, c1: '#8d8984', c2: '#5a5652', c3: '#7a4a38', seed: 9.7 },
  rock: { type: 1, c1: '#5b544d', c2: '#3b3631', c3: '#7a7067', seed: 7.7 },
};

export function buildChapters(tex) {
  const chapters = [
    // 1 ---------------------------------------------------------------
    {
      title: 'Liftoff', kicker: 'Earth · Third planet from the Sun', dist: [0.04, 384400], dur: 24, ease: 2.0,
      drive: 'Methalox ascent stage → fusion torch', stars: 0.75, sky: 0.25,
      facts: [
        'Earth’s atmosphere scatters blue light most strongly (Rayleigh scattering ∝ 1/λ⁴) — the reason the limb glows blue and sunrises burn orange.',
        'Escape velocity from Earth’s surface is 11.2 km/s. Low Earth orbit needs about 7.8 km/s sideways, not straight up.',
        'The Kármán line at 100 km is the conventional edge of space. The atmosphere’s faint exosphere reaches beyond 10,000 km.',
      ],
      build() {
        const g = new THREE.Group();
        const earth = makePlanet({ radius: 1000, map: tex.earthDay, night: tex.earthNight, aux: tex.earthAux, clouds: tex.earthAux, cloudChan: 2, rim: '#5aa0ff', rimStr: 0.25, atmo: { thick: 0.028, k: 3.2, mie: 0.9, scaleH: 4.2 }, spin: 0.004, segments: 192, sunI: 1.15 });
        earth.rotation.z = 0.15; earth.userData.body.rotation.y = 2.6;
        g.add(earth);
        const sunDir = V(-0.45, 0.62, -0.65).normalize();
        const sunPos = sunDir.clone().multiplyScalar(1.5e6);
        distantSun(g, sunDir, 4e5, 26000, '#fff2dc', 5);
        const path = curve([[0, 1009, 0], [0, 1012, -4], [0, 1022, -22], [10, 1050, -90], [60, 1150, -400], [220, 1450, -1300], [520, 2000, -2700], [900, 2700, -4300]]);
        return {
          group: g, path, sunPos, sunColor: SUN_COL,
          focus: () => V(0, 0, 0),
          cam: [
            { u: 0.0, off: [4.5, 0.8, -5.0], look: 0.0, fov: 50 },
            { u: 0.25, off: [3.2, 1.4, -7.0], look: 0.0 },
            { u: 0.55, off: [2.6, 2.0, -8.5], look: 0.1 },
            { u: 0.8, off: [3.0, 1.8, -6.5], look: 0.4 },
            { u: 1.0, off: [2.5, 1.2, -6.5], look: 0.7, fov: 50 },
          ],
          plume: (u) => ({ power: 1.1 - u * 0.4, len: 2.0 - u, chem: u < 0.35 }),
          camUp: (u, fr) => fr.pos.clone().normalize().lerp(fr.y, THREE.MathUtils.smoothstep(u, 0.3, 0.75)).normalize(),
          shake: (u) => Math.max(0, 0.35 - u) * 0.05,
          labels: [{ name: 'Earth', sub: 'R = 6,371 km', pos: () => V(0, 0, 0), minU: 0.55 }],
          update(dt) { earth.userData.update(dt, sunPos, SUN_COL); },
        };
      },
    },
    // 2 ---------------------------------------------------------------
    {
      title: 'Earthrise', kicker: 'The Moon · 384,400 km', dist: [384400, 1.2e6], dur: 18,
      drive: 'Fusion torch · time-compressed', stars: 1, sky: 0.3,
      facts: [
        'The Moon is tidally locked: it rotates once per orbit, so the same hemisphere always faces Earth.',
        'Apollo 8 photographed the first “Earthrise” on 24 December 1968 from lunar orbit.',
        'Most lunar craters are impact scars billions of years old — with no air or weather, they are barely eroded.',
      ],
      build() {
        const g = new THREE.Group();
        const moon = makePlanet({ radius: 270, map: tex.moon, spin: 0.0, segments: 192, sunI: 1.8 });
        g.add(moon);
        const earth = makePlanet({ radius: 1000, map: tex.earthDay, night: tex.earthNight, aux: tex.earthAux, clouds: tex.earthAux, rim: '#5aa0ff', rimStr: 0.3, atmo: { thick: 0.028, k: 3.2, mie: 0.9 }, spin: 0.01, sunI: 1.7 });
        earth.position.set(0, 3800, -60000);
        g.add(earth);
        const sunDir = V(1, 0.15, -0.35).normalize();
        const sunPos = sunDir.clone().multiplyScalar(1.5e6);
        distantSun(g, sunDir, 4e5, 22000, '#fff2dc', 5);
        const path = curve([[-260, 420, 1100], [-90, 315, 300], [0, 292, -80], [70, 210, -430], [220, 120, -1400], [500, 300, -4200]]);
        return {
          group: g, path, sunPos, sunColor: SUN_COL,
          focus: () => earth.position,
          cam: [{ u: 0, off: [1.4, 0.5, 5.5], look: 0.4, fov: 44 }, { u: 0.55, off: [-1.5, 0.7, 5.2], look: 0.55 }, { u: 1, off: [1, 0.8, 6], look: 0.6 }],
          plume: () => ({ power: 1, len: 1.2 }),
          labels: [{ name: 'Moon', sub: 'R = 1,737 km', pos: () => V(0, 0, 0) }, { name: 'Earth', sub: '384,400 km', pos: () => earth.position }],
          update(dt) { moon.userData.update(dt, sunPos, SUN_COL); earth.userData.update(dt, sunPos, SUN_COL); },
        };
      },
    },
    // 3 ---------------------------------------------------------------
    {
      title: 'Into the Fire', kicker: 'The Sun · Venus · Mercury', dist: [1.2e6, 1.0 * KM_AU], dur: 28,
      drive: 'Fusion torch · Oberth manoeuvre at perihelion', stars: 0.6, sky: 0.15,
      facts: [
        'The Sun holds 99.86% of the Solar System’s mass. Its core fuses ~600 million tonnes of hydrogen every second.',
        'The photosphere is ~5,772 K, yet the corona is 1–3 million K — the coronal heating problem is still unsolved.',
        'Venus is wrapped in sulfuric-acid clouds over a 96% CO₂ atmosphere; its surface sits at ~465 °C.',
        'Parker Solar Probe has passed within 6.1 million km of the Sun at ~192 km/s — the fastest object humans have built.',
      ],
      build() {
        const g = new THREE.Group();
        const sun = makeStar({ radius: 700, temp: 5772, map: tex.sun, intensity: 3.2, corona: 6, coronaI: 0.9 });
        g.add(sun);
        const venus = makePlanet({ radius: 36, map: tex.venus, rim: '#f0d08a', rimStr: 0.5, atmo: { thick: 0.08, betaR: [0.9, 0.7, 0.4], k: 4, mie: 1.5, scaleH: 2.5 }, spin: 0.002, sunI: 1.3 });
        venus.position.set(-2400, 40, 3200); g.add(venus);
        const mercury = makePlanet({ radius: 16, map: tex.mercury, spin: 0.01, sunI: 1.5 });
        mercury.position.set(1600, 0, -800); g.add(mercury);
        const sunPos = V(0, 0, 0);
        const path = curve([[-4200, 300, 7000], [-2290, 75, 3140], [-1550, 260, 850], [-650, 260, -1250], [800, 120, -1350], [1500, 40, -720], [3600, 300, 1400]]);
        return {
          group: g, path, sunPos, sunColor: SUN_COL, flareStar: sun,
          focus: (u) => (u < 0.25 ? venus.position : u > 0.7 && u < 0.85 ? mercury.position : V(0, 0, 0)),
          cam: [{ u: 0, off: [1.6, 0.6, 5.5], look: 0.4, fov: 48 }, { u: 0.25, off: [-1.6, 0.4, 4.5], look: 0.45 }, { u: 0.55, off: [2.2, 1.4, 5.5], look: 0.5 }, { u: 0.8, off: [-2, 0.6, 5], look: 0.45 }, { u: 1, off: [1.5, 1, 6], look: 0.3 }],
          plume: () => ({ power: 1.1, len: 1.4 }),
          heat: (shipPos) => Math.max(0, 1 - (shipPos.length() - 1300) / 700),
          labels: [
            { name: 'Sun', sub: 'G2V · 5,772 K', pos: () => V(0, 0, 0) },
            { name: 'Venus', sub: '0.72 AU', pos: () => venus.position, maxU: 0.4 },
            { name: 'Mercury', sub: '0.39 AU', pos: () => mercury.position, minU: 0.55 },
          ],
          update(dt, cam) { sun.userData.update(cam); venus.userData.update(dt, sunPos, SUN_COL); mercury.userData.update(dt, sunPos, SUN_COL); },
        };
      },
    },
    // 4 ---------------------------------------------------------------
    {
      title: 'The Red Planet', kicker: 'Mars · Asteroid Belt · Ceres', dist: [1.0 * KM_AU, 2.9 * KM_AU], dur: 26,
      drive: 'Fusion torch · time-compressed', stars: 1, sky: 0.3,
      facts: [
        'Olympus Mons on Mars is ~22 km high — about 2.5× the height of Everest — and the tallest volcano known in the Solar System.',
        'Mars’ thin CO₂ atmosphere is <1% of Earth’s pressure; fine dust scatters red by day and blue at sunset.',
        'Despite the movies, the asteroid belt is mostly empty: neighbouring asteroids are typically ~1 million km apart. Here it is drawn denser for visibility.',
        'Ceres (940 km) is a dwarf planet holding about a quarter of the belt’s total mass.',
      ],
      build() {
        const g = new THREE.Group();
        const mars = makePlanet({ radius: 180, map: tex.mars, rim: '#e0a070', rimStr: 0.2, atmo: { thick: 0.03, betaR: [0.6, 0.45, 0.35], k: 1.6, mie: 1.2, scaleH: 3 }, spin: 0.01, sunI: 1.5 });
        g.add(mars);
        const phobos = makePlanet({ radius: 7, proc: P.rock, sunI: 1.5 }); phobos.position.set(-330, 60, 120); g.add(phobos);
        const deimos = makePlanet({ radius: 4, proc: { ...P.rock, seed: 2.2 }, sunI: 1.5 }); deimos.position.set(200, -40, -900); g.add(deimos);
        const belt = makeAsteroids({ count: 3500, inner: 0, outer: 1800, thick: 120, center: V(200, 20, -5200), sizeMin: 0.4, sizeMax: 28, seed: 8 });
        g.add(belt);
        const ceres = makePlanet({ radius: 42, proc: { type: 1, c1: '#777069', c2: '#4e4943', c3: '#9a938a', seed: 3.9 }, sunI: 1.4 });
        ceres.position.set(420, 40, -5600); g.add(ceres);
        const sunDir = V(-1, 0.2, 0.35).normalize();
        const sunPos = sunDir.clone().multiplyScalar(1.5e6);
        distantSun(g, sunDir, 4e5, 14000, '#fff2dc', 4);
        const path = curve([[-700, 250, 1700], [-280, 90, 300], [0, 0, -1200], [180, 15, -4000], [360, 50, -5520], [520, 70, -8200]]);
        return {
          group: g, path, sunPos, sunColor: SUN_COL,
          focus: (u) => (u < 0.35 ? V(0, 0, 0) : ceres.position),
          cam: [{ u: 0, off: [1.6, 0.6, 5.5], look: 0.45, fov: 46 }, { u: 0.3, off: [-1.8, 0.8, 5], look: 0.4 }, { u: 0.6, off: [1.2, 0.5, 4.2], look: 0.15 }, { u: 1, off: [-1.2, 0.8, 5.5], look: 0.3 }],
          plume: () => ({ power: 1, len: 1.2 }),
          labels: [
            { name: 'Mars', sub: '1.52 AU · R = 3,390 km', pos: () => V(0, 0, 0), maxU: 0.45 },
            { name: 'Phobos', sub: '22 km', pos: () => phobos.position, maxU: 0.3 },
            { name: 'Ceres', sub: 'Dwarf planet · 2.77 AU', pos: () => ceres.position, minU: 0.55 },
          ],
          update(dt) { [mars, phobos, deimos, ceres].forEach(p => p.userData.update(dt, sunPos, SUN_COL)); belt.rotation.y += dt * 0.002; },
        };
      },
    },
    // 5 ---------------------------------------------------------------
    {
      title: 'King of Planets', kicker: 'Jupiter · Io · Europa · Ganymede · Callisto', dist: [2.9 * KM_AU, 5.2 * KM_AU], dur: 26,
      drive: 'Fusion torch · gravity assist', stars: 1, sky: 0.3,
      facts: [
        'Jupiter is 318 Earth masses — more than twice all other planets combined. It spins in under 10 hours, flattening its poles.',
        'The Great Red Spot is an anticyclone wider than Earth, observed continuously since at least 1831.',
        'Io is the most volcanic body known, heated by tidal flexing. Europa likely hides a salty ocean beneath its ice.',
      ],
      build() {
        const g = new THREE.Group();
        const sunDir = V(1, 0.12, 0.25).normalize();
        const sunPos = sunDir.clone().multiplyScalar(2e6);
        const jup = makePlanet({ radius: 900, map: tex.jupiter, oblate: 0.065, rim: '#c8b090', rimStr: 0.35, atmo: { thick: 0.02, betaR: [0.35, 0.45, 0.8], k: 2, mie: 0.6 }, spin: 0.02, segments: 192, sunI: 1.4 });
        g.add(jup);
        const moons = [
          ['Europa', P.europa, 22, [-1850, 300, 3650], 'Subsurface ocean'],
          ['Io', P.io, 26, [1330, 80, -2250], 'Volcanic world'],
          ['Ganymede', P.ganymede, 37, [2650, 200, -4480], 'Largest moon in the Solar System'],
          ['Callisto', P.callisto, 34, [3100, 700, -6900], 'Ancient, cratered'],
        ].map(([n, pr, r, p, s]) => { const m = makePlanet({ radius: r, proc: pr, sunI: 1.5 }); m.position.set(...p); g.add(m); return { n, m, s }; });
        distantSun(g, sunDir, 4e5, 6000, '#fff2dc', 4);
        const path = curve([[-3000, 650, 6200], [-1760, 330, 3560], [-650, 520, 1060], [420, 320, -1020], [1270, 110, -2180], [2590, 230, -4400], [4000, 500, -7600]]);
        return {
          group: g, path, sunPos, sunColor: SUN_COL,
          focus: (u) => (u > 0.18 && u < 0.6 ? V(0, 0, 0) : u <= 0.18 ? moons[0].m.position : moons[2].m.position),
          cam: [{ u: 0, off: [1.5, 0.6, 5.5], look: 0.35, fov: 48 }, { u: 0.3, off: [-2.2, 1.2, 6], look: 0.5 }, { u: 0.55, off: [1.8, 0.5, 5], look: 0.4 }, { u: 1, off: [-1.6, 0.8, 5.5], look: 0.35 }],
          plume: () => ({ power: 1, len: 1.2 }),
          labels: [{ name: 'Jupiter', sub: '5.2 AU · 318 M⊕', pos: () => V(0, 0, 0) }, ...moons.map(o => ({ name: o.n, sub: o.s, pos: () => o.m.position }))],
          update(dt) { jup.userData.update(dt, sunPos, SUN_COL); moons.forEach(o => o.m.userData.update(dt, sunPos, SUN_COL)); },
        };
      },
    },
    // 6 ---------------------------------------------------------------
    {
      title: 'Lord of the Rings', kicker: 'Saturn · Titan', dist: [5.2 * KM_AU, 9.6 * KM_AU], dur: 28,
      drive: 'Fusion torch · ring-plane crossing', stars: 1, sky: 0.3,
      facts: [
        'Saturn’s main rings span ~280,000 km yet are typically only ~10 m thick — billions of water-ice fragments.',
        'The Cassini Division, a 4,800 km gap, is cleared by a 2:1 orbital resonance with the moon Mimas.',
        'Titan is the only moon with a thick atmosphere (1.5× Earth’s surface pressure) and lakes of liquid methane.',
        'Saturn is less dense than water: 0.69 g/cm³.',
      ],
      build() {
        const g = new THREE.Group();
        const sunDir = V(1, 0.35, 0.2).normalize();
        const sunPos = sunDir.clone().multiplyScalar(2e6);
        const sat = makePlanet({ radius: 800, map: tex.saturn, oblate: 0.098, rim: '#d8c49a', rimStr: 0.3, atmo: { thick: 0.02, betaR: [0.45, 0.45, 0.6], k: 1.6, mie: 0.6 }, spin: 0.02, segments: 192, sunI: 1.4, ring: { map: tex.saturnRing, inner: 1.24, outer: 2.27 } });
        sat.rotation.z = 0.47;
        g.add(sat);
        sat.updateMatrixWorld(true);
        const M = sat.matrixWorld;
        const L = (x, y, z) => V(x, y, z).applyMatrix4(M).toArray();
        const ringRocks = makeAsteroids({ count: 2200, inner: 0, outer: 260, thick: 3, center: V(-1100, 0, 1140), sizeMin: 0.15, sizeMax: 3.5, color: '#d8d2c8', seed: 21 });
        sat.add(ringRocks);
        const titan = makePlanet({ radius: 40, proc: P.titan, rim: '#e0a050', rimStr: 0.6, atmo: { thick: 0.2, betaR: [1.0, 0.55, 0.2], k: 3, mie: 2.0, scaleH: 2.0, g: 0.6 }, sunI: 1.4 });
        titan.position.set(...L(-3100, 900, 4800)); titan.position.x += 160; g.add(titan);
        distantSun(g, sunDir, 4e5, 4000, '#fff2dc', 4);
        const path = curve([L(-3100, 900, 4800), L(-1850, 420, 2250), L(-1100, 0, 1140), L(-1420, -260, -200), L(300, -460, -1750), L(2100, -700, -4300)]);
        return {
          group: g, path, sunPos, sunColor: SUN_COL,
          focus: (u) => (u < 0.12 ? titan.position : V(0, 0, 0)),
          cam: [{ u: 0, off: [1.5, 0.7, 5.5], look: 0.3, fov: 50 }, { u: 0.3, off: [-1.6, 1.4, 5.5], look: 0.5 }, { u: 0.45, off: [1.2, 0.35, 4.5], look: 0.2 }, { u: 0.7, off: [-2.5, -0.6, 6], look: 0.55 }, { u: 1, off: [1, -1.5, -7], look: 0.75 }],
          plume: () => ({ power: 1, len: 1.2 }),
          labels: [{ name: 'Saturn', sub: '9.5 AU · 95 M⊕', pos: () => V(0, 0, 0) }, { name: 'Titan', sub: 'Methane lakes', pos: () => titan.position, maxU: 0.25 }, { name: 'Cassini Division', sub: '4,800 km gap', pos: () => V(...L(-1500, 0, 1560)), minU: 0.3, maxU: 0.48 }],
          update(dt) { sat.userData.update(dt, sunPos, SUN_COL); titan.userData.update(dt, sunPos, SUN_COL); },
        };
      },
    },
    // 7 ---------------------------------------------------------------
    {
      title: 'The Ice Giants', kicker: 'Uranus · Neptune · Triton', dist: [9.6 * KM_AU, 30.1 * KM_AU], dur: 28,
      drive: 'Fusion torch · time-compressed', stars: 1, sky: 0.32,
      facts: [
        'Uranus is tipped 98° — it rolls around the Sun on its side, giving each pole 42 years of continuous daylight.',
        'Methane in their atmospheres absorbs red light, colouring Uranus cyan and Neptune a deeper blue.',
        'Neptune has the fastest winds measured in the Solar System: over 2,000 km/h.',
        'Triton orbits Neptune backwards — likely a captured Kuiper Belt object — and vents nitrogen geysers.',
      ],
      build() {
        const g = new THREE.Group();
        const sunDir = V(1, 0.1, 0.4).normalize();
        const sunPos = sunDir.clone().multiplyScalar(3e6);
        const ura = makePlanet({ radius: 400, map: tex.uranus, rim: '#9ee8f0', rimStr: 0.4, atmo: { thick: 0.025, betaR: [0.25, 0.6, 0.7], k: 2.4, mie: 0.4 }, spin: 0.015, sunI: 1.4, ring: { inner: 1.6, outer: 2.0, tint: '#8a9aa8', shadow: false } });
        ura.rotation.z = 1.71; g.add(ura);
        const nep = makePlanet({ radius: 390, map: tex.neptune, rim: '#5a84ff', rimStr: 0.45, atmo: { thick: 0.025, betaR: [0.15, 0.35, 1.0], k: 2.6, mie: 0.4 }, spin: 0.015, sunI: 1.3 });
        nep.position.set(3500, -200, -9000); g.add(nep);
        const triton = makePlanet({ radius: 20, proc: P.triton, sunI: 1.4 }); triton.position.set(4500, -90, -10500); g.add(triton);
        distantSun(g, sunDir, 4e5, 2000, '#fff2dc', 4);
        const path = curve([[-1700, 320, 2900], [-520, 160, 700], [700, 20, -1600], [2400, -150, -6800], [3180, -110, -8380], [4380, -60, -10250], [5300, 0, -13200]]);
        return {
          group: g, path, sunPos, sunColor: SUN_COL,
          focus: (u) => (u < 0.35 ? V(0, 0, 0) : nep.position),
          cam: [{ u: 0, off: [1.5, 0.6, 5.5], look: 0.45, fov: 48 }, { u: 0.25, off: [-1.8, 1, 5], look: 0.5 }, { u: 0.6, off: [1.6, 0.6, 5.5], look: 0.5 }, { u: 1, off: [-1, 1, -6], look: 0.6 }],
          plume: () => ({ power: 1, len: 1.2 }),
          labels: [{ name: 'Uranus', sub: '19.2 AU · tilt 98°', pos: () => V(0, 0, 0), maxU: 0.5 }, { name: 'Neptune', sub: '30.1 AU', pos: () => nep.position, minU: 0.35 }, { name: 'Triton', sub: 'Retrograde moon', pos: () => triton.position, minU: 0.6 }],
          update(dt) { ura.userData.update(dt, sunPos, SUN_COL); nep.userData.update(dt, sunPos, SUN_COL); triton.userData.update(dt, sunPos, SUN_COL); },
        };
      },
    },
    // 8 ---------------------------------------------------------------
    {
      title: 'Edge of the Sun’s Realm', kicker: 'Pluto · Kuiper Belt · Heliopause · Oort Cloud', dist: [30.1 * KM_AU, 1.0 * KM_LY], dur: 30, ease: 1.8,
      drive: 'Fusion torch → warp field spin-up', stars: 1, sky: 0.32,
      facts: [
        'Pluto’s bright “heart”, Tombaugh Regio, is a basin of nitrogen ice mapped by New Horizons in 2015.',
        'At the heliopause (~120 AU) the solar wind meets interstellar plasma. Voyager 1 crossed it in August 2012.',
        'The Oort Cloud is a theorised shell of icy bodies from ~2,000 to ~100,000 AU — the source of long-period comets.',
        'Planet orbits shown here are to relative scale (1 AU = 100 units).',
      ],
      build() {
        const g = new THREE.Group();
        const sunPos = V(0, 0, 0);
        const sunG = makeGlare('#fff4e0', 600, 6); g.add(sunG);
        const pluto = makePlanet({ radius: 45, proc: P.pluto, rim: '#9ab8ff', rimStr: 0.2, atmo: { thick: 0.05, betaR: [0.2, 0.4, 1.0], k: 1.0, mie: 0.3 }, sunI: 0.8 });
        pluto.position.set(0, 0, 4000); g.add(pluto);
        const charon = makePlanet({ radius: 23, proc: P.charon, sunI: 0.8 }); charon.position.set(260, 60, 4180); g.add(charon);
        [39, 72, 100, 152, 520, 954, 1920, 3007].forEach(r => g.add(orbitLine(r, 0x5f8fc8, 0.35)));
        const pOrbit = orbitLine(3950, 0xb08a68, 0.3); pOrbit.rotation.x = 0.3; g.add(pOrbit);
        g.add(ringPoints({ count: 40000, rMin: 3000, rMax: 5000, thick: 260, color: [0.55, 0.6, 0.7], size: 2.2, seed: 6 }));
        g.add(makeShell({ radius: 9000, color: '#4f7bff', strength: 0.18, scale: [1, 1, 1.2] }));
        const helio = makeShell({ radius: 12000, color: '#7a6bff', strength: 0.55, scale: [1, 1, 1.55] }); helio.position.z = -3000; g.add(helio);
        g.add(shellPoints({ count: 60000, rMin: 25000, rMax: 120000, color: [0.5, 0.58, 0.72], size: 60, seed: 12, bright: 0.6 }));
        const path = curve([[-420, 120, 3020], [-90, 32, 3910], [200, 60, 4600], [800, 300, 9000], [1500, 600, 13500], [6000, 3000, 50000], [15000, 8000, 130000]]);
        const voyager = V(5200, 3800, 13600);
        return {
          group: g, path, sunPos, sunColor: SUN_COL,
          focus: (u) => (u < 0.3 ? pluto.position : V(0, 0, 0)),
          cam: [{ u: 0, off: [1.5, 0.6, 5.5], look: 0.45, fov: 48 }, { u: 0.25, off: [-1.5, 0.8, 5], look: 0.5 }, { u: 0.45, off: [2, 1.2, -6], look: 0.8 }, { u: 0.7, off: [600, 300, -2000], look: 1.0 }, { u: 1, off: [70000, 30000, -30000], look: 1.0, fov: 55 }],
          plume: () => ({ power: 1.1, len: 1.4 }),
          labels: [
            { name: 'Pluto', sub: '39.5 AU · dwarf planet', pos: () => pluto.position, maxU: 0.35 },
            { name: 'Charon', sub: '1,212 km', pos: () => charon.position, maxU: 0.3 },
            { name: 'The Sun', sub: '', pos: () => V(0, 0, 0), minU: 0.5 },
            { name: 'Heliopause', sub: '~120 AU', pos: () => V(0, 12000, -3000), minU: 0.62 },
            { name: 'Voyager 1', sub: 'Crossed 2012', pos: () => voyager, minU: 0.55, maxU: 0.85 },
            { name: 'Oort Cloud', sub: '2,000–100,000 AU', pos: () => V(-60000, 30000, 40000), minU: 0.8 },
          ],
          update(dt, cam) { sunG.userData.update(cam); pluto.userData.update(dt, sunPos, SUN_COL); charon.userData.update(dt, sunPos, SUN_COL); },
        };
      },
    },
    // 9 ---------------------------------------------------------------
    {
      title: 'Our Nearest Stars', kicker: 'Alpha Centauri A & B · Proxima Centauri b', dist: [1.0 * KM_LY, 4.24 * KM_LY], dur: 28, warpIn: true,
      drive: 'Alcubierre warp bubble (hypothetical)', stars: 1, sky: 0.3,
      facts: [
        'Alpha Centauri A (G2V) and B (K1V) orbit each other every ~80 years. Proxima, a red dwarf, circles the pair at ~13,000 AU.',
        'Proxima b (≥1.07 Earth masses) orbits in its star’s habitable zone — every 11.2 days.',
        'It is probably tidally locked: an “eyeball planet” with a permanent day-side ocean and a frozen night side.',
        'The Alcubierre metric (1994) contracts space ahead and expands it behind. It would need exotic negative energy, and none is known to exist.',
      ],
      build() {
        const g = new THREE.Group();
        const A = makeStar({ radius: 120, temp: 5790, intensity: 4.5, corona: 6, coronaI: 0.8, seed: 1 }); A.position.set(-500, 0, 0); g.add(A);
        const B = makeStar({ radius: 86, temp: 5260, intensity: 4.2, corona: 6, coronaI: 0.8, seed: 2 }); B.position.set(720, 110, -300); g.add(B);
        const prox = makeStar({ radius: 40, temp: 3042, intensity: 5, corona: 9, coronaI: 2.2, seed: 3 }); prox.position.set(3000, 600, -11000); g.add(prox);
        const pb = makePlanet({ radius: 12, proc: { type: 3, c1: '#1c4f73', c2: '#6e5640', c3: '#8a7058', seed: 2.6 }, rim: '#7aa6ff', rimStr: 0.35, atmo: { thick: 0.06, k: 2.4, mie: 0.8 }, sunI: 1.7 });
        pb.position.set(2300, 600, -10400); g.add(pb);
        const proxCol = bbColor(3042);
        const pathC = curve([[-1500, 520, 3100], [0, 160, 600], [220, 70, -420], [1500, 300, -4000], [1900, 560, -9600], [2272, 622, -10360], [2700, 640, -11150], [4200, 700, -12600]]);
        return {
          group: g, path: pathC,
          sunAt: (ship) => {
            const dA = ship.distanceTo(A.position), dB = ship.distanceTo(B.position), dP = ship.distanceTo(prox.position);
            if (dP < 3000) return { pos: prox.position, color: proxCol };
            return dA < dB ? { pos: A.position, color: A.userData.color } : { pos: B.position, color: B.userData.color };
          },
          sunPos: prox.position, sunColor: proxCol, flareStar: A,
          focus: (u) => (u < 0.4 ? V(100, 50, -150) : u < 0.8 ? pb.position : prox.position),
          cam: [{ u: 0, off: [1.6, 0.6, 5.5], look: 0.35, fov: 50 }, { u: 0.3, off: [-2, 1, 5], look: 0.45 }, { u: 0.6, off: [1.4, 0.6, 5], look: 0.5 }, { u: 0.8, off: [-1.5, 0.4, 4.8], look: 0.45 }, { u: 1, off: [1.2, 1, -6], look: 0.6 }],
          plume: () => ({ power: 0.6, len: 0.8 }),
          labels: [
            { name: 'α Centauri A', sub: 'G2V · 1.1 M☉', pos: () => A.position, maxU: 0.5 },
            { name: 'α Centauri B', sub: 'K1V · 0.9 M☉', pos: () => B.position, maxU: 0.5 },
            { name: 'Proxima Centauri', sub: 'M5.5V red dwarf', pos: () => prox.position, minU: 0.45 },
            { name: 'Proxima b', sub: 'Habitable-zone exoplanet', pos: () => pb.position, minU: 0.45 },
          ],
          update(dt, cam) { [A, B, prox].forEach(s => s.userData.update(cam)); pb.userData.update(dt, prox.position, proxCol); },
        };
      },
    },
    // 10 --------------------------------------------------------------
    {
      title: 'Seven Worlds', kicker: 'TRAPPIST-1 · ultra-cool red dwarf', dist: [4.24 * KM_LY, 40.7 * KM_LY], dur: 28, warpIn: true,
      drive: 'Alcubierre warp bubble (hypothetical)', stars: 1, sky: 0.3,
      facts: [
        'TRAPPIST-1 hosts seven roughly Earth-sized rocky planets, all orbiting closer to their star than Mercury does to the Sun.',
        'Planets e, f and g lie in the habitable zone. From one world, its neighbours can loom larger than our Moon in the sky.',
        'The star is only ~2,566 K and barely larger than Jupiter, so its planets bask in deep-red, infrared-rich light.',
        'JWST measurements suggest TRAPPIST-1 b has little or no thick atmosphere. Planet sizes here are enlarged 4× for visibility.',
      ],
      build() {
        const g = new THREE.Group();
        const star = makeStar({ radius: 30, temp: 2566, intensity: 4, corona: 10, coronaI: 2.4, seed: 5 });
        g.add(star);
        const col = bbColor(2566);
        const defs = [
          ['b', 620, 11.2, { type: 5, c1: '#2a1a14', c2: '#4a2c1e', seed: 1.1 }, 3.0],
          ['c', 850, 11.0, { type: 1, c1: '#6a5244', c2: '#3a2a22', c3: '#8a6a50', seed: 2.2 }, 2.65],
          ['d', 1200, 7.9, { type: 2, c1: '#26506e', c2: '#6c5a48', c3: '#8b7a62', seed: 3.3 }, 2.3],
          ['e', 1570, 9.2, { type: 2, c1: '#1b4d7a', c2: '#56683c', c3: '#8d7b5c', seed: 4.4 }, 1.95],
          ['f', 2070, 10.5, { type: 3, c1: '#1d4466', c2: '#5c4a3a', c3: '#7a6a58', seed: 5.5 }, 1.6],
          ['g', 2520, 11.3, { type: 4, c1: '#d8dce4', c2: '#7a6a62', c3: '#b8c0cc', seed: 6.6 }, 1.25],
          ['h', 3330, 7.6, { type: 4, c1: '#c8ccd6', c2: '#5a5a66', c3: '#e0e4ea', seed: 7.7 }, 0.9],
        ];
        const planets = defs.map(([n, a, r, pr, th]) => {
          const p = makePlanet({ radius: r, proc: pr, rim: '#ff9a6a', rimStr: n === 'e' || n === 'f' ? 0.3 : 0.1, atmo: (n === 'e' || n === 'f' || n === 'd') ? { thick: 0.07, k: 2.2, mie: 0.8 } : null, sunI: 2.2 });
          p.position.set(Math.cos(th) * a, Math.sin(th * 3) * 20, Math.sin(th) * a);
          g.add(p); g.add(orbitLine(a, 0xff7a4a, 0.12));
          return { n, p, a, th };
        });
        const pts = [[Math.cos(0.6) * 5200, 300, Math.sin(0.6) * 5200]];
        [...planets].reverse().forEach(({ p, a, th }, i) => {
          if (i > 5) return;
          const out = p.position.clone().setY(0).normalize();
          const w = p.position.clone().addScaledVector(out, p.userData.R * 2.6).add(V(0, p.userData.R * 1.3, 0));
          pts.push(w.toArray());
        });
        pts.push([Math.cos(3.2) * 300, 60, Math.sin(3.2) * 300]);
        pts.push([Math.cos(3.8) * 2400, 400, Math.sin(3.8) * 2400]);
        const path = curve(pts);
        return {
          group: g, path, sunPos: V(0, 0, 0), sunColor: col, flareStar: star,
          focus: (u) => { const i = Math.min(6, Math.floor(u * 7.5)); return i < 6 ? planets[6 - i].p.position : V(0, 0, 0); },
          cam: [{ u: 0, off: [1.6, 0.6, 5.5], look: 0.4, fov: 50 }, { u: 0.35, off: [-1.4, 0.6, 4.8], look: 0.45 }, { u: 0.7, off: [1.6, 0.8, 5], look: 0.5 }, { u: 1, off: [-1, 1, -6], look: 0.7 }],
          plume: () => ({ power: 0.6, len: 0.8 }),
          labels: [{ name: 'TRAPPIST-1', sub: 'M8V · 2,566 K', pos: () => V(0, 0, 0) }, ...planets.map(o => ({ name: 'TRAPPIST-1 ' + o.n, sub: o.n === 'e' ? 'Habitable zone · rocky' : '', pos: () => o.p.position }))],
          update(dt, cam) { star.userData.update(cam); planets.forEach(o => o.p.userData.update(dt, V(0, 0, 0), col)); },
        };
      },
    },
    // 11 --------------------------------------------------------------
    {
      title: 'Stellar Nursery', kicker: 'The Orion Nebula · M42', dist: [40.7 * KM_LY, 1344 * KM_LY], dur: 26, warpIn: true,
      drive: 'Alcubierre warp bubble (hypothetical)', stars: 0.9, sky: 0.3,
      facts: [
        'M42 is the nearest region of massive star formation, ~1,344 light-years away and ~24 light-years across.',
        'The red glow is hydrogen-alpha emission (656 nm); teal-green comes from doubly ionised oxygen [O III] near the hottest stars.',
        'The Trapezium’s young O-type stars (θ¹ Ori C at ~39,000 K) ionise the gas and carve the cavity you are flying through.',
        'Hubble has imaged over 150 “proplyds” here — protoplanetary disks where new solar systems are forming.',
      ],
      build() {
        const g = new THREE.Group();
        const neb = makeNebula({ size: 7000, center: V(0, 0, 0) }); neb.material.uniforms.inten.value = 0.38;
        g.add(neb);
        const trap = [[0, 0, 0, 39000, 18], [60, 25, -30, 30000, 12], [-45, -20, 40, 32000, 13], [30, -50, 55, 25000, 10]].map(([x, y, z, T, r], i) => {
          const s = makeStar({ radius: r, temp: T, intensity: 4, corona: 9, coronaI: 1.0, seed: i * 3 }); s.position.set(x, y, z); g.add(s); return s;
        });
        const r = rng(77);
        const young = []; for (let i = 0; i < 70; i++) { const m = makeGlare(r() < 0.5 ? '#bcd0ff' : '#ffd8b0', 25 + r() * 60, 2 + r() * 3); m.position.set(gauss(r) * 1400, gauss(r) * 1000, gauss(r) * 1400); g.add(m); young.push(m); }
        const path = curve([[-5600, 900, 7400], [-1500, 260, 1800], [160, 70, 220], [1600, -100, -1500], [5200, -500, -6400]]);
        return {
          group: g, path, sunPos: V(0, 0, 0), sunColor: bbColor(30000), flareStar: trap[0],
          focus: () => V(0, 0, 0),
          cam: [{ u: 0, off: [1.5, 0.6, 5.5], look: 0.45, fov: 52 }, { u: 0.45, off: [-1.6, 0.8, 5], look: 0.5 }, { u: 0.6, off: [1.2, 0.4, 4.6], look: 0.35 }, { u: 1, off: [1, 1, -6], look: 0.75 }],
          plume: () => ({ power: 0.6, len: 0.8 }),
          labels: [{ name: 'Trapezium Cluster', sub: 'θ¹ Orionis', pos: () => V(0, 0, 0), minU: 0.15 }],
          update(dt, cam) { trap.forEach(s => s.userData.update(cam)); young.forEach(m => m.userData.update(cam)); },
        };
      },
    },
    // 12 --------------------------------------------------------------
    {
      title: 'The Heart of Darkness', kicker: 'Sagittarius A* · supermassive black hole', dist: [1344 * KM_LY, 26670 * KM_LY], dur: 28, warpIn: true,
      drive: 'Warp bubble · extreme tidal shielding (fictional)', stars: 0, sky: 0,
      facts: [
        'Sgr A* holds ~4.3 million solar masses. Its event horizon (Schwarzschild radius) is ~12.7 million km across.',
        'Light bends along geodesics of curved spacetime — the far side of the accretion disk appears lifted above and below the shadow.',
        'The approaching side of the disk is brighter and bluer: relativistic Doppler beaming. Gravitational redshift dims light near the horizon.',
        'The Event Horizon Telescope imaged Sgr A*’s shadow in 2022. The star S2 orbits it every 16 years, confirming general relativity.',
      ],
      build() {
        const g = new THREE.Group();
        const bh = makeBlackHole({ rs: 12, skyTex: tex.milky });
        g.add(bh);
        const r = rng(31);
        const sstars = []; for (let i = 0; i < 26; i++) { const m = makeGlare('#cfe0ff', 8 + r() * 10, 3); const a = r() * 6.28, rad = 500 + r() * 1500; m.position.set(Math.cos(a) * rad, gauss(r) * 400, Math.sin(a) * rad); g.add(m); sstars.push(m); }
        const path = curve([[-1500, 320, 1900], [-480, 90, 560], [-40, 46, 290], [270, 34, 60], [220, 24, -270], [-250, 70, -820], [-1700, 380, -2500]]);
        return {
          group: g, path, sunPos: V(0, 400, 0), sunColor: new THREE.Color(1, 0.7, 0.45),
          focus: () => V(0, 0, 0),
          cam: [{ u: 0, off: [1.6, 0.6, 5.5], look: 0.5, fov: 50 }, { u: 0.35, off: [-1.6, 0.5, 5], look: 0.55 }, { u: 0.6, off: [2, 0.8, 5], look: 0.6 }, { u: 1, off: [1, 1.2, -6], look: 0.8 }],
          plume: () => ({ power: 0.7, len: 0.9 }),
          labels: [{ name: 'Sagittarius A*', sub: '4.3 million M☉', pos: () => V(0, 30, 0) }],
          blackHole: { R: 12, name: 'Sagittarius A*' },
          update(dt, cam) { sstars.forEach(m => m.userData.update(cam)); },
          noStarfield: true,
        };
      },
    },
    // 13 --------------------------------------------------------------
    {
      title: 'Leaving the Milky Way', kicker: 'Our galaxy · 100,000 light-years across', dist: [26670 * KM_LY, 180000 * KM_LY], dur: 28, warpIn: true, ease: 1.3,
      drive: 'Warp bubble (hypothetical)', stars: 0.25, sky: 0,
      facts: [
        'The Milky Way is a barred spiral with 100–400 billion stars. The Sun sits ~26,000 ly from the centre in the Orion Spur.',
        'It takes the Sun ~230 million years to orbit the galaxy once — about one “galactic year”.',
        'Dark lanes are interstellar dust; pink knots mark star-forming H II regions along the spiral arms.',
        'The Large and Small Magellanic Clouds are satellite dwarf galaxies 160,000 and 200,000 ly away.',
      ],
      build() {
        const g = new THREE.Group();
        const mw = makeGalaxy({ count: 220000, radius: 5000, arms: 4, pitch: 12.5, bar: 0.4, thickness: 0.025, seed: 9 });
        g.add(mw);
        const lmc = makeGalaxy({ count: 18000, radius: 450, arms: 1, pitch: 25, bar: 0.6, thickness: 0.1, seed: 13, dust: false, bulgeFrac: 0.3 });
        lmc.position.set(9000, -6500, 12000); lmc.rotation.set(0.8, 0.3, 0.4); g.add(lmc);
        const smc = makeGalaxy({ count: 8000, radius: 260, arms: 1, pitch: 30, bar: 0.4, thickness: 0.2, seed: 14, dust: false, bulgeFrac: 0.4 });
        smc.position.set(11500, -8200, 13800); smc.rotation.set(0.3, 1.0, 0.2); g.add(smc);
        g.add(makeGalaxyField({ count: 260, rMin: 120000, rMax: 400000, sizeMin: 400, sizeMax: 2500, seed: 3 }));
        const sunMark = V(Math.cos(2.1) * 2600, 0, Math.sin(2.1) * 2600);
        const path = curve([[0, 700, 2300], [0, 2600, 4800], [1600, 7000, 10000], [3500, 12500, 17000], [5000, 17000, 24000]]);
        return {
          group: g, path, sunPos: V(0, 0, 0), sunColor: new THREE.Color(1, 0.9, 0.75),
          focus: () => V(0, 0, 0),
          cam: [{ u: 0, off: [1.6, 0.8, -6], look: 0.75, fov: 55 }, { u: 0.5, off: [2, 1.2, -6.5], look: 0.85 }, { u: 1, off: [1.4, 1.0, -6], look: 0.9, fov: 52 }],
          plume: () => ({ power: 0.6, len: 0.8 }),
          labels: [{ name: 'Galactic centre', sub: 'Sgr A*', pos: () => V(0, 0, 0) }, { name: 'You are here', sub: 'The Sun · Orion Spur', pos: () => sunMark, minU: 0.15 }, { name: 'Large Magellanic Cloud', sub: '160,000 ly', pos: () => lmc.position, minU: 0.45 }, { name: 'Small Magellanic Cloud', sub: '200,000 ly', pos: () => smc.position, minU: 0.55 }],
          update(dt) { mw.rotation.y += dt * 0.004; },
          noSkyTex: true,
        };
      },
    },
    // 14 --------------------------------------------------------------
    {
      title: 'Island Universes', kicker: 'The Local Group · Andromeda · Triangulum', dist: [180000 * KM_LY, 2.54e6 * KM_LY], dur: 26, warpIn: true,
      drive: 'Warp bubble (hypothetical)', stars: 0.1, sky: 0,
      facts: [
        'Andromeda (M31) is ~2.5 million ly away — the most distant object visible to the naked eye, holding ~1 trillion stars.',
        'It approaches us at ~110 km/s. In ~4.5 billion years the two galaxies will merge into one giant elliptical, “Milkomeda”.',
        'The Local Group contains 80+ galaxies, mostly dwarfs, bound together by gravity and dominated by dark matter.',
      ],
      build() {
        const g = new THREE.Group();
        const mw = makeGalaxy({ count: 90000, radius: 500, arms: 4, pitch: 12.5, bar: 0.4, thickness: 0.025, seed: 9 }); g.add(mw);
        const m31 = makeGalaxy({ count: 260000, radius: 1100, arms: 2, pitch: 9, bar: 0.1, thickness: 0.03, seed: 31, bulgeFrac: 0.25 });
        m31.position.set(0, 300, -25000); m31.rotation.set(1.25, 0.3, 0.2); g.add(m31);
        const m33 = makeGalaxy({ count: 50000, radius: 300, arms: 2, pitch: 22, bar: 0, thickness: 0.04, seed: 33, bulgeFrac: 0.08 });
        m33.position.set(6200, -2200, -21000); m33.rotation.set(0.9, 0.6, 0); g.add(m33);
        const m32 = shellPoints({ count: 6000, rMin: 0, rMax: 60, color: [0.06, 0.05, 0.035], size: 2.5, seed: 41, center: V(250, 420, -24600) }); g.add(m32);
        const m110 = shellPoints({ count: 9000, rMin: 0, rMax: 130, color: [0.05, 0.042, 0.03], size: 3, seed: 42, flatten: 0.55, center: V(-500, 100, -26200) }); g.add(m110);
        g.add(makeGalaxyField({ count: 350, rMin: 100000, rMax: 400000, sizeMin: 600, sizeMax: 3000, seed: 8 }));
        const path = curve([[700, 400, 1500], [1500, 700, -6000], [1900, 1200, -18000], [1500, 1300, -23200], [2400, 1900, -27000], [3800, 2800, -32000]]);
        return {
          group: g, path, sunPos: V(0, 0, 0), sunColor: new THREE.Color(1, 0.9, 0.8),
          focus: (u) => (u < 0.12 ? V(0, 0, 0) : m31.position),
          cam: [{ u: 0, off: [1.6, 0.8, -6], look: 0.8, fov: 52 }, { u: 0.2, off: [1.6, 0.8, 6], look: 0.6 }, { u: 0.75, off: [-1.6, 0.8, 5.5], look: 0.6 }, { u: 1, off: [1.4, 1, -6], look: 0.85 }],
          plume: () => ({ power: 0.6, len: 0.8 }),
          labels: [{ name: 'Milky Way', sub: '', pos: () => V(0, 0, 0), maxU: 0.3 }, { name: 'Andromeda · M31', sub: '2.54 million ly', pos: () => m31.position, minU: 0.1 }, { name: 'Triangulum · M33', sub: '2.73 million ly', pos: () => m33.position, minU: 0.3 }],
          update() {},
          noSkyTex: true,
        };
      },
    },
    // 15 --------------------------------------------------------------
    {
      title: 'The Cosmic Web', kicker: 'Superclusters · filaments · voids', dist: [2.54e6 * KM_LY, 1.4e9 * KM_LY], dur: 28, warpIn: true,
      drive: 'Beyond known physics', stars: 0, sky: 0,
      facts: [
        'Every point here is a whole galaxy. On the largest scales matter forms a web of filaments around vast, nearly empty voids.',
        'Our Local Group sits on the outskirts of the Virgo Cluster, part of the Laniakea Supercluster — ~520 million ly across, ~100,000 galaxies.',
        'The web grew from tiny quantum fluctuations amplified by inflation and pulled together by dark matter, ~85% of all matter.',
        'Beyond the Hubble sphere (~14 billion ly) space recedes faster than light. That breaks no law, because space itself is expanding.',
      ],
      build() {
        const g = new THREE.Group();
        const web = makeCosmicWeb({ nodes: 150, extent: 26000, count: 280000, seed: 11 });
        g.add(web);
        g.add(makeGalaxyField({ count: 300, rMin: 60000, rMax: 200000, sizeMin: 300, sizeMax: 1200, seed: 15 }));
        const N = web.userData.nodes, M = web.userData.mass;
        let big = 0; M.forEach((m, i) => { if (m > M[big]) big = i; });
        const path = curve([[-13000, -500, 13000], [-6000, 400, 6500], [-500, 900, 800], [N[big].x * 0.6, N[big].y * 0.6 + 300, N[big].z * 0.6], [7000, 1500, -7000], [14000, 2400, -14000]]);
        return {
          group: g, path, sunPos: V(0, 0, 0), sunColor: new THREE.Color(1, 1, 1),
          focus: () => N[big],
          cam: [{ u: 0, off: [2, 1, 7], look: 0.3, fov: 58 }, { u: 0.5, off: [-2.5, 1, 7], look: 0.4 }, { u: 1, off: [2, 1.2, 7], look: 0.3 }],
          plume: () => ({ power: 0.6, len: 0.8 }),
          labels: [{ name: 'Galaxy supercluster', sub: 'Thousands of galaxies', pos: () => N[big] }, { name: 'Laniakea', sub: '“Immeasurable heaven”', pos: () => V(-2000, 800, 1800), maxU: 0.35 }],
          update() {},
          noSkyTex: true, noStarfield: true,
        };
      },
    },
    // 16 --------------------------------------------------------------
    {
      title: 'The Edge of the Observable Universe', kicker: 'Cosmic Microwave Background · 380,000 years after the Big Bang', dist: [1.4e9 * KM_LY, 46.5e9 * KM_LY], dur: 34, warpIn: true, ease: 1.2, final: true,
      drive: 'Beyond known physics', stars: 0, sky: 0,
      facts: [
        'Light from the most distant galaxies left them over 13 billion years ago. You see them young, small and heavily redshifted.',
        'The CMB is the afterglow of the Big Bang, released when the universe cooled to ~3,000 K. Today it is 2.725 K, stretched by a factor of ~1,100.',
        'The universe is 13.8 billion years old, but expansion puts the edge of what we can see 46.5 billion ly away. That edge is the particle horizon.',
        'This is not a wall. Every observer sits at the centre of their own observable sphere, and the universe beyond may be infinite.',
      ],
      build() {
        const g = new THREE.Group();
        const cmb = makeCMB(60000); g.add(cmb);
        const web = makeCosmicWeb({ nodes: 220, extent: 90000, count: 260000, seed: 19 });
        web.children.forEach(c => { const col = c.geometry.attributes.color; for (let i = 0; i < col.count; i++) { col.setXYZ(i, col.getX(i) * 1.3, col.getY(i) * 0.7, col.getZ(i) * 0.45); } col.needsUpdate = true; });
        g.add(web);
        const r = rng(51);
        const quasars = []; for (let i = 0; i < 40; i++) { const m = makeGlare('#d8e6ff', 200 + r() * 500, 3 + r() * 3); const u = r() * 2 - 1, th = r() * 6.28, s = Math.sqrt(1 - u * u), rad = 20000 + r() * 34000; m.position.set(s * Math.cos(th) * rad, u * rad, s * Math.sin(th) * rad); g.add(m); quasars.push(m); }
        const path = curve([[0, 0, 0], [1500, 400, 16000], [3500, 800, 38000], [4600, 900, 52000], [5000, 950, 57500]]);
        return {
          group: g, path, sunPos: V(0, 0, 0), sunColor: new THREE.Color(1, 0.8, 0.6),
          focus: (u) => (u < 0.78 ? V(5000, 950, 60000) : V(0, 0, 0)),
          cam: [{ u: 0, off: [2, 1, 7], look: 0.3, fov: 58 }, { u: 0.45, off: [-2, 0.8, 6.5], look: 0.4 }, { u: 0.72, off: [1.5, 0.8, 6], look: 0.5 }, { u: 0.82, off: [3000, 1500, -6000], look: 1.0 }, { u: 1, off: [150000, 60000, -160000], look: 1.0, fov: 50 }],
          plume: () => ({ power: 0.7, len: 0.9 }),
          labels: [{ name: 'Surface of last scattering', sub: 'CMB · z ≈ 1,100', pos: () => V(5000, 950, 60000), minU: 0.35, maxU: 0.85 }, { name: 'Earth', sub: 'The centre of our observable universe', pos: () => V(0, 0, 0), minU: 0.88 }],
          update(dt, cam) {
            quasars.forEach(m => m.userData.update(cam));
            const inside = cam.position.length() < 60000;
            cmb.userData.u.opacity.value = inside ? 1 : 0.5;
            cmb.userData.u.inten.value = inside ? 0.1 + 0.32 * THREE.MathUtils.smoothstep(cam.position.length(), 15000, 56000) : 0.45;
            cmb.material.side = inside ? THREE.BackSide : THREE.FrontSide; cmb.renderOrder = inside ? -3 : 5;
          },
          noSkyTex: true, noStarfield: true,
        };
      },
    },
  ];
  // Insert NASA Exoplanet Archive systems in order of distance from Earth
  const X = buildExoChapters();
  const at = (title) => chapters.findIndex(c => c.title === title);
  chapters.splice(at('Our Nearest Stars') + 1, 0, X.epsEri);
  chapters.splice(at('Seven Worlds') + 1, 0, X.cnc, X.peg, X.hd189, X.toi700, X.k218, X.hr8799, X.k16, X.k186, X.kelt9);
  chapters.splice(at('Stellar Nursery') + 1, 0, X.wasp12, X.k452, X.psr);
  for (let i = at('Our Nearest Stars') + 1; i < chapters.length; i++) chapters[i].dist[0] = chapters[i - 1].dist[1];
  let t = 0;
  chapters.forEach((c, i) => { c.index = i; c.start = t; t += c.dur; });
  return { chapters, total: t };
}
