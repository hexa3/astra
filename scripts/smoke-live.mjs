import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const app = await electron.launch({ args: ['.'], env: { ...process.env, ASTRA_TEST_PROFILE: mkdtempSync(join(tmpdir(), 'astra-live-')) } });
try {
  const chrome = await app.firstWindow();
  await chrome.getByRole('textbox', { name: 'Address or search' }).fill('https://example.com');
  await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
  await chrome.getByRole('tab', { name: 'Example Domain' }).waitFor({ timeout: 30000 });
  const body = await app.evaluate(async ({ webContents }) => {
    const page = webContents.getAllWebContents().find(wc => wc.getURL().startsWith('https://example.com'));
    return page.executeJavaScript('document.body.innerText');
  });
  if (!body.includes('Example Domain')) throw new Error('Live page content missing.');
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), url: 'https://example.com', rendered: true, body }, null, 2));
  await chrome.screenshot({ path: 'test-results/live-chrome.png' });
} finally { await app.close(); }
