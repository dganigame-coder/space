import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createStar } from 'star'; // Adjust path as needed

/**
 * Multi-Star System Factory (Returns a Root THREE.Group barycenter)
 */
export function createStarSystem(scene, config = {}) {
    const systemGroup = new THREE.Group();

    const {
        x = 0, y = 0, z = 0,
        name = "Binary Star System",
    } = config;

    // The system radius is generally the outer bounds of its furthest star
    const systemRadius = config.systemRadius || config.r || 5000000;
    
    const rawStars = config.stars || [];
    const orbitalPivots = [];
    const childStarGroups = [];

    // Process all stars in the system (e.g., Castor A1, A2)
    rawStars.forEach((sConfig, index) => {
        // Create an independent pivot for this star's orbit around the barycenter
        const pivot = new THREE.Group();
        pivot.name = `${sConfig.name}_Pivot_${index}`;
        systemGroup.add(pivot);

        // Generate the star
        const starGroup = createStar(null, {
            name: sConfig.name,
            radius: sConfig.radius || 60000,
            color: sConfig.color,
            coronaColor: sConfig.coronaColor,
            textureMap: sConfig.textureMap,
            rotationSpeed: sConfig.rotationSpeed,
            castLight: true,
            lightIntensity: sConfig.lightIntensity || 4,
            lightRange: sConfig.lightRange || systemRadius * 2
        });

        // Offset the star from the system center to create an orbital distance
        starGroup.position.x = sConfig.orbitDistance || 0;
        pivot.add(starGroup);

        orbitalPivots.push({ pivot, speed: sConfig.orbitSpeed || 0.002, starGroup });
        childStarGroups.push(starGroup);
    });

    // 📍 Setup System Root
    systemGroup.name = name;
    systemGroup.position.set(x, y, z);

    systemGroup.r = systemRadius;
    systemGroup.radius = systemRadius;

    // Push targets directly so the Transition Navigation Hub UI reads every individual star!
    systemGroup.userData = {
        type: 'star_system',
        name: name,
        radius: systemRadius,
        r: systemRadius,
        targets: [...childStarGroups] 
    };

    // 🔄 System Update Loop
    const updateRoutine = (delta = 1) => {
        orbitalPivots.forEach(item => {
            // Rotate the pivot to make the star orbit the center of the system
            item.pivot.rotation.y += item.speed * delta;
            
            // Spin the star on its own axis
            if (item.starGroup.onUpdate) item.starGroup.onUpdate(delta);
        });
    };

    systemGroup.onUpdate = updateRoutine;
    systemGroup.update = updateRoutine;

    if (scene && typeof scene.add === 'function') {
        scene.add(systemGroup);
    }

    return systemGroup;
}
