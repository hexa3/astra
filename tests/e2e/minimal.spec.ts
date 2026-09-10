// SPDX-License-Identifier: MPL-2.0
import { test, expect, _electron as electron } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server: Server;
let origin: string;

test.beforeAll(async () => {
  server = createServer((_request, response) => response.end('<title>Minimal proof</title><h1>Same core, different shell</h1>'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

test('minimal shell browses through the same versioned core without default chrome', async () => {
  const app = await electron.launch({
    args: ['.', '--astra-shell=minimal'],
    env: { ...process.env, ASTRA_TEST_PROFILE: mkdtempSync(join(tmpdir(), 'astra-minimal-e2e-')) },
  });
  try {
    const shell = await app.firstWindow();
    await expect(shell.getByRole('navigation', { name: 'Minimal browser navigation' })).toBeVisible();
    await expect(shell.getByText('ASTRA', { exact: true })).toHaveCount(0);
    await expect(shell.getByRole('button', { name: 'Open command bar' })).toHaveCount(0);
    const capabilities = await shell.evaluate(() => window.astra.capabilities());
    expect(capabilities).toMatchObject({ apiVersion: '2.0', shell: 'minimal' });

    const address = shell.getByRole('textbox', { name: 'Address or search' });
    await address.fill(origin);
    await address.press('Enter');
    await expect(shell.getByRole('combobox', { name: 'Open tabs' })).toHaveValue(/.+/);
    await expect.poll(() => app.evaluate(async ({ webContents }) => {
      const page = webContents.getAllWebContents().find(contents => contents.getURL().startsWith('http://127.0.0.1'));
      return page ? page.executeJavaScript('document.body.innerText') : '';
    })).toContain('Same core, different shell');
    await shell.getByRole('button', { name: 'New tab' }).click();
    await expect(shell.getByRole('combobox', { name: 'Open tabs' }).locator('option')).toHaveCount(2);
  } finally { await app.close(); }
});
