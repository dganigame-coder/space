import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSupernova(scene, config) {
    const group = new THREE.Group();

    // ⚙️ Extract Outside Parameters (With Safe Internal Fallbacks)
    const size = config.size !== undefined ? config.size : 10;
    const count = config.count !== undefined ? config.count : 200;
    const spread = config.spread !== undefined ? config.spread : 50;
    const colors = config.colors && config.colors.length > 0 ? config.colors : [0xffaa00, 0xff4400];
    
    // ⏱️ 60-Second Total Cycle (20 seconds per phase)
    const CYCLE_DURATION = 60.0; 
    const STABLE_END = 20.0;
    const EXPLOSION_END = 40.0;

    // 🎨 4K Canvas Texture Generator (For Gas Filaments)
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 2048; // Upgraded to 4K fidelity
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(1024, 1024, 0, 1024, 1024, 1024);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,100,0,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,0,0,0.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2048, 2048);
    const dynamicTexture = new THREE.CanvasTexture(canvas);

    // 🛑 1. Central Star (Hyper-Realistic Double Shell Overhaul)
    // Upgraded segments to 256 for perfectly smooth 4K silhouettes
    const coreGeo = new THREE.SphereGeometry(size * 0.5, 256, 256); 
    
    // 💥 HYPERREALISTIC UPGRADE: GPU-Accelerated fBM Plasma Shader
    const coreMat = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            baseColor: { value: new THREE.Color(colors[0]) },
            opacity: { value: 1.0 }
        },
        transparent: true,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 baseColor;
            uniform float opacity;
            varying vec2 vUv;

            // Random hash function
            float hash(vec2 p) { 
                return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); 
            }
            // 2D Noise
            float noise(vec2 x) {
                vec2 i = floor(x);
                vec2 f = fract(x);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
            }
            // Fractional Brownian Motion (fBM)
            float fbm(vec2 p) {
                float v = 0.0; float a = 0.5;
                mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                for (int i = 0; i < 6; ++i) {
                    v += a * noise(p); 
                    p = rot * p * 2.0 + 100.0; 
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec2 uv = vUv * 4.0; // Scale plasma
                float n = fbm(uv + time * 0.2);
                float n2 = fbm(uv * 2.0 - time * 0.3);
                float fire = pow(n * n2, 0.6) * 2.5; // Create intense heat spots
                
                // Final color composition
                gl_FragColor = vec4(baseColor * fire, opacity);
            }
        `
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // LAYER B: Volumetric Atmosphere/Corona Glow
    const coronaMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colors[0]),
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending, 
        side: THREE.BackSide 
    });
    const coronaMesh = new THREE.Mesh(coreGeo.clone(), coronaMat);
    coronaMesh.scale.setScalar(1.08); 
    group.add(coronaMesh);

    // ⚡ OPTIMIZATION: Materials are shared directly by references to maximize WebGL batching
    const sharedMaterials = colors.map(color => {
        return new THREE.SpriteMaterial({
            map: dynamicTexture,
            color: color,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending
        });
    });

    // 2. Gas Filaments Setup
    const spritesArray = [];
    for (let i = 0; i < count; i++) {
        const baseMat = sharedMaterials[Math.floor(Math.random() * sharedMaterials.length)];
        const sprite = new THREE.Sprite(baseMat); 
        
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        sprite.userData = {
            direction: new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)),
            baseSpread: spread
        };
        
        sprite.scale.set(size * 2, size * 2, 1);
        group.add(sprite);
        spritesArray.push(sprite);
    }

    group.position.set(config.x || 0, config.y || 0, config.z || 0);
    
    group.userData = { 
        type: 'supernova', 
        name: config.name || 'Unnamed Star',
        radius: size * 0.5,
        age: Math.random() * CYCLE_DURATION, 
        state: 'MAIN_SEQUENCE' 
    };
  
    // 3. Lifecycle Update Loop
    group.onUpdate = () => {
        // 0.0166 assumes 60fps, meaning age counts up by ~1.0 per real-world second
        group.userData.age = (group.userData.age + 0.0166) % CYCLE_DURATION;
        const age = group.userData.age;

        // 🔥 ANIMATION ENGINE
        coreMat.uniforms.time.value += 0.01; // Drive the shader plasma animation
        coreMesh.rotation.y += 0.001;
        coronaMesh.rotation.z -= 0.0005; 

        // --- STAGE 1: STABLE STAR (0s - 20s) ---
        if (age < STABLE_END) {
            group.userData.state = 'STABLE';
            group.userData.timeToChange = (STABLE_END - age).toFixed(1) + 's';
            
            coreMesh.visible = true;
            coronaMesh.visible = true;
            coreMesh.scale.setScalar(1.0);
            coronaMesh.scale.setScalar(1.08);
            
            coreMat.uniforms.opacity.value = 1.0;
            coronaMat.opacity = 0.5;

            // Global material change (Ultra fast batching)
            sharedMaterials.forEach(m => m.opacity = 0.0);
            spritesArray.forEach(s => { 
                s.position.set(0, 0, 0); 
            });
        } 

        // --- STAGE 2: EXPLOSION (20s - 40s) ---
        else if (age >= STABLE_END && age < EXPLOSION_END) {
            group.userData.state = 'EXPLODING';
            group.userData.timeToChange = (EXPLOSION_END - age).toFixed(1) + 's';
            
            const p = (age - STABLE_END) / 20.0; // Scaled to the 20-second duration
            
            coreMesh.scale.setScalar(1.0 + (p * 8)); 
            coronaMesh.scale.setScalar((1.0 + (p * 8)) * 1.08);
            
            coreMat.uniforms.opacity.value = 1.0 - p;
            coronaMat.opacity = (1.0 - p) * 0.5;

            sharedMaterials.forEach(m => m.opacity = p * 0.8);
            spritesArray.forEach(s => {
                s.position.copy(s.userData.direction).multiplyScalar(spread * p);
            });
        } 

        // --- STAGE 3: LINGERING NEBULA (40s - 60s) ---
        else {
            group.userData.state = 'NEBULA';
            group.userData.timeToChange = (CYCLE_DURATION - age).toFixed(1) + 's';
            
            coreMesh.visible = false;
            coronaMesh.visible = false;

            const nebulaAge = age - EXPLOSION_END; 

            sharedMaterials.forEach(m => m.opacity = 0.25);
            spritesArray.forEach((s) => {
                const drift = Math.sin(nebulaAge * 0.1) * (spread * 0.1);
                s.position.copy(s.userData.direction).setLength(spread + drift);
            });
        }
    };

    scene.add(group);
    return group;
}
