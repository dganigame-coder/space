import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createExoplanet } from 'exoplanet';

/**
 * Exoplanet System Factory
 */
export function createExoplanetSystem(scene, config = {}) {
    const {
        x = 0, y = 0, z = 0,
        name = 'Exoplanet System',
        starRadius = 100000,
        starColor = 0xff3300,
        starOffset = 1200000
    } = config;

    const mainRadius = config.planetRadius || config.r || starRadius || 300000;
    const starColorObj = new THREE.Color(starColor);
    const starMat = new THREE.MeshBasicMaterial({ color: starColor });

    // Root Container Group
    const systemGroup = new THREE.Group();
    systemGroup.name = `${name}_System`;
    systemGroup.position.set(x, y, z);
    
    // Attach flight properties directly to container group
    systemGroup.r = mainRadius;
    systemGroup.radius = mainRadius;
    systemGroup.color = starColorObj;
    systemGroup.material = starMat;

    // 1. Barycenter Orbit Pivot
    const orbitGroup = new THREE.Group();
    orbitGroup.name = `${name}_OrbitGroup`;
    orbitGroup.r = mainRadius;
    orbitGroup.radius = mainRadius;
    orbitGroup.color = starColorObj;
    orbitGroup.material = starMat;
    systemGroup.add(orbitGroup);

    // 2. Host Star
    const starGeo = new THREE.SphereGeometry(starRadius, 32, 32);
    const star = new THREE.Mesh(starGeo, starMat);
    star.name = `${name} Host Star`;
    star.position.x = -starOffset * 0.1;
    star.r = starRadius;
    star.radius = starRadius;
    star.color = starColorObj;
    orbitGroup.add(star);

    // Light Engine
    const starLight = new THREE.PointLight(starColor, 5, starOffset * 10);
    starLight.position.copy(star.position);
    starLight.r = starRadius;
    starLight.radius = starRadius;
    starLight.color = starColorObj;
    orbitGroup.add(starLight);

    // 3. Planets Processing
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

        const pRadius = pConfig.radius || pConfig.r || config.planetRadius || 300000;
        const pColorObj = new THREE.Color(pConfig.color ?? config.planetColor ?? 0x0a2540);

        planetOrbitPivot.r = pRadius;
        planetOrbitPivot.radius = pRadius;
        planetOrbitPivot.color = pColorObj;
        planetOrbitPivot.material = starMat;
        orbitGroup.add(planetOrbitPivot);

        const planetInstance = createExoplanet(null, {
            name: pConfig.name || `${name} ${index + 1}`,
            radius: pRadius,
            color: pConfig.color ?? config.planetColor ?? 0x0a2540,
            atmosColor: pConfig.atmosColor ?? config.atmosColor ?? 0x00e1ff,
            atmosOpacity: pConfig.atmosOpacity ?? config.atmosOpacity,
            roughness: pConfig.roughness ?? config.roughness,
            metalness: pConfig.metalness ?? config.metalness,
            hasClouds: pConfig.hasClouds ?? config.hasClouds,
            hasAtmosphere: pConfig.hasAtmosphere ?? config.hasAtmosphere,
            rotationSpeed: pConfig.rotationSpeed ?? config.rotationSpeed
        });

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

    return {
        name,
        system: systemGroup,
        systemGroup,
        star,
        hostStar: star,
        starLight,
        orbitGroup,
        planets: instantiatedPlanets,

        get planet() { return instantiatedPlanets[0]?.mesh || null; },
        get planetBody() { return instantiatedPlanets[0]?.mesh || null; },
        get mesh() { return instantiatedPlanets[0]?.mesh || null; },
        get planetPivot() { return instantiatedPlanets[0]?.pivot || null; },
        material: starMat,

        radius: mainRadius,
        r: mainRadius,
        color: starColorObj,

        get position() { return systemGroup.position; },
        get rotation() { return systemGroup.rotation; },

        traverse(callback) {
            if (systemGroup && typeof systemGroup.traverse === 'function') {
                systemGroup.traverse(callback);
            }
        },
        getObjectByName(name) {
            return systemGroup ? systemGroup.getObjectByName(name) : null;
        },

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
