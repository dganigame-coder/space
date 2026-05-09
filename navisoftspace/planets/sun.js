import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createSun() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // 1. THE CORE (Surface Texture)
    // We use BasicMaterial because the Sun shouldn't have shadows on it
    const sunGeom = new THREE.SphereGeometry(4000, 64, 64);
    const sunMat = new THREE.MeshBasicMaterial({
        map: loader.load('https://raw.githubusercontent.com/dganigame-coder/space/master/navisoftspace/planets/texture/2k_sun.jpg'),
    });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    group.add(sunMesh);

    // 2. THE FLARE SHELL (The "Boiling" Layer)
    // Slightly larger than the core. Uses "AdditiveBlending" to glow.
    const flareGeom = new THREE.SphereGeometry(4050, 64, 64);
    const flareMat = new THREE.MeshBasicMaterial({
        map: loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lava/lavatile.jpg'),
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    const flareMesh = new THREE.Mesh(flareGeom, flareMat);
    group.add(flareMesh);

    // 3. THE RADIANCE (The soft halo)
    // This creates the circular glow that hides the "round" edge
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 200, 50, 1)');
    grad.addColorStop(0.3, 'rgba(255, 100, 0, 0.6)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const glowTexture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
        map: glowTexture,
        blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(18000, 18000, 1); // Large halo
    group.add(sprite);

    // 4. THE LIGHT SOURCE
    // This makes the sun actually shine on your ship and other planets
    const sunLight = new THREE.PointLight(0xffffff, 10, 1000000);
    group.add(sunLight);

    // POSITIONING
    group.position.set(0, 0, 0); // The center
    group.userData = { 
        name: "THE SUN", 
        info: "Class G2V Star. Providing heat and light to the system.",
        r: 4000 ,
        type:"star"
    };

    // ANIMATION
    group.onUpdate = () => {
        sunMesh.rotation.y += 0.0005;  // Slow surface rotation
        flareMesh.rotation.y -= 0.0015; // Faster opposite rotation for "flare" effect
        flareMesh.rotation.z += 0.001;
    };

    return group;
}
