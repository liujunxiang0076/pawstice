import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createPetProfile,
  normalizePetProfile,
  parsePetProfile,
  serializePetProfile,
  petPortrait,
} from '../../src/features/pet/profile.js';
import { PetComponent, PET_ANIMATIONS, solveLeg } from '../../src/features/pet/PetComponent.js';

test('legacy save migrates without changing identity; values are allowlisted and clamped', () => {
  const p = normalizePetProfile(undefined, { pet: 'dog', name: '团子' });
  assert.equal(p.species, 'dog');
  assert.equal(p.name, '团子');
  const normalized = normalizePetProfile({ ...p, size: 99, fur: 'url(bad)', unknown: true });
  assert.equal(normalized.size, 1);
  assert.equal(normalized.fur, p.fur);
  assert.equal('unknown' in normalized, false);
  assert.equal(normalizePetProfile({ size: Number.NaN }).size, 1);
  assert.equal(
    normalizePetProfile({ species: { toString: null }, pattern: { toString: null } }).species,
    'cat',
  );
});

test('full custom profile round-trips; unsupported and malformed imports fail', () => {
  const p = {
    ...createPetProfile('dog'),
    name: '小墨',
    pattern: 'stripes',
    size: 0.8,
    collar: true,
    fur: '#384650',
    eyes: '#7b9d54',
  };
  assert.deepEqual(parsePetProfile(serializePetProfile(p)), p);
  for (const input of [
    'null',
    '[]',
    '{',
    JSON.stringify({ ...p, version: 2 }),
    JSON.stringify({ ...p, size: -1 }),
    JSON.stringify({ ...p, fur: 'red' }),
    JSON.stringify({ ...p, species: 'fox' }),
  ]) {
    assert.throws(() => parsePetProfile(input));
  }
  assert.throws(() => parsePetProfile(' '.repeat(32769)));
  const portrait = decodeURIComponent(petPortrait({ ...p, name: '<script>' }).split(',')[1]);
  assert.ok(portrait.includes('#384650'));
  assert.ok(!portrait.includes('<script>'));
});

test('reconfiguration preserves world transform, disposes old rig and refreshes pickables', () => {
  const pet = new PetComponent(createPetProfile());
  const root = pet.object3D;
  root.position.set(1, 0.37, 2);
  root.rotation.y = 0.8;
  const old = pet.pickables;
  let disposed = 0;
  const geometries = new Set();
  pet.rig.group.traverse((m) => {
    if (m.geometry) geometries.add(m.geometry);
  });
  geometries.forEach((g) => g.addEventListener('dispose', () => disposed++));
  pet.setProfile({ ...createPetProfile('dog'), size: 0.8, collar: true });
  assert.equal(root, pet.object3D);
  assert.deepEqual(root.position.toArray(), [1, 0.37, 2]);
  assert.equal(root.rotation.y, 0.8);
  assert.equal(disposed, geometries.size);
  assert.ok(pet.pickables.every((m) => !old.includes(m)));
  assert.equal(pet.navigationRadius, 0.42 * 0.8);
  assert.equal(root.children.length, 1);
  assert.equal(pet.rig.group.scale.x, 0.8);
  pet.dispose();
  pet.dispose();
  assert.equal(root.children.length, 0);
});

test('animation transitions never own room movement and reset sleep pose', () => {
  const pet = new PetComponent(createPetProfile());
  pet.object3D.position.set(2, 0.37, 3);
  for (const mode of PET_ANIMATIONS) for (let i = 0; i < 30; i++) pet.update(mode, i / 60, 1 / 60);
  pet.update('sleep', 3, 1);
  assert.ok(pet.rig.group.position.y < -0.2);
  assert.ok(pet.rig.eyeLids[0].scale.y < 0.1);
  pet.update('idle', 4, 1);
  assert.equal(pet.rig.group.position.y, 0);
  assert.equal(pet.rig.eyeLids[0].scale.y, 1);
  assert.deepEqual(pet.object3D.position.toArray(), [2, 0.37, 3]);
  pet.dispose();
});

test('two components share no disposable material; picking works after replacement', () => {
  const a = new PetComponent(createPetProfile()),
    b = new PetComponent(createPetProfile());
  let released = false;
  b.pickables[0].material.addEventListener('dispose', () => (released = true));
  a.dispose();
  assert.equal(released, false);
  b.setProfile({ ...b.profile, fur: '#8296a3' });
  b.object3D.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0.85, 4), new THREE.Vector3(0, 0, -1));
  assert.ok(ray.intersectObjects(b.pickables).some((h) => h.object.userData.action === 'pet'));
  b.dispose();
});

test('articulated feet reach valid ground targets and coat textures are freed', () => {
  for (const species of ['cat', 'dog']) {
    const pet = new PetComponent(createPetProfile(species));
    for (const limb of pet.rig.limbs) {
      const pose = solveLeg(limb, -0.448, 0.18);
      const y =
        -limb.upperLength * Math.cos(pose.hip) - limb.lowerLength * Math.cos(pose.hip + pose.knee);
      const z =
        -limb.upperLength * Math.sin(pose.hip) - limb.lowerLength * Math.sin(pose.hip + pose.knee);
      assert.ok(Math.abs(y + 0.448) < 0.001);
      assert.ok(Math.abs(z - 0.18) < 0.001);
    }
    const textures = new Set(pet.pickables.map((m) => m.material.map).filter(Boolean));
    let released = 0;
    textures.forEach((t) => t.addEventListener('dispose', () => released++));
    assert.ok(textures.size >= 2);
    pet.dispose();
    assert.equal(released, textures.size);
  }
});
