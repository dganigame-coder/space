import * as THREE from 'three';
// import { createQuasar } from './QuasarFactory'; 

// 1. Define a scale factor for your Three.js scene (e.g., 1 Parsec = 100,000 units)
const PARSEC_SCALE = 100000;

export async function spawnObjectFromNASA(objectName, engine) {
    try {
        // 2. Query NASA Exoplanet Archive (SQL-like syntax via URL)
        // We ask for: object name, right ascension, declination, and distance (sy_dist)
        const query = `select pl_name, ra, dec, sy_dist from ps where pl_name='${objectName}'`;
        const url = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(query)}&format=json`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data || data.length === 0) {
            console.error("No data found for:", objectName);
            return;
        }

        // 3. Extract the astronomical data (using the first result)
        const starData = data[0];
        const raDeg = starData.ra;       // Degrees
        const decDeg = starData.dec;     // Degrees
        const distancePc = starData.sy_dist; // Parsecs

        // 4. Convert Degrees to Radians
        const raRad = THREE.MathUtils.degToRad(raDeg);
        const decRad = THREE.MathUtils.degToRad(decDeg);

        // 5. Apply the Spherical to Cartesian math
        const x = distancePc * Math.cos(decRad) * Math.cos(raRad) * PARSEC_SCALE;
        const y = distancePc * Math.sin(decRad) * PARSEC_SCALE;
        const z = distancePc * Math.cos(decRad) * Math.sin(raRad) * PARSEC_SCALE;

        console.log(`NASA Data for ${objectName}:`, { raDeg, decDeg, distancePc });
        console.log(`Mapped to Three.js XYZ:`, { x, y, z });

        // 6. Spawn your WebGL object at the exact NASA coordinates
        const system = createQuasar(engine.scene, {
            x: x,
            y: y,
            z: z,
            radius: 200000 // Or derive this from NASA's stellar radius data (st_rad)
        });

        return system;

    } catch (error) {
        console.error("Failed to fetch from NASA API:", error);
    }
}
