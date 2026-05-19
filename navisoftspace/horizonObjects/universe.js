import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class UniverseGenerator {
    constructor(scene) {
        this.scene = scene;
        this.generatedSectors = new Set();
        this.cosmicBodies = [];
        this.sectorSize = 50000; // Size of each massive chunk of space
    }

    // Call this in your engine loop tracking the camera position
    update(cameraPosition) {
        const sectorX = Math.floor(cameraPosition.x / this.sectorSize);
        const sectorZ = Math.floor(cameraPosition.z / this.sectorSize);
        const sectorKey = `${sectorX},${sectorZ}`;

        // If we haven't visited this chunk of space, build it!
        if (!this.generatedSectors.has(sectorKey)) {
            this.generatedSectors.add(sectorKey);
            this.generateSector(sectorX, sectorZ);
        }
    }

    generateSector(sX, sZ) {
        const originX = sX * this.sectorSize;
        const originZ = sZ * this.sectorSize;

        // Roll a random dice to see what populates this sector
        const sectorRoll = Math.random();

        if (sectorRoll < 0.4) {
            // 🌟 40% Chance: A Unique Solar System (Single, Binary, or Trinary)
            this.spawnSolarSystem(originX, originZ);
        } else if (sectorRoll < 0.65) {
            // 🌌 25% Chance: Deep Space Nebula Cluster
            this.spawnNebulaCluster(originX, originZ);
        } else if (sectorRoll < 0.85) {
            // 💥 20% Chance: Cosmic Graveyard (Black Holes / Supernovas)
            this.spawnCosmicAnomaly(originX, originZ);
        }
        // 15% Chance: Empty Deep Space Void
    }

    // --- SYSTEM GENERATORS ---

    spawnSolarSystem(ox, oz) {
        const numSuns = Math.floor(Math.random() * 3) + 1; // 1 = Single, 2 = Binary, 3 = Trinary Sun!
        const systemCenter = new THREE.Vector3(ox + this.rand(), Math.random() * 5000 - 2500, oz + this.rand());

        // 1. Spawning the Stars
        for (let i = 0; i < numSuns; i++) {
            const starOffset = new THREE.Vector3((i - (numSuns-1)/2) * 1200, 0, 0);
            const starPos = systemCenter.clone().add(starOffset);
            
            const starColors = [0xffaa00, 0xff3300, 0x00aaff, 0xffffff, 0x9900ff];
            const chosenColor = starColors[Math.floor(Math.random() * starColors.length)];

            this.createObject('star', starPos, 800, {
                name: numSuns > 1 ? `Binary Core Star ${String.fromCharCode(65+i)}` : "Main Sequence Star",
                color: chosenColor,
                info: "High gravity stellar core. Solar static detected."
            });
        }

        // 2. Spawning Attendant Planets
        const numPlanets = Math.floor(Math.random() * 6) + 2; // 2 to 8 planets
        for (let i = 0; i < numPlanets; i++) {
            const orbitRadius = 4000 + (i * 3500);
            const angle = Math.random() * Math.PI * 2;
            const planetPos = new THREE.Vector3(
                systemCenter.x + Math.cos(angle) * orbitRadius,
                systemCenter.y + (Math.random() * 400 - 200),
                systemCenter.z + Math.sin(angle) * orbitRadius
            );

            const isGas = Math.random() > 0.5;
            this.createObject(isGas ? 'gas' : 'solid', planetPos, Math.random() * 300 + 100, {
                name: `Exoplanet Designated ${ox.toString().slice(-3)}-${i}`,
                info: isGas ? "Atmospheric density highly toxic." : "Solid surface structure verified."
            });
        }
    }

    spawnNebulaCluster(ox, oz) {
        const center = new THREE.Vector3(ox + this.rand(), Math.random() * 4000 - 2000, oz + this.rand());
        const colors = [0xff00ff, 0x00ffff, 0xff5500, 0x00ff00];
        const nebulaColor = colors[Math.floor(Math.random() * colors.length)];

        this.createObject('nebula', center, 6000, {
            name: "Gaseous Nebula Cloud",
            isBreathing: true,
            color: nebulaColor,
            info: "Intense particulate concentration. Engine drag active."
        });
    }

    spawnCosmicAnomaly(ox, oz) {
        const pos = new THREE.Vector3(ox + this.rand(), Math.random() * 2000 - 1000, oz + this.rand());
        
        if (Math.random() > 0.5) {
            // Singularity
            this.createObject('blackhole', pos, 1500, {
                name: "Class-G Singularity",
                info: "Gravitational lensing detected. Structural compromise imminent."
            });
        } else {
            // Star Death
            this.createObject('supernova', pos, 3000, {
                name: "Collapsing Supernova Remnant",
                isBreathing: true,
                info: "Stellar explosion framework. Extreme thermal output."
            });
        }
    }

    // Helper to generate visual placeholders and bind metadata
    createObject(type, position, radius, userData) {
        // Build base geometry depending on type
        let geo, mat;

        if (type === 'star') {
            geo = new THREE.SphereGeometry(radius, 32, 32);
            mat = new THREE.MeshBasicMaterial({ color: userData.color || 0xffffff });
        } else if (type === 'blackhole') {
            geo = new THREE.SphereGeometry(radius, 32, 32);
            mat = new THREE.MeshBasicMaterial({ color: 0x050505 });
        } else {
            // Regular planets/clouds
            geo = new THREE.SphereGeometry(radius, 16, 16);
            mat = new THREE.MeshLambertMaterial({ 
                color: userData.color || 0x888888, 
                wireframe: type === 'nebula' || type === 'supernova' 
            });
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        
        // Feed userData properties exactly like your engine expectations
        mesh.userData = { type, r: radius, ...userData };

        this.scene.add(mesh);
        this.cosmicBodies.push(mesh); // Track internally
    }

    rand() {
        return (Math.random() - 0.5) * this.sectorSize;
    }
}
