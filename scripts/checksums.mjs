import { createHash } from 'node:crypto';
import { createReadStream, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const [output, ...files] = process.argv.slice(2);
if (!output || !files.length) throw new Error('Usage: node scripts/checksums.mjs OUTPUT ARTIFACT...');
if (files.some(file => resolve(file) === resolve(output))) throw new Error('The manifest must not overwrite an artifact.');
if (new Set(files.map(file => basename(file))).size !== files.length) throw new Error('Artifact filenames must be unique.');
const lines = [];
for (const file of files.toSorted()) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  lines.push(`${hash.digest('hex')}  ${basename(file)}`);
}
writeFileSync(output, `${lines.join('\n')}\n`, { flag: 'wx' });
console.log(`Wrote ${files.length} SHA-256 hashes to ${output}`);
