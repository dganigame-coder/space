import * as THREE from 'three';

// --- GLOBALS ---
let scene, camera, renderer, planet, planetMaterial, sun, starField;
let runtimeBehavior = null;
let geminiKey = localStorage.getItem('gemini_api_key') || '';

// NEW FIX: Declare missing groups and animation arrays
let systemGroup;
let activeAnimatedMeshes = [];
let controls; // In case you add THREE.OrbitControls later

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
  const container = document.getElementById('viewport') || document.body; // Fallback if no viewport
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 8;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // NEW FIX: Initialize systemGroup and add it to the scene
  systemGroup = new THREE.Group();
  scene.add(systemGroup);

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
  
  // NEW FIX: Add planet to systemGroup instead of scene directly
  systemGroup.add(planet);

  // Default animation for the base planet
  activeAnimatedMeshes.push({
    mesh: planet,
    runtimeFn: new Function('mesh', 'time', 'mesh.rotation.y += 0.005;')
  });

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
  if (!audioInitialized || !params) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  if(params.baseFreq) osc1.frequency.exponentialRampToValueAtTime(params.baseFreq, now + 1.5);
  if(params.baseFreq) osc2.frequency.exponentialRampToValueAtTime(params.baseFreq * 1.5, now + 1.5);
  if(params.filterCutoff) filterNode.frequency.exponentialRampToValueAtTime(params.filterCutoff, now + 1.5);
  if(params.lfoRate) lfoNode.frequency.linearRampToValueAtTime(params.lfoRate, now + 1.5);
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
  const transcriptEl = document.getElementById('transcript');
  const hudStatusEl = document.getElementById('hud-nav-status');
  const codePreviewEl = document.getElementById('code-preview');
  
  if (transcriptEl) transcriptEl.innerText = `"${commandText}"`;
  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: AI_COMPUTING';
  if (codePreviewEl) codePreviewEl.innerText = '// Establishing uplink...';

  let worldConfig;
  const promptText = `
You are controlling an advanced 3D Space Engine Simulator.
User Command: "${commandText}"

Your job is to analyze the command and construct the entire 3D space scene.

Schema Rules:
1. "objects": ALWAYS return an array of 3D objects.
   - If the user asks for a single body (e.g., "Go to Mars"), generate 1 object in the array centered at [0, 0, 0].
   - If the user asks for multiple bodies (e.g., "Earth with the Moon", "Binary Star", "Solar System"), generate multiple objects with explicit 3D positions [x, y, z] spread across space.
2. "geometryType": Choose from "sphere", "torus", "disk", "icosahedron".
3. "position": Array of coordinates [x, y, z]. Use realistic spatial distribution.
4. "cameraPosition": Set optimal camera coordinates [x, y, z] to frame all objects.
5. "cameraTarget": The coordinate vector [x, y, z] where the camera should focus.

Return ONLY valid raw JSON:
{
  "sectorTitle": "Short sci-fi sector title",
  "lore": "Brief telemetry description",
  "speechResponse": "Voice engine sentence",
  "cameraPosition": [10, 5, 18],
  "cameraTarget": [0, 0, 0],
  "objects": [
    {
      "name": "Object Name",
      "geometryType": "sphere",
      "geometryArgs": [1.8, 64, 64],
      "position": [0, 0, 0],
      "emissive": false,
      "emissiveColor": "#ffaa00",
      "prompt": "Detailed texture description for Pollinations AI",
      "runtimeJs": "mesh.rotation.y += 0.005;"
    }
  ],
  "audioParams": { "baseFreq": 60.0, "filterCutoff": 400.0, "lfoRate": 1.0 }
}
`;

  // 1. Try Gemini (Fixed Model Version to gemini-1.5-flash)
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

      if (res.ok) {
        const data = await res.json();
        let rawJson = data.candidates[0].content.parts[0].text;
        
        rawJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
        if (rawJson.includes('{')) {
          rawJson = rawJson.substring(rawJson.indexOf('{'), rawJson.lastIndexOf('}') + 1);
        }
        worldConfig = JSON.parse(rawJson);
      }
    } catch (err) {
      console.warn("Gemini uplink failed, switching to fallback:", err);
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

  // 3. Procedural Hardcoded Fallback (This will now run properly without crashing)
  if (!worldConfig) {
    worldConfig = generateFallbackWorld(commandText);
  }

  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: GENERATING_MATTER';
  
  // Audio & Voice responses
  if (worldConfig.speechResponse) speakText(worldConfig.speechResponse);
  if (worldConfig.audioParams) updateAudioSynth(worldConfig.audioParams);

  // 5. Apply Telemetry and Morph Geometry
  applyWorldConfig(worldConfig);
}

function applyWorldConfig(config) {
  // 1. Clear previous system meshes safely
  while (systemGroup.children.length > 0) {
    const obj = systemGroup.children[0];
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
    systemGroup.remove(obj);
  }
  
  // Reset animations
  activeAnimatedMeshes = [];

  // 2. Adjust Camera to frame the scene
  if (config.cameraPosition && config.cameraTarget) {
    const [cx, cy, cz] = config.cameraPosition;
    const [tx, ty, tz] = config.cameraTarget;
    
    camera.position.set(cx, cy, cz);
    
    // NEW FIX: Safe check for controls vs manual camera lookAt
    if (typeof controls !== 'undefined' && controls) {
      controls.target.set(tx, ty, tz);
      controls.update(); 
    } else {
      camera.lookAt(tx, ty, tz);
    }
  }

  const textureLoader = new THREE.TextureLoader();
  const spaceObjects = config.objects || [config];

  // 3. Iterate through array of generated objects
  spaceObjects.forEach((objConfig) => {
    const geom = createDynamicGeometry(objConfig.geometryType, objConfig.geometryArgs);
    
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.1,
      emissive: objConfig.emissive ? new THREE.Color(objConfig.emissiveColor || 0xffaa00) : 0x000000,
      emissiveIntensity: objConfig.emissive ? 0.8 : 0
    });

    const mesh = new THREE.Mesh(geom, mat);

    if (objConfig.position && Array.isArray(objConfig.position)) {
      mesh.position.set(...objConfig.position);
    }

    // Load unique dynamic texture per object safely
    if (objConfig.prompt) {
      const texUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(objConfig.prompt)}?width=1024&height=512&nologo=true&seed=${Math.floor(Math.random()*99999)}`;
      textureLoader.load(texUrl, (tex) => {
        mat.map = tex;
        mat.needsUpdate = true;
      });
    }

    // Store custom runtime animation function
    activeAnimatedMeshes.push({
      mesh: mesh,
      runtimeFn: new Function('mesh', 'time', objConfig.runtimeJs || 'mesh.rotation.y += 0.005;')
    });

    systemGroup.add(mesh);
  });
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

  const shortTitle = input.length > 25 ? input.substring(0, 25) + "..." : input;

  return {
    sectorTitle: `Sector ${shortTitle.toUpperCase()}`,
    lore: `Navigating toward coordinates: "${input}". Orbital scan underway.`,
    speechResponse: `Warp vector locked. Approaching target sector.`,
    cameraPosition: [10, 5, 18],
    cameraTarget: [0, 0, 0],
    objects: [{
      name: shortTitle,
      geometryType: geom,
      geometryArgs: args,
      position: [0,0,0],
      emissive: isEmissive,
      emissiveColor: "#ffaa00",
      prompt: `seamless surface texture of ${input} in space`,
      runtimeJs: `mesh.rotation.y += 0.02; mesh.rotation.x += 0.01;`
    }],
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

  // NEW FIX: Properly loop over the active animated objects instead of one global function
  activeAnimatedMeshes.forEach((anim) => {
    if (anim.mesh && anim.runtimeFn) {
      try {
        anim.runtimeFn(anim.mesh, t);
      } catch (e) {
        // Fallback rotation if custom JS fails
        anim.mesh.rotation.y += 0.005;
      }
    }
  });

  renderer.render(scene, camera);
}

init();
