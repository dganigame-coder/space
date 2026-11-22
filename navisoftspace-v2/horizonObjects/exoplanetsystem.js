import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createStar } from './star.js';
import { createExoplanet } from './exoplanet.js';

/**
 * Exoplanet System Factory (Returns a Root THREE.Group)
 */
export function createExoplanetSystem(scene, config = {}) {
    const systemGroup = new THREE.Group();

    const {
        x = 0, y = 0, z = 0,
        name = "Exoplanet System",
        starRadius = 60000,
        starColor = 0xffcc33,
        starTextureMap = 'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_sun.jpg',
        starOffset = 1200000
    } = config;

    const mainRadius = config.planetRadius || config.r || starRadius;
    const starColorObj = new THREE.Color(starColor);

    // 1. Host Star (Created using the dedicated star factory with corona, glow sprite, and point light)
       const starGroup = createStar(null, {
        name: `${name} Host Star`,
        radius: starRadius,
        color: starColor,
        textureMap: starTextureMap,
        
        x: 0, // <--- CHANGE THIS: It must be exactly 0
        
        castLight: true,
        lightIntensity: config.starLightIntensity || 3,
        lightRange: config.starLightRange || starOffset * 10
    });
    systemGroup.add(starGroup);

    // 2. Process Orbiting Planets
    const rawPlanets = config.planets || [
        {
            name: config.planetName || `${name} Planet`,
            radius: config.planetRadius || 3000,
            color: config.planetColor,
            textureMap: config.textureMap,
            normalMap: config.normalMap,
            roughnessMap: config.roughnessMap,
            cloudMap: config.cloudMap,
            cloudOpacity: config.cloudOpacity,
            atmosColor: config.atmosColor ?? 0x00e1ff,
            atmosOpacity: config.atmosOpacity,
            roughness: config.roughness,
            metalness: config.metalness,
            hasClouds: config.hasClouds,
            hasAtmosphere: config.hasAtmosphere,
            orbitDistance: starOffset,
            orbitSpeed: config.orbitSpeed || 0.008,
            rotationSpeed: config.rotationSpeed || 0.02,
            cloudSpeed: config.cloudSpeed
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
            textureMap: pConfig.textureMap,
            normalMap: pConfig.normalMap,
            roughnessMap: pConfig.roughnessMap,
            cloudMap: pConfig.cloudMap,
            cloudOpacity: pConfig.cloudOpacity,
            atmosColor: pConfig.atmosColor,
            atmosOpacity: pConfig.atmosOpacity,
            roughness: pConfig.roughness,
            metalness: pConfig.metalness,
            hasClouds: pConfig.hasClouds,
            hasAtmosphere: pConfig.hasAtmosphere,
            rotationSpeed: pConfig.rotationSpeed,
            cloudSpeed: pConfig.cloudSpeed
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
        targets: [starGroup, ...childPlanetGroups] // Expose sub-targets directly for HUD/Autopilot
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
