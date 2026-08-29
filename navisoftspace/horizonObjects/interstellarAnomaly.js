import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createInterstellarAnomaly(scene, config) {
    const anomalyGroup = new THREE.Group();

    // 🎯 1. Hyperrealistic Cigar-Shaped Asteroid Body (PBR Material + Procedural Noise)
    const rockGeo = new THREE.SphereGeometry(150, 64, 64);
    
    // Displace vertices slightly so it's an organic, rugged rock instead of a smooth math sphere
    const pos = rockGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const noise = Math.sin(v.x * 0.03) * Math.cos(v.y * 0.03) * 12;
        v.addScaledVector(v.clone().normalize(), noise);
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    rockGeo.computeVertexNormals();

    // Upgraded from Basic to Standard material so it reacts dynamically to scene lighting
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x2b211e, // Deep carbonaceous reddish-brown ('Oumuamua's actual spectral tint)
        roughness: 0.85,
        metalness: 0.15
    });
    
    const oumuamuaMesh = new THREE.Mesh(rockGeo, rockMat);
    oumuamuaMesh.name = "oumuamuaMesh";
    oumuamuaMesh.scale.set(0.8, 1.0, 8.5); // Distinct elongated interstellar cigar profile
    anomalyGroup.add(oumuamuaMesh);

    // 🎯 2. Soft Volumetric Interstellar Haze / Outgassing Coma (Replaces the ugly white beacon sphere)
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(180, 210, 255, 0.7)');
    gradient.addColorStop(0.3, 'rgba(80, 130, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const dynamicTexture = new THREE.CanvasTexture(canvas);
    const hazeMat = new THREE.SpriteMaterial({
        map: dynamicTexture,
        color: 0xaaccff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false // Prevents the blocky clipping square bugs
    });
    
    const hazeSprite = new THREE.Sprite(hazeMat);
    hazeSprite.scale.set(3000, 3000, 1); // Visible long-range tracker marker
    anomalyGroup.add(hazeSprite);

    // 🎯 3. Identity and Dynamic Animation Hook
    const targetName = config.name || "'Oumuamua / Interstellar Wanderer";
    anomalyGroup.name = targetName;
    anomalyGroup.userData = {
        type: 'solid',
        name: targetName,
        innerRadius: config.innerRadius || 0,
        outerRadius: config.outerRadius || 50000,
        // Simulates the characteristic tumbling rotation of interstellar objects
        update: (time) => {
            oumuamuaMesh.rotation.x = time * 0.00015;
            oumuamuaMesh.rotation.y = time * 0.0003;
        }
    };

    anomalyGroup.position.set(config.x, config.y, config.z);
    scene.add(anomalyGroup);
    return anomalyGroup;
}
