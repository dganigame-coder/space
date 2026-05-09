import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// 1. Orbit State (Persistent variables for Saturn)
// Random start angle so it doesn't line up with Earth
let orbitAngle = Math.random() * Math.PI * 2; 
const orbitDistance = 572400; // 9.5 AU scale
const orbitSpeed = 0.00015;   // Saturn moves much slower than Earth

export function createSaturn() {
    const loader = new THREE.TextureLoader();
    const group = new THREE.Group();

    // The Planet
    const saturn = new THREE.Mesh(
        new THREE.SphereGeometry(2500, 64, 64),
        new THREE.MeshPhongMaterial({ 
            map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_saturn.jpg'),
            side: THREE.DoubleSide // Correct: Allows internal view for "gas" type
        })
    );
    group.add(saturn);
    
    // The Rings
    const ringGeo = new THREE.RingGeometry(3000, 5000, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        map: loader.load('https://cdn.jsdelivr.net/gh/dganigame-coder/space/navisoftspace/planets/texture/2k_saturn_ring_alpha.png'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        alphaTest: 0.5 // Ensures transparency doesn't "cut out" the planet behind it
    });
    
    const rings = new THREE.Mesh(ringGeo, ringMat);
    rings.rotation.x = Math.PI / 2; // Flatten the rings to sit on the equator
    group.add(rings);
    /**/
    // Removed the static group.position.set() so the orbit logic can control it
    group.userData = { 
        name: "SATURN", 
        info: "Ringed giant. Lowest density of any planet.",
        r: 5000, // Total radius including rings for collision/HUD
        type:"gas"
    };

    // 2. The Orbit Logic
    group.onUpdate = () => {
        // Increment Angle
        orbitAngle += orbitSpeed;

        // Apply Circular Math (Center is 0,0,0 Sun)
        group.position.x = Math.cos(orbitAngle) * orbitDistance;
        group.position.z = Math.sin(orbitAngle) * orbitDistance;

        // Self Rotation (Spinning on axis)
        saturn.rotation.y += 0.002;
    };

    return group;
}


