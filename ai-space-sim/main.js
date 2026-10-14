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

// Strict Texture Queue & Timeout Globals
let currentCommandAbort = null;
let commandSequence = 0;

// Audio System Globals
let audioCtx, osc1, osc2, filterNode, lfoNode, lfoGain;
let audioInitialized = false;
let isListening = false;

// --- INITIALIZATION ---
async function init() {
  setupSecurity();
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
        console.log("Compiled newest-first Gemini model waterfall:", dynamicModelQueue);
        speakText("Astrometric telemetry online. Subspace neural calibration sequence complete.");
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
        status.innerText = "Gemini Key Saved! AI Engine Active.";
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

// --- AAA-GRADE THREE.JS INITIALIZATION ---
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

  // Cinematic Filmic Color Pipeline
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

  // Cinematic Lighting
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
    config: { speed: 0.1, axis: 'y' }
  });
}

// GPU-Driven Starfield Shader (Replaces per-frame JS buffer rewrites)[cite: 1, 2]
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

function createDynamicGeometry(type, args) {
  const p = args || [];
  switch (type ? type.toLowerCase() : 'sphere') {
    case 'torus':
    case 'blackhole':
    case 'ring_world':
      return new THREE.TorusGeometry(p[0] || 2.5, p[1] || 0.4, p[2] || 32, p[3] || 128);
    case 'icosahedron':
    case 'crystal':
    case 'asteroid':
      return new THREE.IcosahedronGeometry(p[0] || 2.0, p[1] || 2);
    case 'disk':
    case 'quasar_core':
      return new THREE.RingGeometry(p[0] || 0.4, p[1] || 4.5, p[2] || 64);
    case 'sphere':
    default:
      return new THREE.SphereGeometry(p[0] || 2.0, p[1] || 64, p[2] || 48);
  }
}

// --- AUDIO SYSTEM ---
function initWebAudio() {
  if (audioInitialized) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc1 = audioCtx.createOscillator(); osc2 = audioCtx.createOscillator();
  osc1.type = 'sawtooth'; osc2.type = 'sine';
  filterNode = audioCtx.createBiquadFilter();
  filterNode.type = 'lowpass'; filterNode.frequency.value = 300;
  lfoNode = audioCtx.createOscillator(); lfoGain = audioCtx.createGain();
  lfoNode.frequency.value = 1.0; lfoGain.gain.value = 150;
  lfoNode.connect(lfoGain); lfoGain.connect(filterNode.frequency);
  const masterGain = audioCtx.createGain(); masterGain.gain.value = 0.12;
  osc1.connect(filterNode); osc2.connect(filterNode);
  filterNode.connect(masterGain); masterGain.connect(audioCtx.destination);
  osc1.start(); osc2.start(); lfoNode.start();
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

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = 0.85; utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

// --- PROCESS COMMAND WITH WATERFALL & 12S TIMEOUT ---
async function processCommand(commandText) {
  const requestId = ++commandSequence;
  if (currentCommandAbort) currentCommandAbort.abort();
  const controller = new AbortController();
  currentCommandAbort = controller;

  const transcriptEl = document.getElementById('transcript');
  const hudStatusEl = document.getElementById('hud-nav-status');
  const titleEl = document.getElementById('sector-title');
  const loreEl = document.getElementById('sector-lore');

  if (transcriptEl) transcriptEl.innerText = `"${commandText}"`;
  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: ASTROMETRIC_SCAN';

  speakText(`Engaging long-range astrometric sensors for target vector: ${commandText}.`);

  let worldConfig = null;

  if (geminiKey && dynamicModelQueue.length > 0) {
    for (let i = 0; i < dynamicModelQueue.length; i++) {
      if (requestId !== commandSequence) return;
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 12000);

      try {
        if (hudStatusEl) hudStatusEl.innerText = `UPLINK: CALIBRATING...`;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${dynamicModelQueue[i]}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPromptText(commandText) }] }],
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
          messages: [{ role: 'user', content: buildPromptText(commandText) }],
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
    worldConfig = generateFallbackWorld(commandText);
  }

  if (requestId !== commandSequence) return;

  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: SECURED_TARGET';
  if (titleEl && worldConfig.sectorTitle) titleEl.innerText = worldConfig.sectorTitle;
  if (loreEl && worldConfig.lore) loreEl.innerText = worldConfig.lore;
  if (worldConfig.audioParams) updateAudioSynth(worldConfig.audioParams);

  await applyWorldConfig(worldConfig);
}

// Top-Tier AI Prompt Generation for Deep Scientific & Visual Physics
function buildPromptText(commandText) {
  return `
You are an advanced 3D Real-Space Simulator Engine and Principal Planetary Scientist.
User Command: "${commandText}"

CRITICAL SCIENTIFIC INTEGRITY:
- Follow true astrophysical reality and actual space object data.
- Provide precise visual properties (roughness, metalness) matching real planetary geology.

Return ONLY valid raw JSON:
{
  "sectorTitle": "Sector Name",
  "lore": "Detailed scientific telemetry explanation.",
  "speechResponse": "Concise voice announcement sentence for arrival.",
  "cameraPosition": [14, 6, 22],
  "cameraTarget": [0, 0, 0],
  "objects": [
    {
      "name": "Planet Name",
      "geometryType": "sphere",
      "geometryArgs": [2.0, 64, 48],
      "position": [0, 0, 0],
      "color": "#38bdf8",
      "emissive": false,
      "emissiveColor": "#ffaa00",
      "emissiveIntensity": 0,
      "roughness": 0.45,
      "metalness": 0.08,
      "prompt": "hyperrealistic satellite map texture, micro-surface relief, high-frequency textural detail",
      "animationType": "spin",
      "animationSpeed": 0.05
    }
  ],
  "audioParams": { "baseFreq": 60.0, "filterCutoff": 400.0, "lfoRate": 1.0 }
}
`;
}

async function loadTextureWithRetry(url, maxRetries = 2, delay = 8000, isPollinations = false) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let blobUrl = null;
    try {
      let finalUrl = url;
      if (isPollinations) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const blob = await response.blob();
        if (blob.size > 1200000) throw new Error("Rate-limit block image detected.");
        blobUrl = URL.createObjectURL(blob);
        finalUrl = blobUrl;
      }
      const texture = await textureLoader.loadAsync(finalUrl);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return texture;
    } catch (err) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (attempt === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
}

// --- APPLY WORLD CONFIGURATION WITH 2K TEXTURES & ORBITCONTROLS ---
async function applyWorldConfig(config) {
  const hudStatusEl = document.getElementById('hud-nav-status');

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

  for (let i = 0; i < spaceObjects.length; i++) {
    const objConfig = spaceObjects[i];
    if (hudStatusEl) hudStatusEl.innerText = `MAPPING: ${objConfig.name.toUpperCase()}`;

    let texUrl = null;
    if (objConfig.customTextureUrl) {
      texUrl = objConfig.customTextureUrl;
    } else if (objConfig.prompt) {
      // 2K Resolution (2048x1024) with Flux Micro-Surface Detail Keywords
      const topScorePrompt = encodeURIComponent(
        `${objConfig.prompt}, flat equirectangular seamless texture map, pure planetary surface topography only, micro-surface relief, high-frequency textural detail, crisp albedo, zero background stars, zero lighting effects, zero framing, high-resolution game asset`
      );
      texUrl = `https://image.pollinations.ai/prompt/${topScorePrompt}?width=2048&height=1024&nologo=true&model=flux&seed=${Math.floor(Math.random()*99999)}`;
    }

    let preloadedTex = null;
    if (texUrl) {
      textureLoader.setCrossOrigin('anonymous');
      try {
        preloadedTex = await loadTextureWithRetry(texUrl, 2, 8000, true);
        preloadedTex.colorSpace = THREE.SRGBColorSpace;
        preloadedTex.needsUpdate = true;
      } catch (err) {
        preloadedTex = null;
      }
    }

    const geom = createDynamicGeometry(objConfig.geometryType, objConfig.geometryArgs);
    const mat = new THREE.MeshStandardMaterial({
      color: preloadedTex ? 0xffffff : new THREE.Color(objConfig.color || 0x38bdf8),
      roughness: objConfig.roughness || 0.4,
      metalness: objConfig.metalness || 0.1,
      emissive: objConfig.emissive ? new THREE.Color(objConfig.emissiveColor || 0xffaa00) : 0x000000,
      emissiveIntensity: objConfig.emissive ? (objConfig.emissiveIntensity || 0.9) : 0,
      map: preloadedTex
    });

    const mesh = new THREE.Mesh(geom, mat);
    if (objConfig.position && Array.isArray(objConfig.position)) {
      mesh.position.set(...objConfig.position);
    }

    if (objConfig.geometryType === 'sphere' && !objConfig.emissive) {
      addAtmosphereShell(mesh, (objConfig.geometryArgs?.[0] || 2.0) * 1.035, new THREE.Color(0x38bdf8), 0.45);
    }

    systemGroup.add(mesh);

    activeAnimatedMeshes.push({
      mesh: mesh,
      type: objConfig.animationType || 'spin',
      speed: objConfig.animationSpeed || 0.05
    });

    if (i < spaceObjects.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
  }

  if (config.speechResponse) speakText(config.speechResponse);
}

function generateFallbackWorld(input) {
  const shortTitle = input.length > 25 ? input.substring(0, 25) + "..." : input;
  return {
    sectorTitle: `Sector: ${shortTitle.toUpperCase()}`,
    lore: `Long-range sensors locked onto target coordinates for: "${input}".`,
    speechResponse: `Warp vector locked. Approaching coordinate sector.`,
    cameraPosition: [14, 6, 22],
    cameraTarget: [0, 0, 0],
    objects: [{
      name: shortTitle,
      geometryType: 'sphere',
      geometryArgs: [2.0, 64, 48],
      position: [0, 0, 0],
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

// --- SETUP CONTROLS & ORBITCONTROLS ---
function setupControls() {
  const container = document.getElementById('viewport') || document.body;
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
    recognition.lang = 'en-US';

    micBtn.addEventListener('click', () => {
      initWebAudio();
      if (isListening) { recognition.stop(); return; }
      try {
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

// --- SECURE DELTA ANIMATION LOOP & GPU SHADER TICK ---
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
      if (anim.type === 'spin') {
        anim.mesh.rotation.y += anim.speed * (dt * 60);
      }
    }
  });

  if (controls) controls.update();
  renderer.render(scene, camera);
}

init();
