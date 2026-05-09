import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * RESPONSIBILITY: 
 * 1. Initialize the WebGL Renderer
 * 2. Create the Star Background (Infinite feel)
 * 3. Set up the Sun's light source
 * 4. Handle Physics (Collisions & Shakes)
 */

export function initEngine() {
    const scene = new THREE.Scene();
    
    // 1. Camera & Renderer
    const camera = new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight, 
        0.1,       
        10000000   
    );

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

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // CRITICAL: We return 'stars' now so it can be updated in the main loop
    return { scene, camera, renderer, stars };
}

let isColliding = false; 
let monitorTimer;

/**
 * Main collision loop
 */
export function checkCollisions(camera, planets) {
    if (!planets) return;

    planets.forEach(planet => {
        const dist = camera.position.distanceTo(planet.position);
        const radius = planet.userData.r || 500; 
        const type = planet.userData.type;

        if (dist < radius) { 
            console.log(`Collision Detected: ${planet.userData.name} | Type: ${type}`);

            // 1. Handle Gas Giants (Pass-through + Scanner)
            if (type === 'gas') {
                updateRightMonitor(planet); // Show info on the right
                triggerAtmosphereEntry(camera, planet); // Handle physics/drag
            } 
            // 2. Handle Stars (Radiation/Pushback)
            else if (type === 'star') {
                updateRightMonitor(planet);
                triggerSolarFlare(camera);
            } 
            // 3. Handle Solids (Impact/Bounce)
            else {
                if (!isColliding) {
                    console.warn(`CRASH: Impact on ${planet.userData.name} surface!`);
                    updateRightMonitor(planet); // Still show info, but triggers impact
                    triggerImpact(camera);
                    
                    isColliding = true;
                    setTimeout(() => isColliding = false, 1000); 
                }
            }
        }
    });
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

/**
 * Physics for Gas Giants - No "Wall", just drag
 */
function triggerAtmosphereEntry(camera, planet) {
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    
    // Slow the ship down to simulate thick atmosphere
    if (window.currentSpeed) {
        window.currentSpeed *= 0.98; 
    }
    
    // Note: No camera.translateZ here so you can pass through!
}

/**
 * Physics for Solid Planets - Bounce and Shake
 */
function triggerImpact(camera) {
    camera.translateZ(200); // Kick back
    if (navigator.vibrate) navigator.vibrate(200);
    // Add your shake logic here if desired
}

/**
 * Physics for the Sun
 */
function triggerSolarFlare(camera) {
    camera.translateZ(100); // Solar wind pushback
    console.log("Radiation levels critical!");
}
