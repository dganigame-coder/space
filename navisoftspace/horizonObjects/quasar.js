import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Custom ShaderMaterial for Relativistic Plasma Jets
 * Enhanced with FBM multi-octave turbulence and standing shockwaves.
 */
const JetShaderMaterial = {
uniforms: {
        uTime: { value: 0 },
        uColorCore: { value: new THREE.Color(0xd0ffff) }, // Ice white-blue
        uColorEdge: { value: new THREE.Color(0x0044ff) }  // Deep high-energy blue
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: /* glsl */`
    uniform float uTime;
        uniform vec3 cameraPosition;
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 3; i++) {
                v += a * noise(p);
                p *= 2.5;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            vec3 tangent = normalize(vec3(-vWorldPosition.z, 0.0, vWorldPosition.x));
            
            // Relativistic Doppler Beaming
            float doppler = dot(tangent, viewDir);
            float beaming = pow(max(doppler + 1.2, 0.0), 4.0); // Increased beaming

            // Radial alpha mask
            float innerFade = smoothstep(0.0, 0.05, vUv.y); 
            float outerFade = smoothstep(1.0, 0.2, vUv.y);
            float radialMask = innerFade * outerFade;

            // Swirling organic plasma turbulence
            vec2 polarUv = vec2(length(vWorldPosition.xz) * 0.0002 - uTime * 0.3, atan(vWorldPosition.z, vWorldPosition.x) * 0.5);
            float plasma = fbm(polarUv * 5.0);
            
            // MASSIVE ENERGY SPIKE: Pushing values to 30.0+ to violently trigger HDR Bloom
            vec3 thermalCore = vec3(30.0, 45.0, 80.0);   // Blinding electric blue/white
            vec3 thermalOuter = vec3(0.1, 0.5, 2.0);     // Deep space azure
            
            vec3 baseColor = mix(thermalOuter, thermalCore, pow(1.0 - vUv.y, 3.0));
            vec3 finalColor = baseColor * beaming * (1.0 + plasma * 2.0);

            // Thicker opacity at the core
            float alpha = radialMask * (0.6 + plasma * 0.8);

            gl_FragColor = vec4(finalColor, alpha);
        }
    `
};

/**
 * Custom ShaderMaterial for the Accretion Disk
 * Enhanced with FBM noise and true relativistic Doppler beaming.
 */
const AccretionDiskMaterial = {
    uniforms: {
        uTime: { value: 0 }
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vLocalPosition;
        
        void main() {
            vUv = uv;
            // Use local position so turbulence doesn't break when the group rotates
            vLocalPosition = position; 
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vLocalPosition;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 3; i++) {
                v += a * noise(p);
                p *= 2.0;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            // RingGeometry local positions are on the XY plane
            float radius = length(vLocalPosition.xy);
            float angle = atan(vLocalPosition.y, vLocalPosition.x);
            
            // Swirling turbulence
            vec2 polar = vec2(radius * 0.00005 - uTime * 0.3, angle * 0.8);
            float plasma = fbm(polar * 4.0);

            // Smooth fading on the inner and outer edges
            float innerFade = smoothstep(0.0, 0.08, vUv.y);
            float outerFade = smoothstep(1.0, 0.3, vUv.y);
            float radialMask = innerFade * outerFade;

            // Standard color gradient (Looks great without Bloom)
            vec3 coreColor = vec3(1.0, 1.0, 1.0); // Blinding white at the center
            vec3 midColor = vec3(0.2, 0.5, 1.0);  // Bright electric blue
            vec3 edgeColor = vec3(0.0, 0.1, 0.4); // Dark space blue at the rim

            // Mix colors based on distance from the black hole
            vec3 baseColor = mix(midColor, coreColor, pow(1.0 - vUv.y, 2.5));
            baseColor = mix(edgeColor, baseColor, outerFade);

            // Add bright plasma streaks
            vec3 finalColor = baseColor * (1.0 + plasma * 1.5);

            // Soft, glowing alpha blending instead of harsh opacity
            float alpha = radialMask * (0.15 + plasma * 0.85);

            gl_FragColor = vec4(finalColor, alpha);
        }
    `
};

/**
 * Creates an Active Galactic Nucleus / Quasar
 */
export function createQuasar(scene = null, config = {}) {
    const group = new THREE.Group();

    const x = config.x ?? 0;
    const y = config.y ?? 0;
    const z = config.z ?? 0;
    const baseRadius = config.radius ?? 200000;

    group.position.set(x, y, z);

// ------------------------------------------------------------------------
    // 1. THE EVENT HORIZON (Absolute Black Core)
    // ------------------------------------------------------------------------
    // Scaled down slightly to leave room for the gravitational lensing optical ring
    const coreGeo = new THREE.SphereGeometry(baseRadius * 0.95, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        toneMapped: false
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // ------------------------------------------------------------------------
    // 1b. PHOTON SPHERE (The Ultra-Bright Gravitational Lensing Ring)
    // ------------------------------------------------------------------------
    // This creates the iconic thin, hyper-bright ring where light orbits the black hole
    const photonGeo = new THREE.SphereGeometry(baseRadius * 1.02, 64, 64);
    const photonMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        toneMapped: false,
        depthWrite: false
    });
    const photonSphere = new THREE.Mesh(photonGeo, photonMat);
    group.add(photonSphere);

    // Outer distortion halo to simulate light bending around the shadow
    const lensGeo = new THREE.SphereGeometry(baseRadius * 1.15, 32, 32);
    const lensMat = new THREE.MeshBasicMaterial({
        color: 0xffaa44, // Warm lensed photon glow matching the accretion disk
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
    });
    const gravitationalLens = new THREE.Mesh(lensGeo, lensMat);
    group.add(gravitationalLens);

    // ------------------------------------------------------------------------
    // 1c. EXTREME ENERGY HALO (Blinding Core Bleed)
    // ------------------------------------------------------------------------
        /*
    const haloGeo = new THREE.SphereGeometry(baseRadius * 1.8, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
        color: 0x4488ff, // Bright electric blue
        transparent: true,
        opacity: 0.8,    // High opacity to blow out the center
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
    });
    const energyHalo = new THREE.Mesh(haloGeo, haloMat);
    group.add(energyHalo);
*/
    // ------------------------------------------------------------------------
    // 2. ACCRETION DISK (Doppler Beamed with FBM Turbulence)
    // ------------------------------------------------------------------------
    const diskGeo = new THREE.RingGeometry(baseRadius * 1.3, baseRadius * 7.0, 128);
    const diskMat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(AccretionDiskMaterial.uniforms),
        vertexShader: AccretionDiskMaterial.vertexShader,
        fragmentShader: AccretionDiskMaterial.fragmentShader,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
    accretionDisk.rotation.x = Math.PI / 2;
    group.add(accretionDisk);

    // ------------------------------------------------------------------------
    // 3. IONIZED CORONA ENVELOPE
    // ------------------------------------------------------------------------
    const cloudGeo = new THREE.SphereGeometry(baseRadius * 5.5, 32, 32);
    const cloudMat = new THREE.MeshBasicMaterial({
        color: 0x001133, // Shifted to dark cosmic blue to match synchrotron energy
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    group.add(cloud);

    // ------------------------------------------------------------------------
    // 4. RELATIVISTIC PLASMA JETS
    // ------------------------------------------------------------------------
    const jetLength = baseRadius * 35;
    const jetRadiusTop = baseRadius * 3.2;
    
    // Change this back to 0.9 (Hugs the event horizon perfectly)
    const jetRadiusBottom = baseRadius * 0.9;

    const jetGeo = new THREE.CylinderGeometry(
        jetRadiusTop, 
        jetRadiusBottom, 
        jetLength, 
        48, 64, true
    );
    jetGeo.translate(0, jetLength / 2, 0);

    const northJetMat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(JetShaderMaterial.uniforms),
        vertexShader: JetShaderMaterial.vertexShader,
        fragmentShader: JetShaderMaterial.fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const southJetMat = northJetMat.clone();

    const northJet = new THREE.Mesh(jetGeo, northJetMat);
    const southJet = new THREE.Mesh(jetGeo, southJetMat);
    southJet.rotation.z = Math.PI;

    group.add(northJet);
    group.add(southJet);

    // ------------------------------------------------------------------------
    // 5. COLLIMATED HIGH-ENERGY SPINE (Core Laser)
    // ------------------------------------------------------------------------
    const innerJetGeo = new THREE.CylinderGeometry(
        jetRadiusTop * 0.1, 
        jetRadiusBottom * 0.05, 
        jetLength * 1.02, 
        24, 1, true
    );
    innerJetGeo.translate(0, (jetLength * 1.02) / 2, 0);

    const innerJetMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        depthWrite: false
    });

    const northInner = new THREE.Mesh(innerJetGeo, innerJetMat);
    const southInner = new THREE.Mesh(innerJetGeo, innerJetMat);
    southInner.rotation.z = Math.PI;

    group.add(northInner);
    group.add(southInner);

    // ------------------------------------------------------------------------
    // 6. METADATA & UPDATE HOOK
    // ------------------------------------------------------------------------
    group.userData = {
        type: 'quasar',           
        sound: 'QUASAR_BEAM',     
        name: config.name || 'Distant Quasar X-1',
        category: 'ACTIVE GALACTIC NUCLEUS',
        subText: 'RELATIVISTIC JET ENGINE ACTIVE',
        r: baseRadius * 2,
        update(time) {    
            northJetMat.uniforms.uTime.value = time;
            southJetMat.uniforms.uTime.value = time;
            diskMat.uniforms.uTime.value = time;
            
            // Subtle rotation of the disk and corona
            accretionDisk.rotation.z = time * -0.3;
            cloud.rotation.y = time * 0.02;
        }
    };

    // ------------------------------------------------------------------------
    // 7. HOST GALAXY STAR-FIELD DISK (Matching reference background)
    // ------------------------------------------------------------------------
    const galaxyGeo = new THREE.RingGeometry(baseRadius * 6, baseRadius * 25, 64);
    const galaxyMat = new THREE.MeshBasicMaterial({
        color: 0x113366,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const hostGalaxy = new THREE.Mesh(galaxyGeo, galaxyMat);
    hostGalaxy.rotation.x = Math.PI / 2;
    group.add(hostGalaxy);
    
   // ------------------------------------------------------------------------
    // FIX: PREVENT DISAPPEARING WHEN PANNING CAMERA
    // ------------------------------------------------------------------------
    group.traverse((child) => {
        if (child.isMesh) {
            child.frustumCulled = false;
        }
    });
    
    if (scene?.add) scene.add(group);
    return group;
}
