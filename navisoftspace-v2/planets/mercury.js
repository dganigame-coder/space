import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Orbit State (Persistent variables for Mercury)
let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 23400; // 0.39 AU scale
const orbitSpeed = 0.0008;   // Proportional: Faster than Earth (0.0005)

export function createMercury() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();
    
    const mercury = new THREE.Mesh(
        new THREE.SphereGeometry(150, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_mercury.jpg'),
            bumpMap: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/8k_mercury.jpg'),
            bumpScale: 2
        })
    );
    group.add(mercury);

    group.userData = { 
        name: "MERCURY", 
        info: "Smallest planet. Iron core. No atmosphere.",
        r: 150 ,
        type:"solid"
    };

    // 2. The Orbit & Rotation Logic
    group.onUpdate = () => {
        // Increment Angle
        orbitAngle += orbitSpeed;

        // Apply Circular Math
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;

        // Self Rotation (Mercury rotates slowly on its axis)
        mercury.rotation.y += 0.0004; 
    };

    return group;
}
