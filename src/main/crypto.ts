import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';

export function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}

export function seal(key: Buffer, text: string, context: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const payload = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), payload]);
}
export function unseal(key: Buffer, value: Buffer, context: string): string {
  if (value.length < 28) throw new Error('Encrypted record is truncated.');
  const cipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(value.subarray(12, 28));
  return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]).toString('utf8');
}
