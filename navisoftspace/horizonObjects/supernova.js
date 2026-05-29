import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSupernova(scene, config) {
    const group = new THREE.Group();

    // 🎨 Canvas Texture Generator
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,100,0,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,0,0,0.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const dynamicTexture = new THREE.CanvasTexture(canvas);

    // 1. Central Star
    const coreGeo = new THREE.SphereGeometry(config.size * 0.5, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 1.0 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // 2. Gas Filaments
    const spritesArray = [];
    for (let i = 0; i < config.count; i++) {
        const material = new THREE.SpriteMaterial({
            map: dynamicTexture,
            color: config.colors[Math.floor(Math.random() * config.colors.length)],
            transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(material);
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        sprite.userData = {
            direction: new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)),
            baseSpread: config.spread
        };
        sprite.scale.set(config.size * 4, config.size * 4, 1);
        group.add(sprite);
        spritesArray.push(sprite);
    }

    group.position.set(config.x, config.y, config.z);
    group.userData = { age: Math.random() * 1800.0, state: 'MAIN_SEQUENCE' };

    // 3. 30-Minute Lifecycle Update
    group.onUpdate = () => {
        const CYCLE_DURATION = 1800.0; // 30 Minutes
        group.userData.age = (group.userData.age + 0.01) % CYCLE_DURATION;
        const age = group.userData.age;

        if (age < 1500.0) { // Stable Phase
            coreMesh.visible = true; coreMat.opacity = 1.0;
            spritesArray.forEach(s => s.material.opacity = 0);
        } else if (age >= 1500.0 && age < 1650.0) { // Explosion
            const p = (age - 1500.0) / 150.0;
            coreMesh.scale.setScalar(1.0 + (p * 5));
            coreMat.opacity = 1.0 - p;
            spritesArray.forEach(s => {
                s.material.opacity = p * 0.8;
                s.position.copy(s.userData.direction).multiplyScalar(s.userData.baseSpread * p);
            });
        } else { // Lingering Nebula
            group.userData.state = 'NEBULA_REMNANT';
            coreMesh.visible = false;
            spritesArray.forEach((s) => {
                s.position.setLength(s.userData.baseSpread + Math.sin(age * 0.1) * 2000);
                s.material.opacity = 0.25;
            });
        }
    };

    scene.add(group);
    return group;
}
