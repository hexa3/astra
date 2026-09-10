// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('reproducible verifier accepts identical bytes and rejects a mismatch', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astra-repro-test-'));
  try {
    const first = join(directory, 'first.tar.gz');
    const second = join(directory, 'second.tar.gz');
    writeFileSync(first, Buffer.from([0, 1, 2, 3]));
    writeFileSync(second, Buffer.from([0, 1, 2, 3]));

    const accepted = execFileSync(
      process.execPath,
      ['scripts/verify-reproducible.mjs', first, second],
      { encoding: 'utf8' },
    );
    assert.match(accepted, /byte-for-byte identical/);

    writeFileSync(second, Buffer.from([0, 1, 2, 4]));
    const rejected = spawnSync(
      process.execPath,
      ['scripts/verify-reproducible.mjs', first, second],
      { encoding: 'utf8' },
    );
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /reproducibility failure/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
