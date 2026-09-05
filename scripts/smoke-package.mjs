import { _electron as electron } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const config = mkdtempSync(join(tmpdir(), 'astra-package-'));
const server = createServer((_request, response) => response.end('<title>Packaged browsing check</title><h1>Rendered by packaged Chromium</h1>'));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const app = await electron.launch({ executablePath: resolve(process.argv[2] ?? 'release/linux-unpacked/astra-browser'), args: ['--password-store=basic'], env: { ...process.env, XDG_CONFIG_HOME: config } });
try {
  const chrome = await app.firstWindow();
  await chrome.getByRole('heading', { name: 'Make space.' }).waitFor();
  const runtime = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, userData: app.getPath('userData'), version: app.getVersion(), resources: process.resourcesPath }));
  if (!runtime.packaged || !runtime.userData.startsWith(config)) throw new Error('Packaged runtime or isolated profile verification failed.');
  await chrome.evaluate(() => window.astra.command({ type: 'theme', value: 'dark' }));
  await chrome.screenshot({ path: 'test-results/packaged-newtab-dark.png' });
  if (!readFileSync(join(runtime.resources, 'licenses', 'Doto-OFL.txt'), 'utf8').includes('SIL OPEN FONT LICENSE')) throw new Error('Packaged font license is missing.');
  if (!readFileSync(join(runtime.resources, 'licenses', 'ASTRA-MIT.txt'), 'utf8').includes('MIT License')) throw new Error('Astra license is missing.');
  await chrome.getByRole('textbox', { name: 'Address or search' }).fill(origin);
  await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
  await chrome.getByRole('tab', { name: 'Packaged browsing check' }).waitFor();
  const page = await app.evaluate(async ({ webContents }) => {
    const contents = webContents.getAllWebContents().find(contents => contents.getURL().startsWith('http:'));
    return contents.executeJavaScript('({body:document.body.innerText,node:typeof require,bridge:typeof window.astra})');
  });
  if (!page.body.includes('Rendered by packaged Chromium') || page.node !== 'undefined' || page.bridge !== 'undefined') throw new Error('Packaged page rendering or isolation failed.');
  await chrome.getByRole('button', { name: 'Open command bar' }).click();
  const query = chrome.getByRole('combobox', { name: 'Search tabs, history, bookmarks and commands' });
  await query.fill('Collapse sidebar'); await query.press('Enter');
  await chrome.getByRole('button', { name: 'Expand sidebar' }).waitFor();
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...runtime, launched: true, rendered: true, isolated: true, licenses: true, commandBar: true }, null, 2));
} catch (error) {
  const chrome = await app.firstWindow();
  console.error('Packaged check state:', await chrome.evaluate(() => window.astra.snapshot()));
  console.error('Packaged chrome:', await chrome.locator('body').innerText());
  throw error;
} finally { await app.close(); await new Promise(resolve => server.close(resolve)); }
