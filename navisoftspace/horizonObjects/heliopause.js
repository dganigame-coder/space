import * as THREE from 'three';

// ============================================================================
// HELIOPAUSE SHADER MATERIAL
// ============================================================================

const HeliopauseShader = {
    uniforms: {
        uTime: { value: 0 },
        uRadius: { value: 0 },
        uColorInner: { value: new THREE.Color(0x0044ff) }, // Deep solar wind blue
        uColorOuter: { value: new THREE.Color(0xff22aa) }, // Interstellar shockwave magenta
        uOpacity: { value: 0.6 }
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

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;

        // 2D Random and Noise Functions for Plasma Turbulence
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        // Fractal Brownian Motion for rich, detailed turbulence
        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            vec2 shift = vec2(100.0);
            mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
            for (int i = 0; i < 5; ++i) { // 5 octaves of detail for 4K rendering
                v += a * noise(p);
                p = rot * p * 2.0 + shift;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            // 1. Calculate Fresnel (Rim Lighting)
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            
            // Invert the dot product because we are usually inside the heliopause looking out
            float rim = 1.0 - max(dot(viewDir, normal), 0.0);
            
            // Sharpen the rim to push the effect to the very edges of the sphere
            float smoothRim = smoothstep(0.5, 1.0, rim);
            float coreRim = pow(rim, 3.0); 

            // 2. Calculate Flowing Plasma Turbulence
            // Map world coordinates to UV to avoid pinching at the poles
            vec2 flowUv = vUv * 8.0; 
            flowUv.y -= uTime * 0.05; // Solar wind pushing outward
            flowUv.x += sin(uTime * 0.02) * 0.5; 

            float turbulence = fbm(flowUv + fbm(flowUv * 2.0));
            
            // 3. Color Mixing
            // Mix colors based on the turbulence and viewing angle
            vec3 plasmaColor = mix(uColorInner, uColorOuter, turbulence * coreRim);
            
            // Add high-energy bright spots where turbulence is highest at the edges
            vec3 highlight = vec3(1.0, 0.9, 1.0) * pow(turbulence, 3.0) * smoothRim * 0.5;

            // 4. Final Alpha Calculation
            // Base opacity modulated by the rim effect and noise
            float finalAlpha = (smoothRim + (turbulence * coreRim)) * uOpacity;

            gl_FragColor = vec4(plasmaColor + highlight, finalAlpha);
        }
    `
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createHeliopause(scene, config) {
    const radius = config.radius || 100000000;
    
    // Increased geometry resolution (from 4 to 128) for smooth 4K curvature
    const geometry = new THREE.SphereGeometry(radius, 128, 128); 
    
    const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(HeliopauseShader.uniforms),
        vertexShader: HeliopauseShader.vertexShader,
        fragmentShader: HeliopauseShader.fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        // Using BackSide assumes the camera is INSIDE the solar system looking out.
        // If the camera goes outside, use THREE.DoubleSide.
        side: THREE.BackSide, 
        depthWrite: false, // Prevents z-fighting with distant stars/galaxies
    });

    // Apply config values to uniforms
    material.uniforms.uRadius.value = radius;
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
