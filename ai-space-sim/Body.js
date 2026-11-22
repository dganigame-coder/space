import * as THREE from 'three';
import { disposeObject } from '../core/utils.js';

const _v = new THREE.Vector3();

// Base class for every celestial object. Hierarchy: root (orbit position) > tilt (axial tilt) > spin (rotation).
export class Body {
  constructor(spec) {
    this.spec = spec;
    this.name = spec.name;
    this.kind = spec.kind;
    this.radius = spec.radius;
    this.root = new THREE.Group();
    this.root.name = spec.name;
    this.tilt = new THREE.Group();
    this.spin = new THREE.Group();
    this.root.add(this.tilt);
    this.tilt.add(this.spin);
    this.tilt.rotation.z = spec.tilt || 0;
    this.materials = [];
    this.pickables = [];
    this.occluder = true; // used for lens-flare occlusion
    this.spinSpeed = spec.spin ?? 0.05;
    this.root.userData.body = this;
  }

  track(material) {
    this.materials.push(material);
    return material;
  }

  pickable(mesh) {
    mesh.userData.body = this;
    this.pickables.push(mesh);
    return mesh;
  }

  worldPosition(target = new THREE.Vector3()) {
    return this.root.getWorldPosition(target);
  }

  update(t, dt, ctx) {
    this.spin.rotation.y += this.spinSpeed * dt;
    const center = this.root.getWorldPosition(_v);
    for (const m of this.materials) {
      const u = m.uniforms;
      if (!u) continue;
      if (u.uTime) u.uTime.value = t;
      if (u.uSunPos) u.uSunPos.value.copy(ctx.sunPos);
      if (u.uSunColor) u.uSunColor.value.copy(ctx.sunColor);
      if (u.uCenter) u.uCenter.value.copy(center);
    }
  }

  // Optional: receive an AI-synthesised albedo texture.
  setTexture() {}

  get info() {
    return { name: this.name, kind: this.kind, radius: this.radius };
  }

  dispose() {
    disposeObject(this.root);
    this.root.removeFromParent();
  }
}
