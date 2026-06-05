import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createProtoplanetaryDisk(scene, config) {
    const group = new THREE.Group();

    // 1. Configuration Parameter Extraction (with safe defaults)
    const pos = new THREE.Vector3(config.x || 0, config.y || 0, config.z || 0);
    const starColor = config.colors[0] || 0xffaa00; 
    
    // Scale Parameters (handling massive cosmic units gracefully)
    const diskSize = config.spread || 5000000;
    const innerRadius = diskSize * (0.05 + Math.random() * 0.1); 
    const outerRadius = diskSize;
    
    // Particle count handles high ranges (e.g., up to 60,000+ for a truly gaseous look)
    const count = config.count || 40000; 
    const pointSize = config.size || 50000; 
    
    const starSize = config.starSize || (diskSize * 0.02); 
    const rotationSpeed = config.rotationSpeed || 0.0005;
    
    const palette = config.colors.map(c => new THREE.Color(c));

    // 2. RANDOMIZATION MAGIC: Generate Unique Void/Gap Structures
    const gapZones = [];
    const numGaps = Math.floor(Math.random() * 3); 
    
    for (let i = 0; i < numGaps; i++) {
        const gapStartPerc = 0.2 + (Math.random() * 0.6); 
        const gapWidthPerc = 0.05 + (Math.random() * 0.1); 
        
        const gapStartRad = innerRadius + (outerRadius - innerRadius) * gapStartPerc;
        const gapEndRad = gapStartRad + (diskSize * gapWidthPerc);
        
        gapZones.push({ start: gapStartRad, end: gapEndRad });
    }

    // 3. OPTIMIZED SPRITE GENERATOR (Creates fuzzy, overlapping celestial gas)
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');    
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)'); 
    gradient.addColorStop(1, 'rgba(0,0,0,0)');          
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const spriteTexture = new THREE.CanvasTexture(canvas);

    // 4. MATHEMATICAL PARTICLE DISTRIBUTION (Pre-allocated Typed Arrays for Speed)
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const distributionBias = 1.6; 

    const arms = 2;       // Total number of twisting spiral arms
    const spin = 2.5;     // Determines how aggressively the spiral wraps around the star
    let activeCount = 0;  // Keeps track of valid points that didn't land in a ring gap

    for (let i = 0; i < count; i++) {
        let radius = innerRadius + (outerRadius - innerRadius) * Math.pow(Math.random(), distributionBias);
        
        // Gap Zone Elimination Filter
        if (gapZones.length > 0) {
            let inGap = false;
            for (let gap of gapZones) {
                if (radius >= gap.start && radius <= gap.end) {
                    if (Math.random() > 0.08) inGap = true; 
                    break;
                }
            }
            if (inGap) continue; 
        }

        // --- Logarithmic Spiral Calculations ---
        const armAngle = ((i % arms) * 2 * Math.PI) / arms;
        const normalizedRadius = radius / outerRadius;
        const spiralAngle = normalizedRadius * spin * Math.PI;

        // Thickness settings (Fades out scatter density towards the outer rim)
        const thicknessMod = 1.0 - normalizedRadius; 
        const scatterScale = radius * 0.15 * thicknessMod;

        // Adds fluid gas-cloud scatter offset
        const randomX = (Math.random() - 0.5) * Math.pow(Math.random(), 2) * scatterScale;
        const randomY = (Math.random() - 0.5) * Math.pow(Math.random(), 2) * (diskSize * 0.015) * thicknessMod; 
        const randomZ = (Math.random() - 0.5) * Math.pow(Math.random(), 2) * scatterScale;

        const finalAngle = armAngle + spiralAngle;
        const x = Math.cos(finalAngle) * radius + randomX;
        const y = randomY;              
        const z = Math.sin(finalAngle) * radius + randomZ;  

        // Insert coordinates into flat layout array
        positions[activeCount * 3] = x;
        positions[activeCount * 3 + 1] = y;
        positions[activeCount * 3 + 2] = z;

        // Color Variation System
        const baseColor = palette[Math.floor(Math.random() * palette.length)] || palette[0];
        const colorVariation = 0.8 + (Math.random() * 0.4); 
        
        colors[activeCount * 3] = baseColor.r * colorVariation;
        colors[activeCount * 3 + 1] = baseColor.g * colorVariation;
        colors[activeCount * 3 + 2] = baseColor.b * colorVariation;

        activeCount++;
    }

    // Shrink allocation arrays down to slice off leftover gaps space
    const finalPositions = new Float32Array(positions.buffer, 0, activeCount * 3);
    const finalColors = new Float32Array(colors.buffer, 0, activeCount * 3);

    // 5. COMPILE INTO OPTIMIZED SYSTEM POINTS
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(finalPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(finalColors, 3)); 

    const material = new THREE.PointsMaterial({
        size: pointSize,
        map: spriteTexture,
        transparent: true,
        blending: THREE.AdditiveBlending, // Overlapping dust intensities glow like hot gas
        vertexColors: true, 
        depthWrite: false                 // Vaporizes black square clipping artifacts completely
    });

    const diskPoints = new THREE.Points(geometry, material);
    
    // 🛡️ FIX 1: Frustum Culling Bypass (Stops the disk from disappearing at camera edges)
    diskPoints.frustumCulled = false; 
    
    group.add(diskPoints);
 
    // 6. CENTRAL PROTOSTAR CORE 
    const starGeo = new THREE.SphereGeometry(starSize, 32, 32); 
    const starMat = new THREE.MeshBasicMaterial({ 
        color: starColor,
        transparent: true, 
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    group.add(starMesh);

    // Base placement adjustments
    group.position.set(pos.x, pos.y, pos.z);
    
    // Swirling Animation Loop
    group.onUpdate = () => {
        diskPoints.rotation.y += rotationSpeed; 
    };

    // Diagnostics Payload Mapping
    group.userData = {
        name: config.name || "Unknown Protoplanetary Disk",
        type: "Protoplanetary Disk",
        spread: diskSize,
        particleCount: activeCount
    };

    // 🧹 FIX 2: Bulletproof GPU Cleanup Kill-Switch (Wipes card allocations clean)
    group.dispose = () => {
        geometry.dispose();
        material.dispose();
        spriteTexture.dispose();
        starGeo.dispose();
        starMat.dispose();
    };

    scene.add(group);
    return group;
}
