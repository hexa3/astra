import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageBounds, sidebarWidth } from '../src/shared/layout';

test('native bounds share sidebar widths and never cover trusted navigation', () => {
  assert.deepEqual(pageBounds(1280, 840), { x: 232, y: 88, width: 1048, height: 728 });
  assert.deepEqual(pageBounds(1280, 840, true), { x: 56, y: 88, width: 1224, height: 728 });
  assert.equal(sidebarWidth(true), 56);
  assert.deepEqual(pageBounds(10, 10), { x: 232, y: 88, width: 0, height: 0 });
});
