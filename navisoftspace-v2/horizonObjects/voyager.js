import * as THREE from 'three';

export async function fetchVoyagerLivePosition() {
    try {
        // 1. Direct jsDelivr CDN link (CORS is natively supported, no proxy needed)
        // Fixed the trailing quote typo at the end of the URL
        const url = `https://cdn.jsdelivr.net/gh/dganigame-coder/space@main/voyager-position.json?t=${Date.now()}`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Successfully fetched live Voyager 1 position from GitHub Actions!");
        
        const resultText = data.result;
        
        // 2. Extract coordinates using Regex (grabs the first day's position)
        const xMatch = resultText.match(/X\s*=\s*(-?\d+\.\d+E[+-]?\d+)/);
        const yMatch = resultText.match(/Y\s*=\s*(-?\d+\.\d+E[+-]?\d+)/);
        const zMatch = resultText.match(/Z\s*=\s*(-?\d+\.\d+E[+-]?\d+)/);

        if (xMatch && yMatch && zMatch) {
            // 3. Fix the scale: JPL returns Kilometers. We must convert KM to AU first!
            const KM_PER_AU = 149597870.7;
            const AU_SCALE = 150000; // 1 AU = 150,000 simulator units

            return {
                x: (parseFloat(xMatch[1]) / KM_PER_AU) * AU_SCALE,
                y: (parseFloat(yMatch[1]) / KM_PER_AU) * AU_SCALE,
                z: (parseFloat(zMatch[1]) / KM_PER_AU) * AU_SCALE
            };
        }
    } catch (e) {
        console.warn("CDN fetch failed. Falling back to default simulation coordinates.", e);
    }

    // Default Fallback
    return { x: -4830, y: -20550, z: 14870 };
}


export function createHighResVoyager(scene, coords) {
    const group = new THREE.Group();
    group.position.set(coords.x, coords.y, coords.z);
    group.name = "Voyager 1 (Real NASA Ephemeris)";
    
    // Targetable metadata for HUD & raycasting
    group.userData = { 
        isTargetable: true, 
        type: 'spacecraft',
        r: 5000, 
        name: 'Voyager 1 Probe',
        info: 'Voyager 1 Golden Record Probe - Currently in Interstellar Space'
    };

    // -------------------------------------------------------------
    // 1. PROCEDURAL 4K KAPTON FOIL TEXTURE GENERATOR
    // -------------------------------------------------------------
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#cc7700'; // Amber-gold MLI foil base
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,220,150,0.2)' : 'rgba(50,20,0,0.25)';
        ctx.fillRect(Math.random() * 1024, Math.random() * 1024, Math.random() * 8, Math.random() * 8);
    }
    const kaptonFoilTexture = new THREE.CanvasTexture(canvas);
    kaptonFoilTexture.wrapS = THREE.RepeatWrapping;
    kaptonFoilTexture.wrapT = THREE.RepeatWrapping;
    kaptonFoilTexture.repeat.set(4, 4);

    // -------------------------------------------------------------
    // 2. MATERIALS
    // -------------------------------------------------------------
    const foilMat = new THREE.MeshPhysicalMaterial({
        map: kaptonFoilTexture,
        roughnessMap: kaptonFoilTexture,
        metalness: 0.9,
        roughness: 0.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });

    const dishMat = new THREE.MeshPhysicalMaterial({
        color: 0xdedede,
        roughness: 0.75,
        metalness: 0.1,
        clearcoat: 0.3
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        metalness: 0.85,
        roughness: 0.3
    });

    const trussMat = new THREE.MeshBasicMaterial({
        color: 0x444444,
        wireframe: true
    });

    const goldRecordMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 1.0,
        roughness: 0.15
    });

    const rtgMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.9,
        emissive: 0xff3300,
        emissiveIntensity: 0.5
    });

    const lensMat = new THREE.MeshPhysicalMaterial({
        color: 0x050505,
        metalness: 0.9,
        roughness: 0.1,
        clearcoat: 1.0
    });

    // -------------------------------------------------------------
    // 3. MAIN BUS (10-Sided Decagonal Equipment Housing)
    // -------------------------------------------------------------
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.0, 10), foilMat);
    group.add(body);

    // -------------------------------------------------------------
    // 4. HIGH-GAIN DISH ANTENNA (3.7m Parabola + Tripod Feed Horn)
    // -------------------------------------------------------------
    const dishGeo = new THREE.SphereGeometry(2.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 3.2);
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI / 2;
    dish.position.y = 0.8;
    group.add(dish);

    // Subreflector Feed Horn
    const feedHorn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 12), darkMetalMat);
    feedHorn.position.set(0, 2.2, 0);
    feedHorn.rotation.x = -Math.PI;
    group.add(feedHorn);

    // Tripod Struts holding Feed Horn
    for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8), darkMetalMat);
        
        strut.position.set(Math.cos(angle) * 0.7, 1.5, Math.sin(angle) * 0.7);
        strut.rotation.z = Math.cos(angle) * -0.4;
        strut.rotation.x = Math.sin(angle) * 0.4;
        group.add(strut);
    }

    // -------------------------------------------------------------
    // 5. GOLDEN RECORD
    // -------------------------------------------------------------
    const record = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 32), goldRecordMat);
    record.position.set(1.61, -0.1, 0);
    record.rotation.z = Math.PI / 2;
    group.add(record);

    // -------------------------------------------------------------
    // 6. SCIENCE INSTRUMENT BOOM & SCAN PLATFORM (Cameras/Optics)
    // -------------------------------------------------------------
    const scienceBoomTruss = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5.0, 6), trussMat);
    scienceBoomTruss.rotation.z = -Math.PI / 2;
    scienceBoomTruss.position.set(3.8, 0.2, 0);
    group.add(scienceBoomTruss);

    // Scan Platform Housing
    const scanPlatform = new THREE.Group();
    scanPlatform.position.set(6.2, 0.2, 0);

    const platformBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.1), darkMetalMat);
    scanPlatform.add(platformBase);

    // ISS Narrow & Wide Angle Camera Lenses
    const cameraLens1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16), lensMat);
    cameraLens1.rotation.x = Math.PI / 2;
    cameraLens1.position.set(0.2, 0, 0.6);
    scanPlatform.add(cameraLens1);

    const cameraLens2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 16), lensMat);
    cameraLens2.rotation.x = Math.PI / 2;
    cameraLens2.position.set(-0.25, 0.2, 0.5);
    scanPlatform.add(cameraLens2);

    group.add(scanPlatform);

    // -------------------------------------------------------------
    // 7. TRIPLE RTG POWER BOOM (Radioisotope Thermoelectric Generators)
    // -------------------------------------------------------------
    const rtgBoomTruss = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 6), trussMat);
    rtgBoomTruss.rotation.z = Math.PI / 2.3;
    rtgBoomTruss.position.set(-2.2, -0.8, -0.5);
    group.add(rtgBoomTruss);

    const rtgCluster = new THREE.Group();
    rtgCluster.position.set(-3.5, -1.5, -0.8);

    // 3 Cylindrical RTG canisters mounted side-by-side
    for (let i = 0; i < 3; i++) {
        const rtgCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16), rtgMat);
        rtgCylinder.rotation.z = Math.PI / 2;
        rtgCylinder.position.set(0, (i - 1) * 0.28, 0);
        rtgCluster.add(rtgCylinder);
    }
    group.add(rtgCluster);

    // -------------------------------------------------------------
    // 8. MAGNETOMETER BOOM (13m Ultra-Long Lattice Boom)
    // -------------------------------------------------------------
    const magBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 12.0, 4), trussMat);
    magBoom.rotation.x = Math.PI / 2.2;
    magBoom.position.set(0, -0.5, -6.0);
    group.add(magBoom);

    // Magnetometer Sensor canister at tip
    const magSensor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 12), darkMetalMat);
    magSensor.position.set(0, -0.5, -12.0);
    group.add(magSensor);

    // -------------------------------------------------------------
    // 9. DISTANCE HUD BEACON
    // -------------------------------------------------------------
    const beaconMat = new THREE.SpriteMaterial({
        color: 0x00ffff,
        sizeAttenuation: false
    });
    const beaconSprite = new THREE.Sprite(beaconMat);
    beaconSprite.scale.set(0.02, 0.02, 1);
    beaconSprite.name = group.name;
    beaconSprite.userData = group.userData;
    group.add(beaconSprite);

    // -------------------------------------------------------------
    // 10. SCENE GRAPH PROPAGATION
    // -------------------------------------------------------------
    group.traverse((obj) => {
        if (obj.isMesh) {
            obj.frustumCulled = false;
            obj.userData = group.userData;
        }
    });

    scene.add(group);
    return group;
}
// -------------------------------------------------------------
// 3. TARGETING HUD & SCREEN-SPACE WAYPOINT INDICATOR
// -------------------------------------------------------------
export function updateNavigationHUD(camera, targetObject, hudElement) {
    if (!targetObject || !hudElement) return;

    const targetPos = new THREE.Vector3();
    targetObject.getWorldPosition(targetPos);

    // Compute distance from camera
    const distance = camera.position.distanceTo(targetPos);
    const distanceInAU = (distance / 150000).toFixed(2);

    // Project 3D space to 2D screen space
    const projected = targetPos.clone().project(camera);

    // Check if behind camera
    if (projected.z > 1) {
        hudElement.style.display = 'none';
        return;
    }

    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

    hudElement.style.display = 'block';
    hudElement.style.left = `${x}px`;
    hudElement.style.top = `${y}px`;
    hudElement.innerHTML = `
        <div style="border: 1px solid #00ffff; padding: 4px 8px; background: rgba(0,0,0,0.7); color: #00ffff; font-family: monospace; font-size: 11px; transform: translate(-50%, -100%); pointer-events: none; white-space: nowrap; text-shadow: 0 0 8px #00ffff;">
            [ TARGET LOCK: VOYAGER 1 ]<br/>
            DIST: ${Math.round(distance).toLocaleString()} UNITS (${distanceInAU} AU)
        </div>
    `;
}
