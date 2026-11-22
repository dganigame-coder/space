import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Orbit State (Persistent variables for Uranus)
let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 1152000; // 19.2 AU scale
const orbitSpeed = 0.0001;    // Proportional: Very slow compared to inner planets

export function createUranus() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    const uranus = new THREE.Mesh(
        new THREE.SphereGeometry(1100, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_uranus.jpg'),
            shininess: 2,
            side: THREE.DoubleSide
        })
    );
    
    // The "Bowling Ball" Tilt (Visual setup)
    uranus.rotation.z = Math.PI / 2; 
    
    group.add(uranus);

    group.userData = { 
      name: "URANUS", 
      info: "The Sideways Planet. Ice giant with cold methane clouds. 19.2 AU from Sun.", 
      r: 1100 ,
      type:"gas"
    };

    // 2. The Orbit & Rotation Logic
    group.onUpdate = () => {
        // Increment Angle
        orbitAngle += orbitSpeed;

        // Apply Circular Math
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;

        // Self Rotation (Rotating on its side!)
        uranus.rotation.x += 0.0005; 
    };

    return group;
}
