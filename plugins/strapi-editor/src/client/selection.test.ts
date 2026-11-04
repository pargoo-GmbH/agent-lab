import test from 'node:test';
import assert from 'node:assert/strict';
import { isActive } from './selection.ts';

test('an edited, removed or different environment cannot keep another revision displayed as active', () => {
  const profile = { id: 'alpha', revision: '1' };
  assert.equal(isActive(profile, { ...profile }), true);
  assert.equal(isActive(profile, { ...profile, revision: '2' }), false);
  assert.equal(isActive(profile, { ...profile, id: 'bravo' }), false);
  assert.equal(isActive(null, profile), false);
  assert.equal(isActive(profile, null), false);
});
