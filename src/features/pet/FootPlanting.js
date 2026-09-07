import * as THREE from 'three';

const smooth = (t) => t * t * (3 - 2 * t);

/** World-space stance anchors; only swing feet advance. The room retains root ownership. */
export class FootPlanting {
  constructor() {
    this.phase = 0;
    this.feet = [];
    this.local = new THREE.Vector3();
    this.inverse = new THREE.Matrix4();
    this.lastRoot = new THREE.Vector3();
    this.initialized = false;
  }
  reset() {
    this.feet = [];
    this.initialized = false;
  }
  update(pet, dt, speed, solveLeg, groundHeight) {
    const { object3D: root, rig, _profile: profile } = pet;
    root.updateMatrixWorld(true);
    this.inverse.copy(rig.group.matrixWorld).invert();
    const ground = groundHeight || (() => root.position.y);
    const active = speed > 0.025;
    // Front paws reach farther; hind paws take shorter propulsive steps.
    const stride = THREE.MathUtils.clamp(0.18 + speed * 0.16, 0.18, 0.32) * profile.size;
    const cadence = speed / (stride / 0.64);
    this.phase += cadence * dt;
    if (this.initialized && root.position.distanceTo(this.lastRoot) > 0.5) this.reset();
    this.lastRoot.copy(root.position);
    const offsets = [0, 0.25, 0.5, 0.75];
    rig.limbs.forEach((limb, i) => {
      const rest = limb.restHip;
      const phase = (this.phase + offsets[i]) % 1;
      const reach = (stride * (limb.hind ? 0.42 : 0.52)) / profile.size;
      const neutral = new THREE.Vector3(rest.x, 0.042, rest.z);
      const desired = neutral.clone();
      desired.z += active ? reach : 0;
      desired.multiplyScalar(profile.size);
      root.localToWorld(desired);
      desired.y = ground(desired.x, desired.z) + 0.042 * profile.size;
      let foot = this.feet[i];
      if (!foot) {
        neutral.multiplyScalar(profile.size);
        root.localToWorld(neutral);
        neutral.y = ground(neutral.x, neutral.z) + 0.042 * profile.size;
        foot = this.feet[i] = {
          anchor: neutral.clone(),
          from: neutral.clone(),
          target: neutral.clone(),
          position: neutral.clone(),
          swing: false,
          progress: 0,
          lastPhase: phase,
        };
      }
      const localAnchor = root.worldToLocal(foot.anchor.clone()).divideScalar(profile.size);
      const overstretched =
        Math.abs(localAnchor.z - rest.z) > 0.17 || Math.abs(localAnchor.x - rest.x) > 0.11;
      const phaseLift = phase >= 0.64 && (foot.lastPhase < 0.64 || phase < foot.lastPhase);
      const otherSwings = this.feet.filter((f) => f.swing).length;
      if (!foot.swing && ((active && phaseLift) || (overstretched && otherSwings < 2))) {
        foot.swing = true;
        foot.progress = 0;
        foot.from.copy(foot.anchor);
        foot.target.copy(desired);
        foot.duration = THREE.MathUtils.clamp(0.36 / Math.max(cadence, 0.9), 0.15, 0.36);
      }
      if (foot.swing) {
        foot.progress = Math.min(1, foot.progress + dt / foot.duration);
        foot.target.lerp(desired, 1 - Math.exp(-dt * 12));
        const t = smooth(foot.progress);
        foot.position.lerpVectors(foot.from, foot.target, t);
        foot.position.y +=
          Math.sin(Math.PI * foot.progress) ** 2 * (limb.hind ? 0.065 : 0.08) * profile.size;
        if (foot.progress >= 1) {
          foot.swing = false;
          foot.anchor.copy(foot.target);
        }
      } else foot.position.copy(foot.anchor);
      foot.lastPhase = phase;
      // Account for body lean, torso height and scapula displacement before solving IK.
      this.local.copy(foot.position).applyMatrix4(this.inverse).sub(limb.hip.position);
      // Scapular suspension / hip compression keeps a supporting leg inside its reach.
      const reachLimit = limb.upperLength + limb.lowerLength - 0.004;
      const horizontal = this.local.x ** 2 + this.local.z ** 2;
      const supportedY = -Math.sqrt(Math.max(0.01, reachLimit ** 2 - horizontal));
      if (this.local.y < supportedY) {
        const compression = Math.min(0.1, supportedY - this.local.y);
        limb.hip.position.y -= compression;
        this.local.y += compression;
      }
      const roll = Math.atan2(this.local.x, -this.local.y);
      const angles = solveLeg(limb, -Math.hypot(this.local.x, this.local.y), this.local.z);
      limb.hip.rotation.set(angles.hip, 0, roll, 'ZXY');
      limb.knee.rotation.x = angles.knee;
      limb.ankle.rotation.x = angles.ankle;
      limb.ankle.rotation.y = 0;
      limb.ankle.rotation.z = -roll;
      // Contact pose cancels the entire parent orientation: paw pads stay on the floor.
      if (!foot.swing) {
        const parentRotation = limb.knee.getWorldQuaternion(new THREE.Quaternion());
        limb.ankle.quaternion
          .copy(parentRotation.invert())
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), root.rotation.y),
          );
      }
      limb.paw.scale.y = 0.042 * (foot.swing ? 1 : 0.96);
    });
    this.initialized = true;
  }
}
