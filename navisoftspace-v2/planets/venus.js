import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 🎨 HIGH-RES BASE TEXTURES (a through e database matrix)
const TEXTURE_ATLAS = {
            a:'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_mercury.jpg',
            b:'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/8k_mercury.jpg',
            c:'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
            d:'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg',
            e:'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
            f:'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg',
            g:'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/8k_mars.jpg',
            h:'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/8k_mercury.jpg',
            i:'https://threejs.org/examples/textures/planets/moon_1024.jpg',
            j:'https://threejs.org/examples/textures/planets/moon_1024.jpg',
            k:'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/pluto.jpg',
            l:'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_saturn.jpg',
            m:'https://raw.githubusercontent.com/dganigame-coder/space/master/navisoftspace/planets/texture/2k_sun.jpg',
            n:'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_titan.jpg',
            o:'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_uranus.jpg',
            p:'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_venus_surface.jpg'
};

export class UniverseGenerator {
    constructor(scene) {
        this.scene = scene;
        this.generatedSectors = new Set();
        this.cosmicBodies = []; // Array tracking all dynamic stellar assets
        this.sectorSize = 80000; // Increased sector room to support massive orbits safely
    }

    // Call this inside your main requestAnimationFrame loop tracking your ship camera
    update(cameraPosition) {
        const sectorX = Math.floor(cameraPosition.x / this.sectorSize);
        const sectorZ = Math.floor(cameraPosition.z / this.sectorSize);
        const sectorKey = `${sectorX},${sectorZ}`;

        if (!this.generatedSectors.has(sectorKey)) {
            this.generatedSectors.add(sectorKey);
            this.generateSector(sectorX, sectorZ);
        }

        // 🔄 RUN THE ORBITAL CYCLE FOR ALL ACTIVE PLANETS
        for (let i = 0; i < this.cosmicBodies.length; i++) {
            if (typeof this.cosmicBodies[i].onUpdate === 'function') {
                this.cosmicBodies[i].onUpdate();
            }
        }
    }

    generateSector(sX, sZ) {
        // Protect your handcrafted starting solar system around coordinates 0,0
        if (Math.abs(sX) <= 1 && Math.abs(sZ) <= 1) return; 

        const originX = sX * this.sectorSize;
        const originZ = sZ * this.sectorSize;
        const sectorRoll = Math.random();

        // 🌟 50% chance a deep-space sector contains a dynamic moving solar system
        if (sectorRoll < 0.50) {
            this.spawnDynamicSolarSystem(originX, originZ);
        }
        // Other percentages can handle standalone deep space nebulae or black holes!
    }

    /**
     * 🪐 GENERATE A DYNAMIC SOLAR SYSTEM FROM SCRATCH
     */
    spawnDynamicSolarSystem(ox, oz) {
        // Calculate the central core coordinates of this specific system inside the sector chunk
        const systemCenter = new THREE.Vector3(
            ox + (Math.random() - 0.5) * (this.sectorSize * 0.4),
            (Math.random() - 0.5) * 4000,
            oz + (Math.random() - 0.5) * (this.sectorSize * 0.4)
        );

        // 1. SPAWN THE MASTER CENTRAL SUN
        const sunRadius = 1500;
        const sunGeo = new THREE.SphereGeometry(sunRadius, 32, 32);
        
        // Stars are self-illuminated, so they use MeshBasicMaterial
        const textureLoader = new THREE.TextureLoader();
        const sunMat = new THREE.MeshBasicMaterial({
            map: textureLoader.load(TEXTURE_ATLAS.e), // Boiling magma texture
            color: [0xffaa00, 0xff3300, 0x00aaff, 0xffffff][Math.floor(Math.random() * 4)] // Random star classification color
        });
        
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.position.copy(systemCenter);
        sunMesh.userData = { type: "solid", r: sunRadius * 1.1, name: "Core Stellar Anchor", info: "High energy output." };
        
        this.scene.add(sunMesh);
        this.cosmicBodies.push(sunMesh);

        // 2. SPAWN ATTENDANT MOVING PLANETS
        const numPlanets = Math.floor(Math.random() * 5) + 3; // Generates 3 to 7 moving worlds
        
        let currentOrbitDistance = 5000; // Starting orbital clearance from the Sun's surface

        for (let i = 0; i < numPlanets; i++) {
            // Expand orbit distance incrementally out from the sun center so they never collide or overlap
            currentOrbitDistance += 3500 + (Math.random() * 2000); 
            
            // Randomize starting position on their circular orbit rings
            let currentOrbitAngle = Math.random() * Math.PI * 2; 
            
            // Outer planets move slower than inner planets, following Keplerian mechanics!
            const dynamicOrbitSpeed = 0.002 / Math.sqrt(currentOrbitDistance); 
            const dynamicRotationSpeed = (Math.random() > 0.2 ? 1 : -1) * (0.005 + Math.random() * 0.01);

            const planetSize = 250 + Math.random() * 250;

            // Roll procedural mix textures (e.g., Mixing 'a' + 'c')
            const textureKeys = ['a', 'b', 'c', 'd'];
            const key1 = textureKeys[Math.floor(Math.random() * textureKeys.length)];
            const key2 = textureKeys[Math.floor(Math.random() * textureKeys.length)];
            const mixedTexture = this.generateMixedTexture(key1, key2, Math.random());

            const planetGroup = new THREE.Group();
            
            const planetMesh = new THREE.Mesh(
                new THREE.SphereGeometry(planetSize, 64, 64),
                new THREE.MeshPhongMaterial({ map: mixedTexture, shininess: 10 })
            );
            planetGroup.add(planetMesh);

            // Optional Dynamic Planetary Ring injection
            if (Math.random() > 0.65) {
                const ringGeo = new THREE.RingGeometry(planetSize * 1.4, planetSize * 2.6, 64);
                const ringMat = new THREE.MeshStandardMaterial({
                    color: 0xccaa66,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.6
                });
                const ringMesh = new THREE.Mesh(ringGeo, ringMat);
                ringMesh.rotation.x = Math.PI / 2.3;
                planetGroup.add(ringMesh);
            }

            // Set spatial engine tracking fields
            planetGroup.userData = {
                type: "solid",
                r: planetSize * 1.2,
                name: `Procedural Exoplanet ${ox.toString().slice(-3)}-${i}`,
                info: "Active orbital drift path checked."
            };

            // 🛠️ THE SYSTEM COUPLING: Bind persistent variables directly into this instance's update routine loop
            planetGroup.onUpdate = () => {
                // Advance orbit frame angle position
                currentOrbitAngle += dynamicOrbitSpeed;

                // Calculate circular vectors relative to the dynamic central Sun position!
                planetGroup.position.x = systemCenter.x + Math.cos(currentOrbitAngle) * currentOrbitDistance;
                planetGroup.position.y = systemCenter.y; // Keep alignment on plane axes
                planetGroup.position.z = systemCenter.z + Math.sin(currentOrbitAngle) * currentOrbitDistance;

                // Rotate planet on local axis
                planetMesh.rotation.y += dynamicRotationSpeed;
            };

            // Prime starting positions immediately on generation frame
            planetGroup.onUpdate();

            this.scene.add(planetGroup);
            this.cosmicBodies.push(planetGroup);
        }
    }

    /**
     * Canvas Mixing buffer pipeline
     */
    generateMixedTexture(keyA, keyB, blendAmount) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const dynamicTexture = new THREE.CanvasTexture(canvas);

        const imgA = new Image();
        const imgB = new Image();
        imgA.crossOrigin = "anonymous";
        imgB.crossOrigin = "anonymous";

        let loadedCount = 0;
        const checkAndMix = () => {
            loadedCount++;
            if (loadedCount === 2) {
                ctx.drawImage(imgA, 0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = blendAmount; 
                ctx.drawImage(imgB, 0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 1.0;
                dynamicTexture.needsUpdate = true;
            }
        };

        imgA.onload = checkAndMix;
        imgB.onload = checkAndMix;
        imgA.src = TEXTURE_ATLAS[keyA];
        imgB.src = TEXTURE_ATLAS[keyB];

        return dynamicTexture;
    }
}
