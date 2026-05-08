import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSaturn() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // The Planet
    const saturn = new THREE.Mesh(
        new THREE.SphereGeometry(2500, 64, 64),
        new THREE.MeshPhongMaterial({ map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_saturn.jpg') })
    );
    group.add(saturn);

    // The Rings
    const ringGeo = new THREE.RingGeometry(3000, 5000, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_saturn_ring_alpha.png'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    const rings = new THREE.Mesh(ringGeo, ringMat);
    rings.rotation.x = Math.PI / 2.5; // Tilt the rings
    group.add(rings);

    group.position.set(35000, 0, -55000);
    group.userData = { name: "SATURN", info: "Gas giant with spectacular rings. Would float in water.", r: 2500 };
    group.onUpdate = () => { saturn.rotation.y += 0.001; };
    return group;
}
