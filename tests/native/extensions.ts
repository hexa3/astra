import { app, WebContentsView } from 'electron';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { RamSessions } from '../../src/main/ram-sessions';

app.setPath('userData', process.env.ASTRA_NATIVE_PROFILE!);
app.enableSandbox();
const sessions = new RamSessions();
process.once('exit', () => sessions.dispose());
void app.whenReady().then(async () => {
  if (!RamSessions.supported()) { console.log('SKIP: no supported RAM-backed extension context'); app.exit(0); return; }
  const context = sessions.open('native-fixture');
  assert.ok(context.storagePath?.startsWith('/dev/shm/astra-extensions-'));
  const extension = await context.extensions.loadExtension(join(process.cwd(), 'tests/fixtures/mv3'), { allowFileAccess: false });
  const server = createServer((_request, response) => response.end('<title>Native extension fixture</title><h1>Real page</h1>'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const view = new WebContentsView({ webPreferences: { session: context, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  const contents = view.webContents;
  await contents.loadURL(`http://127.0.0.1:${(server.address() as {port: number}).port}`);
  const result = await contents.executeJavaScript(`new Promise((resolve, reject) => {
    const timer = setTimeout(() => { observer.disconnect(); reject(new Error('No extension response')); }, 5000);
    const check = () => { if (document.documentElement.dataset.nativeExtension) { clearTimeout(timer); observer.disconnect(); resolve(document.documentElement.dataset.nativeExtension); } };
    const observer = new MutationObserver(check); observer.observe(document.documentElement, {attributes:true}); check();
  })`);
  assert.equal(result, 'native MV3 worker');
  assert.equal(await contents.executeJavaScript('typeof require'), 'undefined');
  assert.equal(await contents.executeJavaScript('typeof window.astra'), 'undefined');
  context.extensions.removeExtension(extension.id);
  assert.equal(context.extensions.getAllExtensions().length, 0);
  contents.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
  console.log('PASS: native MV3 content script, background worker and storage in RAM-backed context');
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
