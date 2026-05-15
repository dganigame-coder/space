import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createBelt(scene, config) {
    const { count, innerRadius, outerRadius, verticalScatter, color, size } = config;
    
    // Low-poly geometry is best for performance on mobile
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    
    // MeshBasicMaterial ensures visibility even when miles away from the Sun
    const material = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.9 // Slight transparency helps with the "icy" feel
    });
    
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    
    // 1. Disable Frustum Culling
    // This prevents the engine from "deleting" the belt when you aren't looking at (0,0,0)
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

        // 2. Randomized Scale
        const s = size.min + Math.random() * (size.max - size.min);
        dummy.scale.set(s, s, s);

        // 3. full 3D Rotation
        // Adding Math.random() to all axes so the rocks look organic
        dummy.rotation.set(
            Math.random() * Math.PI, 
            Math.random() * Math.PI, 
            Math.random() * Math.PI
        );
        
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    
    // 4. Force Bounding Sphere Calculation
    // We tell Three.js exactly how large this object is so it stays in the render buffer
    mesh.computeBoundingSphere();
    
    // 5. Static Matrix Optimization
    // Since the belt doesn't move, we save GPU power by disabling auto-updates
    mesh.instanceMatrix.needsUpdate = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.userData = {
        type: config.type || 'asteroid_belt', // Uses config type or defaults
        innerRadius: config.innerRadius,
        outerRadius: config.outerRadius,
        name: config.name || 'Asteroid Field'
    };
    scene.add(mesh);
    return mesh;
}
