import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

export function createBlackHole(scene, config) {
    const group = new THREE.Group();

    // 1. THE SINGULARITY (Absolute Darkness)
    const coreGeo = new THREE.SphereGeometry(config.size, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // 2. THE MAIN ACCRETION DISK (The "Saturn" approach)
    // We use RingGeometry for a flatter, more granular look
    const diskGeo = new THREE.RingGeometry(config.size * 1.4, config.size * 5, 128);

    // Inside createBlackHole.js - replace the disk material
    const textureLoader = new THREE.TextureLoader();
    // A simple lava or noise texture makes a huge difference
    const diskTexture = textureLoader.load('https://threejs.org/examples/textures/lava/lavatile.jpg');
    diskTexture.wrapS = diskTexture.wrapT = THREE.RepeatWrapping;
    
    const diskMat = new THREE.MeshBasicMaterial({ 
        map: diskTexture,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        color: 0xff6600 // Tints the texture orange/red
    });
    
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = Math.PI / 2; // Lay it flat
    disk.name = "accretionDisk"; // For animation loop
    group.add(disk);

    // THE LENSING RING (The Halo)
    // Make this MUCH wider and tilt it toward the camera
    const lensGeo = new THREE.RingGeometry(config.size * 1.5, config.size * 8, 128); // Increased outer radius to 8
    const lensMat = new THREE.MeshBasicMaterial({ 
        color: 0xff2200, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.6,
        blending: THREE.AdditiveBlending 
    });
    const lensingRing = new THREE.Mesh(lensGeo, lensMat);
    lensingRing.name = "lensingRing";
    
    // TILT IT: This creates the "spherical" wrapping effect
    lensingRing.rotation.x = Math.PI / 4; 
    lensingRing.rotation.y = Math.PI / 4; 
    
    group.add(lensingRing);

    
    /*
    // 3. THE LENSING RING (The Vertical "Halo")
    // This is the light bent by gravity over the top of the hole
    const lensGeo = new THREE.RingGeometry(config.size * 1.4, config.size * 4.8, 128);
    const lensMat = new THREE.MeshBasicMaterial({ 
        color: 0xff2200, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending 
    });
    const lensingRing = new THREE.Mesh(lensGeo, lensMat);
    lensingRing.name = "lensingRing"; 
    // We leave this one standing vertically or slightly tilted
    group.add(lensingRing);
*/
    // Add 3-4 rings of different sizes and opacities in blackhole.js
    for (let i = 1; i <= 3; i++) {
        const glowRingGeo = new THREE.RingGeometry(config.size * 1.2, config.size * (5 + i), 64);
        const glowRingMat = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            transparent: true,
            opacity: 0.3 / i, // Outer rings are FADER
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(glowRingGeo, glowRingMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
    }
    
    // 4. THE VOID GLOW (Atmospheric fear)
    const glowGeo = new THREE.SphereGeometry(config.size * 1.05, 32, 32);

    
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00, // Change to a hot orange/yellow
        transparent: true,
        opacity: 0.3,    // Increased slightly for more "pop"
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending // This makes it "glow" against the black
    });
    
    /*const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide
    });
*/ 
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    // 5. THE GRAVITY LIGHT (Lights up your ship as you get close)
    const pointLight = new THREE.PointLight(0xff6600, 5, config.size * 50);
    group.add(pointLight);

    group.position.set(config.position.x, config.position.y, config.position.z);
    scene.add(group);

    // RETURN ONLY THE GROUP to fix the "position undefined" error
    return group; 
}
