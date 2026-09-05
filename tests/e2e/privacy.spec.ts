import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('blocks third-party HTTP and document cookies while keeping first-party cookies', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'astra-cookie-test-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem'), '-days', '1', '-subj', '/CN=astra-test'], { stdio: 'ignore' });
  let third = '';
  let thirdRequestCookies = '';
  let firstRequestCookies = '';
  const server = createServer({ key: readFileSync(join(directory, 'key.pem')), cert: readFileSync(join(directory, 'cert.pem')) }, (request, response) => {
    response.setHeader('Content-Type', 'text/html');
    if (request.url === '/seed') {
      response.setHeader('Set-Cookie', 'existing=first-party-value; SameSite=None; Secure; Path=/');
      response.end('<title>Cookie seed</title><h1>Seeded</h1>');
    } else if (request.url === '/frame') {
      thirdRequestCookies = request.headers.cookie ?? '';
      response.setHeader('Set-Cookie', 'thirdHttp=should-not-save; SameSite=None; Secure; Path=/');
      response.end('<script>document.cookie="thirdJS=should-not-save; SameSite=None; Secure; Path=/"; parent.postMessage({cookie:document.cookie},"*")</script>');
    } else {
      firstRequestCookies = request.headers.cookie ?? '';
      response.end(`<title>Cookie container</title><script>window.cookieReport=null;addEventListener('message',event=>{window.cookieReport=event.data})</script><iframe src="${third}/frame"></iframe>`);
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const first = `https://first.astra.test:${port}`;
  third = `https://third.other.test:${port}`;
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({ args: ['.', '--host-resolver-rules=MAP first.astra.test 127.0.0.1,MAP third.other.test 127.0.0.1'], env: { ...process.env, ASTRA_TEST_PROFILE: join(directory, 'profile') } });
    const chrome = await app.firstWindow();
    // Only this test process trusts the two local fixtures. Production never overrides certificates.
    await app.evaluate(({ session }) => session.fromPartition('astra-pages').setCertificateVerifyProc((request, callback) => callback(['first.astra.test', 'third.other.test'].includes(request.hostname) ? 0 : -3)));
    const navigate = async (url: string, title: string) => {
      await chrome.getByRole('textbox', { name: 'Address or search' }).fill(url);
      await chrome.getByRole('textbox', { name: 'Address or search' }).press('Enter');
      await expect(chrome.getByRole('tab', { name: title })).toBeVisible();
    };
    await navigate(`${third}/seed`, 'Cookie seed');
    const seeded = await app.evaluate(async ({ session }, url) => session.fromPartition('astra-pages').cookies.get({ url }), third);
    expect(seeded.some(cookie => cookie.name === 'existing')).toBe(true);
    await navigate(`${first}/seed`, 'Cookie seed');
    // Wait for actual navigation; the two seed pages intentionally share a title.
    await expect(chrome.getByRole('textbox', { name: 'Address or search' })).toHaveValue(`${first}/seed`);
    await expect.poll(async () => app!.evaluate(async ({ session }, url) => (await session.fromPartition('astra-pages').cookies.get({ url })).length, first)).toBeGreaterThan(0);
    await navigate(`${first}/container`, 'Cookie container');
    await expect.poll(async () => app!.evaluate(async ({ webContents }, url) => {
      const page = webContents.getAllWebContents().find(wc => wc.getURL() === url)!;
      return page.executeJavaScript('window.cookieReport');
    }, `${first}/container`)).toEqual({ cookie: '' });
    expect(thirdRequestCookies).toBe('');
    expect(firstRequestCookies).toContain('existing=first-party-value');
    const stored = await app.evaluate(async ({ session }, url) => session.fromPartition('astra-pages').cookies.get({ url }), third);
    expect(stored.map(cookie => cookie.name)).toEqual(['existing']);
  } finally {
    await app?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
