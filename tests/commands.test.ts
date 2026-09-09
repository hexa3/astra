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

test('boost commands enforce typed domains and bounded source', () => {
  const command = {type: 'save-boost', domain: 'example.com', css: 'body { color: red }', js: 'document.title = "local"', enabled: true};
  assert.deepEqual(validateCommand(command), command);
  for (const malformed of [
    {...command, domain: 4}, {...command, domain: 'x'.repeat(254)},
    {...command, css: 'x'.repeat(100001)}, {...command, js: 'x'.repeat(100001)},
    {...command, enabled: 'true'}, {type: 'remove-boost', domain: 2},
  ]) assert.throws(() => validateCommand(malformed));
});

test('AI questions are bounded, trimmed and explicitly typed', () => {
  assert.deepEqual(validateCommand({type: 'ai-ask', question: '  what changed?  '}), {type: 'ai-ask', question: 'what changed?'});
  for (const question of ['', '   ', 4, 'x'.repeat(1001)]) assert.throws(() => validateCommand({type: 'ai-ask', question}));
});

test('accent colors accept only an explicit six-digit hex value', () => {
  assert.deepEqual(validateCommand({type: 'accent', value: '#E5231B'}), {type: 'accent', value: '#e5231b'});
  for (const value of ['red', '#fff', '#12345678', '#gg0000', 5]) assert.throws(() => validateCommand({type: 'accent', value}));
});
