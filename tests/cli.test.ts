// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli/commands';

function invoke(directory: string, ...args: string[]): { code: number; out: string; error: string } {
  const output: string[] = [], errors: string[] = [];
  const code = runCli(['--config-dir', directory, ...args], { out: text => output.push(text), error: text => errors.push(text) });
  return { code, out: output.join('\n'), error: errors.join('\n') };
}

test('astractl creates, selects, exports, and dumps plain-text workspaces', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astractl-workspace-'));
  try {
    assert.equal(invoke(directory, 'workspace', 'create', 'Field Notes').code, 0);
    const list = invoke(directory, 'workspace', 'list');
    assert.match(list.out, /field-notes\t\*\tField Notes/);
    const exported = invoke(directory, 'workspace', 'export', 'field-notes');
    assert.match(exported.out, /\[\[workspace\]\]/); assert.match(exported.out, /name = "Field Notes"/);
    const dump = invoke(directory, 'config', 'dump');
    assert.match(dump.out, /### settings\.toml/); assert.match(dump.out, /### extensions\.toml/);
    assert.doesNotMatch(dump.out, /passphrase|credential =|sync_key/i);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('astractl reviews, enables, lists, and removes a local MV3 extension', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astractl-extension-'));
  const extension = join(directory, 'sample'); mkdirSync(extension);
  writeFileSync(join(extension, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Readable', version: '1.0', permissions: ['storage'], host_permissions: ['https://example.com/*'] }));
  try {
    const installed = invoke(directory, 'extension', 'install', extension);
    assert.equal(installed.code, 0); assert.match(installed.out, /Browser permissions: storage/); assert.match(installed.out, /Site access: https:\/\/example\.com\/\*/);
    const id = readFileSync(join(directory, 'extensions.toml'), 'utf8').match(/id = "([^"]+)"/)?.[1];
    assert.ok(id); assert.match(invoke(directory, 'extension', 'list').out, new RegExp(`${id}\\tenabled`));
    assert.equal(invoke(directory, 'extension', 'remove', id,).code, 0);
    assert.match(invoke(directory, 'extension', 'list').out, /No extensions/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('astractl refuses to overwrite invalid hand-edited config', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astractl-invalid-'));
  try {
    invoke(directory, 'workspace', 'list');
    writeFileSync(join(directory, 'settings.toml'), 'format_version = 1\ntheme = "broken"\n');
    const result = invoke(directory, 'workspace', 'create', 'Do not write');
    assert.equal(result.code, 1); assert.match(result.error, /Refusing to edit invalid config/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
