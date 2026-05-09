import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 572400; 
const orbitSpeed = 0.00015; 

export function createSaturn() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // --- 1. THE PLANET (High Detail) ---
    const saturn = new THREE.Mesh(
        new THREE.SphereGeometry(2500, 128, 128), // Increased segments for smoothness
        new THREE.MeshStandardMaterial({ // StandardMaterial reacts better to light
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_saturn.jpg'),
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide 
        })
    );
    group.add(saturn);
    
    // --- 2. THE RINGS (UV Corrected & High Quality) ---
    const innerRadius = 3000;
    const outerRadius = 5500;
    const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, 128); // 128 for perfect circle
    
    // UV FIX: This ensures the texture "stripes" wrap around the planet
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const distance = Math.sqrt(x * x + y * y);
        // Map texture: inner radius = 0 (left of image), outer = 1 (right of image)
        const u = (distance - innerRadius) / (outerRadius - innerRadius);
        uv.setXY(i, u, 0); 
    }

    const ringTexture = loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_saturn_ring_alpha.png');
    
    const ringMat = new THREE.MeshStandardMaterial({
        map: ringTexture,
        alphaMap: ringTexture, // Uses the texture's own data for transparency
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.4,
        metalness: 0,
        alphaTest: 0.02 // Allows for fine dust particles without "box" glitches
    });
    
    const rings = new THREE.Mesh(ringGeo, ringMat);
    rings.rotation.x = -Math.PI / 2; // Standard orientation
    group.add(rings);

    // --- 3. METADATA & ORBIT ---
    group.userData = { 
        name: "SATURN", 
        info: "Ringed giant. Lowest density of any planet.",
        r: outerRadius, // Use outer ring radius for collision/HUD
        type: "gas"
    };

    group.onUpdate = () => {
        orbitAngle += orbitSpeed;
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;
        saturn.rotation.y += 0.002;
    };

    return group;
}
