import * as THREE from 'three';

// ============================================================================
// GLOBAL SHADERS (Stored in memory once, cloned for instances)
// ============================================================================

const JetShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColorCore: { value: new THREE.Color(0xd0ffff) },
        uColorEdge: { value: new THREE.Color(0x0044ff) }
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
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
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; } return v;
        }

        void main() {
            float streamSpeed = 15.0;
            vec2 movingUv = vec2(vUv.x * 8.0, (vWorldPosition.y * 0.00002) - (uTime * streamSpeed));
            float turbulence = fbm(movingUv);
            float distanceFade = smoothstep(1.0, 0.05, vUv.y);

            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float rim = pow(abs(dot(normal, viewDir)), 1.2);
            vec3 finalColor = mix(uColorCore, uColorEdge, pow(1.0 - rim, 0.4));

            float knots = pow(sin(vUv.y * 50.0 - uTime * 6.0) * 0.5 + 0.5, 12.0);
            float alpha = rim * distanceFade * (0.4 + turbulence * 0.6) + (knots * distanceFade * 0.8);
            gl_FragColor = vec4(finalColor * (1.0 + knots * 3.0), alpha);
        }
    `
};

const AccretionDiskMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uInnerRadius: { value: 0.0 }, // Bound during instantiation
        uOuterRadius: { value: 0.0 }  // Bound during instantiation
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;
        void main() {
            vUv = uv;
            vLocalPosition = position; 
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: /* glsl */`
        uniform float uTime;
        uniform float uInnerRadius;
        uniform float uOuterRadius;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for(int i=0; i<5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; } return v;
        }

        void main() {
            float radius = length(vLocalPosition.xy); 
            float angle = atan(vLocalPosition.y, vLocalPosition.x);
            float nRadius = (radius - uInnerRadius) / (uOuterRadius - uInnerRadius);
            
            vec2 swirlUV = vec2(nRadius * 3.0, angle * 2.0 - (uTime * 15.0 / (nRadius + 0.1)));
            float plasma = fbm(swirlUV * 4.0);

            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
            vec3 tangent = normalize(vec3(-vWorldPosition.z, 0.0, vWorldPosition.x));
            float alignment = dot(viewDir, tangent);
            
            float beta = 0.85; 
            float doppler = (1.0 + beta * alignment) / sqrt(1.0 - beta * beta);
            float beamingIntensity = pow(doppler, 3.5) * 0.15; 

            vec3 colorApproaching = vec3(0.7, 0.9, 1.0); 
            vec3 colorRetreating = vec3(1.0, 0.2, 0.05); 
            float shiftMix = (alignment + 1.0) * 0.5; 
            vec3 baseColor = mix(colorRetreating, colorApproaching, shiftMix);

            float edgeFade = smoothstep(0.0, 0.05, nRadius) * smoothstep(1.0, 0.7, nRadius);
            vec3 finalColor = baseColor * plasma * beamingIntensity;
            float finalAlpha = plasma * beamingIntensity * edgeFade;

            gl_FragColor = vec4(finalColor, finalAlpha);
        }
    `
};


const VolumetricJetMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uBaseRadius: { value: 0.0 },
        uJetLength: { value: 0.0 }
    },
    vertexShader: /* glsl */`
        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;

        void main() {
            vLocalPosition = position;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: /* glsl */`
        uniform float uTime;
        uniform float uBaseRadius;
        uniform float uJetLength;

        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;

        float hash(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yxz + 19.19);
            return fract((p.x + p.y) * p.z);
        }

        float noise3D(vec3 p) {
            vec3 i = floor(p); vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
                mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                    mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                    mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
                f.z
            );
        }

        float fbm(vec3 p) {
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 3; i++) {
                v += a * noise3D(p); p *= 2.02; a *= 0.5;
            }
            return v;
        }

        void main() {
            // Raymarching setup: shoot ray from current camera position
            vec3 rayDir = normalize(vWorldPosition - cameraPosition);
            vec3 rayStep = rayDir * (uJetLength / 20.0);
            vec3 currentPos = vLocalPosition;

            float accumDensity = 0.0;
            vec3 accumColor = vec3(0.0);

            // 16 Raymarch steps through the bounding volume
            for (int i = 0; i < 16; i++) {
                float heightRatio = clamp(currentPos.y / uJetLength, 0.0, 1.0);
                float distFromAxis = length(currentPos.xz);
                float allowedRadius = mix(uBaseRadius * 0.8, uBaseRadius * 3.5, heightRatio);

                float radialFade = smoothstep(allowedRadius, allowedRadius * 0.1, distFromAxis);
                float heightFade = smoothstep(1.0, 0.2, heightRatio) * smoothstep(0.0, 0.03, heightRatio);

                if (radialFade > 0.0 && heightFade > 0.0) {
                    vec3 noiseCoord = vec3(
                        currentPos.x * 0.000004,
                        currentPos.y * 0.0000015 - uTime * 1.8,
                        currentPos.z * 0.000004
                    );
                    
                    float density = fbm(noiseCoord) * radialFade * heightFade;

                    vec3 coreColor = vec3(0.9, 0.98, 1.0);
                    vec3 edgeColor = vec3(0.02, 0.35, 1.0);
                    vec3 stepColor = mix(edgeColor, coreColor, pow(radialFade, 1.8));

                    accumDensity += density * 0.18;
                    accumColor += stepColor * density * 0.22;
                }

                currentPos += rayStep;
            }

            gl_FragColor = vec4(accumColor, clamp(accumDensity, 0.0, 1.0));
        }
    `
};

// ============================================================================
// QUASAR FACTORY INSTANCE
// ============================================================================

export function createQuasar(scene = null, config = {}) {
    const group = new THREE.Group();

    const x = config.x ?? 0;
    const y = config.y ?? 0;
    const z = config.z ?? 0;
    const baseRadius = config.radius ?? 200000;

    group.position.set(x, y, z);

    // 1. TRUE 3D BLACK HOLE CORE
    const coreGeo = new THREE.SphereGeometry(baseRadius * 1.2, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.renderOrder = 10;
    group.add(core);

    // 2. RELATIVISTIC ACCRETION DISK
    const diskInner = baseRadius * 1.25;
    const diskOuter = baseRadius * 7.0;
    const diskGeo = new THREE.RingGeometry(diskInner, diskOuter, 128);
    
    const diskUniforms = THREE.UniformsUtils.clone(AccretionDiskMaterial.uniforms);
    diskUniforms.uInnerRadius.value = diskInner;
    diskUniforms.uOuterRadius.value = diskOuter;

    const diskMat = new THREE.ShaderMaterial({
        uniforms: diskUniforms,
        vertexShader: AccretionDiskMaterial.vertexShader,
        fragmentShader: AccretionDiskMaterial.fragmentShader,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
    accretionDisk.rotation.x = Math.PI / 2;
    accretionDisk.renderOrder = 5;
    group.add(accretionDisk);

    // 3. IONIZED CORONA ENVELOPE
    const cloudGeo = new THREE.SphereGeometry(baseRadius * 5.5, 32, 32);
    const cloudMat = new THREE.MeshBasicMaterial({
        color: 0x001133, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.renderOrder = 6;
    group.add(cloud);

    // ------------------------------------------------------------------------
    // 4. VOLUMETRIC RAYMARCHED PLASMA JETS
    // ------------------------------------------------------------------------
    const jetLength = baseRadius * 35;
    const jetRadiusTop = baseRadius * 3.6;
    const jetRadiusBottom = baseRadius * 1.0;

    // Bounding volume box cylinder for raymarching
    const jetGeo = new THREE.CylinderGeometry(jetRadiusTop, jetRadiusBottom, jetLength, 32, 1, true);
    jetGeo.translate(0, jetLength / 2, 0);

    const jetUniforms = THREE.UniformsUtils.clone(VolumetricJetMaterial.uniforms);
    jetUniforms.uBaseRadius.value = baseRadius;
    jetUniforms.uJetLength.value = jetLength;

    const northVolumetricMat = new THREE.ShaderMaterial({
        uniforms: jetUniforms,
        vertexShader: VolumetricJetMaterial.vertexShader,
        fragmentShader: VolumetricJetMaterial.fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const southVolumetricMat = northVolumetricMat.clone();

    const northJet = new THREE.Mesh(jetGeo, northVolumetricMat);
    northJet.renderOrder = 8;

    const southJet = new THREE.Mesh(jetGeo, southVolumetricMat);
    southJet.rotation.z = Math.PI;
    southJet.renderOrder = 8;

    group.add(northJet);
    group.add(southJet);
    
    // 5. INNER SPINE (CORE LASER)
    const innerJetGeo = new THREE.CylinderGeometry(jetRadiusTop * 0.1, jetRadiusBottom * 0.05, jetLength * 1.02, 24, 1, true);
    innerJetGeo.translate(0, (jetLength * 1.02) / 2, 0);
    const innerJetMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false
    });

    const northInner = new THREE.Mesh(innerJetGeo, innerJetMat);
    northInner.renderOrder = 9;
    const southInner = new THREE.Mesh(innerJetGeo, innerJetMat);
    southInner.rotation.z = Math.PI;
    southInner.renderOrder = 9;
    group.add(northInner);
    group.add(southInner);

    // 6. HOST GALAXY
    const galaxyGeo = new THREE.RingGeometry(baseRadius * 4, baseRadius * 30, 64);
    const galaxyMat = new THREE.MeshBasicMaterial({
        color: 0x1b3a6b, transparent: true, opacity: 0.25,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const hostGalaxy = new THREE.Mesh(galaxyGeo, galaxyMat);
    hostGalaxy.rotation.x = Math.PI / 2;
    hostGalaxy.renderOrder = 0;
    group.add(hostGalaxy);

    // 7. PREVENT DISAPPEARING ON CAMERA PAN
    group.traverse((child) => { if (child.isMesh) child.frustumCulled = false; });

    // 8. METADATA & UPDATE HOOK
    group.userData = {
        type: 'quasar',
        name: 'Distant Quasar X-1',
        update(time) {    
            northVolumetricMat.uniforms.uTime.value = time;
            southVolumetricMat.uniforms.uTime.value = time;
            diskMat.uniforms.uTime.value = time;
            
            accretionDisk.rotation.z = time * -0.3;
            cloud.rotation.y = time * 0.02;
        }
    };
    
    if (scene?.add) scene.add(group);
    return group;
}
