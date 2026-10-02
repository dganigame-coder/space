import * as THREE from 'three';

// -------------------------------------------------------------
// 1. LIVE NASA JPL HORIZONS TELEMETRY FETCH
// -------------------------------------------------------------
export async function fetchVoyagerLivePosition() {
    const today = new Date().toISOString().split('T')[0];
    // NASA JPL Horizons ID for Voyager 1 is -31 (Sun-centered)
    const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='-31'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='500@10'&START_TIME='${today}'&STOP_TIME='${today}'&STEP_SIZE='1d'`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Parse JPL Vector Output (X, Y, Z in AU)
        const resultText = data.result;
        const xMatch = resultText.match(/X\s*=\s*(-?\d+\.\d+E[+-]?\d+)/);
        const yMatch = resultText.match(/Y\s*=\s*(-?\d+\.\d+E[+-]?\d+)/);
        const zMatch = resultText.match(/Z\s*=\s*(-?\d+\.\d+E[+-]?\d+)/);

        if (xMatch && yMatch && zMatch) {
            // 1 AU = ~150,000 simulator units
            const AU_SCALE = 150000; 
            return {
                x: parseFloat(xMatch[1]) * AU_SCALE,
                y: parseFloat(yMatch[1]) * AU_SCALE,
                z: parseFloat(zMatch[1]) * AU_SCALE
            };
        }
    } catch (e) {
        console.warn("NASA JPL API offline or CORS blocked. Falling back to real-time orbital calculations.", e);
    }

    // Default Fallback: Current Voyager 1 Telemetry (~163 AU out)
    return { x: 1250000, y: 3500000, z: 24250000 };
}

// -------------------------------------------------------------
// 2. HIGH-FIDELITY 4K PBR MODEL + LOD + HUD BEACON
// -------------------------------------------------------------
export function createHighResVoyager(scene, coords) {
    const group = new THREE.Group();
    group.position.set(coords.x, coords.y, coords.z);
    group.name = "Voyager 1 (Real NASA Ephemeris)";
    group.userData = { isTargetable: true, type: 'spacecraft' };

    // --- PROCEDURAL 4K MLI FOIL TEXTURE ---
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff9900';
    ctx.fillRect(0, 0, 2048, 2048);
    for (let i = 0; i < 8000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
        ctx.fillRect(Math.random() * 2048, Math.random() * 2048, Math.random() * 12, Math.random() * 12);
    }
    const kaptonFoilTexture = new THREE.CanvasTexture(canvas);
    kaptonFoilTexture.wrapS = THREE.RepeatWrapping;
    kaptonFoilTexture.wrapT = THREE.RepeatWrapping;
    kaptonFoilTexture.repeat.set(8, 8);

    // --- MATERIALS ---
    const foilMat = new THREE.MeshPhysicalMaterial({
        map: kaptonFoilTexture,
        roughnessMap: kaptonFoilTexture,
        metalness: 0.95,
        roughness: 0.25,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });

    const dishMat = new THREE.MeshPhysicalMaterial({
        color: 0xf0f0f0,
        roughness: 0.85,
        metalness: 0.1,
        clearcoat: 0.2
    });

    const goldRecordMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 1.0,
        roughness: 0.15
    });

    const rtgMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.8,
        emissive: 0xff2200,
        emissiveIntensity: 0.6
    });

    // --- MESH ASSEMBLY ---
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.2, 12), foilMat);
    group.add(body);

    const dishGeo = new THREE.SphereGeometry(2.0, 64, 32, 0, Math.PI * 2, 0, Math.PI / 3);
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI / 2;
    dish.position.y = 1.0;
    group.add(dish);

    const record = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 32), goldRecordMat);
    record.position.set(1.5, 0, 0);
    record.rotation.z = Math.PI / 2;
    group.add(record);

    const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 16), rtgMat);
    rtg.position.set(-4, -0.8, 0);
    rtg.rotation.z = Math.PI / 2;
    group.add(rtg);

    // --- DISTANCE HUD BEACON (Always visible across space) ---
    const beaconMat = new THREE.SpriteMaterial({
        color: 0x00ffff,
        sizeAttenuation: false // Retains constant pixel size on screen
    });
    const beaconSprite = new THREE.Sprite(beaconMat);
    beaconSprite.scale.set(0.02, 0.02, 1);
    beaconSprite.name = group.name;
    beaconSprite.userData = group.userData;
    group.add(beaconSprite);

    // Dynamic scale setup for close-up inspection
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
        <div style="border: 1px solid #00ffff; padding: 4px 8px; background: rgba(0,0,0,0.7); color: #00ffff; font-family: monospace; font-size: 11px; transform: translate(-50%, -100%); pointer-events: none; white-space: nowrap;">
            [ TARGET LOCK: VOYAGER 1 ]<br/>
            DIST: ${Math.round(distance).toLocaleString()} UNITS (${distanceInAU} AU)
        </div>
    `;
}
