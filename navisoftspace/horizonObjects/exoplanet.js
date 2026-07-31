import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Single Exoplanet Factory (Returns a THREE.Group)
 */
export function createExoplanet(scene, config = {}) {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();

    // ⚙️ Extract Parameters
    const planetName = config.name || 'Exoplanet';
    const radius = config.radius || config.r || 600;
    const segments = config.segments || 64;

    const posX = config.x || 0;
    const posY = config.y || 0;
    const posZ = config.z || 0;

    const bodyRotationSpeed = config.rotationSpeed ?? 0.001;
    const cloudRotationSpeed = config.cloudSpeed ?? 0.0014;

    // Guaranteed THREE.Color instance
    const mainColor = new THREE.Color(config.color !== undefined ? config.color : 0xffffff);

    // 1. Surface Material & Mesh
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
    group.add(planetBody);

    // 2. Clouds Layer
    let cloudsMesh = null;
    if (config.hasClouds !== false) {
        const cloudGeo = new THREE.SphereGeometry(radius * 1.02, segments, segments);
        const cloudMat = new THREE.MeshStandardMaterial({
            map: loader.load(config.cloudMap || 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png'),
            transparent: true,
            opacity: config.cloudOpacity ?? 0.7,
            blending: THREE.NormalBlending,
            depthWrite: false
        });
        cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
        cloudsMesh.name = "planetClouds";
        group.add(cloudsMesh);
    }

    // 3. Atmosphere Halo
    let haloMesh = null;
    if (config.hasAtmosphere !== false) {
        const atmosColorHex = config.atmosColor || 0x00ffff;
        const atmosGeo = new THREE.SphereGeometry(radius * 1.05, segments, segments);
        const atmosMat = new THREE.MeshBasicMaterial({
            color: atmosColorHex,
            transparent: true,
            opacity: config.atmosOpacity ?? 0.25,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });
        haloMesh = new THREE.Mesh(atmosGeo, atmosMat);
        haloMesh.name = "planetHalo";
        group.add(haloMesh);
    }

    // 📍 Setup Group Position and Attributes
    group.name = `${planetName}_Group`;
    group.position.set(posX, posY, posZ);

    // 🛡️ Decorate Group directly for pilot.js & HUD compatibility
    group.r = radius;
    group.radius = radius;
    group.color = mainColor;
    group.material = planetMat;
    
    group.userData = {
        type: 'exoplanet',
        name: planetName,
        radius: radius,
        r: radius,
        color: mainColor
    };

    // 🔄 Unified Update Loop
    const updateRoutine = (delta = 1) => {
        if (planetBody) planetBody.rotation.y += bodyRotationSpeed * delta;
        if (cloudsMesh) cloudsMesh.rotation.y += cloudRotationSpeed * delta;
    };

    group.onUpdate = updateRoutine;
    group.update = updateRoutine; // Support both naming styles

    if (scene && typeof scene.add === 'function') {
        scene.add(group);
    }

    return group;
}
