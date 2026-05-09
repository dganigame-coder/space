import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Lunar Orbit State
let moonAngle = Math.random() * Math.PI * 2; 
const moonDistance = 4000; // Distance from EARTH, not the Sun
const moonSpeed = 0.005;    // How fast it circles Earth

export function createMoon(earth) {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    const moon = new THREE.Mesh(
        new THREE.SphereGeometry(160, 64, 64),
        new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: loader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg'),
            bumpMap: loader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg'),
            bumpScale: 12,
            shininess: 0,
        })
    );
    group.add(moon);

    group.userData = { 
        name: "THE MOON", 
        info: "Lunar surface. 0.16G Gravity. Tidally locked to Earth.",
        r: 160,
        type:"solid"
    };

    // 2. The Lunar Orbit Logic
    group.onUpdate = () => {
        if (!earth) return;

        // Move the moon's angle around Earth
        moonAngle += moonSpeed;

        // Calculate position relative to Earth
        // We take Earth's X/Z and add the Moon's offset
        group.position.x = earth.position.x + Math.cos(moonAngle) * moonDistance;
        group.position.z = earth.position.z + Math.sin(moonAngle) * moonDistance;
        group.position.y = earth.position.y + 200; // Slight vertical offset

        // Rotation
        moon.rotation.y += 0.001;
    };

    return group;
}
