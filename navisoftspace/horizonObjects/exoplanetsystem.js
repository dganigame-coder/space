// Add this to your star creation logic
export function createExoplanetSystem(scene, starPosition) {
    const system = new THREE.Group();
    
    // The Star (Proxima)
    const starGeo = new THREE.SphereGeometry(5000, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const star = new THREE.Mesh(starGeo, starMat);
    system.add(star);

    // The Earth-like Planet (Proxima b)
    const planetGeo = new THREE.SphereGeometry(200, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({ color: 0x2277ff }); // Blue/Green
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.x = 15000; // Orbit distance
    system.add(planet);

    system.position.set(starPosition.x, starPosition.y, starPosition.z);
    scene.add(system);
}
