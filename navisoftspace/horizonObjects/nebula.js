import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createNebula(scene, config) {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const texture = loader.load('https://threejs.org/examples/textures/lensflare/lensflare0.png');

    // --- 1. DISTANT GLOW (Move OUTSIDE the loop) ---
    // This is the "beacon" you see from the Kuiper Belt.
    const glowMaterial = new THREE.SpriteMaterial({
        map: texture,
        color: config.colors[0],
        transparent: true,
        opacity: 0.4, // Keep it soft
        blending: THREE.AdditiveBlending
    });
    
    const distantGlow = new THREE.Sprite(glowMaterial);
    // Make it massive enough to be seen from millions of units away
    distantGlow.scale.set(config.spread * 3, config.spread * 3, 1);
    group.add(distantGlow);

    // --- 2. DETAILED CLOUD PUFFS ---
    for (let i = 0; i < config.count; i++) {
        const individualSize = config.size * (0.5 + Math.random());
        
        const material = new THREE.SpriteMaterial({
            map: texture,
            color: config.colors[Math.floor(Math.random() * config.colors.length)],
            transparent: true,
            opacity: 0.1 + Math.random() * 0.2,
            blending: THREE.AdditiveBlending 
        });

        const sprite = new THREE.Sprite(material);
        
        // Spherical distribution
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        const radius = (Math.random() * config.spread) * 0.5;

        sprite.position.set(
            Math.sin(theta) * Math.cos(phi) * radius,
            Math.sin(theta) * Math.sin(phi) * radius,
            Math.cos(theta) * radius
        );

        sprite.scale.set(individualSize, individualSize, 1);
        // Add this line right below where you set sprite.scale.set(...)
        sprite.scale.set(individualSize, individualSize, 1);
        
        // 🌪️ ADD THIS: Rotates each smoke puff randomly so they blend like chaotic clouds instead of a pattern
        sprite.material.rotation = Math.random() * Math.PI * 2;
        
        sprite.userData = {
            baseOpacity: material.opacity,
            phase: Math.random() * Math.PI * 2,
            speed: 0.001 + Math.random() * 0.002
        };

        group.add(sprite);
    }

    // --- 3. INTERNAL LIGHT ---
    const coreLight = new THREE.PointLight(config.colors[0], 2, config.spread * 2);
    group.add(coreLight);

    group.position.set(config.x, config.y, config.z);
    
    group.userData = {
        type: 'nebula',
        r: config.spread * 1.5, // Large radius so you hear it before you hit it
        name: config.name,
        sound: config.sound || 'NEBULA_HUM',
        isBreathing: true 
    };

    // At the very bottom of createNebula AND createSupernova, before "return group"
    console.log(`🚀 [System] ${config.name} initialized at:`, group.position);
    console.log(`✨ [Details] Sprites: ${config.count}, Type: ${group.userData.type}`);
    
    scene.add(group);
    return group;
}
