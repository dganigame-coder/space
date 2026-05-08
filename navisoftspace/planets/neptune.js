import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

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
    group.position.set(15000, -1000, -95000); // Deep, deep space
    group.userData = { 
        name: "NEPTUNE", 
        info: "The Windy Planet. Azure blue world. Furthest from the Sun.", 
        r: 1050 
    };

    group.onUpdate = () => {
        neptune.rotation.y += 0.0008;
    };

    return group;
}
