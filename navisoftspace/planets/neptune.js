import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Orbit State (Persistent variables for Neptune)
let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 1803600; // 30.0 AU scale
const orbitSpeed = 0.00007;    // The slowest speed for the furthest planet

export function createNeptune() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    const neptune = new THREE.Mesh(
        new THREE.SphereGeometry(1050, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_neptune.jpg'),
            shininess: 2
        })
    );
    
    group.add(neptune);

    group.userData = { 
      name: "NEPTUNE", 
      info: "The Windy Planet. Azure blue world. 30.0 AU from the Sun.", 
      r: 1050 
    };

    // 2. The Orbit & Rotation Logic
    group.onUpdate = () => {
        // Increment Angle
        orbitAngle += orbitSpeed;

        // Apply Circular Math
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;

        // Self Rotation
        neptune.rotation.y += 0.0008;
    };

    return group;
}
