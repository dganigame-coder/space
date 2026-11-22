import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';

// Procedural ring system with radial density bands, Cassini-like gaps,
// planet shadow, back-lit forward scattering and per-particle sparkle.
export class Rings {
  constructor({ inner = 1.25, outer = 2.3, planetRadius = 1, colorA, colorB, seed = 1, opacity = 0.92 }) {
    this.inner = planetRadius * inner;
    this.outer = planetRadius * outer;
    const geo = new THREE.RingGeometry(this.inner, this.outer, 256, 8);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uInner: { value: this.inner },
        uOuter: { value: this.outer },
        uCenter: { value: new THREE.Vector3() },
        uPlanetR: { value: planetRadius },
        uSunPos: { value: new THREE.Vector3() },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uColA: { value: colorA || new THREE.Color(0.78, 0.68, 0.52) },
        uColB: { value: colorB || new THREE.Color(0.45, 0.38, 0.3) },
        uSeed: { value: seed % 53 },
        uOpacity: { value: opacity },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        varying vec3 vNormalW;
        varying vec3 vLocal;
        void main() {
          vLocal = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalW = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        ${NOISE_GLSL}
        uniform float uInner, uOuter, uPlanetR, uSeed, uOpacity, uTime;
        uniform vec3 uCenter, uSunPos, uSunColor, uColA, uColB;
        varying vec3 vWorldPos;
        varying vec3 vNormalW;
        varying vec3 vLocal;
        void main() {
          float r = length(vLocal.xz);
          float k = (r - uInner) / (uOuter - uInner);
          // Radial structure: many ringlets of varying density
          float n1 = fbm(vec3(k * 38.0, uSeed, 0.0), 5) * 0.5 + 0.5;
          float n2 = fbm(vec3(k * 140.0, uSeed + 3.0, 0.0), 3) * 0.5 + 0.5;
          float dens = mix(n1, n2, 0.35);
          dens = smoothstep(0.15, 0.85, dens);
          dens *= mix(0.55, 1.0, smoothstep(0.1, 0.45, k));                // faint inner C-ring
          dens *= 1.0 - 0.92 * smoothstep(0.585, 0.6, k) * smoothstep(0.66, 0.645, k); // Cassini division
          dens *= 1.0 - 0.6 * smoothstep(0.885, 0.89, k) * smoothstep(0.9, 0.895, k);  // Encke gap
          dens *= smoothstep(0.0, 0.03, k) * smoothstep(1.0, 0.96, k);
          if (dens < 0.01) discard;

          vec3 col = mix(uColB, uColA, n1);
          col *= 0.8 + 0.4 * n2;

          vec3 L = normalize(uSunPos - vWorldPos);
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = vNormalW;
          float sunSide = sign(dot(N, L));
          float viewSide = sign(dot(N, V));
          float lit = abs(dot(N, L)) * 0.7 + 0.3;
          // Viewing the unlit face: light diffuses through thin regions
          if (sunSide != viewSide) lit *= mix(0.9, 0.15, dens);
          // Forward scattering when looking toward the sun
          float fwd = pow(max(dot(-V, L), 0.0), 10.0) * (1.0 - dens) * 1.4;

          // Planet shadow on the rings
          vec2 hit = raySphere(vWorldPos, L, uCenter, uPlanetR);
          float shadow = (hit.x > 0.0) ? 0.04 : 1.0;

          // Micro-sparkle from ice particles
          float sparkle = pow(hash13(floor(vLocal * 900.0)), 80.0) * 0.6;

          vec3 outCol = col * uSunColor * (lit + fwd) * shadow + uSunColor * sparkle * shadow * dens;
          gl_FragColor = vec4(outCol, dens * uOpacity);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 3;
    this.mesh.name = 'Rings';
  }
}
