import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSupernova(scene, config) {
    const group = new THREE.Group();
    const loader = new THREE.TextureLoader();
    
    // Lens flare map for bright star cores & hot gas filaments
    const flareTex = loader.load('https://threejs.org/examples/textures/lensflare/lensflare0.png');

    // 1. THE STELLAR COMPACT CORE (The Star / Black Hole visual)
    const coreGeo = new THREE.SphereGeometry(config.size * 0.5, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // 2. THE MULTI-FILAMENT SHOCKWAVE SHELL (The Sprite Cloud)
    const spritesArray = [];
    for (let i = 0; i < config.count; i++) {
        const material = new THREE.SpriteMaterial({
            map: flareTex,
            color: config.colors[Math.floor(Math.random() * config.colors.length)],
            transparent: true,
            opacity: 0.0, // Starts invisible, births dynamically during explosion
            blending: THREE.AdditiveBlending 
        });

        const sprite = new THREE.Sprite(material);
        
        // Sphere surface distribution vectors
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        // Store vector direction for expansion over time
        const direction = new THREE.Vector3(
            Math.sin(theta) * Math.cos(phi),
            Math.sin(theta) * Math.sin(phi),
            Math.cos(theta)
        );

        sprite.scale.set(config.size * 3, config.size * 3, 1);
        
        // Custom physics variables for the state engine
        sprite.userData = {
            direction: direction,
            baseSpread: config.spread,
            randomFactor: 0.8 + Math.random() * 0.4,
            speed: 0.005 + Math.random() * 0.01
        };

        group.add(sprite);
        spritesArray.push(sprite);
    }

    // 3. THE DISTANT BEACON (Dynamic illumination controller)
    const coreLight = new THREE.PointLight(0xffffff, 2, config.spread * 15);
    group.add(coreLight);

    // Position and initialize state tracking parameters
    group.position.set(config.x, config.y, config.z);
    
    group.userData = { 
        type: 'supernova', 
        name: config.name,
        // TIMELINE VARIABLES
        age: 0.0,             // Progresses from 0.0 upwards
        state: 'MAIN_SEQUENCE' // States: MAIN_SEQUENCE -> DETONATION -> SHOCKWAVE -> COLLAPSE -> SINGULARITY
    };

    /**
     * 🔄 THE REAL-TIME STATE MACHINE LOOP
     * Hook this method directly into your main requestAnimationFrame update cycle
     */
    group.onUpdate = () => {
        // Increment global time factor
        group.userData.age += 0.005; 
        const age = group.userData.age;

        // ============================================================
        // STATE 1: MAIN SEQUENCE STAR (Age: 0.0 to 2.0)
        // Normal glowing star, shell is hidden, core is standard size
        // ============================================================
        if (age < 2.0) {
            group.userData.state = 'MAIN_SEQUENCE';
            coreMat.color.setHex(0xffaa00); // Yellow/Orange star
            coreLight.intensity = 5;
            
            // Keep sprites nested flat inside the core awaiting blast
            spritesArray.forEach(sprite => {
                sprite.position.set(0, 0, 0);
                sprite.material.opacity = 0;
            });
        }
        // ============================================================
        // STATE 2: SUPERNOVA DETONATION (Age: 2.0 to 3.0)
        // Star flashes violently, blinding light, shockwave unleashes
        // ============================================================
        else if (age >= 2.0 && age < 3.0) {
            group.userData.state = 'DETONATION';
            
            // Blinding visual flash progression
            coreMat.color.setHex(0xffffff);
            coreMesh.scale.setScalar(2.5); // Core swells violently
            coreLight.intensity = 150;     // Pierces across the space grid
            
            // Rapidly fade in the cloud sprites
            spritesArray.forEach(sprite => {
                sprite.material.opacity = 0.4;
            });
        }
        // ============================================================
        // STATE 3: EXPANDING SHOCKWAVE NEBULA (Age: 3.0 to 7.0)
        // Core begins dimming, gas shell blasts outwards to maximum spread
        // ============================================================
        else if (age >= 3.0 && age < 7.0) {
            group.userData.state = 'SHOCKWAVE';
            
            // Smooth transition mapping from 0.0 to 1.0 across the lifecycle duration
            const progression = (age - 3.0) / 4.0; 
            
            coreLight.intensity = 50 * (1.0 - progression); // Fade down the star flash
            coreMat.color.setHex(0xff3300); // Fades into an unstable red core remnant

            // Expand each individual filament particle outwards dynamically
            spritesArray.forEach(sprite => {
                const maxDistance = sprite.userData.baseSpread * sprite.userData.randomFactor;
                const currentDistance = maxDistance * progression;
                
                sprite.position.copy(sprite.userData.direction).multiplyScalar(currentDistance);
                
                // Dissolve gas thickness gracefully as it moves farther away
                sprite.material.opacity = 0.3 * (1.0 - progression);
            });
        }
        // ============================================================
        // STATE 4: GRAVITATIONAL COLLAPSE (Age: 7.0 to 9.0)
        // The core implodes rapidly, pulling gas components back into center
        // ============================================================
        else if (age >= 7.0 && age < 9.0) {
            group.userData.state = 'COLLAPSE';
            
            const collapseFactor = (age - 7.0) / 2.0; // Implosion linear modifier
            const reverseFactor = 1.0 - collapseFactor;

            coreMesh.scale.setScalar(2.5 * reverseFactor); // Core rapidly shrinks to zero
            coreMat.color.setHex(0x330099); // Shifts to ultra-hot violet before vanishing
            coreLight.intensity = 10 * reverseFactor;

            // Pull leftover particles back to central zero point rapidly
            spritesArray.forEach(sprite => {
                const currentPos = sprite.position.clone();
                sprite.position.copy(currentPos.multiplyScalar(reverseFactor));
                sprite.material.opacity = 0.05 * reverseFactor;
            });
        }
        // ============================================================
        // STATE 5: CLASS-G SINGULARITY BLACK HOLE (Age: 9.0+)
        // Star is completely dead. Replaced by a pitch black event horizon
        // ============================================================
        else {
            group.userData.state = 'SINGULARITY';
            
            coreMesh.scale.setScalar(1.2); 
            coreMat.color.setHex(0x000000); // 🕳️ PURE BLACK HOLE EXTINCTION
            coreMat.opacity = 1.0;
            
            coreLight.intensity = 0; // Black holes emit zero visible light channels

            // Repurpose some sprites to look like a subtle, spinning purple accretion disk
            spritesArray.forEach((sprite, idx) => {
                sprite.material.color.setHex(0x6600ff); // Gravitational radiation purple
                sprite.material.opacity = 0.06;
                
                // Arrange flat into an orbiting disk ring layout structure around center
                const ringRadius = (config.size * 2) + (idx * 5);
                const speed = 0.05;
                const angle = (idx * 0.1) + (performance.now() * 0.002);
                
                sprite.position.set(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
                sprite.scale.set(config.size, config.size, 1);
            });
        }
    };

    console.log(`🚀 [Dynamic State System] ${config.name} initialized active.`);
    scene.add(group);
    return group;
}
