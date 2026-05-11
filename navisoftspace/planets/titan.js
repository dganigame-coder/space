import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

export function createTitan(scene) {
    // 1. The Moon Body
    const geometry = new THREE.SphereGeometry(20, 32, 32); // Smaller than a planet
    const material = new THREE.MeshStandardMaterial({
        color: 0xffa500, // Distinct orange haze
        roughness: 0.9,
        metalness: 0.1
    });

    const titan = new THREE.Mesh(geometry, material);
    
    // 2. Data for HUD and Orbit
    titan.userData = {
        name: "Titan",
        type: "Satellite (Solid)",
        composition: "Ice/Rock with Methane Lakes",
        parent: "Saturn",
        orbitRadius: 200, // Distance from Saturn center
        orbitSpeed: 0.005,
        angle: Math.random() * Math.PI * 2
    };

    scene.add(titan);
    return titan;
}

export function updateTitanPosition(titan, saturn) {
    if (!saturn) return;

    // Update the orbital angle
    titan.userData.angle += titan.userData.orbitSpeed;

    // Calculate position relative to Saturn
    titan.position.x = saturn.position.x + Math.cos(titan.userData.angle) * titan.userData.orbitRadius;
    titan.position.z = saturn.position.z + Math.sin(titan.userData.angle) * titan.userData.orbitRadius;
    
    // Keep Titan slightly above/below the ring plane so it doesn't get "lost"
    titan.position.y = saturn.position.y + 10; 
}
