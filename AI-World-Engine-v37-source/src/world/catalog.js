import * as THREE from 'three';
import { hashString, rng, safeColor, toColors, clamp } from '../core/utils.js';

// Linear-space color helper for scattering coefficients.
const lin = (r, g, b) => new THREE.Color(r, g, b);

// Reference visuals for real bodies. Layout (radius/distance) still comes from the AI or presets,
// but appearance is anchored to observational data so the result reads as "real".
export const KNOWN_BODIES = {
  sun:      { kind: 'star', temperature: 5772 },
  mercury:  { kind: 'planet', surface: 'barren', palette: ['#3d3a37', '#55504b', '#8a847c', '#a59d93', '#c9c1b6'] },
  venus:    { kind: 'planet', surface: 'cloudy', palette: ['#7a5a30', '#c9a66b', '#e3c891', '#f0dcae', '#fff1d0'], atmosphere: { color: lin(1.0, 0.8, 0.45), density: 1.3, mie: 0.8, thickness: 0.06 } },
  earth:    { kind: 'planet', surface: 'terran', palette: ['#020c24', '#0a4566', '#1d3a10', '#5b4a35', '#eef2f6'], seaLevel: 0.05, clouds: { cover: 0.4, speed: 0.01 }, cityLights: true, atmosphere: { color: lin(0.175, 0.41, 1.0), density: 1.0, mie: 0.3, thickness: 0.035 }, tilt: 0.41 },
  moon:     { kind: 'planet', surface: 'barren', palette: ['#3a3a3c', '#505052', '#8e8c88', '#a8a6a1', '#cfccc6'] },
  mars:     { kind: 'planet', surface: 'desert', palette: ['#3d2015', '#2a1912', '#b4542a', '#d58d5c', '#e6c3a0'], atmosphere: { color: lin(1.0, 0.62, 0.38), density: 0.35, mie: 1.0, thickness: 0.03 }, tilt: 0.44 },
  phobos:   { kind: 'asteroid', color: '#5a5048' },
  deimos:   { kind: 'asteroid', color: '#6a6058' },
  ceres:    { kind: 'planet', surface: 'barren', palette: ['#3b3a38', '#4a4846', '#77736d', '#8e8a83', '#b0aca5'] },
  jupiter:  { kind: 'gas_giant', palette: ['#c9b79c', '#8c6a4f', '#ece0c8', '#a0522d', '#6b5a4a'], bands: 22, storm: true, stormColor: '#b04a2a', contrast: 1.0, atmosphere: { color: lin(0.8, 0.75, 0.65), density: 0.5 }, tilt: 0.05 },
  io:       { kind: 'planet', surface: 'desert', palette: ['#6b5a1e', '#3d2e12', '#d9c75a', '#e8d98a', '#f2eab0'] },
  europa:   { kind: 'planet', surface: 'ice', palette: ['#8a6a4a', '#8e5a38', '#c9b8a0', '#e8e2d6', '#f5f2ec'] },
  ganymede: { kind: 'planet', surface: 'barren', palette: ['#4a4038', '#5c5248', '#8a7e70', '#a89c8c', '#c8bcae'] },
  callisto: { kind: 'planet', surface: 'barren', palette: ['#2e2924', '#3d362f', '#6b6056', '#857a6e', '#a3998c'] },
  saturn:   { kind: 'gas_giant', palette: ['#d8c59a', '#bfa472', '#ede0bd', '#a68a5a', '#8a7a5a'], bands: 28, storm: false, contrast: 0.5, rings: { inner: 1.24, outer: 2.27, colorA: '#dccaa6', colorB: '#8f8170' }, atmosphere: { color: lin(0.9, 0.8, 0.6), density: 0.45 }, tilt: 0.47, oblateness: 0.9 },
  titan:    { kind: 'planet', surface: 'cloudy', palette: ['#5a3a12', '#a0702a', '#c08a3a', '#d9a050', '#e8b870'], atmosphere: { color: lin(1.0, 0.6, 0.25), density: 1.6, mie: 1.2, thickness: 0.12 } },
  enceladus:{ kind: 'planet', surface: 'ice', palette: ['#b9c6cf', '#9fb3c2', '#e6eef3', '#f4f8fa', '#ffffff'] },
  uranus:   { kind: 'gas_giant', palette: ['#9fd6dc', '#88c8d0', '#b5e4e8', '#7fbcc6', '#a8dce2'], bands: 10, storm: false, contrast: 0.15, rings: { inner: 1.6, outer: 2.0, colorA: '#4a5560', colorB: '#2a3036', opacity: 0.35 }, atmosphere: { color: lin(0.4, 0.8, 0.9), density: 0.7 }, tilt: 1.71 },
  neptune:  { kind: 'gas_giant', palette: ['#2f56c9', '#2445a8', '#4f74e0', '#1d3a8a', '#6d8ff0'], bands: 14, storm: true, stormColor: '#14234f', contrast: 0.5, atmosphere: { color: lin(0.25, 0.45, 1.0), density: 0.8 }, tilt: 0.49 },
  triton:   { kind: 'planet', surface: 'ice', palette: ['#8a6a5a', '#9a7a6a', '#d2c4b8', '#e9e0d8', '#f6f0ea'] },
  pluto:    { kind: 'planet', surface: 'ice', palette: ['#5e3420', '#8a5a3a', '#c9a585', '#e8d8c4', '#f3ebe0'], atmosphere: { color: lin(0.4, 0.6, 1.0), density: 0.15, thickness: 0.03 } },
  charon:   { kind: 'planet', surface: 'barren', palette: ['#3a3432', '#4d4542', '#7d7470', '#968d88', '#b5aca6'] },
  'milky way': { kind: 'spiral_galaxy', color: '#7fa8ff', arms: 4, twist: 3.2 },
  andromeda: { kind: 'spiral_galaxy', color: '#9ab8ff', arms: 2, twist: 3.6, inclination: 1.2 },
  'sagittarius a': { kind: 'black_hole' },
  'm87': { kind: 'black_hole' },
  'orion nebula': { kind: 'nebula', palette: ['#4fd1c5', '#e0457b', '#ff9a6b', '#3a1f5d'] },
  'carina nebula': { kind: 'nebula', palette: ['#5ad2ff', '#ff6a3d', '#ffc48a', '#2a1a40'] },
  'pillars of creation': { kind: 'nebula', palette: ['#6be0d0', '#d65a3a', '#e8a86a', '#2a1c14'] },
  'eagle nebula': { kind: 'nebula', palette: ['#6be0d0', '#d65a3a', '#e8a86a', '#2a1c14'] },
  'crab nebula': { kind: 'nebula', palette: ['#6ad1ff', '#ff5a3a', '#ffd27a', '#202a5a'] },
  'asteroid belt': { kind: 'asteroid_belt', color: '#7a6e62' },
  'kuiper belt': { kind: 'asteroid_belt', color: '#9aa4b0' },
  halley: { kind: 'comet', color: '#3a3430' },
};

const TYPE_ALIASES = {
  star: 'star', sun: 'star', red_dwarf: 'star', white_dwarf: 'star', neutron_star: 'star', pulsar: 'star',
  gas_giant: 'gas_giant', ice_giant: 'gas_giant', jovian: 'gas_giant',
  terrestrial: 'terran', ocean_world: 'terran', terran: 'terran', earthlike: 'terran', earth_like: 'terran', super_earth: 'terran',
  desert: 'desert', barren: 'barren', rocky: 'barren', moon: 'barren', dwarf_planet: 'ice', ice: 'ice', icy: 'ice',
  lava: 'lava', volcanic: 'lava', cloudy: 'cloudy', venus_like: 'cloudy',
  asteroid: 'asteroid', irregular_body: 'asteroid', icosahedron: 'asteroid',
  asteroid_belt: 'asteroid_belt', belt: 'asteroid_belt', debris_disk: 'asteroid_belt', oort_cloud: 'asteroid_belt',
  comet: 'comet', ring: 'ring', planetary_ring: 'ring', disk: 'ring',
  spiral_galaxy: 'spiral_galaxy', galaxy: 'spiral_galaxy',
  nebula: 'nebula', supernova_shell: 'nebula', shell: 'nebula', cloud: 'nebula',
  black_hole: 'black_hole', accretion_disk: 'black_hole', quasar: 'black_hole',
  wormhole: 'wormhole', einstein_rosen_bridge: 'wormhole', traversable_wormhole: 'wormhole',
  white_hole: 'white_hole',
  cosmic_string: 'cosmic_string', string: 'cosmic_string',
  brane_worlds: 'brane_worlds', brane: 'brane_worlds', brane_world: 'brane_worlds', branes: 'brane_worlds', bulk: 'brane_worlds',
  dyson_swarm: 'dyson_swarm', dyson_sphere: 'dyson_swarm', megastructure: 'dyson_swarm',
  warp_bubble: 'warp_bubble', alcubierre: 'warp_bubble', warp_drive: 'warp_bubble',
  quark_star: 'quark_star', strange_star: 'quark_star',
  multiverse: 'multiverse', bubble_universe: 'multiverse', bubble_universes: 'multiverse', parallel_universe: 'multiverse', eternal_inflation: 'multiverse',
};

const PLANET_SURFACES = new Set(['terran', 'desert', 'barren', 'ice', 'lava', 'cloudy']);

function lookupKnown(name) {
  const n = (name || '').toLowerCase();
  if (KNOWN_BODIES[n]) return { key: n, ...KNOWN_BODIES[n] };
  // Match whole words, longest keys first (avoid "sun" in "sunset", "io" in "orion")
  const keys = Object.keys(KNOWN_BODIES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const re = new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
    if (re.test(n)) return { key: k, ...KNOWN_BODIES[k] };
  }
  return null;
}

function inferType(obj) {
  const t = (obj.bodyType || obj.type || '').toLowerCase().replace(/[\s-]/g, '_');
  if (TYPE_ALIASES[t]) return TYPE_ALIASES[t];
  const g = (obj.geometryType || '').toLowerCase();
  const text = `${obj.name || ''} ${obj.prompt || ''} ${obj.colorDescription || ''}`.toLowerCase();
  if (/white hole/.test(text)) return 'white_hole';
  if (/cosmic string/.test(text)) return 'cosmic_string';
  if (/brane/.test(text)) return 'brane_worlds';
  if (/dyson/.test(text)) return 'dyson_swarm';
  if (/warp|alcubierre/.test(text)) return 'warp_bubble';
  if (/quark star|strange star/.test(text)) return 'quark_star';
  if (/wormhole|einstein.rosen/.test(text)) return 'wormhole';
  if (/multiverse|bubble universe|parallel universe|eternal inflation/.test(text)) return 'multiverse';
  if (/black hole|event horizon|sagittarius a|quasar/.test(text)) return 'black_hole';
  if (/galaxy|milky way|andromeda/.test(text) || g === 'spiral_galaxy') return 'spiral_galaxy';
  if (/nebula|supernova remnant|ionized gas|pillars/.test(text)) return 'nebula';
  if (/asteroid belt|kuiper|oort|debris/.test(text)) return 'asteroid_belt';
  if (/comet/.test(text)) return 'comet';
  if (['ring', 'disk', 'planetary_ring'].includes(g) || /\bring(s)?\b/.test(obj.name?.toLowerCase() || '')) return 'ring';
  if (obj.emissive || /\bstar\b|dwarf star|\bsun\b|stellar surface|photosphere/.test(text)) return 'star';
  if (/gas giant|ice giant|jovian|banded/.test(text)) return 'gas_giant';
  if (['asteroid', 'icosahedron', 'irregular_body', 'comet'].includes(g)) return 'asteroid';
  if (/lava|volcan|molten/.test(text)) return 'lava';
  if (/ice|frozen|glacier|icy/.test(text)) return 'ice';
  if (/desert|dust|sand|rust|iron oxide/.test(text)) return 'desert';
  if (/ocean|forest|continent|habitable|vegetation/.test(text)) return 'terran';
  if (/cloud|haze|sulfuric/.test(text)) return 'cloudy';
  return 'barren';
}

const vec3 = (a, d = [0, 0, 0]) => (Array.isArray(a) && a.length >= 3 && a.every((x) => Number.isFinite(+x)) ? a.map(Number) : d);

// Convert one AI/preset object description into a fully specified render spec.
export function normalizeBody(obj, index = 0) {
  const name = String(obj.name || `Object ${index + 1}`).slice(0, 80);
  const seed = hashString(name + index);
  const rand = rng(seed);
  const known = lookupKnown(name);
  let type = known ? (known.kind === 'planet' ? known.surface : known.kind) : inferType(obj);

  const radiusRaw = +obj.radius || +(obj.geometryArgs?.[0]) || 2;
  const spec = {
    name,
    seed,
    type,
    radius: clamp(radiusRaw, 0.12, 400),
    distance: Math.max(0, +obj.distance || 0),
    orbitalSpeed: +obj.orbitalSpeed || 0,
    position: vec3(obj.position),
    parent: obj.parent || null,
    spin: Number.isFinite(+obj.spinSpeed) ? +obj.spinSpeed : Number.isFinite(+obj.animationSpeed) ? clamp(+obj.animationSpeed, 0, 0.6) : 0.06,
    tilt: Number.isFinite(+obj.axialTilt) ? THREE.MathUtils.degToRad(+obj.axialTilt) : known?.tilt ?? (rand() - 0.5) * 0.5,
    color: safeColor(known?.color || obj.color, '#8fa3b8'),
    prompt: obj.prompt || '',
    colorDescription: obj.colorDescription || '',
    description: obj.description || '',
    raw: obj,
  };

  const paletteSource = known?.palette || obj.palette;
  spec.palette = toColors(paletteSource, spec.color, rand);

  if (type === 'star') {
    spec.kind = 'star';
    spec.temperature = known?.temperature || +obj.temperatureK || +obj.temperature || estimateTemperature(spec.color);
  } else if (type === 'gas_giant') {
    spec.kind = 'gas_giant';
    Object.assign(spec, {
      bands: known?.bands ?? 14 + Math.floor(rand() * 16),
      storm: known?.storm ?? rand() < 0.5,
      stormColor: safeColor(known?.stormColor || obj.stormColor, '#a04a30'),
      contrast: known?.contrast ?? 0.5 + rand() * 0.5,
      oblateness: known?.oblateness ?? 0.94,
      atmosphere: known?.atmosphere ? { ...known.atmosphere } : { color: spec.palette[2].clone(), density: 0.5 },
    });
  } else if (PLANET_SURFACES.has(type)) {
    spec.kind = 'planet';
    spec.surface = type;
    if (!paletteSource && type === 'terran') {
      spec.palette = ['#031330', '#0b4d6e', '#203d12', '#5b4a35', '#eef2f6'].map((c) => new THREE.Color(c));
    }
    spec.seaLevel = known?.seaLevel ?? (type === 'terran' ? clamp(+obj.seaLevel || 0.03, -0.3, 0.4) : 0);
    const wantsClouds = known ? !!known.clouds : obj.hasClouds ?? (type === 'terran');
    if (wantsClouds) spec.clouds = { cover: known?.clouds?.cover ?? clamp(+obj.cloudCover || 0.5, 0.1, 0.9), speed: 0.012 };
    spec.cityLights = known?.cityLights ?? !!obj.cityLights;
    const atmo = known?.atmosphere || obj.atmosphere;
    if (atmo) {
      spec.atmosphere = {
        color: atmo.color?.isColor ? atmo.color.clone() : safeColor(atmo.color, '#6fa0ff'),
        density: clamp(+atmo.density || 1, 0.05, 2.5),
        mie: atmo.mie ?? 0.35,
        thickness: atmo.thickness ?? 0.04,
      };
    } else if (type === 'terran' || obj.hasAtmosphere) {
      spec.atmosphere = { color: lin(0.175, 0.41, 1.0), density: 1, mie: 0.3, thickness: 0.035 };
    }
  } else if (type === 'asteroid' || type === 'comet') {
    spec.kind = type;
    spec.color = safeColor(known?.color || obj.color, '#6b625a');
  } else if (type === 'asteroid_belt') {
    spec.kind = 'asteroid_belt';
    spec.color = safeColor(known?.color || obj.color, '#7a6e62');
    spec.inner = +obj.innerRadius || null;
    spec.outer = +obj.outerRadius || null;
  } else if (type === 'ring') {
    spec.kind = 'ring';
  } else if (type === 'spiral_galaxy') {
    spec.kind = 'spiral_galaxy';
    Object.assign(spec, { arms: known?.arms, twist: known?.twist, inclination: known?.inclination });
    spec.radius = Math.max(spec.radius, 30);
  } else if (type === 'nebula') {
    spec.kind = 'nebula';
    if (!paletteSource) spec.palette = toColors(['#4fd1c5', '#e0457b', '#ff9a6b', '#2a1840'], spec.color, rand);
    spec.radius = Math.max(spec.radius, 18);
  } else if (type === 'black_hole') {
    spec.kind = 'black_hole';
    spec.palette = toColors(['#fff4e0', '#ff9a3c', '#a8321a', '#5a1a0a', '#200805'], spec.color, rand);
    spec.radius = clamp(spec.radius * 0.5, 1.2, 40);
  } else if (type === 'wormhole') {
    spec.kind = 'wormhole';
    if (!paletteSource) spec.palette = toColors(['#ffcf9a', '#ff8fb8', '#7a4dff', '#1a1030'], spec.color, rand);
    spec.radius = clamp(spec.radius * 0.6, 1.2, 40);
  } else if (type === 'white_hole') {
    spec.kind = 'white_hole';
    spec.palette = toColors(['#f4f8ff', '#9ec3ff', '#5a6cff', '#24185e', '#0a0820'], spec.color, rand);
    spec.radius = clamp(spec.radius * 0.5, 1.2, 40);
  } else if (type === 'quark_star') {
    spec.kind = 'star';
    spec.temperature = +obj.temperatureK || 32000;
    spec.radius = clamp(spec.radius, 0.3, 3);
    spec.theoretical = true;
  } else if (type === 'cosmic_string') {
    spec.kind = 'cosmic_string';
    if (!paletteSource) spec.palette = toColors(['#bfe4ff', '#7aa8ff'], spec.color, rand);
    spec.radius = clamp(spec.radius, 4, 60);
    spec.deficitDeg = clamp(+obj.deficitDeg || 2.4, 0.3, 8);
  } else if (type === 'brane_worlds') {
    spec.kind = 'brane_worlds';
    spec.radius = clamp(spec.radius, 30, 200);
    spec.branes = clamp(+obj.branes || 5, 2, 7);
  } else if (type === 'dyson_swarm') {
    spec.kind = 'dyson_swarm';
    spec.hostRadius = clamp(+obj.hostRadius || spec.radius / 3.4, 0.5, 20);
    spec.radius = spec.hostRadius * 3.4;
  } else if (type === 'warp_bubble') {
    spec.kind = 'warp_bubble';
    if (!paletteSource) spec.palette = toColors(['#ff4fd8', '#5ad7ff'], spec.color, rand);
    spec.radius = clamp(spec.radius, 2, 30);
  } else if (type === 'multiverse') {
    spec.kind = 'multiverse';
    spec.radius = clamp(spec.radius, 60, 240);
    spec.bubbles = clamp(+obj.bubbles || 11, 5, 16);
  } else {
    spec.kind = 'planet';
    spec.surface = 'barren';
  }
  if (['wormhole', 'white_hole', 'multiverse', 'cosmic_string', 'brane_worlds', 'dyson_swarm', 'warp_bubble'].includes(spec.kind) || obj.theoretical) spec.theoretical = true;

  if (known?.rings || obj.rings || obj.hasRings) {
    const r = known?.rings || (typeof obj.rings === 'object' ? obj.rings : {});
    spec.rings = {
      inner: +r.inner || 1.3,
      outer: +r.outer || 2.2,
      colorA: safeColor(r.colorA || r.color, '#d8c8a8'),
      colorB: safeColor(r.colorB, '#857868'),
      opacity: r.opacity ?? 0.92,
    };
  }
  return spec;
}

function estimateTemperature(color) {
  const hsl = {};
  color.getHSL(hsl);
  if (hsl.h < 0.05 || hsl.h > 0.92) return 3300;
  if (hsl.h < 0.11) return 4500;
  if (hsl.h < 0.17) return 5800;
  if (hsl.h > 0.5 && hsl.h < 0.72) return 11000;
  return 6500;
}

// Offline presets: used when AI providers are unavailable, and as high-quality reference scenes.
export const PRESETS = {
  multiverse: {
    sectorTitle: 'Eternal-Inflation Multiverse',
    theoretical: true,
    theory: {
      name: 'Eternal inflation (Vilenkin 1983, Linde 1986)',
      basis: 'Inflation never ends everywhere at once: an inflating false vacuum keeps nucleating "bubble universes", each with its own vacuum and possibly different physical constants. Our observable universe would be the inside of one bubble.',
      observability: 'Untestable directly. Collisions with neighbouring bubbles could leave circular discs in the cosmic microwave background; the WMAP 7-year search (Feeney et al. 2011) found no such signature.',
    },
    lore: 'Hypothesis. Bubble universes nucleating in an inflating false vacuum. Bright rings mark bubble collisions; one bubble is being born and expanding. Our universe is the large blue-gold bubble at the centre.',
    objects: [{ name: 'Inflating false vacuum', bodyType: 'multiverse', radius: 120, bubbles: 12 }],
    audioParams: { baseFreq: 36, filterCutoff: 220, lfoRate: 0.3 },
  },
  wormhole: {
    sectorTitle: 'Traversable Wormhole (Ellis / Morris–Thorne)',
    theoretical: true,
    theory: {
      name: 'Ellis drainhole (1973), Morris–Thorne traversable wormhole (1988)',
      basis: 'A horizonless throat connecting two distant regions or universes, with metric ds² = −dt² + dl² + (l² + a²)dΩ². Light passing the throat is rendered here by exact geodesics of this metric.',
      observability: 'Never observed. In general relativity the throat must be held open by exotic matter that violates the null energy condition; no known material does this.',
    },
    lore: 'Hypothesis. The sphere is not an object but a window: the distorted ring is our own sky lensed around the throat, and the centre shows the sky of another universe.',
    objects: [{ name: 'Ellis wormhole', bodyType: 'wormhole', radius: 6 }],
    audioParams: { baseFreq: 48, filterCutoff: 520, lfoRate: 0.6 },
  },
  'white hole': {
    sectorTitle: 'White Hole — Time-Reversed Black Hole',
    theoretical: true,
    theory: {
      name: 'Time reversal of the Schwarzschild solution',
      basis: 'A region nothing can enter: matter and light are only ever expelled. Its exterior gravity is identical to a black hole of the same mass, so light bends the same way, but the matter flows outward.',
      observability: 'Never observed. White holes are unstable to infalling matter (Eardley 1974) and would collapse into black holes; some quantum-gravity models propose black-to-white-hole transitions.',
    },
    lore: 'Hypothesis. A blinding past horizon ejecting an outflow disk, polar jets and expanding radiation shells, all lensed by the same curvature as a black hole.',
    objects: [{ name: 'White hole', bodyType: 'white_hole', radius: 6 }],
    audioParams: { baseFreq: 72, filterCutoff: 1400, lfoRate: 1.4 },
  },
  'cosmic string': {
    sectorTitle: 'Cosmic String — Topological Defect',
    theoretical: true,
    theory: {
      name: 'Cosmic strings (Kibble 1976, Vilenkin 1981)',
      basis: 'Thin, enormously dense line defects possibly left over from symmetry-breaking phase transitions in the early universe. Space around a straight string is conical: a wedge of angle 8πGμ is missing, so objects behind it appear twice, undistorted.',
      observability: 'Not detected. CMB and lensing limits keep the deficit angle below tens of milliarcseconds; here it is exaggerated by roughly 10⁵× so the double images are visible.',
    },
    lore: 'Hypothesis. A straight cosmic string crossing the sky. Background galaxies and a quasar behind it appear twice, mirrored across the line; the filament and travelling kinks are drawn as a guide.',
    objects: [{ name: 'Cosmic string', bodyType: 'cosmic_string', radius: 12, deficitDeg: 2.4 }],
    audioParams: { baseFreq: 40, filterCutoff: 300, lfoRate: 0.2 },
  },
  'brane worlds': {
    sectorTitle: 'Brane Worlds in a Warped Bulk',
    theoretical: true,
    theory: {
      name: 'Randall–Sundrum brane worlds (1999), ekpyrotic collisions (2001)',
      basis: 'Our universe could be a 3-dimensional membrane in a higher-dimensional warped bulk. Matter and light are confined to the brane while gravity can leak into the bulk, which could explain why gravity is so weak.',
      observability: 'Untested. Searches for extra-dimension signatures at the LHC and in short-range gravity tests have found nothing so far.',
    },
    lore: 'Hypothesis. Parallel 3-branes, each a universe with its own cosmic web, separated along a fifth dimension. Only gravitons (blue sparks) travel between them; two branes periodically collide, as in the ekpyrotic model.',
    objects: [{ name: 'Brane stack', bodyType: 'brane_worlds', radius: 80, branes: 5 }],
    audioParams: { baseFreq: 30, filterCutoff: 260, lfoRate: 0.15 },
  },
  'dyson sphere': {
    sectorTitle: 'Dyson Swarm around an M Dwarf',
    theoretical: true,
    theory: {
      name: 'Dyson sphere / swarm (Dyson 1960)',
      basis: 'An advanced civilisation could surround its star with collectors to capture most of its energy. Waste heat would be re-radiated in the mid-infrared.',
      observability: 'Hypothetical. Project Hephaistos (2024) found 7 M-dwarf candidates with infrared excess among ~5 million stars; follow-up work suggests background galaxies can explain them.',
    },
    lore: 'Hypothesis. A partial swarm of collectors on inclined orbits around a red dwarf, with a geodesic frame under construction. The red glow is a false-colour stand-in for infrared waste heat.',
    objects: [
      { name: 'Host red dwarf', bodyType: 'star', radius: 2, temperatureK: 3200 },
      { name: 'Dyson swarm', bodyType: 'dyson_swarm', hostRadius: 2 },
    ],
    audioParams: { baseFreq: 58, filterCutoff: 900, lfoRate: 0.5 },
  },
  'planet nine': {
    sectorTitle: 'Planet Nine — Hypothetical Distant Planet',
    theoretical: true,
    theory: {
      name: 'Planet Nine (Batygin & Brown 2016)',
      basis: 'The clustered orbits of distant Kuiper-belt objects could be shepherded by an unseen planet of roughly 5–10 Earth masses orbiting a few hundred AU from the Sun.',
      observability: 'Not found. NASA still describes it as theoretical; surveys keep narrowing where it could be.',
    },
    lore: 'Hypothesis. A cold mini-Neptune hundreds of AU out, lit by a Sun that is only a bright star. Lighting is brightened for visibility; at that distance sunlight is about 1/160,000 of Earth\'s.',
    objects: [
      { name: 'Planet Nine', bodyType: 'gas_giant', radius: 4, palette: ['#9fb8c8', '#6f8aa0', '#c7d6de', '#4a6478'] },
    ],
    sun: [1400, 120, 300],
    sunIntensity: 0.35,
    audioParams: { baseFreq: 34, filterCutoff: 240, lfoRate: 0.1 },
  },
  'quark star': {
    sectorTitle: 'Quark (Strange) Star',
    theoretical: true,
    theory: {
      name: 'Strange-matter hypothesis (Bodmer 1971, Witten 1984)',
      basis: 'If strange quark matter is the true ground state of matter, some neutron stars could convert into stars made of deconfined up, down and strange quarks — smaller and denser than neutron stars.',
      observability: 'Unconfirmed. A few compact objects have been proposed as candidates, but none is established.',
    },
    lore: 'Hypothesis. A city-sized, extremely hot compact star of free quarks. Size is enlarged for viewing.',
    objects: [{ name: 'Strange star', bodyType: 'quark_star', radius: 1.2 }],
    audioParams: { baseFreq: 90, filterCutoff: 2000, lfoRate: 2.2 },
  },
  'warp drive': {
    sectorTitle: 'Alcubierre Warp Bubble',
    theoretical: true,
    theory: {
      name: 'Alcubierre metric (1994)',
      basis: 'A solution of general relativity in which space contracts ahead of a region and expands behind it, carrying a flat bubble — and a ship — along without local motion.',
      observability: 'Purely mathematical. It requires negative energy density (exotic matter) in a torus around the ship, in amounts far beyond anything known.',
    },
    lore: 'Hypothesis. The coloured torus is the negative-energy density of the bubble wall. Inside, the sky ahead is squeezed and blueshifted, the sky behind stretched and reddened.',
    objects: [{ name: 'Warp bubble', bodyType: 'warp_bubble', radius: 8 }],
    audioParams: { baseFreq: 52, filterCutoff: 700, lfoRate: 0.9 },
  },
  'solar system': {
    sectorTitle: 'Solar System',
    lore: 'G-type main-sequence star Sol and its eight planets. Distances and sizes are compressed for viewing; appearance follows NASA imagery.',
    objects: [
      { name: 'Sun', radius: 6 },
      { name: 'Mercury', radius: 0.38, distance: 12 },
      { name: 'Venus', radius: 0.95, distance: 17 },
      { name: 'Earth', radius: 1.0, distance: 23 },
      { name: 'Moon', radius: 0.27, distance: 2.2, parent: 'Earth' },
      { name: 'Mars', radius: 0.55, distance: 30 },
      { name: 'Asteroid Belt', bodyType: 'asteroid_belt', radius: 39, innerRadius: 35, outerRadius: 43 },
      { name: 'Jupiter', radius: 3.2, distance: 56 },
      { name: 'Saturn', radius: 2.7, distance: 74 },
      { name: 'Uranus', radius: 1.6, distance: 88 },
      { name: 'Neptune', radius: 1.55, distance: 100 },
    ],
  },
  earth: {
    sectorTitle: 'Earth — Terrestrial Planet',
    lore: 'Third planet from the Sun. Mean radius 6,371 km, 71% ocean coverage, nitrogen-oxygen atmosphere, one natural satellite.',
    objects: [
      { name: 'Earth', radius: 4 },
      { name: 'Moon', radius: 1.09, distance: 22, parent: 'Earth' },
    ],
    sun: [900, 220, 500],
  },
  mars: {
    sectorTitle: 'Mars — Terrestrial Planet',
    lore: 'Fourth planet. Radius 3,390 km. Thin CO₂ atmosphere, iron-oxide regolith, polar ice caps, moons Phobos and Deimos.',
    objects: [
      { name: 'Mars', radius: 4 },
      { name: 'Phobos', bodyType: 'asteroid', radius: 0.22, distance: 9, parent: 'Mars' },
      { name: 'Deimos', bodyType: 'asteroid', radius: 0.14, distance: 14, parent: 'Mars' },
    ],
    sun: [900, 160, 600],
  },
  jupiter: {
    sectorTitle: 'Jupiter — Gas Giant',
    lore: 'Largest planet. Radius 69,911 km. Hydrogen-helium atmosphere with zonal jets and the Great Red Spot; 95 known moons.',
    objects: [
      { name: 'Jupiter', radius: 6 },
      { name: 'Io', radius: 0.36, distance: 13, parent: 'Jupiter' },
      { name: 'Europa', radius: 0.31, distance: 17, parent: 'Jupiter' },
      { name: 'Ganymede', radius: 0.52, distance: 23, parent: 'Jupiter' },
      { name: 'Callisto', radius: 0.48, distance: 30, parent: 'Jupiter' },
    ],
    sun: [900, 150, 500],
  },
  saturn: {
    sectorTitle: 'Saturn — Ringed Gas Giant',
    lore: 'Sixth planet. Radius 58,232 km. Its main rings span ~280,000 km but are only ~10 m thick; 146 known moons including Titan.',
    objects: [
      { name: 'Saturn', radius: 5 },
      { name: 'Titan', radius: 0.4, distance: 22, parent: 'Saturn' },
      { name: 'Enceladus', radius: 0.12, distance: 14, parent: 'Saturn' },
    ],
    sun: [900, 260, 400],
  },
  'milky way': {
    sectorTitle: 'Milky Way — Barred Spiral Galaxy',
    lore: 'Our home galaxy: ~100,000 light-years across, 100–400 billion stars, a central bulge hosting Sagittarius A*.',
    objects: [{ name: 'Milky Way', bodyType: 'spiral_galaxy', radius: 60 }],
  },
  andromeda: {
    sectorTitle: 'Andromeda Galaxy (M31)',
    lore: 'Nearest large spiral galaxy, 2.5 million light-years away, ~1 trillion stars, on a collision course with the Milky Way.',
    objects: [{ name: 'Andromeda', bodyType: 'spiral_galaxy', radius: 60 }],
  },
  'orion nebula': {
    sectorTitle: 'Orion Nebula (M42)',
    lore: 'Diffuse emission nebula ~1,344 light-years away; the nearest region of massive star formation to Earth.',
    objects: [{ name: 'Orion Nebula', bodyType: 'nebula', radius: 40 }],
  },
  'black hole': {
    sectorTitle: 'Sagittarius A* — Supermassive Black Hole',
    lore: 'Supermassive black hole of ~4 million solar masses at the Galactic Center, imaged by the Event Horizon Telescope in 2022.',
    objects: [{ name: 'Sagittarius A*', bodyType: 'black_hole', radius: 6 }],
  },
  'asteroid belt': {
    sectorTitle: 'Main Asteroid Belt',
    lore: 'Torus-shaped region between Mars and Jupiter containing millions of rocky bodies; Ceres is the largest at 940 km.',
    objects: [
      { name: 'Sun', radius: 3 },
      { name: 'Asteroid Belt', bodyType: 'asteroid_belt', radius: 30, innerRadius: 24, outerRadius: 36 },
      { name: 'Ceres', radius: 0.5, distance: 30 },
      { name: 'Vesta', bodyType: 'asteroid', radius: 0.3, distance: 27 },
    ],
  },
};

export function findPreset(text) {
  const q = (text || '').toLowerCase();
  const aliases = [
    ['multiverse', /multiverse|multi-verse|bubble universe|parallel universe|eternal inflation|other universes|many worlds|omniverse/],
    ['white hole', /white hole/],
    ['cosmic string', /cosmic string|topological defect/],
    ['brane worlds', /brane|bulk dimension|extra dimension|randall|sundrum|ekpyrotic/],
    ['dyson sphere', /dyson|megastructure|kardashev/],
    ['planet nine', /planet nine|planet 9|planet x/],
    ['quark star', /quark star|strange star|strange matter/],
    ['warp drive', /warp|alcubierre/],
    ['wormhole', /wormhole|worm hole|einstein.rosen|traversable/],
    ['solar system', /solar system|sol system|planets|sol-prime/],
    ['black hole', /black hole|sagittarius a|event horizon|gargantua/],
    ['milky way', /milky way|our galaxy|galactic/],
    ['andromeda', /andromeda|m31/],
    ['orion nebula', /nebula|orion|m42|pillars/],
    ['asteroid belt', /asteroid belt|asteroids|ceres|vesta/],
    ['saturn', /saturn|titan|enceladus/],
    ['jupiter', /jupiter|europa|ganymede|callisto|\bio\b/],
    ['mars', /mars|phobos|deimos|red planet/],
    ['earth', /earth|home|blue planet|terra/],
  ];
  for (const [key, re] of aliases) if (re.test(q)) return { key, preset: PRESETS[key] };
  return null;
}
