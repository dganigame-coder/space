import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Custom ShaderMaterial for Relativistic Plasma Jets
 * Added: Magnetic standing shockwaves (Knots)
 */
const JetShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColorCore: { value: new THREE.Color(0xffffff) },
        uColorEdge: { value: new THREE.Color(0x0044ff) } // Shifted to X-ray blue for quasars
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
            float streamSpeed = 12.0;
            vec2 movingUv = vec2(vUv.x * 10.0, (vPosition.y * 0.000015) - (uTime * streamSpeed));
            
            float streamPattern = noise(movingUv) * 0.65 + noise(movingUv * 2.5) * 0.35;
            float distanceFade = smoothstep(1.0, 0.0, vUv.y);

            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float rim = pow(abs(dot(normal, viewDir)), 1.4);

            vec3 finalColor = mix(uColorCore, uColorEdge, pow(1.0 - rim, 0.45));

            // NEW: Standing shockwaves (knots) caused by magnetic flux collisions
            float knots = pow(sin(vUv.y * 50.0 - uTime * 2.0) * 0.5 + 0.5, 18.0);

            float alpha = rim * distanceFade * (0.35 + streamPattern * 0.65) + (knots * distanceFade * 0.5);

            gl_FragColor = vec4(finalColor * (1.0 + knots), alpha);
        }
    `
};

/**
 * Custom ShaderMaterial for the Accretion Disk
 * Added: Relativistic Doppler Beaming
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
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        void main() {
            // Calculate view direction to camera
            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            
            // Calculate orbital tangent vector (assuming disk spins clockwise on XZ plane)
            vec3 tangent = normalize(vec3(-vWorldPosition.z, 0.0, vWorldPosition.x));
            
            // DOPPLER EFFECT: Dot product of tangent and view direction.
            // Positive = moving toward camera, Negative = moving away
            float doppler = dot(tangent, viewDir);
            
            // Exaggerate the beaming effect (approaching is vastly brighter)
            float beaming = pow(max(doppler + 1.2, 0.0), 3.5);

            // Ring fading (vUv.y goes from 0 at inner radius to 1 at outer)
            float innerFade = smoothstep(0.0, 0.1, vUv.y);
            float outerFade = smoothstep(1.0, 0.4, vUv.y);
            float radialMask = innerFade * outerFade;

            // Swirling plasma noise based on world position
            float plasma = sin(vWorldPosition.x * 0.0001 + uTime) * cos(vWorldPosition.z * 0.0001 + uTime);
            
            // Base fiery orange, shifting towards X-ray blue/white on the approaching side
            vec3 baseColor = vec3(1.0, 0.3, 0.0);
            vec3 shiftColor = mix(baseColor, vec3(0.8, 0.9, 1.0), beaming * 0.3);

            gl_FragColor = vec4(shiftColor * beaming * 1.5, radialMask * (0.5 + plasma * 0.2));
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
    // 1. THE EVENT HORIZON (Absolute Black)
    // ------------------------------------------------------------------------
    const coreGeo = new THREE.SphereGeometry(baseRadius, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        toneMapped: false
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // ------------------------------------------------------------------------
    // 1b. PHOTON SPHERE (The blistering inner orbit of trapped light)
    // ------------------------------------------------------------------------
    const photonGeo = new THREE.SphereGeometry(baseRadius * 1.05, 64, 64);
    const photonMat = new THREE.MeshBasicMaterial({
        color: 0xffeedd,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
    });
    const photonSphere = new THREE.Mesh(photonGeo, photonMat);
    group.add(photonSphere);

    // ------------------------------------------------------------------------
    // 2. ACCRETION DISK (Doppler Beamed)
    // ------------------------------------------------------------------------
    const diskGeo = new THREE.RingGeometry(baseRadius * 1.3, baseRadius * 6.5, 128);
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
    // 3. NEBULAR GAS CLOUD (Ionized Envelope)
    // ------------------------------------------------------------------------
    const cloudGeo = new THREE.SphereGeometry(baseRadius * 5.0, 32, 32);
    const cloudMat = new THREE.MeshBasicMaterial({
        color: 0x001144, // Darker, subtler space backdrop to let jets pop
        transparent: true,
        opacity: 0.15,
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
        48, 64, true // Increased height segments for better knot rendering
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
    // 5. INNER HIGH-ENERGY LASER CORE (Collimated spine)
    // ------------------------------------------------------------------------
    const innerJetGeo = new THREE.CylinderGeometry(
        jetRadiusTop * 0.15, 
        jetRadiusBottom * 0.1, 
        jetLength * 1.02, 
        24, 1, true
    );
    innerJetGeo.translate(0, (jetLength * 1.02) / 2, 0);

    const innerJetMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
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
        update(time) {
            northJetMat.uniforms.uTime.value = time;
            southJetMat.uniforms.uTime.value = time;
            diskMat.uniforms.uTime.value = time;
            
            // Physical spin of the disk geometry
            accretionDisk.rotation.z = time * -0.5;
        }
    };

    if (scene?.add) scene.add(group);
    return group;
}
