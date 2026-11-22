import * as THREE from 'three';

export function createBlackHole(scene, config) {
    const group = new THREE.Group();
    const radius = config.size || 50000;

    // =========================================================
    // 1. THE SINGULARITY
    // =========================================================
    const coreGeo = new THREE.SphereGeometry(radius, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // =========================================================
    // 2. THE DYNAMIC PHOTON RING
    // =========================================================
    const photonGeo = new THREE.SphereGeometry(radius * 1.05, 64, 64);
    const photonMat = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(0xffddbb) }, // Adjusted for a hotter, cinematic look
            viewVector: { value: new THREE.Vector3() },
            uTime: { value: 0.0 } // Added for dynamic pulsing
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            varying vec3 vWorldPosition;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform float uTime;
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            varying vec3 vWorldPosition;
            
            void main() {
                // High-frequency quantum shimmer at the innermost stable circular orbit
                float shimmer = 0.8 + 0.2 * sin(uTime * 15.0 + vWorldPosition.y * 0.01 + vWorldPosition.x * 0.01);
                
                // Fresnel equation to calculate perfect glowing rim
                float intensity = pow(0.15 - dot(vNormal, vPositionNormal), 4.0) * shimmer;
                gl_FragColor = vec4(color * 2.5, intensity);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide
    });
    const photonRing = new THREE.Mesh(photonGeo, photonMat);
    group.add(photonRing);

    // =========================================================
    // 3. 4K PROCEDURAL ACCRETION DISK 
    // =========================================================
    const diskGeo = new THREE.RingGeometry(radius * 1.5, radius * 6, 128, 64);
    
    const diskMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            // Colors adjusted to match the intensely hot, pale aesthetic of the reference image
            uHotColor: { value: new THREE.Color(0xffffff) },  
            uMidColor: { value: new THREE.Color(0xffd5b8) },  
            uCoolColor: { value: new THREE.Color(0x3a1005) }  
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPos;
            void main() {
                vUv = uv;
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uHotColor;
            uniform vec3 uMidColor;
            uniform vec3 uCoolColor;
            varying vec2 vUv;
            varying vec3 vPos;

            float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
            float noise(vec2 st) {
                vec2 i = floor(st); vec2 f = fract(st);
                float a = random(i); float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }
            float fbm(vec2 st) {
                float v = 0.0; float a = 0.5;
                for (int i = 0; i < 5; i++) {
                    v += a * noise(st); st = st * 2.0; a *= 0.5;
                }
                return v;
            }

            void main() {
                vec2 center = vec2(0.5, 0.5);
                float dist = distance(vUv, center) * 2.0;
                float angle = atan(vUv.y - 0.5, vUv.x - 0.5);

                // Relativistic Doppler Beaming (Brighter on side spinning toward camera)
                float doppler = 1.0 + sin(angle) * 0.7; 
                
                // Advanced plasma swirling math with dynamic time distortion
                vec2 spiralUv = vec2(angle * 4.0 + uTime * 3.0, dist * 6.0 - uTime * 1.5);
                float plasma = fbm(spiralUv + fbm(spiralUv * 2.0)); // Domain warping for gaseous look

                vec3 baseColor = mix(uHotColor, uMidColor, smoothstep(0.0, 0.4, dist));
                baseColor = mix(baseColor, uCoolColor, smoothstep(0.4, 1.0, dist));

                vec3 finalColor = baseColor * plasma * doppler * 2.5; // Boosted emission
                
                float alpha = smoothstep(0.0, 0.15, dist) * smoothstep(1.0, 0.7, dist);
                gl_FragColor = vec4(finalColor, alpha * (plasma * 0.8 + 0.2));
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
    accretionDisk.rotation.x = Math.PI / 2;
    group.add(accretionDisk);

    // =========================================================
    // 4. LENSING HALO (Decoupled Material for independent flow)
    // =========================================================
    // Clone the material so the warped light flows at a different 
    // visual frequency than the main equatorial disk.
    const haloMat = diskMat.clone();
    const lensingHalo = new THREE.Mesh(diskGeo, haloMat);
    lensingHalo.rotation.y = 0.25; // increased offset for stronger gravitational warping illusion
    lensingHalo.rotation.x = Math.PI / 2;
    
    // Scale it slightly up to encapsulate the core better
    lensingHalo.scale.set(1.05, 1.05, 1.05); 
    group.add(lensingHalo);

    // =========================================================
    // 5. LIGHTING & ANIMATION LOOP
    // =========================================================
    const light = new THREE.PointLight(0xffddbb, 20, radius * 300);
    group.add(light);

    group.userData = {
        type: 'blackhole',
        name: config.name || 'The Great Singularity',
        r: radius * 20, 
        
        update: (timeElapsed) => {
            // 1. Drive shader time independently to simulate complex light paths
            diskMat.uniforms.uTime.value = timeElapsed * 0.0005;
            haloMat.uniforms.uTime.value = timeElapsed * 0.0007; 
            photonMat.uniforms.uTime.value = timeElapsed;

            // 2. Physically rotate the disk meshes for macro-dynamics
            // (Because they are rotated Math.PI/2 on X, rotating Z spins them like a record)
            accretionDisk.rotation.z -= 0.001;
            lensingHalo.rotation.z -= 0.0015; // Inner halo orbits slightly faster

            // 3. Keep the photon ring Fresnel effect perfectly aimed at the camera
            if (scene.camera) {
                photonMat.uniforms.viewVector.value = new THREE.Vector3().subVectors(
                    scene.camera.position, 
                    photonRing.position
                );
            }
        }
    };

    group.position.set(config.x, config.y, config.z);
    scene.add(group);

    // Prevent frustum culling disappearance 
    group.traverse((child) => {
        if (child.isMesh) {
            child.frustumCulled = false;
        }
    });

    return group;
}
