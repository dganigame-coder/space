import * as THREE from 'three';

let scene, camera, renderer, planet, planetMaterial, dirLight;
let runtimeBehavior = null; // Compiled AI function pointer

function init() {
  const container = document.getElementById('viewport');
  
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 3, 5);
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0x111122));

  scene.fog = new THREE.FogExp2(0x030712, 0.05);

  const geo = new THREE.SphereGeometry(1.8, 64, 64);
  planetMaterial = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
  planet = new THREE.Mesh(geo, planetMaterial);
  scene.add(planet);

  setupVoiceCommander();
  animate(0);
}

// --- VOICE COMMANDER (Web Speech API) ---
function setupVoiceCommander() {
  const micBtn = document.getElementById('mic-btn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Web Speech API is not supported in this browser. Use Chrome or Edge.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';

  micBtn.addEventListener('click', () => {
    recognition.start();
    micBtn.classList.add('listening');
    micBtn.innerText = "Listening...";
  });

  recognition.onresult = async (event) => {
    micBtn.classList.remove('listening');
    micBtn.innerText = "Voice Commander";

    const transcript = event.results[0][0].transcript;
    document.getElementById('transcript').innerText = `"${transcript}"`;

    // Send Speech Transcript to AI Bridge
    const res = await fetch('/api/voice-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceTranscript: transcript })
    });

    const { worldConfig, textureUrl } = await res.json();

    // 1. Update Layout/HUD Data
    document.getElementById('sector-title').innerText = worldConfig.sectorTitle;
    document.getElementById('sector-lore').innerText = worldConfig.lore;
    document.getElementById('code-preview').innerText = worldConfig.rotationJs;

    // 2. Update Lighting & Fog
    dirLight.color.set(worldConfig.lightColor);
    scene.fog.color.set(worldConfig.fogColor);

    // 3. Compile AI Code at Runtime
    try {
      // Creates a dynamic function execution scope
      runtimeBehavior = new Function('mesh', 'time', worldConfig.rotationJs);
    } catch (e) {
      console.error("Runtime code evaluation error:", e);
    }

    // 4. Update Texture
    new THREE.TextureLoader().load(textureUrl, (tex) => {
      planetMaterial.map = tex;
      planetMaterial.needsUpdate = true;
    });
  };
}

function animate(time) {
  requestAnimationFrame(animate);

  const t = time * 0.001;

  // Execute AI-generated code if compiled
  if (runtimeBehavior && planet) {
    try {
      runtimeBehavior(planet, t);
    } catch (err) {
      // Fallback basic rotation
      planet.rotation.y += 0.005;
    }
  } else if (planet) {
    planet.rotation.y += 0.005;
  }

  renderer.render(scene, camera);
}

init();
