export function createExoplanetSystem(scene, config) {
    // 1. EXTRACT DATA SAFELY (Extract all the custom properties!)
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

    const system = new THREE.Group();
    system.name = name;
    system.userData = { type: type, name: name };
    
    // --- THE STAR ---
    const starGeo = new THREE.SphereGeometry(starRadius, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: starColor });
    const star = new THREE.Mesh(starGeo, starMat);
    star.name = name + " Star";
    star.userData = { type: 'star', name: name + " Star", state: 'gas' };
    system.add(star);

    // 💡 LIGHT SOURCE (Crucial! MeshStandardMaterial needs a light to be visible)
    const starLight = new THREE.PointLight(starColor, 3, starOffset * 10);
    system.add(starLight);

    // --- THE PLANET ---
    const planetGeo = new THREE.SphereGeometry(planetRadius, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({ 
        color: planetColor,
        roughness: 0.5 
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.x = starOffset; // Uses your custom orbital distance!
    
    planet.name = name;
    planet.userData = {
        type: 'exoplanet_body',
        name: name,
        state: 'liquid/solid'
    };
    system.add(planet);

    // --- ATMOSPHERE SHELL ---
    const atmosGeo = new THREE.SphereGeometry(planetRadius * 1.05, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
        color: atmosColor,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    atmosphere.position.x = starOffset;
    system.add(atmosphere);

    // GLOBAL POSITIONING
    system.position.set(x, y, z);
    scene.add(system);
    
    return system; 
}
