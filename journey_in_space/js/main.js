import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { shared, makeStarfield, makeSkySphere, makeShip } from './objects.js';
import { buildChapters } from './chapters.js';
import { Sound } from './audio.js';

const $ = (s) => document.querySelector(s);
const KM_AU = 1.495978707e8, KM_LY = 9.4607e12, C_KMS = 299792.458;

// ---------------- Renderer ----------------
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 3e7);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.35;

const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
scene.add(keyLight, keyLight.target);
const fill = new THREE.HemisphereLight(0x8aa8ff, 0x201810, 0.12);
scene.add(fill);

// ---------------- Post ----------------
const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
// sanitize HDR buffer: kill NaN/Inf and clamp fireflies before bloom
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv);
    bool bad = !(c.r==c.r && c.g==c.g && c.b==c.b) || c.r>1e5 || c.g>1e5 || c.b>1e5;
    vec3 col = bad ? vec3(0.0) : clamp(c.rgb, 0.0, 40.0);
    gl_FragColor=vec4(col,1.0); }`,
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 1.0);
composer.addPass(bloom);
const finalPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, warp: { value: 0 }, flash: { value: 0 }, time: { value: 0 }, aspect: { value: 1 },
    flarePos: { value: new THREE.Vector2(-9, -9) }, flareI: { value: 0 }, flareCol: { value: new THREE.Color(1, 0.9, 0.8) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float warp,flash,time,aspect,flareI; uniform vec2 flarePos; uniform vec3 flareCol; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 uv=vUv; vec2 c=uv-0.5;
      float d=length(c*vec2(aspect,1.0));
      vec2 caOff=c*0.0025*(1.0+warp*6.0);
      vec3 col;
      if(warp>0.002){
        col=vec3(0.0); float s=warp*0.22; float jit=h(uv+time)*0.08;
        for(int i=0;i<16;i++){ float k=(float(i)+jit)/16.0; vec2 q=0.5+c*(1.0-s*k);
          col.r+=texture2D(tDiffuse,q+caOff).r; col.g+=texture2D(tDiffuse,q).g; col.b+=texture2D(tDiffuse,q-caOff).b; }
        col/=16.0;
        col+=vec3(0.35,0.6,1.0)*warp*warp*0.08*smoothstep(0.1,0.8,d);
      } else {
        col=vec3(texture2D(tDiffuse,uv+caOff).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-caOff).b);
      }
      if(flareI>0.001){
        vec2 fp=flarePos; vec2 dir=vec2(0.5)-fp;
        vec2 pa=(uv-fp)*vec2(aspect,1.0);
        float streak=exp(-abs(pa.y)*260.0)*exp(-abs(pa.x)*2.2)*0.9;
        col+=flareCol*vec3(0.55,0.75,1.0)*streak*flareI;
        for(int i=1;i<6;i++){
          float fi=float(i); vec2 gp=fp+dir*(fi*0.42);
          float gr=length((uv-gp)*vec2(aspect,1.0));
          float sz=0.02+0.03*fract(fi*0.37);
          float ring=smoothstep(sz,sz*0.7,gr)*0.05+exp(-gr*gr/(sz*sz*0.2))*0.025;
          vec3 tint=mix(vec3(0.4,0.8,1.0),vec3(1.0,0.5,0.8),fract(fi*0.61));
          col+=tint*ring*flareI;
        }
        float halo=length((uv-(fp+dir*1.0))*vec2(aspect,1.0));
        col+=vec3(0.6,0.7,1.0)*smoothstep(0.32,0.30,halo)*smoothstep(0.26,0.30,halo)*0.03*flareI;
      }
      col+=vec3(0.75,0.85,1.0)*flash;
      float vig=smoothstep(1.15,0.35,d);
      col*=mix(0.55,1.0,vig);
      col+=(h(uv*vec2(1733.0,977.0)+fract(time*7.0))-0.5)*0.012;
      gl_FragColor=vec4(max(col,0.0),1.0);
    }`,
});
composer.addPass(finalPass);
composer.addPass(new OutputPass());

// ---------------- Quality ----------------
let quality = 'auto';
let dynScale = 1;
function targetPixelRatio() {
  const h = innerHeight;
  if (quality === '1080') return 1080 / h;
  if (quality === '1440') return 1440 / h;
  if (quality === '2160') return 2160 / h;
  return Math.min(devicePixelRatio || 1, 2) * dynScale;
}
function applySize() {
  const pr = Math.max(0.35, Math.min(targetPixelRatio(), 4));
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  const samples = innerHeight * pr > 1500 ? 2 : 4;
  if (composer.renderTarget1.samples !== samples) {
    composer.renderTarget1.samples = samples; composer.renderTarget2.samples = samples;
    composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
  }
  composer.setPixelRatio(pr);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  finalPass.uniforms.aspect.value = camera.aspect;
  const H = Math.round(innerHeight * pr), W = Math.round(innerWidth * pr);
  $('#res').textContent = `${W}×${H}`;
}
addEventListener('resize', applySize);

// ---------------- Textures ----------------
const T3 = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/';
const SSS = 'https://cdn.jsdelivr.net/gh/JiayuanZhu/solar-system-viz@main/textures/';
const SSS2 = 'https://cdn.jsdelivr.net/gh/PeeterPissarenko/orbit@main/public/textures/';
const TEX = {
  earthDay: [T3 + 'earth_day_4096.jpg', true], earthNight: [T3 + 'earth_night_4096.jpg', true], earthAux: [T3 + 'earth_bump_roughness_clouds_4096.jpg', false],
  moon: [SSS2 + '2k_moon.jpg', true], sun: [SSS + '2k_sun.jpg', true], mercury: [SSS + '2k_mercury.jpg', true], venus: [SSS2 + '2k_venus_atmosphere.jpg', true],
  mars: [SSS + '2k_mars.jpg', true], jupiter: [SSS + '2k_jupiter.jpg', true], saturn: [SSS + '2k_saturn.jpg', true], saturnRing: [SSS + '2k_saturn_ring_alpha.png', true],
  uranus: [SSS + '2k_uranus.jpg', true], neptune: [SSS + '2k_neptune.jpg', true], milky: [SSS2 + '2k_stars_milky_way.jpg', true],
};
const FALLBACK = { earthDay: '#2a4a6a', earthNight: '#000', earthAux: '#000', moon: '#888', sun: '#ffb050', mercury: '#8a8580', venus: '#d8b878', mars: '#b0603a', jupiter: '#c8a888', saturn: '#d8c49a', saturnRing: '#c8b898', uranus: '#9adbe0', neptune: '#4a6ad8', milky: '#000' };

function loadTextures(onProgress) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const keys = Object.keys(TEX); let done = 0;
  const out = {};
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  return Promise.all(keys.map(k => new Promise(res => {
    const [url, srgb] = TEX[k];
    const finish = (t) => { out[k] = t; done++; onProgress(done / keys.length); res(); };
    loader.load(url, t => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.wrapS = THREE.RepeatWrapping; finish(t); }, undefined, () => {
      const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d'); g.fillStyle = FALLBACK[k]; g.fillRect(0, 0, 4, 4);
      const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; finish(t);
    });
  }))).then(() => out);
}

// ---------------- World ----------------
const stars = makeStarfield();
scene.add(stars);
let sky = null;
const ship = makeShip();
scene.add(ship);

let CH = null, TOTAL = 0;
const built = [];
let T = 0, playing = false, speed = 1, curIdx = -1, ended = false;
const sound = new Sound();

// ship frame
const _f = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _m = new THREE.Matrix4();
const frame = { pos: new THREE.Vector3(), f: new THREE.Vector3(0, 0, -1), x: new THREE.Vector3(), y: new THREE.Vector3(0, 1, 0) };

function easeU(c, lt) { const s = Math.min(Math.max(lt / c.dur, 0), 1); return c.ease ? Math.pow(s, c.ease) : s; }

function shipFrame(c, d, u) {
  const p = d.path;
  const uu = Math.min(Math.max(u, 0), 1);
  p.getPointAt(uu, frame.pos);
  p.getTangentAt(Math.min(uu, 0.9995), _f).normalize();
  const ref = c.index === 0 ? new THREE.Vector3(0, 0.3, 1).normalize() : new THREE.Vector3(0, 1, 0);
  _x.crossVectors(ref, _f); if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0); _x.normalize();
  _y.crossVectors(_f, _x).normalize();
  frame.f.copy(_f); frame.x.copy(_x); frame.y.copy(_y);
  // bank from curvature
  const t2 = p.getTangentAt(Math.min(uu + 0.015, 1)).normalize();
  const turn = new THREE.Vector3().crossVectors(_f, t2).dot(_y);
  const roll = THREE.MathUtils.clamp(-turn * 18, -0.5, 0.5);
  _m.makeBasis(_x, _y, _f);
  ship.position.copy(frame.pos);
  ship.quaternion.setFromRotationMatrix(_m);
  ship.rotateZ(roll);
}

// camera keyframes
const user = { yaw: 0, pitch: 0, zoom: 1, dragging: false, idle: 0 };
function camKey(keys, u) {
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (u >= keys[i].u && u <= keys[i + 1].u) { a = keys[i]; b = keys[i + 1]; break; }
  const w0 = b.u > a.u ? (u - a.u) / (b.u - a.u) : 0;
  const w = w0 * w0 * (3 - 2 * w0);
  const A = new THREE.Vector3(...a.off), B = new THREE.Vector3(...b.off);
  const la = A.length(), lb = B.length();
  const dir = A.clone().normalize().lerp(B.clone().normalize(), w).normalize();
  const len = Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la)) * w);
  const look = (a.look ?? 0) + ((b.look ?? 0) - (a.look ?? 0)) * w;
  const fa = a.fov ?? null, fb = b.fov ?? fa;
  return { off: dir.multiplyScalar(len), look, fov: fa != null ? fa + ((fb ?? fa) - fa) * w : null };
}
let lastFov = 48;
function placeCamera(c, d, u, dt) {
  const k = camKey(d.cam, u);
  const off = k.off.clone();
  off.applyAxisAngle(new THREE.Vector3(0, 1, 0), user.yaw);
  off.applyAxisAngle(new THREE.Vector3(1, 0, 0), user.pitch);
  off.multiplyScalar(user.zoom);
  const right = frame.x.clone().negate();
  const pos = frame.pos.clone().addScaledVector(right, off.x).addScaledVector(frame.y, off.y).addScaledVector(frame.f, -off.z);
  const focus = d.focus(u).clone ? d.focus(u).clone() : d.focus(u);
  const toF = focus.clone().sub(frame.pos); const distF = toF.length(); toF.normalize();
  const L = off.length();
  const t1 = frame.pos.clone().addScaledVector(toF, Math.min(distF, L * 3 * k.look));
  const target = t1.lerp(focus, THREE.MathUtils.smoothstep(k.look, 0.85, 1.0));
  if (d.shake) { const s = d.shake(u) * L; pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s; }
  if (warpAmt > 0.05) { const s = warpAmt * 0.02 * L; pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s; }
  camera.position.copy(pos);
  if (d.camUp) camera.up.copy(d.camUp(u, frame)); else camera.up.copy(frame.y);
  camera.lookAt(target);
  const fov = k.fov ?? lastFov; lastFov = fov;
  const wf = fov + warpAmt * 18;
  if (Math.abs(camera.fov - wf) > 0.01) { camera.fov = wf; camera.updateProjectionMatrix(); }
}

// ---------------- Chapter switching ----------------
function activate(i) {
  if (i === curIdx) return;
  if (curIdx >= 0) built[curIdx].group.visible = false;
  curIdx = i;
  const c = CH[i], d = built[i];
  d.group.visible = true;
  stars.visible = !d.noStarfield;
  if (sky) sky.visible = !d.noSkyTex && c.sky > 0;
  user.yaw = user.pitch = 0; user.zoom = 1;
  updateChapterHUD(c);
  sound.chapter(i);
}

// ---------------- HUD ----------------
const hud = {
  idx: $('#ch-idx'), title: $('#ch-title'), kicker: $('#ch-kicker'), fact: $('#fact'), factN: $('#fact-n'),
  dist: $('#t-dist'), light: $('#t-light'), lightLbl: $('#t-light-lbl'), speed: $('#t-speed'), drive: $('#t-drive'), z: $('#t-z'), zRow: $('#row-z'),
  fill: $('#tl-fill'), segs: $('#tl-segs'), time: $('#tl-time'), labels: $('#labels'),
};
let curFact = -1;
function updateChapterHUD(c) {
  hud.idx.textContent = `${String(c.index + 1).padStart(2, '0')} / ${CH.length}`;
  const box = $('#chapter');
  box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
  hud.title.textContent = c.title; hud.kicker.textContent = c.kicker; hud.drive.textContent = c.drive;
  curFact = -1;
  document.querySelectorAll('.tl-seg').forEach((s, j) => s.classList.toggle('active', j === c.index));
  // labels
  hud.labels.innerHTML = '';
  (built[c.index].labels || []).forEach(l => {
    const el = document.createElement('div'); el.className = 'label';
    el.innerHTML = `<span class="dot"></span><span class="txt"><b>${l.name}</b>${l.sub ? `<i>${l.sub}</i>` : ''}</span>`;
    hud.labels.appendChild(el); l.el = el;
  });
}
function setFact(c, u) {
  const n = c.facts.length;
  const i = Math.min(n - 1, Math.floor(u * n));
  if (i === curFact) return;
  curFact = i;
  const el = hud.fact;
  el.classList.remove('show');
  setTimeout(() => { el.textContent = c.facts[i]; hud.factN.textContent = `${i + 1}/${n}`; el.classList.add('show'); }, 250);
}
const nf = (x, d = 0) => x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
function fmtDist(km) {
  if (km < 1e6) return `${nf(km, km < 100 ? 1 : 0)} km`;
  if (km < 0.05 * KM_LY) { const au = km / KM_AU; return `${nf(au, au < 10 ? 2 : au < 1000 ? 1 : 0)} AU`; }
  const ly = km / KM_LY;
  if (ly < 1e6) return `${nf(ly, ly < 10 ? 2 : 0)} ly`;
  if (ly < 1e9) return `${nf(ly / 1e6, 2)} million ly`;
  return `${nf(ly / 1e9, 2)} billion ly`;
}
function fmtTime(s) {
  if (s < 1) return `${nf(s * 1000, 0)} ms`;
  if (s < 60) return `${nf(s, 2)} s`;
  if (s < 3600) return `${nf(s / 60, 1)} min`;
  if (s < 86400 * 2) return `${nf(s / 3600, 1)} h`;
  const y = s / 31557600;
  if (y < 0.5) return `${nf(s / 86400, 1)} days`;
  if (y < 1e6) return `${nf(y, y < 100 ? 2 : 0)} years`;
  if (y < 1e9) return `${nf(y / 1e6, 2)} million yr`;
  return `${nf(y / 1e9, 2)} billion yr`;
}
// ΛCDM comoving distance (Gly) → lookback (Gyr), redshift
const COSMO = [[0, 0, 0], [1.37, 1.29, 0.1], [6.2, 5.0, 0.5], [10.8, 7.9, 1], [17.2, 10.5, 2], [21, 11.6, 3], [27.4, 12.8, 6], [31, 13.3, 10], [46.5, 13.8, 1100]];
function cosmo(gly) {
  for (let i = 0; i < COSMO.length - 1; i++) {
    const [d0, l0, z0] = COSMO[i], [d1, l1, z1] = COSMO[i + 1];
    if (gly <= d1) { const w = (gly - d0) / (d1 - d0); return { lb: l0 + (l1 - l0) * w, z: Math.exp(Math.log(1 + z0) + (Math.log(1 + z1) - Math.log(1 + z0)) * Math.pow(w, i === COSMO.length - 2 ? 3 : 1)) - 1 }; }
  }
  return { lb: 13.8, z: 1100 };
}
let prevDist = 0, speedSmooth = 0;
function updateTelemetry(c, u, dtSim) {
  const [a, b] = c.dist;
  const dkm = Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * u);
  hud.dist.textContent = fmtDist(dkm);
  const ly = dkm / KM_LY;
  if (ly > 1e8) {
    const cm = cosmo(ly / 1e9);
    hud.lightLbl.textContent = 'Lookback time';
    hud.light.textContent = `${nf(cm.lb, 2)} billion yr`;
    hud.zRow.style.display = '';
    hud.z.textContent = cm.z < 10 ? nf(cm.z, 3) : nf(cm.z, 0);
  } else {
    hud.lightLbl.textContent = 'Light-time from Earth';
    hud.light.textContent = fmtTime(dkm / C_KMS);
    hud.zRow.style.display = 'none';
  }
  if (dtSim > 0) {
    const v = Math.abs(dkm - prevDist) / dtSim;
    if (isFinite(v) && v < 1e30) speedSmooth += (v - speedSmooth) * Math.min(1, dtSim * 4);
  }
  prevDist = dkm;
  const beta = speedSmooth / C_KMS;
  hud.speed.textContent = beta < 0.01 ? `${nf(speedSmooth, 0)} km/s` : beta < 1000 ? `${nf(beta, 2)} c` : `${beta.toExponential(2).replace('e+', ' × 10^')} c`;
}

function updateLabels(d, u) {
  const w = innerWidth, h = innerHeight; const v = new THREE.Vector3();
  (d.labels || []).forEach(l => {
    if (!l.el) return;
    const ok = (l.minU == null || u >= l.minU) && (l.maxU == null || u <= l.maxU);
    v.copy(l.pos()); v.project(camera);
    const onScreen = v.z < 1 && v.z > -1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.88;
    const show = ok && onScreen && hudOn && labelsOn;
    l.el.style.opacity = show ? 1 : 0;
    if (onScreen) l.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
  });
}

// ---------------- Timeline ----------------
function buildTimeline() {
  hud.segs.innerHTML = '';
  CH.forEach((c, i) => {
    const s = document.createElement('button');
    s.className = 'tl-seg'; s.style.flex = c.dur; s.setAttribute('aria-label', `Chapter ${i + 1}: ${c.title}`);
    s.innerHTML = `<span class="tl-tip"><b>${String(i + 1).padStart(2, '0')}</b> ${c.title}</span>`;
    s.addEventListener('click', (e) => { e.stopPropagation(); seek(c.start + 0.01); });
    hud.segs.appendChild(s);
  });
}
function seek(t) { T = Math.max(0, Math.min(TOTAL - 0.01, t)); ended = false; $('#end').classList.remove('show'); speedSmooth = 0; }
function chapterAt(t) { for (let i = CH.length - 1; i >= 0; i--) if (t >= CH[i].start) return i; return 0; }

// ---------------- Controls ----------------
let hudOn = true, labelsOn = true;
function setPlaying(p) { playing = p; $('#btn-play').innerHTML = p ? ICON.pause : ICON.play; $('#btn-play').setAttribute('aria-label', p ? 'Pause' : 'Play'); }
const ICON = {
  play: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>',
};
$('#btn-play').addEventListener('click', () => { if (ended) { seek(0); } setPlaying(!playing); });
$('#btn-prev').addEventListener('click', () => { const i = chapterAt(T); seek(T - CH[i].start > 2 || i === 0 ? CH[i].start + 0.01 : CH[i - 1].start + 0.01); });
$('#btn-next').addEventListener('click', () => { const i = chapterAt(T); if (i < CH.length - 1) seek(CH[i + 1].start + 0.01); });
$('#speed').addEventListener('change', (e) => { speed = parseFloat(e.target.value); });
$('#quality').addEventListener('change', (e) => { quality = e.target.value; dynScale = 1; applySize(); });
$('#btn-hud').addEventListener('click', toggleHud);
$('#btn-cine').addEventListener('click', () => document.body.classList.toggle('cine'));
$('#btn-labels').addEventListener('click', () => { labelsOn = !labelsOn; $('#btn-labels').classList.toggle('off', !labelsOn); });
$('#btn-sound').addEventListener('click', () => { const on = sound.toggle(); $('#btn-sound').classList.toggle('off', !on); });
$('#tl-bar').addEventListener('click', (e) => { const r = $('#tl-bar').getBoundingClientRect(); seek((e.clientX - r.left) / r.width * TOTAL); });
function toggleHud() { hudOn = !hudOn; document.body.classList.toggle('nohud', !hudOn); }
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') { e.preventDefault(); $('#btn-play').click(); }
  else if (e.code === 'ArrowRight') $('#btn-next').click();
  else if (e.code === 'ArrowLeft') $('#btn-prev').click();
  else if (e.key === 'h' || e.key === 'H') toggleHud();
  else if (e.key === 'c' || e.key === 'C') document.body.classList.toggle('cine');
});
// drag to look around the ship
let lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => { user.dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!user.dragging) return;
  user.yaw -= (e.clientX - lastX) * 0.005; user.pitch = THREE.MathUtils.clamp(user.pitch - (e.clientY - lastY) * 0.004, -1.2, 1.2);
  lastX = e.clientX; lastY = e.clientY; user.idle = 0;
});
canvas.addEventListener('pointerup', () => { user.dragging = false; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); user.zoom = THREE.MathUtils.clamp(user.zoom * Math.exp(e.deltaY * 0.001), 0.4, 4); user.idle = 0; }, { passive: false });
canvas.addEventListener('dblclick', () => { user.yaw = user.pitch = 0; user.zoom = 1; });

// ---------------- Main loop ----------------
let warpAmt = 0;
const clock = new THREE.Clock();
let frameMs = 16, perfT = 0;
const tmpV = new THREE.Vector3();
const sunScreen = new THREE.Vector3();

function frameLoop() {
  requestAnimationFrame(frameLoop);
  const dtR = Math.min(clock.getDelta(), 0.1);
  frameMs += (dtR * 1000 - frameMs) * 0.05;
  if (quality === 'auto') {
    perfT += dtR;
    if (perfT > 1.5) {
      perfT = 0;
      if (frameMs > 30 && dynScale > 0.45) { dynScale *= 0.85; applySize(); }
      else if (frameMs < 15 && dynScale < 1) { dynScale = Math.min(1, dynScale * 1.1); applySize(); }
    }
  }
  if (!CH) return;
  const dt = playing ? dtR * speed : 0;
  T += dt;
  if (T >= TOTAL) { T = TOTAL - 0.001; if (playing) { setPlaying(false); ended = true; $('#end').classList.add('show'); } }
  shared.time.value += dtR;
  const i = chapterAt(T);
  activate(i);
  const c = CH[i], d = built[i];
  const lt = T - c.start;
  const u = easeU(c, lt);
  // warp
  const wOut = c.final ? 0 : THREE.MathUtils.smoothstep(lt, c.dur - 1.7, c.dur);
  const wIn = i > 0 ? 1 - THREE.MathUtils.smoothstep(lt, 0, 1.4) : 0;
  warpAmt = Math.max(wOut, wIn);
  const flash = Math.pow(warpAmt, 8) * 0.9;
  finalPass.uniforms.warp.value = warpAmt;
  finalPass.uniforms.flash.value = flash;
  finalPass.uniforms.time.value = shared.time.value;

  shipFrame(c, d, u);
  if (!user.dragging) { user.idle += dtR; if (user.idle > 3) { user.yaw *= 0.97; user.pitch *= 0.97; user.zoom += (1 - user.zoom) * 0.03; } }
  placeCamera(c, d, u, dt);
  if (window.__camOverride) window.__camOverride(camera);
  camera.updateMatrixWorld();

  // lighting
  const sun = d.sunAt ? d.sunAt(frame.pos) : { pos: d.sunPos, color: d.sunColor };
  tmpV.copy(sun.pos).sub(frame.pos).normalize();
  keyLight.position.copy(frame.pos).addScaledVector(tmpV, 50);
  keyLight.target.position.copy(frame.pos);
  keyLight.color.copy(sun.color);
  keyLight.intensity = 3.2;
  // ship fx
  const pl = d.plume ? d.plume(u) : { power: 1, len: 1 };
  ship.userData.setPlume(pl.power * (1 + warpAmt * 1.5), pl.len * (1 + warpAmt * 2), !!pl.chem);
  ship.userData.ringMat.emissiveIntensity = 1.2 + warpAmt * 10 + (c.index >= 8 ? 1.5 : 0);
  ship.userData.finMat.emissiveIntensity = d.heat ? d.heat(frame.pos) * 3 : 0;
  ship.userData.tick(shared.time.value);
  // stars
  stars.material.uniforms.beta.value = Math.min(0.97, warpAmt * 0.97);
  stars.material.uniforms.velDir.value.copy(frame.f);
  stars.material.uniforms.opacity.value = c.stars;
  stars.material.uniforms.pxRatio.value = renderer.getPixelRatio();
  if (sky) sky.material.uniforms.bright.value = c.sky * (1 - warpAmt);
  shared.pxScale.value = renderer.domElement.height * camera.projectionMatrix.elements[5] * 0.5;
  d.update && d.update(dt, camera);

  // lens flare
  const fs = d.flareStar ? d.flareStar.getWorldPosition(new THREE.Vector3()) : (c.index <= 7 && c.index !== 2 ? d.sunPos : null);
  let fI = 0;
  if (fs) {
    sunScreen.copy(fs).project(camera);
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const toS = fs.clone().sub(camera.position).normalize();
    if (camDir.dot(toS) > 0 && Math.abs(sunScreen.x) < 1.2 && Math.abs(sunScreen.y) < 1.2) {
      fI = (1 - Math.min(1, Math.max(Math.abs(sunScreen.x), Math.abs(sunScreen.y)) / 1.2));
      // occlusion by planets
      for (const o of d.occluders) {
        const cpos = o.getWorldPosition(tmpV); const R = o.userData.R;
        const oc = camera.position.clone().sub(cpos); const b = oc.dot(toS); const cc = oc.lengthSq() - R * R; const disc = b * b - cc;
        if (disc > 0 && -b - Math.sqrt(disc) > 0 && cpos.distanceTo(camera.position) < fs.distanceTo(camera.position)) { fI = 0; break; }
      }
      // ship occlusion
      finalPass.uniforms.flarePos.value.set(sunScreen.x * 0.5 + 0.5, sunScreen.y * 0.5 + 0.5);
      finalPass.uniforms.flareCol.value.copy(sun.color);
    }
  }
  finalPass.uniforms.flareI.value += ((fI * (c.flareGain ?? 1)) - finalPass.uniforms.flareI.value) * 0.15;

  renderer.toneMappingExposure = c.exposure ?? 1.0;
  composer.render(dtR);

  // HUD
  setFact(c, u);
  updateTelemetry(c, u, dt);
  updateLabels(d, u);
  hud.fill.style.width = `${(T / TOTAL) * 100}%`;
  const mm = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  hud.time.textContent = `${mm(T)} / ${mm(TOTAL)}`;
  sound.update(warpAmt, pl.power, !!pl.chem, playing);
}

// ---------------- Boot ----------------
applySize();
requestAnimationFrame(frameLoop);
const prog = $('#load-bar');
const status = $('#load-status');
loadTextures(p => { prog.style.width = `${Math.round(p * 70)}%`; }).then(async (tex) => {
  status.textContent = 'Generating stars, galaxies and the cosmic web…';
  await new Promise(r => setTimeout(r, 30));
  sky = makeSkySphere(tex.milky, 0.3); scene.add(sky);
  const res = buildChapters(tex);
  CH = res.chapters; TOTAL = res.total;
  for (let i = 0; i < CH.length; i++) {
    const d = CH[i].build();
    d.group.visible = false; scene.add(d.group);
    d.occluders = []; d.group.traverse(o => { if (o.userData && o.userData.R && o.userData.uniforms) d.occluders.push(o); });
    built.push(d);
    prog.style.width = `${70 + Math.round((i + 1) / CH.length * 25)}%`;
    await new Promise(r => setTimeout(r, 0));
  }
  status.textContent = 'Compiling shaders…';
  await new Promise(r => setTimeout(r, 30));
  built.forEach(d => d.group.visible = true);
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  built.forEach(d => d.group.visible = false);
  buildTimeline();
  curIdx = -1; activate(0);
  prog.style.width = '100%';
  status.textContent = 'Ready';
  $('#btn-begin').disabled = false;
  $('#intro').classList.add('ready');
});
$('#btn-begin').addEventListener('click', () => {
  $('#intro').classList.add('gone');
  document.body.classList.add('started');
  sound.start();
  seek(0); setPlaying(true);
});
$('#btn-replay').addEventListener('click', () => { seek(0); setPlaying(true); });
window.__voyage = { seek: (t) => seek(t), get T() { return T; }, setPlaying, get CH() { return CH; }, renderer, scene, camera, ship };
