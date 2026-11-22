import * as THREE from 'three';

/**
 * Preserves createSupernova(scene, config) and userData.update(timeElapsed).
 * Lifecycle: stable star -> collapse -> explosion -> expanding remnant.
 */
export function createSupernova(scene, config = {}) {
  const group = new THREE.Group();
  const radius = config.size || 8000;
  const cycleDuration = config.cycleDuration || 60000;

  const coreMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(0xffdca8) }
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
      uniform float uTime;
      uniform float uProgress;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        return mix(
          mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vView), normalize(vNormal))), 2.5);
        float plasma = noise(vNormal * 7.0 + uTime * 0.6);
        float temperature = mix(0.35, 1.0, uProgress);

        vec3 color = mix(uColor, vec3(1.0, 0.35, 0.08), plasma * temperature);
        float alpha = (0.45 + fresnel * 1.4) * (0.5 + plasma * 0.8);
        gl_FragColor = vec4(color * alpha * 2.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 48),
    coreMaterial
  );
  group.add(core);

  const shockMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color(0xff7a3c) }
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
      uniform float uTime;
      uniform float uProgress;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;

      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vView), normalize(vNormal))), 3.0);
        float shell = smoothstep(0.0, 0.35, uProgress) * (1.0 - smoothstep(0.75, 1.0, uProgress));
        float alpha = fresnel * shell * 1.4;
        gl_FragColor = vec4(uColor * alpha * 2.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide
  });

  const shockwave = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.1, 96, 48),
    shockMaterial
  );
  group.add(shockwave);

  // GPU debris particles.
  const particleCount = 6000;
  const positions = new Float32Array(particleCount * 3);
  const directions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const dx = Math.sin(phi) * Math.cos(theta);
    const dy = Math.sin(phi) * Math.sin(theta);
    const dz = Math.cos(phi);

    directions[i * 3] = dx;
    directions[i * 3 + 1] = dy;
    directions[i * 3 + 2] = dz;
    speeds[i] = 0.35 + Math.random() * 0.9;
  }

  const debrisGeometry = new THREE.BufferGeometry();
  debrisGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  debrisGeometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
  debrisGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

  const debrisMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uRadius: { value: radius },
      uColorHot: { value: new THREE.Color(0xffd9a0) },
      uColorCool: { value: new THREE.Color(0x7a2bff) }
    },
    vertexShader: /* glsl */`
      attribute vec3 aDirection;
      attribute float aSpeed;

      uniform float uTime;
      uniform float uProgress;
      uniform float uRadius;

      varying float vSpeed;

      void main() {
        vSpeed = aSpeed;
        float distance = uRadius * (0.15 + uProgress * aSpeed * 9.0);
        vec3 displaced = position + aDirection * distance;

        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
        gl_PointSize = clamp((140.0 / max(1.0, -mvPosition.z)) * (0.5 + aSpeed), 1.0, 12.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uProgress;
      uniform vec3 uColorHot;
      uniform vec3 uColorCool;
      varying float vSpeed;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float distance = length(uv) * 2.0;
        if (distance > 1.0) discard;

        float core = 1.0 - smoothstep(0.0, 0.45, distance);
        float alpha = core * (1.0 - smoothstep(0.25, 1.0, uProgress));
        vec3 color = mix(uColorHot, uColorCool, vSpeed);
        gl_FragColor = vec4(color * alpha * 2.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const debris = new THREE.Points(debrisGeometry, debrisMaterial);
  group.add(debris);

  const light = new THREE.PointLight(0xffd9a0, 20, radius * 120, 2);
  group.add(light);

  group.position.set(config.x || 0, config.y || 0, config.z || 0);

  const stableEnd = cycleDuration * 0.33;
  const explosionEnd = cycleDuration * 0.66;

  group.userData = {
    type: 'supernova',
    name: config.name || 'Supernova',
    r: radius * 18,
    state: 'STABLE',
    timeToChange: '',
    update(timeElapsed = 0) {
      const age = timeElapsed % cycleDuration;
      const t = timeElapsed * 0.001;
      let progress = 0;

      if (age < stableEnd) {
        group.userData.state = 'STABLE';
        progress = age / stableEnd * 0.18;
      } else if (age < explosionEnd) {
        group.userData.state = 'EXPLODING';
        progress = 0.18 + ((age - stableEnd) / (explosionEnd - stableEnd)) * 0.82;
      } else {
        group.userData.state = 'NEBULA';
        progress = 1.0;
      }

      coreMaterial.uniforms.uTime.value = t;
      coreMaterial.uniforms.uProgress.value = progress;
      shockMaterial.uniforms.uTime.value = t;
      shockMaterial.uniforms.uProgress.value = progress;
      debrisMaterial.uniforms.uTime.value = t;
      debrisMaterial.uniforms.uProgress.value = progress;

      const scale = 1 + progress * 7;
      core.scale.setScalar(scale);
      shockwave.scale.setScalar(1 + progress * 11);
      light.intensity = 8 + progress * 45;

      core.visible = progress < 0.92;
      shockwave.visible = progress > 0.08 && progress < 0.95;
    }
  };

  group.traverse((child) => {
    if (child.isMesh || child.isPoints) child.frustumCulled = false;
  });

  scene.add(group);
  return group;
}
