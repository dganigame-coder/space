import * as THREE from 'three';

/**
 * Preserves createExoplanet(scene, config), group.onUpdate(delta), and group.update(delta).
 */
export function createExoplanet(scene = null, config = {}) {
  const group = new THREE.Group();
  const radius = config.radius || 800;
  const segments = config.segments || 96;
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');

  const mainColor = new THREE.Color(config.color !== undefined ? config.color : 0x88aaff);

  const materialOptions = {
    color: mainColor,
    roughness: config.roughness ?? 0.72,
    metalness: config.metalness ?? 0.05,
    dithering: true
  };

  if (config.textureMap) materialOptions.map = loader.load(config.textureMap);
  if (config.normalMap) {
    materialOptions.normalMap = loader.load(config.normalMap);
    materialOptions.normalScale = new THREE.Vector2(0.8, 0.8);
  }
  if (config.roughnessMap) materialOptions.roughnessMap = loader.load(config.roughnessMap);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, segments / 2),
    new THREE.MeshStandardMaterial(materialOptions)
  );
  group.add(planet);

  let clouds = null;
  if (config.hasClouds !== false) {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.025, segments, segments / 2),
      new THREE.MeshStandardMaterial({
        map: loader.load(config.cloudMap || 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png'),
        transparent: true,
        opacity: config.cloudOpacity ?? 0.45,
        roughness: 1,
        metalness: 0,
        depthWrite: false
      })
    );
    group.add(clouds);
  }

  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(config.atmosColor || 0x4d9cff) },
      uPower: { value: config.atmosPower ?? 3.0 },
      uStrength: { value: config.atmosOpacity ?? 0.9 }
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vView;

      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vView), normalize(vNormal))), uPower);
        gl_FragColor = vec4(uColor, fresnel * uStrength);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide
  });

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.12, segments, segments / 2),
    atmosphereMaterial
  );
  group.add(atmosphere);

  group.position.set(config.x || 0, config.y || 0, config.z || 0);
  group.name = `${config.name || 'Exoplanet'}_Group`;
  group.r = radius;
  group.radius = radius;
  group.color = mainColor;
  group.material = planet.material;

  group.userData = {
    type: 'exoplanet',
    name: config.name || 'Exoplanet',
    radius,
    r: radius,
    color: mainColor
  };

  const bodyRotationSpeed = config.rotationSpeed ?? 0.001;
  const cloudRotationSpeed = config.cloudSpeed ?? 0.0014;

  const update = (delta = 1 / 60) => {
    planet.rotation.y += bodyRotationSpeed * delta;
    if (clouds) clouds.rotation.y += cloudRotationSpeed * delta;
  };

  group.onUpdate = update;
  group.update = update;

  scene?.add?.(group);
  return group;
}
