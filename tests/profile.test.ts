// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { profileArgument } from '../src/core/profile';
import { shellArgument } from '../src/core/shell';

test('explicit profiles accept absolute directories and ignore unrelated arguments', () => {
  const directory = resolve('isolated-profile');
  assert.equal(profileArgument(['electron', '.', `--astra-profile=${directory}`, 'https://example.com']), directory);
  assert.equal(profileArgument(['electron', '.', 'https://example.com']), undefined);
});
test('ambiguous and malformed profile paths are rejected', () => {
  for (const path of ['', 'relative/path', 'https://example.com', `${resolve('profile')}\0bad`]) assert.throws(() => profileArgument([`--astra-profile=${path}`]));
  assert.throws(() => profileArgument([`--astra-profile=${resolve('one')}`, `--astra-profile=${resolve('two')}`]));
});

test('shell selection is an allowlisted command-line value', () => {
  assert.equal(shellArgument(['electron', '.']), 'default');
  assert.equal(shellArgument(['electron', '.', '--astra-shell=minimal']), 'minimal');
  assert.throws(() => shellArgument(['--astra-shell=/tmp/code']), /Unknown Astra shell/);
  assert.throws(() => shellArgument(['--astra-shell=minimal', '--astra-shell=default']), /only one/);
});
