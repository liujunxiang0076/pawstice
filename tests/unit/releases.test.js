import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releases, releaseMarkdown } from '../../src/config/releases.js';

test('release history matches package version and generated documentation', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(releases[0].version, pkg.version);
  assert.equal(
    readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n'),
    releaseMarkdown(),
  );
  assert.equal(new Set(releases.map((release) => release.version)).size, releases.length);
  for (const [index, release] of releases.entries()) {
    assert.match(release.version, /^\d+\.\d+\.\d+$/);
    assert.equal(new Date(release.date).toISOString().slice(0, 10), release.date);
    assert.ok(release.title && release.changes.length);
    if (index) assert.ok(releases[index - 1].date >= release.date);
    for (const group of release.changes) {
      assert.ok(['新增', '优化', '修复'].includes(group.type));
      assert.ok(
        group.items.length && group.items.every((item) => typeof item === 'string' && item.trim()),
      );
    }
  }
});
