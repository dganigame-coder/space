import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Single Exoplanet / Star Factory (Returns a THREE.Group)
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

    // Detect if this object should behave as a luminous star
    const isStar = config.isStar ?? planetName.toLowerCase().includes('star');

    const bodyRotationSpeed = config.rotationSpeed ?? 0.001;
    const cloudRotationSpeed = config.cloudSpeed ?? 0.0014;

    // Guaranteed THREE.Color instance
    const mainColor = new THREE.Color(config.color !== undefined ? config.color : 0xffffff);

    // 1. Surface Material & Mesh Construction
    let planetMat;

    if (isStar) {
        // 🌟 STAR MATERIAL: Self-luminous with strong emissive output
        planetMat = new THREE.MeshStandardMaterial({
            color: mainColor,
            emissive: mainColor,
            emissiveIntensity: config.emissiveIntensity ?? 0.8,
            roughness: 0.2,
            metalness: 0.0
        });

        // Attach point light inside star mesh to cast illumination
        const starLight = new THREE.PointLight(
            mainColor, 
            config.lightIntensity ?? 3.5, 
            config.lightDistance ?? (radius * 150)
        );
        starLight.name = `${planetName}_Light`;
        group.add(starLight);

    } else {
        // 🪐 PLANET MATERIAL: Standard PBR shading
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

        planetMat = new THREE.MeshStandardMaterial(matOptions);
    }

    const planetGeo = new THREE.SphereGeometry(radius, segments, segments);
    const planetBody = new THREE.Mesh(planetGeo, planetMat);
    planetBody.name = "planetBody";
    group.add(planetBody);

    // 2. Clouds Layer (Planets only)
    let cloudsMesh = null;
    if (!isStar && config.hasClouds !== false) {
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

    // 3. Atmosphere Halo (Hyper-Realistic Fresnel Shader with Dynamic Camera View-Space)
    let haloMesh = null;
    if (!isStar && config.hasAtmosphere !== false) {
        const atmosColorHex = config.atmosColor || 0x00ffff;
        const atmosGeo = new THREE.SphereGeometry(radius * 1.12, segments, segments);

        const atmosMat = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                uniform vec3 color;
                uniform float opacity;
                void main() {
                    // Calculate view direction dynamically from camera to fragment
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    
                    // Smooth atmosphere edge falloff calculation
                    float intensity = pow(0.7 - dot(vNormal, viewDir), 2.0);
                    intensity = clamp(intensity, 0.0, 1.0);

                    gl_FragColor = vec4(color, 1.0) * intensity * opacity;
                }
            `,
            uniforms: {
                color: { value: new THREE.Color(atmosColorHex) },
                opacity: { value: config.atmosOpacity ?? 0.6 }
            },
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });

        haloMesh = new THREE.Mesh(atmosGeo, atmosMat);
        haloMesh.name = "planetHalo";
        haloMesh.r = radius * 1.12;
        haloMesh.radius = radius * 1.12;
        haloMesh.color = new THREE.Color(atmosColorHex);
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
        type: isStar ? 'star' : 'exoplanet',
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
