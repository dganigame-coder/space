import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createProtoplanetaryDisk(scene, config) {
    const group = new THREE.Group();

    const pos = new THREE.Vector3(config.x || 0, config.y || 0, config.z || 0);
    const starColor = config.colors[0] || 0xffaa00; 
    
    const diskSize = config.spread || 5000000;
    const innerRadius = diskSize * 0.01; 
    const outerRadius = diskSize;
    
    const count = config.count || 60000; 
    const pointSize = config.size || 650000; 
    
    const starSize = config.starSize || (diskSize * 0.02); 
    const rotationSpeed = config.rotationSpeed || 0.0005;
    const palette = config.colors.map(c => new THREE.Color(c));

    // Dynamic Gaps System
    const gapZones = [];
    const numGaps = Math.floor(Math.random() * 2); 
    for (let i = 0; i < numGaps; i++) {
        const gapStartPerc = 0.3 + (Math.random() * 0.4); 
        const gapWidthPerc = 0.04 + (Math.random() * 0.06); 
        const gapStartRad = innerRadius + (outerRadius - innerRadius) * gapStartPerc;
        const gapEndRad = gapStartRad + (diskSize * gapWidthPerc);
        gapZones.push({ start: gapStartRad, end: gapEndRad });
    }

    // Fuzzy Glow Sprite Generator
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');    
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.08)'); 
    gradient.addColorStop(1, 'rgba(0,0,0,0)');          
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const spriteTexture = new THREE.CanvasTexture(canvas);

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    const distributionBias = 2.0; 
    const arms = 2;       
    const spin = 2.2;     
    let activeCount = 0;  

    for (let i = 0; i < count; i++) {
        let radius = innerRadius + (outerRadius - innerRadius) * Math.pow(Math.random(), distributionBias);
        
        // Gap Filter
        if (gapZones.length > 0) {
            let inGap = false;
            for (let gap of gapZones) {
                if (radius >= gap.start && radius <= gap.end) {
                    if (Math.random() > 0.18) inGap = true; 
                    break;
                }
            }
            if (inGap) continue; 
        }

        let x, y, z;
        let isBackgroundNoise = Math.random() < 0.35; // 🌟 35% of particles become the ambient background dust

        const normalizedRadius = radius / outerRadius;
        const thicknessMod = 1.0 - normalizedRadius;

        if (isBackgroundNoise) {
            // 🌌 AMBIENT BACKGROUND DUST GENERATION
            // Evenly distributed circle math to fill the deep empty vacuum space
            const randomAngle = Math.random() * Math.PI * 2;
            
            x = Math.cos(randomAngle) * radius;
            y = (Math.random() - 0.5) * (diskSize * 0.05) * thicknessMod;
            z = Math.sin(randomAngle) * radius;
        } else {
            // 🌀 SPIRAL ARM DUST GENERATION
            const armAngle = ((i % arms) * 2 * Math.PI) / arms;
            const spiralAngle = normalizedRadius * spin * Math.PI;
            
            // Moderate arm scatter scale
            const scatterRange = radius * 0.28; 
            const randomX = (Math.random() - 0.5) * scatterRange;
            const randomY = (Math.random() - 0.5) * (diskSize * 0.03) * thicknessMod;
            const randomZ = (Math.random() - 0.5) * scatterRange;

            const finalAngle = armAngle + spiralAngle;
            x = Math.cos(finalAngle) * radius + randomX;
            y = randomY;              
            z = Math.sin(finalAngle) * radius + randomZ;  
        }

        positions[activeCount * 3] = x;
        positions[activeCount * 3 + 1] = y;
        positions[activeCount * 3 + 2] = z;

        // Color Calibration Palette
        const baseColor = palette[Math.floor(Math.random() * palette.length)] || palette[0];
        let intensity = 1.2 - normalizedRadius * 0.6;
        
        if (isBackgroundNoise) {
            intensity *= 0.45; // 🌟 Make background dust dim so the bright spiral channels snap forward cleanly
        }

        colors[activeCount * 3] = baseColor.r * intensity;
        colors[activeCount * 3 + 1] = baseColor.g * intensity;
        colors[activeCount * 3 + 2] = baseColor.b * intensity;

        activeCount++;
    }

    const finalPositions = new Float32Array(positions.buffer, 0, activeCount * 3);
    const finalColors = new Float32Array(colors.buffer, 0, activeCount * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(finalPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(finalColors, 3)); 

    const material = new THREE.PointsMaterial({
        size: pointSize,
        map: spriteTexture,
        transparent: true,
        blending: THREE.AdditiveBlending, 
        vertexColors: true, 
        depthWrite: false                 
    });

    const diskPoints = new THREE.Points(geometry, material);
    diskPoints.frustumCulled = false; 
    group.add(diskPoints);
 
    // Central Star
    const starGeo = new THREE.SphereGeometry(starSize, 32, 32); 
    const starMat = new THREE.MeshBasicMaterial({ 
        color: starColor,
        transparent: true, 
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    group.add(starMesh);

    group.position.set(pos.x, pos.y, pos.z);
    
    group.onUpdate = () => {
        diskPoints.rotation.y += rotationSpeed; 
    };

    group.userData = {
        name: config.name || "Protoplanetary Disk",
        type: "Protoplanetary Disk",
        spread: diskSize,
        particleCount: activeCount
    };

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
