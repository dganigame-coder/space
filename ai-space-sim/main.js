import * as THREE from 'three';
import { HfInference } from '@huggingface/inference';

// Globals
let scene, camera, renderer, planet, planetMaterial, dirLight, starField;
let runtimeBehavior = null;
let hf = null;

// Audio System Globals
let audioCtx, osc1, osc2, filterNode, lfoNode, lfoGain;
let audioInitialized = false;

// --- INITIALIZATION ---
function init() {
  setupSecurity();
  initThreeJS();
  setupControls();
  animate(0);
}

function setupSecurity() {
  const savedToken = localStorage.getItem('hf_space_token');
  const tokenInput = document.getElementById('hf-token-input');
  const tokenBtn = document.getElementById('save-token-btn');
  const status = document.getElementById('token-status');

  if (savedToken) {
    tokenInput.value = savedToken;
    hf = new HfInference(savedToken);
    enableControls();
    status.innerText = "Token loaded securely.";
    status.style.color = "#4ade80";
  }

  tokenBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token.startsWith('hf_')) {
      localStorage.setItem('hf_space_token', token);
      hf = new HfInference(token);
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
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(5, 3, 5);
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0x111122));
  scene.fog = new THREE.FogExp2(0x030712, 0.05);

  const geo = new THREE.SphereGeometry(1.8, 64, 64);
  planetMaterial = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.7 });
  planet = new THREE.Mesh(geo, planetMaterial);
  scene.add(planet);

  const starGeo = new THREE.BufferGeometry();
  const starCount = 3000;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 });
  starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

// --- AUDIO & VOICE ENGINE ---
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

// --- AI LOGIC (Serverless via HF.js) ---
async function processCommand(commandText) {
  document.getElementById('transcript').innerText = `"${commandText}"`;
  document.getElementById('hud-nav-status').innerText = 'PROTOCOL: AI_COMPUTING';

  try {
    const systemPrompt = `You are an AI World Engine Flight Computer.
User input: "${commandText}".
Return EXACTLY AND ONLY valid JSON format. Do not use markdown backticks.
{
  "sectorTitle": "Creative sector name",
  "lore": "1-sentence summary",
  "speechResponse": "Spoken AI flight instruction",
  "fogColor": "#hexColor",
  "lightColor": "#hexColor",
  "prompt": "FLUX image prompt for 3D planet texture map",
  "rotationJs": "mesh.rotation.y += 0.01; stars.rotation.z += 0.001;",
  "audioParams": { "baseFreq": 65.0, "filterCutoff": 500.0, "lfoRate": 2.0 }
}`;

    // 1. Get Text & Code Configuration
    const llmResponse = await hf.chatCompletion({
      model: "Qwen/Qwen2.5-Coder-32B-Instruct",
      messages: [{ role: "user", content: systemPrompt }],
      max_tokens: 500
    });

    let rawJson = llmResponse.choices[0].message.content.trim();
    if(rawJson.startsWith('```json')) rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
    const worldConfig = JSON.parse(rawJson);

    // 2. Generate Texture Visuals
    const imageBlob = await hf.textToImage({
      model: 'black-forest-labs/FLUX.1-schnell',
      inputs: worldConfig.prompt,
      parameters: { num_inference_steps: 4 }
    });

    const reader = new FileReader();
    reader.readAsDataURL(imageBlob);
    reader.onloadend = () => {
      new THREE.TextureLoader().load(reader.result, (tex) => {
        planetMaterial.map = tex;
        planetMaterial.needsUpdate = true;
      });
    };

    // Apply Audio & Visual Updates
    speakText(worldConfig.speechResponse);
    if (worldConfig.audioParams) updateAudioSynth(worldConfig.audioParams);
    
    document.getElementById('sector-title').innerText = worldConfig.sectorTitle;
    document.getElementById('sector-lore').innerText = worldConfig.lore;
    document.getElementById('code-preview').innerText = worldConfig.rotationJs;
    document.getElementById('hud-nav-status').innerText = `SECTOR: ${worldConfig.sectorTitle.toUpperCase()}`;
    
    dirLight.color.set(worldConfig.lightColor);
    scene.fog.color.set(worldConfig.fogColor);

    try {
      runtimeBehavior = new Function('mesh', 'stars', 'time', worldConfig.rotationJs);
    } catch (e) { console.error("Code err:", e); }

  } catch (err) {
    console.error(err);
    document.getElementById('hud-nav-status').innerText = 'PROTOCOL: ERROR_OFFLINE';
  }
}

// --- INPUT HANDLERS ---
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
      recognition.start();
      micBtn.classList.add('listening');
    });

    recognition.onresult = (event) => {
      micBtn.classList.remove('listening');
      processCommand(event.results[0][0].transcript);
    };
    recognition.onerror = () => micBtn.classList.remove('listening');
  }

  sendBtn.addEventListener('click', () => {
    if (manualInput.value.trim()) { initWebAudio(); processCommand(manualInput.value.trim()); manualInput.value = ''; }
  });
}

function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001;

  if (runtimeBehavior && planet) {
    try { runtimeBehavior(planet, starField, t); } 
    catch (e) { planet.rotation.y += 0.005; }
  } else if (planet) {
    planet.rotation.y += 0.005;
  }
  renderer.render(scene, camera);
}

init();
