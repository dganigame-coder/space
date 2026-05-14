import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createVoyager(scene, config) {
    const { position, color } = config;
    const group = new THREE.Group();

    // 1:1 Scale Body (approx 4 meters)
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 2, 8),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.1 })
    );
    group.add(body);

    // The High-Gain Antenna (Dish)
    const dish = new THREE.Mesh(
        new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xeeeeee, side: THREE.DoubleSide })
    );
    dish.rotation.x = Math.PI / 2;
    dish.position.y = 1.2;
    group.add(dish);

    // The "Glint" - Essential for finding a small object in the dark
    const glint = new THREE.PointLight(color, 2, 500); 
    group.add(glint);

    group.position.set(position.x, position.y, position.z);
    
    // Critical for massive distances: prevents the probe from disappearing
    group.traverse((obj) => { if(obj.isMesh) obj.frustumCulled = false; });

    scene.add(group);
    return group;
}
