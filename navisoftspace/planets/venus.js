import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Orbit State (Persistent variables for Venus)
let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 43200; // 0.72 AU scale
const orbitSpeed = 0.0006;   // Proportional: Between Mercury (0.0008) and Earth (0.0005)

export function createVenus() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();
    
    const venus = new THREE.Mesh(
        new THREE.SphereGeometry(380, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_venus_surface.jpg'),
        })
    );
    group.add(venus);

    group.userData = { 
        name: "VENUS", 
        info: "Thick CO2 atmosphere. 460°C surface temps. Retrograde rotation.",
        r: 450 ,
        type:"solid"
    };

    // 2. The Orbit & Rotation Logic
    group.onUpdate = () => {
        // Increment Angle (Forward orbital motion)
        orbitAngle += orbitSpeed;

        // Apply Circular Math
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;

        // Self Rotation (Venus spins backwards and very slowly!)
        venus.rotation.y -= 0.0002; 
    };

    return group;
}
