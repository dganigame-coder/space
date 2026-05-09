import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 572400; 
const orbitSpeed = 0.00015; 

export function createSaturn() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // --- 1. THE PLANET ---
    const saturn = new THREE.Mesh(
        new THREE.SphereGeometry(2500, 128, 128),
        new THREE.MeshStandardMaterial({ 
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_saturn.jpg'),
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.DoubleSide 
        })
    );
    group.add(saturn);
    
    // --- 2. THE RINGS ---
    const innerRadius = 3000;
    const outerRadius = 5500;
    const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, 128); 
    
    // UV FIX: Manual calculation to wrap texture radially
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const distance = Math.sqrt(x * x + y * y);
        // Map distance to U (0 to 1)
        const u = (distance - innerRadius) / (outerRadius - innerRadius);
        uv.setXY(i, u, 0); 
    }
    // CRITICAL FIX: Tell Three.js to send new UV data to the GPU
    uv.needsUpdate = true;

    const ringTexture = loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_saturn_ring_alpha.png');
    
    const ringMat = new THREE.MeshStandardMaterial({
        map: ringTexture,
        alphaMap: ringTexture,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: 0,
        // alphaTest: 0 is safer if your rings are vanishing
        alphaTest: 0.01 
    });
    
    const rings = new THREE.Mesh(ringGeo, ringMat);
    rings.rotation.x = -Math.PI / 2; 
    group.add(rings);

    // --- 3. METADATA & ORBIT ---
    group.userData = { 
        name: "SATURN", 
        info: "Ringed giant. Lowest density of any planet.",
        r: outerRadius, 
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
