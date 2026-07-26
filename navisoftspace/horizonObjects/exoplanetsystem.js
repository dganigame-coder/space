export function createExoplanetSystem(scene, config = {}) {
    console.group("🪐 [K2-18b Builder] System Initialization");

    // 1. Validate Input Dependencies
    if (!scene) {
        console.error("❌ ERROR: The 'scene' parameter is undefined or null. Check where you call createExoplanetSystem().");
        console.groupEnd();
        return null;
    }

    if (typeof THREE === 'undefined') {
        console.error("❌ ERROR: Global 'THREE' object is undefined. Ensure Three.js is imported before calling this function.");
        console.groupEnd();
        return null;
    }

    console.log("✅ Scene verified:", scene);
    console.log("⚙️ Config parameters applied:", config);

    const { 
        x = 0, y = 0, z = 0, 
        name = 'K2-18b System', 
        planetRadius = 300000,
        planetColor = 0x0a2540,
        atmosColor = 0x00e1ff,
        starRadius = 100000,
        starColor = 0xff3300,
        starOffset = 1200000
    } = config;

    // 2. Create Root System Group
    const system = new THREE.Group();
    system.name = name;
    system.position.set(x, y, z);
    console.log(`📦 Root Group Created -> name: "${system.name}"`, system);

    // 3. Barycenter Orbit Pivot
    const orbitGroup = new THREE.Group();
    orbitGroup.name = 'orbitGroup';
    system.add(orbitGroup);
    console.log(` ├── 🔄 Group Added -> name: "${orbitGroup.name}"`);

    // 4. The Star
    const starGeo = new THREE.SphereGeometry(starRadius, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: starColor, wireframe: false });
    const star = new THREE.Mesh(starGeo, starMat);
    star.name = 'star';
    star.position.x = -starOffset * 0.1;
    orbitGroup.add(star);
    console.log(` ├── ☀️ Mesh Added -> name: "${star.name}"`, star);

    // Star light
    const starLight = new THREE.PointLight(starColor, 5, starOffset * 10);
    starLight.name = 'starLight';
    starLight.position.copy(star.position);
    orbitGroup.add(starLight);

    // 5. The Planet
    const planetGeo = new THREE.SphereGeometry(planetRadius, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({ 
        color: planetColor,
        roughness: 0.6,
        metalness: 0.2
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.name = 'planet';
    planet.position.x = starOffset;
    orbitGroup.add(planet);
    console.log(` ├── 🌍 Mesh Added -> name: "${planet.name}"`, planet);

    // 6. Atmosphere
    const atmosGeo = new THREE.SphereGeometry(planetRadius * 1.06, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
        color: atmosColor,
        transparent: true,
        opacity: 0.35,
        wireframe: true
    });
    const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    atmosphere.name = 'atmosphere';
    planet.add(atmosphere);
    console.log(` │    └── 🌫️ Sub-Mesh Added -> name: "${atmosphere.name}"`);

    // Attach convenience references to root group
    system.system = system;
    system.star = star;
    system.planet = planet;
    system.orbitGroup = orbitGroup;

    scene.add(system);
    console.log("✅ System added to main scene hierarchy.");

    // 7. Verification Test: Test getObjectByName immediately
    console.log("🔍 Internal Search Test (getObjectByName):", {
        foundStar: system.getObjectByName('star')?.name ?? 'FAILED (undefined)',
        foundPlanet: system.getObjectByName('planet')?.name ?? 'FAILED (undefined)',
        foundOrbitGroup: system.getObjectByName('orbitGroup')?.name ?? 'FAILED (undefined)'
    });

    const result = { system, star, planet, orbitGroup };
    console.log("🚀 Function Return Object:", result);
    console.groupEnd();

    return result;
}
