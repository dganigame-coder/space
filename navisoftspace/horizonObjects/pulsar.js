import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createPulsar(scene = null, config = {}) {
    const group = new THREE.Group();

    const x = config.x ?? 0;
    const y = config.y ?? 0;
    const z = config.z ?? 0;
    const baseRadius = config.radius ?? 4000;

    group.position.set(x, y, z);

    // 1. INNER SPIN RIG
    const spinRig = new THREE.Group();
    group.add(spinRig);

    // 2. MAGNETIC RIG (Tilted just like the GIF)
    const magneticRig = new THREE.Group();
    magneticRig.rotation.z = Math.PI * 0.2; // ~36 degree tilt
    spinRig.add(magneticRig);

    // --- SHARED HIGH-PRECISION NOISE (Mobile Safe) ---
    const fbmNoise = `
        precision highp float;
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            float n_ = 0.142857142857;
            vec3 ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            return 42.0 * dot(vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)), vec4(1.0));
        }
    `;

    // ------------------------------------------------------------------------
    // 3. CORE (Glowing Purple-White Orb)
    // ------------------------------------------------------------------------
    const coreGeo = new THREE.SphereGeometry(baseRadius, 64, 64);
    const coreMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            precision highp float;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                
                float rim = 1.0 - max(dot(viewDir, normal), 0.0);
                float glow = smoothstep(0.0, 1.0, rim);
                
                vec3 coreColor = vec3(1.0, 1.0, 1.0); // Blinding white center
                vec3 edgeColor = vec3(0.5, 0.2, 0.9); // Deep violet edge
                
                vec3 finalColor = mix(coreColor, edgeColor, pow(glow, 3.0));
                gl_FragColor = vec4(finalColor * 2.0, 1.0);
            }
        `
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core); 

    // ------------------------------------------------------------------------
    // 4. VOLUMETRIC DUST BEAMS (The majestic light shafts from the GIF)
    // ------------------------------------------------------------------------
    const jetLength = baseRadius * 120; // Extremely long beams
    
    // Very wide at the top, tight at the bottom to match the volumetric cone look
    const jetGeo = new THREE.CylinderGeometry(baseRadius * 20.0, baseRadius * 0.5, jetLength, 64, 1, true);
    jetGeo.translate(0, jetLength / 2, 0);

    const jetMat = new THREE.ShaderMaterial({
        uniforms: { 
            uTime: { value: 0 },
            uViewVector: { value: new THREE.Vector3() } 
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldNormal;
            void main() {
                vUv = uv;
                vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            ${fbmNoise}
            uniform float uTime;
            uniform vec3 uViewVector;
            varying vec2 vUv;
            varying vec3 vWorldNormal;

            void main() {
                // 1. Length and Edge fading (Creates the soft "spotlight" cone)
                // vUv.y is 0 at the star, 1 at the far tip
                float lengthFade = pow(1.0 - vUv.y, 2.0); 
                float edgeFade = pow(sin(vUv.x * 3.14159265), 3.0); // Soft, blurred edges
                
                // 2. Simulated Illuminated Space Dust
                // Slow moving noise to look like cosmic dust caught in the headlight
                vec3 noiseCoord = vec3(vUv.x * 15.0, vUv.y * 5.0 - uTime * 0.5, uTime * 0.2);
                float rawNoise = snoise(noiseCoord) * 0.5 + 0.5;
                float dust = max(rawNoise, 0.0); // Clamp for mobile safety
                
                // Keep the dust subtle, mostly acting as a texture multiplier
                float beamDensity = edgeFade * lengthFade * mix(0.6, 1.0, dust);
                
                // 3. GIF Color Palette
                vec3 coreGlow = vec3(1.0, 0.9, 1.0);   // White-pink hot center
                vec3 midGlow = vec3(0.6, 0.4, 0.9);    // Lavender/Purple
                vec3 outerGlow = vec3(0.1, 0.0, 0.3);  // Deep indigo void
                
                // Mix colors based on how dense the beam is at this pixel
                vec3 finalColor = mix(outerGlow, midGlow, beamDensity * 2.0);
                finalColor = mix(finalColor, coreGlow, pow(beamDensity, 3.0) * 2.5);
                
                // 4. Lighthouse Flash
                // Flares up slightly when pointed directly at the camera
                float viewDot = max(dot(vWorldNormal, uViewVector), 0.0);
                float flash = pow(viewDot, 10.0) * 2.0; 
                
                // Final output (Additive Blending requires pre-multiplied alpha style)
                float alpha = (beamDensity + flash * lengthFade) * 0.8;
                gl_FragColor = vec4(finalColor + (vec3(0.8, 0.6, 1.0) * flash), alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending, // Crucial for volumetric light
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const northJet = new THREE.Mesh(jetGeo, jetMat);
    const southJet = new THREE.Mesh(jetGeo, jetMat);
    southJet.rotation.z = Math.PI;

    magneticRig.add(northJet);
    magneticRig.add(southJet);

    // ------------------------------------------------------------------------
    // 5. UPDATE LOOP
    // ------------------------------------------------------------------------
    group.userData = {
        type: 'pulsar',
        name: config.name || 'Pulsar',
        category: 'PULSATING NEUTRON STAR',
        
        update(time, camera = null) {
            // Smooth, sweeping rotation (adjusted speed to match the majestic GIF feel)
            spinRig.rotation.y = time * 3.5; 
            
            // Sync time to shaders for the dust movement
            jetMat.uniforms.uTime.value = time;

            // Sync the camera vector for the flash
            if (camera) {
                const viewVec = new THREE.Vector3().subVectors(camera.position, group.position).normalize();
                jetMat.uniforms.uViewVector.value.copy(viewVec);
            }
        }
    };

    if (scene?.add) scene.add(group);
    return group;
}
