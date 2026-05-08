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
    // Correct Position: 30.0 AU
    group.position.set(10000, 0, -1803600); 

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
