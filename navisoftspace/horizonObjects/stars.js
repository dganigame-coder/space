import * as THREE from 'three';

export function createStars() {
    const vertices = [];
    
    // 50,000 stars provides a gorgeous, dense sky without lagging the browser
    for (let i = 0; i < 50000; i++) {
        // A 4-million-unit bubble. Large enough for perfect parallax depth, 
        // but small enough to avoid floating-point math glitches.
        const x = THREE.MathUtils.randFloatSpread(4000000);
        const y = THREE.MathUtils.randFloatSpread(4000000);
        const z = THREE.MathUtils.randFloatSpread(4000000);
        vertices.push(x, y, z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1500, 
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8 // Softens the light for realism
    });

    const starField = new THREE.Points(geometry, material);
    
    // CRITICAL: Prevents the engine from making the sky blink out of existence
    starField.frustumCulled = false;
    
    starField.userData = { name: "STARFIELD" }; 

    return starField;
}
