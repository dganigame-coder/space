import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createVenus() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();
    const venus = new THREE.Mesh(
        new THREE.SphereGeometry(380, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/textures/venus.jpg'),
        })
    );
    group.add(venus);
    group.position.set(-4000, 500, -20000); 
    group.userData = { name: "VENUS", info: "Hottest planet. Greenhouse effect. Rotates backwards.", r: 380 };
    group.onUpdate = () => { venus.rotation.y -= 0.0002; };
    return group;
}
