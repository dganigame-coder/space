import * as THREE from 'three';
import { normalizeBody } from './catalog.js';
import { Planet } from './Planet.js';
import { GasGiant } from './GasGiant.js';
import { Rings } from './Rings.js';
import { Star } from './Star.js';
import { Galaxy } from './Galaxy.js';
import { Nebula } from './Nebula.js';
import { BlackHole } from './BlackHole.js';
import { AsteroidBelt, Asteroid, Comet } from './Minor.js';
import { rng } from '../core/utils.js';

const FACTORIES = {
  star: Star,
  planet: Planet,
  gas_giant: GasGiant,
  spiral_galaxy: Galaxy,
  nebula: Nebula,
  black_hole: BlackHole,
  asteroid_belt: AsteroidBelt,
  asteroid: Asteroid,
  comet: Comet,
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class World {
  constructor(engine, config) {
    this.engine = engine;
    this.config = config;
    this.group = new THREE.Group();
    this.group.name = 'World';
    this.bodies = [];
    this.orbitLines = [];
    this.sunPos = new THREE.Vector3(900, 260, 500);
    this.sunColor = new THREE.Color(1, 1, 1);
    this.star = null;
    this._flareVis = 0;
    this.showOrbits = true;

    this.ambient = new THREE.AmbientLight(0x8899bb, 0.035);
    this.group.add(this.ambient);
    this.fillLight = new THREE.DirectionalLight(0xffffff, 2.6);
    this.group.add(this.fillLight);
    this.group.add(this.fillLight.target);

    this._build(config);
    engine.scene.add(this.group);
  }

  _build(config) {
    const quality = this.engine.quality;
    const rawObjects = Array.isArray(config.objects) && config.objects.length ? config.objects : [config];
    const specs = rawObjects.slice(0, 40).map((o, i) => normalizeBody(o, i));

    // Rings described as separate objects attach to the nearest planet.
    const ringSpecs = specs.filter((s) => s.kind === 'ring');
    let bodySpecs = specs.filter((s) => s.kind !== 'ring');
    for (const ring of ringSpecs) {
      const host = bodySpecs.find((s) => s.name === ring.parent) ||
        bodySpecs.filter((s) => s.kind === 'gas_giant' || s.kind === 'planet')
          .sort((a, b) => Math.abs(a.distance - ring.distance) - Math.abs(b.distance - ring.distance))[0];
      if (host && !host.rings) {
        const inner = (+ring.raw.geometryArgs?.[0] || host.radius * 1.3) / host.radius;
        const outer = (+ring.raw.geometryArgs?.[1] || host.radius * 2.2) / host.radius;
        host.rings = { inner: Math.max(1.1, inner), outer: Math.max(inner + 0.3, outer), colorA: ring.palette[2], colorB: ring.palette[0] };
      }
    }

    // A single star becomes the system center.
    const stars = bodySpecs.filter((s) => s.kind === 'star');
    const primary = stars[0] || null;
    if (primary) { primary.distance = 0; primary.position = [0, 0, 0]; primary.parent = null; }

    // Moons orbit their parents; everything else with a distance orbits the primary/origin.
    const byName = new Map(bodySpecs.map((s) => [s.name.toLowerCase(), s]));
    for (const s of bodySpecs) {
      if (s.parent) {
        const p = byName.get(String(s.parent).toLowerCase());
        s.parentSpec = p && p !== s ? p : null;
        if (!s.parentSpec) s.parent = null;
      }
    }

    // If nothing is central, make the largest body the center of the view.
    if (!primary) {
      const central = bodySpecs.filter((s) => !s.parentSpec && s.distance === 0);
      if (!central.length && bodySpecs.length) {
        const biggest = [...bodySpecs].sort((a, b) => b.radius - a.radius)[0];
        biggest.distance = 0;
        biggest.position = [0, 0, 0];
      }
    }

    // Enforce non-overlapping, monotonically spaced orbits around each center.
    const groups = new Map();
    for (const s of bodySpecs) {
      if (s.distance <= 0 || s.kind === 'asteroid_belt') continue;
      const key = s.parentSpec ? s.parentSpec.name : '__root__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    for (const [key, list] of groups) {
      const center = key === '__root__' ? primary : list[0].parentSpec;
      const centerR = center ? center.radius * (center.rings ? center.rings.outer : 1) : 0;
      list.sort((a, b) => a.distance - b.distance);
      let prev = centerR * 1.25;
      for (const s of list) {
        const minD = prev + s.radius * 2.2 + (center ? center.radius * 0.15 : 0.5);
        s.distance = Math.max(s.distance, minD);
        prev = s.distance + s.radius * (s.rings ? s.rings.outer : 1.4);
      }
    }

    // Asteroid belts: default band between neighbours if not specified.
    for (const s of bodySpecs.filter((b) => b.kind === 'asteroid_belt')) {
      if (!s.inner || !s.outer) {
        const mid = s.distance || s.radius || 30;
        s.inner = mid * 0.88;
        s.outer = mid * 1.12;
      }
      s.radius = s.outer;
      s.distance = 0;
    }

    // Instantiate
    const rand = rng(bodySpecs.length * 7919 + 17);
    for (const spec of bodySpecs) {
      const Factory = FACTORIES[spec.kind] || Planet;
      let body;
      try {
        body = new Factory(spec, quality);
      } catch (err) {
        console.error(`[WORLD] Failed to build ${spec.name}:`, err);
        continue;
      }
      if (spec.rings && !(body instanceof GasGiant)) {
        const rings = new Rings({ ...spec.rings, planetRadius: spec.radius, seed: spec.seed }, quality);
        body.tilt.add(rings.mesh);
        body.track(rings.material);
        body.rings = rings;
      }
      body.orbit = {
        distance: spec.distance,
        speed: spec.orbitalSpeed > 0 ? Math.min(spec.orbitalSpeed, 0.3) : (spec.distance > 0 ? 0.9 / Math.pow(spec.distance, 1.5) * (spec.parentSpec ? 2.0 : 6.0) : 0),
        phase: rand() * Math.PI * 2,
        inclination: (rand() - 0.5) * 0.06,
        parent: null,
        parentSpec: spec.parentSpec || null,
        fixed: new THREE.Vector3(...spec.position),
      };
      this.group.add(body.root);
      for (const a of body.worldAttachments || []) this.group.add(a);
      if (body.isStar && !this.star) this.star = body;
      this.bodies.push(body);
    }
    for (const b of this.bodies) {
      if (b.orbit.parentSpec) b.orbit.parent = this.bodies.find((x) => x.spec === b.orbit.parentSpec) || null;
    }

    // Orbit guides
    for (const b of this.bodies) {
      if (b.orbit.distance <= 0) continue;
      const pts = [];
      for (let i = 0; i <= 256; i++) {
        const a = (i / 256) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * b.orbit.distance, 0, Math.sin(a) * b.orbit.distance));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x5b8cc4, transparent: true, opacity: b.orbit.parent ? 0.08 : 0.13, depthWrite: false })
      );
      line.rotation.x = b.orbit.inclination;
      line.userData.body = b;
      this.group.add(line);
      this.orbitLines.push(line);
    }

    if (config.sun && Array.isArray(config.sun)) this.sunPos.set(...config.sun);
    if (this.star) {
      this.sunColor.copy(this.star.color);
      this.fillLight.intensity = 0;
    } else {
      this.fillLight.position.copy(this.sunPos);
    }
    this.update(0, 0);
  }

  setOrbitsVisible(v) {
    this.showOrbits = v;
    for (const l of this.orbitLines) l.visible = v;
  }

  // Bounding sphere for camera framing.
  bounds() {
    let maxR = 1;
    for (const b of this.bodies) {
      const reach = (b.orbit.parent ? 0 : b.orbit.distance) + b.radius * (b.rings ? 2.3 : 1) + b.orbit.fixed.length();
      if (b.kind === 'spiral_galaxy') maxR = Math.max(maxR, b.radius * 0.85);
      else if (b.kind === 'nebula') maxR = Math.max(maxR, b.radius * 0.8);
      else if (b.kind === 'black_hole') maxR = Math.max(maxR, b.radius * 7);
      else maxR = Math.max(maxR, reach);
    }
    return { center: new THREE.Vector3(), radius: maxR };
  }

  update(t, dt) {
    // Positions: parents first (bodies are listed in AI order; resolve two passes for moons)
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.bodies) {
        const o = b.orbit;
        if (pass === 0 && o.parent) continue;
        if (pass === 1 && !o.parent) continue;
        if (o.distance > 0) {
          const a = o.phase + t * o.speed;
          _a.set(Math.cos(a) * o.distance, Math.sin(a) * o.distance * o.inclination, Math.sin(a) * o.distance);
          if (o.parent) _a.add(o.parent.root.position);
          b.root.position.copy(_a);
        } else {
          b.root.position.copy(o.fixed);
        }
      }
    }
    for (const l of this.orbitLines) {
      const p = l.userData.body.orbit.parent;
      if (p) l.position.copy(p.root.position);
    }
    if (this.star) this.star.root.getWorldPosition(this.sunPos);
    const ctx = { sunPos: this.sunPos, sunColor: this.sunColor, pixelRatio: this.engine.pixelRatio || 1, camera: this.engine.camera };
    for (const b of this.bodies) b.update(t, dt, ctx);
    this._updateFlare(dt);
  }

  _updateFlare(dt) {
    const pass = this.engine.cinematicPass.uniforms;
    if (!this.star) { pass.uSunVisible.value = 0; return; }
    const cam = this.engine.camera;
    _a.copy(this.sunPos).project(cam);
    let target = 0;
    if (_a.z < 1 && Math.abs(_a.x) < 1.3 && Math.abs(_a.y) < 1.3) {
      target = 1 - Math.max(0, Math.max(Math.abs(_a.x), Math.abs(_a.y)) - 0.8) / 0.5;
      // Occlusion against solid bodies
      const ro = cam.position;
      const rd = _b.copy(this.sunPos).sub(ro);
      const distSun = rd.length();
      rd.normalize();
      for (const b of this.bodies) {
        if (!b.occluder || b === this.star) continue;
        const c = b.root.position;
        const oc = ro.clone().sub(c);
        const bb = oc.dot(rd);
        const cc = oc.lengthSq() - b.radius * b.radius;
        const h = bb * bb - cc;
        if (h > 0) {
          const tHit = -bb - Math.sqrt(h);
          if (tHit > 0 && tHit < distSun) { target = 0; break; }
        }
      }
      // Fade with apparent sun size (no flare when the star fills the view)
      const apparent = this.star.radius / Math.max(distSun, 0.001);
      target *= THREE.MathUtils.clamp(1.4 - apparent * 6, 0, 1);
    }
    this._flareVis += (target - this._flareVis) * Math.min(1, dt * 8);
    pass.uSunVisible.value = this._flareVis;
    pass.uSunScreen.value.set(_a.x * 0.5 + 0.5, _a.y * 0.5 + 0.5);
    pass.uSunColor.value.copy(this.sunColor);
  }

  // Ray-sphere pick against body bounds (fast; avoids raycasting 100k+ particles).
  pick(raycaster) {
    let best = null;
    let bestT = Infinity;
    const ro = raycaster.ray.origin;
    const rd = raycaster.ray.direction;
    for (const b of this.bodies) {
      if (b.kind === 'asteroid_belt') continue;
      const c = b.root.getWorldPosition(_a);
      const r = b.kind === 'spiral_galaxy' ? b.radius * 0.35 : b.kind === 'black_hole' ? b.radius * 4 : b.kind === 'nebula' ? b.radius * 0.6 : Math.max(b.radius * 1.15, 0.25);
      const oc = _b.copy(ro).sub(c);
      const bb = oc.dot(rd);
      const cc = oc.lengthSq() - r * r;
      const h = bb * bb - cc;
      if (h < 0) continue;
      const t = -bb - Math.sqrt(h);
      if (t > 0 && t < bestT) { bestT = t; best = b; }
    }
    return best;
  }

  dispose() {
    for (const b of this.bodies) b.dispose();
    for (const l of this.orbitLines) { l.geometry.dispose(); l.material.dispose(); }
    this.engine.scene.remove(this.group);
    this.bodies = [];
  }
}
