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
    system.position.set(x, y, z);

    // 1. BARYCENTER ORBIT PIVOT
    // Everything attached to this group rotates around the center of mass
    const orbitGroup = new THREE.Group();
    system.add(orbitGroup);

    // 2. THE STAR (Shifted slightly opposite to the planet for mutual orbit)
    const starGeo = new THREE.SphereGeometry(starRadius, 32, 32);
    // Wireframe or detail helps you visually SEE the star spinning!
    const starMat = new THREE.MeshBasicMaterial({ color: starColor, wireframe: false });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.x = -starOffset * 0.1; // Small wobble offset
    orbitGroup.add(star);

    // Star light source
    const starLight = new THREE.PointLight(starColor, 5, starOffset * 10);
    starLight.position.copy(star.position);
    orbitGroup.add(starLight);

    // 3. THE PLANET (Offset on the opposite side)
    const planetGeo = new THREE.SphereGeometry(planetRadius, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({ 
        color: planetColor,
        roughness: 0.6,
        metalness: 0.2
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.x = starOffset;
    orbitGroup.add(planet);

    // 4. ATMOSPHERE SHELL (Attached DIRECTLY to planet so they spin together)
    const atmosGeo = new THREE.SphereGeometry(planetRadius * 1.06, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
        color: atmosColor,
        transparent: true,
        opacity: 0.35,
        wireframe: true // 🔥 Wireframe lets you visually watch the atmosphere spin!
    });
    const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    planet.add(atmosphere); // Attached to planet mesh!

    scene.add(system);

    return { system, star, planet, orbitGroup };
}
