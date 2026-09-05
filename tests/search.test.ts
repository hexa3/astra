import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuzzyScore, searchBrowser } from '../src/shared/search';
import type { BrowserState } from '../src/shared/types';
const state: BrowserState = { tabs: [], activeId: '', workspaces: [{id: 'personal', name: 'Personal'}, {id: 'work', name: 'Work'}], activeWorkspaceId: 'personal', bookmarks: [], history: [], storage: 'memory', storageMessage: '', vaultLocked: false, backgroundLimit: 6, theme: 'dark', panel: 'none' };

test('fuzzy ranking handles abbreviations, accents and exact matches', () => {
  assert.ok(fuzzyScore('cafe', 'Café') > fuzzyScore('cafe', 'Café research'));
  assert.ok(Number.isFinite(fuzzyScore('wsp', 'Workspaces')));
  assert.equal(fuzzyScore('xyz', 'Workspaces'), -Infinity);
});
test('command search includes real actions and rejects privileged navigation', () => {
  assert.equal(searchBrowser(state, 'new space')[0].command.type, 'panel');
  assert.equal(searchBrowser(state, 'dark theme')[0].id, 'theme:dark');
  assert.equal(searchBrowser(state, 'work')[0].id, 'workspace:work');
  assert.equal(searchBrowser(state, 'javascript:alert(1)').some(result => result.kind === 'navigate'), false);
  assert.equal(searchBrowser(state, 'example.org').at(-1)?.command.type, 'navigate');
});
test('history results are deduplicated without hiding separate open tabs', () => {
  const current: BrowserState = {...state, history: [{id: '1', title: 'Example', url: 'https://example.com', time: 2}, {id: '2', title: 'Example', url: 'https://example.com', time: 1}]};
  assert.equal(searchBrowser(current, 'Example').filter(result => result.kind === 'history').length, 1);
});
