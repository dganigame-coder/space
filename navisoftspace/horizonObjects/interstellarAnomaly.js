import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createInterstellarAnomaly(scene, config) {
    const anomalyGroup = new THREE.Group();

    // 🎯 1. Build the cigar shape
    const rockGeo = new THREE.SphereGeometry(150, 32, 32);
    
    // Using MeshBasicMaterial so it renders even if your scene lighting is dark
    const rockMat = new THREE.MeshBasicMaterial({
        color: 0x3d3535
    });

    const oumuamuaMesh = new THREE.Mesh(rockGeo, rockMat);
    oumuamuaMesh.name = "oumuamuaMesh";
    
    // 🚀 Scale the mesh directly (safer than scaling geometry)
    oumuamuaMesh.scale.set(1.0, 1.2, 10.0);
    
    // 🎯 2. IDENTITY LAYER
    const targetName = config.name || "'Oumuamua / Interstellar Wanderer";
    
    anomalyGroup.name = targetName;
    anomalyGroup.userData = {
        type: 'solid',
        name: targetName,
        state: 'solid',
        innerRadius: config.innerRadius || 0,
        outerRadius: config.outerRadius || 5000 
    };

    // Keep child mesh properties synced
    oumuamuaMesh.userData = anomalyGroup.userData;
    anomalyGroup.add(oumuamuaMesh);

    // Global position settings
    anomalyGroup.position.set(config.x, config.y, config.z);
    
    scene.add(anomalyGroup);
    return anomalyGroup;
}
