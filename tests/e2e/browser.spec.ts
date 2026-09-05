import { test, expect, _electron as electron } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

let server: Server;
let origin: string;
test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    if (request.url === '/second') response.end('<title>Second page</title><h1>Second page</h1>');
    else if (request.url === '/form') response.end('<title>Draft form</title><label>Draft<input name="draft" value=""></label>');
    else if (request.url === '/embedded-form') response.end('<title>Embedded draft</title><iframe src="/form"></iframe>');
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
    await chrome.getByRole('button', { name: /^New tab/ }).click();
    await expect(chrome.getByRole('tab')).toHaveCount(2);
    await chrome.getByRole('button', { name: 'Close New tab' }).click();
    await expect(chrome.getByRole('tab')).toHaveCount(1);
    await chrome.getByRole('button', { name: 'History', exact: true }).click();
    await expect(chrome.getByRole('heading', { name: 'History' })).toBeVisible();
    await chrome.screenshot({ path: 'test-results/first-launch-history.png' });
  } finally { await app.close(); }
});

test('passphrase vault persists encrypted records and rejects a wrong key', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'astra-vault-test-'));
  const launch = () => electron.launch({ args: ['.', '--password-store=basic'], env: { ...process.env, ASTRA_TEST_PROFILE: profile } });
  let app = await launch();
  try {
    let chrome = await app.firstWindow();
    await chrome.getByRole('textbox', { name: 'Address or search' }).fill(origin);
    await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
    await expect(chrome.getByRole('tab', { name: 'Astra test page' })).toBeVisible();
    await chrome.getByRole('button', { name: 'Bookmark page', exact: true }).click();
    await chrome.getByRole('button', { name: 'Encrypted storage settings' }).click();
    await chrome.getByRole('textbox', { name: 'Vault passphrase', exact: true }).fill('correct horse test phrase');
    await chrome.getByRole('textbox', { name: 'Repeat vault passphrase', exact: true }).fill('correct horse test phrase');
    await chrome.getByRole('button', { name: 'Create encrypted vault' }).click();
    await expect(chrome.getByRole('heading', { name: 'Records secured.' })).toBeVisible();
    await app.close();
    const vaultPath = join(profile, 'vault');
    for (const file of readdirSync(vaultPath)) {
      const bytes = readFileSync(join(vaultPath, file));
      for (const secret of [origin, 'Astra test page', 'correct horse test phrase']) expect(bytes.includes(Buffer.from(secret))).toBe(false);
    }
    app = await launch(); chrome = await app.firstWindow();
    await expect(chrome.getByRole('heading', { name: 'Make space.' })).toBeVisible();
    expect((await chrome.evaluate(() => window.astra.snapshot())).bookmarks).toHaveLength(0);
    await chrome.getByRole('button', { name: 'Encrypted storage settings' }).click();
    await chrome.getByRole('textbox', { name: 'Vault passphrase', exact: true }).fill('incorrect test passphrase');
    await chrome.getByRole('button', { name: 'Unlock records' }).click();
    await expect(chrome.getByRole('alert')).toContainText('incorrect');
    await chrome.getByRole('textbox', { name: 'Vault passphrase', exact: true }).fill('correct horse test phrase');
    await chrome.getByRole('button', { name: 'Unlock records' }).click();
    await expect(chrome.getByRole('heading', { name: 'Records secured.' })).toBeVisible();
    const restored = await chrome.evaluate(() => window.astra.snapshot());
    expect(restored.storage).toBe('encrypted');
    expect(restored.bookmarks[0].url).toBe(`${origin}/`);
    expect(restored.history.some(item => item.title === 'Astra test page')).toBe(true);
    expect(restored.tabs.some(tab => tab.url === `${origin}/`)).toBe(true);
    await chrome.getByRole('tab', { name: 'Astra test page' }).click();
    await expect.poll(async () => (await chrome.evaluate(() => window.astra.snapshot())).history.length).toBeGreaterThan(restored.history.length);
  } finally { await app.close(); }
});

test('hibernation destroys page views, restores navigation and protects frame drafts', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, ASTRA_TEST_PROFILE: mkdtempSync(join(tmpdir(), 'astra-sleep-test-')) } });
  try {
    const chrome = await app.firstWindow();
    await chrome.getByRole('button', { name: 'Behind the page' }).click();
    await chrome.getByLabel('Keep up to').selectOption('0');
    await chrome.getByRole('button', { name: 'Close privacy panel' }).click();
    const navigate = async (url: string, title: string) => {
      await chrome.getByRole('textbox', { name: 'Address or search' }).fill(url);
      await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
      await expect(chrome.getByRole('tab', { name: title })).toBeVisible();
    };
    await navigate(origin, 'Astra test page');
    await navigate(`${origin}/second`, 'Second page');
    await chrome.getByRole('button', { name: /^New tab/ }).click();
    await expect.poll(async () => (await chrome.evaluate(() => window.astra.snapshot())).tabs[0].suspended).toBe(true);
    expect(await app.evaluate(({ webContents }) => webContents.getAllWebContents().filter(wc => wc.getURL().startsWith('http://127.0.0.1')).length)).toBe(0);
    await chrome.getByRole('tab', { name: 'Second page', exact: false }).click();
    await expect(chrome.getByRole('button', { name: 'Back', exact: true })).toBeEnabled();
    await chrome.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(chrome.getByRole('tab', { name: 'Astra test page' })).toBeVisible();
    await navigate(`${origin}/embedded-form`, 'Embedded draft');
    await expect.poll(async () => app.evaluate(async ({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(wc => wc.getURL() === url)!;
      return page.executeJavaScript('document.querySelector("iframe").contentDocument.querySelector("input") !== null');
    }, `${origin}/embedded-form`)).toBe(true);
    await app.evaluate(async ({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(wc => wc.getURL() === url)!;
      await page.executeJavaScript('document.querySelector("iframe").contentDocument.querySelector("input").value="Unsaved draft"');
    }, `${origin}/embedded-form`);
    await chrome.getByRole('button', { name: /^New tab/ }).click();
    await expect.poll(async () => (await chrome.evaluate(() => window.astra.snapshot())).tabs[0].suspensionReason).toBe('Unsaved form or editable content');
    expect((await chrome.evaluate(() => window.astra.snapshot())).tabs[0].suspended).not.toBe(true);
    await chrome.getByRole('tab', { name: 'Embedded draft' }).click();
    expect(await app.evaluate(async ({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(wc => wc.getURL() === url)!;
      return page.executeJavaScript('document.querySelector("iframe").contentDocument.querySelector("input").value');
    }, `${origin}/embedded-form`)).toBe('Unsaved draft');
    await expect.poll(async () => (await chrome.evaluate(() => window.astra.snapshot())).tabs[0].rendererMemoryMB, { timeout: 10000 }).toBeGreaterThan(0);
  } finally { await app.close(); }
});

test('a second process hands its URL to the existing profile', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'astra-instance-test-'));
  const env = { ...process.env, ASTRA_TEST_PROFILE: profile };
  const app = await electron.launch({ args: ['.'], env });
  try {
    const chrome = await app.firstWindow();
    await expect(chrome.getByRole('heading', { name: 'Make space.' })).toBeVisible();
    const executable = createRequire(import.meta.url)('electron') as string;
    const child = spawn(executable, ['.', origin], { env, stdio: 'ignore' });
    const code = await new Promise<number | null>((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    expect(code).toBe(0);
    await expect(chrome.getByRole('tab', { name: 'Astra test page' })).toBeVisible();
    await expect(chrome.getByRole('tab')).toHaveCount(2);
  } finally { await app.close(); }
});
