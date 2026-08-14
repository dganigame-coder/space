import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Creates an Active Galactic Nucleus / Quasar with 300,000 LY Relativistic Jets
 * @param {THREE.Scene} [scene] - Optional scene instance to auto-add the object
 * @param {Object} [config] - Configuration object for position and radius
 */
export function createQuasar(scene = null, config = {}) {
    const group = new THREE.Group();

    // Default parameters with fallback values
    const x = config.x || 0;
    const y = config.y || 0;
    const z = config.z || 0;
    const baseRadius = config.radius || 200000;

    group.position.set(x, y, z);

    // ------------------------------------------------------------------------
    // 1. BLINDING CENTRAL CORE
    // ------------------------------------------------------------------------
    const coreGeo = new THREE.SphereGeometry(baseRadius, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // ------------------------------------------------------------------------
    // 2. NEBULAR GAS CLOUD (Blue Energetic Envelope)
    // ------------------------------------------------------------------------
    const cloudGeo = new THREE.SphereGeometry(baseRadius * 4.5, 32, 32);
    const cloudMat = new THREE.MeshBasicMaterial({
        color: 0x0066ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    group.add(cloud);

    // ------------------------------------------------------------------------
    // 3. RELATIVISTIC PLASMA JETS (300,000 LY Energy Outflow)
    // ------------------------------------------------------------------------
    const jetLength = baseRadius * 25;
    const jetRadiusTop = baseRadius * 2.0;
    const jetRadiusBottom = baseRadius * 0.1;

    const jetGeo = new THREE.CylinderGeometry(
        jetRadiusTop, 
        jetRadiusBottom, 
        jetLength, 
        32, 1, true
    );
    jetGeo.translate(0, jetLength / 2, 0);

    const jetMat = new THREE.MeshBasicMaterial({
        color: 0xff0055,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const northJet = new THREE.Mesh(jetGeo, jetMat);
    const southJet = new THREE.Mesh(jetGeo, jetMat);
    southJet.rotation.z = Math.PI;

    group.add(northJet);
    group.add(southJet);

    // ------------------------------------------------------------------------
    // 4. INNER HIGH-ENERGY LASER CORE
    // ------------------------------------------------------------------------
    const innerJetGeo = new THREE.CylinderGeometry(
        jetRadiusTop * 0.3, 
        jetRadiusBottom * 0.2, 
        jetLength * 1.1, 
        16, 1, true
    );
    innerJetGeo.translate(0, (jetLength * 1.1) / 2, 0);

    const innerJetMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const northInner = new THREE.Mesh(innerJetGeo, innerJetMat);
    const southInner = new THREE.Mesh(innerJetGeo, innerJetMat);
    southInner.rotation.z = Math.PI;

    group.add(northInner);
    group.add(southInner);

    // ------------------------------------------------------------------------
    // 5. HUD METADATA
    // ------------------------------------------------------------------------
    group.userData = {
        type: 'blackhole',
        name: config.name || 'Active Galactic Nucleus (Quasar)',
        category: 'ACTIVE GALACTIC NUCLEUS',
        subText: 'ENERGY JET: 300,000 LIGHT YEARS',
        r: baseRadius * 2,
        northJet: northJet,
        southJet: southJet
    };

    // Auto-add to scene if scene instance is passed
    if (scene && scene.add) {
        scene.add(group);
    }

    return group;
}
