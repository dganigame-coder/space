import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * RESPONSIBILITY: 
 * 1. Initialize the WebGL Renderer
 * 2. Create the Star Background
 * 3. Set up the Sun's light source
 * 4. Handle Physics (Collisions & Shakes)
 */

export function initEngine() {
    const scene = new THREE.Scene();
    
    // 1. Camera & Renderer
    const camera = new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight, 
        0.1,       // FIX: Changed from 10 to 0.1 so planets don't disappear when close
        10000000   // Far (10 Million covers Pluto and Stars)
    );

    // NEW STARTING POSITION: Next to Earth (-58,000 to see Earth clearly)
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
    for (let i = 0; i < 20000; i++) {
        const x = (Math.random() - 0.5) * 8000000; // Expanded to 8M for better coverage
        const y = (Math.random() - 0.5) * 8000000;
        const z = (Math.random() - 0.5) * 8000000;
        starPositions.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 800, // Large size works better with massive coordinate scales
        sizeAttenuation: true
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // 3. The Lighting
    const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0); // Intensity adjusted for Three.js 160+
    sunLight.position.set(0, 0, 0); 
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Lowered slightly to make night-sides darker
    scene.add(ambientLight);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer };
}

/**
 * PLUG & PLAY COLLISION LOGIC
 * Call this in your main animate loop: checkCollisions(camera, bodies);
 */
export function checkCollisions(camera, planets) {
    if (!planets) return;

    planets.forEach(planet => {
        const dist = camera.position.distanceTo(planet.position);
        // Use the radius stored in planet.userData.r
        const radius = planet.userData.r || 500; 

        if (dist < radius + 50) { 
            triggerImpact(camera);
        }
    });
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
    
    // 3. Physics Bounce (Prevents getting stuck inside the mesh)
    camera.translateZ(600); 
}
