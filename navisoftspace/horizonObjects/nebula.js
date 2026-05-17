import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createNebula(scene, config) {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();
    
    // Lensflare0 is good, but for 4K textures, try 'lensflare0_bw' or a custom noise map
    const texture = loader.load('https://threejs.org/examples/textures/lensflare/lensflare0.png');

    for (let i = 0; i < config.count; i++) {
        // Variation in size makes it look more organic (Realism Layer)
        const individualSize = config.size * (0.5 + Math.random());
        
        const material = new THREE.SpriteMaterial({
            map: texture,
            color: config.colors[Math.floor(Math.random() * config.colors.length)],
            transparent: true,
            opacity: 0.1 + Math.random() * 0.2, // Random depths
            blending: THREE.AdditiveBlending 
        });

        const sprite = new THREE.Sprite(material);
        
        // Use a spherical distribution for a "Breathing" shell look
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        const radius = (Math.random() * config.spread) * 0.5;

        sprite.position.set(
            Math.sin(theta) * Math.cos(phi) * radius,
            Math.sin(theta) * Math.sin(phi) * radius,
            Math.cos(theta) * radius
        );

        sprite.scale.set(individualSize, individualSize, 1);
        
        // Add custom data for the "Breathing" animation loop
        sprite.userData = {
            baseOpacity: material.opacity,
            phase: Math.random() * Math.PI * 2, // Offset for the pulse
            speed: 0.001 + Math.random() * 0.002
        };

        group.add(sprite);
    }

    // --- WOW EFFECT: THE INTERNAL LIGHT ---
    // This makes the nebula "glow" from the center like a real nursery
    const coreLight = new THREE.PointLight(config.colors[0], 2, config.spread * 1.5);
    group.add(coreLight);

    group.position.set(config.x, config.y, config.z);
    
    group.userData = {
        type: 'nebula',
        r: config.spread * 0.8, // Larger sound horizon for "Wow" effect
        name: config.name,
        sound: config.sound || 'NEBULA_HUM',
        isBreathing: true // Flag for your engine.js loop
    };

    scene.add(group);
    return group;
}
