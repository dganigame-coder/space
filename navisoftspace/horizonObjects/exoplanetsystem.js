import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createExoplanet } from './exoplanet.js';

/**
 * Exoplanet System Factory (Returns a Root THREE.Group)
 * Hierarchical Multi-Star Systems, Exoplanets, and Moons
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

    const orbitalPivots = [];
    const allChildNodes = [];

    // Temporary vector to avoid garbage collection in update loop
    const _tempVec = new THREE.Vector3();

    // 1. Recursive Processor for Hierarchical Bodies (Stars, Planets, Moons)
    function buildCelestialNode(bodyConfig, parentGroup) {
        const pivot = new THREE.Group();
        pivot.name = `${bodyConfig.name}_Pivot`;
        parentGroup.add(pivot);

        // Detect if body is a star vs a planet
        const isStar = bodyConfig.isStar ?? bodyConfig.name.toLowerCase().includes('star');

        // Create the individual body via exoplanet.js
        const bodyNode = createExoplanet(null, {
            name: bodyConfig.name,
            radius: bodyConfig.radius || 3000,
            color: bodyConfig.color,
            isStar: isStar,
            atmosColor: bodyConfig.atmosColor,
            atmosOpacity: bodyConfig.atmosOpacity,
            roughness: bodyConfig.roughness,
            metalness: bodyConfig.metalness,
            hasClouds: bodyConfig.hasClouds,
            hasAtmosphere: bodyConfig.hasAtmosphere ?? !isStar,
            rotationSpeed: bodyConfig.rotationSpeed || 0.01
        });

        // Offset relative to parent orbit
        bodyNode.position.x = bodyConfig.orbitDistance || 0;
        pivot.add(bodyNode);

        // Add a worldPosition vector directly onto the THREE.Group for navigation/pilot tracking
        bodyNode.worldPosition = new THREE.Vector3();

        orbitalPivots.push({
            pivot,
            speed: bodyConfig.orbitSpeed || 0.005,
            node: bodyNode
        });

        allChildNodes.push(bodyNode);

        // Recursively build nested moons or companion stars
        if (bodyConfig.moons && Array.isArray(bodyConfig.moons)) {
            bodyConfig.moons.forEach(childConfig => {
                buildCelestialNode(childConfig, bodyNode);
            });
        }

        return bodyNode;
    }

    // 2. Build Bodies Hierarchy
    if (config.planets && config.planets.length > 0) {
        config.planets.forEach(pConfig => {
            buildCelestialNode(pConfig, systemGroup);
        });
    } else {
        // Fallback for single star + planet setup
        const defaultStar = createExoplanet(null, {
            name: `${name} Host Star`,
            radius: starRadius,
            color: starColor,
            isStar: true,
            x: -starOffset * 0.1
        });
        defaultStar.worldPosition = new THREE.Vector3();
        systemGroup.add(defaultStar);
        allChildNodes.push(defaultStar);

        const defaultPlanetConfig = {
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
        };

        buildCelestialNode(defaultPlanetConfig, systemGroup);
    }

    // 📍 Root Setup
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
        targets: allChildNodes // Exposes sub-targets to pilot & HUD
    };

    // 🔄 Real-Time System Update Loop
    const updateRoutine = (delta = 1) => {
        // Rotate orbital pivots
        orbitalPivots.forEach(item => {
            item.pivot.rotation.y += item.speed * delta;
            if (item.node && item.node.onUpdate) {
                item.node.onUpdate(delta);
            }

            // 🌟 CRITICAL FIX: Continuously sync absolute world position for HUD & Pilot
            if (item.node && item.node.worldPosition) {
                item.node.getWorldPosition(item.node.worldPosition);
                item.node.userData.x = item.node.worldPosition.x;
                item.node.userData.y = item.node.worldPosition.y;
                item.node.userData.z = item.node.worldPosition.z;
            }
        });
    };

    systemGroup.onUpdate = updateRoutine;
    systemGroup.update = updateRoutine;

    if (scene && typeof scene.add === 'function') {
        scene.add(systemGroup);
    }

    return systemGroup;
}
