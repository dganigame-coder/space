import * as THREE from 'three';

const cache = new Map();

export async function loadTexture(url, {
  renderer = null,
  colorSpace = THREE.SRGBColorSpace,
  anisotropy = 8,
  generateMipmaps = true
} = {}) {
  if (!url) return null;

  const key = `${url}|${colorSpace}|${anisotropy}`;
  if (cache.has(key)) return cache.get(key);

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');

  const promise = new Promise((resolve, reject) => {
    loader.load(url, (texture) => {
      texture.colorSpace = colorSpace;
      texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? anisotropy;
      texture.generateMipmaps = generateMipmaps;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      resolve(texture);
    }, undefined, reject);
  });

  cache.set(key, promise);
  return promise;
}

export function pickTextureQuality(quality) {
  if (quality === 'ultra') return '8k';
  if (quality === 'high') return '4k';
  return '2k';
}
