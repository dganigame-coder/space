import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createJupiter() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // Jupiter doesn't have a bump map (it's gas!), but it has high detail
    const jupiter = new THREE.Mesh(
        new THREE.SphereGeometry(3000, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/jupiter.jpg'),
            shininess: 2
        })
    );
    group.add(jupiter);

    // Position Jupiter VERY far away
    group.position.set(20000, -5000, -40000);
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
