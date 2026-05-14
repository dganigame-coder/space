import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

export function createBlackHole(scene, config) {
    const group = new THREE.Group();

    // 1. THE SINGULARITY (The pitch black center)
    const coreGeo = new THREE.SphereGeometry(config.size, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // 2. THE ACCRETION DISK (The glowing ring of trapped light)
    const diskGeo = new THREE.TorusGeometry(config.size * 2.5, config.size * 0.4, 2, 100);
    const diskMat = new THREE.MeshBasicMaterial({ 
        color: 0xff6600, 
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending 
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = Math.PI / 2.2; // Tilt it slightly
    group.add(disk);

    // 3. THE EVENT HORIZON GLOW
    const glowGeo = new THREE.SphereGeometry(config.size * 1.1, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide // Glow from inside out
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    group.position.set(config.position.x, config.position.y, config.position.z);
    scene.add(group);

    return { group, disk };
}
