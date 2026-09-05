import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreSavedTabs } from '../src/main/session-state';

const workspaces = [{id: 'personal', name: 'Personal'}, {id: 'work', name: 'Work'}];
test('saved tabs migrate old profiles and keep workspace membership', () => {
  const tabs = restoreSavedTabs([{ url: 'https://example.com/', title: 'Old record' }, { id: 'saved-tab', workspaceId: 'work', url: 'https://example.org/', title: 'Work record' }], workspaces);
  assert.equal(tabs[0].workspaceId, 'personal');
  assert.equal(tabs[1].workspaceId, 'work');
  assert.equal(tabs[1].id, 'saved-tab');
  assert.equal(tabs[1].suspended, true);
});
test('restore keeps duplicate URLs and does not truncate a large session', () => {
  const saved = Array.from({length: 75}, () => ({id: 'duplicate-id', url: 'https://example.com/', title: 'Same page'}));
  const tabs = restoreSavedTabs(saved, workspaces);
  assert.equal(tabs.length, 75);
  assert.equal(new Set(tabs.map(tab => tab.id)).size, 75);
});
test('invalid records cannot restore privileged URLs or unknown contexts', () => {
  const tabs = restoreSavedTabs([null, {}, {url: 'file:///etc/passwd', title: 'Invalid'}, {url: 'https://example.com/', title: 'Missing context', workspaceId: 'missing'}], workspaces);
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0].workspaceId, 'personal');
});
