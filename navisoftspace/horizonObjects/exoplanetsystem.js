export function createExoplanetSystem(scene, config) {
    // 1. EXTRACT DATA SAFELY
    const { x = 0, y = 0, z = 0, name = 'Proxima Centauri', type = 'exoplanet' } = config;

    // 2. CREATE SYSTEM CONTAINER (Defined once)
    const system = new THREE.Group();
    
    // 3. SET IDENTITY
    system.name = name;
    system.userData = {
        type: type,
        name: name
    };
    
    // --- 4. THE STAR ---
    const starGeo = new THREE.SphereGeometry(5000, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const star = new THREE.Mesh(starGeo, starMat);
    
    star.name = name + " Star"; // Changed systemName to name
    star.userData = {
        type: 'star',
        name: name,
        state: 'gas'
    };
    system.add(star);

    // --- 5. THE EARTH-LIKE PLANET ---
    const planetGeo = new THREE.SphereGeometry(200, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({ color: 0x2277ff });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.x = 15000;
    
    planet.name = name + " b"; // Changed systemName to name
    planet.userData = {
        type: 'exoplanet_body',
        name: name + ' b',
        state: 'solid'
    };
    system.add(planet);

    // 6. GLOBAL POSITIONING
    system.position.set(x, y, z);
    scene.add(system);
    
    return system; 
}
