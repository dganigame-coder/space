import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';

export function createExoplanetSystem(scene, config) {
    const systemGroup = new THREE.Group();
    const loader = new THREE.TextureLoader();

    // --- 1. THE STAR (Proxima Substitute) ---
    const starGeo = new THREE.SphereGeometry(5000, 64, 64);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const star = new THREE.Mesh(starGeo, starMat);
    systemGroup.add(star);

    // POINT LIGHT: The "Engine" of the system's visuals
    const sunLight = new THREE.PointLight(0xffffff, 4, 150000); // Increased intensity for 4K pop
    systemGroup.add(sunLight);

    // --- 2. THE EXOPLANET (The 4K World) ---
    const planetGroup = new THREE.Group();
    
    // LAYER A: THE TERRAIN (Pixel-Perfect Detail)
    const planetGeo = new THREE.SphereGeometry(600, 128, 128); 
    const planetMat = new THREE.MeshStandardMaterial({ 
        map: loader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
        normalMap: loader.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
        normalScale: new THREE.Vector2(2.0, 2.0), // Deeper mountain shadows
        roughnessMap: loader.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
        roughness: 0.6
    }); 
    const planetBody = new THREE.Mesh(planetGeo, planetMat);
    planetBody.name = "planetBody";
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
    clouds.name = "planetClouds";
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
    planetGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

    // POSITION THE PLANET WITHIN THE SYSTEM
    planetGroup.position.x = 30000; // Comfortable distance from the star
    planetGroup.name = "exoplanetPivot";
    systemGroup.add(planetGroup);

    // GLOBAL POSITIONING
    systemGroup.position.set(config.x, config.y, config.z);
    scene.add(systemGroup);
    
    return systemGroup;
}
