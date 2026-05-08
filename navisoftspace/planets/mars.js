import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createMars() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // 1. Create the Shape
    const geometry = new THREE.SphereGeometry(400, 64, 64);

    // 2. Create the Material (The Skin)
    // NOTE: Use 'raw.githubusercontent.com' and remove '/tree/master/' 
    const marsMaterial = new THREE.MeshStandardMaterial({
        map: loader.load('https://raw.githubusercontent.com/dganigame-coder/space/master/navisoftspace/planets/texture/2k_mars.jpg'),
        bumpMap: loader.load('https://raw.githubusercontent.com/dganigame-coder/space/master/navisoftspace/planets/texture/8k_mars.jpg'),
        bumpScale: 0.35,
        roughness: 1,
        metalness: 0
    });

    // 3. Create the Mesh (The actual planet object)
    const marsMesh = new THREE.Mesh(geometry, marsMaterial);
    group.add(marsMesh);

    // Position Mars
    group.position.set(-10000, 2000, -15000);
    group.userData = { 
        name: "MARS", 
        info: "The Red Planet. Iron oxide surface. 0.38G Gravity.",
        r: 400 
    };

    // 4. Update the rotation on the MESH
    group.onUpdate = () => {
        marsMesh.rotation.y += 0.0006;
    };

    return group;
}
