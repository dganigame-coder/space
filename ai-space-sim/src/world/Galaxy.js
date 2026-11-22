import * as THREE from 'three';
import { Body } from './Body.js';
import { rng, gaussian, blackbody } from '../core/utils.js';

// Spiral galaxy: logarithmic arms, central bulge, HII knots and absorbing dust lanes.
// Differential rotation is computed on the GPU so 100k+ stars animate for free.
export class Galaxy extends Body {
  constructor(spec, quality) {
    super(spec);
    this.occluder = false;
    this.spinSpeed = 0;
    const R = spec.radius;
    const rand = rng(spec.seed);
    const arms = spec.arms ?? 2 + Math.floor(rand() * 3);
    const twist = spec.twist ?? 2.6 + rand() * 1.4;
    const count = quality.galaxyStars;
    const armColor = spec.color.clone();

    const base = new Float32Array(count * 3); // r, theta, y
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const bulgeCol = blackbody(4200);
    const youngCol = blackbody(14000).lerp(armColor, 0.35);
    const oldCol = blackbody(5600);
    const hii = new THREE.Color(1.0, 0.32, 0.55);
    const c = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const roll = rand();
      let r, theta, y, size;
      if (roll < 0.22) {
        // Bulge
        r = Math.abs(gaussian(rand)) * R * 0.12;
        theta = rand() * Math.PI * 2;
        y = gaussian(rand) * R * 0.06 * Math.exp(-r / (R * 0.2));
        c.copy(bulgeCol).multiplyScalar(1.4 + rand() * 1.6);
        size = 1.0 + rand() * 1.4;
      } else {
        r = Math.min(R, -Math.log(1 - rand() * 0.985) * R * 0.28 + R * 0.04);
        const arm = Math.floor(rand() * arms);
        const armTheta = (arm / arms) * Math.PI * 2 + Math.log(r / (R * 0.04) + 1) * twist;
        const spread = (0.18 + 0.35 * (r / R)) * gaussian(rand) * 0.55;
        const inArm = rand() < 0.72;
        theta = inArm ? armTheta + spread : rand() * Math.PI * 2;
        y = gaussian(rand) * R * 0.018 * (1.2 - r / R);
        const armness = inArm ? Math.exp(-spread * spread * 18) : 0;
        c.copy(oldCol).lerp(youngCol, armness).multiplyScalar(0.55 + rand() * 0.9);
        size = 0.7 + rand() * 1.2;
        if (inArm && rand() < 0.035) {
          c.copy(hii).multiplyScalar(1.5 + rand() * 1.5);
          size = 1.8 + rand() * 2.2;
        }
        if (rand() < 0.01) { c.multiplyScalar(4.0); size *= 1.6; }
      }
      base[i * 3] = r;
      base[i * 3 + 1] = theta;
      base[i * 3 + 2] = y;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      sizes[i] = size;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.2);

    const vert = /* glsl */ `
      attribute vec3 aBase;
      attribute vec3 aColor;
      attribute float aSize;
      uniform float uTime, uPixelRatio, uRadius, uSpeed, uScale;
      varying vec3 vColor;
      void main() {
        float r = aBase.x;
        float omega = uSpeed / (0.25 + r / uRadius * 1.6);
        float a = aBase.y + uTime * omega;
        vec3 p = vec3(cos(a) * r, aBase.z, sin(a) * r);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPixelRatio * uScale * (uRadius * 6.0) / -mv.z, 0.6, 18.0 * uPixelRatio);
        vColor = aColor;
      }
    `;
    this.starMat = this.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uPixelRatio: { value: 1 }, uRadius: { value: R },
        uSpeed: { value: spec.rotationSpeed ?? 0.025 }, uScale: { value: 1.0 },
      },
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = dot(c, c);
          float a = exp(-d * 16.0);
          if (a < 0.02) discard;
          gl_FragColor = vec4(vColor * a * 0.55, 1.0);
        }
      `,
    }));
    this.stars = new THREE.Points(geo, this.starMat);
    this.pickable(this.stars);
    this.spin.add(this.stars);

    // Dust lanes: dark, normally blended particles along the inner edge of arms
    const dustCount = Math.floor(count * 0.28);
    const dBase = new Float32Array(dustCount * 3);
    const dCol = new Float32Array(dustCount * 3);
    const dSize = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      const r = Math.min(R * 0.95, -Math.log(1 - rand() * 0.97) * R * 0.3 + R * 0.08);
      const arm = Math.floor(rand() * arms);
      const armTheta = (arm / arms) * Math.PI * 2 + Math.log(r / (R * 0.04) + 1) * twist - 0.22;
      dBase[i * 3] = r;
      dBase[i * 3 + 1] = armTheta + gaussian(rand) * 0.09;
      dBase[i * 3 + 2] = gaussian(rand) * R * 0.006;
      dCol[i * 3] = 0.05; dCol[i * 3 + 1] = 0.032; dCol[i * 3 + 2] = 0.02;
      dSize[i] = 3.0 + rand() * 5.0;
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dustCount * 3), 3));
    dGeo.setAttribute('aBase', new THREE.BufferAttribute(dBase, 3));
    dGeo.setAttribute('aColor', new THREE.BufferAttribute(dCol, 3));
    dGeo.setAttribute('aSize', new THREE.BufferAttribute(dSize, 1));
    dGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.2);
    this.dustMat = this.track(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 }, uPixelRatio: { value: 1 }, uRadius: { value: R },
        uSpeed: { value: spec.rotationSpeed ?? 0.025 }, uScale: { value: 1.0 },
      },
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = exp(-dot(c, c) * 10.0) * 0.16;
          if (a < 0.005) discard;
          gl_FragColor = vec4(vColor, a);
        }
      `,
    }));
    this.dust = new THREE.Points(dGeo, this.dustMat);
    this.dust.renderOrder = 4;
    this.spin.add(this.dust);

    // Core glow
    this.coreMat = new THREE.SpriteMaterial({
      map: Galaxy.glowTexture(),
      color: bulgeCol.clone().multiplyScalar(2.2),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.core = new THREE.Sprite(this.coreMat);
    this.core.scale.setScalar(R * 0.75);
    this.spin.add(this.core);
    this.halo = new THREE.Sprite(this.coreMat.clone());
    this.halo.material.color = armColor.clone().multiplyScalar(0.25);
    this.halo.scale.setScalar(R * 2.4);
    this.spin.add(this.halo);

    this.tilt.rotation.x = spec.inclination ?? 0.35;
  }

  static glowTexture() {
    if (Galaxy._glow) return Galaxy._glow;
    const s = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.15, 'rgba(255,255,255,0.45)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.08)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    Galaxy._glow = new THREE.CanvasTexture(cv);
    Galaxy._glow.colorSpace = THREE.SRGBColorSpace;
    return Galaxy._glow;
  }

  update(t, dt, ctx) {
    super.update(t, dt, ctx);
    this.starMat.uniforms.uPixelRatio.value = ctx.pixelRatio;
    this.dustMat.uniforms.uPixelRatio.value = ctx.pixelRatio;
  }

  dispose() {
    // Shared glow texture must survive; detach before generic disposal.
    this.coreMat.map = null;
    this.halo.material.map = null;
    super.dispose();
  }
}
