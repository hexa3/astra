// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSyncRealm, decryptSyncPayload, deriveSyncKeys, encryptSyncPayload } from '../src/sync/crypto';

test('sync passphrase derives stable separated authentication and content keys', async () => {
  const realm = createSyncRealm();
  const first = await deriveSyncKeys('a sufficiently strong sync phrase', realm);
  const second = await deriveSyncKeys('a sufficiently strong sync phrase', realm);
  assert.equal(first.namespace, second.namespace);
  assert.equal(first.authToken, second.authToken);
  assert.deepEqual(first.encryptionKey, second.encryptionKey);
  assert.notEqual(first.authToken, first.encryptionKey.toString('base64url'));
  assert.notEqual(first.namespace, (await deriveSyncKeys('a different strong sync phrase', realm)).namespace);
});

test('server-visible sync envelope cannot expose or silently modify records', async () => {
  const keys = await deriveSyncKeys('correct horse sync phrase', createSyncRealm());
  const payload = { bookmarks: [{ url: 'https://private.example/notes' }], history: [], workspaces: [{ name: 'Private' }], updatedAt: 42 };
  const envelope = encryptSyncPayload(keys.encryptionKey, 'laptop', 1, payload);
  assert.doesNotMatch(JSON.stringify(envelope), /private\.example|Private/);
  assert.deepEqual(decryptSyncPayload(keys.encryptionKey, envelope), payload);
  const tampered = { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -1)}A` };
  assert.throws(() => decryptSyncPayload(keys.encryptionKey, tampered));
  assert.throws(() => decryptSyncPayload(Buffer.alloc(32, 7), envelope));
});

test('sync realms, devices, sequences and payload structure are bounded', async () => {
  await assert.rejects(() => deriveSyncKeys('short', createSyncRealm()), /between 16/);
  await assert.rejects(() => deriveSyncKeys('a sufficiently strong sync phrase', 'not-a-realm'), /realm/);
  const keys = await deriveSyncKeys('a sufficiently strong sync phrase', createSyncRealm());
  assert.throws(() => encryptSyncPayload(keys.encryptionKey, '../device', 1, { bookmarks: [], history: [], workspaces: [], updatedAt: 1 }), /device/);
  assert.throws(() => encryptSyncPayload(keys.encryptionKey, 'phone', 0, { bookmarks: [], history: [], workspaces: [], updatedAt: 1 }), /sequence/);
});
