import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createProtoplanetaryDisk(scene, config) {
    const group = new THREE.Group();

    // 1. Configuration Parameter Extraction (with safe defaults)
    const pos = new THREE.Vector3(config.x || 0, config.y || 0, config.z || 0);
    const starColor = config.colors[0] || 0xffaa00; // The primary color for the central star
    
    // Scale Parameters (handling your massive numbers)
    const diskSize = config.spread || 5000000;
    const innerRadius = diskSize * (0.05 + Math.random() * 0.1); // Small randomized inner void
    const outerRadius = diskSize;
    
    // Density (count) handles your massive counts (1200+) well
    const count = config.count || 1000; 
    const pointSize = config.size || 50000; // Size of individual dust sprites
    
    // 🌟 FIX 1: Explicitly define the star core size and rotation speed
    const starSize = config.starSize || (diskSize * 0.02); // 2% of total disk size
    const rotationSpeed = config.rotationSpeed || 0.0005;
    
    // Available Palette (picks random variations from provided array)
    const palette = config.colors.map(c => new THREE.Color(c));

    // 🌟 2. RANDOMIZATION MAGIC: Generate the unique Gap Structures
    const gapZones = [];
    const numGaps = Math.floor(Math.random() * 3); 
    
    for (let i = 0; i < numGaps; i++) {
        const gapStartPerc = 0.2 + (Math.random() * 0.6); 
        const gapWidthPerc = 0.05 + (Math.random() * 0.1); 
        
        const gapStartRad = innerRadius + (outerRadius - innerRadius) * gapStartPerc;
        const gapEndRad = gapStartRad + (diskSize * gapWidthPerc);
        
        gapZones.push({ start: gapStartRad, end: gapEndRad });
    }

    // 🎨 3. Optimized Sprite Generator
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

    // 🌟 4. Mathematical Particle Distribution Algorithm
    const vertices = [];
    const colors = [];
    const distributionBias = 1.6; 

    for (let i = 0; i < count; i++) {
        let radius = innerRadius + (outerRadius - innerRadius) * Math.pow(Math.random(), distributionBias);
        
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

        const angle = Math.random() * Math.PI * 2;
        const thicknessMod = 1.0 - (radius / outerRadius); 
        const spreadY = (diskSize * 0.01) * thicknessMod; 
        const yOffset = (Math.random() - 0.5) * 2.0 * spreadY;

        vertices.push(
            Math.cos(angle) * radius, 
            yOffset,                  
            Math.sin(angle) * radius  
        );

        const baseColor = palette[Math.floor(Math.random() * palette.length)] || palette[0];
        const colorVariation = 0.8 + (Math.random() * 0.4); 
        colors.push(
            baseColor.r * colorVariation, 
            baseColor.g * colorVariation, 
            baseColor.b * colorVariation
        );
    }

    // 🌟 5. Compile into Optimized THREE.Points
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); 

    const material = new THREE.PointsMaterial({
        size: pointSize,
        map: spriteTexture,
        transparent: true,
        blending: THREE.AdditiveBlending, 
        vertexColors: true, 
        depthWrite: false   
    });

    const diskPoints = new THREE.Points(geometry, material);
    group.add(diskPoints);
 
    // 🌟 6. Central Protostar Core (Using the fixed starSize variable)
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

    // Setting final position from config payload
    group.position.set(pos.x, pos.y, pos.z);
    
    // 🌟 FIX 2: Swirling Animation Loop (Using the fixed rotationSpeed variable)
    group.onUpdate = () => {
        diskPoints.rotation.y += rotationSpeed; 
    };

    // 🌟 ADDED FOR THE MONITOR: Assigns the payload name directly to the object
    group.userData = {
        name: config.name || "Unknown Protoplanetary Disk",
        type: "Protoplanetary Disk",
        spread: diskSize,
        particleCount: count
    };

    scene.add(group);
    return group;
}
