import { test, expect, _electron as electron } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server: Server;
let origin: string;
test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    if (request.url === '/second') response.end('<title>Second page</title><h1>Second page</h1>');
    else response.end('<title>Astra test page</title><h1>A real rendered page</h1><a href="/second">Second</a><script src="https://www.google-analytics.com/analytics.js"></script>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

test('launches, renders a page and supports navigation, tabs and privacy', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, ASTRA_TEST_PROFILE: mkdtempSync(join(tmpdir(), 'astra-e2e-')) } });
  try {
    const chrome = await app.firstWindow();
    await expect(chrome.getByRole('heading', { name: 'Make space.' })).toBeVisible();
    await chrome.getByRole('textbox', { name: 'Address or search' }).fill(origin);
    await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
    await expect(chrome.getByRole('tab', { name: 'Astra test page' })).toBeVisible();
    const result = await app.evaluate(async ({ webContents }) => {
      const page = webContents.getAllWebContents().find(wc => wc.getURL().startsWith('http://127.0.0.1'))!;
      return { body: await page.executeJavaScript('document.body.innerText'), node: await page.executeJavaScript('typeof require'), bridge: await page.executeJavaScript('typeof window.astra'), process: await page.executeJavaScript('typeof process') };
    });
    expect(result.body).toContain('A real rendered page');
    expect(result.node).toBe('undefined'); expect(result.bridge).toBe('undefined'); expect(result.process).toBe('undefined');
    await chrome.getByRole('button', { name: 'Bookmark page', exact: true }).click();
    await expect(chrome.getByRole('button', { name: 'Remove bookmark', exact: true })).toBeVisible();
    await chrome.getByRole('textbox', { name: 'Address or search' }).fill(`${origin}/second`);
    await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
    await expect(chrome.getByRole('tab', { name: 'Second page', exact: false })).toBeVisible();
    await chrome.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(chrome.getByRole('tab', { name: 'Astra test page' })).toBeVisible();
    await chrome.getByRole('button', { name: 'Forward', exact: true }).click();
    await expect(chrome.getByRole('tab', { name: 'Second page', exact: false })).toBeVisible();
    await chrome.getByRole('button', { name: 'Behind the page' }).click();
    const snapshot = await chrome.evaluate(() => window.astra.snapshot());
    expect(snapshot.tabs[0].blocked).toBeGreaterThan(0);
    expect(snapshot.tabs[0].requests).toBeGreaterThan(snapshot.tabs[0].blocked);
    await expect(chrome.getByText('None', { exact: true })).toBeVisible();
    await chrome.getByRole('button', { name: 'Close privacy panel' }).click();
    await chrome.getByRole('button', { name: 'New tab', exact: false }).click();
    await expect(chrome.getByRole('tab')).toHaveCount(2);
    await chrome.getByRole('button', { name: 'Close New tab' }).click();
    await expect(chrome.getByRole('tab')).toHaveCount(1);
    await chrome.getByRole('button', { name: 'History', exact: true }).click();
    await expect(chrome.getByRole('heading', { name: 'History' })).toBeVisible();
    await chrome.screenshot({ path: 'test-results/first-launch-history.png' });
  } finally { await app.close(); }
});
