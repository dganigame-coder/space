import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSupernova(scene, config) {
    const group = new THREE.Group();
    group.position.set(config.x, config.y, config.z);

    // 1. CORE: High-density bloom sphere
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(config.size * 0.5, 32, 32), coreMat);
    group.add(coreMesh);

    // 2. SOFT GLOW TEXTURE: Generator for realistic particle plasma
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);

    // 3. FILAMENTS: High-performance 4K points
    const count = 5000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * config.size;
        positions[i * 3 + 1] = (Math.random() - 0.5) * config.size;
        positions[i * 3 + 2] = (Math.random() - 0.5) * config.size;
        colors[i * 3] = 1.0;     // Red
        colors[i * 3 + 1] = 0.5; // Green
        colors[i * 3 + 2] = 0.0; // Blue
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
            size: config.size * 0.15,
            map: texture,
            alphaMap: texture,
            vertexColors: true,
            transparent: true,
            premultipliedAlpha: true, // <--- This helps clean up edges
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

    const particles = new THREE.Points(geometry, material);
    group.add(particles);

    // 4. LIFECYCLE (State Machine & Identification)
    group.userData = {
        type: 'supernova',
        name: config.name,
        age: 0,
        onUpdate: function() {
            this.age += 0.005;
            const t = this.age;

            // Explosion expansion
            if (t < 5.0) {
                const scale = 1 + t * 5;
                particles.scale.setScalar(scale);
                material.opacity = Math.max(0, 1 - t / 5);
            }
            // Singularity spin
            else {
                particles.rotation.y += 0.01;
                particles.rotation.x += 0.005;
                material.opacity = 0.3;
            }
        }
    };

    scene.add(group);
    return group;
}
