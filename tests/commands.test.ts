import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCommand } from '../src/shared/commands';

test('IPC validation rejects malformed commands and coerced enum values', () => {
  for (const value of [null, undefined, 3, 'reload', [], {type: 'execute'}, {type: 'navigate', url: 2}, {type: 'navigate', url: 'a'.repeat(8193)}, {type: 'close-tab', id: 1}, {type: 'theme', value: new String('dark')}, {type: 'panel', value: 'unknown'}, {type: 'background-limit', value: NaN}, {type: 'background-limit', value: 33}, {type: 'background-limit', value: -1}, {type: 'unlock-vault', passphrase: 'short'}]) assert.throws(() => validateCommand(value));
});

test('IPC validation accepts boundary values without changing user content', () => {
  const navigate = { type: 'navigate', url: 'https://example.com/?q=one%20two' };
  assert.deepEqual(validateCommand(navigate), navigate);
  assert.deepEqual(validateCommand({type: 'background-limit', value: 0}), {type: 'background-limit', value: 0});
  assert.deepEqual(validateCommand({type: 'background-limit', value: 32}), {type: 'background-limit', value: 32});
  assert.deepEqual(validateCommand({type: 'new-tab'}), {type: 'new-tab'});
});

test('tab movement validates numeric positions and tab identities', () => {
  const command = {type: 'move-tab', id: 'tab', index: 0};
  assert.deepEqual(validateCommand(command), command);
  for (const index of ['0', -1, 1.5, NaN, 100001]) assert.throws(() => validateCommand({...command, index}));
  assert.throws(() => validateCommand({...command, id: 2}));
});
