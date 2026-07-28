import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createExoplanet } from 'https://cdn.jsdelivr.net/gh/dganigame-coder/space@5375f6d/navisoftspace/horizonObjects/exoplanet.js';

export function createExoplanetSystem(scene, config = {}) {
    const system = new THREE.Group();
    system.name = config.name || 'Exoplanet System';
    system.position.set(config.x || 0, config.y || 0, config.z || 0);

    // 1. Create Central Star
    const starGeo = new THREE.SphereGeometry(config.starRadius || 1200, 64, 64);
    const starMat = new THREE.MeshBasicMaterial({ color: config.starColor || 0xffaa00 });
    const star = new THREE.Mesh(starGeo, starMat);
    star.name = "star";
    system.add(star);

    // 2. Create Orbit Container & Exoplanet
    const orbitGroup = new THREE.Group();
    system.add(orbitGroup);

    const exoplanet = createExoplanet(config);
    orbitGroup.add(exoplanet.planetGroup);

    if (scene) scene.add(system);

    return {
        system,
        star,
        planet: exoplanet.planetBody,
        planetGroup: exoplanet.planetGroup,
        clouds: exoplanet.clouds,
        orbitGroup,

        // 🎯 Forwards target.position directly to the system root group
        get position() {
            return system.position;
        }
    };
}
