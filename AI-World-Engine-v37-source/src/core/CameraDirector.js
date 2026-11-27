import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { easeInOutCubic, clamp } from './utils.js';

// Cinematic camera: eased arc flights, hyperspace warp, object follow and idle auto-orbit.
export class CameraDirector {
  constructor(engine) {
    this.engine = engine;
    this.camera = engine.camera;
    this.controls = new OrbitControls(this.camera, engine.renderer.domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.06,
      rotateSpeed: 0.55,
      zoomSpeed: 0.9,
      panSpeed: 0.6,
      minDistance: 0.3,
      maxDistance: 8000,
      autoRotateSpeed: 0.25,
    });
    this.flight = null;
    this.followTarget = null;
    this._lastFollowPos = new THREE.Vector3();
    this.autoOrbit = true;
    this._idle = 0;
    this.onArrive = null;

    const resetIdle = () => { this._idle = 0; this.controls.autoRotate = false; };
    this.controls.addEventListener('start', () => {
      resetIdle();
      if (this.flight) this.flight = null;
    });
    engine.renderer.domElement.addEventListener('wheel', resetIdle, { passive: true });

    engine.addUpdater((t, dt) => this.update(t, dt));
  }

  // Fly to a position looking at a target. `warp` adds hyperspace blur for sector jumps.
  flyTo(position, target, { duration = 2.6, warp = 0, arc = 0.18 } = {}) {
    this.followTarget = null;
    const from = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const distance = from.distanceTo(position);
    this.flight = {
      from, to: position.clone(),
      fromTarget, toTarget: target.clone(),
      t: 0,
      duration: Math.max(0.3, duration),
      warp,
      lift: distance * arc,
    };
    this.controls.autoRotate = false;
    this._idle = 0;
  }

  // Frame a bounding sphere from a pleasant three-quarter angle.
  frameSphere(center, radius, opts = {}) {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = this.camera.aspect;
    const fit = radius / Math.sin(Math.min(fov, fov * aspect) / 2);
    const dist = fit * (opts.padding ?? 1.15);
    const dir = opts.direction ? opts.direction.clone().normalize() : new THREE.Vector3(opts.azimuth ?? 0.55, opts.elevation ?? 0.32, 1).normalize();
    const pos = center.clone().addScaledVector(dir, dist);
    this.controls.maxDistance = Math.max(200, dist * 12);
    this.flyTo(pos, center, opts);
    return dist;
  }

  follow(object3D, radius) {
    const wp = object3D.getWorldPosition(new THREE.Vector3());
    const dir = this.camera.position.clone().sub(wp).normalize();
    if (dir.lengthSq() < 0.01) dir.set(0.4, 0.3, 1).normalize();
    const dist = radius * 4.2;
    const pos = wp.clone().addScaledVector(dir, dist);
    this.flyTo(pos, wp, { duration: 1.8, arc: 0.08 });
    this.flight.followAfter = object3D;
    this.controls.minDistance = radius * 1.15;
  }

  stopFollow() {
    this.followTarget = null;
    this.controls.minDistance = 0.3;
  }

  update(t, dt) {
    if (this.scripted) return; // an external sequence (e.g. the launch) owns the camera
    const pass = this.engine.cinematicPass.uniforms;
    if (this.flight) {
      const f = this.flight;
      f.t += dt / f.duration;
      const k = easeInOutCubic(clamp(f.t, 0, 1));
      // Track moving targets during the flight
      if (f.followAfter) {
        const wp = f.followAfter.getWorldPosition(new THREE.Vector3());
        f.to.add(wp.clone().sub(f.toTarget));
        f.toTarget.copy(wp);
      }
      this.camera.position.lerpVectors(f.from, f.to, k);
      this.camera.position.y += Math.sin(Math.PI * k) * f.lift;
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, k);
      pass.uWarp.value = f.warp * Math.pow(Math.sin(Math.PI * clamp(f.t, 0, 1)), 1.5);
      if (f.t >= 1) {
        pass.uWarp.value = 0;
        if (f.followAfter) {
          this.followTarget = f.followAfter;
          this.followTarget.getWorldPosition(this._lastFollowPos);
        }
        this.flight = null;
        this.onArrive?.();
      }
    } else if (this.followTarget) {
      const wp = this.followTarget.getWorldPosition(new THREE.Vector3());
      const delta = wp.clone().sub(this._lastFollowPos);
      this.camera.position.add(delta);
      this.controls.target.add(delta);
      this._lastFollowPos.copy(wp);
    }

    if (!this.flight) {
      this._idle += dt;
      this.controls.autoRotate = this.autoOrbit && this._idle > 6;
    }
    this.controls.update(dt);
  }
}
