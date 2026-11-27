import * as THREE from 'three';
import { Rocket, ExhaustTrail } from '../world/Rocket.js';
import { clamp, easeInOutCubic } from './utils.js';

const EARTH_RADIUS_M = 6371000;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Timeline (seconds of playback)
const T_IGNITION = 2.2;
const T_LIFTOFF = 3.6;
const T_ASCENT = 20;          // liftoff -> orbit insertion
const T_HANDOVER = T_LIFTOFF + T_ASCENT;
const S_MAXQ = 0.35;
const S_SEP = 0.7;
const MET_SCALE = 26;         // playback seconds -> mission seconds (≈8.7 min to orbit)

const EVENTS = [
  [0, 'Terminal count'],
  [T_IGNITION, 'Ignition'],
  [T_LIFTOFF, 'Liftoff'],
  [T_LIFTOFF + T_ASCENT * S_MAXQ, 'Max-Q'],
  [T_LIFTOFF + T_ASCENT * S_SEP, 'Stage separation'],
  [T_LIFTOFF + T_ASCENT * 0.845, 'Kármán line · 100 km'],
  [T_HANDOVER, 'Orbit insertion'],
];

// Cinematic launch from Earth's surface to orbit. Everything is authored in the planet's
// spin-local frame (the planet's rotation is paused for the duration) at true metre scale.
export class LaunchSequence {
  constructor({ engine, director, world, onTelemetry, onEvent, onDone }) {
    this.engine = engine;
    this.director = director;
    this.world = world;
    this.onTelemetry = onTelemetry;
    this.onEvent = onEvent;
    this.onDone = onDone;
    this.earth = world.bodies.find((b) => b.kind === 'planet' && b.spec.surface === 'terran') || world.bodies[0];
    this.R = this.earth.radius;
    this.M = this.R / EARTH_RADIUS_M; // scene units per metre
    this.t = 0;
    this.done = false;
    this._eventIdx = 0;
    this._emitAcc = 0;
    this._setup();
    this._remove = engine.addUpdater((t, dt) => this.update(Math.min(dt, 0.05)));
  }

  _setup() {
    const { earth, engine, M, R } = this;
    const cam = engine.camera;
    this._saved = {
      near: cam.near, far: cam.far, up: cam.up.clone(), spin: earth.spinSpeed,
      cloudScale: earth.cloudMesh?.scale.x ?? 1,
      starDim: engine.skybox?.stars.material.uniforms.uDim?.value ?? 1,
    };
    earth.spinSpeed = 0;
    earth.root.updateMatrixWorld(true);

    // Launch site: morning launch, sun ~14 degrees above the eastern horizon, downrange toward the sun.
    const inv = new THREE.Matrix4().copy(earth.spin.matrixWorld).invert();
    const sunL = this.world.sunPos.clone().applyMatrix4(inv).normalize();
    const U = sunL.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -THREE.MathUtils.degToRad(76));
    U.y = clamp(U.y + 0.35, -0.8, 0.8);
    U.normalize();
    let E = sunL.clone().addScaledVector(U, -sunL.dot(U));
    if (E.lengthSq() < 1e-6) E.set(1, 0, 0).addScaledVector(U, -U.x);
    E.normalize();
    const S = new THREE.Vector3().crossVectors(E, U).normalize();
    Object.assign(this, { U, E, S });

    this.rig = new THREE.Group();
    this.rig.name = 'Launch rig';
    earth.spin.add(this.rig);

    // High-resolution terrain patch around the pad (same surface shader, ~0.2 m facet error).
    const theta = Math.acos(clamp(U.y, -1, 1));
    const phi = Math.atan2(U.z, -U.x);
    const span = THREE.MathUtils.degToRad(8);
    const patchGeo = new THREE.SphereGeometry(R, 512, 512, phi - span, span * 2, Math.max(0, theta - span), span * 2);
    this.patch = new THREE.Mesh(patchGeo, earth.surfaceMat);
    this.patch.renderOrder = 0;
    this.rig.add(this.patch);
    if (earth.surfaceMat.uniforms.uDetail) earth.surfaceMat.uniforms.uDetail.value = 1;

    // Low clouds while we are inside the atmosphere (≈14 km deck); restored as we leave.
    if (earth.cloudMesh) {
      earth.cloudMesh.scale.setScalar(1.0022 / 1.012);
      earth.cloudMat.side = THREE.DoubleSide;
    }

    // Vehicle and pad, authored in metres.
    this.basis = new THREE.Matrix4().makeBasis(E, U, S);
    this.rocket = new Rocket();
    this.rocket.group.scale.setScalar(M);
    this.rocket.unit = M;
    this.rig.add(this.rocket.group);
    this.pad = this._buildPad();
    this.pad.scale.setScalar(M);
    this.pad.position.copy(U).multiplyScalar(R);
    this.pad.quaternion.setFromRotationMatrix(this.basis);
    this.rig.add(this.pad);

    // Solid hardware draws after the (depth-test-free) in-atmosphere sky so it is never hazed over.
    for (const root of [this.rocket.group, this.pad]) {
      root.traverse((o) => {
        if (!o.isMesh || o.material.isShaderMaterial) return;
        o.renderOrder = 20;
        o.material.transparent = true;
      });
    }
    this.trail = new ExhaustTrail(1600);
    this.trail.mat.uniforms.uUnit.value = M;
    this.rig.add(this.trail.points);

    this.director.flight = null;
    this.director.scripted = true;
    this.director.controls.enabled = false;
    this._placeRocket(0);
    this._camPos = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  _buildPad() {
    const g = new THREE.Group();
    const concrete = new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 0.95 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.6, metalness: 0.7 });
    const red = new THREE.MeshStandardMaterial({ color: 0x8a2a1e, roughness: 0.7, metalness: 0.3 });
    this._padMats = [concrete, steel, red];
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(70, 80, 3, 48), concrete);
    deck.position.y = -1.6;
    g.add(deck);
    const trench = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 60), steel);
    trench.position.set(0, -1.4, 30);
    g.add(trench);
    // Lattice service tower
    const tower = new THREE.Group();
    const leg = new THREE.BoxGeometry(0.6, 82, 0.6);
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      const m = new THREE.Mesh(leg, red);
      m.position.set(x, 41, z);
      tower.add(m);
    }
    const brace = new THREE.BoxGeometry(8.6, 0.35, 0.35);
    for (let y = 4; y < 82; y += 6) {
      for (const z of [-3, 3]) {
        const b = new THREE.Mesh(brace, red);
        b.position.set(0, y, z);
        b.rotation.z = (y / 6) % 2 ? 0.6 : -0.6;
        tower.add(b);
      }
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 1.6), steel);
    arm.position.set(-6.5, 64, 0);
    tower.add(arm);
    tower.position.set(10.5, 0, 0);
    g.add(tower);
    // Lightning masts
    for (const [x, z] of [[-45, -40], [45, -40], [0, 55]]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 110, 8), steel);
      mast.position.set(x, 55, z);
      g.add(mast);
    }
    return g;
  }

  // Ascent profile: altitude ~ s^2.4 (slow vertical rise, then pitch-over), downrange ~ s^3.1.
  _traj(s, out = new THREE.Vector3()) {
    const alt = 150e3 * Math.pow(s, 2.4);
    const down = 420e3 * Math.pow(s, 3.1);
    const dir = this.U.clone().addScaledVector(this.E, down / EARTH_RADIUS_M).normalize();
    return out.copy(dir).multiplyScalar(this.R + (alt + 0.5) * this.M);
  }

  _placeRocket(s) {
    const P = this._traj(s);
    const P2 = this._traj(Math.min(1.2, s + 0.002));
    let F = P2.clone().sub(P);
    if (s < 0.004 || F.lengthSq() < 1e-20) F = this.U.clone();
    F.normalize();
    const up = P.clone().normalize();
    const side = new THREE.Vector3().crossVectors(F, up);
    if (side.lengthSq() < 1e-10) side.copy(this.S);
    side.normalize();
    const back = new THREE.Vector3().crossVectors(side, F).normalize();
    const m = new THREE.Matrix4().makeBasis(side, F, back);
    this.rocket.group.position.copy(P);
    this.rocket.group.quaternion.setFromRotationMatrix(m);
    this.rocketPos = P;
    this.rocketF = F;
    this.rocketUp = up;
    return P;
  }

  skip() {
    if (this.done) return;
    this.t = Math.max(this.t, T_HANDOVER);
  }

  abort() {
    this._finish(true);
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    const t = this.t;
    const { M, rocket, trail, engine } = this;
    const time = engine.clock?.elapsedTime ?? performance.now() / 1000;
    const spinW = this.earth.spin.matrixWorld;

    // Events
    while (this._eventIdx < EVENTS.length && t >= EVENTS[this._eventIdx][0]) {
      this.onEvent?.(EVENTS[this._eventIdx][1]);
      this._eventIdx++;
    }

    const s = clamp((t - T_LIFTOFF) / T_ASCENT, 0, 1);
    if (s >= S_SEP && !rocket.separated) {
      rocket.separate();
      this._stage1 = { pos: this.rocketPos.clone(), vel: this.rocketF.clone().multiplyScalar(-40 * M).addScaledVector(this.rocketUp, -25 * M), spin: 0 };
      this.rig.attach(rocket.stage1);
    }
    this._placeRocket(s);
    const altM = 150e3 * Math.pow(s, 2.4);
    const vac = smooth(8e3, 90e3, altM);
    const throttle = t < T_IGNITION ? 0 : rocket.separated ? 1 : smooth(T_IGNITION, T_LIFTOFF, t) * (s > S_MAXQ - 0.06 && s < S_MAXQ + 0.06 ? 0.72 : 1);
    rocket.setEngine(time, throttle, vac);
    rocket.hemi.intensity = 0.55 * (1 - vac);

    // Jettisoned first stage tumbles away
    if (this._stage1) {
      const st = this._stage1;
      st.pos.addScaledVector(st.vel, dt);
      st.vel.addScaledVector(this.rocketUp, -9.8 * M * dt * 3);
      rocket.stage1.position.copy(st.pos);
      rocket.stage1.rotateX(dt * 0.35);
    }

    // Exhaust: dense ground cloud at liftoff, contrail through the lower atmosphere.
    const nozzle = rocket.group.localToWorld(new THREE.Vector3(0, rocket.separated ? 44 : -2, 0));
    rocket.group.parent.worldToLocal(nozzle);
    trail.mat.uniforms.uTime.value = t;
    trail.mat.uniforms.uNozzle.value.copy(nozzle);
    trail.mat.uniforms.uGlow.value = throttle * (1 - vac);
    trail.mat.uniforms.uViewH.value = engine.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(engine.camera.fov) / 2));
    trail.mat.uniforms.uDaylight.value = 1;
    if (throttle > 0.05 && vac < 0.95) {
      const rate = s < 0.02 ? 260 : 120;
      this._emitAcc += dt * rate;
      while (this._emitAcc >= 1) {
        this._emitAcc -= 1;
        const rnd = () => Math.random() - 0.5;
        if (s < 0.03) {
          // Ground cloud billows out of the flame trench and around the pad
          const out = this.S.clone().multiplyScalar(rnd()).addScaledVector(this.E, rnd() + (Math.random() < 0.6 ? 0.9 : 0)).normalize();
          const p = this.U.clone().multiplyScalar(this.R + 4 * M).addScaledVector(out, 10 * M);
          const v = out.multiplyScalar((30 + Math.random() * 60) * M).addScaledVector(this.U, (4 + Math.random() * 10) * M);
          trail.emit(t, p, v, 1.6 + Math.random() * 1.5);
        } else {
          const p = nozzle.clone().addScaledVector(this.rocketF, -Math.random() * 30 * M)
            .add(new THREE.Vector3(rnd(), rnd(), rnd()).multiplyScalar(4 * M));
          const v = this.rocketF.clone().multiplyScalar(-12 * M).add(new THREE.Vector3(rnd(), rnd(), rnd()).multiplyScalar(6 * M));
          trail.emit(t, p, v, 1 + altM / 8000);
        }
      }
    }

    // Sky: stars come out as the air thins
    const daylight = 1 - smooth(25e3, 95e3, altM);
    const stars = engine.skybox?.stars.material.uniforms.uDim;
    if (stars) stars.value = THREE.MathUtils.lerp(1, 0.03, daylight);

    // Camera
    const cam = engine.camera;
    const center = this.rocketPos.clone().addScaledVector(this.rocketF, 30 * M);
    const padCam = this.U.clone().multiplyScalar(this.R + 16 * M).addScaledVector(this.S, 175 * M).addScaledVector(this.E, -80 * M);
    const d = (105 + Math.min(altM * 0.012, 1100)) * M;
    const chase = this.rocketPos.clone()
      .addScaledVector(this.rocketF, -d * 0.82)
      .addScaledVector(this.S, d * 0.5)
      .addScaledVector(this.rocketUp, d * 0.18);
    const kChase = easeInOutCubic(smooth(T_LIFTOFF + 1.4, T_LIFTOFF + 4.8, t));
    this._camPos.lerpVectors(padCam, chase, kChase);
    this._look.copy(center);

    // Engine vibration (strongest at the pad and through Max-Q)
    const maxq = Math.exp(-Math.pow((s - S_MAXQ) / 0.06, 2));
    const shake = throttle * ((1 - kChase) * 0.35 + kChase * (0.06 + maxq * 0.25)) * (1 - vac);
    const shakeVec = new THREE.Vector3(Math.sin(time * 71.3), Math.sin(time * 53.1 + 1.3), Math.sin(time * 61.7 + 2.1))
      .multiplyScalar(shake * M * (1 + kChase * altM * 0.0015));
    this._look.add(shakeVec);

    if (t < T_HANDOVER) {
      const wp = this._camPos.clone().applyMatrix4(spinW);
      const wl = this._look.clone().applyMatrix4(spinW);
      const wu = this.U.clone().lerp(this.rocketUp, kChase).transformDirection(spinW);
      cam.position.copy(wp);
      cam.up.copy(wu);
      cam.lookAt(wl);
      this.director.controls.target.copy(wl);
      const distRocket = this._camPos.distanceTo(this.rocketPos);
      cam.near = clamp(distRocket * 0.02, 2e-7 * this.R, 0.05);
      cam.far = 90;
      cam.updateProjectionMatrix();
    } else if (!this._handed) {
      this._handed = true;
      // Pull back to a full view of Earth, keeping the launch site beneath us.
      this.director.scripted = false;
      this.director.controls.enabled = true;
      const earthC = this.earth.root.getWorldPosition(new THREE.Vector3());
      const dir = cam.position.clone().sub(earthC).normalize();
      const sunDir = this.world.sunPos.clone().sub(earthC).normalize();
      dir.lerp(sunDir, 0.35).normalize();
      this.director.frameSphere(earthC, this.R * 1.25, { duration: 6.5, direction: dir, arc: 0.05 });
      this._handT = 0;
      this._upFrom = cam.up.clone();
    } else {
      // Ease the camera roll back to world-up and restore clip planes as we pull away.
      this._handT += dt / 6.5;
      const k = easeInOutCubic(clamp(this._handT, 0, 1));
      cam.up.copy(this._upFrom).lerp(new THREE.Vector3(0, 1, 0), k).normalize();
      cam.lookAt(this.director.controls.target);
      const earthC = this.earth.root.getWorldPosition(new THREE.Vector3());
      const alt = cam.position.distanceTo(earthC) - this.R;
      cam.near = clamp(alt * 0.25, 1e-5, this._saved.near);
      cam.far = THREE.MathUtils.lerp(90, this._saved.far, k);
      cam.updateProjectionMatrix();
      if (this.earth.cloudMesh) this.earth.cloudMesh.scale.setScalar(THREE.MathUtils.lerp(1.0022 / 1.012, 1, k));
      if (k >= 1) this._finish(false);
    }

    const met = (t - T_LIFTOFF) * MET_SCALE;
    this.onTelemetry?.({
      met,
      altKm: altM / 1000,
      velKms: 7.8 * Math.pow(s, 1.6),
      downKm: 420 * Math.pow(s, 3.1),
      stage: rocket.separated ? 2 : 1,
      phase: t < T_LIFTOFF ? 'pad' : t < T_HANDOVER ? 'ascent' : 'orbit',
    });
  }

  _finish(aborted) {
    if (this.done) return;
    this.done = true;
    this._remove?.();
    const cam = this.engine.camera;
    cam.near = this._saved.near;
    cam.far = this._saved.far;
    cam.up.set(0, 1, 0);
    cam.updateProjectionMatrix();
    this.earth.spinSpeed = this._saved.spin;
    if (this.earth.cloudMesh) {
      this.earth.cloudMesh.scale.setScalar(1);
      this.earth.cloudMat.side = THREE.FrontSide;
    }
    if (this.earth.surfaceMat.uniforms.uDetail) this.earth.surfaceMat.uniforms.uDetail.value = 0;
    const stars = this.engine.skybox?.stars.material.uniforms.uDim;
    if (stars) stars.value = 1;
    this.director.scripted = false;
    this.director.controls.enabled = true;
    this.rocket.dispose();
    this.rocket.stage1.removeFromParent();
    this.trail.dispose();
    this.patch.geometry.dispose();
    this.pad.traverse((o) => o.geometry?.dispose());
    for (const m of this._padMats) m.dispose();
    this.rig.removeFromParent();
    this.onDone?.(aborted);
  }
}
