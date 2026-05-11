/*** 11-05-26 23:20 **/
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// Titan orbits Saturn, so its distance and speed are relative to the planet
let localOrbitAngle = Math.random() * Math.PI * 2; 
const localOrbitDistance = 12000; // Far enough to clear Saturn's rings (OuterRadius was 5500)
const localOrbitSpeed = 0.005;    // Moons orbit faster than planets move around the Sun

export function createTitan(loader) {
    const group = new THREE.Group();

    // --- 1. THE MOON BODY ---
    // Titan is roughly 0.4x the size of Earth, but in your scale, 
    // a radius of 250-400 works well next to Saturn's 2500.
    const titan = new THREE.Mesh(
        new THREE.SphereGeometry(350, 64, 64),
        new THREE.MeshStandardMaterial({ 
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_titan.jpg'),
            roughness: 1,
            metalness: 0,
            emissive: 0x221100, // Subtle orange tint for atmospheric scattering
            emissiveIntensity: 0.2
        })
    );
    group.add(titan);

    // --- 2. METADATA ---
    group.userData = { 
        name: "TITAN", 
        info: "Saturn's largest moon. Thick nitrogen atmosphere with methane lakes.",
        r: 350, 
        type: "solid",
        parent: "SATURN" // Useful for HUD logic
    };

    // --- 3. ORBITAL LOGIC ---
    // Note: This function needs to know where Saturn is to stay "connected"
    group.onUpdate = (saturnGroup) => {
        if (!saturnGroup) return;

        // Update local angle
        localOrbitAngle += localOrbitSpeed;

        // Position relative to Saturn's current position
        group.position.x = saturnGroup.position.x + Math.cos(localOrbitAngle) * localOrbitDistance;
        group.position.z = saturnGroup.position.z + Math.sin(localOrbitAngle) * localOrbitDistance;
        
        // Tilt the orbit slightly so it's not perfectly aligned with the rings
        group.position.y = saturnGroup.position.y + Math.sin(localOrbitAngle) * 1000;

        // Self-rotation
        titan.rotation.y += 0.01;
    };

    return group;
}
