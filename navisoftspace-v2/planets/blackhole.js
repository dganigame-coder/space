import * as THREE from 'three';

/**
 * Hyperreal cinematic black hole.
 * Preserves createBlackHole(scene, config) and userData.update(timeElapsed).
 */
export function createBlackHole(scene, config = {}) {
  const group = new THREE.Group();
  const radius = config.size || 50000;

  // Event horizon: pure black occluder.
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  group.add(core);

  // Thin, extremely hot photon ring.
  const photonMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffd9a0) },
      uRadius: { value: radius }
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
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }

      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vView), normalize(vNormal))), 6.0);
        float shimmer = 0.85 + 0.15 * sin(uTime * 8.0 + vNormal.y * 30.0);
        float alpha = rim * shimmer * 2.2;
        gl_FragColor = vec4(uColor * alpha, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide
  });

  const photonRing = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.04, 96, 48),
    photonMaterial
  );
  group.add(photonRing);

  // Tilted, differentially rotating accretion disk.
  const diskMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: radius * 1.45 },
      uOuter: { value: radius * 7.0 },
      uHot: { value: new THREE.Color(0xffffff) },
      uWarm: { value: new THREE.Color(0xffb267) },
      uCool: { value: new THREE.Color(0x531a04) }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vLocal;
      void main() {
        vUv = uv;
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uHot;
      uniform vec3 uWarm;
      uniform vec3 uCool;

      varying vec2 vUv;
      varying vec3 vLocal;

      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.03;
          amplitude *= 0.52;
        }
        return value;
      }

      void main() {
        vec2 polar = vec2(
          length(vLocal.xz),
          atan(vLocal.z, vLocal.x)
        );

        float radial = (polar.x - uInner) / (uOuter - uInner);
        if (radial < 0.0 || radial > 1.0) discard;

        // Inner material moves much faster than outer material.
        float differential = 1.0 / max(0.12, radial);
        float swirl = polar.y + uTime * differential * 2.4;

        float turbulence = fbm(vec2(swirl * 2.0, radial * 18.0));
        turbulence = 0.45 + 0.75 * turbulence;

        float edge = smoothstep(0.0, 0.08, radial) * (1.0 - smoothstep(0.75, 1.0, radial));
        float temperature = pow(1.0 - radial, 2.2);

        vec3 color = mix(uCool, uWarm, temperature);
        color = mix(color, uHot, pow(temperature, 2.5));

        // Doppler-like brightness: approaching side is brighter.
        float doppler = 0.55 + 0.85 * max(0.0, sin(swirl));
        float alpha = edge * turbulence * (0.35 + temperature * 1.35) * doppler;

        gl_FragColor = vec4(color * alpha * 2.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const disk = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.45, radius * 7.0, 256, 72),
    diskMaterial
  );
  disk.rotation.x = Math.PI / 2;
  disk.rotation.z = 0.22;
  group.add(disk);

  // Bipolar relativistic jets.
  const jetMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x9fd8ff) }
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
      varying vec2 vUv;

      float noise(float x) {
        return fract(sin(x * 91.3458) * 47453.5453);
      }

      void main() {
        float center = abs(vUv.x - 0.5) * 2.0;
        float beam = pow(1.0 - center, 5.0);
        float pulse = 0.65 + 0.35 * sin(vUv.y * 35.0 - uTime * 12.0);
        float fade = smoothstep(1.0, 0.0, vUv.y);
        float alpha = beam * pulse * fade * 0.55;
        gl_FragColor = vec4(uColor * alpha * 2.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const jetGeometry = new THREE.CylinderGeometry(radius * 0.05, radius * 0.55, radius * 16, 48, 1, true);
  const northJet = new THREE.Mesh(jetGeometry, jetMaterial);
  northJet.position.y = radius * 8;
  const southJet = new THREE.Mesh(jetGeometry, jetMaterial);
  southJet.position.y = -radius * 8;
  southJet.rotation.z = Math.PI;

  const jetRig = new THREE.Group();
  jetRig.add(northJet, southJet);
  jetRig.rotation.z = 0.18;
  group.add(jetRig);

  const light = new THREE.PointLight(0xffd9a0, 18, radius * 300, 2);
  group.add(light);

  group.position.set(config.x || 0, config.y || 0, config.z || 0);

  group.userData = {
    type: 'blackhole',
    name: config.name || 'The Great Singularity',
    r: radius * 20,
    update(timeElapsed = 0) {
      const t = timeElapsed * 0.001;
      diskMaterial.uniforms.uTime.value = t;
      photonMaterial.uniforms.uTime.value = t;
      jetMaterial.uniforms.uTime.value = t;

      disk.rotation.z -= 0.00035;
      jetRig.rotation.y += 0.00008;
    }
  };

  group.traverse((child) => {
    if (child.isMesh) child.frustumCulled = false;
  });

  scene.add(group);
  return group;
}
