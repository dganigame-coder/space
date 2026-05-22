import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createInterstellarAnomaly(scene, config) {
    const anomalyGroup = new THREE.Group();

    // 🎯 1. Build the cigar shape ('Oumuamua is roughly 10x longer than it is wide)
    // We stretch a sphere heavily along the Z axis to create that iconic rocky needle shape
    const rockGeo = new THREE.SphereGeometry(150, 32, 32);
    rockGeo.scale(1.0, 1.2, 10.0); // 🚀 Crucial: Stretches the geometry into a 3000-unit long cigar!

    // Dark, metallic, highly textured rocky material
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x3d3535,         // Dark reddish-brown interstellar rock
        roughness: 0.9,
        metalness: 0.4
    });

    const oumuamuaMesh = new THREE.Mesh(rockGeo, rockMat);
    oumuamuaMesh.name = "oumuamuaMesh";
    
    // 🎯 2. IDENTITY LAYER: Stamping it for your target loop HUD scanner
    const targetName = config.name || "'Oumuamua / Interstellar Wanderer";
    
    anomalyGroup.name = targetName;
    anomalyGroup.userData = {
        type: 'interstellar_anomaly',
        name: targetName,
        state: 'solid',          // 🪨 It's solid interstellar crust
        composition: 'Carbon-rich rock and metals'
    };

    // Keep child mesh properties synced
    oumuamuaMesh.userData = anomalyGroup.userData;
    anomalyGroup.add(oumuamuaMesh);

    // Global position settings
    anomalyGroup.position.set(config.x, config.y, config.z);
    
    scene.add(anomalyGroup);
    return anomalyGroup;
}
