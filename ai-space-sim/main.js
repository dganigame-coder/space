import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { CameraDirector } from './core/CameraDirector.js';
import { storage } from './core/storage.js';
import { hashString, rng } from './core/utils.js';
import { Skybox } from './world/Skybox.js';
import { World } from './world/World.js';
import { PRESETS, findPreset } from './world/catalog.js';
import { AIRouter } from './ai/AIRouter.js';
import { TextureService } from './ai/TextureService.js';
import { AmbientSynth } from './audio/AmbientSynth.js';
import { Voice } from './audio/Voice.js';
import { UI } from './ui/UI.js';

const DESTINATIONS = [
  ['Solar System', 'solar system'], ['Earth', 'earth'], ['Mars', 'mars'], ['Jupiter', 'jupiter'], ['Saturn', 'saturn'],
  ['Milky Way', 'milky way'], ['Andromeda', 'andromeda'], ['Orion Nebula', 'orion nebula'], ['Black Hole', 'black hole'], ['Asteroid Belt', 'asteroid belt'],
];

const ui = new UI();
const keys = { gemini: () => storage.get('gemini_api_key'), groq: () => storage.get('groq_api_key') };
let locale = storage.get('locale', 'en-US');
ui.setLocale(locale);

let engine;
try {
  engine = new Engine(document.getElementById('viewport'));
} catch (err) {
  ui.setBoot('WebGL2 is not available on this device. Enable hardware acceleration or try a recent Chrome, Edge, Firefox or Safari.');
  throw err;
}

const director = new CameraDirector(engine);
new Skybox(engine);
const router = new AIRouter(keys);
const textures = new TextureService(engine.renderer);
const synth = new AmbientSynth();
const voice = new Voice({ getLocale: () => locale, keys, synth });

const state = { world: null, removeUpdater: null, config: null, abort: null, selected: null, aiTextures: false, busy: false };

// ---------- World lifecycle ----------
// Offline world synthesis: reads intent from keywords so requests still resolve without AI.
const KEYWORDS = [
  ['lava', /lava|volcan|molten|magma|hell|inferno|io-like/],
  ['ice', /\bice|icy|frozen|snow|glacier|cryo/],
  ['desert', /desert|sand|dune|arid|dust|rust/],
  ['cloudy', /cloud|venus|toxic|acid|haze|smog/],
  ['terran', /ocean|water|earth-like|earthlike|habitable|garden|jungle|forest|terra|blue/],
  ['gas_giant', /gas giant|gas|jovian|giant|hot jupiter/],
  ['barren', /moon|rock|barren|crater|dead|airless/],
  ['nebula', /nebula|gas cloud|stellar nursery/],
  ['spiral_galaxy', /galaxy|spiral/],
  ['black_hole', /black hole|singularity|quasar/],
];
const STAR_TEMPS = [[/red dwarf|m-type|m dwarf/, 3200, '#ff7a4a', 'Red dwarf'], [/orange|k-type/, 4500, '#ffb36b', 'Orange dwarf'], [/blue|o-type|b-type|giant star/, 15000, '#9db8ff', 'Blue giant'], [/white dwarf/, 9000, '#e6eeff', 'White dwarf'], [/binary|star|sun|orbit/, 5800, '#fff2d8', 'Host star']];

function proceduralFallback(text) {
  const q = text.toLowerCase();
  const r = rng(hashString(q));
  const hit = KEYWORDS.find(([, re]) => re.test(q));
  const pool = ['terran', 'desert', 'ice', 'lava', 'barren', 'cloudy', 'gas_giant'];
  const kind = hit ? hit[0] : pool[Math.floor(r() * pool.length)];
  const words = text.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  const title = words.slice(0, 7).join(' ').replace(/^\p{L}/u, (c) => c.toUpperCase()) || 'Uncharted world';
  const designation = `AIWE-${(hashString(q) % 9000) + 1000}${'bcd'[Math.floor(r() * 3)]}`;
  const audioParams = { baseFreq: 40 + r() * 40, filterCutoff: 250 + r() * 500, lfoRate: 0.5 + r() };
  const lore = 'Offline synthesis: no AI ephemeris was reachable, so the engine generated a physically plausible body from your description. Connect a Gemini key for catalog-accurate results.';

  if (['nebula', 'spiral_galaxy', 'black_hole'].includes(kind)) {
    return { sectorTitle: title, lore, audioParams, objects: [{ name: designation, bodyType: kind, radius: kind === 'black_hole' ? 6 : 50 }] };
  }
  const star = STAR_TEMPS.find(([re]) => re.test(q));
  const moonCount = Math.min(4, +(q.match(/(\d+|two|three|four)\s+moons?/)?.[1]?.replace('two', '2').replace('three', '3').replace('four', '4') || (/moon/.test(q) ? 1 : 0)));
  const planet = { name: designation, bodyType: kind, radius: 4, hasRings: /ring/.test(q) || (kind === 'gas_giant' && r() > 0.6), hasClouds: kind === 'terran' || kind === 'cloudy', prompt: text };
  const objects = [];
  if (star) {
    objects.push({ name: `${star[3]} ${designation.slice(0, -1)}`, bodyType: 'star', radius: star[1] < 4000 ? 3 : 5, temperatureK: star[1], color: star[2] });
    Object.assign(planet, { radius: 1.6, distance: 26 });
  }
  objects.push(planet);
  for (let i = 0; i < moonCount; i++) {
    objects.push({ name: `${designation} ${['I', 'II', 'III', 'IV'][i]}`, bodyType: r() > 0.5 ? 'ice' : 'barren', radius: planet.radius * (0.12 + r() * 0.12), distance: planet.radius * (3 + i * 1.8), parent: designation });
  }
  return { sectorTitle: title, lore, audioParams, objects, ...(star ? {} : { sun: [900, 200, 500] }) };
}

function loadWorld(config, { source = 'Preset', warp = 1 } = {}) {
  textures.cancelAll();
  state.removeUpdater?.();
  state.world?.dispose();
  selectBody(null);

  const world = new World(engine, config);
  world.setOrbitsVisible(document.getElementById('t-orbits').checked);
  state.world = world;
  state.config = config;
  state.removeUpdater = engine.addUpdater((t, dt) => world.update(t, dt));

  const b = world.bounds();
  director.stopFollow();
  director.frameSphere(b.center, framingRadius(world, b), { warp, duration: warp ? 3.2 : 0.01, direction: framingDirection(world) });

  ui.setSector({ title: config.sectorTitle, lore: config.lore, source, config });
  synth.apply(config.audioParams);
  if (state.aiTextures) requestTextures(world);
  return world;
}

// Single-planet scenes frame the hero body; systems frame everything.
function framingRadius(world, b) {
  const hero = world.bodies[0];
  const isPlanetary = hero && !world.star && ['planet', 'gas_giant', 'asteroid', 'comet'].includes(hero.kind);
  if (!isPlanetary) return b.radius;
  return hero.radius * (hero.spec.rings ? 2.0 : 1.12);
}

// Three-quarter lighting: place the camera ~65 degrees around from the sun so the terminator shows.
function framingDirection(world) {
  if (world.star) return null;
  const s = world.sunPos.clone().setY(0).normalize();
  const dir = s.applyAxisAngle(new THREE.Vector3(0, 1, 0), -1.15);
  dir.y = 0.28;
  return dir.normalize();
}

function requestTextures(world) {
  const eligible = world.bodies.filter((b) => ['planet', 'gas_giant', 'asteroid'].includes(b.kind)).slice(0, 6);
  for (const body of eligible) {
    textures.request(TextureService.surfacePrompt(body.spec))
      .then((tex) => { if (state.world === world && tex) body.setTexture(tex); })
      .catch(() => {
        if (state.textureWarned) return;
        state.textureWarned = true;
        ui.toast('AI texture service unavailable — keeping procedural surfaces', 4200);
      });
  }
}

// ---------- Command pipeline ----------
async function processCommand(raw) {
  const text = (raw || '').trim();
  if (!text) return;
  state.abort?.abort();
  const ctrl = (state.abort = new AbortController());
  ui.setDrawer(false);
  ui.log('user', text);
  ui.setBusy(true);
  ui.setNav('Plotting course');
  synth.init();
  synth.whoosh();
  voice.stop();

  // Fast cockpit callout runs in parallel with world generation.
  router.cockpitCallout(text, ctrl.signal).then((r) => {
    if (ctrl.signal.aborted || !r?.callout) return;
    ui.log('ai', r.callout.replace(/^\[[^\]]+\]\s*/, ''));
    voice.say(r.callout);
  });

  const preset = findPreset(text);
  let result = null;
  // Exact catalog destinations resolve instantly; anything else goes to the AI ephemeris.
  const exact = preset && text.toLowerCase().replace(/[^a-z ]/g, '').trim() === preset.key;
  if (!exact) result = await router.generateWorld(text, locale, ctrl.signal, (s) => ui.setStatus(s));
  if (ctrl.signal.aborted) return;

  let config, source;
  if (result) ({ config, source } = result);
  else if (preset) { config = preset.preset; source = 'Catalog · NASA reference'; }
  else { config = proceduralFallback(text); source = 'Offline synthesis'; }

  try {
    loadWorld(config, { source });
    ui.setNav(`Arriving · ${config.sectorTitle || ''}`);
    ui.setStatus(source);
    const speech = config.speechResponse || `Arriving at ${config.sectorTitle}.`;
    ui.log('ai', speech);
    if (!keys.groq()) voice.say(speech);
  } catch (err) {
    console.error(err);
    ui.log('sys', 'Navigation failed. Holding position.');
  } finally {
    ui.setBusy(false);
  }
}

director.onArrive = () => { if (!state.busy) ui.setNav(state.config?.sectorTitle || 'Holding'); };

// ---------- Picking ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const canvas = engine.renderer.domElement;
let down = null;

function pickAt(e) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, engine.camera);
  return state.world?.pick(raycaster) || null;
}

function selectBody(body) {
  state.selected = body;
  ui.showTarget(body);
}

function followBody(body) {
  if (!body) return;
  director.follow(body.root, body.kind === 'spiral_galaxy' ? body.radius * 0.6 : body.kind === 'black_hole' ? body.radius * 3 : body.radius);
  ui.setNav(`Tracking · ${body.name}`);
}

canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved < 6 && performance.now() - down.t < 400) {
    const hit = pickAt(e);
    if (hit) selectBody(hit);
  }
  down = null;
});
canvas.addEventListener('dblclick', (e) => {
  const hit = pickAt(e);
  if (hit) { selectBody(hit); followBody(hit); }
});
ui.el.targetFollow.addEventListener('click', () => followBody(state.selected));
ui.el.targetClose.addEventListener('click', () => selectBody(null));
ui.el.systemView.addEventListener('click', () => {
  if (!state.world) return;
  const b = state.world.bounds();
  director.stopFollow();
  director.frameSphere(b.center, b.radius, { duration: 2.4 });
  ui.setNav(state.config?.sectorTitle || 'System view');
});

// ---------- Controls ----------
ui.el.send.addEventListener('click', () => processCommand(ui.el.input.value).then(() => { ui.el.input.value = ''; }));
ui.el.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ui.el.send.click(); });
ui.renderChips(DESTINATIONS, (cmd) => processCommand(cmd));

ui.el.lang.addEventListener('change', () => {
  locale = ui.el.lang.value;
  storage.set('locale', locale);
  ui.setLocale(locale);
  ui.toast(`Comms locale: ${locale}`);
});

let listening = false;
ui.el.mic.addEventListener('click', () => {
  synth.init();
  if (!voice.recognitionSupported) { ui.toast('Voice input is not supported in this browser'); return; }
  if (listening) { voice.stopListening(); return; }
  voice.stop();
  listening = voice.listen({
    onInterim: (t) => { ui.el.input.value = t; },
    onFinal: (t) => { ui.el.input.value = ''; processCommand(t); },
    onEnd: () => { listening = false; ui.setListening(false); ui.setStatus('Systems nominal'); },
  });
  ui.setListening(listening);
  if (listening) ui.setStatus(`Listening · ${locale}`);
});

ui.el.gemini.value = keys.gemini();
ui.el.groq.value = keys.groq();
async function connectKeys() {
  const g = ui.el.gemini.value.trim();
  const q = ui.el.groq.value.trim();
  g ? storage.set('gemini_api_key', g) : storage.remove('gemini_api_key');
  q ? storage.set('groq_api_key', q) : storage.remove('groq_api_key');
  if (!g && !q) { ui.setTokenStatus(false, 'Keyless'); return; }
  ui.setTokenStatus(false, 'Linking…');
  const ok = g ? await router.discoverGeminiModels() : false;
  ui.setTokenStatus(ok || !!q, ok ? `Linked · ${router.models[0]}` : q ? 'Groq only' : 'Key rejected');
}
ui.el.save.addEventListener('click', () => { synth.init(); connectKeys(); });

const bindToggle = (id, fn) => document.getElementById(id).addEventListener('change', (e) => fn(e.target.checked));
bindToggle('t-bloom', (v) => engine.setSetting('bloom', v));
bindToggle('t-cinematic', (v) => engine.setSetting('cinematic', v));
bindToggle('t-flare', (v) => engine.setSetting('flare', v));
bindToggle('t-orbits', (v) => state.world?.setOrbitsVisible(v));
bindToggle('t-autoorbit', (v) => { director.autoOrbit = v; });
bindToggle('t-voice', (v) => { voice.enabled = v; if (!v) voice.stop(); });
bindToggle('t-music', (v) => { synth.init(); synth.setMuted(!v); });
bindToggle('t-aitex', (v) => { state.aiTextures = v; if (v && state.world) requestTextures(state.world); });

const qParam = new URLSearchParams(location.search).get('quality');
if (qParam) engine.setQuality(qParam);
ui.el.quality.value = engine.qualityKey;
ui.el.quality.addEventListener('change', () => {
  engine.setQuality(ui.el.quality.value);
  // Shader octave counts and particle budgets depend on quality: rebuild the scene in place.
  if (state.config) loadWorld(state.config, { source: ui.el.source.textContent, warp: 0 });
  ui.toast(`Quality: ${ui.el.quality.selectedOptions[0].text}`);
});

ui.el.capture.addEventListener('click', () => {
  ui.el.capture.disabled = true;
  ui.el.capture.textContent = 'Rendering…';
  requestAnimationFrame(() => setTimeout(() => {
    try {
      const { url, width, height } = engine.capture(3840, 2160);
      if (url) {
        ui.el.captureLink.href = url;
        ui.el.captureLink.textContent = `Download PNG (${width}×${height})`;
        ui.el.captureLink.hidden = false;
        ui.toast(`Captured ${width}×${height}`);
      }
    } catch (err) {
      console.error(err);
      ui.toast('Capture failed on this GPU');
    } finally {
      ui.el.capture.disabled = false;
      ui.el.capture.textContent = 'Capture 4K still';
    }
  }, 30));
});

engine.onStats((e) => ui.setStats(e));

// Ambient audio requires a user gesture.
window.addEventListener('pointerdown', () => synth.init(), { once: true });
window.addEventListener('keydown', () => synth.init(), { once: true });

// ---------- Boot ----------
ui.setBoot('Compiling shaders…');
ui.setTokenStatus(!!(keys.gemini() || keys.groq()), keys.gemini() || keys.groq() ? 'Stored keys' : 'Keyless');
if (keys.gemini()) router.discoverGeminiModels().then((ok) => ok && ui.setTokenStatus(true, `Linked · ${router.models[0]}`));

const initial = PRESETS['solar system'];
loadWorld(initial, { source: 'Catalog · NASA reference', warp: 0 });
engine.camera.position.set(0, 70, 190);
const b0 = state.world.bounds();
director.frameSphere(b0.center, b0.radius * 0.55, { duration: 4.5, warp: 0.6 });
ui.setNav('Sol system');
ui.log('sys', 'Renderer online. Say or type a destination.');
engine.start();
requestAnimationFrame(() => setTimeout(() => ui.hideBoot(), 600));

window.__aiwe = { engine, director, state, processCommand };
