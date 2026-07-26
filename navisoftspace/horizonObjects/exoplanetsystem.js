import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createExoplanet } from 'https://cdn.jsdelivr.net/gh/dganigame-coder/space@5375f6d/navisoftspace/horizonObjects/exoplanet.js';

export function createExoplanetSystem(scene, config = {}) {
    console.group("🪐 [Exoplanet System Builder] Initialization");

    // 1. Validate Input Dependencies
    if (!scene) {
        console.error("❌ ERROR: The 'scene' parameter is undefined or null.");
        console.groupEnd();
        return null;
    }

    if (typeof THREE === 'undefined') {
        console.error("❌ ERROR: Global 'THREE' object is undefined.");
        console.groupEnd();
        return null;
    }

    const { 
        x = 0, y = 0, z = 0, 
        name = 'K2-18b System', 
        planetRadius = 600,
        atmosColor = 0x00e1ff,
        starRadius = 5000,
        starColor = 0xff4400,
        starOffset = 30000
    } = config;

    // 2. Root System Group (Global Space Placement)
    const system = new THREE.Group();
    system.name = name;
    system.position.set(x, y, z);
    console.log(`📦 Root System Created -> name: "${system.name}"`, system);

    // 3. Barycenter Orbit Pivot (Handles Orbital Rotation)
    const orbitGroup = new THREE.Group();
    orbitGroup.name = 'orbitGroup';
    system.add(orbitGroup);
    console.log(` ├── 🔄 Orbit Pivot Added -> name: "${orbitGroup.name}"`);

    // 4. The Central Star
    const starGeo = new THREE.SphereGeometry(starRadius, 64, 64);
    const starMat = new THREE.MeshBasicMaterial({ color: starColor });
    const star = new THREE.Mesh(starGeo, starMat);
    star.name = 'star';
    star.position.set(0, 0, 0);
    system.add(star); // Star sits at the core of the system
    console.log(` ├── ☀️ Star Mesh Added -> name: "${star.name}"`, star);

    // Star Light Source
    const starLight = new THREE.PointLight(0xffffff, 4, starOffset * 5);
    starLight.name = 'starLight';
    starLight.position.copy(star.position);
    system.add(starLight);

    // 5. Build the Exoplanet via Composition (Delegated to createExoplanet)
    console.log(` ├── 🛠️ Delegating planet construction to createExoplanet()...`);
    const exoplanet = createExoplanet({
        name: `${name} Primary World`,
        radius: planetRadius,
        atmosColor: atmosColor,
        x: starOffset // Position planet out at orbital distance
    });

    // Attach planet cluster to the orbit pivot
    orbitGroup.add(exoplanet.planetGroup);
    console.log(` └── 🌍 Exoplanet Cluster attached to Orbit Pivot.`);

    // 6. Attach convenience references to root group
    system.system = system;
    system.star = star;
    system.planet = exoplanet.planetBody;
    system.clouds = exoplanet.clouds;
    system.orbitGroup = orbitGroup;

    scene.add(system);
    console.log("✅ System hierarchy attached to main scene.");

    // 7. Verify internal structure
    const result = { 
        system, 
        star, 
        planet: exoplanet.planetBody,  // Core terrain mesh for day/night spin
        clouds: exoplanet.clouds,      // Cloud layer for drift animation
        planetGroup: exoplanet.planetGroup,
        orbitGroup 
    };

    console.log("🚀 System Assembly Complete. Returned references:", result);
    console.groupEnd();

    return result;
}
