import * as THREE from 'three';
import { loadTexture } from '../textureLoader.js';
import { createPlanetMaterial, createCloudLayer, createAtmosphere } from '../planetMaterial.js';

const ORBIT_DISTANCE = 60000;
const ORBIT_SPEED = 0.00012;
const ROTATION_SPEED = 0.02;

export async function createEarth(renderer, quality = 'high') {
  const group = new THREE.Group();
  const segments = quality === 'ultra' ? 160 : quality === 'high' ? 128 : 80;

  const [dayMap, cloudMap] = await Promise.all([
    loadTexture('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', { renderer }),
    loadTexture('https://threejs.org/examples/textures/planets/earth_clouds_1024.png', { renderer })
  ]);

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(600, segments, segments / 2),
    createPlanetMaterial({ map: dayMap, roughness: 0.82, metalness: 0.02, normalScale: 0.55 })
  );

  const clouds = createCloudLayer({ radius: 608, map: cloudMap, opacity: 0.55, segments });
  const atmosphere = createAtmosphere({ radius: 640, color: 0x4d9cff, power: 3.2, strength: 1.15, segments });

  group.add(surface, clouds, atmosphere);

  group.userData = {
    name: 'EARTH',
    info: 'The Blue Marble. Only known planet with life. 1G gravity.',
    r: 600,
    type: 'solid'
  };

  let orbitAngle = Math.random() * Math.PI * 2;
  let cloudRotation = 0;

  group.onUpdate = (deltaTime = 1 / 60) => {
    orbitAngle += ORBIT_SPEED * deltaTime;
    cloudRotation += ROTATION_SPEED * 1.25 * deltaTime;

    group.position.set(
      Math.cos(orbitAngle) * ORBIT_DISTANCE,
      0,
      Math.sin(orbitAngle) * ORBIT_DISTANCE
    );

    surface.rotation.y += ROTATION_SPEED * deltaTime;
    clouds.rotation.y = cloudRotation;
  };

  return group;
}
