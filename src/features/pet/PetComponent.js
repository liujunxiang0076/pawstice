import * as THREE from 'three';
import { normalizePetProfile } from './profile.js';
import { createPetRig } from './createPetRig.js';

export const PET_ANIMATIONS = Object.freeze([
  'idle',
  'walk',
  'feed',
  'play',
  'sleep',
  'pet',
  'wash',
]);

/** Solve sagittal two-link leg; positive y is up and forward is +z. */
export function solveLeg(limb, footY, footZ) {
  const { upperLength: a, lowerLength: b, hind } = limb;
  const distance = Math.min(
    a + b - 0.0001,
    Math.max(Math.abs(a - b) + 0.0001, Math.hypot(footY, footZ)),
  );
  const bend =
    (hind ? 1 : -1) *
    Math.acos(THREE.MathUtils.clamp((distance * distance - a * a - b * b) / (2 * a * b), -1, 1));
  const hip = Math.atan2(-footZ, -footY) - Math.atan2(b * Math.sin(bend), a + b * Math.cos(bend));
  return { hip, knee: bend, ankle: -hip - bend };
}

/** Scene-independent component: room owns world transform; rig owns pose. */
export class PetComponent {
  constructor(profile) {
    this.object3D = new THREE.Group();
    this.object3D.name = 'pet';
    this.disposed = false;
    this.setProfile(profile);
  }
  get profile() {
    return { ...this._profile };
  }
  get navigationRadius() {
    return 0.42 * this._profile.size;
  }
  get height() {
    return 1.3 * this._profile.size;
  }
  get pickables() {
    const meshes = [];
    this.rig?.group.traverse((m) => {
      if (m.isMesh) meshes.push(m);
    });
    return meshes;
  }
  setProfile(profile) {
    if (this.disposed) throw new Error('PetComponent has been disposed');
    const normalized = normalizePetProfile(profile),
      next = createPetRig(normalized);
    this.rig?.dispose();
    this.rig = next;
    this._profile = normalized;
    next.group.scale.setScalar(normalized.size);
    this.object3D.add(next.group);
    this.update('idle', 0, 1);
  }
  update(animation, time, dt) {
    if (this.disposed) return;
    const mode = PET_ANIMATIONS.includes(animation) ? animation : 'idle';
    const { group, body, head, limbs, tail, ears, eyeLids, restHead } = this.rig;
    const cat = this._profile.species === 'cat',
      mix = 1 - Math.exp(-Math.max(0, dt) * 14);
    const blend = (current, target) => THREE.MathUtils.lerp(current, target, dt >= 0.5 ? 1 : mix);
    let hx = 0,
      hy = 0,
      hz = 0,
      headY = 0,
      bodyY = 0,
      tilt = 0;
    let gait = 0;
    if (mode === 'walk') {
      gait = 1;
      bodyY = Math.sin(time * 18) * 0.004;
      hx = 0.06;
      hy = Math.sin(time * 4.5) * 0.015;
    } else if (mode === 'idle') {
      hy = Math.sin(time * 0.48) * 0.1;
      hx = Math.sin(time * 0.8) * 0.018;
    } else if (mode === 'feed') {
      hx = 0.92 + Math.sin(time * 6) * 0.035;
      headY = cat ? -0.29 : -0.24;
      bodyY = -0.1;
    } else if (mode === 'sleep') {
      hx = 0.32;
      hy = cat ? 0.2 : 0.08;
      headY = -0.07;
      bodyY = -0.27;
    } else if (mode === 'play') {
      gait = 0.55;
      hx = 0.2;
      bodyY = Math.abs(Math.sin(time * 4)) * 0.045;
      hz = Math.sin(time * 2) * 0.04;
    } else if (mode === 'pet') {
      hx = -0.13;
      hy = Math.sin(time * 2) * 0.13;
      hz = Math.sin(time * 2) * 0.06;
    } else if (mode === 'wash') {
      hy = Math.sin(time * 16) * 0.12;
      tilt = Math.sin(time * 16) * 0.008;
    }
    group.position.y = blend(group.position.y, bodyY * this._profile.size);
    group.rotation.x = blend(group.rotation.x, tilt);
    head.rotation.x = blend(head.rotation.x, hx);
    head.rotation.y = blend(head.rotation.y, hy);
    head.rotation.z = blend(head.rotation.z, hz);
    head.position.y = blend(head.position.y, restHead.y + headY);
    body.scale.y = blend(body.scale.y, 1 + Math.sin(time * (mode === 'sleep' ? 1.6 : 2.4)) * 0.004);
    // Four-beat walk: each planted foot moves backwards as the body advances.
    const phases = [0.25, 0, 0.75, 0.5];
    limbs.forEach((limb, i) => {
      const phase = (time * (cat ? 1.43 : 1.5) + phases[i]) % 1;
      const stance = 0.62;
      let z = 0,
        lift = 0;
      if (gait) {
        if (phase < stance) z = 0.18 - (phase / stance) * 0.36;
        else {
          const swing = (phase - stance) / (1 - stance);
          z = -0.18 + 0.36 * swing;
          lift = Math.sin(swing * Math.PI) * 0.075;
        }
        z *= gait;
        lift *= gait;
      }
      const sleeping = mode === 'sleep';
      const footY = sleeping ? -0.175 : -0.448 + lift - bodyY;
      const footZ = sleeping ? (limb.hind ? 0.12 : 0.1) : z;
      const angles = solveLeg(limb, footY, footZ);
      limb.hip.rotation.x = blend(limb.hip.rotation.x, angles.hip);
      limb.knee.rotation.x = blend(limb.knee.rotation.x, angles.knee);
      limb.ankle.rotation.x = blend(limb.ankle.rotation.x, angles.ankle);
    });
    const tailSpeed = cat ? 1.4 : mode === 'pet' || mode === 'play' ? 6 : 2.8;
    tail.rotation.z = blend(tail.rotation.z, Math.sin(time * tailSpeed) * (cat ? 0.07 : 0.15));
    tail.rotation.x = blend(
      tail.rotation.x,
      mode === 'sleep' ? (cat ? -1.25 : -0.5) : Math.sin(time * 0.7) * 0.025,
    );
    ears.forEach((ear, i) => {
      ear.rotation.z = blend(
        ear.rotation.z,
        (i === 0 ? 1 : -1) * 0.13 + Math.sin(time * 0.9 + i) * 0.025,
      );
    });
    // Brief asynchronous-looking blinks; all parts of each eye close together.
    const cycle = time % 5.7,
      blink = cycle < 0.18 ? Math.sin((cycle / 0.18) * Math.PI) : 0;
    const openness = mode === 'sleep' ? 0.045 : Math.max(0.07, 1 - blink * 0.94);
    eyeLids.forEach((eye) => (eye.scale.y = blend(eye.scale.y, openness)));
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.rig.dispose();
    this.object3D.removeFromParent();
    this.object3D.clear();
  }
}
