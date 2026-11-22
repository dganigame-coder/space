import * as THREE from 'three';

/**
 * Volumetric-looking nebula using layered shader billboards.
 * Preserves createNebula(scene, config).
 */
export function createNebula(scene, config = {}) {
  const group = new THREE.Group();
  const spread = config.spread || 100000;
  const count = Math.min(config.count || 220, 500);
  const colors = config.colors?.length ? config.colors : [0x7f5cff, 0x33aaff, 0xff5f9e];

  const cloudMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colors[0]) },
      uSecondary: { value: new THREE.Color(colors[1 % colors.length]) },
      uOpacity: { value: 0.16 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uSecondary;
      uniform float uOpacity;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.04;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = vUv - 0.5;
        float distance = length(uv) * 2.0;
        if (distance > 1.0) discard;

        float clouds = fbm(uv * 5.0 + uTime * 0.025);
        clouds += 0.45 * fbm(uv * 11.0 - uTime * 0.018);
        clouds = smoothstep(0.28, 1.05, clouds);

        float edge = smoothstep(1.0, 0.15, distance);
        float alpha = clouds * edge * uOpacity;

        vec3 color = mix(uColor, uSecondary, clouds);
        gl_FragColor = vec4(color * alpha * 2.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const cloudGroup = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(1, 1);

  for (let i = 0; i < count; i++) {
    const material = cloudMaterial.clone();
    material.uniforms.uColor.value = new THREE.Color(colors[i % colors.length]);
    material.uniforms.uSecondary.value = new THREE.Color(colors[(i + 1) % colors.length]);
    material.uniforms.uOpacity.value = 0.05 + Math.random() * 0.14;

    const mesh = new THREE.Mesh(geometry, material);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = Math.pow(Math.random(), 0.65) * spread * 0.55;

    mesh.position.set(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.sin(phi) * Math.sin(theta) * radius,
      Math.cos(phi) * radius
    );

    const size = spread * (0.12 + Math.random() * 0.35);
    mesh.scale.set(size, size, 1);
    mesh.lookAt(0, 0, 0);
    mesh.rotation.z = Math.random() * Math.PI * 2;

    mesh.userData = {
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.35,
      baseOpacity: material.uniforms.uOpacity.value
    };

    cloudGroup.add(mesh);
  }

  group.add(cloudGroup);

  // Embedded star cluster.
  const starCount = 1800;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = Math.pow(Math.random(), 0.7) * spread * 0.45;

    starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    starPositions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius;
    starPositions[i * 3 + 2] = Math.cos(phi) * radius;

    const warm = Math.random();
    starColors[i * 3] = 0.75 + warm * 0.25;
    starColors[i * 3 + 1] = 0.75 + Math.random() * 0.2;
    starColors[i * 3 + 2] = 0.75 + (1 - warm) * 0.25;
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: spread * 0.0035,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    })
  );

  group.add(stars);

  const coreLight = new THREE.PointLight(colors[0], 8, spread * 2.2, 2);
  group.add(coreLight);

  group.position.set(config.x || 0, config.y || 0, config.z || 0);

  group.userData = {
    type: 'nebula',
    name: config.name || 'Nebula',
    r: spread * 1.5,
    sound: config.sound || 'NEBULA_HUM',
    isBreathing: true,
    update(timeElapsed = 0) {
      const t = timeElapsed * 0.001;

      cloudGroup.children.forEach((cloud, index) => {
        const material = cloud.material;
        material.uniforms.uTime.value = t + cloud.userData.phase;
        material.uniforms.uOpacity.value =
          cloud.userData.baseOpacity * (0.75 + 0.25 * Math.sin(t * cloud.userData.speed + cloud.userData.phase));
      });

      cloudGroup.rotation.y += 0.00004;
      stars.rotation.y -= 0.00002;
    }
  };

  group.traverse((child) => {
    if (child.isMesh || child.isPoints) child.frustumCulled = false;
  });

  scene.add(group);
  return group;
}
