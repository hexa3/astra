import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { profileArgument } from '../src/main/profile';

test('explicit profiles accept absolute directories and ignore unrelated arguments', () => {
  const directory = resolve('isolated-profile');
  assert.equal(profileArgument(['electron', '.', `--astra-profile=${directory}`, 'https://example.com']), directory);
  assert.equal(profileArgument(['electron', '.', 'https://example.com']), undefined);
});
test('ambiguous and malformed profile paths are rejected', () => {
  for (const path of ['', 'relative/path', 'https://example.com', `${resolve('profile')}\0bad`]) assert.throws(() => profileArgument([`--astra-profile=${path}`]));
  assert.throws(() => profileArgument([`--astra-profile=${resolve('one')}`, `--astra-profile=${resolve('two')}`]));
});
