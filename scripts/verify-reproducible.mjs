// SPDX-License-Identifier: MPL-2.0
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const [firstPath, secondPath] = process.argv.slice(2);
if (!firstPath || !secondPath) {
  console.error('usage: node scripts/verify-reproducible.mjs <first archive> <second archive>');
  process.exit(2);
}

const digest = async (path) =>
  createHash('sha256').update(await readFile(path)).digest('hex');

const [firstDigest, secondDigest] = await Promise.all([
  digest(firstPath),
  digest(secondPath),
]);

if (firstDigest !== secondDigest) {
  console.error(`reproducibility failure:\n${firstDigest}  ${firstPath}\n${secondDigest}  ${secondPath}`);
  process.exit(1);
}

console.log(`${firstDigest}  ${basename(firstPath)}`);
console.log('PASS: independently produced archives are byte-for-byte identical');
