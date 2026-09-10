// SPDX-License-Identifier: MPL-2.0
import { build } from 'esbuild';
import { chmod } from 'node:fs/promises';
await build({
  entryPoints: ['src/main/main.ts', 'src/main/preload.ts'],
  outdir: 'dist/main', outExtension: { '.js': '.cjs' },
  bundle: true, platform: 'node', format: 'cjs', target: 'node24',
  external: ['electron', 'better-sqlite3'], sourcemap: true,
});
await build({
  entryPoints: ['src/cli/main.ts'], outfile: 'dist/cli/astractl.cjs',
  bundle: true, platform: 'node', format: 'cjs', target: 'node24',
  banner: { js: '#!/usr/bin/env node' }, sourcemap: true,
});
await chmod('dist/cli/astractl.cjs', 0o755);
