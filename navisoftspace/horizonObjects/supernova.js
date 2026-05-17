import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSupernova(scene, config) {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const texture = loader.load('https://threejs.org/examples/textures/lensflare/lensflare0.png');

    // 1. THE CORE SHOCKWAVE (Hollow Shell Math)
    for (let i = 0; i < config.count; i++) {
        const material = new THREE.SpriteMaterial({
            map: texture,
            color: config.colors[Math.floor(Math.random() * config.colors.length)],
            transparent: true,
            opacity: 0.1, // Lower opacity + more sprites = high quality filaments
            blending: THREE.AdditiveBlending 
        });

        const sprite = new THREE.Sprite(material);
        
        // Push particles to the surface of a sphere (Shockwave effect)
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        // The "Radius" is fixed to the edge to make it look like a bubble
        const radius = config.spread * (0.8 + Math.random() * 0.2); 

        sprite.position.set(
            Math.sin(theta) * Math.cos(phi) * radius,
            Math.sin(theta) * Math.sin(phi) * radius,
            Math.cos(theta) * radius
        );

        sprite.scale.set(config.size * 2, config.size * 2, 1);
        
        sprite.userData = {
            baseOpacity: material.opacity,
            phase: Math.random() * Math.PI * 2,
            speed: 0.005 + Math.random() * 0.01 // Faster "breath" for energy
        };

        group.add(sprite);
    }

    // 2. THE DISTANT BEACON (Visible from Kuiper Belt)
    const coreLight = new THREE.PointLight(0xffffff, 20, config.spread * 10);
    group.add(coreLight);

    group.position.set(config.x, config.y, config.z);
    group.userData = { 
        type: 'supernova', 
        isBreathing: true,
        name: config.name 
    };

    scene.add(group);
    return group;
}
