import * as THREE from 'three';

// ============================================================================
// HELIOPAUSE SHADER MATERIAL
// ============================================================================

const HeliopauseShader = {
    uniforms: {
        uTime: { value: 0 },
        uRadius: { value: 0 },
        uColorInner: { value: new THREE.Color(0x0044ff) }, 
        uColorOuter: { value: new THREE.Color(0xff22aa) }, 
        uOpacity: { value: 0.6 },
        // 🚀 NEW: How close the camera must be to the surface before it becomes visible
        uFadeDistance: { value: 50000000 } 
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uColorInner;
        uniform vec3 uColorOuter;
        uniform float uOpacity;
        uniform float uFadeDistance; // 🚀 Bring the uniform in

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
            float v = 0.0; float a = 0.5; vec2 shift = vec2(100.0);
            mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
            for (int i = 0; i < 5; ++i) { v += a * noise(p); p = rot * p * 2.0 + shift; a *= 0.5; }
            return v;
        }

        void main() {
            // 🚀 1. PROXIMITY CHECK (The core fix)
            // Measure distance from the camera to this exact pixel on the heliopause shell
            float distToCam = distance(cameraPosition, vWorldPosition);
            
            // If distance > uFadeDistance, proximityFade is 0.0 (invisible).
            // As distance approaches 0, proximityFade smoothly rises to 1.0.
            float proximityFade = 1.0 - smoothstep(0.0, uFadeDistance, distToCam);

            // 2. Fresnel (Rim Lighting)
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float rim = 1.0 - max(dot(viewDir, normal), 0.0);
            float smoothRim = smoothstep(0.5, 1.0, rim);
            float coreRim = pow(rim, 3.0); 

            // 3. Flowing Plasma
            vec2 flowUv = vUv * 8.0; 
            flowUv.y -= uTime * 0.05; 
            flowUv.x += sin(uTime * 0.02) * 0.5; 
            float turbulence = fbm(flowUv + fbm(flowUv * 2.0));
            
            // 4. Tone down the intense glowing colors
            vec3 plasmaColor = mix(uColorInner, uColorOuter, turbulence * coreRim);
            vec3 highlight = vec3(1.0, 0.9, 1.0) * pow(turbulence, 3.0) * smoothRim * 0.3; // Lowered from 0.5

            // 🚀 5. Apply the Proximity Fade to the final Alpha
            float finalAlpha = (smoothRim + (turbulence * coreRim)) * uOpacity * proximityFade;

            // Discard the pixel entirely if alpha is 0 to save massive amounts of GPU rendering power
            if (finalAlpha <= 0.01) discard;

            gl_FragColor = vec4(plasmaColor + highlight, finalAlpha);
        }
    `
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createHeliopause(scene, config) {
    const radius = config.radius || 100000000;
    // Set fade distance to 15% of the radius if not provided
    const fadeDistance = config.fadeDistance || (radius * 0.15); 
    
    const geometry = new THREE.SphereGeometry(radius, 128, 128); 
    
    const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(HeliopauseShader.uniforms),
        vertexShader: HeliopauseShader.vertexShader,
        fragmentShader: HeliopauseShader.fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide, 
        depthWrite: false, 
    });

    // Bind uniforms
    material.uniforms.uRadius.value = radius;
    material.uniforms.uFadeDistance.value = fadeDistance; // 🚀 Bind the new uniform
    if (config.colorInner) material.uniforms.uColorInner.value.setHex(config.colorInner);
    if (config.colorOuter) material.uniforms.uColorOuter.value.setHex(config.colorOuter);
    if (config.opacity !== undefined) material.uniforms.uOpacity.value = config.opacity;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; 

   mesh.userData = {
        type: 'heliopause',
        // Pass these in via config, or use default fallback text
        name: config.name || 'The Heliopause', 
        description: config.description || 'The theoretical boundary where the Sun\'s solar wind is stopped by the interstellar medium.',
        
        update: (elapsedTime) => {
            material.uniforms.uTime.value = elapsedTime;
            mesh.rotation.y = elapsedTime * 0.005;
            mesh.rotation.z = elapsedTime * 0.002;
        }
    };

    if (scene) scene.add(mesh);
    
    return mesh;
}
