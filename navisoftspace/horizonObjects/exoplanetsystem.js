export function createExoplanetSystem(scene, config) {
    const { 
        x = 0, y = 0, z = 0, 
        name = 'K2-18b System', 
        type = 'exoplanet',
        planetRadius = 300000,
        planetColor = 0x0a2540,
        atmosColor = 0x00e1ff,
        starRadius = 100000,
        starColor = 0xff3300,
        starOffset = 1200000
    } = config;

    // 1. SYSTEM CONTAINER
    const system = new THREE.Group();
    system.name = name;
    system.position.set(x, y, z);
    system.userData = { type: type, name: name };

    // --- 2. THE STAR (Center of system) ---
    const starGeo = new THREE.SphereGeometry(starRadius, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: starColor });
    const star = new THREE.Mesh(starGeo, starMat);
    star.name = name + " Star";
    system.add(star);

    // Light source
    const starLight = new THREE.PointLight(starColor, 4, starOffset * 10);
    system.add(starLight);

    // --- 3. THE ORBIT PIVOT GROUP ---
    // Rotating this group swings the planet around the star!
    const orbitGroup = new THREE.Group();
    system.add(orbitGroup);

    // --- 4. THE PLANET (Offset along local X inside orbitGroup) ---
    const planetGeo = new THREE.SphereGeometry(planetRadius, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({ 
        color: planetColor,
        roughness: 0.5 
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.x = starOffset;
    planet.name = name;
    orbitGroup.add(planet);

    // --- 5. ATMOSPHERE SHELL ---
    const atmosGeo = new THREE.SphereGeometry(planetRadius * 1.05, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
        color: atmosColor,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    atmosphere.position.x = starOffset;
    orbitGroup.add(atmosphere);

    scene.add(system);

    // 🔥 CRITICAL FIX: Return object containing all references!
    return {
        system,
        star,
        planet,
        orbitGroup
    };
}
