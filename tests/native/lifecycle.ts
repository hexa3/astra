import { app, BrowserWindow, WebContentsView, dialog } from 'electron';
import assert from 'node:assert/strict';
import { requestPageClose } from '../../src/main/lifecycle';

app.setPath('userData', process.env.ASTRA_NATIVE_PROFILE!);
app.enableSandbox();
void app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, partition: 'native-test-ui' } });
  const view = new WebContentsView({ webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, partition: 'native-test-page' } });
  win.contentView.addChildView(view);
  await view.webContents.loadURL('about:blank');
  await view.webContents.executeJavaScript('addEventListener("beforeunload", event => { event.preventDefault(); event.returnValue="leave?"; }); null');
  let choices = 0;
  dialog.showMessageBoxSync = () => { choices++; return 0; };
  assert.equal(await requestPageClose(view.webContents, win), false, 'Stay must cancel closure');
  assert.equal(view.webContents.isDestroyed(), false, 'The protected page must remain alive');
  assert.equal(choices, 1, 'The native confirmation path must be invoked');
  // A renderer round trip separates the two distinct user decisions.
  await view.webContents.executeJavaScript('document.readyState');
  dialog.showMessageBoxSync = () => { choices++; return 1; };
  assert.equal(await requestPageClose(view.webContents, win), true, 'Leave must close the page');
  assert.equal(view.webContents.isDestroyed(), true);
  assert.equal(choices, 2);
  console.log('PASS: native beforeunload Stay and Leave without a DevTools client');
  win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
