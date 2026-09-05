import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageBounds, sidebarWidth, splitBounds } from '../src/shared/layout';

test('native bounds share sidebar widths and never cover trusted navigation', () => {
  assert.deepEqual(pageBounds(1280, 840), { x: 232, y: 88, width: 1048, height: 728 });
  assert.deepEqual(pageBounds(1280, 840, true), { x: 56, y: 88, width: 1224, height: 728 });
  assert.equal(sidebarWidth(true), 56);
  assert.deepEqual(pageBounds(10, 10), { x: 232, y: 88, width: 0, height: 0 });
});

test('split panes tile the page region with one hairline and no overlap', () => {
  for (const collapsed of [false, true]) {
    const bounds = pageBounds(1280, 840, collapsed);
    const [left, right] = splitBounds(bounds);
    assert.equal(left.x, bounds.x);
    assert.equal(left.y, 88); assert.equal(right.y, 88);
    assert.equal(left.x + left.width + 1, right.x);
    assert.equal(right.x + right.width, 1280);
    assert.ok(Math.abs(left.width - right.width) <= 1);
  }
});
