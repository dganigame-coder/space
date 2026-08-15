import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/**
 * Creates a Rapidly Spinning Pulsar (Neutron Star) with sweeping lighthouse jets
 */
export function createPulsar(scene = null, config = {}) {
    const group = new THREE.Group();

    const x = config.x ?? 0;
    const y = config.y ?? 0;
    const z = config.z ?? 0;
    const baseRadius = config.radius ?? 5000; // Pulsars are small stellar remnants

    group.position.set(x, y, z);

    // Container for the magnetic axis (tilted relative to rotation axis)
    const magneticRig = new THREE.Group();
    // Tilt the magnetic axis 30 degrees so jets sweep through space
    magneticRig.rotation.z = Math.PI * 0.17; 
    group.add(magneticRig);

    // ------------------------------------------------------------------------
    // 1. NEUTRON STAR CORE (Ultra-Dense Bright Core)
    // ------------------------------------------------------------------------
    const coreGeo = new THREE.SphereGeometry(baseRadius, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0x88ffff,
        toneMapped: false
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Magnetosphere Glow
    const glowGeo = new THREE.SphereGeometry(baseRadius * 2.5, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    group.add(new THREE.Mesh(glowGeo, glowMat));

    // ------------------------------------------------------------------------
    // 2. SWEEPING BEAM JETS (Attached to Magnetic Rig)
    // ------------------------------------------------------------------------
    const jetLength = baseRadius * 40;
    const jetGeo = new THREE.CylinderGeometry(baseRadius * 3.0, baseRadius * 0.2, jetLength, 32, 1, true);
    jetGeo.translate(0, jetLength / 2, 0);

    const jetMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const northJet = new THREE.Mesh(jetGeo, jetMat);
    const southJet = new THREE.Mesh(jetGeo, jetMat);
    southJet.rotation.z = Math.PI;

    magneticRig.add(northJet);
    magneticRig.add(southJet);

    // ------------------------------------------------------------------------
    // 3. HUD METADATA & FAST ROTATION HOOK
    // ------------------------------------------------------------------------
    group.userData = {
        type: 'pulsar',
        name: config.name || 'Pulsar',
        category: 'PULSATING NEUTRON STAR',
        subText: 'SPIN RATE: HIGH-FREQUENCY PULSE',
        r: baseRadius * 2,
        update(time) {
            // Rapid rotation on Y axis creates the sweeping lighthouse effect!
            group.rotation.y = time * 15.0; // Fast spin rate
        }
    };

    if (scene?.add) {
        scene.add(group);
    }

    return group;
}
