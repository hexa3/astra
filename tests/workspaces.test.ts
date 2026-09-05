import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WORKSPACE, restoreWorkspaces, workspaceName, workspacePartition } from '../src/shared/workspaces';

test('workspace names support Unicode and reject empty or oversized labels', () => {
  assert.equal(workspaceName('  Work   research  '), 'Work research');
  assert.equal(workspaceName('研究'), '研究');
  for (const invalid of ['', ' '.repeat(10), 'x'.repeat(61), 'Work\u0000']) assert.throws(() => workspaceName(invalid));
});
test('old and malformed workspace records restore a usable context', () => {
  assert.deepEqual(restoreWorkspaces(undefined), [DEFAULT_WORKSPACE]);
  assert.deepEqual(restoreWorkspaces([null, { id: 'persist:escape', name: 'Invalid' }]), [DEFAULT_WORKSPACE]);
  assert.deepEqual(restoreWorkspaces([{ id: 'work', name: 'Work' }, { id: 'work', name: 'Renamed' }]), [{ id: 'work', name: 'Renamed' }]);
});
test('workspace sessions are ephemeral and preserve the original partition', () => {
  assert.equal(workspacePartition('personal'), 'astra-pages');
  assert.equal(workspacePartition('work'), 'astra-pages:work');
  assert.notEqual(workspacePartition('work'), workspacePartition('research'));
});
