import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createMoon() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    const moon = new THREE.Mesh(
        new THREE.SphereGeometry(160, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg'),
            bumpMap: loader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg'),
            bumpScale: 5
        })
    );
    group.add(moon);

    // The Moon is near Earth
    group.position.set(1500, 800, -5000);
    group.userData = { name: "THE MOON", info: "Lunar surface. 0.16G Gravity. No atmosphere detected." };

    group.onUpdate = () => {
        moon.rotation.y += 0.0002;
    };

    return group;
}
