// SPDX-License-Identifier: MPL-2.0
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BODY_LIMIT = 12 * 1024 * 1024;
const NAMESPACE_LIMIT = 32 * 1024 * 1024;
const DEVICE_LIMIT = 32;
const TOKEN = /^[a-zA-Z0-9_-]{43}$/;
const DEVICE = /^[a-zA-Z0-9_-]{1,100}$/;
const CIPHERTEXT = /^[a-zA-Z0-9_-]+$/;

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(body);
}

function namespace(request) {
  const authorization = request.headers.authorization;
  const match = typeof authorization === 'string' ? /^AstraSync ([a-zA-Z0-9_-]+)$/.exec(authorization) : undefined;
  if (!match || !TOKEN.test(match[1])) return undefined;
  const bytes = Buffer.from(match[1], 'base64url');
  if (bytes.length !== 32 || bytes.toString('base64url') !== match[1]) return undefined;
  return createHash('sha256').update(bytes).digest('hex');
}

async function body(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > BODY_LIMIT) throw new Error('too-large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function envelope(value, expectedDevice) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
  if (value.version !== 1 || value.device !== expectedDevice || !DEVICE.test(value.device)) throw new Error('invalid');
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 1) throw new Error('invalid');
  if (typeof value.ciphertext !== 'string' || value.ciphertext.length < 38 || value.ciphertext.length > 11 * 1024 * 1024 || !CIPHERTEXT.test(value.ciphertext)) throw new Error('invalid');
  return { version: 1, device: value.device, sequence: value.sequence, ciphertext: value.ciphertext };
}

export function createSyncServer(options = {}) {
  const selectedDirectory = options.dataDirectory ?? process.env.ASTRA_SYNC_DATA_DIR ?? '/data';
  if (!isAbsolute(selectedDirectory)) throw new Error('ASTRA_SYNC_DATA_DIR must be absolute.');
  const dataDirectory = resolve(selectedDirectory);
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 }); chmodSync(dataDirectory, 0o700);
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://sync.invalid');
      if (request.method === 'GET' && url.pathname === '/health') { json(response, 200, { status: 'ok', protocol: 1 }); return; }
      const owner = namespace(request);
      if (!owner) { json(response, 401, { error: 'A valid AstraSync key is required.' }); return; }
      const directory = join(dataDirectory, owner);
      if (request.method === 'GET' && url.pathname === '/v1/sync') {
        const names = existsSync(directory) ? readdirSync(directory).filter(name => DEVICE.test(name.replace(/\.json$/, '')) && name.endsWith('.json')).sort() : [];
        if (names.length > DEVICE_LIMIT || names.reduce((total, name) => total + statSync(join(directory, name)).size, 0) > NAMESPACE_LIMIT) { json(response, 507, { error: 'Namespace storage limit exceeded.' }); return; }
        const blobs = names.map(name => JSON.parse(readFileSync(join(directory, name), 'utf8')));
        json(response, 200, { version: 1, blobs }); return;
      }
      const match = /^\/v1\/sync\/([a-zA-Z0-9_-]{1,100})$/.exec(url.pathname);
      if (request.method === 'PUT' && match) {
        if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) { json(response, 415, { error: 'Use application/json.' }); return; }
        const next = envelope(await body(request), match[1]);
        mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
        const path = join(directory, `${next.device}.json`);
        const existingFiles = readdirSync(directory).filter(name => name.endsWith('.json'));
        if (!existsSync(path) && existingFiles.length >= DEVICE_LIMIT) { json(response, 507, { error: 'Device limit exceeded.' }); return; }
        if (existsSync(path)) {
          const previous = envelope(JSON.parse(readFileSync(path, 'utf8')), next.device);
          if (previous.sequence >= next.sequence) { json(response, 409, { error: 'Sequence must increase.' }); return; }
        }
        const encoded = JSON.stringify(next);
        const previousSize = existsSync(path) ? statSync(path).size : 0;
        const used = existingFiles.reduce((total, name) => total + statSync(join(directory, name)).size, 0);
        if (used - previousSize + Buffer.byteLength(encoded) > NAMESPACE_LIMIT) { json(response, 507, { error: 'Namespace storage limit exceeded.' }); return; }
        const temporary = join(directory, `.${next.device}.${randomUUID()}.tmp`);
        writeFileSync(temporary, encoded, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        renameSync(temporary, path); chmodSync(path, 0o600);
        json(response, 200, { stored: true, sequence: next.sequence }); return;
      }
      json(response, 404, { error: 'Not found.' });
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'too-large') { json(response, 413, { error: 'Payload too large.' }); return; }
      json(response, 400, { error: 'Invalid sync request.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const host = process.env.ASTRA_SYNC_HOST ?? '0.0.0.0';
  const port = Number(process.env.ASTRA_SYNC_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('ASTRA_SYNC_PORT must be from 1 through 65535.');
  createSyncServer().listen(port, host, () => process.stdout.write(`Astra sync protocol 1 listening on ${host}:${port}\n`));
}
