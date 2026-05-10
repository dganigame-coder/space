import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

export function createAsteroidBelt(scene) {
    const count = 3000; // Number of asteroids
    
    // We use a low-poly geometry to keep it fast
    const geometry = new THREE.DodecahedronGeometry(1, 0); 
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x666666, 
        roughness: 0.9,
        metalness: 0.1 
    });

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        // Create a ring between Mars (approx 15k) and Jupiter (approx 35k)
        const angle = Math.random() * Math.PI * 2;
        const radius = 20000 + (Math.random() * 10000); 
        
        const x = Math.cos(angle) * radius;
        const y = (Math.random() - 0.5) * 800; // Vertical spread
        const z = Math.sin(angle) * radius;

        dummy.position.set(x, y, z);

        // Random rotation and scale (size of rocks)
        const scale = 5 + Math.random() * 45;
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    scene.add(mesh);
    return mesh;
}
