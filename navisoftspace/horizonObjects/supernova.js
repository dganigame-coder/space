 import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSupernova(scene, config) {
    const group = new THREE.Group();

    // ⚙️ Extract Outside Parameters (With Safe Internal Fallbacks)
    const size = config.size !== undefined ? config.size : 10;
    const count = config.count !== undefined ? config.count : 200;
    const spread = config.spread !== undefined ? config.spread : 50;
    const colors = config.colors && config.colors.length > 0 ? config.colors : [0xffaa00, 0xff4400];
    
    // ⏱️ NEW: 60-Second Total Cycle (20 seconds per phase)
    const CYCLE_DURATION = 60.0; 
    const STABLE_END = 20.0;
    const EXPLOSION_END = 40.0;

    // 🎨 Canvas Texture Generator (For Gas Filaments)
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,100,0,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,0,0,0.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const dynamicTexture = new THREE.CanvasTexture(canvas);

    // ☀️ Procedural 3D Star Surface Texture Generator
    const starSurfaceCanvas = document.createElement('canvas');
    starSurfaceCanvas.width = 256; starSurfaceCanvas.height = 256;
    const sCtx = starSurfaceCanvas.getContext('2d');
    for (let x = 0; x < 256; x += 2) {
        for (let y = 0; y < 256; y += 2) {
            const noise = Math.floor(Math.random() * 75) + 180;
            sCtx.fillStyle = `rgb(${noise}, ${Math.floor(noise * 0.45)}, ${Math.floor(noise * 0.05)})`;
            sCtx.fillRect(x, y, 2, 2);
        }
    }
    const starSurfaceTexture = new THREE.CanvasTexture(starSurfaceCanvas);
    starSurfaceTexture.wrapS = THREE.RepeatWrapping;
    starSurfaceTexture.wrapT = THREE.RepeatWrapping;

    // 🛑 1. Central Star (Hyper-Realistic Double Shell Overhaul)
    const coreGeo = new THREE.SphereGeometry(size * 0.5, 64, 64); 
    
    // LAYER A: The Liquid Plasma Surface Core
    const coreMat = new THREE.MeshBasicMaterial({ 
        map: starSurfaceTexture, 
        transparent: true, 
        opacity: 1.0 
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
        // 🔥 NEW: 0.0166 assumes 60fps. This adds ~1.0 to age per second.
        group.userData.age = (group.userData.age + 0.0166) % CYCLE_DURATION;
        const age = group.userData.age;

        // 🔥 ANIMATION ENGINE FOR THE CORE TEXTURE
        starSurfaceTexture.offset.x += 0.0008;
        starSurfaceTexture.offset.y += 0.0004;
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
            coreMat.opacity = 1.0;
            coronaMat.opacity = 0.5;

            // Global material change (Ultra fast!)
            sharedMaterials.forEach(m => m.opacity = 0.0);
            spritesArray.forEach(s => { 
                s.position.set(0, 0, 0); 
            });
        } 

        // --- STAGE 2: EXPLOSION (20s - 40s) ---
        else if (age >= STABLE_END && age < EXPLOSION_END) {
            group.userData.state = 'EXPLODING';
            group.userData.timeToChange = (EXPLOSION_END - age).toFixed(1) + 's';
            
            // 🔥 NEW: Divisor changed to 20.0 to match the 20-second duration of this phase
            const p = (age - STABLE_END) / 20.0; 
            
            coreMesh.scale.setScalar(1.0 + (p * 8)); 
            coronaMesh.scale.setScalar((1.0 + (p * 8)) * 1.08);
            
            coreMat.opacity = 1.0 - p;
            coronaMat.opacity = (1.0 - p) * 0.5;

            // Global material change
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

            // Global material change
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
         
