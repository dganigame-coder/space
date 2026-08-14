import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Custom ShaderMaterial for Relativistic Plasma Jets
 * Animates high-speed plasma flow using continuous world-position noise scrolling.
 */
const JetShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColorCore: { value: new THREE.Color(0xffffff) },
        uColorEdge: { value: new THREE.Color(0xff0044) }
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

        // Procedural pseudo-random noise generator
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
            // 1. Continuous axial plasma stream translation along Y axis
            float streamSpeed = 12.0;
            vec2 movingUv = vec2(vUv.x * 10.0, (vPosition.y * 0.000015) - (uTime * streamSpeed));
            
            // Layered noise for multi-frequency turbulence
            float streamPattern = noise(movingUv) * 0.65 + noise(movingUv * 2.5) * 0.35;

            // 2. Exponential distance attenuation (fades out at distal tip)
            float distanceFade = smoothstep(1.0, 0.0, vUv.y);

            // 3. Volumetric Fresnel softness for smooth mesh boundary blending
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float rim = pow(abs(dot(normal, viewDir)), 1.4);

            // 4. Energy Core color interpolation
            vec3 finalColor = mix(uColorCore, uColorEdge, pow(1.0 - rim, 0.45));

            // Composite alpha
            float alpha = rim * distanceFade * (0.35 + streamPattern * 0.65);

            gl_FragColor = vec4(finalColor, alpha);
        }
    `
};

/**
 * Creates an Active Galactic Nucleus / Quasar with 300,000 LY Relativistic Jets
 * @param {THREE.Scene} [scene] - Optional scene instance to auto-add the object
 * @param {Object} [config] - Configuration object for position, name, and radius
 */
export function createQuasar(scene = null, config = {}) {
    const group = new THREE.Group();

    const x = config.x ?? 0;
    const y = config.y ?? 0;
    const z = config.z ?? 0;
    const baseRadius = config.radius ?? 200000;

    group.position.set(x, y, z);

    // ------------------------------------------------------------------------
    // 1. BLINDING CENTRAL CORE (Singularity Atmosphere)
    // ------------------------------------------------------------------------
    const coreGeo = new THREE.SphereGeometry(baseRadius, 48, 48);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // ------------------------------------------------------------------------
    // 2. ACCRETION DISK (Glowing Relativistic Swirl)
    // ------------------------------------------------------------------------
    const diskGeo = new THREE.RingGeometry(baseRadius * 1.3, baseRadius * 5.5, 96);
    const diskMat = new THREE.MeshBasicMaterial({
        color: 0xff5500,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
    accretionDisk.rotation.x = Math.PI / 2;
    group.add(accretionDisk);

    // ------------------------------------------------------------------------
    // 3. NEBULAR GAS CLOUD (Blue Energetic Envelope)
    // ------------------------------------------------------------------------
    const cloudGeo = new THREE.SphereGeometry(baseRadius * 4.5, 32, 32);
    const cloudMat = new THREE.MeshBasicMaterial({
        color: 0x0066ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    group.add(cloud);

    // ------------------------------------------------------------------------
    // 4. SHADER-DRIVEN RELATIVISTIC PLASMA JETS
    // ------------------------------------------------------------------------
    const jetLength = baseRadius * 30;
    const jetRadiusTop = baseRadius * 2.8;
    const jetRadiusBottom = baseRadius * 0.1;

    const jetGeo = new THREE.CylinderGeometry(
        jetRadiusTop, 
        jetRadiusBottom, 
        jetLength, 
        48, 24, true
    );
    // Align geometry origin to bottom base of cylinder
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
    // 5. INNER HIGH-ENERGY LASER CORE
    // ------------------------------------------------------------------------
    const innerJetGeo = new THREE.CylinderGeometry(
        jetRadiusTop * 0.25, 
        jetRadiusBottom * 0.15, 
        jetLength * 1.08, 
        24, 1, true
    );
    innerJetGeo.translate(0, (jetLength * 1.08) / 2, 0);

    const innerJetMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const northInner = new THREE.Mesh(innerJetGeo, innerJetMat);
    const southInner = new THREE.Mesh(innerJetGeo, innerJetMat);
    southInner.rotation.z = Math.PI;

    group.add(northInner);
    group.add(southInner);

    // ------------------------------------------------------------------------
    // 6. HUD METADATA & UPDATE HOOK
    // ------------------------------------------------------------------------
    group.userData = {
        type: 'blackhole',
        name: config.name || 'Active Galactic Nucleus (Quasar)',
        category: 'ACTIVE GALACTIC NUCLEUS',
        subText: 'ENERGY JET: 300,000 LIGHT YEARS',
        r: baseRadius * 2,
        northJetMat,
        southJetMat,
        accretionDisk,
        /**
         * Call inside your animation frame loop to advance plasma motion
         * @param {number} time - Current elapsed time (seconds)
         */
        update(time) {
            northJetMat.uniforms.uTime.value = time;
            southJetMat.uniforms.uTime.value = time;
            accretionDisk.rotation.z = time * 0.15;
        }
    };

    if (scene?.add) {
        scene.add(group);
    }

    return group;
}
