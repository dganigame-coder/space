import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createMars() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    const mars = new THREE.MeshStandardMaterial({
    map: loader.load('https://www.solarsystemscope.com/textures/download/2k_mars.jpg'),
    bumpMap: loader.load('https://www.solarsystemscope.com/textures/download/8k_mars.jpg'),
    bumpScale: 0.35,
    roughness: 1,
    metalness: 0
    });
    group.add(mars);

    // Position Mars further out than the Moon
    group.position.set(-10000, 2000, -15000);
    group.userData = { 
        name: "MARS", 
        info: "The Red Planet. Iron oxide surface. 0.38G Gravity.",
        r: 400 
    };

    group.onUpdate = () => {
        mars.rotation.y += 0.0006;
    };

    return group;
}
