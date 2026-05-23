import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSupernova(scene, config) {
    const group = new THREE.Group();
    
    // 1. Setup the geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.count * 3);
    const colors = new Float32Array(config.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < config.count; i++) {
        positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
        const c = new THREE.Color(config.colors[Math.floor(Math.random() * config.colors.length)]);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // 2. Setup the material (The "Glow" material)
    const material = new THREE.PointsMaterial({
        size: config.size,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    group.add(particles);

    // 3. Lifecycle controller
    group.userData = {
        type: 'supernova',
        isAnimating: true,
        age: 0,
        maxAge: 200, 
        config: config,
        onUpdate: function() {
            if (!this.isAnimating) return;
            
            this.age++;
            const progress = Math.min(this.age / this.maxAge, 1);
            
            // Explosion Logic
            const pos = particles.geometry.attributes.position.array;
            for (let i = 0; i < config.count; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                const dist = progress * config.spread * (0.5 + Math.random() * 0.5);
                
                pos[i * 3] = Math.sin(phi) * Math.cos(theta) * dist;
                pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * dist;
                pos[i * 3 + 2] = Math.cos(phi) * dist;
            }
            particles.geometry.attributes.position.needsUpdate = true;

            // Final state: Fade to remnant haze
            if (this.age >= this.maxAge) {
                this.isAnimating = false;
                particles.material.opacity = 0.2; // Static remnant haze
            }
        }
    };

    group.position.set(config.x, config.y, config.z);
    scene.add(group);
    return group;
}
