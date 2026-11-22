import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ==========================================
// 🎨 GLOBAL ASSETS (Memory Optimization)
// ==========================================

// Create the procedural glow canvas only ONCE per application load.
// All stars will share this single texture in GPU memory.
function createProceduralGlow() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
}

const sharedGlowTexture = createProceduralGlow();
const textureLoader = new THREE.TextureLoader(); // Shared loader instance

// ==========================================
// ⭐ STAR FACTORY
// ==========================================

/**
 * Single Star Factory (Returns a THREE.Group)
 * @param {THREE.Scene} scene - The main scene to attach the star to.
 * @param {Object} config - Configuration parameters for the star.
 */
export function createStar(scene, config = {}) {
    const group = new THREE.Group();

    // ⚙️ Extract Parameters
    const starName = config.name || 'Unknown Star';
    const radius = config.radius || config.r || 60000;
    const segments = config.segments || 64;

    const posX = config.x || 0;
    const posY = config.y || 0;
    const posZ = config.z || 0;

    const rotationSpeed = config.rotationSpeed ?? 0.002;
    
    // Guaranteed THREE.Color instance
    const mainColorHex = config.color !== undefined ? config.color : 0xffcc33;
    const mainColor = new THREE.Color(mainColorHex);

    // 1. Surface Material & Mesh
    const starMat = new THREE.MeshBasicMaterial({
        map: textureLoader.load(config.textureMap || 'https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_sun.jpg'),
        color: mainColor 
    });
    
    const starGeo = new THREE.SphereGeometry(radius, segments, segments);
    const starBody = new THREE.Mesh(starGeo, starMat);
    starBody.name = "starBody";
    group.add(starBody);

    // 2. Stellar Corona / Halo (Fresnel Shader)
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
                // vNormal.z is mathematically equivalent to dot(vNormal, vec3(0,0,1)) but slightly cheaper
                float intensity = pow(0.55 - vNormal.z, 2.0);
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

    // 3. Deep Space Optical Glow (Sprite for AU visibility)
    const glowMaterial = new THREE.SpriteMaterial({
        map: sharedGlowTexture,
        color: mainColorHex,
        transparent: true,
        opacity: config.glowOpacity || 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false // Prevents clipping with exoplanets
    });

    const starGlow = new THREE.Sprite(glowMaterial);
    const glowScale = radius * 15; // Makes the glow massive compared to the physical body
    starGlow.scale.set(glowScale, glowScale, 1);
    starGlow.name = "starGlow";
    group.add(starGlow);

    // 4. Actual Light Source (Illuminates ships/planets nearby)
    if (config.castLight !== false) {
        const starLight = new THREE.PointLight(
            mainColorHex, 
            config.lightIntensity || 3, 
            config.lightRange || radius * 50
        );
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
        // Sprites auto-face the camera, so starGlow requires no rotation logic here
    };

    group.onUpdate = updateRoutine;
    group.update = updateRoutine; 

    // Auto-attach to scene if provided
    if (scene && typeof scene.add === 'function') {
        scene.add(group);
    }

    return group;
}
