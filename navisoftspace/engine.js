import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * RESPONSIBILITY: 
 * 1. Initialize the WebGL Renderer
 * 2. Create the 15,000 Star Background
 * 3. Set up the Sun's light source
 */

export function initEngine() {
    const scene = new THREE.Scene();
    
    // 1. Camera & Renderer
    const camera = new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight, 
        10,        // Near (increased to 10 for better math stability)
        10000000   // Far (increased to 10 Million for Neptune)
    );

    // NEW STARTING POSITION: Next to Earth (-60,000)
    camera.position.set(0, 500, -58000); 

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        logarithmicDepthBuffer: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // 2. The Starfield (MADE BIGGER)
    // Increased from 150k to 5 million so stars are everywhere!
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 20000; i++) {
        const x = (Math.random() - 0.5) * 5000000; 
        const y = (Math.random() - 0.5) * 5000000;
        const z = (Math.random() - 0.5) * 5000000;
        starPositions.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 50, // Made stars slightly bigger for visibility
        sizeAttenuation: true
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // 3. The Light (MOVED TO THE SUN)
    // The PointLight must be at 0,0,0 (where the sun.js object is)
    const sunLight = new THREE.PointLight(0xffffff, 20, 0, 0); 
    sunLight.position.set(0, 0, 0); 
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Brightened slightly
    scene.add(ambientLight);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer };
}
