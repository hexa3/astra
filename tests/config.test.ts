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

test('workspace sessions can select a declared active session', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astra-config-session-'));
  try {
    const store = new ConfigStore(directory);
    const config = store.load().workspaces;
    config.sessions.push({ name: 'Research', workspaceId: 'personal', pages: ['https://example.com/docs'] });
    config.activeSession = 'Research';
    store.writeWorkspaces(config);
    assert.equal(store.load().workspaces.activeSession, 'Research');

    writeFileSync(join(directory, 'workspaces.toml'), readFileSync(join(directory, 'workspaces.toml'), 'utf8').replace('active_session = "Research"', 'active_session = "Missing"'));
    const invalid = store.load();
    assert.equal(invalid.workspaces.activeSession, undefined);
    assert.match(invalid.warnings[0], /active_session/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('extension TOML retains the reviewed permission boundary', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astra-config-extension-'));
  try {
    const store = new ConfigStore(directory);
    store.load();
    store.writeExtensions({ extensions: [{ id: 'reader', directory: '$HOME/extensions/reader', enabled: true, name: 'Reader', version: '1.0.0', permissions: ['storage'], hosts: ['https://example.com/*'] }] });
    const text = readFileSync(join(directory, 'extensions.toml'), 'utf8');
    assert.match(text, /permissions = \[ "storage" \]/);
    assert.match(text, /hosts = \[ "https:\/\/example\.com\/\*" \]/);
    assert.deepEqual(store.load().extensions.extensions[0].permissions, ['storage']);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
