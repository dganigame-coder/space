import * as THREE from 'three';

// Globals
let scene, camera, renderer, planet, planetMaterial, sun, starField;
let runtimeBehavior = null;
let geminiKey = localStorage.getItem('gemini_api_key') || '';

// Audio System Globals
let audioCtx, osc1, osc2, filterNode, lfoNode, lfoGain;
let audioInitialized = false;
let isListening = false;

// --- INITIALIZATION ---
function init() {
  setupSecurity();
  initThreeJS();
  setupControls();
  animate(0);
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
    tokenBtn.addEventListener('click', () => {
      const key = tokenInput.value.trim();
      if (key) {
        localStorage.setItem('gemini_api_key', key);
        geminiKey = key;
        status.innerText = "Gemini Key Saved! AI Engine Active.";
        status.style.color = "#4ade80";
      } else {
        localStorage.removeItem('gemini_api_key');
        geminiKey = '';
        status.innerText = "Key cleared. Using Pollinations fallback.";
        status.style.color = "#fbbf24";
      }
    });
  }
}

function initThreeJS() {
  const container = document.getElementById('viewport');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 8;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Front-facing Directional Lighting
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
  dirLight.position.set(12, 8, 15);
  scene.add(dirLight);

  // Deep Space Ambient Tint
  const ambientLight = new THREE.AmbientLight(0x404050, 1.0);
  scene.add(ambientLight);

  scene.fog = new THREE.FogExp2(0x030712, 0.015);

  // Base Central Celestial Object
  const geo = new THREE.SphereGeometry(1.8, 64, 64);
  planetMaterial = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.7 });
  planet = new THREE.Mesh(geo, planetMaterial);
  scene.add(planet);

  // Distant Sun
  const sunGeo = new THREE.SphereGeometry(6, 32, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(-50, 15, -100);
  scene.add(sun);

  // Infinite Starfield Particles
  const starGeo = new THREE.BufferGeometry();
  const starCount = 4000;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
  starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

// --- DYNAMIC GEOMETRY FACTORY ---
function createDynamicGeometry(type, args) {
  const p = args || [];
  switch (type ? type.toLowerCase() : 'sphere') {
    case 'torus':
    case 'blackhole':
    case 'ring_world':
      return new THREE.TorusGeometry(p[0] || 2.2, p[1] || 0.4, p[2] || 16, p[3] || 100);

    case 'icosahedron':
    case 'crystal':
    case 'asteroid':
      return new THREE.IcosahedronGeometry(p[0] || 1.8, p[1] || 1);

    case 'disk':
    case 'quasar_core':
      return new THREE.RingGeometry(p[0] || 0.2, p[1] || 3.5, p[2] || 64);

    case 'sphere':
    default:
      return new THREE.SphereGeometry(p[0] || 1.8, p[1] || 64, p[2] || 64);
  }
}

// --- AUDIO SYNTHESIS & VOICE OUTPUT ---
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
  if (!audioInitialized) initWebAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  osc1.frequency.exponentialRampToValueAtTime(params.baseFreq, now + 1.5);
  osc2.frequency.exponentialRampToValueAtTime(params.baseFreq * 1.5, now + 1.5);
  filterNode.frequency.exponentialRampToValueAtTime(params.filterCutoff, now + 1.5);
  lfoNode.frequency.linearRampToValueAtTime(params.lfoRate, now + 1.5);
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = 0.85; utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

// --- PROCESS COMMAND & AI EXECUTION ---
async function processCommand(commandText) {
  document.getElementById('transcript').innerText = `"${commandText}"`;
  document.getElementById('hud-nav-status').innerText = 'PROTOCOL: AI_COMPUTING';
  document.getElementById('code-preview').innerText = '// Establishing uplink...';

  let worldConfig;
  const promptText = `You are a 3D Space Simulator Engine AI.
User input: "${commandText}".
Return ONLY a valid raw JSON object (no markdown, no backticks):
{
  "sectorTitle": "Creative sector name",
  "lore": "1-sentence sci-fi summary",
  "speechResponse": "Spoken AI flight instruction to pilot",
  "prompt": "seamless surface texture of ${commandText}, 8k detailed spherical map",
  "geometryType": "sphere",
  "geometryArgs": [1.8, 64, 64],
  "emissive": true,
  "emissiveColor": "#ffaa00",
  "runtimeJs": "mesh.rotation.y += 0.02; mesh.rotation.x += 0.01;",
  "audioParams": { "baseFreq": 65.0, "filterCutoff": 500.0, "lfoRate": 2.0 }
}

GEOMETRY SELECTION RULES:
- Standard Planet / Gas Giant / Star: "geometryType": "sphere", "geometryArgs": [1.8, 64, 64]
- Black Hole Event Horizon / Ring World: "geometryType": "torus", "geometryArgs": [2.2, 0.4, 16, 100]
- Crystalline Planet / Asteroid / Comet: "geometryType": "icosahedron", "geometryArgs": [1.8, 1]
- Quasar Accretion Disk / Singularity: "geometryType": "disk", "geometryArgs": [0.2, 3.5, 64]`;

  // 1. Try Gemini 3.8 Flash First
// 1. Try Gemini 3.8 Flash First
if (geminiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    // --- ADD THIS MISSING RESPONSE HANDLING ---
    if (res.ok) {
      const data = await res.json();
      let rawJson = data.candidates[0].content.parts[0].text;
      
      // Clean markdown formatting if Gemini includes ```json ... ```
      rawJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
      if (rawJson.includes('{')) {
        rawJson = rawJson.substring(rawJson.indexOf('{'), rawJson.lastIndexOf('}') + 1);
      }
      
      worldConfig = JSON.parse(rawJson);
    }
  } catch (err) {
    console.warn("Gemini Flash uplink failed, switching to fallback:", err);
  }
}

  // 2. Fallback to Pollinations AI Text Router
  if (!worldConfig) {
    try {
      const pRes = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptText }],
          jsonMode: true
        })
      });

      if (pRes.ok) {
        const pText = await pRes.text();
        let cleanJson = pText.trim();
        if (cleanJson.includes('{')) {
          cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
        }
        worldConfig = JSON.parse(cleanJson);
      }
    } catch (err) {
      console.warn("Pollinations text router failed:", err);
    }
  }

  // 3. Procedural Hardcoded Fallback
  if (!worldConfig) {
    worldConfig = generateFallbackWorld(commandText);
  }

  // 4. Generate Planetary Texture via Pollinations AI
  document.getElementById('hud-nav-status').innerText = 'PROTOCOL: GENERATING_MATTER';
  const texturePrompt = encodeURIComponent(worldConfig.prompt);
  const textureUrl = `https://image.pollinations.ai/prompt/${texturePrompt}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random()*99999)}`;

  new THREE.TextureLoader().load(
    textureUrl,
    (tex) => {
      planetMaterial.map = tex;
      planetMaterial.bumpMap = tex;
      planetMaterial.bumpScale = 0.05;
      planetMaterial.color.setHex(0xffffff);
      planetMaterial.needsUpdate = true;
    },
    undefined,
    () => console.warn("Texture load issue, retaining base material.")
  );

  // 5. Apply Telemetry and Morph Geometry
  applyWorldConfig(worldConfig);
}

function applyWorldConfig(config) {
  speakText(config.speechResponse);
  if (config.audioParams) updateAudioSynth(config.audioParams);

  document.getElementById('sector-title').innerText = config.sectorTitle;
  document.getElementById('sector-lore').innerText = config.lore;
  document.getElementById('code-preview').innerText = config.runtimeJs;
  document.getElementById('hud-nav-status').innerText = `SECTOR: ${config.sectorTitle.toUpperCase()}`;

  // Morph Geometry Dynamically based on AI Instructions
  if (config.geometryType && planet) {
    planet.geometry.dispose();
    planet.geometry = createDynamicGeometry(config.geometryType, config.geometryArgs);
  }

  // Control Material Glow & Emissive States Dynamically
  if (config.emissive) {
    planetMaterial.emissive = new THREE.Color(config.emissiveColor || 0xffffff);
    planetMaterial.emissiveMap = planetMaterial.map;
    planetMaterial.emissiveIntensity = 0.8;
  } else {
    planetMaterial.emissive = new THREE.Color(0x000000);
    planetMaterial.emissiveIntensity = 0.0;
  }
  planetMaterial.needsUpdate = true;

  // Compile Live JavaScript Frame Code
  try {
    runtimeBehavior = new Function('mesh', 'material', 'stars', 'time', config.runtimeJs);
  } catch (e) {
    console.warn("Runtime compilation warning:", e);
    runtimeBehavior = (mesh, material, stars, time) => { mesh.rotation.y += 0.005; };
  }
}

function generateFallbackWorld(input) {
  const lower = input.toLowerCase();
  let geom = "sphere";
  let args = [1.8, 64, 64];
  let isEmissive = false;

  if (lower.includes('black hole') || lower.includes('blackhole') || lower.includes('ring')) {
    geom = "torus";
    args = [2.2, 0.4, 16, 100];
    isEmissive = true;
  } else if (lower.includes('quasar') || lower.includes('singularity') || lower.includes('disk')) {
    geom = "disk";
    args = [0.2, 3.5, 64];
    isEmissive = true;
  } else if (lower.includes('crystal') || lower.includes('asteroid') || lower.includes('comet')) {
    geom = "icosahedron";
    args = [1.8, 1];
  } else if (lower.includes('supernova') || lower.includes('star') || lower.includes('sun')) {
    isEmissive = true;
  }

  // Clean title instead of dumping the full command
  const shortTitle = input.length > 25 ? input.substring(0, 25) + "..." : input;

  return {
    sectorTitle: `Sector ${shortTitle.toUpperCase()}`,
    lore: `Navigating toward coordinates: "${input}". Orbital scan underway.`,
    speechResponse: `Warp vector locked. Approaching target sector.`,
    prompt: `seamless surface texture of ${input}`,
    geometryType: geom,
    geometryArgs: args,
    emissive: isEmissive,
    emissiveColor: "#ffaa00",
    runtimeJs: `mesh.rotation.y += 0.02; mesh.rotation.x += 0.01;`,
    audioParams: { baseFreq: 60.0, filterCutoff: 450.0, lfoRate: 1.5 }
  };
}

// --- CONTROLS & VOICE RECOGNITION ---
function setupControls() {
  const micBtn = document.getElementById('mic-btn');
  const manualInput = document.getElementById('manual-input');
  const sendBtn = document.getElementById('send-btn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (micBtn) micBtn.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  if (manualInput) manualInput.disabled = false;

  if (SpeechRecognition) {
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

// --- RENDER LOOP ---
function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001;

  if (starField) {
    const positions = starField.geometry.attributes.position.array;
    for (let i = 2; i < positions.length; i += 3) {
      positions[i] += 0.4;
      if (positions[i] > 10) positions[i] = -400;
    }
    starField.geometry.attributes.position.needsUpdate = true;
  }

  if (runtimeBehavior && planet) {
    try {
      runtimeBehavior(planet, planetMaterial, starField, t);
    } catch (e) {
      planet.rotation.y += 0.005;
    }
  } else if (planet) {
    planet.rotation.y += 0.005;
  }

  renderer.render(scene, camera);
}

init();
