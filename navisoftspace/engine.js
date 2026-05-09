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

/**
 * Call this in your main animate loop: 
 * checkCollisions(engine.camera, bodies);
 */
let isColliding = false; 

export function checkCollisions(camera, planets) {
    if (!planets) return;

    planets.forEach(planet => {
        const dist = camera.position.distanceTo(planet.position);
        const radius = planet.userData.r || 500; 
        const type = planet.userData.type;

        if (dist < radius) { 
            // --- LOGGING THE HIT ---
            console.log(`Collision Detected: ${planet.userData.name} | Type: ${type}`);

            if (type === 'gas') {
                // No cooldown needed for gas, it's a smooth "sinking" feeling
                triggerAtmosphereEntry(camera, planet);
            } 
            else if (type === 'star') {
                console.log("ALERT: Solar radiation detected!");
                triggerSolarFlare(camera);
            } 
            else {
                // 'solid' logic - only trigger once to avoid "machine gun" logs
                if (!isColliding) {
                    console.warn(`CRASH: Impact on ${planet.userData.name} surface!`);
                    triggerImpact(camera);
                    isColliding = true;
                    setTimeout(() => isColliding = false, 1000); 
                }
            }
        }
    });
}


function triggerAtmosphereEntry(camera, planetColor) {
    // 1. Slow the ship down to a crawl
    // 2. You can trigger a 'Fog' effect in your scene here
    console.log("Entering Gas Giant atmosphere...");
    
    // Add a deep vibration instead of a sharp shake
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 500]);
    
    // Push the camera back slightly, but don't 'bounce' it
    camera.translateZ(10); 
}

function triggerImpact(camera) {
    // 1. Camera Shake
    const shake = 25;
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;

    // 2. Mobile Vibration
    if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(150); 
    }
    
    // 3. Physics Bounce
    camera.translateZ(600); 
}
