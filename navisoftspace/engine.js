/**10-05-26 22:41   **/
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { playHighFi } from 'https://cdn.jsdelivr.net/gh/dganigame-coder/space@main/navisoftspace/audio.js';
/**
 * RESPONSIBILITY: 
 * 1. Initialize the WebGL Renderer
 * 2. Create the Star Background (Infinite feel)
 * 3. Set up the Sun's light source
 * 4. Handle Physics (Collisions & Shakes)
 */
/*   10-05-2026 22:17         */
export function initEngine() {
    const scene = new THREE.Scene();
    
    // 1. Camera & Renderer
    const camera = new THREE.PerspectiveCamera( 75,  window.innerWidth / window.innerHeight, 0.1, 10000000);
    // STARTING POSITION: Earth Vicinity
    camera.position.set(0, 500, -58000); 

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        logarithmicDepthBuffer: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // 2. The Starfield
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    // Spread stars in a massive 8-million unit cube
    for (let i = 0; i < 20000; i++) {
        const x = (Math.random() - 0.5) * 8000000; 
        const y = (Math.random() - 0.5) * 8000000;
        const z = (Math.random() - 0.5) * 8000000;
        starPositions.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 800, 
        sizeAttenuation: true
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // 3. The Lighting
    const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0); 
    sunLight.position.set(0, 0, 0); 
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); 
    scene.add(ambientLight);

    // ADD THIS: Initial fog (starts as black/invisible)
    scene.fog = new THREE.Fog(0x000000, 1, 10000000); 
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // CRITICAL: We return 'stars' now so it can be updated in the main loop
    return { scene, camera, renderer, stars };
}

/**
 * Updates the sleek right-side monitor text
 * Replaces the old "Close Log" dialog box
 */
function updateRightMonitor(planet) {
    const monitor = document.getElementById('right-monitor');
    const textTarget = document.getElementById('monitor-text');

    if (!monitor || !textTarget) return;

    // Set the text content from the planet's mini-project data
    textTarget.innerHTML = `
        <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 4px;">> ${planet.userData.name}</div>
        <div style="font-size: 0.85rem; line-height: 1.4; opacity: 0.9;">${planet.userData.info}</div>
    `;

    // Fade in the monitor
    monitor.style.opacity = '1';

    // Auto-hide after 5 seconds of no new collisions
    clearTimeout(monitorTimer);
    monitorTimer = setTimeout(() => {
        monitor.style.opacity = '0';
    }, 5000);
}

let isColliding = false; 
let monitorTimer;
let activeAmbient = false; // Track if we are currently playing ambient noise

export function checkCollisions(camera, planets, scene) {
    if (!planets || !scene || !scene.fog) return; // Safety guard

    let inAmbientZone = false;
    let maxPenetration = 0; // Track how deep we are for fog

    planets.forEach(planet => {
        const dist = camera.position.distanceTo(planet.position);
        const radius = planet.userData.r || 500; 
        const type = planet.userData.type;

        if (dist < radius) { 
            const penetration = Math.max(0, (radius - dist) / radius);

            // --- 1. GAS GIANTS (Pass-through + Wind Audio) ---
            /*
            if (type === 'gas') {
                inAmbientZone = true;
                updateRightMonitor(planet);
                triggerAtmosphereEntry(camera, planet);
                
                // Tone.js Intensity: 0.0 to 1.0
                playHighFi('GAS_RUSH', penetration); 
            } 
*/
                if (type === 'gas') {
                inAmbientZone = true;
                maxPenetration = Math.max(maxPenetration, penetration); // Store for fog
                updateRightMonitor(planet);
                triggerAtmosphereEntry(camera, planet, penetration); // Pass penetration
                playHighFi('GAS_RUSH', penetration); 
            }
                
            // --- 2. STARS (Radiation + Static Audio) ---
            else if (type === 'star') {
                inAmbientZone = true;
                updateRightMonitor(planet);
                triggerSolarFlare(camera, planet);

                // Tone.js Intensity: 0.0 to 1.0
                playHighFi('SOLAR_STATIC', penetration);
            } 

            // --- 3. SOLID PLANETS (Hard Crash + Impact Audio) ---
            else if (type === 'solid') {
                if (!isColliding) {
                    updateRightMonitor(planet);
                    triggerImpact(camera);
                    
                    // Trigger instantaneous synths
                    playHighFi('HULL_IMPACT');
                    playHighFi('COCKPIT_ALARM');
                    
                    isColliding = true;
                    setTimeout(() => isColliding = false, 1000); 
                }
            }
        }
    });


    // --- FOG / CLOUD LOGIC ---
    if (inAmbientZone && maxPenetration > 0.05) {
        // As you go deeper, the fog distance gets shorter (thicker clouds)
        scene.fog.color.setHex(0x332211); // Dusty Saturn brown
        scene.fog.near = 10;
        scene.fog.far = 10000 - (maxPenetration * 9500); 
    } else {
        scene.fog.far = 10000000; // Reset to clear space
    }
    // --- 4. AMBIENT RESET ---
    // If we aren't near any gas/stars, fade the sounds to -Infinity
    if (!inAmbientZone && activeAmbient) {
        playHighFi('GAS_RUSH', 0);
        playHighFi('SOLAR_STATIC', 0);
        activeAmbient = false;
    } else if (inAmbientZone) {
        activeAmbient = true;
    }
}

// --- BEHAVIOR DEFINITIONS ---

function triggerAtmosphereEntry(camera, planet, penetration) {
    // 1. PHYSICS: Drag (The deeper you are, the more you slow down)
    if (window.currentSpeed) {
        const dragFactor = 1 - (penetration * 0.08); // Max 8% reduction per frame
        window.currentSpeed *= dragFactor; 
    }

    // 2. CAMERA SHAKE: Simulate turbulence
    const shakeAmount = penetration * 5; // Adjust for more/less violence
    camera.position.x += (Math.random() - 0.5) * shakeAmount;
    camera.position.y += (Math.random() - 0.5) * shakeAmount;

    // 3. VIBRATION (Mobile only)
    if (navigator.vibrate) {
        navigator.vibrate(penetration * 50);
    }
}

/*
function triggerAtmosphereEntry(camera, planet) {
    // PHYSICS: Speed drag
    if (window.currentSpeed) {
        window.currentSpeed *= 0.96; 
    }
    if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
}

*/

export function triggerSolarFlare(camera, planet) {
    const dist = camera.position.distanceTo(planet.position);
    const radius = planet.userData.r || 5000;
    const penetration = Math.max(0, (radius - dist) / radius);

    // Exponential Pushback
    const basePush = 120;
    const exponentialForce = penetration * 600; 
    camera.translateZ(basePush + exponentialForce);

    // Visual Heat Effect
    document.body.style.filter = `contrast(${1.5 + penetration}) sepia(0.5) saturate(2)`;
    setTimeout(() => { 
        document.body.style.filter = "none"; 
    }, 50);

    if (window.currentSpeed) window.currentSpeed *= 0.8;
    if (navigator.vibrate) navigator.vibrate(penetration * 100);
}

function triggerImpact(camera) {
    camera.translateZ(200); 
    if (navigator.vibrate) navigator.vibrate(200);
}
