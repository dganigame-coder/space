import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createStars() {
    const vertices = [];
    // Create 15,000 stars
    for (let i = 0; i < 15000; i++) {
        // Place stars in a massive sphere far beyond Pluto
        // Random position between -5,000,000 and 5,000,000
        const x = THREE.MathUtils.randFloatSpread(10000000);
        const y = THREE.MathUtils.randFloatSpread(10000000);
        const z = THREE.MathUtils.randFloatSpread(10000000);
        vertices.push(x, y, z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1500, // Large size because they are very far away
        sizeAttenuation: true // Makes closer stars look bigger
    });

    const starField = new THREE.Points(geometry, material);
    
    // We don't need logic for this in onUpdate usually, 
    // it just sits there looking beautiful.
    starField.userData = { name: "STARFIELD" }; 

    return starField;
}
