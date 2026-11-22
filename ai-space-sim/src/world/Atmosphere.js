import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.js';

// Single-scattering atmosphere, ray-marched per pixel against the true planet sphere.
// Produces a correct limb glow, blue day-side haze and red-orange terminator.
export function createAtmosphere({ radius, thickness = 0.045, color, density = 1.0, mie = 0.35, steps = 12 }) {
  const outer = radius * (1 + thickness);
  const H = outer - radius;
  const scatter = color.clone();
  // Normalise scattering color so the brightest channel ~1, then scale to scene units
  const m = Math.max(scatter.r, scatter.g, scatter.b) || 1;
  scatter.multiplyScalar(1 / m);
  const betaR = new THREE.Vector3(scatter.r, scatter.g, scatter.b).multiplyScalar((1.6 * density) / H);
  const betaM = new THREE.Vector3(1, 1, 1).multiplyScalar((0.35 * mie * density) / H);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    defines: { STEPS: steps },
    uniforms: {
      uCenter: { value: new THREE.Vector3() },
      uRp: { value: radius },
      uRa: { value: outer },
      uSunPos: { value: new THREE.Vector3(500, 200, 300) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uBetaR: { value: betaR },
      uBetaM: { value: betaM },
      uIntensity: { value: 7.0 },
      uScale: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      uniform vec3 uCenter, uSunPos, uBetaR, uBetaM;
      uniform vec3 uSunColor;
      uniform float uRp, uRa, uIntensity, uScale;
      varying vec3 vWorldPos;

      void main() {
        float rp = uRp * uScale;
        float ra = uRa * uScale;
        vec3 ro = cameraPosition;
        vec3 rd = normalize(vWorldPos - ro);
        vec2 ta = raySphere(ro, rd, uCenter, ra);
        if (ta.y < 0.0) discard;
        float t0 = max(ta.x, 0.0);
        float t1 = ta.y;
        vec2 tp = raySphere(ro, rd, uCenter, rp);
        if (tp.x > 0.0) t1 = min(t1, tp.x);
        if (t1 <= t0) discard;

        vec3 L = normalize(uSunPos - uCenter);
        float H = ra - rp;
        float ds = (t1 - t0) / float(STEPS);
        vec3 bR = uBetaR / uScale;
        vec3 bM = uBetaM / uScale;
        vec3 sumR = vec3(0.0);
        vec3 sumM = vec3(0.0);
        float odR = 0.0, odM = 0.0;
        for (int i = 0; i < STEPS; i++) {
          vec3 p = ro + rd * (t0 + (float(i) + 0.5) * ds);
          vec3 n = p - uCenter;
          float r = length(n);
          float h = clamp((r - rp) / H, 0.0, 1.0);
          float dR = exp(-h * 4.5) * ds;
          float dM = exp(-h * 14.0) * ds;
          odR += dR; odM += dM;
          // Optical depth toward the sun (analytic approximation along L)
          float mu = dot(n / r, L);
          float lightPath = raySphere(p, L, uCenter, ra).y;
          float lR = lightPath * exp(-h * 4.5) * 0.55;
          float lM = lightPath * exp(-h * 14.0) * 0.55;
          // Soft planet shadow / terminator
          float shadow = smoothstep(-0.18, 0.12, mu);
          vec3 tau = bR * (odR + lR) + bM * 1.1 * (odM + lM);
          vec3 att = exp(-tau) * shadow;
          sumR += dR * att;
          sumM += dM * att;
        }
        float mu = dot(rd, L);
        float phaseR = 0.0597 * (1.0 + mu * mu);
        float g = 0.76;
        float g2 = g * g;
        float phaseM = 0.1193 * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
        vec3 col = uIntensity * uSunColor * (sumR * bR * phaseR + sumM * bM * phaseM);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(outer, 96, 64), material);
  mesh.name = 'Atmosphere';
  mesh.renderOrder = 5;
  mesh.userData.isAtmosphere = true;
  return mesh;
}
