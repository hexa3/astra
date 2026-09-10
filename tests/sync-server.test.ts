// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSyncRealm, decryptSyncPayload, deriveSyncKeys, encryptSyncPayload } from '../src/sync/crypto';
import { createSyncServer } from '../sync-server/server.mjs';

test('identity-free server stores opaque per-device envelopes and rejects replay', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'astra-sync-server-'));
  const server = createSyncServer({ dataDirectory: directory });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const keys = await deriveSyncKeys('a high entropy shared sync phrase', createSyncRealm());
    const headers = { authorization: `AstraSync ${keys.authToken}`, 'content-type': 'application/json' };
    const payload = { bookmarks: [{ url: 'https://private.example/notes' }], history: [], workspaces: [{ name: 'Secret research' }], updatedAt: 10 };
    const first = encryptSyncPayload(keys.encryptionKey, 'laptop', 1, payload);
    assert.equal((await fetch(`${origin}/v1/sync/laptop`, { method: 'PUT', headers, body: JSON.stringify(first) })).status, 200);
    assert.equal((await fetch(`${origin}/v1/sync/laptop`, { method: 'PUT', headers, body: JSON.stringify(first) })).status, 409);
    const listed = await (await fetch(`${origin}/v1/sync`, { headers })).json() as { blobs: typeof first[] };
    assert.deepEqual(decryptSyncPayload(keys.encryptionKey, listed.blobs[0]), payload);

    const stored = readdirSync(join(directory, keys.namespace)).map(name => readFileSync(join(directory, keys.namespace, name), 'utf8')).join('');
    assert.doesNotMatch(stored, /private\.example|Secret research/);
    assert.doesNotMatch(stored, new RegExp(keys.authToken));
    assert.doesNotMatch(stored, new RegExp(keys.encryptionKey.toString('base64url')));

    const stranger = await deriveSyncKeys('an unrelated high entropy phrase', createSyncRealm());
    const isolated = await (await fetch(`${origin}/v1/sync`, { headers: { authorization: `AstraSync ${stranger.authToken}` } })).json() as { blobs: unknown[] };
    assert.deepEqual(isolated.blobs, []);
    assert.equal((await fetch(`${origin}/v1/sync`)).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => (server as Server).close(error => error ? reject(error) : resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
