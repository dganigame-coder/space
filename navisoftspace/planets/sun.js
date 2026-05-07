import * as THREE from 'three';

export function createSun() {
    const group = new THREE.Group();

    // The core - using a bright emissive material to simulate plasma
    const geom = new THREE.SphereGeometry(4000, 64, 64);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffaa00,
        emissiveIntensity: 2
    });
    const sun = new THREE.Mesh(geom, mat);
    group.add(sun);

    // Solar Flare Glow (the "Aura")
    const spriteMat = new THREE.SpriteMaterial({
        map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/lensflare/lensflare0.png'),
        color: 0xffaa00,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(15000, 15000, 1);
    group.add(sprite);

    group.position.set(0, 0, -60000);
    group.userData = { name: "THE SUN", info: "Class G2V Star. Surface temp: 5,778 K. Do not approach." };

    group.onUpdate = () => {
        sun.rotation.y += 0.001; // Sun rotates slowly
    };

    return group;
}
