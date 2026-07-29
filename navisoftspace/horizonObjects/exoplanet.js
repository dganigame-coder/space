import * as THREE from 'three';

export function createExoplanet(scene, config ) {
    const loader = new THREE.TextureLoader();

    // Fallbacks and customizable properties
    const planetName = config.name || 'Exoplanet';
    const radius = config.radius || 600;
    const segments = config.segments || 64; // Optimized poly-count (configurable)
    const atmosColor = config.atmosColor ?? 0x00ffff;
    
    // Rotation speeds (rad/frame)
    const bodyRotationSpeed = config.rotationSpeed ?? 0.001;
    const cloudRotationSpeed = config.cloudSpeed ?? 0.0014; // Clouds drift slightly faster

    // Main Container Group for the Planet Cluster
    const planetGroup = new THREE.Group();
    planetGroup.name = planetName;
    planetGroup.position.set(config.x || 0, config.y || 0, config.z || 0);
    planetGroup.userData = {
        type: 'planet_container',
        name: planetName
    };

    // --- 1. TERRAIN (Solid Surface) ---
    const planetGeo = new THREE.SphereGeometry(radius, segments, segments); 
    const planetMat = new THREE.MeshStandardMaterial({ 
        map: loader.load(config.textureMap || 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
        normalMap: loader.load(config.normalMap || 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
        normalScale: new THREE.Vector2(1.5, 1.5), 
        roughnessMap: loader.load(config.roughnessMap || 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
        roughness: config.roughness ?? 0.6
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
    let clouds = null;
    if (config.hasClouds !== false) {
        const cloudGeo = new THREE.SphereGeometry(radius * 1.015, segments, segments);
        const cloudMat = new THREE.MeshStandardMaterial({
            map: loader.load(config.cloudMap || 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png'),
            transparent: true,
            opacity: config.cloudOpacity ?? 0.8,
            blending: THREE.NormalBlending, // Fixed: Normal blending stops clouds from glowing on dark night side
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

    // --- 3. FRESNEL HALO (Glow Effect) ---
    let planetHalo = null;
    if (config.hasAtmosphere !== false) {
        const atmosGeo = new THREE.SphereGeometry(radius * 1.04, segments, segments);
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

    // Convenience property assignments on group
    planetGroup.planetBody = planetBody;
    planetGroup.clouds = clouds;
    planetGroup.planetHalo = planetHalo;

    // Automatically attach to scene if provided
    if (scene && typeof scene.add === 'function') {
        scene.add(planetGroup);
    }

    // Return direct references + helper methods
    return {
        planetGroup,
        planetBody,
        clouds,
        planetHalo,

        // 🎯 Forwards target.position directly to planetGroup.position vector
        get position() {
            return planetGroup.position;
        },

        // 🔄 Call inside your requestAnimationFrame loop to spin the planet & clouds
        update(delta = 1) {
            if (planetBody) planetBody.rotation.y += bodyRotationSpeed * delta;
            if (clouds) clouds.rotation.y += cloudRotationSpeed * delta;
        },

        // 🧹 Call when removing the planet to clean up WebGL GPU memory
        dispose() {
            if (scene) scene.remove(planetGroup);
            [planetBody, clouds, planetHalo].forEach(mesh => {
                if (!mesh) return;
                mesh.geometry.dispose();
                if (mesh.material) {
                    if (mesh.material.map) mesh.material.map.dispose();
                    if (mesh.material.normalMap) mesh.material.normalMap.dispose();
                    if (mesh.material.roughnessMap) mesh.material.roughnessMap.dispose();
                    mesh.material.dispose();
                }
            });
        }
    };
}
