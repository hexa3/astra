import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeManifest, samePermissions, inspectExtension } from '../src/main/extension-manifest';

test('extension review includes content-script and optional host access', () => {
  const summary = summarizeManifest({manifest_version: 3, name: 'Reader', version: '1', permissions: ['storage'], optional_permissions: ['tabs'], host_permissions: ['https://example.com/*'], content_scripts: [{matches: ['<all_urls>']}], optional_host_permissions: ['https://optional.example/*']});
  assert.deepEqual(summary.permissions, ['storage', 'tabs (optional)']);
  assert.deepEqual(summary.hosts, ['<all_urls>', 'https://example.com/*', 'https://optional.example/* (optional)']);
  assert.equal(samePermissions(summary, {...summary, name: 'Renamed'}), true);
  assert.equal(samePermissions(summary, {...summary, hosts: ['<all_urls>']}), false);
});
test('malformed or non-MV3 extensions cannot bypass permission review', () => {
  const manifest = {manifest_version: 3, name: 'Reader', version: '1'};
  for (const value of [null, {...manifest, manifest_version: 2}, {...manifest, name: ''}, {...manifest, permissions: [true]}, {...manifest, host_permissions: 'all'}, {...manifest, content_scripts: [null]}]) assert.throws(() => summarizeManifest(value));
  assert.equal(inspectExtension('tests/fixtures/mv3').name, 'Astra native extension fixture');
});
