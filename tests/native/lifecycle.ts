import { app, BrowserWindow, WebContentsView, dialog } from 'electron';
import assert from 'node:assert/strict';
import { requestPageClose } from '../../src/main/lifecycle';
import { Hibernator } from '../../src/main/hibernation';
import type { BrowserState, Tab } from '../../src/shared/types';

app.setPath('userData', process.env.ASTRA_NATIVE_PROFILE!);
app.enableSandbox();
void app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, partition: 'native-test-ui' } });
  const view = new WebContentsView({ webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, partition: 'native-test-page' } });
  win.contentView.addChildView(view);
  const contents = view.webContents;
  await contents.loadURL('about:blank');
  await contents.executeJavaScript('addEventListener("beforeunload", event => { event.preventDefault(); event.returnValue="leave?"; }); null');
  let choices = 0;
  dialog.showMessageBoxSync = () => { choices++; return 0; };
  assert.equal(await requestPageClose(contents, win), false, 'Stay must cancel closure');
  assert.equal(contents.isDestroyed(), false, 'The protected page must remain alive');
  assert.equal(choices, 1, 'The native confirmation path must be invoked');
  // A renderer round trip separates the two distinct user decisions.
  await contents.executeJavaScript('document.readyState');
  const tab: Tab = { id: 'guarded', url: 'about:blank', title: 'Guarded fixture', loading: false, canBack: false, canForward: false, requests: 0, blocked: 0, cookiesBlocked: 0 };
  const state: BrowserState = { tabs: [tab], activeId: 'empty-active-tab', bookmarks: [], history: [], storage: 'memory', storageMessage: 'Test fixture', vaultLocked: false, backgroundLimit: 0, theme: 'dark', panel: 'none', workspaces: [{id: 'personal', name: 'Personal'}], activeWorkspaceId: 'personal' };
  let hibernator: Hibernator;
  await new Promise<void>(resolve => {
    hibernator = new Hibernator(() => state, new Map([[tab.id, view]]), () => {}, resolve);
    hibernator.schedule();
  });
  hibernator!.stop();
  assert.equal(contents.isDestroyed(), false, 'Automatic hibernation must respect beforeunload');
  assert.equal(tab.suspensionReason, 'Page requested to stay open');
  assert.equal(choices, 1, 'Automatic hibernation must not show a confirmation dialog');
  await contents.executeJavaScript('document.readyState');
  dialog.showMessageBoxSync = () => { choices++; return 1; };
  assert.equal(await requestPageClose(contents, win), true, 'Leave must close the page');
  assert.equal(contents.isDestroyed(), true);
  assert.equal(choices, 2);
  console.log('PASS: native Stay, Leave and automatic hibernation protection without a DevTools client');
  win.destroy(); app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
