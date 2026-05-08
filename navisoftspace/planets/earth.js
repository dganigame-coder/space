import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

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
    // Inside createEarth()
    group.position.set(0, 0, -60000); // 1.0 AU
    group.userData = { 
     name: "EARTH", 
     info: "The Blue Marble. Only known planet with life. 1G Gravity.",
     r: 500 
   };
    group.onUpdate = () => {
        surface.rotation.y += 0.0005;
        clouds.rotation.y += 0.0007; // Clouds move slightly faster for realism
    };

    return group;
}
