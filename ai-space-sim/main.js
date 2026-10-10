import * as THREE from 'three';

// --- GLOBALS ---
let scene, camera, renderer, starField;
let geminiKey = localStorage.getItem('gemini_api_key') || '';

let systemGroup;
let activeAnimatedMeshes = [];
let controls; // Optional OrbitControls

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

  // Smoothly dismiss cinematic boot screen overlay
  const bootOverlay = document.getElementById('boot-overlay');
  if (bootOverlay) {
    bootOverlay.style.opacity = '0';
    setTimeout(() => bootOverlay.remove(), 500);
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
  const container = document.getElementById('viewport') || document.body;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 5, 15);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // --- CINEMATIC PHOTOREALISM SETTINGS ---
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  container.appendChild(renderer.domElement);

  systemGroup = new THREE.Group();
  scene.add(systemGroup);

  // Dynamic Scene Lighting
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
  dirLight.position.set(20, 15, 20);
  scene.add(dirLight);

  const ambientLight = new THREE.AmbientLight(0x222233, 1.2);
  scene.add(ambientLight);

  scene.fog = new THREE.FogExp2(0x02040a, 0.012);

  // Initial Default Placeholder Object
  const geo = new THREE.SphereGeometry(2.0, 64, 64);
  const planetMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x38bdf8, 
    roughness: 0.4, 
    metalness: 0.1 
  });
  const planet = new THREE.Mesh(geo, planetMaterial);
  systemGroup.add(planet);

  activeAnimatedMeshes.push({
    mesh: planet,
    runtimeFn: new Function('mesh', 'time', 'mesh.rotation.y += 0.003;')
  });

  // Immersive Starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = 5000;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 600;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.85 });
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
      return new THREE.TorusGeometry(p[0] || 2.5, p[1] || 0.5, p[2] || 32, p[3] || 128);

    case 'icosahedron':
    case 'crystal':
    case 'asteroid':
      return new THREE.IcosahedronGeometry(p[0] || 2.0, p[1] || 2);

    case 'disk':
    case 'quasar_core':
      return new THREE.RingGeometry(p[0] || 0.4, p[1] || 4.5, p[2] || 64);

    case 'sphere':
    default:
      return new THREE.SphereGeometry(p[0] || 2.0, p[1] || 64, p[2] || 64);
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

// --- PROCESS COMMAND & MODEL CASCADE ---
async function processCommand(commandText) {
  const transcriptEl = document.getElementById('transcript');
  const hudStatusEl = document.getElementById('hud-nav-status');
  const titleEl = document.getElementById('sector-title');
  const loreEl = document.getElementById('sector-lore');

  if (transcriptEl) transcriptEl.innerText = `"${commandText}"`;
  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: AI_COMPUTING';

  let worldConfig = null;
  const flashModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];

  // 1. Try Gemini models in sequence with error notification handling
  if (geminiKey) {
    for (const model of flashModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPromptText(commandText) }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (res.status === 429) {
          console.warn(`Model ${model} hit 429 quota limit. Cascading...`);
          if (model === flashModels[flashModels.length - 1]) {
            speakText("Primary system quota exhausted. Rerouting to secondary fallback trajectory.");
          }
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
        console.warn(`Uplink error with ${model}:`, err);
      }
    }
  }

  // 2. Fallback to Pollinations Text Router
  if (!worldConfig) {
    try {
      const pRes = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: buildPromptText(commandText) }],
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
    } catch (e) {
      console.warn("Pollinations text router fallback failed.");
    }
  }

  // 3. Final Safety Net: Local Procedural Generator with Explicit Fallback Announcements
  if (!worldConfig) {
    worldConfig = generateFallbackWorld(commandText);
    worldConfig.sectorTitle = "SYSTEM FALLBACK: LOCAL MATRIX";
    worldConfig.lore = "Warning: AI uplink failed or quota exceeded. System is processing via local procedural space generator.";
    worldConfig.speechResponse = "Sorry, system couldn't reach main AI servers. Switching to local backup trajectory.";
  }

  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: SECURED_TARGET';

  // Sync UI Telemetry & Voice
  if (titleEl && worldConfig.sectorTitle) titleEl.innerText = worldConfig.sectorTitle;
  if (loreEl && worldConfig.lore) loreEl.innerText = worldConfig.lore;
  if (worldConfig.speechResponse) speakText(worldConfig.speechResponse);
  if (worldConfig.audioParams) updateAudioSynth(worldConfig.audioParams);

  // Update Live Code Window
  const codePreviewEl = document.getElementById('code-preview');
  if (codePreviewEl && worldConfig.objects) {
    codePreviewEl.innerText = worldConfig.objects
      .map(o => `// [${o.name}]\n// Geometry: ${o.geometryType}\n${o.runtimeJs}`)
      .join('\n\n');
  }

  applyWorldConfig(worldConfig);
}

// --- DETAILED AI PROMPT INSTRUCTIONS (WITH INSTANT COLOR SCHEMA) ---
function buildPromptText(commandText) {
  return `
You are controlling an advanced 3D Real-Space Simulator Engine.
User Command: "${commandText}"

Generate a hyper-realistic space scene layout with accurate 3D distribution.

Rules:
1. "objects": ALWAYS return an array of 3D objects. 
   - DO NOT cluster everything at [0,0,0]. Space is vast.
   - For binary stars or multiple bodies, spread them out across different coordinates (e.g., [ -6, 0, 0 ] and [ 6, 0, -3 ]).
   - For planets/moons, place them at offset coordinates relative to their parent body (e.g., [ 5, 1, 2 ]).
2. "geometryType": Choose from "sphere", "torus", "disk", "icosahedron".
3. "color": Provide a thematic HEX color code (e.g., "#ef4444" for a red star, "#38bdf8" for an ocean planet, "#64748b" for rocky bodies) so objects display immediate color before texture loading.
4. "cameraPosition" & "cameraTarget": Position camera wide enough to frame all objects nicely.
5. "prompt": Provide extremely descriptive, photorealistic texture prompts for Pollinations AI.

Return ONLY valid raw JSON:
{
  "sectorTitle": "Sector Name",
  "lore": "Detailed scientific and sci-fi telemetry explanation of the current sector.",
  "speechResponse": "Concise voice announcement sentence for arrival.",
  "cameraPosition": [12, 6, 20],
  "cameraTarget": [0, 0, 0],
  "objects": [
    {
      "name": "Primary Body",
      "geometryType": "sphere",
      "geometryArgs": [2.0, 64, 64],
      "position": [0, 0, 0],
      "color": "#38bdf8",
      "emissive": false,
      "emissiveColor": "#ffaa00",
      "prompt": "hyperrealistic satellite map texture of...",
      "runtimeJs": "mesh.rotation.y += 0.002;"
    }
  ],
  "audioParams": { "baseFreq": 60.0, "filterCutoff": 400.0, "lfoRate": 1.0 }
}
`;
}

// --- APPLY WORLD CONFIGURATION TO THREE.JS ---
function applyWorldConfig(config) {
  while (systemGroup.children.length > 0) {
    const obj = systemGroup.children[0];
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
    systemGroup.remove(obj);
  }

  activeAnimatedMeshes = [];

  if (config.cameraPosition && config.cameraTarget) {
    const [cx, cy, cz] = config.cameraPosition;
    const [tx, ty, tz] = config.cameraTarget;
    camera.position.set(cx, cy, cz);
    if (typeof controls !== 'undefined' && controls) {
      controls.target.set(tx, ty, tz);
      controls.update(); 
    } else {
      camera.lookAt(tx, ty, tz);
    }
  }

  const textureLoader = new THREE.TextureLoader();
  const spaceObjects = config.objects || [config];

  spaceObjects.forEach((objConfig) => {
    const geom = createDynamicGeometry(objConfig.geometryType, objConfig.geometryArgs);

    // Instantly apply Gemini's assigned thematic color while textures load
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(objConfig.color || 0x38bdf8),
      roughness: 0.35,
      metalness: 0.15,
      emissive: objConfig.emissive ? new THREE.Color(objConfig.emissiveColor || 0xffaa00) : 0x000000,
      emissiveIntensity: objConfig.emissive ? 0.9 : 0
    });

    const mesh = new THREE.Mesh(geom, mat);

    if (objConfig.position && Array.isArray(objConfig.position)) {
      mesh.position.set(...objConfig.position);
    }

    // Free-tier safe Pollinations texture request with CORS handling
    if (objConfig.prompt) {
      const enhancedPrompt = encodeURIComponent(`${objConfig.prompt}, 4k resolution, highly detailed photorealistic space texture map, seamless equirectangular`);
      const texUrl = `https://image.pollinations.ai/prompt/${enhancedPrompt}?width=1024&height=512&nologo=true&model=flux&seed=${Math.floor(Math.random()*99999)}`;

      // --- CRITICAL FIX: Enable cross-origin permission for WebGL ---
      textureLoader.setCrossOrigin('anonymous');

      textureLoader.load(texUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map = tex;
        mat.color.set(0xffffff); // Clear the solid tint so the custom texture displays fully
        mat.needsUpdate = true;
      }, undefined, (err) => {
        console.warn("Texture load error, keeping fallback material color.");
      });
    }
    // Free-tier safe Pollinations texture request (1024x512, no paid parameters)
    if (objConfig.prompt) {
      const enhancedPrompt = encodeURIComponent(`${objConfig.prompt}, 4k resolution, highly detailed photorealistic space texture map, seamless equirectangular`);
      const texUrl = `https://image.pollinations.ai/prompt/${enhancedPrompt}?width=1024&height=512&nologo=true&model=flux&seed=${Math.floor(Math.random()*99999)}`;

      textureLoader.load(texUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map = tex;
        mat.color.set(0xffffff); // <-- Resets tint to white so texture colors show fully!
        mat.needsUpdate = true;
      }, undefined, (err) => {
        console.warn("Texture load error, keeping fallback material color.");
      });
    }
    
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
  let args = [2.0, 64, 64];
  let isEmissive = false;
  let baseColor = "#38bdf8";

  if (lower.includes('black hole') || lower.includes('blackhole') || lower.includes('ring')) {
    geom = "torus";
    args = [2.8, 0.5, 32, 128];
    isEmissive = true;
    baseColor = "#1e293b";
  } else if (lower.includes('red dwarf') || lower.includes('star') || lower.includes('sun')) {
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
      prompt: `photorealistic 4k space surface texture map of ${input}`,
      runtimeJs: `mesh.rotation.y += 0.01;`
    }],
    audioParams: { baseFreq: 60.0, filterCutoff: 450.0, lfoRate: 1.5 }
  };
}

// --- CONTROLS, VOICE & FULLSCREEN SETUP ---
function setupControls() {
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

  // Mobile Drawer Toggle Listener
  if (mobileToggleBtn && sidebar) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      mobileToggleBtn.innerText = sidebar.classList.contains('mobile-open') ? '✕ Close' : '⚙️ Controls';
    });
  }

  // Fullscreen Toggle Listener
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

// --- RENDER LOOP ---
function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001;

  if (starField) {
    const positions = starField.geometry.attributes.position.array;
    for (let i = 2; i < positions.length; i += 3) {
      positions[i] += 0.3;
      if (positions[i] > 10) positions[i] = -500;
    }
    starField.geometry.attributes.position.needsUpdate = true;
  }

  activeAnimatedMeshes.forEach((anim) => {
    if (anim.mesh && anim.runtimeFn) {
      try {
        anim.runtimeFn(anim.mesh, t);
      } catch (e) {
        anim.mesh.rotation.y += 0.005;
      }
    }
  });

  renderer.render(scene, camera);
}

init();
