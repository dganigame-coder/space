import * as THREE from 'three';

// --- GLOBALS ---
let scene, camera, renderer, starField;
let geminiKey = localStorage.getItem('gemini_api_key') || '';
let dynamicModelQueue = ['gemini-2.5-flash']; // Safe default fallback until discovered

let systemGroup;
let activeAnimatedMeshes = [];
let controls; // Optional OrbitControls
let textureLoader = new THREE.TextureLoader();

// Strict Texture Queue Globals (Prevents 402 Rate Limit Errors)
let textureQueue = [];
let isProcessingQueue = false;

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

  // Dynamically discover and rank available Gemini models at startup (Newest First)
  if (geminiKey) {
    await discoverGeminiModels();
  }

  // Smoothly dismiss cinematic boot screen overlay
  const bootOverlay = document.getElementById('boot-overlay');
  if (bootOverlay) {
    bootOverlay.style.opacity = '0';
    setTimeout(() => bootOverlay.remove(), 500);
  }
}

// --- DYNAMIC MODEL DISCOVERY & NEWEST-FIRST WATERFALL BUILDER ---
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

      // Sort models from NEWEST (First) to OLDEST (Last)
      validModels.sort((a, b) => {
        const getVer = (str) => {
          const match = str.match(/(\d+(\.\d+)?)/);
          return match ? parseFloat(match[0]) : 0;
        };

        const vA = getVer(a.id);
        const vB = getVer(b.id);

        if (vA !== vB) {
          return vB - vA;
        }

        const getDateVal = (str) => {
          const match = str.match(/(\d{2})-(\d{4})/);
          if (match) return parseInt(match[2]) * 100 + parseInt(match[1]);
          return 0;
        };

        const dateA = getDateVal(a.versionString);
        const dateB = getDateVal(b.versionString);

        if (dateA !== dateB) {
          return dateB - dateA;
        }

        const aFlash = a.id.includes('flash') ? 1 : 0;
        const bFlash = b.id.includes('flash') ? 1 : 0;
        return bFlash - aFlash;
      });

      if (validModels.length > 0) {
        dynamicModelQueue = validModels.map(m => m.id);
        console.log("Successfully compiled newest-first Gemini model waterfall:", dynamicModelQueue);
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

function initThreeJS() {
  const container = document.getElementById('viewport') || document.body;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 5, 15);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  container.appendChild(renderer.domElement);

  systemGroup = new THREE.Group();
  scene.add(systemGroup);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
  dirLight.position.set(20, 15, 20);
  scene.add(dirLight);

  const ambientLight = new THREE.AmbientLight(0x222233, 1.2);
  scene.add(ambientLight);

  scene.fog = new THREE.FogExp2(0x02040a, 0.012);

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

// --- PROCESS COMMAND & TIMEOUT-PROTECTED WATERFALL ---
async function processCommand(commandText) {
  const transcriptEl = document.getElementById('transcript');
  const hudStatusEl = document.getElementById('hud-nav-status');
  const titleEl = document.getElementById('sector-title');
  const loreEl = document.getElementById('sector-lore');

  if (transcriptEl) transcriptEl.innerText = `"${commandText}"`;
  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: ASTROMETRIC_SCAN';

  speakText(`Engaging long-range astrometric sensors for target vector: ${commandText}. Calibrating navigation arrays.`);

  let worldConfig = null;

  if (geminiKey && dynamicModelQueue.length > 0) {
    for (let i = 0; i < dynamicModelQueue.length; i++) {
      // Create an AbortController with a 12-second timeout to prevent infinite pending hangs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        if (hudStatusEl) hudStatusEl.innerText = `UPLINK: CALIBRATING...`;
        speakText(`Calibrating spatial telemetry link.`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${dynamicModelQueue[i]}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPromptText(commandText) }] }],
            generationConfig: { responseMimeType: "application/json" }
          }),
          signal: controller.signal // Bind timeout controller signal
        });

        clearTimeout(timeoutId); // Clear timeout since response arrived successfully

        if (res.status === 429 || res.status === 503) {
          console.warn(`Model returned status ${res.status}. Cascading down waterfall...`);
          speakText(`Primary subspace relay congested. Recalibrating navigational frequency.`);
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
          speakText("Sector topography mapped successfully. Initializing holographic materialization sequence.");
          break; 
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          console.warn(`Model ${dynamicModelQueue[i]} request timed out after 12s. Cascading down waterfall...`);
          speakText(`Subspace relay timed out. Rerouting through secondary channel.`);
        } else {
          console.warn(`Uplink calibration error with ${dynamicModelQueue[i]}:`, err);
        }
      }
    }
  }

  if (!worldConfig) {
    speakText("Primary astrometric database unreachable. Engaging long-range archival database retrieval.");
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
        speakText("Archival sector configuration successfully acquired.");
      }
    } catch (e) {
      console.warn("Pollinations text router fallback failed or timed out.");
    }
  }

  if (!worldConfig) {
    speakText("External telemetry offline. Engaging internal stellar synthesis matrix.");
    worldConfig = generateFallbackWorld(commandText);
    worldConfig.sectorTitle = "SYSTEM FALLBACK: LOCAL MATRIX";
    worldConfig.lore = "Warning: External telemetry link lost. System is operating on local emergency navigational backup.";
    worldConfig.speechResponse = "Engaging emergency local warp trajectory.";
  }

  if (hudStatusEl) hudStatusEl.innerText = 'PROTOCOL: SECURED_TARGET';

  if (titleEl && worldConfig.sectorTitle) titleEl.innerText = worldConfig.sectorTitle;
  if (loreEl && worldConfig.lore) loreEl.innerText = worldConfig.lore;
  if (worldConfig.audioParams) updateAudioSynth(worldConfig.audioParams);

  const codePreviewEl = document.getElementById('code-preview');
  if (codePreviewEl && worldConfig.objects) {
    codePreviewEl.innerText = worldConfig.objects
      .map(o => `// [${o.name}]\n// Geometry: ${o.geometryType}\n${o.runtimeJs}`)
      .join('\n\n');
  }

  await applyWorldConfig(worldConfig);
}

function buildPromptText(commandText) {
  return `
You are controlling an advanced 3D Real-Space Simulator Engine.
User Command: "${commandText}"

CRITICAL SCIENTIFIC INTEGRITY RULE:
- ALWAYS follow true astrophysical reality and actual space object data. 
- DO NOT hallucinate fake or fictitious space objects, fictional planets, or imaginary moons unless explicitly requested by the user. 
- If the user names a real planetary system or body (e.g., Mars, Saturn, Jupiter, Trappist-1, Earth), render its actual scientific layout accurately.

Rules:
1. "objects": Return an array of 3D objects reflecting true spatial distribution.
2. "geometryType": Choose from "sphere", "torus", "disk", "icosahedron".
3. "color": Provide a scientifically accurate HEX color code.
4. "cameraPosition" & "cameraTarget": Position camera wide enough to frame the celestial body cleanly.
5. "prompt": Provide descriptive texture prompts.

Return ONLY valid raw JSON:
{
  "sectorTitle": "Sector Name",
  "lore": "Detailed scientific telemetry explanation of the current sector.",
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
      "runtimeJs": "mesh.rotation.y += 0.002;"
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
        
        if (blob.size > 1100000) {
          throw new Error("Pollinations rate-limit block image detected.");
        }
        
        blobUrl = URL.createObjectURL(blob);
        finalUrl = blobUrl;
      }

      const texture = await textureLoader.loadAsync(finalUrl);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return texture;

    } catch (err) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (attempt === maxRetries) throw err;
      
      const penaltyDelay = attempt === 0 ? 15000 : delay * (attempt + 1);
      console.warn(`Texture generation/load failed: "${err.message}". Retrying attempt ${attempt + 1} in ${penaltyDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, penaltyDelay));
    }
  }
}

// --- APPLY WORLD CONFIGURATION TO THREE.JS (SAFE SEQUENTIAL 1-TO-1 PIPELINE) ---
async function applyWorldConfig(config) {
  const hudStatusEl = document.getElementById('hud-nav-status');

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
    let [cx, cy, cz] = config.cameraPosition;
    const [tx, ty, tz] = config.cameraTarget;

    // --- RESPONSIVE BORDER ADJUSTMENT ---
    const container = document.getElementById('viewport') || document.body;
    const aspect = container.clientWidth / container.clientHeight;
    
    // If portrait mode (mobile phone), scale camera distance back so objects fit inside borders
    if (aspect < 1) {
      const portraitMultiplier = 1.35 / aspect; 
      cx *= portraitMultiplier;
      cy *= portraitMultiplier;
      cz *= portraitMultiplier;
    }

    camera.position.set(cx, cy, cz);
    if (typeof controls !== 'undefined' && controls) {
      controls.target.set(tx, ty, tz);
      controls.update(); 
    } else {
      camera.lookAt(tx, ty, tz);
    }
  }

  const spaceObjects = config.objects || [config];

  for (let i = 0; i < spaceObjects.length; i++) {
    const objConfig = spaceObjects[i];
    
    const spaceSpeech = `Calibrating surface albedo and planetary topography maps for ${objConfig.name}.`;
    if (hudStatusEl) hudStatusEl.innerText = `MAPPING: ${objConfig.name.toUpperCase()}`;
    speakText(spaceSpeech);

    let texUrl = null;
    if (objConfig.customTextureUrl) {
      texUrl = objConfig.customTextureUrl;
    } else if (objConfig.prompt) {
      const cleanPrompt = encodeURIComponent(`${objConfig.prompt}, flat equirectangular seamless texture map, pure planetary surface topography only, zero background stars, zero lighting effects, zero framing, high-resolution game asset`);
      texUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1024&height=512&nologo=true&model=flux&seed=${Math.floor(Math.random()*99999)}`;
    }

    if (texUrl) {
      textureLoader.setCrossOrigin('anonymous');
      try {
        const isPollinations = !!objConfig.prompt;
        const tex = await loadTextureWithRetry(texUrl, 2, 8000, isPollinations);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        objConfig.preloadedTex = tex;
      } catch (err) {
        console.warn(`Texture load failed for ${objConfig.name} after retries, keeping fallback color.`, err);
        objConfig.preloadedTex = null;
      }

      if (i < spaceObjects.length - 1) {
        if (hudStatusEl) hudStatusEl.innerText = `COOLDOWN: STABILIZING ORBIT...`;
        await new Promise(resolve => setTimeout(resolve, 8500));
      }
    }
  }

  if (hudStatusEl) {
    hudStatusEl.innerText = 'PROTOCOL: SECURED_TARGET';
  }
  
  if (config.speechResponse) {
    speakText(config.speechResponse);
  }

  spaceObjects.forEach((objConfig) => {
    const geom = createDynamicGeometry(objConfig.geometryType, objConfig.geometryArgs);

    const mat = new THREE.MeshStandardMaterial({
      color: objConfig.preloadedTex ? 0xffffff : new THREE.Color(objConfig.color || 0x38bdf8),
      roughness: 0.35,
      metalness: 0.15,
      emissive: objConfig.emissive ? new THREE.Color(objConfig.emissiveColor || 0xffaa00) : 0x000000,
      emissiveIntensity: objConfig.emissive ? 0.9 : 0,
      map: objConfig.preloadedTex || null
    });

    const mesh = new THREE.Mesh(geom, mat);

    if (objConfig.position && Array.isArray(objConfig.position)) {
      mesh.position.set(...objConfig.position);
    }

    systemGroup.add(mesh);

    activeAnimatedMeshes.push({
      mesh: mesh,
      runtimeFn: new Function('mesh', 'time', objConfig.runtimeJs || 'mesh.rotation.y += 0.005;')
    });
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
      prompt: `photorealistic surface texture map of ${input}`,
      runtimeJs: `mesh.rotation.y += 0.01;`
    }],
    audioParams: { baseFreq: 60.0, filterCutoff: 450.0, lfoRate: 1.5 }
  };
}

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

  if (mobileToggleBtn && sidebar) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      mobileToggleBtn.innerText = sidebar.classList.contains('mobile-open') ? '✕ Close' : '⚙️ Controls';
      
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);
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
