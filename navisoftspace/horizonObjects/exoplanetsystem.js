// 📦 ADD THIS IMPORT LINE AT THE VERY TOP:
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// Add this to your star creation logic
export function createExoplanetSystem(scene, starPosition) {
    const system = new THREE.Group();
    
    // 🎯 Gather configuration fallbacks to keep the tracker loop happy
    const systemName = starPosition.name || 'Proxima Centauri';
    const systemType = starPosition.type || 'exoplanet';

    // Set identity on the master group container
    system.name = systemName;
    system.userData = {
        type: systemType,
        innerRadius: starPosition.innerRadius || 0,
        outerRadius: starPosition.outerRadius || 0,
        name: systemName
    };
    
    // --- 1. THE STAR (Proxima) ---
    const starGeo = new THREE.SphereGeometry(5000, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const star = new THREE.Mesh(starGeo, starMat);
    
    // 🎯 STAR IDENTITY LAYER: Set state to 'gas'
    star.name = systemName + " Star";
    star.userData = {
        type: 'star',
        name: systemName,
        state: 'gas' // Star core is burning plasma gas
    };
    system.add(star);

    // --- 2. THE EARTH-LIKE PLANET (Proxima b) ---
    const planetGeo = new THREE.SphereGeometry(200, 32, 32);
    const planetMat = new THREE.MeshStandardMaterial({ color: 0x2277ff }); // Blue/Green
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.x = 15000; // Orbit distance
    
    // 🎯 PLANET IDENTITY LAYER: Set state to 'solid'
    planet.name = systemName + " b";
    planet.userData = {
        type: 'exoplanet_body',
        name: systemName + ' b',
        state: 'solid' // Rocky exoplanet core surface
    };
    system.add(planet);

    // GLOBAL POSITIONING
    system.position.set(starPosition.x, starPosition.y, starPosition.z);
    scene.add(system);
    
    return system; 
}
