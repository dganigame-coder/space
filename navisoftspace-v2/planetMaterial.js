import * as THREE from 'three';

export function createPlanetMaterial({
  map = null, normalMap = null, roughnessMap = null, emissiveMap = null,
  color = 0xffffff, roughness = 0.85, metalness = 0.02,
  normalScale = 0.6, emissive = 0x000000, emissiveIntensity = 0
} = {}) {
  const material = new THREE.MeshStandardMaterial({
    color, map, normalMap, roughnessMap, emissiveMap,
    emissive: new THREE.Color(emissive), emissiveIntensity,
    roughness, metalness, dithering: true
  });

  if (normalMap) material.normalScale = new THREE.Vector2(normalScale, normalScale);
  return material;
}

export function createGasGiantMaterial({ map = null, color = 0xffffff, roughness = 0.65, metalness = 0 } = {}) {
  return new THREE.MeshStandardMaterial({ color, map, roughness, metalness, dithering: true });
}

export function createAtmosphere({
  radius, color = 0x4d9cff, power = 3, strength = 1, segments = 96
} = {}) {
  const geometry = new THREE.SphereGeometry(radius, segments, segments / 2);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uStrength: { value: strength }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vViewDirection), normalize(vNormal))), uPower);
        gl_FragColor = vec4(uColor, fresnel * uStrength);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide
  });

  return new THREE.Mesh(geometry, material);
}

export function createCloudLayer({ radius, map, opacity = 0.55, segments = 96 } = {}) {
  const material = new THREE.MeshStandardMaterial({
    map, transparent: true, opacity, roughness: 1, metalness: 0, depthWrite: false
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments / 2), material);
}

export function createRing({ innerRadius, outerRadius, map = null, color = 0xd8cbb4, opacity = 0.85, segments = 180 } = {}) {
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments, 1);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const distance = Math.sqrt(x * x + y * y);
    uv.setXY(i, (distance - innerRadius) / (outerRadius - innerRadius), 0.5);
  }

  const material = new THREE.MeshStandardMaterial({
    map, color, transparent: true, opacity, side: THREE.DoubleSide,
    roughness: 0.9, metalness: 0, depthWrite: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
