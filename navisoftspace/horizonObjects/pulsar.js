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

    // 2. MAGNETIC RIG (Tilted)
    const magneticRig = new THREE.Group();
    magneticRig.rotation.z = Math.PI * 0.15; // 27-degree offset (more realistic for known pulsars)
    spinRig.add(magneticRig);

    // --- SHARED NOISE FUNCTION FOR SHADERS ---
    // Simplex 3D noise to create organic, boiling plasma instead of rigid sine waves
    const fbmNoise = `
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
    // 3. HYPER-HOT NEUTRON STAR CORE (Boiling Plasma)
    // ------------------------------------------------------------------------
    const coreGeo = new THREE.SphereGeometry(baseRadius, 64, 64);
    const coreMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec3 vViewPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec3 vViewPosition;
            ${fbmNoise}
            
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                
                // Turbulent boiling surface
                float noiseVal = snoise(vPosition * 0.0005 + uTime * 2.0) * 0.5 + 0.5;
                
                // Rim lighting
                float rim = 1.0 - max(dot(viewDir, normal), 0.0);
                float glow = smoothstep(0.0, 1.0, rim);
                
                vec3 coreColor = vec3(1.0, 1.0, 1.0); // Blinding white
                vec3 edgeColor = vec3(0.1, 0.6, 1.0); // Cyan plasma
                vec3 darkSpots = vec3(0.0, 0.2, 0.6); // Slightly cooler spots
                
                vec3 baseSurface = mix(darkSpots, coreColor, noiseVal);
                vec3 finalColor = mix(baseSurface, edgeColor, pow(glow, 2.0));
                
                gl_FragColor = vec4(finalColor * 2.5, 1.0);
            }
        `
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core); // Core doesn't need to spin mechanically, the shader handles the boiling

    // ------------------------------------------------------------------------
    // 4. OPTICAL HALO (Simulates Bloom/Glare without post-processing)
    // ------------------------------------------------------------------------
    const haloGeo = new THREE.PlaneGeometry(baseRadius * 12, baseRadius * 12);
    const haloMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                // Billboard effect: force plane to always face the camera
                vec4 modelViewPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                modelViewPosition.xy += position.xy;
                gl_Position = projectionMatrix * modelViewPosition;
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            void main() {
                float dist = length(vUv - vec2(0.5));
                float glow = 0.05 / (dist + 0.01) - 0.1; // Inverse square falloff
                glow = clamp(glow, 0.0, 1.0);
                vec3 color = vec3(0.2, 0.6, 1.0); // Cyan aura
                gl_FragColor = vec4(color, glow * 0.8);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    group.add(halo);

    // ------------------------------------------------------------------------
    // 5. ACCRETION DISC / PULSAR WIND (Swirling Volumetric Plasma)
    // ------------------------------------------------------------------------
    const torusGeo = new THREE.PlaneGeometry(baseRadius * 25.0, baseRadius * 25.0, 64, 64);
    const torusMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            void main() {
                vUv = uv;
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            ${fbmNoise}
            
            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                float r = length(uv);
                
                // Rotational UVs for swirling effect
                float angle = atan(uv.y, uv.x) + uTime * 2.0;
                vec3 noiseCoord = vec3(cos(angle)*r, sin(angle)*r, uTime * 0.5) * 10.0;
                
                float noise = snoise(noiseCoord) * 0.5 + 0.5;
                
                // Cutout inner hole and fade outer edge
                float ringMask = smoothstep(0.1, 0.3, r) * smoothstep(1.0, 0.6, r);
                
                // Inject noise into the ring mask
                float plasma = ringMask * noise;
                
                vec3 color = vec3(0.1, 0.4, 0.9) * (plasma * 2.0);
                gl_FragColor = vec4(color, plasma * 0.7);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI * 0.5; 
    group.add(torus);

    // ------------------------------------------------------------------------
    // 6. VOLUMETRIC RELATIVISTIC JETS (Flared cones with intense cores)
    // ------------------------------------------------------------------------
    const jetLength = baseRadius * 80;
    // Flared cone: wide at the top, tight at the bottom
    const jetGeo = new THREE.CylinderGeometry(baseRadius * 12.0, baseRadius * 0.8, jetLength, 64, 1, true);
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
            uniform float uTime;
            uniform vec3 uViewVector;
            varying vec2 vUv;
            varying vec3 vWorldNormal;
            ${fbmNoise}

            void main() {
                // 1. High-speed upward moving noise for the beam energy
                vec3 noiseCoord = vec3(vUv.x * 10.0, vUv.y * 5.0 - uTime * 10.0, uTime);
                float noise = snoise(noiseCoord) * 0.5 + 0.5;
                
                // 2. Fades
                float lengthFade = smoothstep(1.0, 0.0, vUv.y); // Fade out at the tip
                float edgeFade = smoothstep(0.0, 0.5, sin(vUv.x * 3.14159)); // Cylindrical fade
                
                // 3. Core beam (intense center) vs Outer scatter
                float isCore = pow(edgeFade, 4.0); 
                vec3 coreColor = vec3(1.0, 1.0, 1.0) * isCore * 2.0;
                vec3 scatterColor = vec3(0.0, 0.5, 1.0) * noise;
                
                // 4. THE LIGHTHOUSE EFFECT (View Dot Product)
                // If the jet cylinder normal points toward the camera, it flares brightly
                float viewDot = max(dot(vWorldNormal, uViewVector), 0.0);
                float flash = pow(viewDot, 8.0) * 5.0; // Extreme exponential curve for a sharp flash
                
                vec3 finalColor = coreColor + scatterColor + (vec3(0.5, 0.8, 1.0) * flash);
                float alpha = (noise * 0.5 + isCore * 0.8 + flash) * lengthFade;
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const northJet = new THREE.Mesh(jetGeo, jetMat);
    const southJet = new THREE.Mesh(jetGeo, jetMat);
    southJet.rotation.z = Math.PI;

    magneticRig.add(northJet);
    magneticRig.add(southJet);

    // ------------------------------------------------------------------------
    // 7. UPDATE LOOP
    // ------------------------------------------------------------------------
    group.userData = {
        type: 'pulsar',
        name: config.name || 'Pulsar PSR B1919+21',
        category: 'PULSATING NEUTRON STAR',
        
        // Ensure you pass the camera into your engine's update loop!
        update(time, camera = null) {
            // Mechanical rotation
            spinRig.rotation.y = time * 20.0; 
            
            // Sync time to shaders
            coreMat.uniforms.uTime.value = time;
            torusMat.uniforms.uTime.value = time;
            jetMat.uniforms.uTime.value = time;

            // Sync the camera vector for the Lighthouse Flash
            if (camera) {
                // Get a vector pointing from the pulsar to the camera
                const viewVec = new THREE.Vector3().subVectors(camera.position, group.position).normalize();
                jetMat.uniforms.uViewVector.value.copy(viewVec);
            }
        }
    };

    if (scene?.add) scene.add(group);
    return group;
}
