// SPDX-License-Identifier: MPL-2.0
import type { Entry, Workspace } from '../core/api';
import { isWebURL } from '../shared/navigation';
import { restoreWorkspaces } from '../shared/workspaces';
import { decryptSyncPayload, deriveSyncKeys, encryptSyncPayload, type SyncEnvelope, type SyncPayload } from './crypto';

export interface SyncDataset { bookmarks: Entry[]; history: Entry[]; workspaces: Workspace[] }
export interface SyncConnection { endpoint: string; realm: string; device: string; verifier: string }

export function syncEndpoint(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Sync endpoint must be an absolute URL.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('Sync requires HTTPS except on this device.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Sync endpoint cannot contain credentials, query, or fragment.');
  return url.href.replace(/\/$/, '');
}

function entries(raw: unknown): Entry[] {
  if (!Array.isArray(raw) || raw.length > 5000) throw new Error('Invalid synced entry list.');
  return raw.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Invalid synced entry.');
    const value = item as Partial<Entry>;
    if (typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id) || typeof value.url !== 'string' || !isWebURL(value.url) || typeof value.title !== 'string' || value.title.length > 500 || !Number.isSafeInteger(value.time) || Number(value.time) < 0) throw new Error('Invalid synced entry.');
    return { id: value.id, url: value.url, title: value.title, time: Number(value.time) };
  });
}

function dataset(payload: SyncPayload): SyncDataset {
  const workspaces = restoreWorkspaces(payload.workspaces);
  if (!Array.isArray(payload.workspaces) || workspaces.length !== payload.workspaces.length || workspaces.length > 100) throw new Error('Invalid synced workspaces.');
  return { bookmarks: entries(payload.bookmarks), history: entries(payload.history), workspaces };
}

function mergePayloads(payloads: SyncPayload[]): SyncDataset {
  const bookmarks = new Map<string, Entry>(), history = new Map<string, Entry>(), workspaces = new Map<string, Workspace>();
  for (const payload of [...payloads].sort((left, right) => left.updatedAt - right.updatedAt)) {
    const valid = dataset(payload);
    for (const entry of valid.bookmarks) if ((bookmarks.get(entry.id)?.time ?? -1) <= entry.time) bookmarks.set(entry.id, entry);
    for (const entry of valid.history) if ((history.get(entry.id)?.time ?? -1) <= entry.time) history.set(entry.id, entry);
    for (const workspace of valid.workspaces) workspaces.set(workspace.id, workspace);
  }
  return {
    bookmarks: [...bookmarks.values()].sort((a, b) => b.time - a.time),
    history: [...history.values()].sort((a, b) => b.time - a.time).slice(0, 2000),
    workspaces: [...workspaces.values()],
  };
}

async function responseJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > 40 * 1024 * 1024) throw new Error('Sync response is too large.');
  const text = await response.text();
  if (Buffer.byteLength(text) > 40 * 1024 * 1024) throw new Error('Sync response is too large.');
  try { return JSON.parse(text); } catch { throw new Error('Sync server returned invalid JSON.'); }
}

export class SyncClient {
  private constructor(private connection: SyncConnection, private authToken: string, private encryptionKey: Buffer) {}

  static async connect(connection: SyncConnection, passphrase: string): Promise<SyncClient> {
    const endpoint = syncEndpoint(connection.endpoint);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(connection.device)) throw new Error('Invalid sync device id.');
    const keys = await deriveSyncKeys(passphrase, connection.realm);
    if (keys.verifier !== connection.verifier) { keys.encryptionKey.fill(0); throw new Error('The sync passphrase is incorrect.'); }
    return new SyncClient({ ...connection, endpoint }, keys.authToken, keys.encryptionKey);
  }

  async exchange(local: SyncDataset): Promise<SyncDataset> {
    const response = await fetch(`${this.connection.endpoint}/v1/sync`, { headers: { authorization: `AstraSync ${this.authToken}` }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Sync server rejected download (${response.status}).`);
    const listing = await responseJson(response) as { version?: unknown; blobs?: unknown };
    if (listing.version !== 1 || !Array.isArray(listing.blobs) || listing.blobs.length > 32) throw new Error('Sync server returned an invalid listing.');
    const remote = listing.blobs.map(value => decryptSyncPayload(this.encryptionKey, value as SyncEnvelope));
    const now = Date.now();
    const merged = mergePayloads([...remote, { ...local, updatedAt: now }]);
    const own = (listing.blobs as SyncEnvelope[]).find(blob => blob.device === this.connection.device);
    const sequence = (own?.sequence ?? 0) + 1;
    const envelope = encryptSyncPayload(this.encryptionKey, this.connection.device, sequence, { ...merged, updatedAt: now });
    const uploaded = await fetch(`${this.connection.endpoint}/v1/sync/${encodeURIComponent(this.connection.device)}`, { method: 'PUT', headers: { authorization: `AstraSync ${this.authToken}`, 'content-type': 'application/json' }, body: JSON.stringify(envelope), signal: AbortSignal.timeout(15_000) });
    if (!uploaded.ok) throw new Error(`Sync server rejected upload (${uploaded.status}).`);
    return merged;
  }

  close(): void { this.encryptionKey.fill(0); this.authToken = ''; }
}
