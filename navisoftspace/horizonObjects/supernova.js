import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSupernova(scene, config) {
    const group = new THREE.Group();

    // ============================================================
    // 🎨 PURE MATHEMATICAL LENS FLARE GENERATOR (No Image Files Needed!)
    // ============================================================
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Create a smooth radial gradient fading out to pure transparency at the edges
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');     // Blinding hot center
    gradient.addColorStop(0.2, 'rgba(255,100,0,0.8)');   // Vibrant orange corona
    gradient.addColorStop(0.5, 'rgba(255,0,0,0.2)');     // Fading red edge
    gradient.addColorStop(1, 'rgba(0,0,0,0)');           // Pure vacuum alpha cut
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    // Convert the canvas directly into a hardware-accelerated WebGL texture
    const dynamicTexture = new THREE.CanvasTexture(canvas);

    // ============================================================
    // 1. THE CENTRAL STAR MESH
    // ============================================================
    const coreGeo = new THREE.SphereGeometry(config.size * 0.5, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 1.0 
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // ============================================================
    // 2. THE HIGH-VISIBILITY GAS FILAMENTS
    // ============================================================
    const spritesArray = [];
    for (let i = 0; i < config.count; i++) {
        const material = new THREE.SpriteMaterial({
            map: dynamicTexture, // Feeds our local canvas texture straight to the GPU
            color: config.colors[Math.floor(Math.random() * config.colors.length)],
            transparent: true,
            opacity: 0.0, 
            blending: THREE.AdditiveBlending 
        });

        const sprite = new THREE.Sprite(material);
        
        // Calculate outer sphere coordinate distribution vectors
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        const direction = new THREE.Vector3(
            Math.sin(theta) * Math.cos(phi),
            Math.sin(theta) * Math.sin(phi),
            Math.cos(theta)
        );

        sprite.scale.set(config.size * 4, config.size * 4, 1);
        
        sprite.userData = {
            direction: direction,
            baseSpread: config.spread,
            randomFactor: 0.8 + Math.random() * 0.4
        };

        group.add(sprite);
        spritesArray.push(sprite);
    }

    // ============================================================
    // 3. ENGINE ANCHORING & LIFECYCLE STATE VARIABLES
    // ============================================================
    group.position.set(config.x, config.y, config.z);
    
    group.userData = { 
        type: 'supernova', 
        name: config.name,
        age: Math.random() * 300.0,
        state: 'MAIN_SEQUENCE'
    };

    group.onUpdate = () => {
        // 1. AUTO-LOOP TIMER: Reset after 300 seconds
        const CYCLE_DURATION = 300.0;
        group.userData.age = (group.userData.age + 0.01) % CYCLE_DURATION;
        const age = group.userData.age;
    
        // 2. RESET TRANSITION
        if (age < 0.1) {
            coreMesh.scale.setScalar(1.0);
            spritesArray.forEach(s => { s.material.opacity = 0; s.position.set(0, 0, 0); });
        }
    
        // --- STATE 1: ALIVE STAR ---
        else if (age < 2.0) {
            coreMat.color.setHex(0xffaa00);
            spritesArray.forEach(sprite => {
                sprite.position.set(0, 0, 0);
                sprite.material.opacity = 0;
            });
        }
    
        // --- STATE 2: BLINDING BLAST DETONATION ---
        else if (age >= 2.0 && age < 3.0) {
            coreMat.color.setHex(0xffffff);
            coreMesh.scale.setScalar(3.0);
            spritesArray.forEach(sprite => { sprite.material.opacity = 0.6; });
        }
    
        // --- STATE 3: EXPANDING PLASMA SHOCKWAVE ---
        else if (age >= 3.0 && age < 7.0) {
            const progression = (age - 3.0) / 4.0; 
            coreMat.color.setHex(0xff3300);
            coreMesh.scale.setScalar(3.0 * (1.0 - progression));
    
            spritesArray.forEach(sprite => {
                const maxDistance = sprite.userData.baseSpread * sprite.userData.randomFactor;
                const currentDistance = maxDistance * progression;
                sprite.position.copy(sprite.userData.direction).multiplyScalar(currentDistance);
                sprite.material.opacity = 0.5 * (1.0 - progression);
            });
        }
    
        // --- STATE 4: DEAD HOLE SINGULARITY ---
        else {
            group.userData.state = 'SINGULARITY';
            coreMesh.scale.setScalar(1.0);
            coreMat.color.setHex(0x000000); 
            
            spritesArray.forEach((sprite, idx) => {
                // 1. DATA INITIALIZATION
                if (!sprite.userData.radius) sprite.userData.radius = (config.size * 1.2) + (idx * 0.2);
                
                // 2. RADIAL PULL: Slowly shrink the orbit radius over time (The "Fall")
                sprite.userData.radius -= 0.05; 
                if (sprite.userData.radius < 0.5) sprite.userData.radius = (config.size * 1.2); // Reset if it hits center
                
                const r = sprite.userData.radius;
                const distFactor = 1 - (r / (config.size * 2)); // 0 = far, 1 = near center
                
                // 3. KEPLERIAN MOTION
                const orbitalSpeed = 0.05 / Math.sqrt(r);
                const angle = (idx * 0.1) + (performance.now() * orbitalSpeed);
                
                // 4. TIDAL STRETCH (Spaghettification)
                // Stretch X (movement direction) and shrink Y (vertical)
                const stretchFactor = 1.0 + (distFactor * 2.0); 
                
                sprite.position.set(
                    Math.cos(angle) * r, 
                    (Math.random() - 0.5) * (config.size * 0.02), 
                    Math.sin(angle) * r
                );
                
                // 5. DYNAMIC SCALING
                const baseScale = (1.2 - distFactor) * config.size;
                sprite.scale.set(baseScale * stretchFactor, baseScale / stretchFactor, 1);
                
                // 6. THERMAL FADE (Hotter/brighter as it nears the center)
                const hue = 0.6 - (distFactor * 0.5); // Blue to White
                sprite.material.color.setHSL(hue, 1.0, 0.5 + (distFactor * 0.4));
                sprite.material.opacity = 0.3 + (distFactor * 0.6);
            });
    };
    
    scene.add(group);
    return group;
}
