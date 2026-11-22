import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Creates a hyper-realistic, mobile-optimized refractive Wormhole
 */
export function createWormhole(scene, config = {}) {
    const group = new THREE.Group();

    // 🎯 Coords safety fallbacks
    const x = config.x || 0;
    const y = config.y || 0;
    const z = config.z || 0;

    // 1. THE CORE: Reduced geometry complexity (48x48) for smooth mobile FPS
    const wormholeGeo = new THREE.SphereGeometry(12000, 48, 48);
    const wormholeMat = new THREE.MeshPhysicalMaterial({
        transmission: 0.9,   // Glass-like transparency
        thickness: 35.0,     // Balanced refraction depth
        roughness: 0.05,     
        ior: 2.0,            // Diamond-like warp
        color: 0x00d4ff,     // Deep space cyan tint
        transparent: true,
        opacity: 0.8,
        depthWrite: false,   // 🎯 FIX: Prevents the core from blocking background depth sorting
        side: THREE.DoubleSide
    });

    const core = new THREE.Mesh(wormholeGeo, wormholeMat);
    core.name = "wormholeCore";
    group.add(core);

    // 2. THE GLOW: Additive aura
    const auraGeo = new THREE.SphereGeometry(12600, 32, 32);
    const auraMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false    // 🎯 FIX: Ensures the aura blends cleanly without square boundaries
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    group.add(aura);
     

    // 🎯 3. GAME STATE & DIRECT MESH REFERENCES
    group.userData = {
        type: 'wormhole',
        name: config.name || 'Wormhole Gate',
        category: 'EINSTEIN-ROSEN BRIDGE', 
        subText: 'SPACETIME ANOMALY',
        r: 200000, 
        sound: 'WORMHOLE_WARP',
        coreMesh: core,
        auraMesh: aura,
        isOpen: false,
        openProgress: 0.0
    };

    group.position.set(x, y, z);
    scene.add(group);

    return group;
}

/**
 * Handles the pulsing instability, rotation, and gate state
 */
export function updateWormhole(wormhole, time) {
    if (!wormhole) return;

    const data = wormhole.userData;

    // Smooth Sine wave open/close cycle (~25 second period)
    const cycle = Math.sin(time * 0.0004); 
    const scaleFactor = Math.max(0.001, (cycle + 1) / 2); // Ranges 0.0 to 1.0

    // Scale entire group
    wormhole.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // 🎯 Update State for HUD & Autopilot checking
    data.openProgress = scaleFactor;
    data.isOpen = scaleFactor > 0.82; // Gate opens for traversal at >82% scale

    // Fast direct lookup (zero scene-tree traversal overhead)
    const core = data.coreMesh;
    if (core) {
        core.rotation.y += 0.005;
        core.rotation.z += 0.003;

        // Modulate core opacity during pulse cycle
        core.material.opacity = 0.2 + (scaleFactor * 0.8);
    }
}

/**
 * 🚀 4K HYPER-WARP TRANSITION SEQUENCE
 * Wraps the camera in a procedural quantum tunnel and executes the location jump.
 */
export function triggerWormholeTransition(scene, camera, onTeleport) {
    const tunnelGeo = new THREE.CylinderGeometry(50, 50, 3000, 48, 1, true);
    tunnelGeo.rotateX(Math.PI / 2);

    const tunnelMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSpeed: { value: 1.0 },
            uFlash: { value: 0.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uSpeed;
            uniform float uFlash;
            varying vec2 vUv;

            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            void main() {
                vec2 uv = vUv;
                uv.y = fract(uv.y - (uTime * uSpeed));
                vec2 grid = vec2(floor(uv.x * 80.0), floor(uv.y * 5.0)); 
                float noise = random(grid);
                float star = smoothstep(0.85, 1.0, noise);
                float streakShape = smoothstep(0.0, 0.2, fract(uv.y * 5.0)) * smoothstep(1.0, 0.8, fract(uv.y * 5.0));
                star *= streakShape;

                vec3 color = mix(vec3(0.0, 0.5, 1.0), vec3(0.8, 0.9, 1.0), star);
                vec3 finalColor = color * star * 5.0;
                finalColor += vec3(1.0) * uFlash;
                
                float tubeFade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
                gl_FragColor = vec4(finalColor, tubeFade + uFlash);
            }
        `,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnel.frustumCulled = false;
    tunnel.renderOrder = 999;
    scene.add(tunnel);

    let startTime = Date.now();
    const duration = 3500;
    let hasTeleported = false;

    function animateWarp() {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;
        
        if (progress >= 1.0) {
            scene.remove(tunnel);
            tunnelGeo.dispose();
            tunnelMat.dispose();
            return; 
        }

        tunnel.position.copy(camera.position);
        tunnel.quaternion.copy(camera.quaternion);
        tunnel.translateZ(-500);

        tunnelMat.uniforms.uTime.value = elapsed * 0.001;
        tunnelMat.uniforms.uSpeed.value = 1.0 + (progress * 15.0); 
        
        if (progress > 0.4 && progress < 0.6) {
            tunnelMat.uniforms.uFlash.value = Math.sin((progress - 0.4) * 5.0 * Math.PI); 
        } else {
            tunnelMat.uniforms.uFlash.value = 0.0;
        }

        if (progress > 0.5 && !hasTeleported) {
            hasTeleported = true;
            if (onTeleport) onTeleport();
        }

        requestAnimationFrame(animateWarp);
    }

    animateWarp();
}
