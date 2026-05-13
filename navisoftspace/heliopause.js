import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

export function createHeliopause(scene, config) {
    const { radius, color, opacity } = config;

    const geometry = new THREE.IcosahedronGeometry(radius, 4); // Low poly for mobile
    const material = new THREE.MeshBasicMaterial({
        color: color,
        wireframe: true,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; // Never hide the solar system boundary

    scene.add(mesh);
    return mesh;
}
