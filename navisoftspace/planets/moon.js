import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createMoon() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    const moon = new THREE.Mesh(
        new THREE.SphereGeometry(160, 64, 64),
        // Inside earth.js and moon.js
        new THREE.MeshPhongMaterial({
        color: 0xffffff, // Use white so the texture isn't "tinted" dark
        map: loader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg'),
        bumpMap: loader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg'),
        bumpScale: 12,   // Increased slightly to make craters "pop" in the sunlight
        shininess: 0,    // The moon is dusty/matte, it shouldn't be "shiny" like plastic
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
