import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Orbit State (Pluto is the furthest)
let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 2370000; // 39.5 AU scale (Further than Neptune!)
const orbitSpeed = 0.00005;    // The slowest mover in the system

export function createPluto() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    const pluto = new THREE.Mesh(
        new THREE.SphereGeometry(120, 64, 64), // Very small!
        new THREE.MeshStandardMaterial({
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/pluto.jpg'), // Using a rocky/icy texture
            roughness: 0.8,
            metalness: 0
        })
    );
    group.add(pluto);

    group.userData = { 
        name: "PLUTO", 
        info: "Dwarf Planet. Icy mountains and nitrogen glaciers. 39.5 AU.",
        r: 120 
    };

    // 2. The Orbit Logic
    group.onUpdate = () => {
        orbitAngle += orbitSpeed;
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;
        
        pluto.rotation.y += 0.0005;
    };

    return group;
}
