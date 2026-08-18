import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Custom ShaderMaterial for Relativistic Plasma Jets
 * Enhanced with FBM multi-octave turbulence and standing shockwaves.
 */
const JetShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColorCore: { value: new THREE.Color(0xffffff) },
        uColorEdge: { value: new THREE.Color(0xff5500) } // Fiery orange/red
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
        uniform vec3 uColorCore;
        uniform vec3 uColorEdge;

        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        // High-precision pseudo-noise
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        // Fractal Brownian Motion for realistic turbulent plasma flow
        float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < 4; i++) {
                value += amplitude * noise(p);
                p *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }

        void main() {
            float streamSpeed = 15.0;
            vec2 movingUv = vec2(vUv.x * 8.0, (vPosition.y * 0.00002) - (uTime * streamSpeed));
            
            float turbulence = fbm(movingUv);
            float distanceFade = smoothstep(1.0, 0.05, vUv.y);

            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float rim = pow(abs(dot(normal, viewDir)), 1.2);

            vec3 finalColor = mix(uColorCore, uColorEdge, pow(1.0 - rim, 0.4));

            // Magnetic standing shockwaves (knots)
            float knots = pow(sin(vUv.y * 60.0 - uTime * 3.0) * 0.5 + 0.5, 16.0);

            float alpha = rim * distanceFade * (0.3 + turbulence * 0.7) + (knots * distanceFade * 0.6);

            gl_FragColor = vec4(finalColor * (1.0 + knots * 2.0), alpha);
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
        varying vec3 vWorldPosition;
        void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
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
            float beaming = pow(max(doppler + 1.1, 0.0), 4.0);

            // Radial alpha mask
            float innerFade = smoothstep(0.0, 0.15, vUv.y);
            float outerFade = smoothstep(1.0, 0.35, vUv.y);
            float radialMask = innerFade * outerFade;

            // Swirling organic plasma turbulence
            vec2 polarUv = vec2(length(vWorldPosition.xz) * 0.0002 - uTime * 0.2, atan(vWorldPosition.z, vWorldPosition.x) * 0.5);
            float plasma = fbm(polarUv * 4.0);

            // Thermal color grading: Superheated white/yellow core shifting to dusty dark orange
            // Values pushed past 1.0 to trigger intense HDR bloom
            vec3 thermalCore = vec3(5.0, 3.5, 1.5); 
            vec3 thermalOuter = vec3(0.6, 0.15, 0.02);
            vec3 baseColor = mix(thermalOuter, thermalCore, smoothstep(0.1, 0.6, 1.0 - vUv.y));

            vec3 finalColor = baseColor * beaming * (1.0 + plasma * 1.5);

            // Carve out the dust lanes by tying alpha directly to the FBM valleys
            float dustGaps = smoothstep(0.2, 0.7, plasma);
            float alpha = radialMask * (0.1 + dustGaps * 0.9);

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
            color: 0x1a0a00, // Deep dusty brown
            transparent: true,
            opacity: 0.4,    // Increased opacity slightly to catch more dust
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
    const jetRadiusBottom = baseRadius * 0.08;

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

    if (scene?.add) scene.add(group);
    return group;
}
