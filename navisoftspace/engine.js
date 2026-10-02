import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import * as Tone from 'https://cdn.skypack.dev/tone@14.8.49';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { playHighFi, loadSoundLibrary  } from 'audio';

/**
 * RESPONSIBILITY: 
 * 1. Initialize the WebGL Renderer
 * 2. Create the Star Background (Infinite feel)
 * 3. Set up the Sun's light source
 * 4. Handle Physics (Collisions & Shakes)
 */

/**
 * THIS IS THE ACTIVATOR
 * Call this from index.html inside the 'pointerdown' event
 */
export async function bootSystems() {
    console.log("Master Boot Sequence Initiated...");

    const T = Tone.default || Tone;
    await T.start();
    await loadSoundLibrary();

    console.log("All Systems Green. Audio State:", T.context.state);
}

export async function initEngine() {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 10, 1000000000);
    camera.position.set(0, 500, -58000);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
        powerPreference: "high-performance"
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    document.body.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.2,
        0.35,
        0.82
    );
    composer.addPass(bloomPass);

    // Lower star count significantly: 20,000 -> 8,000
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 8000; i++) {
        const x = (Math.random() - 0.5) * 80000000;
        const y = (Math.random() - 0.5) * 80000000;
        const z = (Math.random() - 0.5) * 80000000;
        starPositions.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));

    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 3000,
        sizeAttenuation: true
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const sunLight = new THREE.PointLight(0xffffff, 3, 0, 0);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    scene.fog = new THREE.Fog(0x000000, 1000, 500000000);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, composer, stars };
}

let monitorUpdateTimer;
let lastMonitorText = '';

function updateRightMonitor(spaceObject) {
    const monitor = document.getElementById('right-monitor');
    const textTarget = document.getElementById('monitor-text');

    if (!monitor || !textTarget) return;

    const newText = `
        <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 4px;">> ${spaceObject.userData.name}</div>
        <div style="font-size: 0.85rem; line-height: 1.4; opacity: 0.9;">${spaceObject.userData.info}</div>
    `;

    if (newText !== lastMonitorText) {
        textTarget.innerHTML = newText;
        lastMonitorText = newText;
    }

    monitor.style.opacity = '1';

    clearTimeout(monitorUpdateTimer);
    monitorUpdateTimer = setTimeout(() => {
        monitor.style.opacity = '0';
    }, 5000);
}

let isColliding = false;
let monitorTimer;
let activeAmbient = false;

const proximityCache = new Map();
let lastCacheUpdate = 0;
const CACHE_UPDATE_INTERVAL = 100;

export function checkCollisions(camera, bodies, scene) {
    if (!bodies || !scene || !scene.fog) return;

    const now = performance.now();
    let globalInAmbientZone = false;
    let absoluteMaxPenetration = 0;

    if (now - lastCacheUpdate > CACHE_UPDATE_INTERVAL) {
        proximityCache.clear();
        lastCacheUpdate = now;
        bodies.forEach(spaceObject => {
            if (!spaceObject || !spaceObject.userData) return;
            proximityCache.set(spaceObject, camera.position.distanceTo(spaceObject.position));
        });
    }

    bodies.forEach(spaceObject => {
        if (!spaceObject || !spaceObject.userData) return;

        const cachedDist = proximityCache.get(spaceObject);
        const dist = cachedDist !== undefined ? cachedDist : camera.position.distanceTo(spaceObject.position);
        const radius = spaceObject.userData.r || 500;
        const type = spaceObject.userData.type;
        const customSound = spaceObject.userData.sound;

        if (dist > camera.far + radius) return;

        if (dist < camera.far * 2 && spaceObject.userData.isBreathing && spaceObject.children) {
            const childCount = spaceObject.children.length;
            const step = Math.max(1, Math.floor(childCount / 20));

            for (let i = 0; i < childCount; i += step) {
                const child = spaceObject.children[i];

                if (child instanceof THREE.Sprite) {
                    child.userData.phase = (child.userData.phase || 0) + (child.userData.speed || 0.005);
                    const pulse = Math.sin(child.userData.phase) * 0.05;
                    child.material.opacity = (child.userData.baseOpacity || 0.1) + pulse;
                    child.material.rotation += 0.0002;
                }

                if (child instanceof THREE.PointLight && type === 'supernova') {
                    const noise = Math.random() * 2;
                    const heat = Math.sin(now * 0.001) * 5;
                    child.intensity = 15 + noise + heat;
                }
            }
        }

        if (typeof spaceObject.onUpdate === 'function' && dist < camera.far) {
            spaceObject.onUpdate();
        }

        if (type === 'asteroid_belt' || type === 'protoplanetary_disk') {
            const innerRadius = spaceObject.userData.innerRadius || 0;
            const outerRadius = spaceObject.userData.outerRadius || 0;
            const distFromCenter = camera.position.length();

            if (distFromCenter >= innerRadius && distFromCenter <= outerRadius) {
                globalInAmbientZone = true;

                const mid = (innerRadius + outerRadius) / 2;
                const halfWidth = (outerRadius - innerRadius) / 2;
                const penetration = 1 - (Math.abs(distFromCenter - mid) / halfWidth);
                const safePenetration = Math.max(0, Math.min(1, penetration));

                playHighFi(customSound || 'ASTEROID_BELT', safePenetration);

                let currentSpeed = 0;
                if (typeof engine !== 'undefined' && engine.velocity) {
                    currentSpeed = typeof engine.velocity.length === 'function'
                        ? engine.velocity.length()
                        : engine.velocity;
                } else if (typeof velocity !== 'undefined' && velocity) {
                    currentSpeed = typeof velocity.length === 'function' ? velocity.length() : velocity;
                }

                if (currentSpeed > 0) {
                    const currentTime = performance.now();
                    if (typeof window.lastImpactTime === 'undefined') window.lastImpactTime = 0;

                    if (currentTime - window.lastImpactTime > 500) {
                        if (Math.random() < 0.04 * safePenetration) {
                            playHighFi('BELT_ROCK', safePenetration);
                            window.lastImpactTime = currentTime;
                        }
                    }
                }
            }
        }

        if (dist < radius) {
            const penetration = Math.max(0, (radius - dist) / radius);
            globalInAmbientZone = true;

            if (type === 'gas') {
                absoluteMaxPenetration = Math.max(absoluteMaxPenetration, penetration);
                updateRightMonitor(spaceObject);
                triggerAtmosphereEntry(camera, spaceObject, penetration);
                playHighFi('GAS_RUSH', penetration);
            }
            else if (type === 'star') {
                updateRightMonitor(spaceObject);
                triggerSolarFlare(camera, spaceObject);
                playHighFi('SOLAR_STATIC', penetration);
            }
            else if (type === 'blackhole') {
                updateRightMonitor(spaceObject);
                playHighFi('VOID_GRAVITY', penetration);
            }
            else if (type === 'wormhole') {
                updateRightMonitor(spaceObject);
                playHighFi('WORMHOLE_PULSE', penetration);
                camera.rotation.z += Math.sin(now * 0.01) * penetration * 0.1;
            }
            else if (type === 'supernova') {
                updateRightMonitor(spaceObject);
                const state = spaceObject.userData.state;

                switch (state) {
                    case 'EXPLODING':
                        triggerSolarFlare(camera, spaceObject);
                        playHighFi('SUPERNOVA_EXPLOSION_ZONE', penetration);
                        break;
                    case 'NEBULA':
                        playHighFi('NEBULA_WIND', penetration);
                        break;
                    case 'STABLE':
                    default:
                        playHighFi('STELLAR_CORONA', penetration);
                        break;
                }
            }
            else if (type === 'solid' || type === 'exoplanet' || type === 'exoplanet_system') {
                if (typeof window.isColliding === 'undefined') window.isColliding = false;
                if (!window.isColliding) {
                    updateRightMonitor(spaceObject);
                    triggerImpact(camera);
                    playHighFi('HULL_IMPACT');
                    playHighFi('COCKPIT_ALARM');
                    window.isColliding = true;
                    setTimeout(() => window.isColliding = false, 1000);
                }
            }
            else if (type === 'pulsar') {
                updateRightMonitor(spaceObject);
                triggerSolarFlare(camera, spaceObject);
                playHighFi(customSound || 'PULSAR_BEAT', penetration);
                spaceObject.rotation.y += 0.05;
            }
            else if (type === 'quasar') {
                updateRightMonitor(spaceObject);
                triggerSolarFlare(camera, spaceObject);
                playHighFi(customSound || 'QUASAR_BEAM', penetration);
            }
        }
    });

    if (globalInAmbientZone && absoluteMaxPenetration > 0.05) {
        scene.fog.color.setHex(0x332211);
        scene.fog.near = 10;
        scene.fog.far = 10000 - (absoluteMaxPenetration * 9500);
    } else {
        scene.fog.far = 10000000;
    }

    if (!globalInAmbientZone) {
        playHighFi('GAS_RUSH', 0);
        playHighFi('SOLAR_STATIC', 0);
        playHighFi('VOID_GRAVITY', 0);
        playHighFi('WORMHOLE_PULSE', 0);
        activeAmbient = false;
    } else {
        activeAmbient = true;
    }
}

let lastFilterUpdateTime = 0;
const FILTER_UPDATE_THROTTLE = 50;

function updateScreenFilter(filterString) {
    const now = performance.now();
    if (now - lastFilterUpdateTime > FILTER_UPDATE_THROTTLE) {
        document.body.style.filter = filterString;
        lastFilterUpdateTime = now;
    }
}

function triggerAtmosphereEntry(camera, spaceObject, penetration) {
    if (window.currentSpeed) {
        const dragFactor = 1 - (penetration * 0.08);
        window.currentSpeed *= dragFactor;
    }

    const shakeAmount = penetration * 5;
    camera.position.x += (Math.random() - 0.5) * shakeAmount;
    camera.position.y += (Math.random() - 0.5) * shakeAmount;

    if (navigator.vibrate) {
        navigator.vibrate(Math.round(penetration * 50));
    }
}

export function triggerSolarFlare(camera, spaceObject) {
    const dist = camera.position.distanceTo(spaceObject.position);
    const radius = spaceObject.userData.r || 5000;
    const penetration = Math.max(0, (radius - dist) / radius);

    const basePush = 120;
    const exponentialForce = penetration * 600;
    camera.translateZ(basePush + exponentialForce);

    updateScreenFilter(`contrast(${1.5 + penetration}) sepia(0.5) saturate(2)`);
    setTimeout(() => {
        updateScreenFilter('none');
    }, 50);

    if (window.currentSpeed) window.currentSpeed *= 0.8;
    if (navigator.vibrate) navigator.vibrate(Math.round(penetration * 100));
}

function triggerImpact(camera) {
    camera.translateZ(200);
    if (navigator.vibrate) navigator.vibrate(200);
}
