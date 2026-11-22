// Exoplanet chapters generated from NASA Exoplanet Archive parameters (js/nasa-data.js)
import * as THREE from 'three';
import { makePlanet, makeStar, makeGlare, makePointCloud, bbColor, rng, gauss } from './objects.js?v3';
import { NASA } from './nasa-data.js?v3';
import { LOGV_PARS, LOGV, LOGF_PARS, LOGF } from './shaders.js?v3';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const KM_LY = 9.4607e12;
const nf = (x, d = 0) => Number(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

function curve(pts) { return new THREE.CatmullRomCurve3(pts.map(p => (p.isVector3 ? p.clone() : V(...p))), false, 'centripetal'); }
function orbitLine(radius, color = 0x4d7fb3, opacity = 0.25, seg = 256) {
  const pts = [];
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)); }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
}
function ringCloud({ count, rMin, rMax, thick, color, size, seed = 4 }) {
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

// Map real orbits to scene units: close-in orbits are true to scale (in stellar radii), wide ones are compressed.
const squash = (k) => (k <= 10 ? k : 10 * Math.pow(k / 10, 0.5));
const planetR = (rade) => Math.max(2.5, 3.6 * (rade || 1));
const starR = (srad) => THREE.MathUtils.clamp(55 * (srad || 0.5), 16, 150);

function subFor(n) {
  const d = NASA[n]; if (!d) return '';
  const bits = [];
  if (d.rade) bits.push(`${nf(d.rade, d.rade < 10 ? 2 : 1)} R⊕`);
  if (d.eqt) bits.push(`${nf(d.eqt)} K`);
  if (d.per) bits.push(d.per > 3650 ? `${nf(d.per / 365.25)} yr` : `${nf(d.per, d.per < 10 ? 2 : 1)} d`);
  return bits.join(' · ');
}

// spec: { name, title, kicker, facts, dur, star:{temp,radius?,intensity,corona,coronaI,label,sub}, planets:[{n, proc, atmo, rim, rimStr, glow, ring, th, y, scale}], featured, extra(g, ctx) }
function systemChapter(spec) {
  return {
    title: spec.title, kicker: spec.kicker, dist: [0, spec.ly * KM_LY], dur: spec.dur || 21, warpIn: true,
    drive: 'Warp bubble (hypothetical)', stars: 1, sky: 0.3, nasa: true, flareGain: 0.55,
    facts: spec.facts,
    build() {
      const g = new THREE.Group();
      const host = NASA[spec.featured] || {};
      const T = spec.star.temp ?? host.teff ?? 5000;
      const Rs = spec.star.radius ?? starR(host.srad);
      const unit = spec.star.orbitUnit ?? Rs; // length of one stellar radius for orbit mapping
      const srad = spec.star.srad ?? host.srad ?? 1;
      const hotDim = T > 4500 ? 0.55 : 0.8;
      const star = spec.star.make ? spec.star.make(g) : makeStar({ radius: Rs, temp: T, intensity: (spec.star.intensity ?? 4) * hotDim, corona: spec.star.corona ?? 7, coronaI: (spec.star.coronaI ?? 1.4) * 0.6, seed: spec.star.seed ?? 3 });
      if (!spec.star.make) g.add(star);
      const col = spec.star.color ? new THREE.Color(spec.star.color) : bbColor(T);
      const ctx = { g, star, Rs, col, planets: [], unit };
      let prevD = Rs * 1.6, prevR = 0;
      const planets = spec.planets.map((pd, i) => {
        const d = NASA[pd.n] || {};
        const R = (pd.radius ?? planetR(d.rade));
        const k = (d.a ?? 0.05) * 215.032 / srad;
        let D = Math.max(squash(k) * unit, prevD + 3 * (R + prevR), Rs + R * 2.2);
        prevD = D; prevR = R;
        const p = makePlanet({ radius: R, proc: pd.proc, atmo: pd.atmo || null, rim: pd.rim || '#000', rimStr: pd.rimStr ?? 0, glow: pd.glow, ring: pd.ring, sunI: pd.sunI ?? 2.0, spin: pd.spin ?? 0.05, oblate: pd.oblate });
        const th = pd.th ?? (0.9 + i * 1.7);
        p.position.set(Math.cos(th) * D, pd.y ?? Math.sin(th * 3) * D * 0.01, Math.sin(th) * D);
        if (pd.stretch) { p.lookAt(0, 0, 0); p.scale.set(1 / Math.sqrt(pd.stretch), 1 / Math.sqrt(pd.stretch), pd.stretch); }
        p.userData.eqt = d.eqt || 0; p.userData.name = pd.short || pd.n;
        g.add(p); g.add(orbitLine(D, pd.orbitCol ?? 0x7fa8d8, 0.12));
        const o = { n: pd.n, short: pd.short || pd.n, p, D, R, th, sub: pd.sub ?? subFor(pd.n), featured: pd.n === spec.featured };
        ctx.planets.push(o);
        return o;
      });
      const upd = spec.extra ? spec.extra(g, ctx) : null;
      // ---------- path ----------
      const visit = [...planets].sort((a, b) => b.D - a.D).filter(o => o.featured || !spec.skipVisit?.includes(o.n));
      const vis = visit.length > 5 ? [visit.find(o => o.featured), ...visit.filter(o => !o.featured)].slice(0, 5).sort((a, b) => b.D - a.D) : visit;
      const Dmax = Math.max(...planets.map(o => o.D), Rs * 6);
      const a0 = (vis[0]?.th ?? 0) - 0.55;
      const pts = [V(Math.cos(a0) * Dmax * 1.5, Dmax * 0.1, Math.sin(a0) * Dmax * 1.5)];
      const stops = [];
      vis.forEach((o) => {
        const out = o.p.position.clone().setY(0).normalize();
        const tang = V(-out.z, 0, out.x);
        const s = o.featured ? 2.6 : 3.4;
        const w = o.p.position.clone().addScaledVector(tang, o.R * s).addScaledVector(out, -o.R * 0.6).add(V(0, o.R * (o.featured ? 0.8 : 1.2), 0));
        pts.push(w); stops.push({ pt: w, target: o.p.position });
      });
      const sa = (vis[vis.length - 1]?.th ?? 0) + 1.4;
      const sp = V(Math.cos(sa) * Rs * 2.6, Rs * 0.9, Math.sin(sa) * Rs * 2.6);
      pts.push(sp); stops.push({ pt: sp, target: V(0, 0, 0) });
      pts.push(V(Math.cos(sa + 0.8) * Dmax * 1.1, Dmax * 0.16, Math.sin(sa + 0.8) * Dmax * 1.1));
      const path = curve(pts);
      // u of each stop (closest sample)
      const N = 600, tmp = new THREE.Vector3();
      stops.forEach(st => { let best = 1e30, bu = 0; for (let i = 0; i <= N; i++) { path.getPointAt(i / N, tmp); const dd = tmp.distanceToSquared(st.pt); if (dd < best) { best = dd; bu = i / N; } } st.u = bu; });
      const sunPos = V(0, 0, 0);
      return {
        group: g, path, sunPos, sunColor: col, flareStar: star, stops,
        sunAt: spec.sunAt ? (p) => spec.sunAt(p, ctx) : null,
        focus: (u) => { for (const st of stops) if (u < st.u + 0.015) return st.target; return V(0, 0, 0); },
        cam: [{ u: 0, off: [1.6, 0.6, 5.5], look: 0.4, fov: 50 }, { u: 0.3, off: [-1.5, 0.6, 4.8], look: 0.45 }, { u: 0.62, off: [1.6, 0.8, 5], look: 0.5 }, { u: 1, off: [-1, 1, -6], look: 0.7 }],
        plume: () => ({ power: 0.6, len: 0.8 }),
        labels: [{ name: spec.star.label, sub: spec.star.sub, pos: () => star.position }, ...(ctx.extraLabels || []).map(l => ({ name: l.name, sub: l.sub, pos: () => l.obj.position })), ...planets.map(o => ({ name: o.short, sub: o.sub, pos: () => o.p.position }))],
        bodiesExtra: ctx.extraBodies || null,
        update(dt, cam) {
          if (star.userData.update) star.userData.update(cam);
          const sp2 = ctx.lightPos || sunPos;
          planets.forEach(o => o.p.userData.update(dt, sp2, col));
          upd && upd(dt, cam);
        },
      };
    },
  };
}

function trail(from, dir, len, n, color, size, spread, seed) {
  const r = rng(seed);
  const pos = new Float32Array(n * 3), cl = new Float32Array(n * 3), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = Math.pow(r(), 1.6);
    const sp = spread * (0.3 + t * 2.2);
    const p = from.clone().addScaledVector(dir, t * len).add(V(gauss(r) * sp, gauss(r) * sp, gauss(r) * sp));
    pos.set(p.toArray(), i * 3);
    const b = (1 - t) * (0.5 + r() * 0.5);
    cl.set([color[0] * b, color[1] * b, color[2] * b], i * 3);
    sz[i] = size * (0.6 + r());
  }
  return makePointCloud({ positions: pos, colors: cl, sizes: sz });
}

export function buildExoChapters() {
  const ch = {};
  ch.epsEri = systemChapter({
    featured: 'eps Eri b', ly: NASA['eps Eri b'].ly, title: 'The Nearby Giant', kicker: 'ε Eridani b · 10.4 light-years · NASA Exoplanet Archive',
    facts: [
      'ε Eridani is a young orange (K2V) star, only a few hundred million years old. That is roughly a tenth of the Sun’s age.',
      'Its giant planet ε Eridani b was found by radial velocity in 2000. It weighs about one Jupiter mass and orbits at 3.5 AU every 7.3 years.',
      'At ~112 K equilibrium temperature it is a cold Jupiter. The cold debris ring ~70 AU out is a young version of our Kuiper Belt.',
      'Values from the NASA Exoplanet Archive. Planet sizes are enlarged ~7× and wide orbits are compressed so everything fits in view.',
    ],
    star: { label: 'ε Eridani', sub: 'K2V · 5,020 K · 10.4 ly', intensity: 4, corona: 7, coronaI: 1.2, seed: 11 },
    planets: [{ n: 'eps Eri b', short: 'ε Eridani b', proc: { type: 6, c1: '#cbb894', c2: '#8a7762', c3: '#e6dcc6', seed: 3.1 }, atmo: { thick: 0.03, k: 1.6, mie: 0.5 }, rim: '#ffcf9a', rimStr: 0.2, th: 0.6 }],
    extra(g, ctx) {
      const Dring = squash(69 * 215 / 0.76) * ctx.unit;
      g.add(ringCloud({ count: 26000, rMin: Dring * 0.9, rMax: Dring * 1.1, thick: Dring * 0.02, color: [0.55, 0.5, 0.45], size: 30, seed: 41 }));
      g.add(ringCloud({ count: 9000, rMin: ctx.planets[0].D * 0.78, rMax: ctx.planets[0].D * 0.86, thick: 30, color: [0.5, 0.45, 0.4], size: 6, seed: 42 }));
      return null;
    },
  });
  ch.cnc = systemChapter({
    featured: '55 Cnc e', ly: NASA['55 Cnc e'].ly, title: 'The Lava World', kicker: '55 Cancri e · 41 light-years · five-planet system',
    facts: [
      '55 Cancri e is a super-Earth (1.9 R⊕, 8 M⊕) whipping around its Sun-like star every 17.7 hours, just 0.015 AU out.',
      'Its equilibrium temperature is ~1,960 K, hot enough to keep much of its surface as a global ocean of magma.',
      'In 2024 JWST found signs of a secondary atmosphere, likely CO₂ or CO, which may be outgassed from the magma.',
      'The system has five known planets, including the Jupiter-mass 55 Cancri d at 5.6 AU, plus a distant red-dwarf companion star.',
    ],
    star: { label: '55 Cancri A', sub: 'G8V · 5,172 K · 41 ly', intensity: 4, corona: 7, coronaI: 1.2, seed: 12 },
    planets: [
      { n: '55 Cnc e', short: '55 Cancri e', proc: { type: 5, c1: '#1e1612', c2: '#3a2418', seed: 1.7 }, rim: '#ff8a4a', rimStr: 0.35, glow: new THREE.Color(0.35, 0.07, 0.01), th: 0.4, atmo: { thick: 0.05, k: 0.8, mie: 1.2 } },
      { n: '55 Cnc b', short: '55 Cancri b', proc: { type: 6, c1: '#7a5a44', c2: '#4a3428', c3: '#a07a5a', seed: 2.2 }, th: 2.0 },
      { n: '55 Cnc c', short: '55 Cancri c', proc: { type: 6, c1: '#8a9aa8', c2: '#5a6a78', c3: '#b8c4cc', seed: 3.2 }, th: 3.6 },
      { n: '55 Cnc f', short: '55 Cancri f', proc: { type: 6, c1: '#b8a888', c2: '#7a6a58', c3: '#d8ccb0', seed: 4.2 }, th: 5.0 },
      { n: '55 Cnc d', short: '55 Cancri d', proc: { type: 6, c1: '#d2c4a8', c2: '#9a8468', c3: '#ece2cc', seed: 5.2 }, th: 0.9 },
    ],
  });
  ch.peg = systemChapter({
    featured: '51 Peg b', ly: NASA['51 Peg b'].ly, title: 'The First Hot Jupiter', kicker: '51 Pegasi b · 50 light-years · first planet found around a Sun-like star',
    facts: [
      'In 1995 Michel Mayor and Didier Queloz found 51 Pegasi b by the wobble of its star. The discovery won the 2019 Nobel Prize in Physics.',
      'It has about half Jupiter’s mass but circles its star in just 4.2 days, at 0.052 AU. That is far closer than Mercury is to the Sun.',
      'Nobody expected giant planets so close. Hot Jupiters forced astronomers to accept that planets migrate after they form.',
      'Equilibrium temperature ~1,330 K. 51 Peg b does not transit, so its radius here is a model estimate from the NASA archive.',
    ],
    star: { label: '51 Pegasi', sub: 'G5V · 5,761 K · 50 ly', intensity: 3.8, corona: 6, coronaI: 1.0, seed: 13 },
    planets: [{ n: '51 Peg b', short: '51 Pegasi b · Dimidium', proc: { type: 6, c1: '#5a3a2a', c2: '#2c1a12', c3: '#8a5a3a', seed: 6.6 }, rim: '#ff9a5a', rimStr: 0.25, glow: new THREE.Color(0.06, 0.012, 0.003), atmo: { thick: 0.03, k: 1.2, mie: 0.8 }, th: 0.8 }],
  });
  ch.hd189 = systemChapter({
    featured: 'HD 189733 b', ly: NASA['HD 189733 b'].ly, title: 'The Blue Glass Planet', kicker: 'HD 189733 b · 64.5 light-years · deep-blue hot Jupiter',
    facts: [
      'In 2013 Hubble measured the colour of HD 189733 b: a deep cobalt blue, likely from silicate particles high in its atmosphere.',
      'Those particles may fall as molten glass, driven sideways by winds of roughly 2 km/s (about 8,700 km/h).',
      'It orbits a K dwarf every 2.2 days. It is 1.1 times Jupiter’s mass and radius, with an equilibrium temperature of ~1,210 K.',
      'In 2024 JWST detected hydrogen sulfide in its air. The planet would smell of rotten eggs.',
    ],
    star: { label: 'HD 189733', sub: 'K2V · 5,052 K · 64.5 ly', intensity: 4, corona: 7, coronaI: 1.2, seed: 14 },
    planets: [{ n: 'HD 189733 b', short: 'HD 189733 b', proc: { type: 6, c1: '#1f4fa8', c2: '#0e2660', c3: '#4a7fd8', seed: 7.1 }, atmo: { thick: 0.05, k: 3.2, mie: 0.5 }, rim: '#6aa0ff', rimStr: 0.5, th: 0.7 }],
  });
  ch.toi700 = systemChapter({
    featured: 'TOI-700 d', ly: NASA['TOI-700 d'].ly, title: 'Earth-Size, Just Right', kicker: 'TOI-700 d & e · 101.5 light-years · TESS discoveries',
    facts: [
      'In 2020 TESS found TOI-700 d, its first Earth-size planet in a star’s habitable zone. It is 1.15 times Earth’s radius and has a 37-day year.',
      'In 2023 a second habitable-zone world joined it: TOI-700 e, at 0.92 R⊕ and 27.8 days.',
      'The host is a quiet M2.5 red dwarf (3,459 K). Its planets are probably tidally locked, with permanent day and night sides.',
      'Equilibrium temperature of TOI-700 d is ~269 K. With a warming atmosphere, liquid water is possible on its day side.',
    ],
    star: { label: 'TOI-700', sub: 'M2.5V · 3,459 K · 101.5 ly', intensity: 4.5, corona: 9, coronaI: 2.0, seed: 15 },
    planets: [
      { n: 'TOI-700 b', short: 'TOI-700 b', proc: { type: 1, c1: '#6e5a4c', c2: '#3e3028', c3: '#8e7a66', seed: 1.4 }, th: 1.5 },
      { n: 'TOI-700 c', short: 'TOI-700 c', proc: { type: 6, c1: '#9aa6b0', c2: '#6a7680', c3: '#c0cad2', seed: 2.4 }, th: 3.0 },
      { n: 'TOI-700 e', short: 'TOI-700 e', proc: { type: 3, c1: '#1c4a6e', c2: '#5e4a3a', c3: '#7a6a58', seed: 3.4 }, atmo: { thick: 0.06, k: 2.2, mie: 0.8 }, rim: '#ffb080', rimStr: 0.2, sub: '0.92 R⊕ · habitable zone', th: 4.6 },
      { n: 'TOI-700 d', short: 'TOI-700 d', proc: { type: 3, c1: '#1b4d7a', c2: '#56683c', c3: '#8d7b5c', seed: 4.4 }, atmo: { thick: 0.07, k: 2.4, mie: 0.8 }, rim: '#ffb080', rimStr: 0.25, sub: '1.15 R⊕ · habitable zone', th: 0.5 },
    ],
  });
  ch.k218 = systemChapter({
    featured: 'K2-18 b', ly: NASA['K2-18 b'].ly, title: 'A Hycean Candidate', kicker: 'K2-18 b · 124 light-years · habitable-zone sub-Neptune',
    facts: [
      'K2-18 b is 2.4 times Earth’s size and 8.9 times its mass. It orbits a red dwarf every 33 days, inside the habitable zone.',
      'Hubble found water vapour in 2019. JWST later detected methane and carbon dioxide.',
      'One idea is a “hycean” world: a global ocean under a hydrogen-rich sky. Others argue it is a gas-rich mini-Neptune or has a magma ocean.',
      'A claimed hint of dimethyl sulfide, a possible biosignature, is still contested and unconfirmed.',
    ],
    star: { label: 'K2-18', sub: 'M2.5V · 3,457 K · 124 ly', intensity: 4.5, corona: 9, coronaI: 2.0, seed: 16 },
    planets: [
      { n: 'K2-18 c', short: 'K2-18 c', proc: { type: 6, c1: '#9a9488', c2: '#6a645a', c3: '#c0b8aa', seed: 1.9 }, th: 2.6 },
      { n: 'K2-18 b', short: 'K2-18 b', proc: { type: 6, c1: '#3a7a9a', c2: '#1e4a66', c3: '#7ab0c4', seed: 8.2 }, atmo: { thick: 0.09, k: 3.0, mie: 0.9 }, rim: '#8ad0ff', rimStr: 0.35, th: 0.6 },
    ],
  });
  ch.hr8799 = systemChapter({
    featured: 'HR 8799 e', ly: NASA['HR 8799 b'].ly, title: 'Four Young Giants', kicker: 'HR 8799 b, c, d, e · 134.5 light-years · directly imaged',
    facts: [
      'HR 8799 was the first star with several planets photographed directly: b, c and d in 2008 (Keck and Gemini), then e in 2010.',
      'The four giants are roughly 5–10 Jupiter masses and orbit 16–68 AU from a young A5 star.',
      'At only ~30–40 million years old, they still glow at ~1,000–1,200 K from the heat of their own formation, not from starlight.',
      'The outermost, HR 8799 b, takes about 460 years to orbit once. Wide orbits are compressed here.',
    ],
    star: { label: 'HR 8799', sub: 'A5V · 7,200 K · 134.5 ly', intensity: 3.6, corona: 6, coronaI: 1.0, seed: 17 },
    skipVisit: [],
    planets: ['HR 8799 e', 'HR 8799 d', 'HR 8799 c', 'HR 8799 b'].map((n, i) => ({
      n, short: n, proc: { type: 6, c1: ['#7a3420', '#6a2e1c', '#7e3a22', '#6e2a18'][i], c2: '#2a0e08', c3: '#b0582e', seed: 2 + i },
      glow: new THREE.Color(0.32, 0.07, 0.015), rim: '#ff6a3a', rimStr: 0.4, th: 0.5 + i * 1.6,
    })),
    extra(g, ctx) {
      const D = ctx.planets[3].D;
      g.add(ringCloud({ count: 22000, rMin: D * 1.35, rMax: D * 1.8, thick: D * 0.03, color: [0.5, 0.45, 0.42], size: 50, seed: 44 }));
      return null;
    },
  });
  ch.k16 = systemChapter({
    featured: 'Kepler-16 b', ly: NASA['Kepler-16 b'].ly, title: 'Two Suns', kicker: 'Kepler-16 b · 245 light-years · a real Tatooine',
    facts: [
      'Kepler-16 b was the first planet confirmed to transit two stars at once (2011): a circumbinary world.',
      'Its stars, an orange K dwarf and a red M dwarf, orbit each other every 41 days. The planet circles both every 229 days.',
      'It is Saturn-sized (8.4 R⊕) and about a third of Jupiter’s mass. At ~206 K it is a cold gas giant with double sunsets.',
      'Stellar and orbital values are from the NASA Exoplanet Archive. The binary’s separation is compressed.',
    ],
    star: { label: 'Kepler-16 A', sub: 'K dwarf · 4,450 K', intensity: 4.2, corona: 8, coronaI: 1.6, seed: 18, srad: 0.649 },
    planets: [{ n: 'Kepler-16 b', short: 'Kepler-16 b', proc: { type: 6, c1: '#b8ab8e', c2: '#7c705c', c3: '#d4caB4', seed: 4.6 }, atmo: { thick: 0.03, k: 1.4, mie: 0.6 }, rim: '#ffc890', rimStr: 0.2, th: 0.6 }],
    extra(g, ctx) {
      const sep = squash(0.224 * 215 / 0.649) * ctx.unit;
      const B = makeStar({ radius: ctx.Rs * 0.35, temp: 3300, intensity: 4.6, corona: 9, coronaI: 2.0, seed: 19 });
      g.add(B);
      const bar = 0.2 / 0.89; // barycentre offset (mass ratio 0.20 : 0.69)
      let ph = 2.4;
      const place = () => { ctx.star.position.set(Math.cos(ph) * sep * bar, 0, Math.sin(ph) * sep * bar); B.position.set(-Math.cos(ph) * sep * (1 - bar), 0, -Math.sin(ph) * sep * (1 - bar)); };
      place();
      g.add(orbitLine(sep * (1 - bar), 0xff8a5a, 0.1));
      ctx.lightPos = ctx.star.position;
      ctx.extraLabels = [{ name: 'Kepler-16 B', sub: 'M dwarf · ~3,300 K', obj: B }];
      return (dt, cam) => { ph += dt * 0.06; place(); B.userData.update(cam); };
    },
  });
  ch.k186 = systemChapter({
    featured: 'Kepler-186 f', ly: NASA['Kepler-186 f'].ly, title: 'Earth-Size in the Habitable Zone', kicker: 'Kepler-186 f · 579 light-years · Kepler mission',
    facts: [
      'Announced in 2014, Kepler-186 f was the first Earth-size planet found in the habitable zone of another star.',
      'At 1.17 R⊕ it orbits an M1 red dwarf every 130 days and receives about a third of the energy Earth gets from the Sun.',
      'Four inner siblings (b–e) orbit within 0.11 AU, too hot for liquid water.',
      'Its equilibrium temperature is ~177 K. With a thick CO₂ atmosphere it might still keep liquid water, so here it has seas and red-lit land.',
    ],
    star: { label: 'Kepler-186', sub: 'M1V · 3,755 K · 579 ly', intensity: 4.4, corona: 9, coronaI: 1.9, seed: 20 },
    planets: [
      ...['b', 'c', 'd', 'e'].map((x, i) => ({ n: 'Kepler-186 ' + x, short: 'Kepler-186 ' + x, proc: { type: i < 2 ? 5 : 1, c1: '#4a3a30', c2: '#2a2018', c3: '#6a5646', seed: 1 + i }, glow: i < 2 ? new THREE.Color(0.03, 0.006, 0.001) : undefined, th: 1.4 + i * 1.3 })),
      { n: 'Kepler-186 f', short: 'Kepler-186 f', proc: { type: 2, c1: '#1e4a6a', c2: '#6a4a30', c3: '#8a6a4a', seed: 6.3 }, atmo: { thick: 0.07, k: 2.4, mie: 0.8 }, rim: '#ffa070', rimStr: 0.25, sub: '1.17 R⊕ · habitable zone', th: 0.5 },
    ],
  });
  ch.kelt9 = systemChapter({
    featured: 'KELT-9 b', ly: NASA['KELT-9 b'].ly, title: 'Hotter Than Most Stars', kicker: 'KELT-9 b · 667 light-years · the hottest known giant planet',
    facts: [
      'KELT-9 b orbits a blue-white A-type star (9,270 K) every 1.5 days. Its dayside reaches ~4,600 K, hotter than most stars.',
      'At that heat, molecules are torn into atoms. Iron and titanium vapour have been detected in its atmosphere.',
      'The planet is nearly twice Jupiter’s radius and ~2.9 Jupiter masses. Its puffed-up atmosphere bleeds into space as a glowing tail.',
      'Its orbit is nearly polar: it passes over the star’s poles rather than around its equator.',
    ],
    star: { label: 'KELT-9', sub: 'A-type · 9,270 K · 667 ly', intensity: 3.2, corona: 5, coronaI: 0.8, seed: 21 },
    planets: [{ n: 'KELT-9 b', short: 'KELT-9 b', proc: { type: 6, c1: '#e0904a', c2: '#a04a1e', c3: '#ffc070', seed: 9.9 }, glow: new THREE.Color(1.1, 0.42, 0.12), rim: '#ffd0a0', rimStr: 0.6, atmo: { thick: 0.08, k: 1.0, mie: 1.4 }, th: 0.7, y: 0 }],
    extra(g, ctx) {
      const o = ctx.planets[0]; const dir = o.p.position.clone().normalize();
      const tl = trail(o.p.position.clone().addScaledVector(dir, o.R * 0.9), dir.clone().add(V(-dir.z, 0, dir.x).multiplyScalar(-0.5)).normalize(), o.R * 9, 9000, [0.7, 0.35, 0.18], o.R * 0.1, o.R * 0.25, 61);
      tl.material.uniforms.nearFade.value = o.R * 1.5;
      g.add(tl); return null;
    },
  });
  ch.wasp12 = systemChapter({
    featured: 'WASP-12 b', ly: NASA['WASP-12 b'].ly, title: 'The Doomed Planet', kicker: 'WASP-12 b · 1,393 light-years · spiralling into its star',
    facts: [
      'WASP-12 b circles its star in 26 hours at just 0.023 AU. Tides stretch it into an egg shape (exaggerated here).',
      'Its orbit is shrinking, with the period falling ~29 ms per year. In ~3 million years it should fall into its star.',
      'It has 1.5 Jupiter masses inflated to ~2 Jupiter radii. Gas is stripped from its upper atmosphere and streams onto the star.',
      'Hubble found it reflects only ~6% of light, making it one of the darkest planets known. Equilibrium temperature: ~2,600 K.',
    ],
    star: { label: 'WASP-12', sub: 'F-type · 6,265 K · 1,393 ly', intensity: 3.8, corona: 6, coronaI: 1.0, seed: 22 },
    planets: [{ n: 'WASP-12 b', short: 'WASP-12 b', proc: { type: 6, c1: '#2a1c18', c2: '#140c0a', c3: '#4a2a1e', seed: 3.9 }, glow: new THREE.Color(0.5, 0.12, 0.03), rim: '#ff7a3a', rimStr: 0.5, stretch: 1.22, th: 0.7, y: 0 }],
    extra(g, ctx) {
      const o = ctx.planets[0]; const r = rng(77); const n = 12000;
      const pos = new Float32Array(n * 3), cl = new Float32Array(n * 3), sz = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = r(); const rad = THREE.MathUtils.lerp(o.D - o.R * 0.8, ctx.Rs * 1.02, t); const a = o.th + t * 1.6 + gauss(r) * 0.03;
        pos.set([Math.cos(a) * rad + gauss(r) * 4, gauss(r) * (6 + t * 10), Math.sin(a) * rad + gauss(r) * 4], i * 3);
        const b = (0.4 + 0.6 * r()) * 0.35; cl.set([1.4 * b, 0.6 * b, 0.3 * b], i * 3); sz[i] = 1.2 + r() * 2;
      }
      g.add(makePointCloud({ positions: pos, colors: cl, sizes: sz, nearFade: o.R * 1.5 }));
      return null;
    },
  });
  ch.k452 = systemChapter({
    featured: 'Kepler-452 b', ly: NASA['Kepler-452 b'].ly, title: 'Earth’s Older Cousin', kicker: 'Kepler-452 b · 1,800 light-years · around a Sun-like star',
    facts: [
      'Kepler-452 b (1.6 R⊕) orbits a G2 star almost identical to the Sun once every 385 days, at 1.05 AU.',
      'Its star is ~6 billion years old, about 1.5 billion years older than the Sun, and slightly brighter.',
      'Equilibrium temperature ~265 K, close to Earth’s ~255 K. It may be rocky, but its mass is unmeasured.',
      'A 2018 re-analysis found the Kepler signal is not certain. It stays in NASA’s archive as a planet pending further confirmation.',
    ],
    star: { label: 'Kepler-452', sub: 'G2 · 5,757 K · 1,800 ly', intensity: 3.8, corona: 6, coronaI: 1.0, seed: 23 },
    planets: [{ n: 'Kepler-452 b', short: 'Kepler-452 b', proc: { type: 2, c1: '#1a4870', c2: '#4e6a38', c3: '#9a8a6a', seed: 5.8 }, atmo: { thick: 0.05, k: 4, mie: 0.6 }, rim: '#8ab8ff', rimStr: 0.3, th: 0.6 }],
  });
  ch.psr = systemChapter({
    featured: 'PSR B1257+12 c', ly: NASA['PSR B1257+12 c'].ly, title: 'The First Exoplanets', kicker: 'PSR B1257+12 · 1,957 light-years · planets around a dead star',
    facts: [
      'In 1992 Aleksander Wolszczan and Dale Frail found the first confirmed exoplanets, using the Arecibo radio telescope. They orbit a pulsar.',
      'The pulsar is a city-sized neutron star spinning 161 times a second. Its radio beams sweep space like a lighthouse.',
      'The three planets were found by tiny shifts in the pulse timing. Draugr (b) is twice the Moon’s mass; Poltergeist (c) and Phobetor (d) are ~4 Earth masses.',
      'They are bathed in the pulsar’s wind of high-energy particles and radiation. These are hostile worlds, probably formed from the debris of a supernova.',
    ],
    star: {
      label: 'PSR B1257+12 · Lich', sub: 'Millisecond pulsar · 6.2 ms spin', radius: 3, orbitUnit: 30, srad: 1, color: '#b8ccff',
      make(g) {
        const grp = new THREE.Group();
        const s = makeStar({ radius: 3, temp: 30000, intensity: 6, corona: 14, coronaI: 3, seed: 30 }); grp.add(s);
        const gl = makeGlare('#a8c4ff', 160, 4); grp.add(gl);
        const beamMat = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: LOGV_PARS + `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); ${LOGV} }`,
          fragmentShader: LOGF_PARS + `varying vec2 vUv; void main(){ ${LOGF} float a=pow(vUv.y,2.2)*0.9; gl_FragColor=vec4(vec3(0.45,0.6,1.2)*a*0.6,1.0); }`,
        });
        const axis = new THREE.Group(); axis.rotation.z = 0.5; grp.add(axis);
        const rot = new THREE.Group(); axis.add(rot);
        [1, -1].forEach(sgn => { const cone = new THREE.Mesh(new THREE.ConeGeometry(70, 1400, 32, 1, true), beamMat); cone.position.set(0, 0, sgn * 700); cone.rotation.x = sgn > 0 ? -Math.PI / 2 : Math.PI / 2; const tiltG = new THREE.Group(); tiltG.rotation.y = 0; tiltG.add(cone); tiltG.rotation.x = 0.0; rot.add(tiltG); });
        rot.rotation.x = 0.9;
        g.add(grp);
        grp.userData = { R: 3, color: new THREE.Color('#b8ccff'), pulsar: true, update: (cam) => { s.userData.update(cam); gl.userData.update(cam); axis.rotation.y += 0.035; } };
        return grp;
      },
    },
    planets: [
      { n: 'PSR B1257+12 b', short: 'Draugr (b)', proc: { type: 1, c1: '#5a5a62', c2: '#2a2a30', c3: '#7a7a86', seed: 1.1 }, rim: '#8aa8ff', rimStr: 0.2, sunI: 1.0, th: 2.0 },
      { n: 'PSR B1257+12 c', short: 'Poltergeist (c)', proc: { type: 1, c1: '#4a4650', c2: '#24222a', c3: '#6e6a78', seed: 2.1 }, rim: '#8aa8ff', rimStr: 0.35, sunI: 1.0, th: 0.6 },
      { n: 'PSR B1257+12 d', short: 'Phobetor (d)', proc: { type: 4, c1: '#5a6070', c2: '#30343e', c3: '#8088a0', seed: 3.1 }, rim: '#8aa8ff', rimStr: 0.35, sunI: 1.0, th: 4.2 },
    ],
  });
  return ch;
}
