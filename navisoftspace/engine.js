import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * RESPONSIBILITY: 
 * 1. Initialize the WebGL Renderer
 * 2. Create the 15,000 Star Background
 * 3. Set up the Sun's light source
 */

export function initEngine() {
    // 1. The Stage
    const scene = new THREE.Scene();
    
    // Perspective Camera: 75 degree field of view
    // LogarithmicDepthBuffer is CRITICAL for space—it stops "flickering" 
    // when planets are far away.
    const camera = new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight, 
        0.1, 
        5000000 
    );

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        logarithmicDepthBuffer: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // High-res but fast
    document.body.appendChild(renderer.domElement);

    // 2. The Starfield (The "Space" Feeling)
    // We create 15,000 points randomly distributed in a massive cube
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 15000; i++) {
        const x = (Math.random() - 0.5) * 150000;
        const y = (Math.random() - 0.5) * 150000;
        const z = (Math.random() - 0.5) * 150000;
        starPositions.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 20,
        sizeAttenuation: true
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // 3. The Light (The "Touch and Feel" of 3D)
    // PointLight acts as the Sun. All planets will be lit from this one spot.
    const sunLight = new THREE.PointLight(0xffffff, 15, 2000000);
    sunLight.position.set(0, 0, -60000); // Must match Sun's position in sun.js
    scene.add(sunLight);

    // Ambient Light: Softly lights the dark side of planets so they aren't pitch black
    const ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);

    // Handle Window Resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer };
}
