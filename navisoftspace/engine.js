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
    
    let inAmbientZone = false;
    let maxPenetration = 0; // Track how deep we are for fog

    // Add this near your camera update logic
    if (!window.lastLogTime) window.lastLogTime = 0;
    const now = Date.now();
    
    if (now - window.lastLogTime > 5000) { // Log every 5 seconds
        bodies.forEach(spaceObject => {
            if (spaceObject.userData.type === 'nebula' || spaceObject.userData.type === 'supernova') {
                const dist = camera.position.distanceTo(spaceObject.position);
                
                console.group(`📡 Long-Range Scanner: ${spaceObject.userData.name}`);
                console.log(`Distance: ${Math.round(dist)} units`);
                console.log(`In Camera View: ${dist < camera.far ? "✅ YES" : "❌ TOO FAR (Clipped)"}`);
                console.groupEnd();
            }
        });
        window.lastLogTime = now;
    }

    /*
    bodies.forEach(spaceObject => {
        const dist = camera.position.distanceTo(spaceObject.position);
        const radius = spaceObject.userData.r || 500; 
        const type = spaceObject.userData.type;

            // Handling BOTH Nebulae and Supernovas
            if (spaceObject.userData.isBreathing) {
                spaceObject.children.forEach((child, index) => {
                    
                    // 1. Animate the Gas Sprites
                    if (child instanceof THREE.Sprite) {
                        child.userData.phase += child.userData.speed;
                        const pulse = Math.sin(child.userData.phase) * 0.05;
                        child.material.opacity = (child.userData.baseOpacity || 0.1) + pulse;
                        child.material.rotation += 0.0002; // Churning gas
                    }
        
                    // 2. WOW EFFECT: Pulsing Supernova Light
                    if (child instanceof THREE.PointLight && spaceObject.userData.type === 'supernova') {
                        // Creates a "high-energy" flicker effect
                        const noise = Math.random() * 2; 
                        child.intensity = 15 + noise; 
                        
                        // Make the light "heat up" and "cool down"
                        const heat = Math.sin(Date.now() * 0.001) * 5;
                        child.intensity += heat;
                    }
                });
            }

            // --- 1. BELT LOGIC (The Donut) ---
            if (type === 'asteroid_belt') {
                const innerRadius = spaceObject.userData.innerRadius;
                const outerRadius = spaceObject.userData.outerRadius;
                const distFromCenter = camera.position.length(); 
            
                if (distFromCenter >= innerRadius && distFromCenter <= outerRadius) {
                    inAmbientZone = true;
                    
                    // Calculate volume based on how deep you are in the ring
                    const mid = (innerRadius + outerRadius) / 2;
                    const halfWidth = (outerRadius - innerRadius) / 2;
                    const penetration = 1 - (Math.abs(distFromCenter - mid) / halfWidth);
            
                    playHighFi('ASTEROID_BELT', penetration);
            
                    // 👇 SAFE CHECK: Ensure velocity exists before testing it
                    let currentSpeed = 0;
                    if (engine.velocity) {
                        // If it's a Vector3, get its length. If it's a number, use it directly.
                        currentSpeed = typeof engine.velocity.length === 'function' 
                            ? engine.velocity.length() 
                            : engine.velocity;
                    }
            
                    // Only trigger impacts if the ship is actually moving through the space rocks
                    if (currentSpeed > 0) {
                        const crunchChance = 0.05 * penetration; // Kept at a safe 5% max chance per frame
                        
                        if (Math.random() < crunchChance) {
                            playHighFi('HULL_IMPACT', penetration); 
                        }
                    }
                }
            }
        if (dist < radius) { 
            const penetration = Math.max(0, (radius - dist) / radius);
            inAmbientZone = true;
            // --- 1. GAS GIANTS & STARS (Existing Logic) ---
            if (type === 'gas') {
                maxPenetration = Math.max(maxPenetration, penetration);
                updateRightMonitor(spaceObject);
                triggerAtmosphereEntry(camera, spaceObject, penetration);
                playHighFi('GAS_RUSH', penetration); 
            } 
            else if (type === 'star') {
                updateRightMonitor(spaceObject);
                triggerSolarFlare(camera, spaceObject);
                playHighFi('SOLAR_STATIC', penetration);
            } 

            // --- 2. NEW SPECIAL OBJECTS (Integrated) ---
            else if (type === 'blackhole') {
                updateRightMonitor(spaceObject);
                // Heavy gravity pull/distortion
                playHighFi('VOID_GRAVITY', penetration);
                // Visual distort: increase contrast as you fall in
                //document.body.style.filter = `brightness(${1 - penetration}) contrast(${1 + penetration})`;
            }
            else if (type === 'wormhole') {
                //updateRightMonitor(spaceObject);
                playHighFi('WORMHOLE_PULSE', penetration);
                // Wobble effect
                camera.rotation.z += Math.sin(Date.now() * 0.01) * penetration * 0.1;
            }
            /*else if (type === 'wormhole') {
            const penetration = Math.max(0, (radius - dist) / radius);
            updateRightMonitor(spaceObject);
            playHighFi('WORMHOLE_PULSE', penetration);
            // Wobble effect
            //camera.rotation.z += Math.sin(Date.now() * 0.01) * penetration * 0.1;
        }*/
                /*
            else if (type === 'asteroid_belt') {
                // No monitor text for general debris, just rumble
                playHighFi('ASTEROID_BELT', penetration);
            }
                
            // --- 3. SOLID bodies (Hard Crash) ---
            else if (type === 'solid') {
                if (!isColliding) {
                    updateRightMonitor(spaceObject);
                    triggerImpact(camera);
                    playHighFi('HULL_IMPACT');
                    playHighFi('COCKPIT_ALARM');
                    isColliding = true;
                    setTimeout(() => isColliding = false, 1000); 
                }
            }
        }
    });

*/


    bodies.forEach(spaceObject => {
        const dist = camera.position.distanceTo(spaceObject.position);
        const radius = spaceObject.userData.r || 500; 
        const type = spaceObject.userData.type;

        // --- 1. VISUAL ANIMATION LOGIC (Nebulae & Supernovas) ---
        if (spaceObject.userData.isBreathing) {
            spaceObject.children.forEach((child, index) => {
                
                // Animate the Gas Sprites
                if (child instanceof THREE.Sprite) {
                    child.userData.phase += child.userData.speed;
                    const pulse = Math.sin(child.userData.phase) * 0.05;
                    child.material.opacity = (child.userData.baseOpacity || 0.1) + pulse;
                    child.material.rotation += 0.0002; // Churning gas
                }
    
                // Pulsing Supernova Light
                if (child instanceof THREE.PointLight && spaceObject.userData.type === 'supernova') {
                    const noise = Math.random() * 2; 
                    child.intensity = 15 + noise; 
                    
                    const heat = Math.sin(Date.now() * 0.001) * 5;
                    child.intensity += heat;
                }
            });
        }

        if (type === 'asteroid_belt') {
                    const innerRadius = spaceObject.userData.innerRadius;
                    const outerRadius = spaceObject.userData.outerRadius;
                    const distFromCenter = camera.position.length(); 
                
                    if (distFromCenter >= innerRadius && distFromCenter <= outerRadius) {
                        inAmbientZone = true;
                        
                        const mid = (innerRadius + outerRadius) / 2;
                        const halfWidth = (outerRadius - innerRadius) / 2;
                        const penetration = 1 - (Math.abs(distFromCenter - mid) / halfWidth);
                
                        playHighFi('ASTEROID_BELT', penetration);
                
                        // 👇 READ VELOCITY LENGTH FROM THE PILOT MODULE IMPORT DIRECTLY
                        let currentSpeed = 0;
                        if (typeof velocity !== 'undefined' && velocity) {
                            currentSpeed = velocity.length();
                        }
                
                        if (currentSpeed > 0) {
                            const currentTime = performance.now();
                            
                            // Create a global window variable for the impact timer to bypass scope blocks
                            if (typeof window.lastImpactTime === 'undefined') window.lastImpactTime = 0;
                            
                            if (currentTime - window.lastImpactTime > 300) {
                                if (Math.random() < 0.06 * penetration) {
                                    playHighFi('BELT_ROCK', penetration); 
                                    window.lastImpactTime = currentTime;
                                }
                            }
                        }
                    }
                }

        // --- 3. STANDARD SPHERICAL PROXIMITY LOGIC ---
        if (dist < radius) { 
            const penetration = Math.max(0, (radius - dist) / radius);
            inAmbientZone = true;

            // Gas Giants & Atmospheric entry
            if (type === 'gas') {
                maxPenetration = Math.max(maxPenetration, penetration);
                updateRightMonitor(spaceObject);
                triggerAtmosphereEntry(camera, spaceObject, penetration);
                playHighFi('GAS_RUSH', penetration); 
            } 
            // Radiant Stars
            else if (type === 'star') {
                updateRightMonitor(spaceObject);
                triggerSolarFlare(camera, spaceObject);
                playHighFi('SOLAR_STATIC', penetration);
            } 
            // Singularity Objects
            else if (type === 'blackhole') {
                updateRightMonitor(spaceObject);
                playHighFi('VOID_GRAVITY', penetration);
            }
            // Hyperspace Wormholes
            else if (type === 'wormhole') {
                playHighFi('WORMHOLE_PULSE', penetration);
                camera.rotation.z += Math.sin(Date.now() * 0.01) * penetration * 0.1;
            }
            // Rigid Bodies (Hard Collisions)
            else if (type === 'solid') {
                if (!isColliding) {
                    updateRightMonitor(spaceObject);
                    triggerImpact(camera);
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
