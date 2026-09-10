// SPDX-License-Identifier: MPL-2.0
import { createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { deriveKey, seal, unseal } from '../core/crypto';

export const SYNC_PROTOCOL_VERSION = 1;
const REALM_BYTES = 32;

export interface SyncKeys {
  namespace: string;
  authToken: string;
  encryptionKey: Buffer;
  verifier: string;
}
export interface SyncPayload {
  bookmarks: unknown[];
  history: unknown[];
  workspaces: unknown[];
  updatedAt: number;
}
export interface SyncEnvelope {
  version: typeof SYNC_PROTOCOL_VERSION;
  device: string;
  sequence: number;
  ciphertext: string;
}

const base64url = (value: Buffer): string => value.toString('base64url');

export function createSyncRealm(): string { return base64url(randomBytes(REALM_BYTES)); }

export async function deriveSyncKeys(passphrase: string, realm: string): Promise<SyncKeys> {
  if (passphrase.length < 16 || passphrase.length > 1024) throw new Error('Use a sync passphrase between 16 and 1024 characters.');
  let salt: Buffer;
  try { salt = Buffer.from(realm, 'base64url'); } catch { throw new Error('The sync realm is invalid.'); }
  if (salt.length !== REALM_BYTES || base64url(salt) !== realm) throw new Error('The sync realm must be 32 canonical base64url bytes.');
  const master = await deriveKey(passphrase, salt);
  try {
    const authKey = Buffer.from(hkdfSync('sha256', master, salt, 'astra-sync-auth-v1', 32));
    const encryptionKey = Buffer.from(hkdfSync('sha256', master, salt, 'astra-sync-content-v1', 32));
    const namespace = createHash('sha256').update(authKey).digest('hex');
    const verifier = base64url(createHmac('sha256', encryptionKey).update('astra-sync-verifier-v1').digest());
    return { namespace, authToken: base64url(authKey), encryptionKey, verifier };
  } finally { master.fill(0); }
}

function envelopeContext(device: string, sequence: number): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(device)) throw new Error('Invalid sync device id.');
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Invalid sync sequence.');
  return `astra-sync-v1:${device}:${sequence}`;
}

export function encryptSyncPayload(key: Buffer, device: string, sequence: number, payload: SyncPayload): SyncEnvelope {
  if (key.length !== 32) throw new Error('Invalid sync encryption key.');
  const context = envelopeContext(device, sequence);
  const encoded = JSON.stringify(payload);
  if (Buffer.byteLength(encoded) > 8 * 1024 * 1024) throw new Error('Sync payload exceeds 8 MiB.');
  return { version: SYNC_PROTOCOL_VERSION, device, sequence, ciphertext: seal(key, encoded, context).toString('base64url') };
}

export function decryptSyncPayload(key: Buffer, envelope: SyncEnvelope): SyncPayload {
  if (!envelope || envelope.version !== SYNC_PROTOCOL_VERSION || typeof envelope.ciphertext !== 'string') throw new Error('Unsupported sync envelope.');
  const context = envelopeContext(envelope.device, envelope.sequence);
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64url');
  if (ciphertext.toString('base64url') !== envelope.ciphertext) throw new Error('Sync ciphertext is not canonical base64url.');
  if (ciphertext.length > 8 * 1024 * 1024 + 28) throw new Error('Sync ciphertext exceeds 8 MiB.');
  const value = JSON.parse(unseal(key, ciphertext, context)) as Partial<SyncPayload>;
  if (!Array.isArray(value.bookmarks) || !Array.isArray(value.history) || !Array.isArray(value.workspaces) || !Number.isSafeInteger(value.updatedAt) || Number(value.updatedAt) < 0) throw new Error('Invalid decrypted sync payload.');
  return value as SyncPayload;
}
