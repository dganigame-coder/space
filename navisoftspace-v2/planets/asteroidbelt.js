import * as THREE from 'three';

/**
 * Preserves createBelt(scene, config).
 * Adds PBR rock material, varied instances, orbital motion, and GPU-friendly updates.
 */
export function createBelt(scene, config = {}) {
  const {
    count = 1500,
    innerRadius = 100000,
    outerRadius = 150000,
    verticalScatter = 3000,
    color = 0x9a8f80,
    size = { min: 80, max: 500 },
    x = 0,
    y = 0,
    z = 0
  } = config;

  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.94,
    metalness: 0.03,
    flatShading: true,
    dithering: true
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.position.set(x, y, z);
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const orbitData = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
    const scale = size.min + Math.random() * (size.max - size.min);

    dummy.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * verticalScatter,
      Math.sin(angle) * radius
    );

    dummy.scale.set(
      scale * (0.75 + Math.random() * 0.5),
      scale * (0.75 + Math.random() * 0.5),
      scale * (0.75 + Math.random() * 0.5)
    );

    dummy.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    orbitData.push({
      angle,
      radius,
      speed: 0.00002 + Math.random() * 0.00005,
      spinX: (Math.random() - 0.5) * 0.002,
      spinY: (Math.random() - 0.5) * 0.002,
      spinZ: (Math.random() - 0.5) * 0.002
    });
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();

  mesh.userData = {
    type: config.type || 'asteroid_belt',
    innerRadius,
    outerRadius,
    name: config.name || 'Asteroid Field',
    orbitData,
    update(deltaTime = 1 / 60, elapsed = 0) {
      // Update a limited number of instances each frame to protect performance.
      const updateCount = Math.min(count, 350);
      const startIndex = Math.floor(elapsed * 60) % count;

      for (let i = 0; i < updateCount; i++) {
        const index = (startIndex + i) % count;
        const data = orbitData[index];

        data.angle += data.speed * deltaTime;
        const px = Math.cos(data.angle) * data.radius;
        const pz = Math.sin(data.angle) * data.radius;

        dummy.position.set(px, 0, pz);
        dummy.rotation.set(
          data.spinX * elapsed,
          data.spinY * elapsed,
          data.spinZ * elapsed
        );

        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  scene.add(mesh);
  return mesh;
}
