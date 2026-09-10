// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSyncServer } from '../sync-server/server.mjs';
import { SyncClient, syncEndpoint, type SyncConnection, type SyncDataset } from '../src/sync/client';
import { createSyncRealm, deriveSyncKeys } from '../src/sync/crypto';

const empty = (name: string): SyncDataset => ({ bookmarks: [], history: [], workspaces: [{ id: 'personal', name }] });

test('two identity-free clients exchange encrypted browser records', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'astra-sync-client-'));
  const server = createSyncServer({ dataDirectory: directory });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const realm = createSyncRealm(), passphrase = 'shared high entropy sync phrase';
  const keys = await deriveSyncKeys(passphrase, realm);
  const connection = (device: string): SyncConnection => ({ endpoint, realm, device, verifier: keys.verifier });
  const laptop = await SyncClient.connect(connection('laptop'), passphrase);
  const phone = await SyncClient.connect(connection('phone'), passphrase);
  try {
    await laptop.exchange({ ...empty('Personal'), bookmarks: [{ id: 'bookmark-1', url: 'https://example.com/', title: 'Example', time: 10 }] });
    const onPhone = await phone.exchange({ ...empty('Renamed elsewhere'), history: [{ id: 'history-1', url: 'https://example.org/', title: 'History', time: 20 }] });
    assert.equal(onPhone.bookmarks[0].title, 'Example');
    assert.equal(onPhone.history[0].title, 'History');
    assert.equal(onPhone.workspaces[0].name, 'Renamed elsewhere');
    const onLaptop = await laptop.exchange(empty('Personal'));
    assert.equal(onLaptop.history[0].title, 'History');
  } finally {
    laptop.close(); phone.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('sync client rejects wrong passphrases and cleartext remote endpoints', async () => {
  const realm = createSyncRealm();
  const keys = await deriveSyncKeys('correct high entropy phrase', realm);
  await assert.rejects(() => SyncClient.connect({ endpoint: 'https://sync.example', realm, device: 'desktop', verifier: keys.verifier }, 'incorrect high entropy phrase'), /incorrect/);
  assert.throws(() => syncEndpoint('http://sync.example'), /HTTPS/);
  assert.equal(syncEndpoint('http://localhost:8787/'), 'http://localhost:8787');
});
