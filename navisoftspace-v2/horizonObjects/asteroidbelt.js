import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createBelt(scene, config) {
    const { count, innerRadius, outerRadius, verticalScatter, color, size, x = 0, y = 0, z = 0 } = config; // 🎯 1. Extract x, y, z with defaults to 0
    
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    
    const material = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.9 
    });
    
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    
    // 🎯 2. Set the position of the InstancedMesh container in space
    mesh.position.set(x, y, z);

    mesh.frustumCulled = false; 

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
        
        dummy.position.set(
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * verticalScatter,
            Math.sin(angle) * radius
        );

        const s = size.min + Math.random() * (size.max - size.min);
        dummy.scale.set(s, s, s);

        dummy.rotation.set(
            Math.random() * Math.PI, 
            Math.random() * Math.PI, 
            Math.random() * Math.PI
        );
        
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    
    mesh.computeBoundingSphere();
    
    mesh.instanceMatrix.needsUpdate = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix(); // 🎯 3. Make sure matrix updates after setting position
    
    mesh.userData = {
        type: config.type || 'asteroid_belt',
        innerRadius: config.innerRadius,
        outerRadius: config.outerRadius,
        name: config.name || 'Asteroid Field'
    };
    
    scene.add(mesh);
    return mesh;
}
