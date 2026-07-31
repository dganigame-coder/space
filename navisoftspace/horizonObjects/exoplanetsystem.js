import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createExoplanet } from 'exoplanet';

/**
 * Exoplanet System Factory
 * Manages host star, barycenter orbit groups, and one or multiple orbiting planets.
 */
export function createExoplanetSystem(scene, config = {}) {
    const {
        x = 0, y = 0, z = 0,
        name = 'Exoplanet System',
        starRadius = 100000,
        starColor = 0xff3300,
        starOffset = 1200000
    } = config;

    // Root Container
    const systemGroup = new THREE.Group();
    systemGroup.name = `${name}_System`;
    systemGroup.position.set(x, y, z);

    // 1. BARYCENTER ORBIT PIVOT
    const orbitGroup = new THREE.Group();
    orbitGroup.name = `${name}_OrbitGroup`;
    systemGroup.add(orbitGroup);

    // 2. HOST STAR
    const starGeo = new THREE.SphereGeometry(starRadius, 32, 32);
    const starMat = new THREE.MeshBasicMaterial({ color: starColor });
    const star = new THREE.Mesh(starGeo, starMat);
    star.name = `${name} Host Star`;
    star.position.x = -starOffset * 0.1;
    orbitGroup.add(star);

    // Star Light Engine
    const starLight = new THREE.PointLight(starColor, 5, starOffset * 10);
    starLight.position.copy(star.position);
    orbitGroup.add(starLight);

    // 3. PLANET ARRAY PROCESSING
    const rawPlanets = config.planets || [
        {
            name: config.planetName || name,
            radius: config.planetRadius || config.r || 300000,
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

    const instantiatedPlanets = [];

    rawPlanets.forEach((pConfig, index) => {
        const planetOrbitPivot = new THREE.Group();
        planetOrbitPivot.name = `${pConfig.name || name}_Pivot_${index}`;
        orbitGroup.add(planetOrbitPivot);

        // Instantiate via exoplanet.js factory
        const planetInstance = createExoplanet(null, {
            name: pConfig.name || `${name} ${index + 1}`,
            radius: pConfig.radius || pConfig.r || config.planetRadius || 300000,
            color: pConfig.color ?? config.planetColor ?? 0x0a2540,
            atmosColor: pConfig.atmosColor ?? config.atmosColor ?? 0x00e1ff,
            atmosOpacity: pConfig.atmosOpacity ?? config.atmosOpacity,
            roughness: pConfig.roughness ?? config.roughness,
            metalness: pConfig.metalness ?? config.metalness,
            hasClouds: pConfig.hasClouds ?? config.hasClouds,
            hasAtmosphere: pConfig.hasAtmosphere ?? config.hasAtmosphere,
            rotationSpeed: pConfig.rotationSpeed ?? config.rotationSpeed
        });

        // Distance offset along orbit
        const dist = pConfig.orbitDistance || starOffset;
        planetInstance.planetGroup.position.x = dist;
        planetOrbitPivot.add(planetInstance.planetGroup);

        instantiatedPlanets.push({
            pivot: planetOrbitPivot,
            orbitSpeed: pConfig.orbitSpeed || 0.008,
            instance: planetInstance,
            mesh: planetInstance.planetBody
        });
    });

    if (scene && typeof scene.add === 'function') {
        scene.add(systemGroup);
    }

    const mainRadius = config.planetRadius || config.r || starRadius || 300000;
    const starColorObj = new THREE.Color(starColor);

    return {
        name,
        system: systemGroup,
        systemGroup,
        star,
        hostStar: star,
        starLight,
        orbitGroup,
        planets: instantiatedPlanets,

        // Legacy & Mesh Aliases
        get planet() {
            return instantiatedPlanets[0]?.mesh || null;
        },
        get planetBody() {
            return instantiatedPlanets[0]?.mesh || null;
        },
        get mesh() {
            return instantiatedPlanets[0]?.mesh || null;
        },
        get planetPivot() {
            return instantiatedPlanets[0]?.pivot || null;
        },

        // Radius Aliases for flight / collision calculations
        radius: mainRadius,
        r: mainRadius,

        // Color object with .r, .g, .b for HUD/flight scripts
        color: starColorObj,

        // Direct position and rotation access
        get position() {
            return systemGroup.position;
        },
        get rotation() {
            return systemGroup.rotation;
        },

        // Three.js Scene Graph Pass-Throughs
        traverse(callback) {
            if (systemGroup && typeof systemGroup.traverse === 'function') {
                systemGroup.traverse(callback);
            }
        },
        getObjectByName(name) {
            return systemGroup ? systemGroup.getObjectByName(name) : null;
        },

        // Per-frame system animation update loop
        update(delta = 1) {
            if (orbitGroup) orbitGroup.rotation.y += 0.002 * delta;
            if (star) star.rotation.y += 0.005 * delta;

            instantiatedPlanets.forEach(p => {
                p.pivot.rotation.y += p.orbitSpeed * delta;
                p.instance.update(delta);
            });
        }
    };
}
