import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

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
    // Inside createVenus()
    group.position.set(8000, 200, -43200); // 0.72 AU
    group.userData = { 
     name: "VENUS", 
     info: "Thick CO2 atmosphere. 460°C surface temps.",
     r: 450 
    };
    group.onUpdate = () => { venus.rotation.y -= 0.0002; };
    return group;
}
