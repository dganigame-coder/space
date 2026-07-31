import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createExoplanet } from 'exoplanet';

/**
 * Exoplanet System Factory (Returns a Root THREE.Group)
 */
export function createExoplanetSystem(scene, config = {}) {
    const systemGroup = new THREE.Group();

    const {
        x = 0, y = 0, z = 0,
        name = "Exoplanet System",
        starRadius = 80000,
        starColor = 0xffcc33,
        starOffset = 1200000
    } = config;

    const mainRadius = config.planetRadius || config.r || starRadius;
    const starColorObj = new THREE.Color(starColor);

    // 1. Host Star (Created directly as an Exoplanet Group)
    const starGroup = createExoplanet(null, {
        name: `${name} Host Star`,
        radius: starRadius,
        color: starColor,
        hasClouds: false,
        hasAtmosphere: true,
        atmosColor: 0xffaa00,
        x: -starOffset * 0.1
    });
    systemGroup.add(starGroup);

    // Light Source
    const starLight = new THREE.PointLight(starColor, 5, starOffset * 10);
    starLight.position.copy(starGroup.position);
    systemGroup.add(starLight);

    // 2. Process Orbiting Planets
    const rawPlanets = config.planets || [
        {
            name: config.planetName || `${name} Planet`,
            radius: config.planetRadius || 3000,
            color: config.planetColor ?? 0x0a2540,
            atmosColor: config.atmosColor ?? 0x00e1ff,
            atmosOpacity: config.atmosOpacity,
            roughness: config.roughness,
            metalness: config.metalness,
            hasClouds: config.hasClouds,
            hasAtmosphere: config.hasAtmosphere,
            orbitDistance: starOffset,
            orbitSpeed: config.orbitSpeed || 0.008,
            rotationSpeed: config.rotationSpeed || 0.02
        }
    ];

    const orbitalPivots = [];
    const childPlanetGroups = [];

    rawPlanets.forEach((pConfig, index) => {
        const pivot = new THREE.Group();
        pivot.name = `${pConfig.name}_Pivot_${index}`;
        systemGroup.add(pivot);

        const planetGroup = createExoplanet(null, {
            name: pConfig.name,
            radius: pConfig.radius || 3000,
            color: pConfig.color,
            atmosColor: pConfig.atmosColor,
            atmosOpacity: pConfig.atmosOpacity,
            roughness: pConfig.roughness,
            metalness: pConfig.metalness,
            hasClouds: pConfig.hasClouds,
            hasAtmosphere: pConfig.hasAtmosphere,
            rotationSpeed: pConfig.rotationSpeed
        });

        planetGroup.position.x = pConfig.orbitDistance || starOffset;
        pivot.add(planetGroup);

        orbitalPivots.push({ pivot, speed: pConfig.orbitSpeed || 0.008, planetGroup });
        childPlanetGroups.push(planetGroup);
    });

    // 📍 Setup System Root
    systemGroup.name = name;
    systemGroup.position.set(x, y, z);

    systemGroup.r = mainRadius;
    systemGroup.radius = mainRadius;
    systemGroup.color = starColorObj;

    systemGroup.userData = {
        type: 'exoplanet_system',
        name: name,
        radius: mainRadius,
        r: mainRadius,
        targets: [starGroup, ...childPlanetGroups] // Expose sub-targets directly
    };

    // 🔄 System Update Loop
    const updateRoutine = (delta = 1) => {
        if (starGroup.onUpdate) starGroup.onUpdate(delta);

        orbitalPivots.forEach(item => {
            item.pivot.rotation.y += item.speed * delta;
            if (item.planetGroup.onUpdate) item.planetGroup.onUpdate(delta);
        });
    };

    systemGroup.onUpdate = updateRoutine;
    systemGroup.update = updateRoutine;

    if (scene && typeof scene.add === 'function') {
        scene.add(systemGroup);
    }

    return systemGroup;
}
