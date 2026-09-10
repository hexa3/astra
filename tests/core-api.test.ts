// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { CORE_API_VERSION, CORE_COMMAND_TYPES } from '../src/core/api';
import { CORE_CHANNELS } from '../src/core/protocol';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(svelte|ts)$/.test(entry.name) ? [path] : [];
  });
}

test('core protocol is explicitly major-versioned and discoverable', () => {
  assert.equal(CORE_API_VERSION, '2.0');
  assert.equal(new Set(CORE_COMMAND_TYPES).size, CORE_COMMAND_TYPES.length);
  assert.ok(CORE_COMMAND_TYPES.includes('navigate'));
  assert.ok(CORE_COMMAND_TYPES.includes('switch-workspace'));
  for (const channel of Object.values(CORE_CHANNELS)) {
    assert.match(channel, /^astra:core:v2\.0:/);
  }
});

test('shell source cannot import core implementation or main-process modules', () => {
  for (const path of sourceFiles('src/renderer')) {
    const source = readFileSync(path, 'utf8');
    const forbidden = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
      .filter((specifier) => specifier.includes('/main/') || (specifier.includes('/core/') && !specifier.endsWith('/core/api')));
    assert.deepEqual(forbidden, [], `${relative('.', path)} crosses the public core boundary`);
  }
});

test('versioned channel names live only in the core protocol module', () => {
  const offenders = sourceFiles('src')
    .filter((path) => path !== join('src', 'core', 'protocol.ts'))
    .filter((path) => readFileSync(path, 'utf8').includes('astra:core:v'));
  assert.deepEqual(offenders, []);
});
