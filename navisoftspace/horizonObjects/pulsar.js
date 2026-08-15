import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createPulsar(scene = null, config = {}) {
    const group = new THREE.Group();

    // 1. Outer Group positioning
    const x = config.x ?? 0;
    const y = config.y ?? 0;
    const z = config.z ?? 0;
    const baseRadius = config.radius ?? 5000;

    group.position.set(x, y, z);

    // 2. INNER SPIN RIG: Handles high-speed Y rotation
    const spinRig = new THREE.Group();
    group.add(spinRig);

    // 3. TILTED MAGNETIC RIG: Holds the jets at an angle inside the spin rig
    const magneticRig = new THREE.Group();
    magneticRig.rotation.z = Math.PI * 0.25; // Permanent beam offset relative to spin axis
    spinRig.add(magneticRig);

    // Core Neutron Star
    const coreGeo = new THREE.SphereGeometry(baseRadius, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x88ffff, toneMapped: false });
    spinRig.add(new THREE.Mesh(coreGeo, coreMat));

    // Sweeping Jets
    const jetLength = baseRadius * 40;
    const jetGeo = new THREE.CylinderGeometry(baseRadius * 3.0, baseRadius * 0.2, jetLength, 32, 1, true);
    jetGeo.translate(0, jetLength / 2, 0);

    const jetMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const northJet = new THREE.Mesh(jetGeo, jetMat);
    const southJet = new THREE.Mesh(jetGeo, jetMat);
    southJet.rotation.z = Math.PI;

    magneticRig.add(northJet);
    magneticRig.add(southJet);

    group.userData = {
        type: 'pulsar',
        name: config.name || 'Pulsar PSR B1919+21',
        category: 'PULSATING NEUTRON STAR',
        r: baseRadius * 2,
        update(time) {
            // Spin ONLY the internal spinRig, preserving outer group tilt
            spinRig.rotation.y = time * 12.0; 
        }
    };

    if (scene?.add) scene.add(group);

    return group;
}
