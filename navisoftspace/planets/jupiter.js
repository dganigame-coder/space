import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createJupiter() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // Jupiter doesn't have a bump map (it's gas!), but it has high detail
   const jupiter = new THREE.Mesh(
     new THREE.SphereGeometry(3000, 128, 128),
     new THREE.MeshStandardMaterial({
         map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/8k_jupiter.jpg'),
        roughness: 1.0,
       metalness: 0.0
     })
    );
    group.add(jupiter);

    // Position Jupiter VERY far away
    // Jupiter is much further out!
    group.position.set(-15000, -1000, -312000);
    group.userData = { 
        name: "JUPITER", 
        info: "Gas Giant. Great Red Spot detected. 2.5G Gravity.",
        r: 3000 
    };

    group.onUpdate = () => {
        jupiter.rotation.y += 0.001; // Jupiter rotates very fast in reality!
    };

    return group;
}
