import Database from 'better-sqlite3';
import { safeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { deriveKey, seal, unseal } from './crypto';

export class Vault {
  mode: 'encrypted' | 'memory' = 'memory';
  locked = false;
  message = 'Memory only: a secure OS key store is unavailable. Data will be lost when Astra closes.';
  private db?: Database.Database;
  private key?: Buffer;
  private memory = new Map<string, unknown>();

  constructor(private directory: string, options = { useKeychain: true }) {
    if (existsSync(join(directory, 'passphrase.json'))) {
      this.locked = true;
      this.message = 'Vault locked. Unlock with your passphrase to restore encrypted records. New browsing stays in memory until then.';
      return;
    }
    const secure = options.useKeychain && safeStorage.isEncryptionAvailable()
      && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
    if (!secure) return;
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      chmodSync(directory, 0o700);
      const keyPath = join(directory, 'vault.key');
      if (existsSync(keyPath)) this.key = Buffer.from(safeStorage.decryptString(readFileSync(keyPath)), 'base64');
      else {
        if (existsSync(join(directory, 'vault.sqlite'))) throw new Error('Existing vault key is missing');
        this.key = randomBytes(32);
        writeFileSync(keyPath, safeStorage.encryptString(this.key.toString('base64')), { mode: 0o600, flag: 'wx' });
      }
      if (this.key.length !== 32) throw new Error('Invalid vault key');
      this.openDatabase();
      this.mode = 'encrypted';
      this.message = 'History, bookmarks and saved tabs are encrypted using your OS key store. Website logins last for this session only.';
    } catch {
      this.db?.close(); this.db = undefined; this.key = undefined;
      this.message = 'Memory only: the encrypted vault could not be opened. Existing files have been preserved.';
    }
  }
  private openDatabase(): void {
    this.db = new Database(join(this.directory, 'vault.sqlite'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('secure_delete = ON');
    this.db.exec('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, payload BLOB NOT NULL)');
  }
  async unlock(passphrase: string): Promise<void> {
    if (this.mode === 'encrypted') return;
    if (passphrase.length < 12 || passphrase.length > 1024) throw new Error('Use a passphrase between 12 and 1024 characters.');
    const metadataPath = join(this.directory, 'passphrase.json');
    if (existsSync(join(this.directory, 'vault.key')) && !existsSync(metadataPath)) throw new Error('This vault uses your OS key store. Restore access to that key store to avoid overwriting existing records.');
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    if (existsSync(metadataPath)) {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as { version: number; salt: string; wrappedKey: string };
      if (metadata.version !== 1 || typeof metadata.salt !== 'string' || typeof metadata.wrappedKey !== 'string') throw new Error('Unsupported vault format. Existing files were preserved.');
      const salt = Buffer.from(metadata.salt, 'base64');
      if (salt.length !== 32) throw new Error('Invalid vault salt.');
      const wrappingKey = await deriveKey(passphrase, salt);
      try { this.key = Buffer.from(unseal(wrappingKey, Buffer.from(metadata.wrappedKey, 'base64'), 'astra-vault-key-v1'), 'base64'); }
      catch { throw new Error('The passphrase is incorrect or the vault key is damaged.'); }
      finally { wrappingKey.fill(0); }
    } else {
      // An existing database without its key must never be silently replaced.
      if (existsSync(join(this.directory, 'vault.sqlite'))) throw new Error('An existing vault has no key. Preserve these files and restore its key backup.');
      const salt = randomBytes(32), wrappingKey = await deriveKey(passphrase, salt);
      this.key = randomBytes(32);
      const wrappedKey = seal(wrappingKey, this.key.toString('base64'), 'astra-vault-key-v1').toString('base64');
      wrappingKey.fill(0);
      writeFileSync(metadataPath, JSON.stringify({ version: 1, salt: salt.toString('base64'), wrappedKey }), { mode: 0o600, flag: 'wx' });
    }
    if (this.key.length !== 32) throw new Error('Invalid vault key.');
    this.openDatabase();
    this.mode = 'encrypted'; this.locked = false;
    this.message = 'Records are encrypted with your passphrase. Unlock them when Astra starts. Website logins last for this session only.';
  }
  get<T>(id: string, fallback: T): T {
    if (!this.db || !this.key) return (this.memory.get(id) as T | undefined) ?? fallback;
    try {
      const row = this.db.prepare('SELECT payload FROM records WHERE id = ?').get(id) as { payload: Buffer } | undefined;
      if (!row) return fallback;
      const value = JSON.parse(unseal(this.key, row.payload, id)) as T;
      this.memory.set(id, value);
      return value;
    } catch {
      this.degrade('An encrypted record could not be read. Existing files are preserved; this session is in memory only.');
      return (this.memory.get(id) as T | undefined) ?? fallback;
    }
  }
  set(id: string, value: unknown): void {
    this.memory.set(id, value);
    if (!this.db || !this.key) return;
    try {
      this.db.prepare('INSERT INTO records (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload')
        .run(id, seal(this.key, JSON.stringify(value), id));
    } catch { this.degrade('Encrypted storage could not be written. This session is in memory only; check available disk space and file permissions.'); }
  }
  private degrade(message: string): void {
    this.mode = 'memory'; this.message = message;
    try { this.db?.close(); } catch { /* Preserve the original storage failure. */ }
    this.db = undefined; this.key?.fill(0); this.key = undefined;
  }
  close(): void { this.db?.close(); this.key?.fill(0); }
}
