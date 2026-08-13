import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Creates a hyper-realistic, mobile-optimized refractive Wormhole
 */
export function createWormhole(scene, config = {}) {
    const group = new THREE.Group();

    // 🎯 Coords safety fallbacks
    const x = config.x || 0;
    const y = config.y || 0;
    const z = config.z || 0;

    // 1. THE CORE: Reduced geometry complexity (48x48) for smooth mobile FPS
    const wormholeGeo = new THREE.SphereGeometry(12000, 48, 48);
    const wormholeMat = new THREE.MeshPhysicalMaterial({
        transmission: 0.9,   // Glass-like transparency
        thickness: 35.0,     // Balanced refraction depth
        roughness: 0.05,     
        ior: 2.0,            // Diamond-like warp
        color: 0x00d4ff,     // Deep space cyan tint
        transparent: true,
        opacity: 0.8
    });

    const core = new THREE.Mesh(wormholeGeo, wormholeMat);
    core.name = "wormholeCore";
    group.add(core);

    // 2. THE GLOW: Additive aura
    const auraGeo = new THREE.SphereGeometry(12600, 32, 32);
    const auraMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    group.add(aura);

    // 🎯 3. GAME STATE & DIRECT MESH REFERENCES
    group.userData = {
        type: 'wormhole',
        r: 200000, 
        name: config.name || 'The Great Gate',
        sound: 'WORMHOLE_WARP',
        
        // Direct object references (Avoids getObjectByName in animation loop)
        coreMesh: core,
        auraMesh: aura,

        // Gameplay state tracking for your HUD & Collision engine
        isOpen: false,        // True when gate is wide enough to enter
        openProgress: 0.0     // 0.0 (Closed) to 1.0 (Fully Open)
    };

    group.position.set(x, y, z);
    scene.add(group);

    return group;
}

/**
 * Handles the pulsing instability, rotation, and gate state
 */
export function updateWormhole(wormhole, time) {
    if (!wormhole) return;

    const data = wormhole.userData;

    // Smooth Sine wave open/close cycle (~25 second period)
    const cycle = Math.sin(time * 0.0004); 
    const scaleFactor = Math.max(0.001, (cycle + 1) / 2); // Ranges 0.0 to 1.0

    // Scale entire group
    wormhole.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // 🎯 Update State for HUD & Autopilot checking
    data.openProgress = scaleFactor;
    data.isOpen = scaleFactor > 0.82; // Gate opens for traversal at >82% scale

    // Fast direct lookup (zero scene-tree traversal overhead)
    const core = data.coreMesh;
    if (core) {
        core.rotation.y += 0.005;
        core.rotation.z += 0.003;

        // Modulate core opacity during pulse cycle
        core.material.opacity = 0.2 + (scaleFactor * 0.8);
    }
}
