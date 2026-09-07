import * as THREE from 'three';
import { normalizePetProfile } from './profile.js';
import { createPetRig } from './createPetRig.js';
import { MicroBehavior } from './motion.js';
import { FootPlanting } from './FootPlanting.js';

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
    this.micro = new MicroBehavior();
    this.footPlanting = new FootPlanting();
    this.dynamics = { acceleration: 0, turnRate: 0, phase: 0 };
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
    this.footPlanting.reset();
    next.group.scale.setScalar(normalized.size);
    this.object3D.add(next.group);
    this.update('idle', 0, 1);
  }
  update(animation, time, dt, motion = null) {
    if (this.disposed) return;
    const mode = PET_ANIMATIONS.includes(animation) ? animation : 'idle';
    const { group, body, head, limbs, tail, ears, eyeLids, restHead } = this.rig;
    const cat = this._profile.species === 'cat',
      mix = 1 - Math.exp(-Math.max(0, dt) * 14);
    const blend = (current, target) => THREE.MathUtils.lerp(current, target, dt >= 0.5 ? 1 : mix);
    const micro = this.micro.step(dt, mode, motion?.lookTargets);
    const speed = motion?.speed ?? (mode === 'walk' ? 0.72 : 0);
    const moving = Math.min(1, speed / 0.8);
    this.dynamics.acceleration = THREE.MathUtils.damp(
      this.dynamics.acceleration,
      motion?.acceleration ?? 0,
      7,
      dt,
    );
    this.dynamics.turnRate = THREE.MathUtils.damp(
      this.dynamics.turnRate,
      motion?.turnRate ?? 0,
      8,
      dt,
    );
    this.dynamics.phase +=
      ((Math.min(dt, 0.05) * speed) /
        ((THREE.MathUtils.clamp(0.18 + speed * 0.16, 0.18, 0.32) * this._profile.size) / 0.64)) *
      Math.PI *
      2;
    const phase = this.dynamics.phase;
    let hx = 0,
      hy = 0,
      hz = 0,
      headY = 0,
      bodyY = 0,
      tilt = 0;
    let gait = 0;
    if (mode === 'walk') {
      gait = moving;
      bodyY = Math.cos(phase * 2) * 0.009 * moving;
      hx = 0.06;
      hy = THREE.MathUtils.clamp(motion?.headingError ?? 0, -0.4, 0.4) * 0.45;
    } else if (mode === 'idle') {
      hy = micro.weight * 0.08;
      hx = micro.breath * 0.012;
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
    const inertia = THREE.MathUtils.clamp(-this.dynamics.acceleration * 0.055, -0.085, 0.11);
    tilt += inertia + Math.sin(phase) * moving * 0.012;
    const lean = THREE.MathUtils.clamp(-this.dynamics.turnRate * speed * 0.085, -0.13, 0.13);
    group.position.y = blend(
      group.position.y,
      (bodyY + 0.55 * (1 - Math.cos(tilt))) * this._profile.size,
    );
    group.position.z = blend(group.position.z, Math.sin(tilt) * 0.55 * this._profile.size);
    group.position.x = blend(
      group.position.x,
      (Math.sin(lean) * 0.55 + (mode === 'idle' ? micro.weight * 0.007 : 0)) * this._profile.size,
    );
    group.rotation.x = blend(group.rotation.x, tilt);
    group.rotation.z = blend(group.rotation.z, lean);
    // Stabilize the gaze against trunk pitch and roll, while allowing a little inertia.
    hx -= tilt * 0.7;
    hz -= lean * 0.8;
    if (micro.look && (mode === 'idle' || mode === 'walk')) {
      this.object3D.updateMatrixWorld(true);
      const target = this.object3D.worldToLocal(micro.look.clone());
      target.sub(restHead.clone().multiplyScalar(this._profile.size));
      hy += THREE.MathUtils.clamp(Math.atan2(target.x, target.z), -0.55, 0.55);
      hx += THREE.MathUtils.clamp(
        -Math.atan2(target.y, Math.hypot(target.x, target.z)),
        -0.22,
        0.26,
      );
    }
    head.rotation.x = blend(head.rotation.x, hx);
    head.rotation.y = blend(head.rotation.y, hy);
    head.rotation.z = blend(head.rotation.z, hz);
    head.position.y = blend(head.position.y, restHead.y + headY - bodyY * 0.6 + micro.sniff);
    body.scale.y = blend(body.scale.y, 1 + micro.breath * 0.004);
    const front = Math.sin(phase) * moving;
    const rear = Math.sin(phase + 0.8) * moving * 0.75;
    this.rig.deformTorso(front, rear, Math.sin(phase) * moving * 0.6);
    limbs.forEach((limb, i) => {
      const side = i < 2 ? -1 : 1;
      const sway = Math.sin(phase + (side < 0 ? 0 : Math.PI));
      limb.hip.position.copy(limb.restHip);
      limb.hip.position.y += (limb.hind ? rear : front) * 0.012;
      limb.hip.position.z += sway * moving * (limb.hind ? 0.012 : 0.025);
      limb.hip.position.x += limb.hind ? sway * moving * 0.009 : 0;
      if (limb.scapula) {
        limb.scapula.position.y = 0.61 + sway * moving * 0.025;
        limb.scapula.position.z = limb.restHip.z - 0.015 + sway * moving * 0.025;
        limb.scapula.rotation.x = sway * moving * 0.13;
      }
    });
    // Four-beat walk: each planted foot moves backwards as the body advances.
    const phases = [0.25, 0, 0.75, 0.5];
    limbs.forEach((limb, i) => {
      const phase = (this.dynamics.phase / (Math.PI * 2) + phases[i]) % 1;
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
      limb.hip.rotation.z = blend(limb.hip.rotation.z, 0);
      limb.knee.rotation.x = blend(limb.knee.rotation.x, angles.knee);
      limb.ankle.rotation.x = blend(limb.ankle.rotation.x, angles.ankle);
      limb.ankle.rotation.z = blend(limb.ankle.rotation.z, 0);
      limb.ankle.rotation.y = blend(limb.ankle.rotation.y, 0);
    });
    if (motion && !motion.preview && (mode === 'walk' || mode === 'idle'))
      this.footPlanting.update(this, Math.min(dt, 0.05), speed, solveLeg, motion.groundHeight);
    else this.footPlanting.reset();
    const emotion =
      mode === 'sleep'
        ? 'sleep'
        : (motion?.emotion ??
          (mode === 'pet' || mode === 'play' ? 'happy' : micro.look ? 'alert' : 'relaxed'));
    const tailSpeed = emotion === 'happy' ? (cat ? 2.5 : 7) : emotion === 'relaxed' ? 0.9 : 1.5;
    const amplitude =
      emotion === 'sleep'
        ? 0.003
        : emotion === 'afraid'
          ? 0.015
          : emotion === 'happy'
            ? cat
              ? 0.1
              : 0.32
            : 0.055;
    tail.rotation.z = blend(
      tail.rotation.z,
      Math.sin(this.micro.clock * tailSpeed + micro.weight) * amplitude - lean * 0.4,
    );
    tail.rotation.x = blend(
      tail.rotation.x,
      mode === 'sleep'
        ? cat
          ? -1.25
          : -0.5
        : emotion === 'afraid'
          ? -0.85
          : (emotion === 'alert' ? 0.2 : -0.08) + inertia * 1.2,
    );
    ears.forEach((ear, i) => {
      ear.rotation.z = blend(ear.rotation.z, (i === 0 ? 1 : -1) * 0.13 + micro.ears[i]);
    });
    // Brief asynchronous-looking blinks; all parts of each eye close together.
    const openness = mode === 'sleep' ? 0.045 : Math.max(0.07, 1 - micro.blink * 0.94);
    eyeLids.forEach(
      (eye) =>
        (eye.scale.y = dt >= 0.5 ? openness : THREE.MathUtils.damp(eye.scale.y, openness, 45, dt)),
    );
    this.rig.eyes.forEach((eye) => {
      eye.rotation.y = blend(eye.rotation.y, Math.sign(eye.position.x) * 0.27 + hy * 0.12);
    });
    this.rig.nose.scale.y = (cat ? 0.022 : 0.032) * (1 + micro.sniff * 2);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.rig.dispose();
    this.object3D.removeFromParent();
    this.object3D.clear();
  }
}
