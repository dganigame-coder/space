import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Single Star Factory (Returns a THREE.Group)
 */
export function createStar(scene, config = {}) {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();

    // ⚙️ Extract Parameters
    const starName = config.name || 'Unknown Star';
    const radius = config.radius || config.r || 60000;
    const segments = config.segments || 64;

    const posX = config.x || 0;
    const posY = config.y || 0;
    const posZ = config.z || 0;

    const rotationSpeed = config.rotationSpeed ?? 0.002;
    
    // Guaranteed THREE.Color instance (Tints the sun texture!)
    const mainColorHex = config.color !== undefined ? config.color : 0xffcc33;
    const mainColor = new THREE.Color(mainColorHex);

    // 1. Surface Material & Mesh (Basic Material emits its own visual light)
    const starMat = new THREE.MeshBasicMaterial({
        map: loader.load(config.textureMap || 'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_sun.jpg'),
        color: mainColor 
    });
    
    const starGeo = new THREE.SphereGeometry(radius, segments, segments);
    const starBody = new THREE.Mesh(starGeo, starMat);
    starBody.name = "starBody";
    group.add(starBody);

    // 2. Stellar Corona / Halo (Fresnel Shader for the glowing edge)
    const coronaColorHex = config.coronaColor || mainColorHex;
    const coronaGeo = new THREE.SphereGeometry(radius * 1.15, segments, segments);

    const coronaMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            uniform vec3 color;
            uniform float opacity;
            void main() {
                // Intense falloff for a glowing star edge
                float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = vec4(color, 1.0) * intensity * opacity;
            }
        `,
        uniforms: {
            color: { value: new THREE.Color(coronaColorHex) },
            opacity: { value: config.coronaOpacity ?? 0.8 }
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    });

    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.name = "starCorona";
    group.add(coronaMesh);

    // 3. Actual Light Source (Illuminates ships/planets nearby)
    if (config.castLight !== false) {
        const starLight = new THREE.PointLight(mainColorHex, config.lightIntensity || 3, config.lightRange || radius * 50);
        starLight.name = "starLight";
        group.add(starLight);
    }

    // 📍 Setup Group Position and Attributes
    group.name = `${starName}_Group`;
    group.position.set(posX, posY, posZ);

    // 🛡️ Decorate Group directly for pilot.js & HUD compatibility
    group.r = radius;
    group.radius = radius;
    group.color = mainColor;
    group.material = starMat;
    
    group.userData = {
        type: 'star',
        name: starName,
        radius: radius,
        r: radius,
        color: mainColor
    };

    // 🔄 Unified Update Loop
    const updateRoutine = (delta = 1) => {
        if (starBody) starBody.rotation.y += rotationSpeed * delta;
    };

    group.onUpdate = updateRoutine;
    group.update = updateRoutine; 

    if (scene && typeof scene.add === 'function') {
        scene.add(group);
    }

    return group;
}
