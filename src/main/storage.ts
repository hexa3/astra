import Database from 'better-sqlite3';
import { safeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { seal, unseal } from './crypto';

export class Vault {
  mode: 'encrypted' | 'memory' = 'memory';
  message = 'Memory only: a secure OS key store is unavailable. Data will be lost when Astra closes.';
  private db?: Database.Database;
  private key?: Buffer;
  private memory = new Map<string, unknown>();

  constructor(directory: string) {
    const secure = safeStorage.isEncryptionAvailable()
      && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
    if (!secure) return;
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      chmodSync(directory, 0o700);
      const keyPath = join(directory, 'vault.key');
      if (existsSync(keyPath)) this.key = Buffer.from(safeStorage.decryptString(readFileSync(keyPath)), 'base64');
      else {
        this.key = randomBytes(32);
        writeFileSync(keyPath, safeStorage.encryptString(this.key.toString('base64')), { mode: 0o600, flag: 'wx' });
      }
      if (this.key.length !== 32) throw new Error('Invalid vault key');
      this.db = new Database(join(directory, 'vault.sqlite'));
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('secure_delete = ON');
      this.db.exec('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, payload BLOB NOT NULL)');
      this.mode = 'encrypted';
      this.message = 'History, bookmarks and saved tabs are encrypted using your OS key store. Website logins last for this session only.';
    } catch {
      this.db?.close(); this.db = undefined; this.key = undefined;
      this.message = 'Memory only: the encrypted vault could not be opened. Existing files have been preserved.';
    }
  }
  get<T>(id: string, fallback: T): T {
    if (!this.db || !this.key) return (this.memory.get(id) as T | undefined) ?? fallback;
    const row = this.db.prepare('SELECT payload FROM records WHERE id = ?').get(id) as { payload: Buffer } | undefined;
    if (!row) return fallback;
    return JSON.parse(unseal(this.key, row.payload, id)) as T;
  }
  set(id: string, value: unknown): void {
    if (!this.db || !this.key) { this.memory.set(id, value); return; }
    this.db.prepare('INSERT INTO records (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload')
      .run(id, seal(this.key, JSON.stringify(value), id));
  }
  close(): void { this.db?.close(); this.key?.fill(0); }
}
