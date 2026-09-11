import * as THREE from 'three';

export function createVoyager(scene, config) {
    // 1. Extract flat coordinates, color, and name
    const { x, y, z, color, name } = config; 
    
    const group = new THREE.Group();
    
    // 2. Set position
    group.position.set(x, y, z);
    
    // 3. Attach the hub identifier data
    group.name = name;
    group.userData = { 
        isTargetable: true,
        type: 'spacecraft'
    };

    // 1. Advanced PBR Materials
    // Kapton Foil (Multi-Layer Insulation) requires clearcoat to look like crinkled plastic over metal
    const foilMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffaa00,
        metalness: 1.0,
        roughness: 0.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.4,
        ior: 1.5,
        // Pro-tip: Load a noise texture into bumpMap or normalMap here for the crinkled look
    });

    const matteDishMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0xe0e0e0, 
        metalness: 0.1, 
        roughness: 0.9,
        clearcoat: 0.1
    });

    // The RTG runs hot from Plutonium-238 decay
    const rtgMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x222222,
        metalness: 0.8,
        roughness: 0.6,
        emissive: 0xff3300,
        emissiveIntensity: 0.8 // Will bloom beautifully in post-processing
    });

    const goldRecordMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        metalness: 1.0,
        roughness: 0.1,
        clearcoat: 1.0
    });

    // 2. The Bus (Decagonal Main Body)
    const bodyGeo = new THREE.CylinderGeometry(1.5, 1.5, 1.2, 10);
    const body = new THREE.Mesh(bodyGeo, foilMaterial);
    group.add(body);

    // 3. The High-Gain Antenna (Dish & Metallic Backing)
    const dishGeo = new THREE.SphereGeometry(3.66/2, 64, 32, 0, Math.PI * 2, 0, Math.PI / 3);
    const dish = new THREE.Mesh(dishGeo, matteDishMaterial);
    dish.rotation.x = Math.PI / 2;
    dish.position.y = 1.0;
    
    // Dish backing (structural metal)
    const dishBackMat = new THREE.MeshPhysicalMaterial({
        color: 0xaaaaaa, metalness: 0.9, roughness: 0.5, side: THREE.BackSide
    });
    const dishBack = new THREE.Mesh(dishGeo, dishBackMat);
    dishBack.rotation.x = Math.PI / 2;
    dishBack.position.y = 1.0;
    
    group.add(dish);
    group.add(dishBack);

    // 4. The Golden Record (Mounted on the bus)
    const recordGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.02, 32);
    const record = new THREE.Mesh(recordGeo, goldRecordMaterial);
    record.position.set(1.5, 0, 0);
    record.rotation.z = Math.PI / 2;
    group.add(record);

    // 5. RTG (Radioisotope Thermoelectric Generator) Boom
    const boomGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
    const boom = new THREE.Mesh(boomGeo, dishBackMat);
    boom.position.set(-2.5, -0.8, 0);
    boom.rotation.z = Math.PI / 2;
    group.add(boom);

    const rtgGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 16);
    const rtg = new THREE.Mesh(rtgGeo, rtgMaterial);
    rtg.position.set(-4, -0.8, 0);
    rtg.rotation.z = Math.PI / 2;
    group.add(rtg);

    // 6. Navigation Glint
    const glint = new THREE.PointLight(color, 2, 500); 
    group.add(glint);

    group.position.set(position.x, position.y, position.z);
    
    // Critical for maintaining rendering in massive cosmological scales
    group.traverse((obj) => { 
        if(obj.isMesh) {
            obj.frustumCulled = false;
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });

    scene.add(group);
    return group;
}
