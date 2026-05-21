import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import * as Tone from 'https://cdn.skypack.dev/tone@14.8.49';
import { playHighFi, loadSoundLibrary  } from 'audio';
/**
 * RESPONSIBILITY: 
 * 1. Initialize the WebGL Renderer
 * 2. Create the Star Background (Infinite feel)
 * 3. Set up the Sun's light source
 * 4. Handle Physics (Collisions & Shakes)
 */

/**
 * THIS IS THE ACTIVATOR
 * Call this from index.html inside the 'pointerdown' event
 */
export async function bootSystems() {
    console.log("Master Boot Sequence Initiated...");

    // A. Unlock Tone.js (Using the safe handle)
    const T = Tone.default || Tone;
    await T.start();

    // B. Initialize audio nodes in audio.js
    await loadSoundLibrary();

    console.log("All Systems Green. Audio State:", T.context.state);
}

// Add 'async' here!
export async function initEngine() {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 10, 1000000000);
    camera.position.set(0, 500, -58000); 

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        logarithmicDepthBuffer: true // Vital for Pluto's moons!
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Starfield
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 20000; i++) {
        const x = (Math.random() - 0.5) * 80000000; // Expanded for Pluto scale
        const y = (Math.random() - 0.5) * 80000000;
        const z = (Math.random() - 0.5) * 80000000;
        starPositions.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 5000, // Larger stars for larger scale
        sizeAttenuation: true
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Lighting
    const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0); 
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    scene.fog = new THREE.Fog(0x000000, 1000, 500000000);
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, stars };
}

/**
 * Updates the sleek right-side monitor text
 * Replaces the old "Close Log" dialog box
 */
function updateRightMonitor(spaceObject) {
    const monitor = document.getElementById('right-monitor');
    const textTarget = document.getElementById('monitor-text');

    if (!monitor || !textTarget) return;

    // Set the text content from the spaceObject's mini-project data
    textTarget.innerHTML = `
        <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 4px;">> ${spaceObject.userData.name}</div>
        <div style="font-size: 0.85rem; line-height: 1.4; opacity: 0.9;">${spaceObject.userData.info}</div>
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

export function checkCollisions(camera, bodies, scene) {
    if (!bodies || !scene || !scene.fog) return; // Safety guard
    
    // Core tracking accumulators across the current frame execution matrix
    let globalInAmbientZone = false;
    let absoluteMaxPenetration = 0; 

    // --- 1. LONG RANGE LOGGING SYSTEM ---
    if (!window.lastLogTime) window.lastLogTime = 0;
    const now = Date.now();
    
    if (now - window.lastLogTime > 5000) { // Log every 5 seconds
        bodies.forEach(spaceObject => {
            if (!spaceObject || !spaceObject.userData) return;
            const t = spaceObject.userData.type;
            if (t === 'nebula' || t === 'supernova' || t === 'blackhole') {
                const dist = camera.position.distanceTo(spaceObject.position);
                console.group(`📡 Long-Range Scanner: ${spaceObject.userData.name || 'Unknown Anomaly'}`);
                console.log(`Distance: ${Math.round(dist)} units`);
                console.log(`In View Window: ${dist < camera.far ? "✅ YES" : "❌ TOO FAR (Clipped)"}`);
                console.groupEnd();
            }
        });
        window.lastLogTime = now;
    }

    // --- 2. MASTER UNIFIED PROCESSING LOOP ---
    bodies.forEach(spaceObject => {
        if (!spaceObject || !spaceObject.userData) return;

        const dist = camera.position.distanceTo(spaceObject.position);
        const radius = spaceObject.userData.r || 500; 
        const type = spaceObject.userData.type;

        // A. Visual Animation Processing Loops (Nebulae & Supernovas)
        if (spaceObject.userData.isBreathing && spaceObject.children) {
            spaceObject.children.forEach((child) => {
                // Animate the Gas Sprites
                if (child instanceof THREE.Sprite) {
                    child.userData.phase = (child.userData.phase || 0) + (child.userData.speed || 0.005);
                    const pulse = Math.sin(child.userData.phase) * 0.05;
                    child.material.opacity = (child.userData.baseOpacity || 0.1) + pulse;
                    child.material.rotation += 0.0002; 
                }
    
                // Pulsing Supernova Light Flicker
                if (child instanceof THREE.PointLight && type === 'supernova') {
                    const noise = Math.random() * 2; 
                    const heat = Math.sin(Date.now() * 0.001) * 5;
                    child.intensity = 15 + noise + heat; 
                }
            });
        }

        // B. Anomaly Internal Custom Engine Updates (Ex: Spinning 4K Accretion Disks)
        if (typeof spaceObject.onUpdate === 'function') {
            spaceObject.onUpdate();
        }

        // C. Asteroid Belt Geometric Donut Matrix Math
        if (type === 'asteroid_belt') {
            const innerRadius = spaceObject.userData.innerRadius || 0;
            const outerRadius = spaceObject.userData.outerRadius || 0;
            const distFromCenter = camera.position.length(); 
        
            if (distFromCenter >= innerRadius && distFromCenter <= outerRadius) {
                globalInAmbientZone = true;
            
                const mid = (innerRadius + outerRadius) / 2;
                const halfWidth = (outerRadius - innerRadius) / 2;
                const penetration = 1 - (Math.abs(distFromCenter - mid) / halfWidth);
                const safePenetration = Math.max(0, Math.min(1, penetration)); // Clamp 0-1
        
                playHighFi('ASTEROID_BELT', safePenetration);
        
                let currentSpeed = 0;
                // Safe Engine Variable Tracking Accessor
                if (typeof engine !== 'undefined' && engine.velocity) {
                    currentSpeed = typeof engine.velocity.length === 'function' 
                        ? engine.velocity.length() 
                        : engine.velocity;
                } else if (typeof velocity !== 'undefined' && velocity) {
                    currentSpeed = typeof velocity.length === 'function' ? velocity.length() : velocity;
                }
        
                if (currentSpeed > 0) {
                    const currentTime = performance.now();
                    if (typeof window.lastImpactTime === 'undefined') window.lastImpactTime = 0;
                    
                    if (currentTime - window.lastImpactTime > 300) {
                        if (Math.random() < 0.06 * safePenetration) {
                            playHighFi('BELT_ROCK', safePenetration); 
                            window.lastImpactTime = currentTime;
                        }
                    }
                }
            }
        }

        // D. Spherical Spatial Boundary Trigger Matrix
        if (dist < radius) { 
            const penetration = Math.max(0, (radius - dist) / radius);
            globalInAmbientZone = true;

            // Gas Giants Environmental Entry Tracking
            if (type === 'gas') {
                absoluteMaxPenetration = Math.max(absoluteMaxPenetration, penetration);
                updateRightMonitor(spaceObject);
                triggerAtmosphereEntry(camera, spaceObject, penetration);
                playHighFi('GAS_RUSH', penetration); 
            } 
            // Radiant Energy Stars
            else if (type === 'star') {
                updateRightMonitor(spaceObject);
                triggerSolarFlare(camera, spaceObject);
                playHighFi('SOLAR_STATIC', penetration);
            } 
            // Gravitational Singularities (Black Holes)
            else if (type === 'blackhole') {
                updateRightMonitor(spaceObject);
                playHighFi('VOID_GRAVITY', penetration);
            }
            // Spatial Rifts / Wormholes
            else if (type === 'wormhole') {
                updateRightMonitor(spaceObject);
                playHighFi('WORMHOLE_PULSE', penetration);
                camera.rotation.z += Math.sin(Date.now() * 0.01) * penetration * 0.1;
            }
            // Rigid Mesh Collisions (Asteroids / Planets Surfaces)
            else if (type === 'solid') {
                if (typeof window.isColliding === 'undefined') window.isColliding = false;
                if (!window.isColliding) {
                    updateRightMonitor(spaceObject);
                    triggerImpact(camera);
                    playHighFi('HULL_IMPACT');
                    playHighFi('COCKPIT_ALARM');
                    window.isColliding = true;
                    setTimeout(() => window.isColliding = false, 1000); 
                }
            }
        }
    });

    // --- 3. VOLUMETRIC SPACE FOG PIPELINE CONTROLLER ---
    if (globalInAmbientZone && absoluteMaxPenetration > 0.05) {
        scene.fog.color.setHex(0x332211); // Dense Jovian/Saturnian dusty cloud hue
        scene.fog.near = 10;
        scene.fog.far = 10000 - (absoluteMaxPenetration * 9500); 
    } else {
        scene.fog.far = 10000000; // Instantly restore deep clear vacuum range
    }

    // --- 4. HIGH-FI AUDIO CYCLE GARBAGE COLLECTION ---
    if (!globalInAmbientZone) {
        playHighFi('GAS_RUSH', 0);
        playHighFi('SOLAR_STATIC', 0);
        playHighFi('VOID_GRAVITY', 0);
        playHighFi('WORMHOLE_PULSE', 0);
        if (typeof activeAmbient !== 'undefined') activeAmbient = false;
    } else {
        if (typeof activeAmbient !== 'undefined') activeAmbient = true;
    }
}
// --- BEHAVIOR DEFINITIONS ---

function triggerAtmosphereEntry(camera, spaceObject, penetration) {
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
function triggerAtmosphereEntry(camera, spaceObject) {
    // PHYSICS: Speed drag
    if (window.currentSpeed) {
        window.currentSpeed *= 0.96; 
    }
    if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
}

*/

export function triggerSolarFlare(camera, spaceObject) {
    const dist = camera.position.distanceTo(spaceObject.position);
    const radius = spaceObject.userData.r || 5000;
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
