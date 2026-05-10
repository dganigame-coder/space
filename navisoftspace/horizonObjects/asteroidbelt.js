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

    // Inside createAsteroidBelt()
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        
        // --- THE "PLUTO EXTERIOR" MATH ---
        // Start at 3,000,000 (gives Pluto about 600k units of breathing room)
        // Extend the belt out to 4,500,000 for a thick, vast border
        const radius = 3000000 + (Math.random() * 1500000); 
        
        // Massive vertical scatter (3D cloud effect)
        const y = (Math.random() - 0.5) * 500000; 
    
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
    
        dummy.position.set(x, y, z);
    
        // Make the asteroids "Continent Sized"
        // At 3 million units away, small rocks are invisible pixels.
        const scale = 1000 + Math.random() * 3000; 
        dummy.scale.set(scale, scale, scale);
        
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    scene.add(mesh);
    return mesh;
}
