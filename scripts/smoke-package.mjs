import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const config = mkdtempSync(join(tmpdir(), 'astra-package-'));
const app = await electron.launch({ executablePath: resolve(process.argv[2] ?? 'release/linux-unpacked/astra-browser'), args: ['--password-store=basic'], env: { ...process.env, XDG_CONFIG_HOME: config } });
try {
  const chrome = await app.firstWindow();
  await chrome.getByRole('heading', { name: 'Make space.' }).waitFor();
  const runtime = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, userData: app.getPath('userData'), version: app.getVersion() }));
  if (!runtime.packaged || !runtime.userData.startsWith(config)) throw new Error('Packaged runtime or isolated profile verification failed.');
  await chrome.evaluate(() => window.astra.command({ type: 'theme', value: 'dark' }));
  await chrome.screenshot({ path: 'test-results/packaged-newtab-dark.png' });
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...runtime, launched: true }, null, 2));
} finally { await app.close(); }
