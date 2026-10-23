import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- GLOBALS ---
let scene, camera, renderer, starField, starMaterial;
let geminiKey = localStorage.getItem('gemini_api_key') || '';
let dynamicModelQueue = ['gemini-2.5-flash']; // Safe default fallback until discovered

let systemGroup;
let controls;
let activeAnimatedMeshes = [];
let elapsedSeconds = 0;
let lastFrameTime = 0;
let textureLoader = new THREE.TextureLoader();

// Control & Request Globals
let currentCommandAbort = null;
let commandSequence = 0;

// Audio System Globals
let audioCtx, osc1, osc2, filterNode, lfoNode, lfoGain;
let audioInitialized = false;
let isListening = false;

// Multi-Language State Globals
let currentLang = 'en-US';

// --- INITIALIZATION ---
async function init() {
  setupSecurity();
  setupLanguageListener();
  initThreeJS();
  setupControls();
  animate(0);

  if (geminiKey) {
    await discoverGeminiModels();
  }

  const bootOverlay = document.getElementById('boot-overlay');
  if (bootOverlay) {
    bootOverlay.style.transition = 'opacity 500ms ease';
    bootOverlay.style.opacity = '0';
    setTimeout(() => bootOverlay.remove(), 500);
  }
}

// --- LANGUAGE LISTENER SETUP ---
function setupLanguageListener() {
  const langSelect = document.getElementById('lang-select');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      currentLang = e.target.value;
      
      // Automatic RTL layout switching for Hebrew, Arabic, Persian, Urdu, etc.
      const isRTL = ['he-IL', 'ar-SA', 'fa-IR', 'ur-PK', 'ps-AF', 'sd-PK'].includes(currentLang);
      document.body.dir = isRTL ? 'rtl' : 'ltr';
      
      console.log(`[LANGUAGE SYSTEM] Active Locale switched to: ${currentLang} (RTL: ${isRTL})`);
    });
  }
}

// --- DYNAMIC MODEL DISCOVERY & WATERFALL BUILDER ---
async function discoverGeminiModels() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    if (data && data.models) {
      const validModels = data.models
        .filter(m => 
          m.supportedGenerationMethods?.includes('generateContent') &&
          !m.name.includes('tts') &&
          !m.name.includes('embedding') &&
          !m.name.includes('transcribe') &&
          !m.name.includes('image') &&
          !m.name.includes('gemma')
        )
        .map(m => ({
          id: m.name.replace('models/', ''),
          versionString: m.version || '',
          description: m.description || ''
        }));

      validModels.sort((a, b) => {
        const getVer = (str) => {
          const match = str.match(/(\d+(\.\d+)?)/);
          return match ? parseFloat(match[0]) : 0;
        };

        const vA = getVer(a.id);
        const vB = getVer(b.id);
        if (vA !== vB) return vB - vA;

        const getDateVal = (str) => {
          const match = str.match(/(\d{2})-(\d{4})/);
          if (match) return parseInt(match[2]) * 100 + parseInt(match[1]);
          return 0;
        };

        const dateA = getDateVal(a.versionString);
        const dateB = getDateVal(b.versionString);
        if (dateA !== dateB) return dateB - dateA;

        const aFlash = a.id.includes('flash') ? 1 : 0;
        const bFlash = b.id.includes('flash') ? 1 : 0;
        return bFlash - aFlash;
      });

      if (validModels.length > 0) {
        dynamicModelQueue = validModels.map(m => m.id);
        speakText("Astrometric navigation telemetry online. Subspace ephemeris calibration complete.");
      }
    }
  } catch (err) {
    console.warn("Could not fetch dynamic model list, using default fallback queue.", err);
  }
}

function setupSecurity() {
  const tokenInput = document.getElementById('hf-token-input');
  const tokenBtn = document.getElementById('save-token-btn');
  const status = document.getElementById('token-status');

  if (geminiKey) {
    if (tokenInput) tokenInput.value = geminiKey;
    if (status) {
      status.innerText = "Gemini API Key active.";
      status.style.color = "#4ade80";
    }
  } else if (status) {
    status.innerText = "Running via Pollinations fallback (Add Gemini key for priority access).";
    status.style.color = "#fbbf24";
  }

  if (tokenBtn) {
    tokenBtn.addEventListener('click', async () => {
      const key = tokenInput.value.trim();
      if (key) {
        localStorage.setItem('gemini_api_key', key);
        geminiKey = key;
        status.innerText = "Gemini Key Saved! AI Navigation Active.";
        status.style.color = "#4ade80";
        await discoverGeminiModels();
      } else {
        localStorage.removeItem('gemini_api_key');
        geminiKey = '';
        status.innerText = "Key cleared. Using Pollinations fallback.";
        status.style.color = "#fbbf24";
      }
    });
  }
}

// --- THREE.JS INITIALIZATION ---
function initThreeJS() {
  const container = document.getElementById('viewport') || document.body;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);
  scene.fog = new THREE.FogExp2(0x02040a, 0.0012);

  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 25000);
  camera.position.set(0, 5, 15);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  systemGroup = new THREE.Group();
  scene.add(systemGroup);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.8);
  dirLight.position.set(25, 18, 22);
  scene.add(dirLight);

  const ambientLight = new THREE.AmbientLight(0x182035, 0.6);
  scene.add(ambientLight);

  createEnhancedStarfield();
  createInitialPlanet();

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

function createInitialPlanet() {
  const geo = new THREE.SphereGeometry(2.0, 64, 48);
  const planetMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x197da8, 
    roughness: 0.55, 
    metalness: 0.05
  });
  const planet = new THREE.Mesh(geo, planetMaterial);
  planet.name = 'Starter World';
  systemGroup.add(planet);

  addAtmosphereShell(planet, 2.08, new THREE.Color(0x38bdf8), 0.55);

  activeAnimatedMeshes.push({
    mesh: planet,
    type: 'spin',
    speed: 0.05,
    distance: 0
  });
}

function createEnhancedStarfield() {
  const count = 6000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const z = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const radius = 300 + Math.random() * 500;
    positions[i * 3] = radial * Math.cos(theta) * radius;
    positions[i * 3 + 1] = z * radius;
    positions[i * 3 + 2] = radial * Math.sin(theta) * radius;
    sizes[i] = 1.0 + Math.random() * 2.0;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

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
        gl_PointSize = clamp(aSize * (240.0 / max(1.0, -viewPosition.z)), 1.0, 3.5);
        vAlpha = 0.6 + 0.4 * sin(uTime * (0.8 + aPhase * 0.1) + aPhase);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        float mask = 1.0 - smoothstep(0.1, 0.5, dist);
        gl_FragColor = vec4(vec3(0.8, 0.9, 1.0), mask * vAlpha);
      }
    `
  });

  starField = new THREE.Points(starGeo, starMaterial);
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
          float rim = pow(1.0 - facing, 2.5);
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

// --- PROCEDURAL SPIRAL GALAXY PARTICLE GENERATOR ---
function createSpiralGalaxyPoints(baseColorHex) {
  const particleCount = 12000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  const baseColor = new THREE.Color(baseColorHex || 0x38bdf8);
  const coreColor = new THREE.Color(0xffffff);
  const arms = 2;
  const radius = 12.0;

  for (let i = 0; i < particleCount; i++) {
    const r = Math.pow(Math.random(), 1.5) * radius;
    const armAngle = ((i % arms) / arms) * Math.PI * 2;
    const spiralAngle = r * 0.75;
    const scatter = (Math.random() - 0.5) * 1.2 * (r / radius + 0.2);

    const theta = armAngle + spiralAngle + scatter;

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y = (Math.random() - 0.5) * 0.8 * (radius - r) * 0.2;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const mixedColor = coreColor.clone().lerp(baseColor, r / radius);
    colors[i * 3] = mixedColor.r;
    colors[i * 3 + 1] = mixedColor.g;
    colors[i * 3 + 2] = mixedColor.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const galaxyPoints = new THREE.Points(geometry, material);
  galaxyPoints.frustumCulled = false;
  return galaxyPoints;
}

// --- MCGS v1.0 GEOMETRY FACTORY ---
function createDynamicGeometry(type, args) {
  const p = args || [];
  switch (type ? type.toLowerCase() : 'sphere') {
    case 'torus':
    case 'accretion_disk':
      return new THREE.TorusGeometry(p[0] || 3.2, p[1] || 0.3, p[2] || 64, p[3] || 128);
    case 'disk':
    case 'ring':
    case 'planetary_ring':
      return new THREE.RingGeometry(p[0] || 2.4, p[1] || 4.8, p[2] || 128);
    case 'icosahedron':
    case 'asteroid':
    case 'comet':
      return new THREE.IcosahedronGeometry(p[0] || 2.0, p[1] || 3);
    case 'cone':
    case 'jet':
      return new THREE.ConeGeometry(p[0] || 0.3, p[1] || 16.0, p[2] || 64, p[3] || 64);
    case 'shell':
    case 'supernova_shell':
      return new THREE.SphereGeometry(p[0] || 6.0, p[1] || 64, p[2] || 64);
    case 'sphere':
    default:
      return new THREE.SphereGeometry(p[0] || 2.0, p[1] || 64, p[2] || 64);
  }
}

// --- NEXT-GEN PROCEDURAL PLASMA & FLUID TURBULENCE SHADER ---
function createPlasmaShaderMaterial(baseColorHex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(baseColorHex || 0x38bdf8) }
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;

      float noise(vec3 p) {
        return sin(p.x * 4.0 + uTime) * cos(p.y * 4.0 + uTime) * sin(p.z * 4.0 + uTime);
      }

      void main() {
        vNormal = normal;
        vPosition = position;
        vec3 displaced = position + normal * (noise(position * 0.5) * 0.35);
        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBaseColor;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        float intensity = 0.6 + 0.4 * sin(vPosition.y * 0.8 + uTime * 2.0);
        vec3 finalColor = uBaseColor * intensity + vec3(0.2, 0.05, 0.4) * cos(uTime);
        gl_FragColor = vec4(finalColor, 0.82);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

// --- AUDIO SYSTEM (Refined Warm Ambient Space Pad) ---
function initWebAudio() {
  if (audioInitialized) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  osc1 = audioCtx.createOscillator(); 
  osc2 = audioCtx.createOscillator();
  osc1.type = 'sine'; 
  osc2.type = 'triangle';
  osc2.detune.value = 6;

  filterNode = audioCtx.createBiquadFilter();
  filterNode.type = 'lowpass'; 
  filterNode.frequency.value = 240;

  lfoNode = audioCtx.createOscillator(); 
  lfoGain = audioCtx.createGain();
  lfoNode.frequency.value = 0.35;
  lfoGain.gain.value = 70;
  
  lfoNode.connect(lfoGain); 
  lfoGain.connect(filterNode.frequency);

  const masterGain = audioCtx.createGain(); 
  masterGain.gain.value = 0.08;

  osc1.connect(filterNode); 
  osc2.connect(filterNode);
  filterNode.connect(masterGain); 
  masterGain.connect(audioCtx.destination);

  osc1.start(); 
  osc2.start(); 
  lfoNode.start();
  audioInitialized = true;
}

function updateAudioSynth(params) {
  if (!audioInitialized || !params) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  if (params.baseFreq) osc1.frequency.exponentialRampToValueAtTime(params.baseFreq, now + 1.5);
  if (params.baseFreq) osc2.frequency.exponentialRampToValueAtTime(params.baseFreq * 1.5, now + 1.5);
  if (params.filterCutoff) filterNode.frequency.exponentialRampToValueAtTime(params.filterCutoff, now + 1.5);
  if (params.lfoRate) lfoNode.frequency.linearRampToValueAtTime(params.lfoRate, now + 1.5);
}

let lastSpokenText = '';
function speakText(text, force = false) {
  if (!('speechSynthesis' in window)) return;
  if (!force && text === lastSpokenText) return;
  lastSpokenText = text;
  
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = currentLang;

  // Retrieve all installed TTS voices on the device and match native voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => 
    v.lang === currentLang || 
    v.lang.startsWith(currentLang.split('-')[0])
  );

  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.pitch = 0.85; 
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

// Pre-load voices (Chrome populates getVoices asynchronously)
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// --- PROCESS COMMAND WITH REAL-TIME STAGED HUD & SPEECH TELEMETRY ---
async function processCommand(commandText) {
  const requestId = ++commandSequence;
  if (currentCommandAbort) currentCommandAbort.abort();
  const controller = new AbortController();
  currentCommandAbort = controller;

  const transcriptEl = document.getElementById('transcript');
  const hudStatusEl = document.getElementById('hud-nav-status');
  const titleEl = document.getElementById('sector-title');
  const loreEl = document.getElementById('sector-lore');
  const liveCodeEl = document.getElementById('live-code') || document.querySelector('.sidebar pre') || document.querySelector('#sidebar pre') || document.getElementById('code-preview');

  if (transcriptEl) transcriptEl.innerText = `"${commandText}"`;

  // STAGE 1: SCANNING INPUT
  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: ASTROMETRIC_SCAN';
  speakText(`Engaging navigational sensors for vector: ${commandText}.`);

  console.log(`%c[ASTROMETRIC LIFECYCLE] 🚀 STAGE 1: INPUT TO AI NAVIGATION COMPUTER`, `color: #38bdf8; font-weight: bold;`);
  console.log(`👉 User Nav Command: "${commandText}"`);
  const aiPromptPayload = buildPromptText(commandText);

  let worldConfig = null;

  // STAGE 2: EPHEMERIS CALCULATION & MODEL QUERYING
  if (hudStatusEl) hudStatusEl.innerText = 'EPHEMERIS: CALCULATING...';
  speakText("Calculating subspace ephemeris and sector coordinates.");

  if (geminiKey && dynamicModelQueue.length > 0) {
    for (let i = 0; i < dynamicModelQueue.length; i++) {
      if (requestId !== commandSequence) return;
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 12000);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${dynamicModelQueue[i]}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: aiPromptPayload }] }],
            generationConfig: { responseMimeType: "application/json" }
          }),
          signal: timeoutController.signal
        });

        clearTimeout(timeoutId);

        if (res.status === 429 || res.status === 503) {
          continue; 
        }

        if (res.ok) {
          const data = await res.json();
          let rawJson = data.candidates[0].content.parts[0].text;
          rawJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
          if (rawJson.includes('{')) {
            rawJson = rawJson.substring(rawJson.indexOf('{'), rawJson.lastIndexOf('}') + 1);
          }
          worldConfig = JSON.parse(rawJson);
          break; 
        }
      } catch (err) {
        clearTimeout(timeoutId);
      }
    }
  }

  if (!worldConfig && requestId === commandSequence) {
    try {
      const pController = new AbortController();
      const pTimeoutId = setTimeout(() => pController.abort(), 10000);
      const pRes = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: aiPromptPayload }],
          jsonMode: true
        }),
        signal: pController.signal
      });
      clearTimeout(pTimeoutId);

      if (pRes.ok) {
        const pText = await pRes.text();
        let cleanJson = pText.trim();
        if (cleanJson.includes('{')) {
          cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
        }
        worldConfig = JSON.parse(cleanJson);
      }
    } catch (e) {}
  }

  if (!worldConfig && requestId === commandSequence) {
    console.warn(`[ASTROMETRIC LIFECYCLE] ⚠ AI generation failed or timed out. Falling back to local procedural world generator.`);
    worldConfig = generateFallbackWorld(commandText);
  }

  if (requestId !== commandSequence) return;

  console.log(`%c[ASTROMETRIC LIFECYCLE] 🤖 STAGE 2: OUTPUT FROM AI NAVIGATION COMPUTER`, `color: #4ade80; font-weight: bold;`);
  console.log(`📦 Parsed Sector Ephemeris Object (JSON Output):`, worldConfig);

  if (titleEl && worldConfig.sectorTitle) titleEl.innerText = worldConfig.sectorTitle;
  if (loreEl && worldConfig.lore) loreEl.innerText = worldConfig.lore;
  if (worldConfig.audioParams) updateAudioSynth(worldConfig.audioParams);

  if (liveCodeEl) {
    liveCodeEl.innerText = JSON.stringify(worldConfig, null, 2);
  }

  // STAGE 3: MAPPING SECTOR ASSETS
  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: MAPPING SECTOR';
  speakText(worldConfig.speechResponse || "Sector coordinates acquired. Materializing structural objects.");

  await applyWorldConfig(worldConfig, hudStatusEl);
}

// --- ONBOARD ASTROMETRIC NAVIGATION & EPHEMERAL COMPUTER PROMPT ---
function buildPromptText(commandText) {
  return `
You are a precise, scientifically accurate astronomical ephemeris generator.
User Navigation Command: "${commandText}"
Target Language Locale Code: "${currentLang}"

STRICT SCIENTIFIC FACTUALITY & REALISM RULES:
1. STRICT ASTRONOMICAL ACCURACY: Rely strictly on real-world astronomical facts (NASA/IAU databases). NEVER invent fake catalog numbers (e.g., do NOT use invented IDs like "PL-9820"), fictional sci-fi protocols, or non-existent exoplanet designations for real solar system objects.
2. REAL-WORLD CLASSIFICATION: Correctly classify target bodies. Pluto is a "Dwarf Planet in the Kuiper Belt", NOT an exoplanet.
3. FACTUAL GEOMETRY ONLY: Only generate ring systems ("ring" or "planetary_ring") for celestial bodies that scientifically possess verified rings (e.g., Saturn, Uranus, Neptune, Jupiter, Chariklo). Do NOT add fictional rings to Pluto, Earth, Mars, or non-ringed bodies.
4. ACCURATE LORE & TELEMETRY: In "sectorTitle" and "lore", provide strictly factual scientific details regarding atmosphere, composition, distance, and known moons.
5. MULTILINGUAL OUTPUT: Respond with all text telemetry fields ("sectorTitle", "lore", and "speechResponse") written natively in the language specified by locale code "${currentLang}".
6. ENGLISH TEXTURE PROMPTS: Keep the internal "prompt" field detailed and written in English for texture synthesis.

Return ONLY valid raw JSON matching this structure:
{
  "sectorTitle": "Factual Celestial Name & Classification (In target language)",
  "lore": "Scientifically accurate astronomical description (In target language)",
  "speechResponse": "Concise factual arrival telemetry statement (In target language)",
  "cameraPosition": [0, 25, 50],
  "cameraTarget": [0, 0, 0],
  "objects": [
    {
      "name": "Factual Object Name",
      "geometryType": "sphere",
      "geometryArgs": [2.0, 64, 48],
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "distance": 12.0,
      "orbitalSpeed": 0.02,
      "color": "#38bdf8",
      "emissive": false,
      "emissiveColor": "#ffaa00",
      "emissiveIntensity": 0,
      "roughness": 0.45,
      "metalness": 0.08,
      "prompt": "Detailed surface topography prompt in English for texture synthesis",
      "animationType": "orbit",
      "animationSpeed": 0.02
    }
  ],
  "audioParams": { "baseFreq": 60.0, "filterCutoff": 400.0, "lfoRate": 1.0 }
}
`;
}

// STABILIZED: Robust texture retry with intelligent rate-limit backoff handling & staggered padding
async function loadTextureWithThrottle(url, maxRetries = 3, initialDelay = 5000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let blobUrl = null;
    try {
      const response = await fetch(url);
      if (response.status === 402 || response.status === 429) {
        throw new Error(`RATE_LIMIT_${response.status}`);
      }
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      
      const blob = await response.blob();
      blobUrl = URL.createObjectURL(blob);
      const texture = await textureLoader.loadAsync(blobUrl);
      URL.revokeObjectURL(blobUrl);
      return texture;
    } catch (err) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (attempt === maxRetries) throw err;

      const multiplier = err.message.includes('RATE_LIMIT') ? 3.0 : (attempt + 1);
      const waitTime = initialDelay * multiplier;
      console.warn(`[TEXTURE ENGINE] Attempt ${attempt + 1} failed (${err.message}). Retrying in ${waitTime / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// --- ASYNC PARALLEL MATERIALIZATION PIPELINE ---
async function applyWorldConfig(config, hudStatusEl) {
  while (systemGroup.children.length > 0) {
    const obj = systemGroup.children[0];
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    systemGroup.remove(obj);
  }

  activeAnimatedMeshes = [];

  if (config.cameraPosition && config.cameraTarget) {
    let [cx, cy, cz] = config.cameraPosition;
    const [tx, ty, tz] = config.cameraTarget;

    const container = document.getElementById('viewport') || document.body;
    const aspect = container.clientWidth / container.clientHeight;
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

  const spaceObjects = config.objects || [config];
  console.log(`[ASTROMETRIC NAVIGATION] 🌌 Initializing Sector: "${config.sectorTitle || 'Unknown Sector'}". Target Object Count: ${spaceObjects.length}`);

  const assetPromises = spaceObjects.map(async (objConfig, index) => {
    const nameLower = (objConfig.name || '').toLowerCase();
    const promptLower = (objConfig.prompt || '').toLowerCase();
    const geomLower = (objConfig.geometryType || '').toLowerCase();

    const isSpiralGalaxy = geomLower === 'spiral_galaxy' || nameLower.includes('milky way') || nameLower.includes('galaxy') || nameLower.includes('andromeda');
    const isFlatRing = geomLower === 'ring' || geomLower === 'disk' || geomLower === 'planetary_ring' || geomLower === 'accretion_disk';
    const isGaseousPhenomenon = isSpiralGalaxy ||
      ['jet', 'cone', 'shell', 'supernova_shell'].includes(geomLower) ||
      nameLower.includes('nebula') || nameLower.includes('filament') || 
      nameLower.includes('plasma cloud') || nameLower.includes('synchrotron') ||
      promptLower.includes('nebula') || promptLower.includes('ionized gas cloud') || 
      promptLower.includes('synchrotron radiation') || promptLower.includes('stellar remnant') ||
      promptLower.includes('pillar') || promptLower.includes('cliff');

    const stageText = `MAPPING: ${objConfig.name.toUpperCase()}`;
    if (hudStatusEl) {
      hudStatusEl.innerText = stageText;
    }
    speakText(`Materializing celestial component: ${objConfig.name}.`);

    let mesh;
    let finalMaterial;

    if (isSpiralGalaxy) {
      mesh = createSpiralGalaxyPoints(objConfig.color || '#38bdf8');
      mesh.frustumCulled = false;
      finalMaterial = mesh.material;
    } else {
      const geom = createDynamicGeometry(objConfig.geometryType, objConfig.geometryArgs);
      const ghostMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.35
      });

      mesh = new THREE.Mesh(geom, ghostMat);
      
      if (isFlatRing || isGaseousPhenomenon) {
        mesh.frustumCulled = false;
      }

      if (isGaseousPhenomenon) {
        finalMaterial = createPlasmaShaderMaterial(objConfig.color || '#38bdf8');
      } else {
        let loadedTexture = null;
        if (objConfig.prompt) {
          let specificPrompt = '';
          if (isGaseousPhenomenon || isSpiralGalaxy) {
            specificPrompt = encodeURIComponent(
              `${objConfig.prompt}, James Webb Space Telescope infrared photography style, hyperrealistic vibrant multi-chromatic iridescent gas plumes, glowing golden-brown dust ridges, intricate radiant stellar nurseries, brilliant diffraction spike stars, deep space backdrop, masterpiece, 8k resolution`
            );
          } else {
            specificPrompt = encodeURIComponent(
              `${objConfig.prompt}, flat equirectangular seamless texture map, pure planetary surface topography only, micro-surface relief, high-frequency textural detail, crisp albedo, zero background stars, zero lighting effects, zero framing, 4k resolution game asset`
            );
          }

          const texUrl = `https://image.pollinations.ai/prompt/${specificPrompt}?width=2048&height=1024&nologo=true&model=flux&seed=${Math.floor(Math.random() * 99999)}`;
          
          try {
            textureLoader.setCrossOrigin('anonymous');
            const requestDelay = 600 + (index * 800);
            await new Promise(resolve => setTimeout(resolve, requestDelay));

            loadedTexture = await loadTextureWithThrottle(texUrl, 3, 6000);
            if (loadedTexture) {
              loadedTexture.colorSpace = THREE.SRGBColorSpace;
              loadedTexture.needsUpdate = true;
            }
          } catch (err) {
            console.warn(`[ASTROMETRIC LIFECYCLE] ✖ Texture FAILED for [${objConfig.name}]. Falling back to PBR material.`, err);
          }
        }

        finalMaterial = new THREE.MeshStandardMaterial({
          color: loadedTexture ? 0xffffff : new THREE.Color(objConfig.color || 0x38bdf8),
          roughness: objConfig.roughness || 0.4,
          metalness: objConfig.metalness || 0.1,
          emissive: objConfig.emissive ? new THREE.Color(objConfig.emissiveColor || 0xffaa00) : 0x000000,
          emissiveIntensity: objConfig.emissive ? (objConfig.emissiveIntensity || 0.9) : 0,
          map: loadedTexture || null,
          side: THREE.DoubleSide,
          transparent: isFlatRing || (loadedTexture ? false : true)
        });
      }

      if (geomLower === 'sphere' && !objConfig.emissive && !isGaseousPhenomenon) {
        addAtmosphereShell(mesh, (objConfig.geometryArgs?.[0] || 2.0) * 1.035, new THREE.Color(0x38bdf8), 0.25);
      }
    }

    if (objConfig.position && Array.isArray(objConfig.position)) {
      mesh.position.set(...objConfig.position);
    }

    if (objConfig.rotation && Array.isArray(objConfig.rotation)) {
      mesh.rotation.set(...objConfig.rotation);
    } else if (isFlatRing) {
      mesh.rotation.set(Math.PI / 2.8, 0.2, 0.1); 
    }

    systemGroup.add(mesh);
    if (!isSpiralGalaxy && mesh.material) {
      mesh.material.dispose();
      mesh.material = finalMaterial;
    }

    let derivedOrbitalSpeed = objConfig.orbitalSpeed || objConfig.animationSpeed || 0.05;
    let derivedSpinSpeed = isFlatRing ? 0 : (objConfig.animationSpeed || 0.05);

    if (objConfig.distance && objConfig.distance > 0) {
      derivedOrbitalSpeed = 0.15 / Math.sqrt(objConfig.distance);
      if (!isFlatRing) derivedSpinSpeed = derivedOrbitalSpeed * 2.5; 
    }

    return {
      mesh: mesh,
      type: isFlatRing ? 'orbit' : (objConfig.animationType || 'spin'),
      speed: derivedSpinSpeed,
      orbitalSpeed: derivedOrbitalSpeed,
      distance: objConfig.distance || 0,
      phaseOffset: Math.random() * Math.PI * 2,
      isRing: isFlatRing
    };
  });

  const resolvedAnims = await Promise.all(assetPromises);
  activeAnimatedMeshes.push(...resolvedAnims);

  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: SECURED_TARGET';
  speakText("Sector materialization complete. All astrometric systems nominal.");
}

function generateFallbackWorld(input) {
  const shortTitle = input.length > 25 ? input.substring(0, 25) + "..." : input;
  const isGalaxyQuery = input.toLowerCase().includes('galaxy') || input.toLowerCase().includes('milky way') || input.toLowerCase().includes('andromeda');

  return {
    sectorTitle: `Sector: ${shortTitle.toUpperCase()}`,
    lore: `Ship navigation sensors locked onto target coordinates for: "${input}".`,
    speechResponse: `Warp vector locked. Approaching coordinate sector.`,
    cameraPosition: [14, 6, 22],
    cameraTarget: [0, 0, 0],
    objects: [{
      name: shortTitle,
      geometryType: isGalaxyQuery ? 'spiral_galaxy' : 'sphere',
      geometryArgs: [2.0, 64, 48],
      position: [0, 0, 0],
      distance: 0,
      color: "#38bdf8",
      emissive: false,
      roughness: 0.4,
      metalness: 0.1,
      prompt: `photorealistic surface texture map of ${input}`,
      animationType: 'spin',
      animationSpeed: 0.05
    }],
    audioParams: { baseFreq: 60.0, filterCutoff: 450.0, lfoRate: 1.5 }
  };
}

// --- SETUP CONTROLS ---
function setupControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = true;
  controls.minDistance = 1.2;
  controls.maxDistance = 10000;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;

  const micBtn = document.getElementById('mic-btn');
  const manualInput = document.getElementById('manual-input');
  const sendBtn = document.getElementById('send-btn');
  const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
  const sidebar = document.getElementById('sidebar');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (micBtn) micBtn.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  if (manualInput) manualInput.disabled = false;

  if (mobileToggleBtn && sidebar) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      mobileToggleBtn.innerText = sidebar.classList.contains('mobile-open') ? '✕ Close' : '⚙️ Controls';
      setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.warn(err));
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });
  }

  if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();

    micBtn.addEventListener('click', () => {
      initWebAudio();
      if (isListening) { recognition.stop(); return; }
      try {
        recognition.lang = currentLang;
        recognition.start();
        isListening = true;
        micBtn.classList.add('listening');
      } catch (e) {}
    });

    recognition.onresult = (event) => {
      isListening = false;
      micBtn.classList.remove('listening');
      processCommand(event.results[0][0].transcript);
    };

    recognition.onerror = () => { isListening = false; micBtn.classList.remove('listening'); };
    recognition.onend = () => { isListening = false; micBtn.classList.remove('listening'); };
  }

  if (sendBtn && manualInput) {
    sendBtn.addEventListener('click', () => {
      if (manualInput.value.trim()) {
        initWebAudio();
        processCommand(manualInput.value.trim());
        manualInput.value = '';
      }
    });

    manualInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && manualInput.value.trim()) {
        initWebAudio();
        processCommand(manualInput.value.trim());
        manualInput.value = '';
      }
    });
  }
}

// --- ANIMATION HANDLERS ---
const animationHandlers = {
  spin(anim, dt) {
    if (anim.isRing) return; 
    anim.mesh.rotation.y += anim.speed * (dt * 60);
  },
  tumble(anim, dt) {
    if (anim.isRing) return;
    anim.mesh.rotation.x += anim.speed * 0.7 * (dt * 60);
    anim.mesh.rotation.y += anim.speed * (dt * 60);
    anim.mesh.rotation.z += anim.speed * 0.4 * (dt * 60);
  },
  pulse(anim, time) {
    if (anim.isRing) return;
    const scale = 1.0 + Math.sin(time * 3.0 * anim.speed) * 0.04;
    anim.mesh.scale.set(scale, scale, scale);
  },
  orbit(anim, time, dt) {
    if (anim.distance && anim.distance > 0) {
      const effectiveSpeed = anim.orbitalSpeed || anim.speed;
      const angle = time * effectiveSpeed + (anim.phaseOffset || 0);
      anim.mesh.position.x = Math.cos(angle) * anim.distance;
      anim.mesh.position.z = Math.sin(angle) * anim.distance;
    }
    if (!anim.isRing) {
      anim.mesh.rotation.y += anim.speed * (dt * 60);
    }
  }
};

// --- ANIMATION LOOP ---
function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001;
  const dt = lastFrameTime ? Math.min(Math.max((t - lastFrameTime), 0), 0.05) : 0;
  lastFrameTime = t;

  if (starMaterial?.uniforms?.uTime) {
    starMaterial.uniforms.uTime.value = t;
  }
  if (starField && camera) {
    starField.position.copy(camera.position);
    starField.rotation.y = t * 0.001;
  }

  activeAnimatedMeshes.forEach((anim) => {
    if (anim.mesh && anim.mesh.parent) {
      if (anim.mesh.material && anim.mesh.material.uniforms && anim.mesh.material.uniforms.uTime) {
        anim.mesh.material.uniforms.uTime.value = t;
      }
      const handler = animationHandlers[anim.type] || animationHandlers.spin;
      handler(anim, t, dt || t);
    }
  });

  if (controls) controls.update();
  renderer.render(scene, camera);
}

init();
