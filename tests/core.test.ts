import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { seal, unseal } from '../src/main/crypto';
import { resolveAddress, isWebURL } from '../src/shared/navigation';
import { isThirdParty, isTracker } from '../src/main/privacy';

test('addresses support sites and search while rejecting privileged protocols', () => {
  assert.equal(resolveAddress('example.org'), 'https://example.org/');
  assert.equal(resolveAddress('localhost:8080/path'), 'http://localhost:8080/path');
  assert.equal(resolveAddress('two words'), 'https://duckduckgo.com/?q=two%20words');
  assert.equal(resolveAddress(''), '');
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,test', 'chrome://settings']) {
    assert.equal(isWebURL(url), false); assert.throws(() => resolveAddress(url));
  }
});
test('encrypted records resist modification, wrong keys and record swaps', () => {
  const key = randomBytes(32), text = 'https://private.example/path';
  const value = seal(key, text, 'history');
  assert.equal(value.includes(Buffer.from(text)), false);
  assert.equal(unseal(key, value, 'history'), text);
  assert.notDeepEqual(value, seal(key, text, 'history'));
  assert.throws(() => unseal(key, value, 'bookmarks'));
  assert.throws(() => unseal(randomBytes(32), value, 'history'));
  value[value.length - 1] ^= 1;
  assert.throws(() => unseal(key, value, 'history'));
});
test('cookie classification respects public and private suffixes', () => {
  assert.equal(isThirdParty('https://static.example.co.uk/a', 'https://www.example.co.uk'), false);
  assert.equal(isThirdParty('https://attacker.co.uk', 'https://example.co.uk'), true);
  assert.equal(isThirdParty('https://alice.github.io', 'https://bob.github.io'), true);
  assert.equal(isThirdParty('https://example.org.evil.com', 'https://example.org'), true);
  assert.equal(isThirdParty('http://example.org', 'https://example.org'), true);
});
test('tracker matching blocks subdomains without matching lookalikes', () => {
  assert.equal(isTracker('https://stats.google-analytics.com/collect'), true);
  assert.equal(isTracker('https://google-analytics.com.evil.example'), false);
  assert.equal(isTracker('https://example.com/google-analytics.com'), false);
});
