import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveTab } from '../src/shared/tab-order';
import { createTab } from '../src/main/session-state';

const tabs = [createTab('', 'A', 'personal'), createTab('', 'Work', 'work'), createTab('', 'B', 'personal'), createTab('', 'C', 'personal')];
test('tab ordering moves both directions without changing other workspace slots', () => {
  const moved = moveTab(tabs, tabs[0].id, 2);
  assert.deepEqual(moved.map(tab => tab.title), ['B', 'Work', 'C', 'A']);
  assert.equal(moved[1], tabs[1]);
  assert.deepEqual(moveTab(moved, tabs[0].id, 0), tabs);
  assert.deepEqual(tabs.map(tab => tab.title), ['A', 'Work', 'B', 'C']);
  assert.deepEqual(moveTab(tabs, tabs[1].id, 0), tabs);
});
test('invalid tab ordering cannot drop records or move tabs between workspaces', () => {
  for (const index of [-1, 3, NaN, 1.5, Infinity]) assert.throws(() => moveTab(tabs, tabs[0].id, index));
  assert.throws(() => moveTab(tabs, 'missing', 0));
});
