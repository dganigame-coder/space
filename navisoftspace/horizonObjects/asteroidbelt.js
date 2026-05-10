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
        const angle = Math.random() * Math.PI * 2;
        
        // --- THE "BEYOND PLUTO" RADIUS ---
        // Start at 600,000 and go out to 900,000
        const radius = 600000 + (Math.random() * 300000); 
        
        // Massive vertical scatter to create a "bubble" effect
        const y = (Math.random() - 0.5) * 100000; 
    
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
    
        dummy.position.set(x, y, z);
    
        // Make them HUGE so they are visible from the star
        // At 600k distance, small rocks disappear. We need "Mountain" size.
        const scale = 200 + Math.random() * 800; 
        dummy.scale.set(scale, scale, scale);
        
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    scene.add(mesh);
    return mesh;
}
