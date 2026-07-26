export function createExoplanetSystem(scene, config) {
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

    const system = new THREE.Group();
    system.name = name;
    system.position.set(x, y, z);

    // 1. BARYCENTER ORBIT PIVOT
    const orbitGroup = new THREE.Group();
    orbitGroup.name = 'orbitGroup';
    system.add(orbitGroup);

    // 2. THE STAR
    const starGeo = new THREE.SphereGeometry(starRadius, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: starColor, wireframe: false });
    const star = new THREE.Mesh(starGeo, starMat);
    star.name = 'star';
    star.position.x = -starOffset * 0.1;
    orbitGroup.add(star);

    // Star light
    const starLight = new THREE.PointLight(starColor, 5, starOffset * 10);
    starLight.name = 'starLight';
    starLight.position.copy(star.position);
    orbitGroup.add(starLight);

    // 3. THE PLANET
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

    // 4. ATMOSPHERE
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

    // Convenience references for local runtime use
    system.system = system;
    system.star = star;
    system.planet = planet;
    system.orbitGroup = orbitGroup;
    
    scene.add(system);

    return { system, star, planet, orbitGroup };
}
