import test from 'node:test';
import assert from 'node:assert/strict';
import { nextVersion } from '../../../scripts/prepare-release.mjs';
test('release versions advance from the registry and respect explicit minor or major bumps', () => {
  assert.equal(nextVersion('0.1.0', undefined), '0.1.0');
  assert.equal(nextVersion('0.1.0', '0.1.3'), '0.1.4');
  assert.equal(nextVersion('0.2.0', '0.1.3'), '0.2.0');
  assert.equal(nextVersion('1.0.0', '0.9.8'), '1.0.0');
  assert.equal(nextVersion('0.9.9', '1.0.0'), '1.0.1');
  assert.throws(() => nextVersion('latest', '1.0.0'));
});
