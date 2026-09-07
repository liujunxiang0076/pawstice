import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigator } from '../../src/core/navigation.js';
import { loadGameState, saveGameState, SAVE_KEY } from '../../src/core/storage.js';

test('navigation avoids obstacles including diagonal corners', () => {
  const nav = createNavigator([{ x: 0, z: 0, w: 1, d: 1 }], () => 0.42);
  const path = nav.findPath({ x: -2, z: 0 }, { x: 2, z: 0 });
  assert.ok(path.length > 0);
  path.forEach((p) => assert.equal(nav.blocked(p.x, p.z), false));
  assert.equal(nav.findPath({ x: -2, z: 0 }, { x: 0, z: 0 }).length, 0);
});
test('legacy saves retain identity, reject invalid stats and reset daily tasks', () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        pet: 'dog',
        name: '旧朋友',
        date: 'old',
        tasks: ['feed'],
        stats: [200, -1, null, 'bad'],
      }),
  };
  const state = loadGameState(storage, 'today');
  assert.equal(state.name, '旧朋友');
  assert.equal(state.pet, 'dog');
  assert.deepEqual(state.tasks, []);
  assert.deepEqual(state.stats, [100, 0, 76, 95]);
  let written;
  assert.ok(
    saveGameState(state, {
      setItem(key, value) {
        assert.equal(key, SAVE_KEY);
        written = JSON.parse(value);
      },
    }),
  );
  assert.equal(written.petProfile.name, '旧朋友');
  assert.equal(
    saveGameState(state, {
      setItem() {
        throw new Error('quota');
      },
    }),
    false,
  );
});
