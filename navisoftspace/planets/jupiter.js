import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Orbit State (Persistent variables for Jupiter)
let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 312000; // 5.2 AU scale
const orbitSpeed = 0.00025;   // Slower than Earth, faster than Saturn

export function createJupiter() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // Jupiter doesn't have a bump map (it's gas!), but it has high detail
    const jupiter = new THREE.Mesh(
        new THREE.SphereGeometry(3000, 128, 128),
        new THREE.MeshStandardMaterial({
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_jupiter.jpg'),
            roughness: 1.0,
            metalness: 0.0
        })
    );
    group.add(jupiter);

    // Position is now handled by onUpdate, so we remove the static .set()
    group.userData = { 
        name: "JUPITER", 
        info: "Gas Giant. Great Red Spot detected. 2.5G Gravity.",
        r: 3000 
    };

    // 2. The Orbit Logic
    group.onUpdate = () => {
        // Increment Angle
        orbitAngle += orbitSpeed;

        // Apply Circular Math (Orbiting the Sun at 0,0,0)
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;

        // Self Rotation (Jupiter has the shortest day in the solar system!)
        jupiter.rotation.y += 0.004; 
    };

    return group;
}
