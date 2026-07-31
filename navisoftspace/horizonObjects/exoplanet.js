import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Single Exoplanet Factory
 */
export function createExoplanet(scene, config = {}) {
    const loader = new THREE.TextureLoader();

    const planetName = config.name || 'Exoplanet';
    const radius = config.radius || config.r || 600;
    const segments = config.segments || 64;
    
    const posX = config.x || 0;
    const posY = config.y || 0;
    const posZ = config.z || 0;

    const bodyRotationSpeed = config.rotationSpeed ?? 0.001;
    const cloudRotationSpeed = config.cloudSpeed ?? 0.0014;

    // Guaranteed THREE.Color instance with .r, .g, .b
    const mainColor = new THREE.Color(config.color !== undefined ? config.color : 0xffffff);

    // Surface Material
    const matOptions = {
        roughness: config.roughness ?? 0.6,
        metalness: config.metalness ?? 0.1
    };

    if (config.color !== undefined) {
        matOptions.color = mainColor;
    } else {
        matOptions.map = loader.load(config.textureMap || 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
        matOptions.normalMap = loader.load(config.normalMap || 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg');
        matOptions.normalScale = new THREE.Vector2(1.5, 1.5);
        matOptions.roughnessMap = loader.load(config.roughnessMap || 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg');
    }

    const planetMat = new THREE.MeshStandardMaterial(matOptions);
    const planetGeo = new THREE.SphereGeometry(radius, segments, segments);
    const planetBody = new THREE.Mesh(planetGeo, planetMat);
    planetBody.name = "planetBody";
    planetBody.r = radius;
    planetBody.radius = radius;
    planetBody.color = mainColor;

    // Main Group Container
    const planetGroup = new THREE.Group();
    planetGroup.name = `${planetName}_Group`;
    planetGroup.position.set(posX, posY, posZ);

    // Decorate Group container so pilot.js scene traversals won't fail
    planetGroup.r = radius;
    planetGroup.radius = radius;
    planetGroup.color = mainColor;
    planetGroup.material = planetMat;
    planetGroup.userData = {
        type: 'planet_container',
        name: planetName,
        radius: radius,
        r: radius
    };

    planetGroup.add(planetBody);

    // Clouds
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
        clouds.r = radius * 1.02;
        clouds.radius = radius * 1.02;
        clouds.color = mainColor;
        planetGroup.add(clouds);
    }

    // Atmosphere Halo
    let planetHalo = null;
    if (config.hasAtmosphere !== false) {
        const atmosColorHex = config.atmosColor || 0x00ffff;
        const atmosColorObj = new THREE.Color(atmosColorHex);
        const atmosGeo = new THREE.SphereGeometry(radius * 1.05, segments, segments);
        const atmosMat = new THREE.MeshBasicMaterial({
            color: atmosColorHex,
            transparent: true,
            opacity: config.atmosOpacity ?? 0.25,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });
        planetHalo = new THREE.Mesh(atmosGeo, atmosMat);
        planetHalo.name = "planetHalo";
        planetHalo.r = radius * 1.05;
        planetHalo.radius = radius * 1.05;
        planetHalo.color = atmosColorObj;
        planetGroup.add(planetHalo);
    }

    if (scene && typeof scene.add === 'function') {
        scene.add(planetGroup);
    }

    return {
        name: planetName,
        planetGroup,
        planetBody,
        clouds,
        planetHalo,
        
        mesh: planetBody,
        planet: planetBody,
        material: planetMat,
        
        radius: radius,
        r: radius,
        color: mainColor,

        get position() { return planetGroup.position; },
        get rotation() { return planetGroup.rotation; },

        traverse(callback) {
            if (planetGroup && typeof planetGroup.traverse === 'function') {
                planetGroup.traverse(callback);
            }
        },
        getObjectByName(name) {
            return planetGroup ? planetGroup.getObjectByName(name) : null;
        },

        update(delta = 1) {
            if (planetBody) planetBody.rotation.y += bodyRotationSpeed * delta;
            if (clouds) clouds.rotation.y += cloudRotationSpeed * delta;
        }
    };
}

export const createExoplanetSystem = createExoplanet;
