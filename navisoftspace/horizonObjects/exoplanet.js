import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Single Exoplanet Factory
 * Builds 1 detailed planet with customizable surface, clouds, and atmosphere.
 */
export function createExoplanet(scene, config = {}) {
    const loader = new THREE.TextureLoader();

    // Config fallbacks
    const planetName = config.name || 'Exoplanet';
    const radius = config.radius || 600;
    const segments = config.segments || 64; // Performance-optimized polycount
    
    const posX = config.x || 0;
    const posY = config.y || 0;
    const posZ = config.z || 0;

    // Rotation speeds
    const bodyRotationSpeed = config.rotationSpeed ?? 0.001;
    const cloudRotationSpeed = config.cloudSpeed ?? 0.0014;

    // Main Container Group
    const planetGroup = new THREE.Group();
    planetGroup.name = `${planetName}_Group`;
    planetGroup.position.set(posX, posY, posZ);
    planetGroup.userData = {
        type: 'planet_container',
        name: planetName
    };

    // --- 1. TERRAIN / SURFACE ---
    const planetGeo = new THREE.SphereGeometry(radius, segments, segments);
    
    // Build material dynamically based on whether a solid color or texture map is passed
    const matOptions = {
        roughness: config.roughness ?? 0.6,
        metalness: config.metalness ?? 0.1
    };

    if (config.color !== undefined) {
        // Custom solid color (e.g. Pink for GJ 504b)
        matOptions.color = new THREE.Color(config.color);
    } else {
        // Fallback to 4K/2K textures
        matOptions.map = loader.load(config.textureMap || 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
        matOptions.normalMap = loader.load(config.normalMap || 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg');
        matOptions.normalScale = new THREE.Vector2(1.5, 1.5);
        matOptions.roughnessMap = loader.load(config.roughnessMap || 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg');
    }

    const planetMat = new THREE.MeshStandardMaterial(matOptions);
    const planetBody = new THREE.Mesh(planetGeo, planetMat);
    planetBody.name = "planetBody";
    planetBody.userData = {
        type: config.type || 'exoplanet_body',
        name: `${planetName} Prime`,
        state: config.state || (config.color ? 'gas' : 'solid')
    };
    planetGroup.add(planetBody);

    // --- 2. CLOUDS (Optional) ---
    let clouds = null;
    if (config.hasClouds !== false) {
        const cloudGeo = new THREE.SphereGeometry(radius * 1.02, segments, segments);
        const cloudMat = new THREE.MeshStandardMaterial({
            map: loader.load(config.cloudMap || 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png'),
            transparent: true,
            opacity: config.cloudOpacity ?? 0.7,
            blending: THREE.NormalBlending,
            depthWrite: false
        });
        clouds = new THREE.Mesh(cloudGeo, cloudMat);
        clouds.name = "planetClouds";
        clouds.userData = {
            type: 'atmosphere',
            name: `${planetName} Clouds`,
            state: 'gas'
        };
        planetGroup.add(clouds);
    }

    // --- 3. ATMOSPHERE HALO (Optional) ---
    let planetHalo = null;
    if (config.hasAtmosphere !== false) {
        const atmosColor = config.atmosColor || 0x00ffff;
        const atmosGeo = new THREE.SphereGeometry(radius * 1.05, segments, segments);
        const atmosMat = new THREE.MeshBasicMaterial({
            color: atmosColor,
            transparent: true,
            opacity: config.atmosOpacity ?? 0.25,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });
        planetHalo = new THREE.Mesh(atmosGeo, atmosMat);
        planetHalo.name = "planetHalo";
        planetHalo.userData = {
            type: 'fresnel_glow',
            name: `${planetName} Outer Halo`,
            state: 'gas'
        };
        planetGroup.add(planetHalo);
    }

    // Auto-add to scene if scene reference was provided
    if (scene && typeof scene.add === 'function') {
        scene.add(planetGroup);
    }

    // Convenience property attachments
    planetGroup.planetBody = planetBody;
    planetGroup.clouds = clouds;
    planetGroup.planetHalo = planetHalo;

    return {
        planetGroup,
        planetBody,
        clouds,
        planetHalo,
        get position() {
            return planetGroup.position;
        },
        update(delta = 1) {
            if (planetBody) planetBody.rotation.y += bodyRotationSpeed * delta;
            if (clouds) clouds.rotation.y += cloudRotationSpeed * delta;
        }
    };
}

// 🎯 Safe Alias: Prevents existing calls to createExoplanetSystem from breaking during refactoring
export const createExoplanetSystem = createExoplanet;
