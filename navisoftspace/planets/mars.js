import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Orbit State (Persistent variables for Mars)
let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 91400; // 1.52 AU scale
const orbitSpeed = 0.0004;   // Proportional: slower than Earth (0.0005)

export function createMars() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // 1. Create the Shape
    const geometry = new THREE.SphereGeometry(400, 64, 64);

    // 2. Create the Material
    const marsMaterial = new THREE.MeshStandardMaterial({
        map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/planets/texture/2k_mars.jpg'),
        bumpMap: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/planets/texture/8k_mars.jpg'),
        bumpScale: 0.35,
        roughness: 1,
        metalness: 0
    });

    // 3. Create the Mesh
    const marsMesh = new THREE.Mesh(geometry, marsMaterial);
    group.add(marsMesh);

    group.userData = { 
        name: "MARS", 
        info: "The Red Planet. Iron oxide surface. 0.38G Gravity.",
        r: 400 
    };

    // 4. The Orbit & Rotation Logic
    group.onUpdate = () => {
        // Increment Angle
        orbitAngle += orbitSpeed;

        // Apply Circular Math
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;

        // Self Rotation (Mars has a day similar to Earth)
        marsMesh.rotation.y += 0.0006;
    };

    return group;
}
