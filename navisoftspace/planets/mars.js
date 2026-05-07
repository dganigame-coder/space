import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createMars() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    const mars = new THREE.Mesh(
        new THREE.SphereGeometry(400, 64, 64),
        new THREE.MeshPhongMaterial({
            map: loader.load('https://threejs.org/examples/textures/planets/mars_1k_color.jpg'),
            bumpMap: loader.load('https://threejs.org/examples/textures/planets/mars_1k_topo.jpg'),
            bumpScale: 8,
            shininess: 5
        })
    );
    group.add(mars);

    // Position Mars further out than the Moon
    group.position.set(-10000, 2000, -15000);
    group.userData = { 
        name: "MARS", 
        info: "The Red Planet. Iron oxide surface. 0.38G Gravity.",
        r: 400 
    };

    group.onUpdate = () => {
        mars.rotation.y += 0.0006;
    };

    return group;
}
