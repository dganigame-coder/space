import * as THREE from 'three';

/**
 * Preserves createQuasar(scene, config) and userData.update(time).
 */
export function createQuasar(scene = null, config = {}) {
  const group = new THREE.Group();
  const radius = config.size || 25000;

  const coreMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xd8f4ff) }
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

      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vView), normalize(vNormal))), 4.0);
        float pulse = 0.8 + 0.2 * sin(uTime * 6.0);
        float alpha = (0.45 + fresnel * 1.8) * pulse;
        gl_FragColor = vec4(uColor * alpha * 2.2, alpha);
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

  const diskMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: radius * 1.3 },
      uOuter: { value: radius * 5.0 }
    },
    vertexShader: /* glsl */`
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uInner;
      uniform float uOuter;
      varying vec3 vLocal;

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

      void main() {
        float radial = (length(vLocal.xz) - uInner) / (uOuter - uInner);
        if (radial < 0.0 || radial > 1.0) discard;

        float angle = atan(vLocal.z, vLocal.x);
        float differential = 1.0 / max(0.15, radial);
        float swirl = angle + uTime * differential * 1.8;

        float turbulence = 0.45 + 0.75 * noise(vec2(swirl * 2.5, radial * 20.0));
        float edge = smoothstep(0.0, 0.1, radial) * (1.0 - smoothstep(0.65, 1.0, radial));
        float heat = pow(1.0 - radial, 2.0);
        float doppler = 0.55 + 0.8 * max(0.0, sin(swirl));

        vec3 color = mix(vec3(0.25, 0.05, 0.02), vec3(1.0, 0.75, 0.45), heat);
        color = mix(color, vec3(0.85, 0.95, 1.0), pow(heat, 3.0));

        float alpha = edge * turbulence * (0.35 + heat) * doppler;
        gl_FragColor = vec4(color * alpha * 2.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const disk = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.3, radius * 5.0, 256, 64),
    diskMaterial
  );
  disk.rotation.x = Math.PI / 2;
  disk.rotation.z = 0.16;
  group.add(disk);

  const jetMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x9fe8ff) }
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
        float radial = abs(vUv.x - 0.5) * 2.0;
        float beam = pow(1.0 - radial, 6.0);
        float turbulence = 0.6 + 0.4 * noise(vUv.y * 45.0 - uTime * 10.0);
        float fade = smoothstep(1.0, 0.0, vUv.y);
        float alpha = beam * turbulence * fade * 0.65;
        gl_FragColor = vec4(uColor * alpha * 2.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const jetGeometry = new THREE.CylinderGeometry(radius * 0.04, radius * 0.5, radius * 18, 48, 1, true);
  const northJet = new THREE.Mesh(jetGeometry, jetMaterial);
  northJet.position.y = radius * 9;

  const southJet = new THREE.Mesh(jetGeometry, jetMaterial);
  southJet.position.y = -radius * 9;
  southJet.rotation.z = Math.PI;

  const jetRig = new THREE.Group();
  jetRig.add(northJet, southJet);
  jetRig.rotation.z = 0.2;
  group.add(jetRig);

  const light = new THREE.PointLight(0xd8f4ff, 15, radius * 40, 2);
  group.add(light);

  group.position.set(config.x || 0, config.y || 0, config.z || 0);

  group.userData = {
    type: 'quasar',
    name: config.name || 'Distant Quasar X-1',
    r: radius * 12,
    update(time = 0) {
      const t = time * 0.001;
      coreMaterial.uniforms.uTime.value = t;
      diskMaterial.uniforms.uTime.value = t;
      jetMaterial.uniforms.uTime.value = t;

      disk.rotation.z -= 0.0005;
      jetRig.rotation.y += 0.00008;
    }
  };

  group.traverse((child) => {
    if (child.isMesh) child.frustumCulled = false;
  });

  scene?.add?.(group);
  return group;
}
