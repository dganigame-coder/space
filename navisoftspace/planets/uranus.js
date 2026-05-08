import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createUranus() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    const uranus = new THREE.Mesh(
        new THREE.SphereGeometry(1100, 64, 64), // Slightly smaller than Saturn
        new THREE.MeshPhongMaterial({
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_uranus.jpg'),
            shininess: 2
        })
    );
    
    // The "Bowling Ball" Tilt
    uranus.rotation.z = Math.PI / 2; 
    
    group.add(uranus);
    // Correct Position: 19.2 AU
    group.position.set(-50000, -2000, -1152000); 
    group.userData = { 
      name: "URANUS", 
      info: "The Sideways Planet. Ice giant with faint rings and cold methane clouds.", 
      r: 1100 
    };

    group.onUpdate = () => {
        uranus.rotation.x += 0.0005; // Rotating on its side!
    };

    return group;
}
