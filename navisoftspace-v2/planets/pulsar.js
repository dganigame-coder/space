import * as THREE from 'three';

/**
 * Preserves createPulsar(scene, config) and userData.update(time, camera).
 */
export function createPulsar(scene = null, config = {}) {
  const group = new THREE.Group();
  const radius = config.size || 900;

  const coreMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xbfe4ff) }
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
        float fresnel = pow(1.0 - abs(dot(normalize(vView), normalize(vNormal))), 3.0);
        float pulse = 0.7 + 0.3 * sin(uTime * 22.0);
        float alpha = (0.35 + fresnel * 1.5) * pulse;
        gl_FragColor = vec4(uColor * alpha * 2.0, alpha);
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

  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x9fd0ff) },
      uViewVector: { value: new THREE.Vector3(0, 0, 1) }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uViewVector;
      varying vec2 vUv;
      varying vec3 vWorldNormal;

      float noise(float x) {
        return fract(sin(x * 91.3458) * 47453.5453);
      }

      void main() {
        float radial = abs(vUv.x - 0.5) * 2.0;
        float beam = pow(1.0 - radial, 6.0);
        float turbulence = 0.6 + 0.4 * noise(vUv.y * 60.0 - uTime * 8.0);
        float fade = smoothstep(1.0, 0.0, vUv.y);
        float flash = pow(max(dot(normalize(vWorldNormal), normalize(uViewVector)), 0.0), 12.0);

        float alpha = beam * turbulence * fade * (0.55 + flash * 1.8);
        gl_FragColor = vec4(uColor * alpha * 2.2, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const beamGeometry = new THREE.CylinderGeometry(radius * 0.03, radius * 0.65, radius * 22, 48, 1, true);
  const northBeam = new THREE.Mesh(beamGeometry, beamMaterial);
  northBeam.position.y = radius * 11;

  const southBeam = new THREE.Mesh(beamGeometry, beamMaterial);
  southBeam.position.y = -radius * 11;
  southBeam.rotation.z = Math.PI;

  const magneticRig = new THREE.Group();
  magneticRig.add(northBeam, southBeam);
  magneticRig.rotation.z = 0.38;
  group.add(magneticRig);

  const spinRig = new THREE.Group();
  spinRig.add(core, magneticRig);
  group.add(spinRig);

  const light = new THREE.PointLight(0xbfe4ff, 8, radius * 80, 2);
  group.add(light);

  group.position.set(config.x || 0, config.y || 0, config.z || 0);

  group.userData = {
    type: 'pulsar',
    name: config.name || 'Pulsar',
    category: 'PULSATING NEUTRON STAR',
    r: radius * 8,
    update(time = 0, camera = null) {
      const t = time * 0.001;
      coreMaterial.uniforms.uTime.value = t;
      beamMaterial.uniforms.uTime.value = t;
      spinRig.rotation.y = time * 3.5;

      if (camera) {
        beamMaterial.uniforms.uViewVector.value
          .copy(camera.position)
          .sub(group.position)
          .normalize();
      }
    }
  };

  group.traverse((child) => {
    if (child.isMesh) child.frustumCulled = false;
  });

  scene?.add?.(group);
  return group;
}
