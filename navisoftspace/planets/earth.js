import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Orbit State (Persistent variables)
let orbitAngle = Math.random() * Math.PI * 2; // Random start position in circle
const orbitDistance = 60000; // 1.0 AU
const orbitSpeed = 0.0005;    // Adjust this to your liking (0.0005 is a slow, smooth orbit)

export function createEarth() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // Surface Layer
    const surface = new THREE.Mesh(
        new THREE.SphereGeometry(600, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
            specularMap: loader.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
            shininess: 15
        })
    );
    group.add(surface);

    // Animated Cloud Layer
    const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(608, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png'),
            transparent: true,
            opacity: 0.4
        })
    );
    group.add(clouds);

    group.userData = { 
        name: "EARTH", 
        info: "The Blue Marble. Only known planet with life. 1G Gravity.",
        r: 600, // Updated radius to match your Geometry
        type:"solid"
    };

    // 2. The Orbit Logic
    group.onUpdate = () => {
        // Increment Angle
        orbitAngle += orbitSpeed;

        // Apply Circular Math
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;

        // Self Rotation (Spinning on axis)
        surface.rotation.y += 0.005;
        clouds.rotation.y += 0.007; 
    };

    return group;
}
