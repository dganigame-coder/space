import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createInterstellarAnomaly(scene, config) {
    const anomalyGroup = new THREE.Group();

    // 🎯 1. Build the cigar shape
    const rockGeo = new THREE.SphereGeometry(150, 32, 32);
    const rockMat = new THREE.MeshBasicMaterial({ color: 0x3d3535 });
    const oumuamuaMesh = new THREE.Mesh(rockGeo, rockMat);
    oumuamuaMesh.name = "oumuamuaMesh";
    oumuamuaMesh.scale.set(1.0, 1.2, 10.0);
    
    anomalyGroup.add(oumuamuaMesh);

    // 🎯 2. ADD A BEACON (Crucial for deep space visibility)
    // This creates a small persistent dot so you can spot the anomaly at long distances
    const beaconGeo = new THREE.SphereGeometry(500, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    anomalyGroup.add(beacon);

    // 🎯 3. IDENTITY LAYER
    const targetName = config.name || "'Oumuamua / Interstellar Wanderer";
    anomalyGroup.name = targetName;
    anomalyGroup.userData = {
        type: 'solid',
        name: targetName,
        innerRadius: config.innerRadius || 0,
        outerRadius: config.outerRadius || 50000 // Increased range for scanner detection
    };

    anomalyGroup.position.set(config.x, config.y, config.z);
    
    scene.add(anomalyGroup);
    return anomalyGroup;
}
