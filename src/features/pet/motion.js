import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Follow the validated polyline exactly; never round a corner through furniture. */
export class PetMotor {
  speed = 0;
  acceleration = 0;
  turnRate = 0;
  headingError = 0;
  reset() {
    this.speed = this.acceleration = this.turnRate = this.headingError = 0;
  }
  step(position, root, path, dt, species = 'cat') {
    dt = clamp(dt, 0, 0.05);
    if (!dt) return;
    const oldSpeed = this.speed;
    let remaining = 0,
      previous = position;
    for (const point of path) {
      remaining += point.distanceTo(previous);
      previous = point;
    }
    while (path[0] && position.distanceTo(path[0]) < 0.001) position.copy(path.shift());
    const next = path[0];
    const heading = next ? Math.atan2(next.x - position.x, next.z - position.z) : root.rotation.y;
    this.headingError = angleDelta(heading, root.rotation.y);
    const turn = clamp(this.headingError * 7, -2.8, 2.8) * dt;
    root.rotation.y += turn;
    this.turnRate = turn / dt;
    const maxSpeed = species === 'cat' ? 0.72 : 0.88;
    const desired = next
      ? Math.min(maxSpeed, Math.sqrt(2 * 1.6 * remaining)) *
        Math.max(0.08, Math.cos(this.headingError))
      : 0;
    this.speed += clamp(desired - this.speed, -1.6 * dt, 1.05 * dt);
    let travel = Math.min(remaining, (oldSpeed + this.speed) * 0.5 * dt);
    while (travel > 0 && path.length) {
      const distance = position.distanceTo(path[0]);
      if (distance <= travel) {
        position.copy(path.shift());
        travel -= distance;
      } else {
        position.lerp(path[0], travel / distance);
        travel = 0;
      }
    }
    if (!path.length) this.speed = 0;
    this.acceleration = clamp((this.speed - oldSpeed) / dt, -3, 2);
  }
}

/** Random event schedules rather than synchronized periodic idle loops. */
export class MicroBehavior {
  constructor(random = Math.random) {
    this.random = random;
    this.clock = 0;
    this.blinkAt = this.range(1, 4);
    this.earAt = this.range(0.6, 2);
    this.lookAt = this.range(1, 3);
    this.weightAt = this.range(2, 5);
    this.events = { blink: null, ear: null, look: null };
    this.weight = 0;
    this.targetWeight = 0;
    this.breathPhase = 0;
    this.breathRate = 0.33;
  }
  range(a, b) {
    return a + this.random() * (b - a);
  }
  step(dt, mode, targets = []) {
    this.clock += Math.min(Math.max(dt, 0), 0.05);
    const t = this.clock;
    const sleeping = mode === 'sleep';
    if (t >= this.blinkAt) {
      const r = this.random();
      this.events.blink = { start: t, kind: r < 0.68 ? 'single' : r < 0.9 ? 'double' : 'squint' };
      this.blinkAt = t + this.range(2.2, 8.5);
    }
    if (t >= this.earAt) {
      const r = this.random();
      this.events.ear = {
        start: t,
        kind:
          r < 0.7 ? 'rest' : r < 0.8 ? 'left' : r < 0.9 ? 'right' : r < 0.95 ? 'forward' : 'twitch',
      };
      this.earAt = t + this.range(0.8, 3.8);
    }
    if (t >= this.lookAt) {
      const available = targets.filter((target) => target.position);
      this.events.look =
        available.length && this.random() < 0.8
          ? {
              target: available[Math.floor(this.random() * available.length)],
              until: t + this.range(0.8, 2.8),
            }
          : null;
      this.lookAt = t + this.range(3.5, 7);
    }
    if (t >= this.weightAt) {
      this.targetWeight = this.range(-1, 1);
      this.breathRate = this.range(0.27, 0.38);
      this.weightAt = t + this.range(3, 7);
    }
    this.weight = THREE.MathUtils.damp(this.weight, this.targetWeight, 1.5, dt);
    this.breathPhase += dt * (sleeping ? 0.23 : this.breathRate) * Math.PI * 2;
    let blink = 0;
    const event = this.events.blink;
    if (event) {
      const age = t - event.start;
      const pulse = (x) =>
        x < 0 || x > 0.2 ? 0 : x < 0.06 ? x / 0.06 : x < 0.1 ? 1 : (0.2 - x) / 0.1;
      blink =
        event.kind === 'squint'
          ? age < 1.1
            ? Math.sin((age / 1.1) * Math.PI) * 0.65
            : 0
          : Math.max(pulse(age), event.kind === 'double' ? pulse(age - 0.3) : 0);
    }
    const ear = this.events.ear;
    const age = ear ? t - ear.start : 99;
    const envelope = age < 0.9 ? Math.sin((age / 0.9) * Math.PI) : 0;
    const earPose = [0, 0];
    if (!sleeping && ear) {
      if (ear.kind === 'left') earPose[0] = envelope * 0.45;
      if (ear.kind === 'right') earPose[1] = -envelope * 0.45;
      if (ear.kind === 'forward') {
        earPose[0] = -envelope * 0.2;
        earPose[1] = envelope * 0.2;
      }
      if (ear.kind === 'twitch') {
        earPose[0] = Math.sin(age * 45) * envelope * 0.15;
        earPose[1] = -earPose[0];
      }
    }
    return {
      blink: sleeping ? 0.96 : blink,
      ears: earPose,
      breath: Math.sin(this.breathPhase),
      weight: sleeping ? 0 : this.weight,
      look: !sleeping && this.events.look?.until > t ? this.events.look.target.position : null,
      sniff: !sleeping && this.events.look?.until > t ? Math.sin(t * 19) * 0.002 : 0,
    };
  }
}
