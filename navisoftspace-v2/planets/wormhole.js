import * as THREE from 'three';

/**
 * Preserves createWormhole, updateWormhole, and triggerWormholeTransition.
 */
export function createWormhole(scene, config = {}) {
  const group = new THREE.Group();
  const radius = config.size || 12000;

  const coreMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(0x00d0ff) },
      uColorB: { value: new THREE.Color(0x8f4dff) }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;

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
        vec2 uv = vUv * 8.0;
        float swirl = atan(uv.y - 4.0, uv.x - 4.0);
        float vortex = noise(vec2(swirl * 2.0 + uTime * 1.5, length(uv - 4.0) * 2.0 - uTime * 2.0));

        float fresnel = pow(1.0 - abs(dot(normalize(vView), normalize(vNormal))), 2.5);
        vec3 color = mix(uColorA, uColorB, vortex);
        float alpha = (0.35 + vortex * 0.65) * (0.35 + fresnel);

        gl_FragColor = vec4(color * alpha * 2.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 48),
    coreMaterial
  );
  group.add(core);

  const ringMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x66e0ff) }
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

      void main() {
        float radial = abs(vUv.y - 0.5) * 2.0;
        float ring = smoothstep(0.18, 0.0, radial) * smoothstep(0.0, 0.06, radial);
        float flow = 0.6 + 0.4 * sin(vUv.x * 40.0 - uTime * 7.0);
        float alpha = ring * flow;
        gl_FragColor = vec4(uColor * alpha * 2.5, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.25, radius * 0.09, 32, 180),
    ringMaterial
  );
  group.add(ring);

  const light = new THREE.PointLight(0x66e0ff, 12, radius * 20, 2);
  group.add(light);

  group.position.set(config.x || 0, config.y || 0, config.z || 0);

  group.userData = {
    type: 'wormhole',
    name: config.name || 'Wormhole',
    r: radius,
    update(time = 0) {
      const t = time * 0.001;
      coreMaterial.uniforms.uTime.value = t;
      ringMaterial.uniforms.uTime.value = t;
      core.rotation.y += 0.0015;
      ring.rotation.z += 0.0022;
    }
  };

  group.traverse((child) => {
    if (child.isMesh) child.frustumCulled = false;
  });

  scene.add(group);
  return group;
}

export function updateWormhole(wormhole, time = 0) {
  wormhole?.userData?.update?.(time);
}

export function triggerWormholeTransition(scene, camera, onTeleport) {
  const duration = 3600;
  const startTime = performance.now();
  let teleported = false;

  const geometry = new THREE.CylinderGeometry(1, 1, 4000, 96, 1, true);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 1 },
      uFlash: { value: 0 }
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
      uniform float uSpeed;
      uniform float uFlash;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        float streak = hash(vec2(floor(vUv.x * 180.0), floor(vUv.y * 8.0 - uTime * uSpeed * 8.0)));
        float shape = smoothstep(0.35, 1.0, streak);
        float tube = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        vec3 color = mix(vec3(0.0, 0.45, 1.0), vec3(0.85, 0.92, 1.0), shape);
        float alpha = shape * tube + uFlash;
        gl_FragColor = vec4(color * alpha * 4.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide
  });

  const tunnel = new THREE.Mesh(geometry, material);
  tunnel.frustumCulled = false;
  tunnel.renderOrder = 999;
  scene.add(tunnel);

  function animate() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    material.uniforms.uTime.value = elapsed * 0.001;
    material.uniforms.uSpeed.value = 1 + progress * 16;
    material.uniforms.uFlash.value =
      progress > 0.42 && progress < 0.58
        ? Math.sin((progress - 0.42) * 5.2 * Math.PI)
        : 0;

    tunnel.position.copy(camera.position);
    tunnel.quaternion.copy(camera.quaternion);
    tunnel.translateZ(-2000);

    if (progress > 0.5 && !teleported) {
      teleported = true;
      onTeleport?.();
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(tunnel);
      geometry.dispose();
      material.dispose();
    }
  }

  animate();
}
