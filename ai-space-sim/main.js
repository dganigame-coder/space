import * as THREE from 'three';

// Globals
let scene, camera, renderer, planet, planetMaterial, sun, starField;
let runtimeBehavior = null;
let hfToken = localStorage.getItem('hf_space_token') || '';

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

  if (hfToken) {
    tokenInput.value = hfToken;
    enableControls();
    status.innerText = "Token active & connected.";
    status.style.color = "#4ade80";
  }

  tokenBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token.startsWith('hf_')) {
      localStorage.setItem('hf_space_token', token);
      hfToken = token;
      enableControls();
      status.innerText = "Token saved! AI Active.";
      status.style.color = "#4ade80";
    } else {
      status.innerText = "Invalid token. Must start with hf_";
      status.style.color = "#ef4444";
    }
  });
}

function enableControls() {
  document.getElementById('mic-btn').disabled = false;
  document.getElementById('send-btn').disabled = false;
  document.getElementById('manual-input').disabled = false;
  document.getElementById('hud-nav-status').innerText = 'PROTOCOL: AWAITING_COMMAND';
}

function initThreeJS() {
  const container = document.getElementById('viewport');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 8;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Lighting
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(-20, 10, -20);
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0x222233));
  scene.fog = new THREE.FogExp2(0x030712, 0.015);

  // Central Celestial Object
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

async function processCommand(commandText) {
  document.getElementById('transcript').innerText = `"${commandText}"`;
  document.getElementById('hud-nav-status').innerText = 'PROTOCOL: AI_COMPUTING';
  document.getElementById('code-preview').innerText = '// Establishing uplink...';

  try {
    const systemPrompt = `[INST] You are a Ship Navigation AI. User input: "${commandText}".
Return ONLY a valid JSON object without markdown formatting or extra text:
{
  "sectorTitle": "Creative sector name",
  "lore": "1-sentence sector summary",
  "speechResponse": "Spoken AI flight instruction",
  "prompt": "FLUX texture prompt for a spherical planet surface",
  "rotationJs": "mesh.rotation.y += 0.02; stars.rotation.z += 0.001;",
  "audioParams": { "baseFreq": 65.0, "filterCutoff": 500.0, "lfoRate": 2.0 }
} [/INST]`;

    // 1. Call a verified HF Serverless Model (Mistral 7B)
    const llmRes = await fetch('https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: systemPrompt,
        parameters: {
          max_new_tokens: 350,
          return_full_text: false
        }
      })
    });

    let worldConfig;

    if (llmRes.ok) {
      const llmData = await llmRes.json();
      let rawText = Array.isArray(llmData) ? llmData[0].generated_text : (llmData.generated_text || JSON.stringify(llmData));
      
      // Extract valid JSON substring
      if (rawText.includes('{')) {
        rawText = rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1);
      }
      worldConfig = JSON.parse(rawText);
    } else {
      console.warn(`HF LLM returned status ${llmRes.status}. Using procedural fallback generator.`);
      worldConfig = generateFallbackWorld(commandText);
    }

    document.getElementById('hud-nav-status').innerText = 'PROTOCOL: GENERATING_MATTER';

    // 2. Generate Planetary Texture Map via FLUX
    try {
      const imgRes = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: worldConfig.prompt })
      });

      if (imgRes.ok) {
        const imgBlob = await imgRes.blob();
        const reader = new FileReader();
        reader.readAsDataURL(imgBlob);
        reader.onloadend = () => {
          new THREE.TextureLoader().load(reader.result, (tex) => {
            planetMaterial.map = tex;
            planetMaterial.needsUpdate = true;
          });
        };
      }
    } catch (e) {
      console.warn("Texture endpoint skipped:", e);
    }

    // 3. Apply Audio, Text-to-Speech & Navigation Protocol
    speakText(worldConfig.speechResponse);
    if (worldConfig.audioParams) updateAudioSynth(worldConfig.audioParams);

    document.getElementById('sector-title').innerText = worldConfig.sectorTitle;
    document.getElementById('sector-lore').innerText = worldConfig.lore;
    document.getElementById('code-preview').innerText = worldConfig.rotationJs;
    document.getElementById('hud-nav-status').innerText = `SECTOR: ${worldConfig.sectorTitle.toUpperCase()}`;

    // 4. Safely compile AI JavaScript code execution
    try {
      runtimeBehavior = new Function('mesh', 'stars', 'time', worldConfig.rotationJs);
    } catch (e) {
      console.warn("Runtime code compilation warn:", e);
    }

  } catch (err) {
    console.error("AI Bridge Error:", err);
    // Execute fallback to keep simulation running smoothly
    const fallback = generateFallbackWorld(commandText);
    applyWorldConfig(fallback);
  }
}

// Procedural Fallback Generator (Prevents offline crashes)
function generateFallbackWorld(input) {
  const sectors = ["Xylos Vega", "Aurelia Nebula", "Pulsar Delta", "Kepler-186f", "Chronos Ring"];
  const sectorName = sectors[Math.floor(Math.random() * sectors.length)];
  
  return {
    sectorTitle: `${sectorName} (${input})`,
    lore: `Navigating towards custom coordinate stream: "${input}". Atmospheric scanning in progress.`,
    speechResponse: `Warp engaged. Approaching sector ${sectorName}.`,
    prompt: `seamless planet texture map of ${input}, ultra detailed 8k spherical map`,
    rotationJs: `mesh.rotation.y += 0.015; mesh.position.y = Math.sin(time * 2) * 0.15; stars.rotation.z += 0.001;`,
    audioParams: { baseFreq: 55.0 + Math.random() * 40, filterCutoff: 400.0 + Math.random() * 300, lfoRate: 1.5 + Math.random() * 2 }
  };
}

function applyWorldConfig(config) {
  speakText(config.speechResponse);
  if (config.audioParams) updateAudioSynth(config.audioParams);
  document.getElementById('sector-title').innerText = config.sectorTitle;
  document.getElementById('sector-lore').innerText = config.lore;
  document.getElementById('code-preview').innerText = config.rotationJs;
  document.getElementById('hud-nav-status').innerText = `SECTOR: ${config.sectorTitle.toUpperCase()}`;
  try {
    runtimeBehavior = new Function('mesh', 'stars', 'time', config.rotationJs);
  } catch (e) {}
}
// --- CONTROLS & VOICE RECOGNITION SAFE STATE MACHINE ---
function setupControls() {
  const micBtn = document.getElementById('mic-btn');
  const manualInput = document.getElementById('manual-input');
  const sendBtn = document.getElementById('send-btn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
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
      } catch (e) {
        console.warn("Recognition start skipped:", e);
      }
    });

    recognition.onresult = (event) => {
      isListening = false;
      micBtn.classList.remove('listening');
      processCommand(event.results[0][0].transcript);
    };

    recognition.onerror = () => {
      isListening = false;
      micBtn.classList.remove('listening');
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
    };
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

  // Warp starfield motion
  if (starField) {
    const positions = starField.geometry.attributes.position.array;
    for (let i = 2; i < positions.length; i += 3) {
      positions[i] += 0.4;
      if (positions[i] > 10) positions[i] = -400;
    }
    starField.geometry.attributes.position.needsUpdate = true;
  }

  // Execute AI runtime compilation or default rotation
  if (runtimeBehavior && planet) {
    try {
      runtimeBehavior(planet, starField, t);
    } catch (e) {
      planet.rotation.y += 0.005;
    }
  } else if (planet) {
    planet.rotation.y += 0.005;
  }

  renderer.render(scene, camera);
}

init();
