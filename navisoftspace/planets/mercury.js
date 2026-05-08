import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createMercury() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();
    const mercury = new THREE.Mesh(
        new THREE.SphereGeometry(150, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_mercury.jpg'),
            bumpMap: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/8k_mercury.jpg'),
            bumpScale: 2
        })
    );
    group.add(mercury);
    group.position.set(-2000, 0, -10000); // Between Sun and Earth
    group.userData = { name: "MERCURY", info: "Closest to the Sun. No atmosphere. Extreme temps.", r: 150 };
    group.onUpdate = () => { mercury.rotation.y += 0.0004; };
    return group;
}
