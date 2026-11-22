import * as THREE from 'three';
import { EffectComposer } from 'effectcomposer';
import { RenderPass } from 'renderpass';
import { UnrealBloomPass } from 'unrealbloompass';
import { createStars } from 'stars';
import { PerformanceManager } from './performance.js';

export async function bootSystems() {
  try {
    const tone = await import('tone');
    const T = tone.default || tone;
    if (T.context && T.context.state !== 'running') await T.start();
  } catch (error) {
    console.warn('[navisoftspace] Audio could not start:', error);
  }
}

export async function initEngine(options = {}) {
  const quality = options.quality || PerformanceManager.detectQuality();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000006);

  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    1,
    2000000000
  );
  camera.position.set(0, 500, -58000);

  const renderer = new THREE.WebGLRenderer({
    antialias: quality !== 'performance',
    logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
    stencil: false
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;

  const performance = new PerformanceManager(renderer, quality);
  renderer.setPixelRatio(performance.getRenderScale());
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  let bloomPass = null;
  if (quality !== 'performance') {
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      quality === 'ultra' ? 0.85 : 0.55,
      0.65,
      0.82
    );
    composer.addPass(bloomPass);
  }

  const starCount =
    quality === 'ultra' ? 50000 :
    quality === 'high' ? 35000 :
    quality === 'balanced' ? 20000 : 8000;

  const stars = createStars({ count: starCount });
  scene.add(stars);

  const sunLight = new THREE.DirectionalLight(0xfff2d0, 3.2);
  sunLight.position.set(0, 0, 1);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0x223355, 0x000000, 0.08));
  scene.fog = new THREE.FogExp2(0x000004, 0.0000015);

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(performance.getRenderScale());
    renderer.setSize(width, height);
    composer.setSize(width, height);
    if (bloomPass) bloomPass.resolution.set(width, height);
  };

  window.addEventListener('resize', resize, { passive: true });
  resize();

  performance.start((scale) => {
    renderer.setPixelRatio(scale);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, composer, stars, performance, quality };
}

const proximityCache = new Map();
let lastCacheUpdate = 0;
const CACHE_INTERVAL_MS = 120;

export function checkCollisions(camera, bodies, scene) {
  if (!camera || !bodies) return;

  const now = performance.now();
  if (now - lastCacheUpdate > CACHE_INTERVAL_MS) {
    proximityCache.clear();
    for (const body of bodies) {
      if (!body?.position) continue;
      proximityCache.set(body, camera.position.distanceToSquared(body.position));
    }
    lastCacheUpdate = now;
  }

  for (const body of bodies) {
    if (!body?.userData) continue;
    const radius = body.userData.r || 1;
    const collisionDistance = radius * 1.15;
    const distanceSquared = proximityCache.get(body) ?? Infinity;
    body.userData.isColliding = distanceSquared <= collisionDistance * collisionDistance;
  }
}
