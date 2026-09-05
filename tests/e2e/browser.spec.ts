import { test, expect, _electron as electron } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

let server: Server;
let origin: string;
let failRetry = true;
test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    if (request.url === '/no-content') { response.statusCode = 204; response.end(); }
    else if (request.url === '/slow') {
      const timer = setTimeout(() => response.end('<title>Slow page</title><h1>Slow response</h1>'), 10000);
      response.on('close', () => clearTimeout(timer));
    }
    else if (request.url === '/retry') { if (failRetry) request.socket.destroy(); else response.end('<title>Recovered page</title><h1>Recovered</h1>'); }
    else if (request.url === '/second') response.end('<title>Second page</title><h1>Second page</h1>');
    else if (request.url === '/form') response.end('<title>Draft form</title><label>Draft<input name="draft" value=""></label>');
    else if (request.url === '/embedded-form') response.end('<title>Embedded draft</title><iframe src="/form"></iframe>');
    else if (request.url === '/cookies/set') { response.setHeader('Set-Cookie', 'context=personal; SameSite=Lax; Path=/'); response.end('<title>Cookie set</title>Cookie stored'); }
    else if (request.url === '/cookies/check') response.end(`<title>Cookie check</title><pre id="cookies">${request.headers.cookie ?? ''}</pre>`);
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

test('workspaces isolate cookies and switch their visible tabs by keyboard', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, ASTRA_TEST_PROFILE: mkdtempSync(join(tmpdir(), 'astra-workspace-test-')) } });
  try {
    const chrome = await app.firstWindow();
    const navigate = async (path: string, title: string) => {
      await chrome.getByRole('textbox', { name: 'Address or search' }).fill(`${origin}${path}`);
      await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
      await expect(chrome.getByRole('tab', { name: title })).toBeVisible();
    };
    await navigate('/cookies/set', 'Cookie set');
    await chrome.getByRole('button', { name: 'Manage workspaces' }).click();
    await chrome.getByLabel('New workspace name').fill('Work');
    await chrome.getByRole('button', { name: 'Create workspace', exact: true }).click();
    await expect(chrome.getByRole('heading', { name: 'Make space.' })).toBeVisible();
    await expect(chrome.getByRole('tab')).toHaveCount(1);
    await navigate('/cookies/check', 'Cookie check');
    const readCookies = () => app.evaluate(async ({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(wc => wc.getURL() === url)!;
      return page.executeJavaScript('document.getElementById("cookies").textContent');
    }, `${origin}/cookies/check`);
    expect(await readCookies()).toBe('');
    await chrome.getByRole('combobox', { name: 'Workspace', exact: true }).selectOption('personal');
    await expect(chrome.getByRole('tab', { name: 'Cookie set' })).toBeVisible();
    await navigate('/cookies/check', 'Cookie check');
    const personalCookie = await app.evaluate(async ({ webContents, session }, url) => {
      const page = webContents.getAllWebContents().find(wc => wc.getURL() === url && wc.session === session.fromPartition('astra-pages'))!;
      return page.executeJavaScript('document.getElementById("cookies").textContent');
    }, `${origin}/cookies/check`);
    expect(personalCookie).toBe('context=personal');
    const work = (await chrome.evaluate(() => window.astra.snapshot())).workspaces.find(workspace => workspace.name === 'Work')!;
    await app.evaluate(({ BrowserWindow }) => {
      // CDP keyboard injection bypasses Electron's before-input-event hook.
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      contents.focus();
      contents.sendInputEvent({ type: 'keyDown', keyCode: 'Right', modifiers: ['control', 'alt'] });
      contents.sendInputEvent({ type: 'keyUp', keyCode: 'Right', modifiers: ['control', 'alt'] });
    });
    await expect(chrome.getByRole('combobox', { name: 'Workspace', exact: true })).toHaveValue(work.id);
    await chrome.getByRole('button', { name: 'Manage workspaces' }).click();
    await chrome.getByRole('textbox', { name: 'Current workspace name' }).fill('Research');
    await chrome.getByRole('button', { name: 'Rename workspace', exact: true }).click();
    await expect(chrome.getByRole('option', { name: 'Research', exact: true })).toHaveCount(1);
  } finally { await app.close(); }
});

test('encrypted restart restores named workspaces and their lazy tabs', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'astra-workspace-vault-'));
  const launch = () => electron.launch({ args: ['.', '--password-store=basic'], env: { ...process.env, ASTRA_TEST_PROFILE: profile } });
  let app = await launch();
  try {
    let chrome = await app.firstWindow();
    await chrome.getByRole('button', { name: 'Manage workspaces' }).click();
    await chrome.getByLabel('New workspace name').fill('Private research');
    await chrome.getByRole('button', { name: 'Create workspace', exact: true }).click();
    await chrome.getByRole('textbox', { name: 'Address or search' }).fill(`${origin}/second`);
    await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
    await expect(chrome.getByRole('tab', { name: 'Second page' })).toBeVisible();
    await chrome.getByRole('button', { name: 'Encrypted storage settings' }).click();
    await chrome.getByRole('textbox', { name: 'Vault passphrase', exact: true }).fill('workspace test secret phrase');
    await chrome.getByRole('textbox', { name: 'Repeat vault passphrase' }).fill('workspace test secret phrase');
    await chrome.getByRole('button', { name: 'Create encrypted vault' }).click();
    await expect(chrome.getByRole('heading', { name: 'Records secured.' })).toBeVisible();
    await app.close();
    for (const filename of readdirSync(join(profile, 'vault'))) expect(readFileSync(join(profile, 'vault', filename)).includes(Buffer.from('Private research'))).toBe(false);
    app = await launch(); chrome = await app.firstWindow();
    await chrome.getByRole('button', { name: 'Encrypted storage settings' }).click();
    await chrome.getByRole('textbox', { name: 'Vault passphrase', exact: true }).fill('workspace test secret phrase');
    await chrome.getByRole('button', { name: 'Unlock records' }).click();
    await expect(chrome.getByRole('heading', { name: 'Records secured.' })).toBeVisible();
    const snapshot = await chrome.evaluate(() => window.astra.snapshot());
    const workspace = snapshot.workspaces.find(workspace => workspace.name === 'Private research')!;
    const saved = snapshot.tabs.find(tab => tab.url === `${origin}/second`)!;
    expect(saved.workspaceId).toBe(workspace.id); expect(saved.suspended).toBe(true);
    await chrome.getByRole('combobox', { name: 'Workspace', exact: true }).selectOption(workspace.id);
    await expect(chrome.getByRole('tab', { name: 'Second page', exact: false })).toBeVisible();
    await expect.poll(async () => app.evaluate(({ webContents }, url) => webContents.getAllWebContents().some(contents => contents.getURL() === url), `${origin}/second`)).toBe(true);
  } finally { await app.close(); }
});

test('command bar jumps across workspaces and executes real browser actions', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, ASTRA_TEST_PROFILE: mkdtempSync(join(tmpdir(), 'astra-command-test-')) } });
  try {
    const chrome = await app.firstWindow();
    await chrome.getByRole('textbox', { name: 'Address or search' }).fill(origin);
    await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
    await expect(chrome.getByRole('tab', { name: 'Astra test page' })).toBeVisible();
    await chrome.getByRole('button', { name: 'Bookmark page', exact: true }).click();
    await chrome.getByRole('button', { name: 'Manage workspaces' }).click();
    await chrome.getByLabel('New workspace name').fill('Work');
    await chrome.getByRole('button', { name: 'Create workspace', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      contents.focus(); contents.sendInputEvent({type: 'keyDown', keyCode: 'K', modifiers: ['control']});
      contents.sendInputEvent({type: 'keyUp', keyCode: 'K', modifiers: ['control']});
    });
    const query = chrome.getByRole('combobox', { name: 'Search tabs, history, bookmarks and commands' });
    await expect(chrome.getByRole('dialog', { name: 'Command bar' })).toBeVisible();
    await expect(query).toBeFocused();
    await query.press('Tab');
    await expect(chrome.getByRole('button', {name: 'Close command bar'})).toBeFocused();
    await chrome.getByRole('button', {name: 'Close command bar'}).press('Tab');
    await expect(query).toBeFocused();
    await query.press('Shift+Tab');
    await expect(chrome.getByRole('button', {name: 'Close command bar'})).toBeFocused();
    await chrome.getByRole('button', {name: 'Close command bar'}).press('Shift+Tab');
    await expect(query).toBeFocused();
    await query.fill('Astra test page');
    await expect(chrome.getByRole('option', {name: /tab Astra test page/})).toHaveCount(1);
    await query.press('Enter');
    await expect(chrome.getByRole('combobox', { name: 'Workspace', exact: true })).toHaveValue('personal');
    await expect(chrome.getByRole('tab', { name: 'Astra test page' })).toBeVisible();
    await chrome.getByRole('button', {name: 'Open command bar'}).click();
    await query.fill('Dark theme'); await query.press('Enter');
    await expect(chrome.locator('html')).toHaveAttribute('data-theme', 'dark');
    await chrome.getByRole('button', {name: 'Open command bar'}).click();
    await query.fill('Bookmarks'); await query.press('Enter');
    await expect(chrome.getByRole('heading', {name: 'Bookmarks', exact: true})).toBeVisible();
    await chrome.getByRole('button', {name: 'Open command bar'}).click();
    await query.fill(`${origin}/from-command`); await query.press('Enter');
    await expect.poll(async () => {
      const snapshot = await chrome.evaluate(() => window.astra.snapshot());
      return snapshot.tabs.find(tab => tab.id === snapshot.activeId)?.url;
    }).toBe(`${origin}/from-command`);
    await chrome.getByRole('button', {name: 'Open command bar'}).click();
    await query.fill('javascript:alert(1)');
    await expect(chrome.getByText('No matching local results.')).toBeVisible();
    await query.press('Escape');
    await expect(chrome.getByRole('dialog', {name: 'Command bar'})).toHaveCount(0);
  } finally { await app.close(); }
});

test('address identifies the committed page after stopped and no-content navigation', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, ASTRA_TEST_PROFILE: mkdtempSync(join(tmpdir(), 'astra-address-test-')) } });
  try {
    const chrome = await app.firstWindow();
    const address = chrome.getByRole('textbox', { name: 'Address or search' });
    await address.fill(origin); await address.press('Enter');
    await expect(chrome.getByRole('tab', { name: 'Astra test page' })).toBeVisible();
    await address.fill(`${origin}/slow`); await address.press('Enter');
    await expect(chrome.getByRole('button', { name: 'Stop loading', exact: true })).toBeVisible();
    await expect(address).toHaveValue(`${origin}/`);
    await chrome.getByRole('button', { name: 'Stop loading', exact: true }).click();
    await expect(chrome.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
    await expect(address).toHaveValue(`${origin}/`);
    await address.fill(`${origin}/no-content`); await address.press('Enter');
    await expect.poll(async () => {
      const snapshot = await chrome.evaluate(() => window.astra.snapshot());
      return snapshot.tabs.find(tab => tab.id === snapshot.activeId)?.loading;
    }).toBe(false);
    await expect(address).toHaveValue(`${origin}/`);
    expect(await app.evaluate(async ({ webContents }) => {
      const page = webContents.getAllWebContents().find(contents => contents.getURL().startsWith('http:'))!;
      return page.executeJavaScript('document.body.innerText');
    })).toContain('A real rendered page');
    await address.fill(''); await address.press('Enter');
    await expect(address).toHaveValue(`${origin}/`);
    failRetry = true;
    await address.fill(`${origin}/retry`); await address.press('Enter');
    await expect(chrome.getByRole('heading', { name: 'This page couldn’t load.' })).toBeVisible();
    await expect(address).toHaveValue(`${origin}/retry`);
    await address.fill(`${origin}/slow`); await address.press('Enter');
    await expect(chrome.getByRole('button', { name: 'Stop loading', exact: true })).toBeVisible();
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.every(view => !view.getVisible()))).toBe(true);
    await chrome.getByRole('button', { name: 'Stop loading', exact: true }).click();
    await expect(chrome.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
    failRetry = false;
    await chrome.getByRole('button', { name: 'Try again' }).click();
    await expect(chrome.getByRole('tab', { name: 'Recovered page' })).toBeVisible();
    await expect(address).toHaveValue(`${origin}/retry`);
    await address.fill('javascript:alert(1)'); await address.press('Enter');
    const alert = chrome.getByRole('alert');
    await expect(alert).toBeVisible();
    const bounds = await alert.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(88);
    await expect(address).toHaveValue(`${origin}/retry`);
    await chrome.getByRole('button', { name: 'Dismiss error' }).click();
    await expect(alert).toHaveCount(0);
  } finally { await app.close(); }
});
