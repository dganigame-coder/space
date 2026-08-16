import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createPulsar(scene = null, config = {}) {
    const group = new THREE.Group();

    const x = config.x ?? 0;
    const y = config.y ?? 0;
    const z = config.z ?? 0;
    const baseRadius = config.radius ?? 4000;

    group.position.set(x, y, z);

    // 1. INNER SPIN RIG: Handles high-speed Y rotation
    const spinRig = new THREE.Group();
    group.add(spinRig);

    // 2. MAGNETIC RIG: Holds the jets at a tilted angle
    const magneticRig = new THREE.Group();
    magneticRig.rotation.z = Math.PI * 0.25; // 45-degree magnetic offset
    spinRig.add(magneticRig);

    // ------------------------------------------------------------------------
    // 3. HYPER-HOT NEUTRON STAR CORE
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
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                
                // Fresnel rim lighting for an extreme glowing orb effect
                float rim = 1.0 - max(dot(viewDir, normal), 0.0);
                float glow = smoothstep(0.0, 1.0, rim);
                
                vec3 coreColor = vec3(1.0, 1.0, 1.0); // Blinding X-ray white
                vec3 edgeColor = vec3(0.0, 0.8, 1.0); // Intense cyan plasma
                
                // Combine blinding center with glowing edges
                vec3 finalColor = mix(coreColor, edgeColor, pow(glow, 3.0));
                
                gl_FragColor = vec4(finalColor * 2.0, 1.0); // Boosted intensity
            }
        `,
        transparent: true
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    spinRig.add(core);

    // ------------------------------------------------------------------------
    // 4. EQUATORIAL PULSAR WIND TORUS (Shockwaves)
    // ------------------------------------------------------------------------
    const torusGeo = new THREE.PlaneGeometry(baseRadius * 15.0, baseRadius * 15.0, 64, 64);
    const torusMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec2 vUv;
            
            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                float r = length(uv);
                
                // Expanding plasma shockwaves
                float waves = sin(r * 30.0 - uTime * 15.0);
                float ringMask = smoothstep(0.2, 0.3, r) * smoothstep(1.0, 0.7, r);
                
                vec3 color = vec3(0.2, 0.5, 1.0) * (waves * 0.5 + 0.5);
                float alpha = ringMask * pow(waves * 0.5 + 0.5, 2.0);
                
                gl_FragColor = vec4(color * 1.5, alpha * 0.6);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI * 0.5; // Lay flat on the equator
    spinRig.add(torus);

    // ------------------------------------------------------------------------
    // 5. RELATIVISTIC PLASMA JETS ("Light Sprinkle" Effect)
    // ------------------------------------------------------------------------
    const jetLength = baseRadius * 60;
    // Open-ended cylinder allows us to make it look like a hollow cone of energy
    const jetGeo = new THREE.CylinderGeometry(baseRadius * 6.0, baseRadius * 0.5, jetLength, 64, 1, true);
    jetGeo.translate(0, jetLength / 2, 0);

    const jetMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec2 vUv;

            // High-frequency random hash for the particle effect
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            void main() {
                // vUv.y goes from 0 (base) to 1 (tip)
                // vUv.x goes around the cylinder (0 to 1)
                
                // 1. Create a dense micro-grid for the scattered particles
                // Scale X so sprinkles wrap around, scale Y for length
                // Subtract uTime to make the particles shoot outward continuously at high speed
                vec2 gridUv = vec2(vUv.x * 120.0, vUv.y * 400.0 - uTime * 80.0);
                
                // 2. Isolate individual cells
                vec2 cell = floor(gridUv);
                vec2 cellFract = fract(gridUv);
                
                // 3. Generate a random value per cell
                float rand = random(cell);
                
                // 4. Threshold: Only ~4% of cells get a sprinkle (creates the scattered look)
                float sprinkle = step(0.96, rand);
                
                // 5. Make the sprinkle a soft glowing dot rather than a hard square
                float dist = length(cellFract - vec2(0.5));
                float sparkGlow = smoothstep(0.5, 0.1, dist) * sprinkle;
                
                // 6. Base ambient beam (very faint deep blue so the cone doesn't look entirely empty)
                float baseBeam = smoothstep(0.0, 0.5, sin(vUv.x * 3.14159)) * 0.05;
                
                // 7. Fade everything out smoothly towards the tip of the cone
                float lengthFade = smoothstep(1.0, 0.1, vUv.y);
                
                // Final colors
                vec3 sparkColor = vec3(0.6, 0.9, 1.0) * sparkGlow * 4.0; // Overblown cyan/white sprinkles
                vec3 beamColor = vec3(0.0, 0.3, 0.8) * baseBeam;         // Faint background tunnel
                
                gl_FragColor = vec4(sparkColor + beamColor, (sparkGlow + baseBeam) * lengthFade);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const northJet = new THREE.Mesh(jetGeo, jetMat);
    const southJet = new THREE.Mesh(jetGeo, jetMat);
    southJet.rotation.z = Math.PI; // Flip for the southern pole

    magneticRig.add(northJet);
    magneticRig.add(southJet);

    // ------------------------------------------------------------------------
    // 6. UPDATE LOOP (Syncing Shaders & Rotation)
    // ------------------------------------------------------------------------
    group.userData = {
        type: 'pulsar',
        name: config.name || 'Pulsar',
        category: 'PULSATING NEUTRON STAR',
        r: baseRadius * 2,
        update(time) {
            // High-speed mechanical rotation
            spinRig.rotation.y = time * 15.0; 
            
            // Sync time to the dynamic shaders
            torusMat.uniforms.uTime.value = time;
            jetMat.uniforms.uTime.value = time;
        }
    };

    if (scene?.add) scene.add(group);
    return group;
}
