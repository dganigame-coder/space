import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

export function createBlackHole(scene, config) {
    const group = new THREE.Group();
    const textureLoader = new THREE.TextureLoader();

    // LOAD ASSETS
    // Using a noise/lava texture is essential for the "swirl" look
    const diskTexture = textureLoader.load('https://threejs.org/examples/textures/lava/lavatile.jpg');
    diskTexture.wrapS = diskTexture.wrapT = THREE.RepeatWrapping;

    // 1. THE SINGULARITY
    const coreGeo = new THREE.SphereGeometry(config.size, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // 2. THE EVENT HORIZON EDGE (The bright white/yellow "Tear")
    const edgeGeo = new THREE.SphereGeometry(config.size * 1.01, 64, 64);
    const edgeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(edgeGeo, edgeMat));

    // 3. THE ACCRETION DISK LAYERS (Creating volume)
    // We create multiple disks with slightly different rotations and speeds
    const createDiskLayer = (inner, outer, opacity, name, tiltX = Math.PI / 2) => {
        const geo = new THREE.RingGeometry(config.size * inner, config.size * outer, 128);
        const mat = new THREE.MeshBasicMaterial({
            map: diskTexture,
            color: 0xffaa00,
            transparent: true,
            opacity: opacity,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = tiltX;
        mesh.name = name;
        return mesh;
    };

    // Layer 1: The Main Flat Disk
    group.add(createDiskLayer(1.2, 10, 0.6, "mainDisk"));
    
    // Layer 2: The Gravitational Lensing (The "Wrap Around" Halo)
    // This creates the top/bottom curve seen in image_799fd0.jpg
    const halo = createDiskLayer(1.2, 9, 0.4, "halo", 0); 
    halo.rotation.y = 0.1; // Slight tilt
    group.add(halo);

    // 4. VOLUMETRIC GLOW (The "Atmosphere")
    for (let i = 1; i <= 5; i++) {
        const glowGeo = new THREE.RingGeometry(config.size * 1.1, config.size * (10 + i * 2), 128);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.2 / i,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const glowRing = new THREE.Mesh(glowGeo, glowMat);
        glowRing.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.1;
        glowRing.name = `glowLayer${i}`;
        group.add(glowRing);
    }

    // 5. LIGHTING THE SCENE
    const light = new THREE.PointLight(0xffaa00, 10, config.size * 100);
    group.add(light);

    group.position.set(config.position.x, config.position.y, config.position.z);
    scene.add(group);

    return group;
}
