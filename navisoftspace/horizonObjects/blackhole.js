import * as THREE from 'three';

export function createBlackHole(scene, config) {
    const group = new THREE.Group();
    const radius = config.size || 50000;

    // =========================================================
    // 1. THE SINGULARITY (Absolute Zero Light)
    // =========================================================
    const coreGeo = new THREE.SphereGeometry(radius, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // =========================================================
    // 2. THE PHOTON RING (Fresnel Edge Shader)
    // =========================================================
    // Simulates the blinding ring of trapped light exactly at the Event Horizon
    const photonGeo = new THREE.SphereGeometry(radius * 1.05, 64, 64);
    const photonMat = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(0xffaa55) },
            viewVector: { value: new THREE.Vector3() }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            varying vec3 vNormal;
            varying vec3 vPositionNormal;
            void main() {
                // Fresnel equation to calculate perfect glowing rim
                float intensity = pow(0.15 - dot(vNormal, vPositionNormal), 4.0);
                gl_FragColor = vec4(color * 2.0, intensity);
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
    // 3. 4K PROCEDURAL ACCRETION DISK (Custom WebGL Shader)
    // =========================================================
    const diskGeo = new THREE.RingGeometry(radius * 1.5, radius * 6, 128, 64);
    
    const diskMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uInnerRadius: { value: radius * 1.5 },
            uOuterRadius: { value: radius * 6.0 },
            uHotColor: { value: new THREE.Color(0xffffff) },  // Blinding white-hot inner edge
            uMidColor: { value: new THREE.Color(0xff6600) },  // Orange plasma
            uCoolColor: { value: new THREE.Color(0x330000) }  // Cooling deep red outer edge
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

            // GPU Noise Function (Replaces the lava image)
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
                // Circular coordinates
                vec2 center = vec2(0.5, 0.5);
                float dist = distance(vUv, center) * 2.0;
                float angle = atan(vUv.y - 0.5, vUv.x - 0.5);

                // Relativistic Doppler Beaming (Brighter on side spinning toward camera)
                float doppler = 1.0 + sin(angle) * 0.6; 
                
                // Plasma swirling math
                vec2 spiralUv = vec2(angle * 3.0 + uTime * 2.0, dist * 5.0 - uTime * 0.5);
                float plasma = fbm(spiralUv);

                // Temperature Gradient based on distance from singularity
                vec3 baseColor = mix(uHotColor, uMidColor, smoothstep(0.0, 0.5, dist));
                baseColor = mix(baseColor, uCoolColor, smoothstep(0.5, 1.0, dist));

                // Apply Doppler and Plasma texture
                vec3 finalColor = baseColor * plasma * doppler * 2.0;
                
                // Soften the inner and outer edges of the disk
                float alpha = smoothstep(0.0, 0.1, dist) * smoothstep(1.0, 0.8, dist);

                gl_FragColor = vec4(finalColor, alpha * plasma);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
    accretionDisk.rotation.x = Math.PI / 2; // Lay flat
    group.add(accretionDisk);

    // =========================================================
    // 4. LENSING HALO (The warped top/bottom visual)
    // =========================================================
    // Reusing the beautiful shader but projecting it vertically
    const lensingHalo = new THREE.Mesh(diskGeo, diskMat);
    lensingHalo.rotation.y = 0.15; // Slight offset so it bends around the sphere
    group.add(lensingHalo);

    // =========================================================
    // 5. LIGHTING & DATA EXPORT
    // =========================================================
    const light = new THREE.PointLight(0xffaa55, 15, radius * 200);
    group.add(light);

    group.userData = {
        type: 'blackhole',
        name: config.name || 'The Great Singularity',
        r: radius * 20, 
        
        // 🔥 CRUCIAL: The animation loop updates the Shader time!
        update: (time) => {
            diskMat.uniforms.uTime.value = time * 0.0005;
            
            // Keep the photon ring Fresnel effect perfectly aimed at the camera
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

    // 🎯 ADD THIS RIGHT HERE: 
    // This tells Three.js to NEVER hide any part of the black hole, 
    // stopping it from disappearing when you look at it or move the camera.
    group.traverse((child) => {
        if (child.isMesh) {
            child.frustumCulled = false;
        }
    });

    return group;
}
