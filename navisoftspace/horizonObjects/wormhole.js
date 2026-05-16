import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Creates a hyper-realistic refractive Wormhole
 */
export function createWormhole(scene, config) {
    const group = new THREE.Group();

    // 1. THE CORE: Refractive sphere using Physical Material
    const wormholeGeo = new THREE.SphereGeometry(12000, 128, 128);
    const wormholeMat = new THREE.MeshPhysicalMaterial({
        transmission: 1.0,   // Glass-like transparency
        thickness: 50.0,     // Amount of light bending
        roughness: 0.05,     // Slight surface imperfections for realism
        ior: 2.4,            // High Index of Refraction (Diamond warp)
        color: 0x00d4ff,     // Deep space cyan tint
        transparent: true,
        opacity: 0.8
    });

    const core = new THREE.Mesh(wormholeGeo, wormholeMat);
    core.name = "wormholeCore";
    group.add(core);

    // 2. THE GLOW: Additive aura to make it visible in the dark
    const auraGeo = new THREE.SphereGeometry(12600, 64, 64);
    const auraMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    group.add(aura);
    
    group.userData = {
        type: 'wormhole',
        // Increase this to 100,000 or more so you hear it from a distance
        r: 200000, 
        name: 'The Great Gate',
        sound: 'WORMHOLE_WARP'
    };
    
    group.position.set(config.x, config.y, config.z);
    scene.add(group);
    
    return group;
}

/**
 * Handles the pulsing instability and rotation
 */
export function updateWormhole(wormhole, time) {
    if (!wormhole) return;

    // Use a Sine wave to create a pulsing "Open/Close" cycle
    // The wormhole opens and closes every 20 seconds
    const cycle = Math.sin(time * 0.0005); 
    const scaleFactor = Math.max(0.01, (cycle + 1) / 2); // Ranges from 0 to 1

    // Apply the pulse to the entire group
    wormhole.scale.set(scaleFactor, scaleFactor, scaleFactor);
    
    // Rotate the core to keep the refraction moving
    const core = wormhole.getObjectByName("wormholeCore");
    if (core) {
        core.rotation.y += 0.005;
        core.rotation.z += 0.003;
        
        // Make it flicker slightly when it's small (unstable)
        core.material.opacity = 0.3 + (scaleFactor * 0.7);
    }
}
