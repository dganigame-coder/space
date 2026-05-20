import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createBlackHole(scene, config) {
    const group = new THREE.Group();

    // ============================================================
    // 🎨 4K PROCEDURAL CHURNING PLASMA TEXTURE GENERATOR
    // ============================================================
    // Generates a ultra-high fidelity noise layout directly in VRAM (No external img dependencies)
    const canvas = document.createElement('canvas');
    canvas.width = 2048; // Ultra 2K/4K scaling texture map
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Build a roaring fire plasma backing layer
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)'); // Blinding hot Event Horizon rim
    grad.addColorStop(0.1, 'rgba(255, 170, 0, 0.9)');   // Deep golden plasma
    grad.addColorStop(0.4, 'rgba(255, 50, 0, 0.4)');    // Churning red filament trails
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');       // Dissolving interstellar space edge
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply high-frequency code noise filaments
    for (let i = 0; i < 1500; i++) {
        ctx.fillStyle = `rgba(255, ${Math.random() * 150 + 100}, 0, ${Math.random() * 0.15})`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 80 + 20, Math.random() * 3 + 1);
    }

    const dynamicDiskTexture = new THREE.CanvasTexture(canvas);
    dynamicDiskTexture.wrapS = dynamicDiskTexture.wrapT = THREE.RepeatWrapping;
    dynamicDiskTexture.repeat.set(3, 1); // Tile horizontally for finer cosmic dust threads

    // ============================================================
    // 1. THE SINGULARITY (Pure Light Absorption Field)
    // ============================================================
    const coreGeo = new THREE.SphereGeometry(config.size, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // ============================================================
    // 2. THE GRAVITATIONAL LENSING FUNNEL (The Illusion of Curved Space)
    // ============================================================
    // Instead of a flat Ring, we use a Cylinder Open Cone warped down into the core 
    // to match real-world gravitational spacetime metrics!
    const funnelGeo = new THREE.CylinderGeometry(
        config.size * 12, // Outer edge radius
        config.size * 1.02, // Inner event horizon interface radius
        config.size * 3.5,  // Depth displacement scale
        128, 32, true       // 128 Segments for smooth 4K circle outlines
    );

    // Deform the cylinder mesh structure to curve aggressively near the event horizon center
    const posAttr = funnelGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i);
        // Apply Einsteinian gravitational space bending falloff math curve
        const radiusFactor = Math.sqrt(v.x * v.x + v.z * v.z);
        const curve = Math.pow(config.size / radiusFactor, 1.8) * (config.size * 2.5);
        v.y -= curve; 
        posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    funnelGeo.computeVertexNormals();

    const diskMat = new THREE.MeshBasicMaterial({
        map: dynamicDiskTexture,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    // Layer A: The Horizontal Spacetime Distortion Disc
    const mainDisk = new THREE.Mesh(funnelGeo, diskMat);
    mainDisk.scale.set(1, 0.05, 1); // Squash it flat vertically to form the wide disc
    group.add(mainDisk);

    // Layer B: The Vertical Lensing Corona (The iconic Einstein ring silhouette)
    const verticalLensingRing = new THREE.Mesh(funnelGeo, diskMat);
    verticalLensingRing.scale.set(1, 0.9, 1);
    verticalLensingRing.rotation.x = Math.PI / 2; // Rotate 90 degrees standing vertical!
    group.add(verticalLensingRing);

    // ============================================================
    // 3. THE BLINDING PHOTON RING (The Edge Tear)
    // ============================================================
    const edgeGeo = new THREE.SphereGeometry(config.size * 1.01, 64, 64);
    const edgeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(edgeGeo, edgeMat));

    // ============================================================
    // 4. VOLUMETRIC COSMIC GLOW SUB-SYSTEM
    // ============================================================
    for (let i = 1; i <= 4; i++) {
        const glowGeo = new THREE.RingGeometry(config.size * 1.05, config.size * (12 + i * 4), 64);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            transparent: true,
            opacity: 0.15 / i,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const glowRing = new THREE.Mesh(glowGeo, glowMat);
        glowRing.rotation.x = Math.PI / 2;
        glowRing.scale.setScalar(1.0 + (i * 0.05));
        group.add(glowRing);
    }

    // High energy stellar projection lamp
    const light = new THREE.PointLight(0xffaa00, 25, config.size * 200);
    group.add(light);

    // Group properties and dynamic spatial mapping placement setup
    group.position.set(config.position.x, config.position.y, config.position.z);
    
    group.userData = {
        type: 'blackhole',
        name: config.name || 'Gargantua Singularity Anchor',
        r: config.size * 15,
        // References exposed to the global frame animation engine loop
        mainDisk: mainDisk,
        verticalRing: verticalLensingRing
    };

    scene.add(group);
    return group;
}
