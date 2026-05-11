import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

export function createBelt(scene, config) {
    const { count, innerRadius, outerRadius, verticalScatter, color, size } = config;
    
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
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
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    scene.add(mesh);
    return mesh;
}
