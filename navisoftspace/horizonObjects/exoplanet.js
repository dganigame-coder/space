import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createExoplanetSystem(scene, config) {
    const systemGroup = new THREE.Group();
    const loader = new THREE.TextureLoader();

    // 🎯 Gather configuration fallbacks to keep the tracker loop happy
    const systemName = config.name || 'Proxima Centauri';
    const systemType = config.type || 'exoplanet';

    // Set standard properties on the primary system group anchor
    systemGroup.name = systemName;
    systemGroup.userData = {
        type: systemType,
        innerRadius: config.innerRadius || 0,
        outerRadius: config.outerRadius || 0,
        name: systemName
    };

    // --- 1. THE STAR (Proxima Substitute) ---
    const starGeo = new THREE.SphereGeometry(5000, 64, 64);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const star = new THREE.Mesh(starGeo, starMat);
    
    // 🎯 STAR IDENTITY LAYER: Named directly, flagged completely as Gas (Plasma)
    star.name = systemName + " Star";
    star.userData = {
        type: 'star',
        name: systemName,
        state: 'gas' // Stars are 100% gaseous plasma
    };
    systemGroup.add(star);

    // POINT LIGHT: The "Engine" of the system's visuals
    const sunLight = new THREE.PointLight(0xffffff, 4, 150000); 
    systemGroup.add(sunLight);

    // --- 2. THE EXOPLANET (The 4K World) ---
    const planetGroup = new THREE.Group();
    planetGroup.name = "exoplanetPivot";
    planetGroup.userData = {
        type: 'planet_container',
        name: 'Exoplanet Cluster'
    };
    
    // LAYER A: THE TERRAIN (Pixel-Perfect Detail)
    const planetGeo = new THREE.SphereGeometry(600, 128, 128); 
    const planetMat = new THREE.MeshStandardMaterial({ 
        map: loader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
        normalMap: loader.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
        normalScale: new THREE.Vector2(2.0, 2.0), 
        roughnessMap: loader.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
        roughness: 0.6
    }); 
    const planetBody = new THREE.Mesh(planetGeo, planetMat);
    
    // 🎯 PLANET BODY IDENTITY LAYER: Flagged explicitly as Solid rock/metal core
    planetBody.name = "planetBody";
    planetBody.userData = {
        type: 'exoplanet_body',
        name: systemName + ' Prime',
        state: 'solid' // Terrestrial planet surface is solid rock/crust
    };
    planetGroup.add(planetBody);

    // LAYER B: THE CLOUDS (Volumetric Atmosphere)
    const cloudGeo = new THREE.SphereGeometry(618, 128, 128);
    const cloudMat = new THREE.MeshStandardMaterial({
        map: loader.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png'),
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    
    // 🎯 CLOUD LAYER IDENTITY LAYER: Flagged completely as gas atmosphere
    clouds.name = "planetClouds";
    clouds.userData = {
        type: 'atmosphere',
        name: systemName + ' Clouds',
        state: 'gas' // Clouds and atmospheric layers are gas
    };
    planetGroup.add(clouds);

    // LAYER C: THE FRESNEL HALO (The Cyan Glow)
    const atmosGeo = new THREE.SphereGeometry(635, 128, 128);
    const atmosMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
    });
    const atmosHalo = new THREE.Mesh(atmosGeo, atmosMat);
    atmosHalo.name = "planetHalo";
    atmosHalo.userData = {
        type: 'fresnel_glow',
        name: systemName + ' Outer Halo',
        state: 'gas'
    };
    planetGroup.add(atmosHalo);

    // POSITION THE PLANET WITHIN THE SYSTEM
    planetGroup.position.x = 30000; 
    systemGroup.add(planetGroup);

    // GLOBAL POSITIONING
    systemGroup.position.set(config.x, config.y, config.z);
    scene.add(systemGroup);
    
    return systemGroup;
}
