import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Creates a standalone exoplanet entity (Terrain + Clouds + Halo Glow)
 * @param {Object} config - Configuration options for textures, radius, and positioning
 * @returns {Object} References to { planetGroup, planetBody, clouds, planetHalo }
 */
export function createExoplanet(config = {}) {
    const loader = new THREE.TextureLoader();

    // Fallbacks and customizable properties
    const planetName = config.name || 'Exoplanet';
    const radius = config.radius || 600;
    const atmosColor = config.atmosColor || 0x00ffff;
    
    // Main Container Group for the Planet Cluster
    const planetGroup = new THREE.Group();
    planetGroup.name = planetName;
    planetGroup.position.set(config.x || 0, config.y || 0, config.z || 0);
    planetGroup.userData = {
        type: 'planet_container',
        name: planetName
    };

    // --- 1. TERRAIN (Solid Surface) ---
    const planetGeo = new THREE.SphereGeometry(radius, 128, 128); 
    const planetMat = new THREE.MeshStandardMaterial({ 
        map: loader.load(config.textureMap || 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
        normalMap: loader.load(config.normalMap || 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
        normalScale: new THREE.Vector2(2.0, 2.0), 
        roughnessMap: loader.load(config.roughnessMap || 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
        roughness: 0.6
    }); 
    const planetBody = new THREE.Mesh(planetGeo, planetMat);
    planetBody.name = "planetBody";
    planetBody.userData = {
        type: 'exoplanet_body',
        name: `${planetName} Prime`,
        state: 'solid'
    };
    planetGroup.add(planetBody);

    // --- 2. CLOUDS (Atmosphere Layer) ---
    const cloudGeo = new THREE.SphereGeometry(radius * 1.03, 128, 128);
    const cloudMat = new THREE.MeshStandardMaterial({
        map: loader.load(config.cloudMap || 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png'),
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    clouds.name = "planetClouds";
    clouds.userData = {
        type: 'atmosphere',
        name: `${planetName} Clouds`,
        state: 'gas'
    };
    planetGroup.add(clouds);

    // --- 3. FRESNEL HALO (Glow Effect) ---
    const atmosGeo = new THREE.SphereGeometry(radius * 1.058, 128, 128);
    const atmosMat = new THREE.MeshBasicMaterial({
        color: atmosColor,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
    });
    const planetHalo = new THREE.Mesh(atmosGeo, atmosMat);
    planetHalo.name = "planetHalo";
    planetHalo.userData = {
        type: 'fresnel_glow',
        name: `${planetName} Outer Halo`,
        state: 'gas'
    };
    planetGroup.add(planetHalo);

    // Convenience property assignments on group
    planetGroup.planetBody = planetBody;
    planetGroup.clouds = clouds;
    planetGroup.planetHalo = planetHalo;

    // Return direct references to eliminate 'undefined' issues in loop
    return {
        planetGroup,
        planetBody,
        clouds,
        planetHalo
    };
}
