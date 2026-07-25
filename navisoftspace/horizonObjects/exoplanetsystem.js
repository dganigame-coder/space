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

    // 1. MAIN SYSTEM CONTAINER (Positioned in deep space)
    const system = new THREE.Group();
    system.name = name;
    system.position.set(x, y, z);
    system.userData = { type: type, name: name };

    // --- 2. THE STAR (Centered at 0,0,0 inside system) ---
    const starGeo = new THREE.SphereGeometry(starRadius, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: starColor });
    const star = new THREE.Mesh(starGeo, starMat);
    star.name = name + " Star";
    system.add(star);

    // Light source placed directly at the star's core
    const starLight = new THREE.PointLight(starColor, 4, starOffset * 10);
    system.add(starLight);

    // --- 3. ORBIT PIVOT GROUP ---
    // Rotating this group makes the planet orbit the star seamlessly!
    const orbitGroup = new THREE.Group();
    system.add(orbitGroup);

    // --- 4. THE PLANET (Offset along local X axis inside orbitGroup) ---
    const planetGeo = new THREE.SphereGeometry(planetRadius, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({ 
        color: planetColor,
        roughness: 0.5 
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.x = starOffset; // Distance from star
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
    atmosphere.position.x = starOffset; // Keeps atmosphere locked to the planet
    orbitGroup.add(atmosphere);

    scene.add(system);

    // Return object references so you can animate them in your frame loop
    return {
        system,
        star,
        planet,
        orbitGroup
    };
}
