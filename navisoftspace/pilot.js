import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

let velocity = new THREE.Vector3();
let currentRotation = new THREE.Euler(0, 0, 0, 'YXZ');
let controls = { yaw: 0, pitch: 0, thrust: 0 };

export function initPilot() {
    const knobL = document.getElementById('knob-l');
    const knobR = document.getElementById('knob-r');

    window.addEventListener('touchmove', (e) => {
        e.preventDefault(); 
        for (let touch of e.touches) {
            if (touch.clientX < window.innerWidth / 2) {
                const centerX = 90;
                const centerY = window.innerHeight - 100;
                controls.yaw = -((touch.clientX - centerX) / 50) * 0.03;
                controls.pitch = -((touch.clientY - centerY) / 50) * 0.03;
                if(knobL) knobL.style.transform = `translate(${controls.yaw * 500}%, ${controls.pitch * 500}%)`;
            } else {
                const centerY = window.innerHeight - 100;
                controls.thrust = (centerY - touch.clientY) * 0.08;
                if(knobR) knobR.style.transform = `translateY(${-controls.thrust * 2}px)`;
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', () => {
        controls.yaw = 0; controls.pitch = 0; controls.thrust = 0;
        if(knobL) knobL.style.transform = `translate(0, 0)`;
        if(knobR) knobR.style.transform = `translate(0, 0)`;
    });
}

export function updateFlight(camera, planets) {
    currentRotation.y += controls.yaw;
    currentRotation.x += controls.pitch;
    camera.setRotationFromEuler(currentRotation);

    const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    velocity.add(forwardDir.multiplyScalar(controls.thrust * 0.02));
    velocity.multiplyScalar(0.98); 
    camera.position.add(velocity);

    planets.forEach(planet => {
        const distance = camera.position.distanceTo(planet.position);
        const radius = planet.userData.r;
        if (distance <= radius + 15) {
            velocity.set(0, 0, 0);
            const surfaceNormal = new THREE.Vector3().subVectors(camera.position, planet.position).normalize();
            camera.position.copy(planet.position).add(surfaceNormal.multiplyScalar(radius + 15));
            
            const nameEl = document.getElementById('p-name');
            const dataEl = document.getElementById('p-data');
            const intelEl = document.getElementById('surface-intel');
            
            if(nameEl) nameEl.innerText = planet.userData.name;
            if(dataEl) dataEl.innerText = planet.userData.info;
            if(intelEl) intelEl.style.display = 'block';
        }
    });

    const spdEl = document.getElementById('spd-display');
    if(spdEl) spdEl.innerText = "VELOCITY: " + (velocity.length() * 10).toFixed(1) + " AU/s";
}
