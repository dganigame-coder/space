// Pilot mode: Newtonian-ish flight with scaled gravity, stellar heating, deep-space cold,
// tidal stress, radiation and gravitational time dilation.
import * as THREE from 'three';

const V3 = () => new THREE.Vector3();
const clamp = THREE.MathUtils.clamp;
const smooth = THREE.MathUtils.smoothstep;
const KM_AU = 1.495978707e8;

export function createFlight(ctx) {
  const { ship, camera, frame, user, $ } = ctx;
  const S = {
    on: false, pos: V3(), vel: V3(), q: new THREE.Quaternion(), ang: V3(),
    boost: false, assist: true, hull: 280, integrity: 100, dead: 0, warp: 0, uEq: 0,
    grav: 0, tidal: 0, rad: 0, dil: 1, nearest: null, alt: 0, thrust: 0, frost: 0, heatGlow: 0,
    keys: {}, joy: { x: 0, y: 0 }, tBtn: false, bBtn: false, msgT: 0, chapter: -1,
  };
  const camQ = new THREE.Quaternion();
  const tmp = V3(), tmp2 = V3(), acc = V3();
  const qTmp = new THREE.Quaternion();
  const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

  // ---------- per-chapter preparation ----------
  function prep(c, d) {
    if (d._fl) return d._fl;
    const L = d.path.getLength();
    const samples = []; for (let i = 0; i <= 240; i++) samples.push(d.path.getPointAt(i / 240));
    const vmax = Math.max(L / c.dur, 0.5);
    const bodies = [];
    const labelPos = (d.labels || []).map(l => ({ name: l.name, p: l.pos().clone() }));
    const nameNear = (p, R) => { let best = null, bd = 1e30; labelPos.forEach(l => { const dd = l.p.distanceTo(p); if (dd < bd && dd < R * 3 + 5) { bd = dd; best = l.name; } }); return best; };
    d.group.updateMatrixWorld(true);
    d.group.traverse(o => {
      const u = o.userData; if (!u || !u.R) return;
      const wp = o.getWorldPosition(V3());
      if (u.uniforms) bodies.push({ obj: o, kind: 'planet', R: u.R, Rg: u.R, gk: 0.55, tk: 0.8, rk: 0, T: u.eqt || 0, name: u.name || nameNear(wp, u.R) || 'Planet' });
      else if (u.color && u.temp) bodies.push({ obj: o, kind: 'star', R: u.R, Rg: u.R, gk: 1.15, tk: 1.0, rk: 0.25, T: u.temp, name: nameNear(wp, u.R) || 'Star' });
      else if (u.pulsar) bodies.push({ obj: o, kind: 'pulsar', R: 3, Rg: 26, gk: 1.6, tk: 2.0, rk: 5, T: 0, name: 'PSR B1257+12' });
    });
    // pulsar group also contains an inner makeStar: drop that duplicate
    if (bodies.some(b => b.kind === 'pulsar')) for (let i = bodies.length - 1; i >= 0; i--) if (bodies[i].kind === 'star' && bodies[i].R <= 3) bodies.splice(i, 1);
    if (d.blackHole) bodies.push({ obj: null, pos: new THREE.Vector3(), kind: 'bh', R: d.blackHole.R, Rg: d.blackHole.R, gk: 26, tk: 110, rk: 2.2, T: 0, name: d.blackHole.name });
    if (c.title === 'King of Planets') { const j = bodies.filter(b => b.kind === 'planet').sort((a, b) => b.R - a.R)[0]; if (j) { j.rk = 8; j.name = j.name || 'Jupiter'; } }
    const solar = c.index <= 7;
    d._fl = { L, samples, vmax, A: vmax * 0.75, bodies, solar };
    return d._fl;
  }
  const bodyPos = (b, out) => (b.obj ? b.obj.getWorldPosition(out) : out.copy(b.pos));

  function nearestU(F, p) {
    let bi = 0, bd = 1e30;
    for (let i = 0; i < F.samples.length; i++) { const dd = F.samples[i].distanceToSquared(p); if (dd < bd) { bd = dd; bi = i; } }
    return bi / (F.samples.length - 1);
  }

  function placeOnPath(c, d, u, speedFrac = 0.35) {
    const F = prep(c, d);
    d.path.getPointAt(u, S.pos);
    const t = d.path.getTangentAt(Math.min(u, 0.999)).normalize();
    const m = new THREE.Matrix4(); const x = V3().crossVectors(AX.y, t); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize();
    const y = V3().crossVectors(t, x).normalize();
    m.makeBasis(x, y, t); S.q.setFromRotationMatrix(m); camQ.copy(S.q);
    S.vel.copy(t).multiplyScalar(F.vmax * speedFrac); S.ang.set(0, 0, 0);
    S.uEq = u;
  }

  // ---------- UI ----------
  const el = {
    panel: $('#flight'), alert: $('#alert'), heat: $('#fx-heat'), frost: $('#fx-frost'),
    spd: $('#f-speed'), thr: $('#f-thr'), grav: $('#f-grav'), temp: $('#f-temp'), tempBar: $('#f-temp-bar'),
    tidal: $('#f-tidal'), rad: $('#f-rad'), dil: $('#f-dil'), integ: $('#f-int'), integBar: $('#f-int-bar'), near: $('#f-near'), assist: $('#f-assist'),
  };
  function alert(msg, level = 'warn', hold = 1.2) {
    if (S.msg === msg && S.msgT > 0) { S.msgT = Math.max(S.msgT, hold); return; }
    S.msg = msg; S.msgT = hold;
    el.alert.textContent = msg; el.alert.className = 'show ' + level;
  }

  // ---------- input ----------
  addEventListener('keydown', (e) => { if (!S.on || e.target.tagName === 'SELECT') return; S.keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') S.boost = true; });
  addEventListener('keyup', (e) => { S.keys[e.code] = false; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') S.boost = S.boostLatch; });
  addEventListener('blur', () => { S.keys = {}; });
  // joystick
  const joy = $('#joy'), knob = $('#joy-knob');
  let joyId = null, jc = { x: 0, y: 0 };
  joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 }; moveJoy(e); e.preventDefault(); });
  const moveJoy = (e) => { if (e.pointerId !== joyId) return; let dx = (e.clientX - jc.x) / jc.R, dy = (e.clientY - jc.y) / jc.R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } S.joy.x = dx; S.joy.y = dy; knob.style.transform = `translate(${dx * jc.R * 0.6}px, ${dy * jc.R * 0.6}px)`; };
  joy.addEventListener('pointermove', moveJoy);
  const endJoy = (e) => { if (e.pointerId !== joyId) return; joyId = null; S.joy.x = S.joy.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
  const hold = (id, key) => { const b = $(id); const on = (e) => { S[key] = true; b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); }; const off = () => { S[key] = false; b.classList.remove('down'); }; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off); };
  hold('#tb-thrust', 'tBtn'); hold('#tb-brake', 'bBtn');
  $('#tb-boost').addEventListener('click', () => { S.boostLatch = !S.boostLatch; S.boost = S.boostLatch; $('#tb-boost').classList.toggle('on', S.boostLatch); });
  el.assist.addEventListener('click', () => toggleAssist());
  function toggleAssist() { S.assist = !S.assist; el.assist.textContent = S.assist ? 'Assist on' : 'Assist off'; el.assist.classList.toggle('off', !S.assist); alert(S.assist ? 'Flight assist on: speed governor and drift damping' : 'Flight assist off: pure Newtonian flight', 'info', 2); }

  // ---------- enter / exit ----------
  function enter(c, d, u) {
    S.on = true; document.body.classList.add('flying');
    placeOnPath(c, d, clamp(u, 0.0, 0.98), 0.3);
    S.integrity = 100; S.dead = 0; S.chapter = c.index;
    const F = prep(c, d); S.hull = F.solar ? 280 : 40;
    user.yaw = user.pitch = 0; user.zoom = 1;
    alert('You have the controls', 'info', 2.2);
  }
  function exit() {
    S.on = false; document.body.classList.remove('flying');
    ship.scale.set(1, 1, 1);
    ship.userData.hullMat.emissive.setRGB(0, 0, 0);
    el.heat.style.opacity = 0; el.frost.style.opacity = 0; el.alert.className = '';
  }
  function warpTo(c, d, target) {
    const F = prep(c, d);
    S.warp = 1; S.chapter = c.index; S.integrity = Math.max(S.integrity, 100); S.dead = 0; S.hull = F.solar ? 280 : 40;
    if (!target) { placeOnPath(c, d, 0.02, 0.35); return; }
    // park near the chosen object, facing it
    const tp = target.pos().clone();
    let R = 30; let bb = null, bd = 1e30;
    F.bodies.forEach(b => { const p = bodyPos(b, V3()); const dd = p.distanceTo(tp); if (dd < bd && dd < b.R * 3 + 10) { bd = dd; bb = b; } });
    if (bb) R = bb.kind === 'bh' ? bb.R * 3 : bb.R; else R = Math.max(10, F.L * 0.01);
    const u = nearestU(F, tp); const pp = d.path.getPointAt(clamp(u - 0.05, 0, 1));
    const dir = pp.clone().sub(tp); if (dir.lengthSq() < 1e-6) dir.set(0.3, 0.2, 1); dir.normalize();
    dir.add(new THREE.Vector3(0, 0.25, 0)).normalize();
    S.pos.copy(tp).addScaledVector(dir, R * (bb && bb.kind === 'star' ? 4 : 5) + 6);
    const f = tp.clone().sub(S.pos).normalize();
    const x = V3().crossVectors(AX.y, f).normalize(); const y = V3().crossVectors(f, x).normalize();
    S.q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, f)); camQ.copy(S.q);
    S.vel.set(0, 0, 0); S.ang.set(0, 0, 0);
    S.uEq = nearestU(F, S.pos);
    alert(`Arrived: ${target.name}`, 'info', 2.4);
  }

  // ---------- physics step ----------
  function step(c, d, dt, dkmAt) {
    const F = prep(c, d);
    const K = S.keys;
    if (S.dead > 0) {
      S.dead -= dt; S.vel.multiplyScalar(0.9);
      if (S.dead <= 0) { placeOnPath(c, d, clamp(S.uEq - 0.08, 0.01, 0.9), 0.25); S.integrity = 100; S.hull = F.solar ? 280 : 40; alert('Systems restored. Respawned on the flight path', 'info', 2.5); }
      return;
    }
    // --- rotation input ---
    const yawIn = (K.KeyA || K.ArrowLeft ? 1 : 0) - (K.KeyD || K.ArrowRight ? 1 : 0) - S.joy.x;
    const pitchIn = (K.ArrowUp || K.KeyI ? 1 : 0) - (K.ArrowDown || K.KeyK ? 1 : 0) + S.joy.y;
    const rollIn = (K.KeyE ? 1 : 0) - (K.KeyQ ? 1 : 0);
    const target = tmp.set(clamp(pitchIn, -1, 1) * 1.1, clamp(yawIn, -1, 1) * 1.1, rollIn * 1.8);
    S.ang.lerp(target, 1 - Math.exp(-dt * 5));
    qTmp.setFromAxisAngle(AX.x, S.ang.x * dt); S.q.multiply(qTmp);
    qTmp.setFromAxisAngle(AX.y, S.ang.y * dt); S.q.multiply(qTmp);
    qTmp.setFromAxisAngle(AX.z, S.ang.z * dt); S.q.multiply(qTmp);
    S.q.normalize();
    const fwd = tmp2.set(0, 0, 1).applyQuaternion(S.q);

    // --- environment: gravity, heat, tides, radiation ---
    acc.set(0, 0, 0);
    let T4 = Math.pow(2.725, 4), tidal = 0, rad = 0, dil = 1, near = null, nearAlt = 1e30, govern = 1, crash = null;
    if (F.solar) { const au = c.index <= 1 ? 1 : Math.max(0.3, 1 + dkmAt / KM_AU); T4 += Math.pow(278 / Math.sqrt(au), 4); }
    const bp = V3();
    for (const b of F.bodies) {
      bodyPos(b, bp);
      const r = bp.sub(S.pos); const dist = Math.max(r.length(), 1e-3);
      const g = b.gk * F.A * (b.Rg * b.Rg) / (dist * dist);
      acc.addScaledVector(r, g / dist);
      if (b.T) T4 += Math.pow(b.T, 4) * (b.R / (2 * dist)) * (b.R / (2 * dist)) * 4 * (b.kind === 'planet' ? 0.5 : 1);
      tidal += b.tk * Math.pow(b.R / dist, 3);
      rad += b.rk * Math.pow(b.Rg / dist, 2);
      if (b.kind === 'bh') dil = Math.sqrt(Math.max(0, 1 - b.R / dist));
      const alt = dist - b.R;
      if (!near || alt / b.R < nearAlt / near.R) { near = b; nearAlt = alt; }
      govern = Math.min(govern, clamp(alt / (b.R * (b.kind === 'star' ? 10 : 22)), 0.035, 1));
      if (dist < b.R * (b.kind === 'star' ? 1.02 : 1.0) && (b.kind !== 'planet' || S.vel.dot(r) > 0)) crash = b;
    }
    const gmag = acc.length();
    const Teq = Math.pow(T4, 0.25);
    S.hull += (Teq - S.hull) * (1 - Math.exp(-dt * (S.hull > Teq ? 0.35 : 0.9)));
    S.frost = 1 - smooth(S.hull, 8, 60);
    S.heatGlow = smooth(S.hull, 700, 2600);
    // --- thrust ---
    const boost = S.boost;
    const vcap = F.vmax * (boost ? 3 : 1) * (S.assist ? (boost ? Math.max(govern, 0.25) : govern) : 1);
    const thr = (K.KeyW || S.tBtn) ? 1 : 0;
    const brk = (K.KeyS || K.Space || S.bBtn) ? 1 : 0;
    const eff = 1 - 0.2 * S.frost;
    const A = F.A * (boost ? 2.5 : 1) * eff;
    const vf = S.vel.dot(fwd);
    if (thr && vf < vcap) S.vel.addScaledVector(fwd, A * dt);
    if (brk) { const sp = S.vel.length(); if (sp > 1e-6) S.vel.multiplyScalar(Math.max(0, sp - A * 1.4 * dt) / sp); }
    if (S.assist) {
      // damp sideways drift and hold the governor speed
      const along = fwd.clone().multiplyScalar(S.vel.dot(fwd));
      const side = S.vel.clone().sub(along);
      side.multiplyScalar(Math.exp(-dt * 0.9));
      S.vel.copy(along).add(side);
      const sp = S.vel.length(); if (sp > vcap * 1.02 && gmag < A * 0.6) S.vel.multiplyScalar(Math.max(vcap, sp * Math.exp(-dt * 1.6)) / sp);
    }
    S.vel.addScaledVector(acc, dt);
    S.pos.addScaledVector(S.vel, dt);
    S.thrust = thr ? (boost ? 1.6 : 1) : brk ? 0.15 : 0.25;

    // --- damage ---
    let dmg = 0; let warn = null, lvl = 'warn';
    if (S.hull > 1500) { dmg += (S.hull - 1500) / 300 * 6; warn = `Hull ${Math.round(S.hull).toLocaleString()} K: heat shield overloaded`; lvl = 'danger'; }
    else if (S.hull > 900) warn = `Hull heating: ${Math.round(S.hull)} K`;
    if (tidal > 2.5) { dmg += (tidal - 2.5) * 10; warn = near && near.kind === 'bh' ? 'Spaghettification: tidal forces stretching the hull' : 'Tidal stress beyond structural limit'; lvl = 'danger'; }
    else if (tidal > 0.9 && !warn) warn = 'Tidal stress rising';
    if (rad > 1.2) { dmg += (rad - 1.2) * 6; if (!warn || lvl !== 'danger') { warn = near && near.kind === 'pulsar' ? 'Pulsar wind: lethal radiation dose' : near && near.kind === 'bh' ? 'Accretion-disk X-rays: shields failing' : 'Radiation belts: shields failing'; lvl = 'danger'; } }
    else if (rad > 0.5 && !warn) warn = 'Radiation rising';
    if (!warn && S.frost > 0.7) { warn = `Deep cold: hull ${S.hull.toFixed(1)} K · thrusters −${Math.round(20 * S.frost)}%`; lvl = 'cold'; }
    if (!warn && gmag > A * 0.9) warn = `Strong gravity: ${near ? near.name : ''} is pulling you in`;
    if (warn) alert(warn, lvl, 0.4);
    S.integrity = clamp(S.integrity - dmg * dt + (dmg === 0 ? 6 * dt : 0), 0, 100);
    if (crash) {
      const why = crash.kind === 'bh' ? `Crossed the event horizon of ${crash.name}. Nothing returns from here.` : crash.kind === 'star' ? `Vaporised in the photosphere of ${crash.name}` : `Impact on ${crash.name}`;
      die(why);
    } else if (S.integrity <= 0) die('Hull breach: the ship broke apart');

    S.grav = gmag / F.A; S.tidal = tidal; S.rad = rad; S.dil = dil; S.nearest = near; S.alt = nearAlt; S.gmag = gmag;
    S.uEq = nearestU(F, S.pos);
    S.speedFrac = S.vel.length() / F.vmax;
  }
  function die(why) { S.dead = 2.6; S.integrity = 0; alert(why, 'danger', 2.6); }

  // ---------- apply to ship / camera ----------
  function apply(dt) {
    ship.position.copy(S.pos);
    ship.quaternion.copy(S.q);
    frame.pos.copy(S.pos);
    frame.f.set(0, 0, 1).applyQuaternion(S.q); frame.x.set(1, 0, 0).applyQuaternion(S.q); frame.y.set(0, 1, 0).applyQuaternion(S.q);
    const st = clamp((S.tidal - 0.6) * 0.18, 0, 0.9);
    ship.scale.set(1 / Math.sqrt(1 + st), 1 / Math.sqrt(1 + st), 1 + st);
    ship.visible = S.dead <= 0 || Math.floor(S.dead * 8) % 2 === 0;
    const hm = ship.userData.hullMat; hm.emissive.setRGB(1.0 * S.heatGlow * 1.6, 0.28 * S.heatGlow * 1.6, 0.06 * S.heatGlow);
    ship.userData.finMat.emissiveIntensity = S.heatGlow * 4;
    ship.userData.setPlume(S.thrust, 0.4 + S.thrust * 0.7, false);
    // chase camera with lag
    camQ.slerp(S.q, 1 - Math.exp(-dt * 4));
    const portrait = camera.aspect < 1 ? 1.55 : 1;
    const off = new THREE.Vector3(0, 1.7, -6.2).multiplyScalar(user.zoom * portrait);
    off.applyAxisAngle(AX.y, user.yaw); off.applyAxisAngle(AX.x, -user.pitch);
    off.applyQuaternion(camQ);
    camera.position.copy(S.pos).add(off);
    if (S.shake) { const s = S.shake; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; }
    camera.up.set(0, 1, 0).applyQuaternion(camQ);
    const look = S.pos.clone().addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(camQ), 4 * user.zoom).addScaledVector(camera.up, 0.6);
    camera.lookAt(look);
    const fov = 56 + Math.min(S.speedFrac || 0, 3) * 4 + S.warp * 18;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * 0.1; camera.updateProjectionMatrix(); }
    S.warp = Math.max(0, S.warp - dt * 0.8);
    S.shake = Math.min(0.25, S.tidal * 0.03 + Math.max(0, S.rad - 0.5) * 0.04 + (S.heatGlow > 0.5 ? 0.03 : 0));
  }

  // ---------- HUD ----------
  const fmtT = (k) => (k < 10 ? k.toFixed(1) : Math.round(k).toLocaleString('en-US'));
  function hud(kms) {
    el.spd.textContent = kms;
    el.thr.style.width = `${clamp((S.speedFrac || 0) / 3, 0, 1) * 100}%`;
    el.grav.textContent = `${(S.grav * 20).toFixed(S.grav * 20 < 10 ? 2 : 1)} m/s²`;
    el.temp.textContent = `${fmtT(S.hull)} K`;
    const tf = clamp(Math.log10(Math.max(S.hull, 2)) / Math.log10(3000), 0, 1);
    el.tempBar.style.width = `${tf * 100}%`;
    el.tempBar.style.background = S.hull > 1500 ? '#ff5a3a' : S.hull > 700 ? '#ffb04a' : S.hull < 60 ? '#9ad8ff' : '#7fd0ff';
    el.tidal.textContent = S.tidal < 0.004 ? 'negligible' : `${Math.round(S.tidal / 2.5 * 100)}% of limit`;
    el.tidal.className = 'v mono ' + (S.tidal > 2.5 ? 'bad' : S.tidal > 0.9 ? 'warn' : '');
    el.rad.textContent = S.rad < 0.005 ? 'background' : `${Math.round(S.rad / 1.2 * 100)}% of limit`;
    el.rad.className = 'v mono ' + (S.rad > 1.2 ? 'bad' : S.rad > 0.5 ? 'warn' : '');
    el.dil.textContent = S.dil > 0.999999 ? '1.000000' : S.dil.toFixed(6);
    el.dil.className = 'v mono ' + (S.dil < 0.9 ? 'warn' : '');
    el.integ.textContent = `${Math.round(S.integrity)}%`;
    el.integBar.style.width = `${S.integrity}%`;
    el.integBar.style.background = S.integrity < 30 ? '#ff5a3a' : S.integrity < 65 ? '#ffb04a' : '#6fe0a8';
    el.near.textContent = S.nearest ? `${S.nearest.name}` : '—';
    el.heat.style.opacity = S.heatGlow * 0.9;
    el.frost.style.opacity = S.frost * 0.55;
    if (S.msgT > 0) { S.msgT -= 1 / 60; if (S.msgT <= 0) el.alert.className = ''; }
  }

  return {
    S, prep, enter, exit, step, apply, hud, warpTo, toggleAssist, nearestU, alert,
    get on() { return S.on; },
  };
}
