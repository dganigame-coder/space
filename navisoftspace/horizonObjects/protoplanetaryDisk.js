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
    
    // Available Palette (picks random variations from provided array)
    const palette = config.colors.map(c => new THREE.Color(c));

    // 🌟 2. RANDOMIZATION MAGIC: Generate the unique Gap Structures
    // Defines where planets have cleared the dust. Varied on every call.
    const gapZones = [];
    // Randomly decide how many gaps (0 to 3) this specific disk has
    const numGaps = Math.floor(Math.random() * 3); 
    
    for (let i = 0; i < numGaps; i++) {
        const gapStartPerc = 0.2 + (Math.random() * 0.6); // Gap is located between 20%-80% radius
        const gapWidthPerc = 0.05 + (Math.random() * 0.1); // Gap cleared lane is 5%-15% of width
        
        const gapStartRad = innerRadius + (outerRadius - innerRadius) * gapStartPerc;
        const gapEndRad = gapStartRad + (diskSize * gapWidthPerc);
        
        gapZones.push({ start: gapStartRad, end: gapEndRad });
    }

    // 🎨 3. Optimized Sprite Generator (Standard glowing dust circle)
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');    // White hot core
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)'); // Soft edge bleed
    gradient.addColorStop(1, 'rgba(0,0,0,0)');          // Transparency
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const spriteTexture = new THREE.CanvasTexture(canvas);

    // 🌟 4. Mathematical Particle Distribution Algorithm
    const vertices = [];
    const colors = [];

    // Bias parameter: Makes it much denser near the center
    const distributionBias = 1.6; 

    for (let i = 0; i < count; i++) {
        // A. Generate Radius with Bias Toward Center (inverse exponential curve)
        let radius = innerRadius + (outerRadius - innerRadius) * Math.pow(Math.random(), distributionBias);
        
        // B. Gap Checking Logic: If particle falls in a dark lane, discard it or reduce density
        if (gapZones.length > 0) {
            let inGap = false;
            for (let gap of gapZones) {
                if (radius >= gap.start && radius <= gap.end) {
                    // Decide whether to actually clear it completely (dramatize)
                    // Allows some "dust motes" to remain in gaps (realistic)
                    if (Math.random() > 0.08) inGap = true; 
                    break;
                }
            }
            if (inGap) continue; // Skip generating this point entirely
        }

        // C. Generate Rotation Position
        const angle = Math.random() * Math.PI * 2;
        
        // D. Generate Thickness position (Z-axis offset)
        // Disks are very thin, but thickest near the core.
        const thicknessMod = 1.0 - (radius / outerRadius); // 1 near center, 0 at outer edge
        const spreadY = (diskSize * 0.01) * thicknessMod; // 1% of size spread near core
        const yOffset = (Math.random() - 0.5) * 2.0 * spreadY;

        // Final Coordinate (Swirling around central point)
        vertices.push(
            Math.cos(angle) * radius, // X position
            yOffset,                  // Z position (up/down) - assuming flat y-plane
            Math.sin(angle) * radius  // Z position (forward/back)
        );

        // E. Assign Randomized Vertex Colors
        // Picks randomly from your palette array
        const baseColor = palette[Math.floor(Math.random() * palette.length)] || palette[0];
        
        // Optimization: Slights randomize color variation per vertex for rich look
        const colorVariation = 0.8 + (Math.random() * 0.4); // Stretches color saturation 80%-120%
        colors.push(
            baseColor.r * colorVariation, 
            baseColor.g * colorVariation, 
            baseColor.b * colorVariation
        );
    }

    // 🌟 5. Compile into Optimized THREE.Points
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); // Enable Vertex Colors!

    const material = new THREE.PointsMaterial({
        size: pointSize,
        map: spriteTexture,
        transparent: true,
        blending: THREE.AdditiveBlending, // Makes the dust glow beautifully
        vertexColors: true, // Crucial: Tells shader to use the precomputed vertex colors
        depthWrite: false   // Prevents particle edges from blocking particles behind them
    });

    const diskPoints = new THREE.Points(geometry, material);
    group.add(diskPoints);

    // 🌟 6. Central Protostar Core (Glow shell only)
    const starGeo = new THREE.SphereGeometry(size, 32, 32); 
    const starMat = new THREE.MeshBasicMaterial({ 
        color: starColor,
        transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    group.add(starMesh);


    // Setting final position from config payload
    group.position.set(pos.x, pos.y, pos.z);
    
    // Swirling Animation Loop
    group.onUpdate = () => {
        diskPoints.rotation.y += (rotationSpeed || 0.0003); // Spins slowly around the center star
    };

    scene.add(group);
    return group;
}
