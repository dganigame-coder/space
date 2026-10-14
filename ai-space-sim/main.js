import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * SPACE ENGINE — Upgraded Production Module for main.js
 * 
 * Preserves all original HTML element IDs while integrating:
 * - OrbitControls navigation, panning, zooming, and rotation[cite: 2, 3]
 * - Click-to-select objects with a dynamic selection ring[cite: 2, 3]
 * - Frame-rate-independent animations (spin, pulse, bob, orbit)[cite: 2, 3]
 * - GPU-driven star twinkle shader[cite: 2, 3]
 * - Safe schema-validated AI scene configuration (no unsafe eval/new Function)[cite: 2, 3]
 * - Non-blocking asynchronous texture loading with bounded worker concurrency[cite: 2, 3]
 * - Request timeouts and automatic model fallback cascade[cite: 2, 3]
 */

// ---------------------------------------------------------------------------
// CONFIGURATION + GLOBAL STATE
// ---------------------------------------------------------------------------
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const POLLINATIONS_TEXT_ENDPOINT = 'https://text.pollinations.ai/';
const POLLINATIONS_IMAGE_ENDPOINT = 'https://image.pollinations.ai/prompt/';
const AI_PROXY_ENDPOINT = typeof window !== 'undefined'
  ? String(window.SPACE_ENGINE_AI_ENDPOINT || '').trim()
  : '';

const MAX_SCENE_OBJECTS = 24;
const MAX_TEXTURE_WORKERS = 2;
const MAX_AI_MODELS_TO_TRY = 3;
const REQUEST_TIMEOUT_MS = 12000;
const MAX_FRAME_DELTA = 0.05;
const DEFAULT_MODEL = 'gemini-2.5-flash';

let scene;
let camera;
let renderer;
let starField;
let starMaterial;
let systemGroup;
let controls;
let container;
let raycaster;
let pointer;
let selectedObject = null;
let selectionRing = null;
let hoverObject = null;
let activeAnimatedMeshes = [];
let elapsedSeconds = 0;
let lastFrameTime = 0;
let commandSequence = 0;
let currentCommandAbort = null;
let resizeObserver = null;
let isListening = false;
let audioInitialized = false;
let audioCtx;
let osc1;
let osc2;
let filterNode;
let lfoNode;
let lfoGain;
let masterGain;
let textureLoader;
let textureQueue = [];
let activeTextureWorkers = 0;
let textureCache = new Map();
let geminiKey = readStoredKey();
let dynamicModelQueue = [DEFAULT_MODEL];

const geometryTypes = new Set([
  'sphere', 'torus', 'disk', 'icosahedron', 'blackhole'
]);

const animationTypes = new Set([
  'none', 'spin', 'pulse', 'bob', 'orbit'
]);

const visualPresets = new Set([
  'auto', 'planet', 'terrestrial-planet', 'gas-giant', 'star',
  'asteroid', 'moon', 'crystal', 'blackhole', 'ring-world', 'nebula'
]);

// ---------------------------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------------------------
function init() {
  try {
    setupSecurity();
    initThreeJS();
    setupControls();
    setupObjectPicking();
    animate(0);

    if (geminiKey && !AI_PROXY_ENDPOINT) {
      discoverGeminiModels().catch((error) => {
        console.warn('Gemini model discovery failed; retaining fallback model.', error);
      });
    }

    const bootOverlay = document.getElementById('boot-overlay');
    if (bootOverlay) {
      bootOverlay.style.transition = 'opacity 450ms ease';
      bootOverlay.style.opacity = '0';
      window.setTimeout(() => bootOverlay.remove(), 500);
    }
  } catch (error) {
    console.error('Space Engine failed to initialize:', error);
    setHudStatus('ENGINE ERROR — check console');
  }
}

function readStoredKey() {
  try {
    return window.localStorage.getItem('gemini_api_key') || '';
  } catch {
    return '';
  }
}

function saveStoredKey(value) {
  try {
    if (value) window.localStorage.setItem('gemini_api_key', value);
    else window.localStorage.removeItem('gemini_api_key');
  } catch (error) {
    console.warn('Browser storage is unavailable; key was not persisted.', error);
  }
}

function setHudStatus(message) {
  const el = document.getElementById('hud-nav-status');
  if (el) el.textContent = message;
}

function setTokenStatus(message, color = '#fbbf24') {
  const el = document.getElementById('token-status');
  if (!el) return;
  el.textContent = message;
  el.style.color = color;
}

// ---------------------------------------------------------------------------
// GEMINI MODEL DISCOVERY & NEWEST-FIRST RANKING
// ---------------------------------------------------------------------------
async function discoverGeminiModels() {
  if (!geminiKey || AI_PROXY_ENDPOINT) return;

  try {
    const response = await fetchWithTimeout(
      `${GEMINI_API_BASE}/models`,
      {
        method: 'GET',
        headers: { 'x-goog-api-key': geminiKey }
      },
      8000
    );

    if (!response.ok) throw new Error(`Model list HTTP ${response.status}`);
    const data = await response.json();

    const validModels = (data.models || [])
      .filter((model) => {
        const name = String(model.name || '').toLowerCase();
        return model.supportedGenerationMethods?.includes('generateContent')
          && !/(tts|embedding|transcrib|image|gemma|robotics)/.test(name);
      })
      .map((model) => ({
        id: String(model.name || '').replace(/^models\//, ''),
        version: String(model.version || ''),
        description: String(model.description || '')
      }))
      .filter((model) => /^[a-zA-Z0-9._-]+$/.test(model.id));

    const versionScore = (modelId) => {
      const match = modelId.match(/gemini-(\d+)(?:\.(\d+))?/i);
      return match ? (Number(match[1]) * 100 + Number(match[2] || 0)) : 0;
    };

    validModels.sort((a, b) => {
      const versionDifference = versionScore(b.id) - versionScore(a.id);
      if (versionDifference) return versionDifference;
      const flashDifference = Number(/flash/i.test(b.id)) - Number(/flash/i.test(a.id));
      return flashDifference || a.id.localeCompare(b.id);
    });

    if (validModels.length) {
      dynamicModelQueue = [...new Set(validModels.map((model) => model.id))].slice(0, 8);
      console.info('Compiled newest-first Gemini model queue:', dynamicModelQueue);
      speakText("Astrometric telemetry online. Subspace neural calibration sequence complete.");
    }
  } catch (error) {
    console.warn('Could not discover Gemini models; using built-in fallback queue.', error);
  }
}

// ---------------------------------------------------------------------------
// SECURITY & TOKEN UI SETUP
// ---------------------------------------------------------------------------
function setupSecurity() {
  const tokenInput = document.getElementById('hf-token-input');
  const tokenBtn = document.getElementById('save-token-btn');

  if (tokenInput && geminiKey) tokenInput.value = geminiKey;

  if (AI_PROXY_ENDPOINT) {
    setTokenStatus('Backend AI proxy configured. Browser API key is not required.', '#4ade80');
  } else if (geminiKey) {
    setTokenStatus('Gemini API Key active.', '#4ade80');
  } else {
    setTokenStatus('Running via Pollinations fallback (Add Gemini key for priority access).', '#fbbf24');
  }

  if (!tokenBtn) return;
  tokenBtn.addEventListener('click', async () => {
    const key = tokenInput?.value?.trim() || '';

    if (key) {
      geminiKey = key;
      saveStoredKey(key);
      setTokenStatus('Gemini Key Saved! AI Engine Active.', '#4ade80');
      if (!AI_PROXY_ENDPOINT) await discoverGeminiModels();
    } else {
      geminiKey = '';
      saveStoredKey('');
      dynamicModelQueue = [DEFAULT_MODEL];
      setTokenStatus('Key cleared. Using Pollinations fallback.', '#fbbf24');
    }
  });
}

// ---------------------------------------------------------------------------
// THREE.JS SCENE INITIALIZATION
// ---------------------------------------------------------------------------
function initThreeJS() {
  container = document.getElementById('viewport') || document.body;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);
  scene.fog = new THREE.FogExp2(0x02040a, 0.012);

  const width = Math.max(1, container.clientWidth || window.innerWidth || 1);
  const height = Math.max(1, container.clientHeight || window.innerHeight || 1);
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 25000);
  camera.position.set(0, 5, 15);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  systemGroup = new THREE.Group();
  scene.add(systemGroup);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
  dirLight.position.set(20, 15, 20);
  scene.add(dirLight);

  const ambientLight = new THREE.AmbientLight(0x222233, 1.2);
  scene.add(ambientLight);

  textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin('anonymous');

  createStarField();
  createInitialPlanet();

  raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 1.5;
  pointer = new THREE.Vector2();

  setupResizeHandling();
}

function setupResizeHandling() {
  const resize = () => {
    if (!container || !camera || !renderer) return;
    const width = Math.max(1, container.clientWidth || window.innerWidth || 1);
    const height = Math.max(1, container.clientHeight || window.innerHeight || 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  };

  window.addEventListener('resize', resize, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
  }
}

function createInitialPlanet() {
  const geometry = new THREE.SphereGeometry(2, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.4,
    metalness: 0.1
  });
  const planet = new THREE.Mesh(geometry, material);
  planet.name = 'Starter World';
  planet.userData.isSelectableRoot = true;
  planet.userData.info = 'Initial navigational target. Enter a command to explore a new sector.';
  systemGroup.add(planet);

  activeAnimatedMeshes.push({
    mesh: planet,
    type: 'spin',
    config: { speed: 0.003, axis: 'y', speedX: 0, speedY: 0, speedZ: 0 },
    basePosition: planet.position.clone(),
    baseScale: planet.scale.clone(),
    phase: 0
  });
}

function createStarField() {
  const count = 5000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const z = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const radius = 200 + Math.random() * 400;
    positions[i * 3] = radial * Math.cos(theta) * radius;
    positions[i * 3 + 1] = z * radius;
    positions[i * 3 + 2] = radial * Math.sin(theta) * radius;
    sizes[i] = 0.6 + Math.random() * 1.2;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  starMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * (200.0 / max(1.0, -viewPosition.z)), 1.0, 3.0);
        vAlpha = 0.7 + 0.3 * sin(uTime * (1.0 + aPhase * 0.1) + aPhase);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        gl_FragColor = vec4(vec3(1.0), (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha);
      }
    `
  });

  starField = new THREE.Points(geometry, starMaterial);
  starField.frustumCulled = false;
  scene.add(starField);
}

function addAtmosphereShell(parent, radius, color, opacity = 0.5) {
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: {
        uGlowColor: { value: color.clone() },
        uOpacity: { value: opacity }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-viewPosition.xyz);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uGlowColor;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float facing = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
          float rim = pow(1.0 - facing, 2.2);
          gl_FragColor = vec4(uGlowColor, rim * uOpacity);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  shell.name = 'AtmosphereGlow';
  parent.add(shell);
  return shell;
}

// ---------------------------------------------------------------------------
// CONTROLS & UI SETUP
// ---------------------------------------------------------------------------
function setupControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 1.5;
  controls.maxDistance = 15000;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.85;
  controls.target.set(0, 0, 0);
  controls.update();

  const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
  const sidebar = document.getElementById('sidebar');
  if (mobileToggleBtn && sidebar) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      mobileToggleBtn.textContent = sidebar.classList.contains('mobile-open')
        ? '✕ Close'
        : '⚙️ Controls';
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);
    });
  }

  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (error) {
        console.warn('Fullscreen toggle failed:', error);
      }
    });
  }

  setupVoiceAndTextControls();
}

function setupVoiceAndTextControls() {
  const micBtn = document.getElementById('mic-btn');
  const manualInput = document.getElementById('manual-input');
  const sendBtn = document.getElementById('send-btn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (micBtn) micBtn.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  if (manualInput) manualInput.disabled = false;

  if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';

    micBtn.addEventListener('click', () => {
      initWebAudio();
      if (isListening) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
        isListening = true;
        micBtn.classList.add('listening');
      } catch (e) {}
    });

    recognition.onresult = (event) => {
      isListening = false;
      micBtn.classList.remove('listening');
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) processCommand(transcript);
    };

    recognition.onerror = () => { isListening = false; micBtn.classList.remove('listening'); };
    recognition.onend = () => { isListening = false; micBtn.classList.remove('listening'); };
  }

  const submit = () => {
    const command = manualInput?.value?.trim();
    if (!command) return;
    initWebAudio();
    processCommand(command);
    manualInput.value = '';
  };

  if (sendBtn) sendBtn.addEventListener('click', submit);
  if (manualInput) {
    manualInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && manualInput.value.trim()) {
        e.preventDefault();
        submit();
      }
    });
  }
}

// ---------------------------------------------------------------------------
// OBJECT PICKING & SELECTION RING
// ---------------------------------------------------------------------------
function setupObjectPicking() {
  const canvas = renderer.domElement;
  let pointerDown = null;

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(systemGroup.children, true);
    canvas.style.cursor = hits.length ? 'pointer' : 'grab';
  });

  canvas.addEventListener('pointerup', (event) => {
    if (!pointerDown) return;
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (moved > 5) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(systemGroup.children, true);
    const root = hits.length ? findSelectableRoot(hits[0].object) : null;
    if (root) selectObject(root);
  });
}

function findSelectableRoot(object) {
  let node = object;
  while (node && node !== systemGroup) {
    if (node.userData?.isSelectableRoot) return node;
    node = node.parent;
  }
  return null;
}

function selectObject(object) {
  selectedObject = object;
  updateSelectionRing();
  const titleEl = document.getElementById('sector-title');
  const loreEl = document.getElementById('sector-lore');
  if (titleEl && object.name) titleEl.textContent = object.name;
  if (loreEl && object.userData?.info) loreEl.textContent = object.userData.info;
}

function updateSelectionRing() {
  if (!selectedObject) {
    if (selectionRing) {
      scene.remove(selectionRing);
      selectionRing.geometry.dispose();
      selectionRing.material.dispose();
      selectionRing = null;
    }
    return;
  }

  const bounds = new THREE.Box3().setFromObject(selectedObject);
  if (bounds.isEmpty()) return;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(0.5, sphere.radius * 1.05);

  if (!selectionRing) {
    selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.98, 1.0, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    selectionRing.rotation.x = Math.PI / 2;
    scene.add(selectionRing);
  }

  selectionRing.position.copy(sphere.center);
  selectionRing.scale.setScalar(radius);
}

// ---------------------------------------------------------------------------
// DYNAMIC GEOMETRY & PRESETS
// ---------------------------------------------------------------------------
function createDynamicGeometry(type, args = []) {
  const p = Array.isArray(args) ? args : [];
  switch (String(type || 'sphere').toLowerCase()) {
    case 'torus':
      return new THREE.TorusGeometry(p[0] || 2.5, p[1] || 0.5, p[2] || 32, p[3] || 128);
    case 'disk':
      return new THREE.RingGeometry(p[0] || 0.4, p[1] || 4.5, p[2] || 64);
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(p[0] || 2.0, p[1] || 2);
    case 'sphere':
    default:
      return new THREE.SphereGeometry(p[0] || 2.0, p[1] || 64, p[2] || 64);
  }
}

function createBlackHoleVisual(config) {
  const [coreRadius = 1.5] = config.geometryArgs || [];
  const root = new THREE.Group();
  root.name = config.name;
  root.userData.isSelectableRoot = true;
  root.userData.isBlackHoleVisual = true;

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(coreRadius, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  root.add(core);

  const disk = new THREE.Mesh(
    new THREE.RingGeometry(coreRadius * 1.2, coreRadius * 2.8, 128),
    new THREE.MeshBasicMaterial({
      color: 0xff8833,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  disk.name = 'AccretionDisk';
  disk.rotation.x = Math.PI / 2;
  root.add(disk);

  root.userData.info = config.educationalNote || 'Stylized black hole visualization with event horizon and luminous accretion disk.';
  return root;
}

// ---------------------------------------------------------------------------
// CONFIGURATION VALIDATION & CLEANING
// ---------------------------------------------------------------------------
function clampNumber(val, min, max, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? THREE.MathUtils.clamp(n, min, max) : fallback;
}

function cleanText(val, fallback, maxLen = 200) {
  if (typeof val !== 'string') return fallback;
  return val.trim().slice(0, maxLen) || fallback;
}

function cleanColor(val, fallback = '#38bdf8') {
  if (typeof val !== 'string') return fallback;
  const col = val.trim();
  return /^#[0-9a-f]{6}$/i.test(col) ? col : fallback;
}

function cleanVector(val, fallback = [0, 0, 0]) {
  if (!Array.isArray(val) || val.length < 3) return [...fallback];
  return [0, 1, 2].map(i => clampNumber(val[i], -5000, 5000, fallback[i]));
}

function cleanAnimation(raw, objectPos) {
  const item = raw && typeof raw === 'object' ? raw : {};
  const typeCand = String(item.type || 'spin').toLowerCase();
  const type = animationTypes.has(typeCand) ? typeCand : 'spin';
  const axisCand = String(item.axis || 'y').toLowerCase();
  const axis = ['x', 'y', 'z'].includes(axisCand) ? axisCand : 'y';

  return {
    type,
    axis,
    speed: clampNumber(item.speed, -2, 2, 0.005),
    speedX: clampNumber(item.speedX, -2, 2, 0),
    speedY: clampNumber(item.speedY, -2, 2, 0),
    speedZ: clampNumber(item.speedZ, -2, 2, 0),
    amplitude: clampNumber(item.amplitude, 0, 0.5, 0.05),
    frequency: clampNumber(item.frequency, 0.05, 10, 1),
    radius: clampNumber(item.radius, 0, 1000, 0),
    center: cleanVector(item.center, objectPos)
  };
}

function validateWorldConfig(raw, defaultTitle) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const rawObjects = Array.isArray(data.objects) ? data.objects : [];
  const objects = rawObjects.slice(0, MAX_SCENE_OBJECTS).map((item, idx) => {
    const obj = item && typeof item === 'object' ? item : {};
    const geomCand = String(obj.geometryType || 'sphere').toLowerCase();
    const geometryType = geometryTypes.has(geomCand) ? geomCand : 'sphere';
    const position = cleanVector(obj.position, [idx * 4, 0, 0]);
    const presetCand = String(obj.visualPreset || 'auto').toLowerCase();
    const visualPreset = visualPresets.has(presetCand) ? presetCand : 'auto';

    return {
      name: cleanText(obj.name, `Object ${idx + 1}`),
      geometryType,
      geometryArgs: Array.isArray(obj.geometryArgs) ? obj.geometryArgs.map(n => Number(n) || 2) : [2, 64, 64],
      position,
      color: cleanColor(obj.color, '#38bdf8'),
      emissive: obj.emissive === true,
      emissiveColor: cleanColor(obj.emissiveColor, '#ffaa00'),
      emissiveIntensity: clampNumber(obj.emissiveIntensity, 0, 5, 0.9),
      roughness: clampNumber(obj.roughness, 0.05, 1, 0.35),
      metalness: clampNumber(obj.metalness, 0, 1, 0.15),
      visualPreset,
      prompt: cleanText(obj.prompt, '', 250),
      customTextureUrl: cleanText(obj.customTextureUrl, '', 500),
      animation: cleanAnimation(obj.animation, position),
      educationalNote: cleanText(obj.educationalNote, '', 600)
    };
  });

  if (!objects.length) return generateFallbackWorld(defaultTitle);

  return {
    sectorTitle: cleanText(data.sectorTitle, `Sector: ${defaultTitle}`),
    lore: cleanText(data.lore, 'Spatial telemetry and sector mapping complete.'),
    speechResponse: cleanText(data.speechResponse, 'Warp vector locked. Approaching coordinate sector.'),
    cameraPosition: cleanVector(data.cameraPosition, [14, 6, 22]),
    cameraTarget: cleanVector(data.cameraTarget, objects[0].position),
    objects,
    audioParams: data.audioParams || { baseFreq: 60, filterCutoff: 400, lfoRate: 1.0 }
  };
}

// ---------------------------------------------------------------------------
// AI PROMPT GENERATION
// ---------------------------------------------------------------------------
function buildPromptText(commandText) {
  return `
You are controlling an advanced 3D Real-Space Simulator Engine.
User Command: "${commandText}"

CRITICAL SCIENTIFIC INTEGRITY RULE:
- ALWAYS follow true astrophysical reality and actual space object data. 
- DO NOT hallucinate fake or fictitious space objects unless explicitly requested.
- Render actual scientific layouts accurately (e.g., Saturn with ring structures, Mars alone or with Phobos/Deimos).

Rules:
1. "objects": Array of 3D objects reflecting true spatial distribution.
2. "geometryType": Choose from "sphere", "torus", "disk", "icosahedron", "blackhole".
3. "color": Scientifically accurate HEX color code.
4. "cameraPosition" & "cameraTarget": Position camera wide enough to frame the body cleanly.
5. "prompt": Flat equirectangular seamless texture prompt for planetary surface topography.

Return ONLY valid raw JSON:
{
  "sectorTitle": "Sector Name",
  "lore": "Detailed scientific telemetry explanation.",
  "speechResponse": "Concise voice announcement sentence for arrival.",
  "cameraPosition": [12, 6, 20],
  "cameraTarget": [0, 0, 0],
  "objects": [
    {
      "name": "Planet Name",
      "geometryType": "sphere",
      "geometryArgs": [2.0, 64, 64],
      "position": [0, 0, 0],
      "color": "#b9774e",
      "emissive": false,
      "emissiveColor": "#ffaa00",
      "prompt": "hyperrealistic satellite map texture",
      "animation": {"type": "spin", "axis": "y", "speed": 0.005},
      "educationalNote": "Scientific notes about this body."
    }
  ],
  "audioParams": { "baseFreq": 60.0, "filterCutoff": 400.0, "lfoRate": 1.0 }
}
`;
}

// ---------------------------------------------------------------------------
// FETCH WITH TIMEOUT & MODEL WATERFALL CASCADING
// ---------------------------------------------------------------------------
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS, parentSignal = null) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
    if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
  }
}

async function requestGeminiWorld(commandText, signal) {
  if (AI_PROXY_ENDPOINT) {
    const res = await fetchWithTimeout(AI_PROXY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: commandText, prompt: buildPromptText(commandText) })
    }, REQUEST_TIMEOUT_MS, signal);
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    const data = await res.json();
    return data.worldConfig || data;
  }

  if (!geminiKey) return null;
  const modelsToTry = dynamicModelQueue.slice(0, MAX_AI_MODELS_TO_TRY);

  for (const model of modelsToTry) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${geminiKey}`;

    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPromptText(commandText) }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }, REQUEST_TIMEOUT_MS, signal);

      if (res.status === 429 || res.status === 503) {
        console.warn(`Model ${model} rate-limited or unavailable (${res.status}). Cascading...`);
        continue;
      }
      if (!res.ok) continue;

      const data = await res.json();
      let rawJson = data.candidates[0].content.parts[0].text;
      rawJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
      if (rawJson.includes('{')) {
        rawJson = rawJson.substring(rawJson.indexOf('{'), rawJson.lastIndexOf('}') + 1);
      }
      return JSON.parse(rawJson);
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError') throw err;
      console.warn(`Model ${model} failed or timed out. Cascading...`, err);
    }
  }
  return null;
}

async function requestPollinationsWorld(commandText, signal) {
  const res = await fetchWithTimeout(POLLINATIONS_TEXT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: buildPromptText(commandText) }],
      jsonMode: true
    })
  }, 10000, signal);

  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
  const text = await res.text();
  let cleanJson = text.trim();
  if (cleanJson.includes('{')) {
    cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
  }
  return JSON.parse(cleanJson);
}

// ---------------------------------------------------------------------------
// PROCESS COMMAND
// ---------------------------------------------------------------------------
async function processCommand(commandText) {
  const command = String(commandText || '').trim();
  if (!command) return;

  const requestId = ++commandSequence;
  if (currentCommandAbort) currentCommandAbort.abort();
  const controller = new AbortController();
  currentCommandAbort = controller;

  const transcriptEl = document.getElementById('transcript');
  const hudStatusEl = document.getElementById('hud-nav-status');
  const titleEl = document.getElementById('sector-title');
  const loreEl = document.getElementById('sector-lore');
  const sendBtn = document.getElementById('send-btn');

  if (transcriptEl) transcriptEl.textContent = `"${command}"`;
  if (sendBtn) sendBtn.disabled = true;
  if (hudStatusEl) hudStatusEl.textContent = 'PROTOCOL: ASTROMETRIC_SCAN';

  speakText(`Engaging long-range astrometric sensors for target vector: ${command}.`);

  let rawConfig = null;
  try {
    if (AI_PROXY_ENDPOINT || geminiKey) {
      rawConfig = await requestGeminiWorld(command, controller.signal);
    }
    if (requestId !== commandSequence) return;

    if (!rawConfig) {
      speakText("Primary astrometric database unreachable. Engaging archival retrieval.");
      rawConfig = await requestPollinationsWorld(command, controller.signal);
    }
    if (requestId !== commandSequence) return;

    const worldConfig = rawConfig ? validateWorldConfig(rawConfig, command) : generateFallbackWorld(command);

    if (titleEl) titleEl.textContent = worldConfig.sectorTitle;
    if (loreEl) loreEl.textContent = worldConfig.lore;
    if (worldConfig.audioParams) updateAudioSynth(worldConfig.audioParams);

    applyWorldConfig(worldConfig);
    if (hudStatusEl) hudStatusEl.textContent = 'PROTOCOL: SECURED_TARGET';
    if (worldConfig.speechResponse) speakText(worldConfig.speechResponse);
  } catch (error) {
    if (requestId !== commandSequence) return;
    if (error.name !== 'AbortError') {
      console.warn("Command execution fallback triggered:", error);
      const fallback = generateFallbackWorld(command);
      if (titleEl) titleEl.textContent = fallback.sectorTitle;
      if (loreEl) loreEl.textContent = fallback.lore;
      applyWorldConfig(fallback);
      if (hudStatusEl) hudStatusEl.textContent = 'PROTOCOL: LOCAL RECOVERY';
    }
  } finally {
    if (requestId === commandSequence) {
      if (sendBtn) sendBtn.disabled = false;
      currentCommandAbort = null;
    }
  }
}

// ---------------------------------------------------------------------------
// APPLY WORLD CONFIGURATION
// ---------------------------------------------------------------------------
async function applyWorldConfig(config) {
  const hudStatusEl = document.getElementById('hud-nav-status');

  while (systemGroup.children.length > 0) {
    const obj = systemGroup.children[0];
    disposeObjectTree(obj);
    systemGroup.remove(obj);
  }

  activeAnimatedMeshes = [];
  selectedObject = null;
  updateSelectionRing();

  if (config.cameraPosition && config.cameraTarget) {
    let [cx, cy, cz] = config.cameraPosition;
    const [tx, ty, tz] = config.cameraTarget;

    const aspect = (container?.clientWidth || 1) / Math.max(1, container?.clientHeight || 1);
    if (aspect < 1) {
      const portraitMultiplier = 1.35 / aspect;
      cx *= portraitMultiplier;
      cy *= portraitMultiplier;
      cz *= portraitMultiplier;
    }

    camera.position.set(cx, cy, cz);
    if (controls) {
      controls.target.set(tx, ty, tz);
      controls.update();
    } else {
      camera.lookAt(tx, ty, tz);
    }
  }

  const spaceObjects = Array.isArray(config.objects) ? config.objects.slice(0, MAX_SCENE_OBJECTS) : [];

  for (let i = 0; i < spaceObjects.length; i++) {
    const objConfig = spaceObjects[i];

    if (hudStatusEl) hudStatusEl.textContent = `MAPPING: ${objConfig.name.toUpperCase()}`;
    speakText(`Calibrating surface albedo and topography maps for ${objConfig.name}.`);

    const root = createConfiguredObject(objConfig);
    root.position.set(...objConfig.position);
    root.name = objConfig.name;
    root.userData.isSelectableRoot = true;
    root.userData.info = objConfig.educationalNote || objConfig.name;
    systemGroup.add(root);

    activeAnimatedMeshes.push({
      mesh: root,
      type: objConfig.animation.type,
      config: objConfig.animation,
      basePosition: root.position.clone(),
      baseScale: root.scale.clone(),
      phase: 0
    });

    const texUrl = getTextureUrl(objConfig);
    if (texUrl && root.isMesh) {
      enqueueTextureLoad(root, texUrl);
    }

    if (i < spaceObjects.length - 1) {
      if (hudStatusEl) hudStatusEl.textContent = `COOLDOWN: STABILIZING ORBIT...`;
      await new Promise(resolve => setTimeout(resolve, 8500));
    }
  }

  if (hudStatusEl) hudStatusEl.textContent = 'PROTOCOL: SECURED_TARGET';
  if (config.speechResponse) speakText(config.speechResponse);
}

function createConfiguredObject(config) {
  if (config.geometryType === 'blackhole') {
    return createBlackHoleVisual(config);
  }

  const geometry = createDynamicGeometry(config.geometryType, config.geometryArgs);
  const material = new THREE.MeshStandardMaterial({
    color: config.prompt || config.customTextureUrl ? 0xffffff : new THREE.Color(config.color),
    roughness: config.roughness,
    metalness: config.metalness,
    emissive: config.emissive ? new THREE.Color(config.emissiveColor) : new THREE.Color(0x000000),
    emissiveIntensity: config.emissive ? config.emissiveIntensity : 0
  });

  const mesh = new THREE.Mesh(geometry, material);
  if (config.geometryType === 'disk') mesh.rotation.x = Math.PI / 2;

  if (config.geometryType === 'sphere' && !config.emissive) {
    addAtmosphereShell(mesh, config.geometryArgs[0] * 1.035, new THREE.Color(0x38bdf8), 0.45);
  }

  return mesh;
}

function getTextureUrl(config) {
  if (config.customTextureUrl) return config.customTextureUrl;
  if (!config.prompt) return '';

  const cleanPrompt = encodeURIComponent(
    `${config.prompt}, flat equirectangular seamless texture map, pure planetary surface topography only, zero background stars, zero lighting effects, zero framing, high-resolution game asset`
  );
  return `${POLLINATIONS_IMAGE_ENDPOINT}${cleanPrompt}?width=1024&height=512&nologo=true&model=flux&seed=${Math.floor(Math.random() * 99999)}`;
}

function disposeObjectTree(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m.dispose());
    }
  });
}

function enqueueTextureLoad(mesh, url) {
  textureQueue.push({ mesh, url });
  pumpTextureQueue();
}

function pumpTextureQueue() {
  while (activeTextureWorkers < MAX_TEXTURE_WORKERS && textureQueue.length) {
    const job = textureQueue.shift();
    activeTextureWorkers++;
    loadTextureForMesh(job.mesh, job.url)
      .catch(err => console.warn(`Texture load failed for ${job.mesh.name}:`, err))
      .finally(() => {
        activeTextureWorkers--;
        pumpTextureQueue();
      });
  }
}

async function loadTextureForMesh(mesh, url) {
  let promise = textureCache.get(url);
  if (!promise) {
    promise = textureLoader.loadAsync(url).then(tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }).catch(err => {
      if (textureCache.get(url) === promise) textureCache.delete(url);
      throw err;
    });
    textureCache.set(url, promise);
  }

  const texture = await promise;
  if (!mesh.parent || !systemGroup.getObjectById(mesh.id)) return;

  if (mesh.material && !Array.isArray(mesh.material)) {
    mesh.material.map = texture;
    mesh.material.color.set(0xffffff);
    mesh.material.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// LOCAL FALLBACK WORLD
// ---------------------------------------------------------------------------
function generateFallbackWorld(input) {
  const lower = String(input || '').toLowerCase();
  let geom = "sphere";
  let args = [2.0, 64, 64];
  let isEmissive = false;
  let baseColor = "#38bdf8";

  if (lower.includes('black hole') || lower.includes('blackhole')) {
    geom = "blackhole";
    args = [1.5];
  } else if (lower.includes('star') || lower.includes('sun')) {
    isEmissive = true;
    baseColor = "#ef4444";
  } else if (lower.includes('crystal') || lower.includes('asteroid')) {
    geom = "icosahedron";
    args = [2.0, 2];
    baseColor = "#94a3b8";
  }

  const shortTitle = input.length > 25 ? input.substring(0, 25) + "..." : input;

  return {
    sectorTitle: `Sector: ${shortTitle.toUpperCase()}`,
    lore: `Long-range sensors locked onto target coordinates for: "${input}". Spatial mapping complete.`,
    speechResponse: `Warp vector locked. Approaching coordinate sector.`,
    cameraPosition: [14, 6, 22],
    cameraTarget: [0, 0, 0],
    objects: [{
      name: shortTitle,
      geometryType: geom,
      geometryArgs: args,
      position: [0, 0, 0],
      color: baseColor,
      emissive: isEmissive,
      emissiveColor: baseColor,
      emissiveIntensity: 0.9,
      roughness: 0.35,
      metalness: 0.15,
      prompt: `photorealistic surface texture map of ${input}`,
      animation: { type: 'spin', axis: 'y', speed: 0.005 },
      educationalNote: 'Emergency local navigational backup object.'
    }],
    audioParams: { baseFreq: 60.0, filterCutoff: 450.0, lfoRate: 1.5 }
  };
}

// ---------------------------------------------------------------------------
// AUDIO SYSTEM
// ---------------------------------------------------------------------------
function initWebAudio() {
  if (audioInitialized) {
    if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    audioCtx = new AudioContextClass();
    osc1 = audioCtx.createOscillator(); osc2 = audioCtx.createOscillator();
    osc1.type = 'sawtooth'; osc2.type = 'sine';
    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass'; filterNode.frequency.value = 300;
    lfoNode = audioCtx.createOscillator(); lfoGain = audioCtx.createGain();
    lfoNode.frequency.value = 1.0; lfoGain.gain.value = 150;
    lfoNode.connect(lfoGain); lfoGain.connect(filterNode.frequency);
    masterGain = audioCtx.createGain(); masterGain.gain.value = 0.12;
    osc1.connect(filterNode); osc2.connect(filterNode);
    filterNode.connect(masterGain); masterGain.connect(audioCtx.destination);
    osc1.start(); osc2.start(); lfoNode.start();
    audioInitialized = true;
  } catch (e) {
    console.warn("Web Audio initialization failed.", e);
  }
}

function updateAudioSynth(params) {
  if (!audioInitialized || !params || !audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  const now = audioCtx.currentTime;
  if (params.baseFreq) {
    osc1.frequency.exponentialRampToValueAtTime(params.baseFreq, now + 1.5);
    osc2.frequency.exponentialRampToValueAtTime(params.baseFreq * 1.5, now + 1.5);
  }
  if (params.filterCutoff) filterNode.frequency.exponentialRampToValueAtTime(params.filterCutoff, now + 1.5);
  if (params.lfoRate) lfoNode.frequency.linearRampToValueAtTime(params.lfoRate, now + 1.5);
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = 0.85; utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// RENDER LOOP & ANIMATION HANDLERS
// ---------------------------------------------------------------------------
const animationHandlers = {
  none() {},
  spin(item, elapsed, dt) {
    const cfg = item.config;
    item.mesh.rotation[cfg.axis || 'y'] += cfg.speed * (dt * 60);
  },
  pulse(item, elapsed) {
    const factor = 1 + Math.sin(elapsed * item.config.frequency) * item.config.amplitude;
    item.mesh.scale.copy(item.baseScale).multiplyScalar(factor);
  },
  bob(item, elapsed) {
    item.mesh.position.copy(item.basePosition);
    item.mesh.position.y += Math.sin(elapsed * item.config.frequency) * item.config.amplitude * 4;
  },
  orbit(item, elapsed) {
    const cfg = item.config;
    const radius = cfg.radius || 3;
    const angle = elapsed * cfg.speed;
    item.mesh.position.set(
      cfg.center[0] + Math.cos(angle) * radius,
      item.basePosition.y,
      cfg.center[2] + Math.sin(angle) * radius
    );
  }
};

function animate(now = 0) {
  requestAnimationFrame(animate);
  const dt = lastFrameTime ? Math.min(Math.max((now - lastFrameTime) / 1000, 0), MAX_FRAME_DELTA) : 0;
  lastFrameTime = now;
  elapsedSeconds += dt;

  if (starMaterial?.uniforms?.uTime) starMaterial.uniforms.uTime.value = elapsedSeconds;
  if (starField && camera) {
    starField.position.copy(camera.position);
    starField.rotation.y = elapsedSeconds * 0.001;
  }

  for (const item of activeAnimatedMeshes) {
    if (!item.mesh || !item.mesh.parent) continue;
    const handler = animationHandlers[item.type] || animationHandlers.spin;
    try {
      handler(item, elapsedSeconds, dt);

      if (item.mesh.userData?.isBlackHoleVisual) {
        const disk = item.mesh.getObjectByName('AccretionDisk');
        if (disk) disk.rotation.z += dt * 0.5;
      }
    } catch (e) {
      console.warn("Animation error:", e);
    }
  }

  if (controls) controls.update();
  if (selectionRing && selectedObject?.parent) updateSelectionRing();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

init();
