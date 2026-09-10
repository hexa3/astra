// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { UNTRUSTED_PAGE_PREFERENCES } from '../src/core/web-boundary';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(svelte|ts)$/.test(entry.name) ? [path] : [];
  });
}

test('untrusted pages have one hardened policy and no Astra preload', () => {
  assert.deepEqual(UNTRUSTED_PAGE_PREFERENCES, {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: false,
    navigateOnDragDrop: false,
    safeDialogs: true,
    webviewTag: false,
  });
  assert.equal('preload' in UNTRUSTED_PAGE_PREFERENCES, false);

  const core = readFileSync('src/core/browser-core.ts', 'utf8');
  assert.equal((core.match(/new WebContentsView/g) ?? []).length, 2);
  assert.equal((core.match(/webPreferences: pageWebPreferences\(/g) ?? []).length, 2);
});

test('only trusted browser chrome publishes the versioned shell bridge', () => {
  const exposures = sourceFiles('src').filter(path => readFileSync(path, 'utf8').includes('exposeInMainWorld'));
  assert.deepEqual(exposures, [join('src', 'main', 'preload.ts')]);
  assert.match(readFileSync(exposures[0], 'utf8'), /exposeInMainWorld\(['"]astra['"]/);
});

test('the machine-readable audit covers every custom surface without web exposure', () => {
  const audit = JSON.parse(readFileSync('docs/standards-audit.json', 'utf8')) as {
    schemaVersion: number;
    surfaces: Array<Record<string, unknown> & { id: string; webExposure: string; proposal: string | null }>;
  };
  assert.equal(audit.schemaVersion, 1);
  assert.deepEqual(audit.surfaces.map(surface => surface.id).sort(), [
    'ai-assistant', 'boosts', 'core-api', 'peek', 'resource-panel', 'sync-protocol',
  ]);
  for (const surface of audit.surfaces) {
    assert.equal(surface.webExposure, 'none', `${surface.id} exposes a proprietary web API`);
    assert.equal(surface.proposal, null, `${surface.id} incorrectly claims a standards proposal is needed`);
    for (const field of ['name', 'classification', 'basis', 'implementation', 'verification']) {
      assert.ok(surface[field], `${surface.id} is missing ${field}`);
    }
  }
});
