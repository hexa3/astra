// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ConfigStore, configDirectory, portableConfigPath, resolveConfigPath, safeStartupURL } from '../src/config/index';

test('plain config initializes as readable TOML without secret material', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astra-config-'));
  try {
    const config = new ConfigStore(directory).load();
    assert.equal(config.settings.theme, 'system');
    assert.equal(config.workspaces.workspaces[0].name, 'Personal');
    for (const filename of ['settings.toml', 'workspaces.toml', 'extensions.toml']) {
      const text = readFileSync(join(directory, filename), 'utf8');
      assert.match(text, /format_version = 1/);
      assert.doesNotMatch(text, /correct horse|api[_-]?key|bearer\s+[a-z0-9]/i);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('invalid edited TOML is reported and never overwritten', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astra-config-invalid-'));
  try {
    const store = new ConfigStore(directory);
    store.load();
    const invalid = 'format_version = 1\ntheme = "ultraviolet"\n';
    writeFileSync(join(directory, 'settings.toml'), invalid);
    const config = store.load();
    assert.equal(config.settings.theme, 'system');
    assert.match(config.warnings[0], /theme/);
    assert.equal(readFileSync(join(directory, 'settings.toml'), 'utf8'), invalid);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('startup pages reject URL material that is unsafe for dotfiles', () => {
  assert.equal(safeStartupURL('https://example.com/docs'), 'https://example.com/docs');
  assert.throws(() => safeStartupURL('https://user:secret@example.com/'), /credentials/);
  assert.throws(() => safeStartupURL('https://example.com/?token=secret'), /query/);
  assert.throws(() => safeStartupURL('file:///etc/passwd'), /HTTP/);
});

test('config and extension paths are predictable without embedding a username', () => {
  assert.equal(configDirectory({}, '/home/alice'), '/home/alice/.config/astra');
  assert.equal(configDirectory({ XDG_CONFIG_HOME: '/tmp/config' }, '/home/alice'), '/tmp/config/astra');
  assert.equal(portableConfigPath('/home/alice/extensions/tool', '/home/alice'), '$HOME/extensions/tool');
  assert.equal(resolveConfigPath('$HOME/extensions/tool', '/home/alice'), '/home/alice/extensions/tool');
  assert.throws(() => configDirectory({ ASTRA_CONFIG_DIR: 'relative' }, '/home/alice'), /absolute/);
});
