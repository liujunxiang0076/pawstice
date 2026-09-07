import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PetMotor, MicroBehavior } from '../../src/features/pet/motion.js';
import { PetComponent } from '../../src/features/pet/PetComponent.js';
import { createPetProfile } from '../../src/features/pet/profile.js';

test('motor accelerates, brakes to destination, and follows corners without cutting them', () => {
  for (const fps of [30, 60, 120]) {
    const motor = new PetMotor(),
      root = new THREE.Group(),
      position = new THREE.Vector3();
    const path = [new THREE.Vector3(0, 0, 2), new THREE.Vector3(1, 0, 2)];
    let previousSpeed = 0,
      braked = false;
    for (let i = 0; i < fps * 14 && path.length; i++) {
      motor.step(position, root, path, 1 / fps, 'dog');
      assert.ok(motor.speed <= 0.881);
      assert.ok(motor.speed - previousSpeed <= 1.051 / fps);
      assert.ok(Math.abs(position.x) < 1e-6 || Math.abs(position.z - 2) < 1e-6);
      if (motor.speed < previousSpeed) braked = true;
      previousSpeed = motor.speed;
    }
    assert.equal(path.length, 0);
    assert.ok(position.distanceTo(new THREE.Vector3(1, 0, 2)) < 0.001);
    assert.equal(motor.speed, 0);
    assert.ok(braked);
  }
});

test('stance feet retain world contact through walking and stopping for both species and sizes', () => {
  for (const species of ['cat', 'dog'])
    for (const size of [0.8, 1]) {
      const pet = new PetComponent({ ...createPetProfile(species), size });
      const motor = new PetMotor();
      const position = new THREE.Vector3();
      const path = [new THREE.Vector3(0, 0, 1.5), new THREE.Vector3(0.7, 0, 1.5)];
      let contacts = 0;
      for (let frame = 0; frame < 600; frame++) {
        motor.step(position, pet.object3D, path, 1 / 60, species);
        pet.object3D.position.copy(position);
        pet.update(path.length ? 'walk' : 'idle', frame / 60, 1 / 60, { ...motor });
        pet.object3D.updateMatrixWorld(true);
        for (const [i, foot] of pet.footPlanting.feet.entries()) {
          const actual = pet.rig.limbs[i].ankle.getWorldPosition(new THREE.Vector3());
          assert.ok(Number.isFinite(actual.y));
          assert.ok(actual.y >= 0.032 * size, `paw below floor: ${species} ${actual.y}`);
          if (!foot.swing) {
            contacts++;
            assert.ok(
              actual.distanceTo(foot.anchor) < 0.003 * size,
              `sliding stance: ${species} ${size} ${actual.distanceTo(foot.anchor)}`,
            );
          }
        }
      }
      assert.ok(contacts > 500);
      pet.dispose();
    }
});

test('body inertia pitches back under acceleration and forward when braking; head compensates', () => {
  const pet = new PetComponent(createPetProfile('dog'));
  pet.update('walk', 0, 1, { speed: 0.6, acceleration: 1, turnRate: 0 });
  assert.ok(pet.rig.group.rotation.x < 0);
  pet.update('walk', 0, 1, { speed: 0.6, acceleration: -1.6, turnRate: 1 });
  assert.ok(pet.rig.group.rotation.x > 0);
  assert.ok(pet.rig.group.rotation.z < 0);
  assert.ok(pet.rig.head.rotation.z > 0);
  pet.dispose();
});

test('micro actions have variable intervals and variants, and sleep suppresses gaze and ear activity', () => {
  let seed = 17;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const micro = new MicroBehavior(random),
    blinks = new Set(),
    ears = new Set(),
    intervals = new Set();
  let lastStart = -1;
  for (let i = 0; i < 12000; i++) {
    micro.step(0.05, 'idle', [{ position: new THREE.Vector3(1, 1, 2) }]);
    if (micro.events.blink) {
      blinks.add(micro.events.blink.kind);
      if (micro.events.blink.start !== lastStart) {
        if (lastStart >= 0) intervals.add(Math.round((micro.events.blink.start - lastStart) * 10));
        lastStart = micro.events.blink.start;
      }
    }
    if (micro.events.ear) ears.add(micro.events.ear.kind);
  }
  assert.equal(blinks.size, 3);
  assert.equal(ears.size, 5);
  assert.ok(intervals.size > 15);
  const sleep = micro.step(0.05, 'sleep');
  assert.equal(sleep.look, null);
  assert.deepEqual(sleep.ears, [0, 0]);
  assert.ok(sleep.blink > 0.9);
});
