// SPDX-License-Identifier: MPL-2.0
import { app, BrowserWindow, WebContentsView, ipcMain, Menu, session, nativeTheme, dialog } from 'electron';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { Vault } from './storage';
import { installPrivacy } from './privacy';
import { Hibernator } from './hibernation';
import { requestPageClose, installNavigationConfirmation } from './lifecycle';
import { createTab, restoreSavedTabs } from './session-state';
import { isWebURL, resolveAddress } from '../shared/navigation';
import { validateCommand } from '../shared/commands';
import { DEFAULT_WORKSPACE, restoreWorkspaces, workspacePartition } from '../shared/workspaces';
import { moveTab } from '../shared/tab-order';
import { pageBounds, peekBounds, splitBounds } from '../shared/layout';
import { profileArgument } from './profile';
import { inspectExtension, samePermissions } from './extension-manifest';
import { RamSessions } from './ram-sessions';
import { modelProviders, type PageDocument } from './ai';
import type { Boost, BrowserState, Command, Entry, ExtensionRegistration, Tab } from '../shared/types';

app.setName('Astra');
const testProfile = !app.isPackaged ? process.env.ASTRA_TEST_PROFILE : undefined;
const chosenProfile = profileArgument(process.argv) ?? testProfile;
if (chosenProfile) { mkdirSync(chosenProfile, { recursive: true, mode: 0o700 }); app.setPath('userData', chosenProfile); }
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
for (const flag of ['disable-background-networking', 'disable-component-update', 'disable-domain-reliability', 'disable-sync', 'disable-http-cache', 'no-pings', 'test-third-party-cookie-phaseout']) app.commandLine.appendSwitch(flag);
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,MediaRouter,OptimizationHints,PrivacySandboxSettings4,InterestFeedContentSuggestions');
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
app.enableSandbox();

let win: BrowserWindow;
let vault: Vault;
let state: BrowserState;
let hibernator: Hibernator;
let metricsTimer: ReturnType<typeof setInterval> | undefined;
let quitting = false;
let unlockingVault = false;
let closingWindow = false;
const closingTabs = new Set<string>();
const pendingURLs: string[] = [];
let publishTimer: ReturnType<typeof setTimeout> | undefined;
const views = new Map<string, WebContentsView>();
const preparedSessions = new Set<string>();
const disposableSessions = new RamSessions();
const runtimeExtensions = new WeakMap<Electron.Session, Map<string, string>>();
const insertedBoostCSS = new Map<string, string>();
let peekView: WebContentsView | undefined;
let peekTimer: ReturnType<typeof setTimeout> | undefined;
let altHeld = false;
const hoveredLinks = new Map<string, string>();
const chromeURL = pathToFileURL(join(__dirname, '../renderer/index.html')).href;
const active = () => state.tabs.find(tab => tab.id === state.activeId);
const contents = () => views.get(state.activeId)?.webContents;
const splitContains = (id: string) => state.split?.leftId === id || state.split?.rightId === id;

function pageSession(workspaceId: string): Electron.Session {
  const partition = workspacePartition(workspaceId);
  const extensionsEnabled = state.extensions?.some(extension => extension.enabled) ?? false;
  const context = extensionsEnabled && RamSessions.supported() ? disposableSessions.open(partition) : session.fromPartition(partition, { cache: false });
  const preparationKey = `${extensionsEnabled ? 'extensions' : 'normal'}:${partition}`;
  if (!preparedSessions.has(preparationKey)) {
    installPrivacy(context, id => state.tabs.find(tab => views.get(tab.id)?.webContents?.id === id), schedulePublish);
    preparedSessions.add(preparationKey);
    if (extensionsEnabled) void applyExtensions(context);
  }
  return context;
}

async function applyExtensions(context: Electron.Session): Promise<void> {
  if (!RamSessions.supported()) return;
  const loaded = runtimeExtensions.get(context) ?? new Map<string, string>();
  runtimeExtensions.set(context, loaded);
  for (const registration of state.extensions ?? []) {
    const runtimeId = loaded.get(registration.id);
    if (!registration.enabled) {
      if (runtimeId) { context.extensions.removeExtension(runtimeId); loaded.delete(registration.id); }
      continue;
    }
    if (runtimeId) continue;
    try {
      const current = inspectExtension(registration.directory);
      if (!samePermissions(registration, current)) {
        registration.enabled = false;
        registration.error = 'Permissions changed on disk. Remove and review this extension again.';
        continue;
      }
      const extension = await context.extensions.loadExtension(registration.directory, { allowFileAccess: false });
      loaded.set(registration.id, extension.id); registration.error = undefined;
    } catch (cause) {
      registration.enabled = false; registration.error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  persist(); schedulePublish();
}

async function chooseExtension(): Promise<void> {
  if (!RamSessions.supported()) throw new Error('Disposable extension sessions are unavailable on this system.');
  const result = await dialog.showOpenDialog(win, { title: 'Load unpacked Manifest V3 extension', properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths[0]) return;
  const directory = result.filePaths[0];
  const summary = inspectExtension(directory);
  const access = [summary.permissions.length ? `Browser permissions:\n${summary.permissions.join('\n')}` : 'Browser permissions: none', summary.hosts.length ? `\nSite access:\n${summary.hosts.join('\n')}` : '\nSite access: none'].join('');
  const review = await dialog.showMessageBox(win, { type: 'warning', title: 'Review extension access', message: `Load ${summary.name} ${summary.version}?`, detail: `${access}\n\nExtensions can read or change pages matching their site access. Enabling the first extension reloads open pages in a disposable context and clears current site logins. Only continue if you trust this local folder.`, buttons: ['Cancel', 'Load extension'], defaultId: 0, cancelId: 0, noLink: true });
  if (review.response !== 1) return;
  const hadEnabled = state.extensions?.some(item => item.enabled) ?? false;
  state.extensions ??= [];
  const existing = state.extensions.find(item => item.directory === directory);
  if (existing) Object.assign(existing, summary, { enabled: true, error: undefined });
  else state.extensions.push({ id: randomUUID(), directory, ...summary, enabled: true });
  if (!hadEnabled) migratePageSessions();
  else { for (const context of disposableSessions.all()) await applyExtensions(context); for (const view of views.values()) if (!view.webContents.isDestroyed()) view.webContents.reload(); }
  persist(); publish();
}

function migratePageSessions(): void {
  const live = [...views.entries()];
  for (const [id, view] of live) {
    if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
    try { win.contentView.removeChildView(view); } catch { /* Closing may detach it first. */ }
    views.delete(id);
    const tab = state.tabs.find(item => item.id === id); if (tab) tab.suspended = true;
  }
  const visibleIds = state.split ? [state.split.leftId, state.split.rightId] : [state.activeId];
  for (const id of visibleIds) {
    const tab = state.tabs.find(item => item.id === id);
    if (tab?.url) { tab.suspended = false; void createView(tab).webContents.loadURL(tab.url).catch(() => {}); }
  }
  layout(); publish(); hibernator.schedule();
}

async function applyBoost(tab: Tab, wc: WebContents): Promise<void> {
  const oldKey = insertedBoostCSS.get(tab.id);
  if (oldKey) { await wc.removeInsertedCSS(oldKey).catch(() => {}); insertedBoostCSS.delete(tab.id); }
  let domain = '';
  try { domain = new URL(wc.getURL()).hostname.toLowerCase(); } catch { return; }
  const boost = state.boosts?.find(item => item.domain === domain && item.enabled);
  if (!boost) return;
  try {
    if (boost.css) insertedBoostCSS.set(tab.id, await wc.insertCSS(boost.css, { cssOrigin: 'user' }));
    if (boost.js) await wc.executeJavaScript(`(async () => {\n${boost.js}\n})()`, true);
    boost.error = undefined;
  } catch (cause) {
    boost.error = cause instanceof Error ? cause.message : String(cause);
  }
  persist(); schedulePublish();
}

function publish(): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('astra:state', state);
}
function schedulePublish(): void {
  if (!publishTimer) publishTimer = setTimeout(() => { publishTimer = undefined; publish(); }, 100);
}
function persist(): void {
  vault.set('session', state.tabs.map(({ id, url, title, workspaceId }) => ({ id, url, title, workspaceId })));
  vault.set('workspaces', state.workspaces);
  vault.set('active-workspace', state.activeWorkspaceId);
  vault.set('bookmarks', state.bookmarks);
  vault.set('history', state.history);
  vault.set('theme', state.theme);
  vault.set('accent', state.accent);
  vault.set('background-limit', state.backgroundLimit);
  vault.set('sidebar-collapsed', !!state.sidebarCollapsed);
  vault.set('extensions', state.extensions);
  vault.set('boosts', state.boosts);
  state.storage = vault.mode; state.storageMessage = vault.message; state.vaultLocked = vault.locked;
}
function layout(): void {
  if (!win || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  const bounds = pageBounds(width, height, state.sidebarCollapsed, state.ai?.open);
  const [left, right] = splitBounds(bounds);
  for (const [id, view] of views) {
    const tab = state.tabs.find(tab => tab.id === id);
    view.setVisible((state.split ? splitContains(id) : id === state.activeId) && state.panel === 'none' && !!tab?.url && !tab?.error);
    view.setBounds(state.split ? id === state.split.leftId ? left : right : bounds);
  }
  if (peekView && !peekView.webContents.isDestroyed()) {
    peekView.setVisible(state.panel === 'none');
    peekView.setBounds(peekBounds(bounds));
  }
}
function shortcut(name: string): void {
  win.webContents.focus(); win.webContents.send('astra:shortcut', name);
}
function bindKeys(wc: WebContents): void {
  wc.on('before-input-event', (event, input) => {
    if (input.key.toLowerCase() === 'alt') {
      altHeld = input.type === 'keyDown';
      if (altHeld) {
        const url = hoveredLinks.get(state.activeId);
        if (url) schedulePeek(url, state.activeId);
      } else closePeek();
      return;
    }
    if (input.type !== 'keyDown') return;
    const mod = process.platform === 'darwin' ? input.meta : input.control;
    const key = input.key.toLowerCase();
    let action: (() => void) | undefined;
    if (mod && key === 'l') action = () => shortcut('address');
    if (mod && key === 'b') action = () => { void dispatch({ type: 'toggle-sidebar' }); };
    if (mod && input.shift && key === 's') action = () => {
      if (state.split || active()?.url && !active()?.error && state.tabs.some(tab => tab.id !== state.activeId && tab.workspaceId === state.activeWorkspaceId && tab.url && !tab.error)) void dispatch({ type: 'toggle-split' });
    };
    if (mod && key === 'k') action = () => {
      state.panel = state.panel === 'commands' ? 'none' : 'commands';
      layout(); publish(); win.webContents.focus();
    };
    if (mod && input.shift && key === 'a') action = () => { void dispatch({ type: 'toggle-ai' }); };
    if (mod && key === 't') action = () => { newTab(); shortcut('address'); };
    if (mod && key === 'w') action = () => closeTab(state.activeId);
    if ((mod && key === 'r') || key === 'f5') action = () => { void dispatch({ type: 'reload' }); };
    if (mod && key === 'd') action = toggleBookmark;
    if (mod && key === 'h') action = () => { state.panel = 'history'; layout(); publish(); };
    if ((mod || input.control) && key === 'tab') action = () => {
      const tabs = state.tabs.filter(tab => tab.workspaceId === state.activeWorkspaceId);
      const index = tabs.findIndex(tab => tab.id === state.activeId);
      if (tabs.length) activateTab(tabs[(index + (input.shift ? -1 : 1) + tabs.length) % tabs.length].id);
    };
    if (mod && input.alt && ['arrowleft', 'arrowright'].includes(key)) action = () => {
      const index = state.workspaces.findIndex(workspace => workspace.id === state.activeWorkspaceId);
      switchWorkspace(state.workspaces[(index + (key === 'arrowleft' ? -1 : 1) + state.workspaces.length) % state.workspaces.length].id);
    };
    if (mod && input.alt && /^[1-9]$/.test(key) && state.workspaces[Number(key) - 1]) action = () => switchWorkspace(state.workspaces[Number(key) - 1].id);
    if (input.alt && !mod && key === 'arrowleft') action = () => { if (!active()?.restoring && contents()?.navigationHistory.canGoBack()) contents()?.navigationHistory.goBack(); };
    if (input.alt && !mod && key === 'arrowright') action = () => { if (!active()?.restoring && contents()?.navigationHistory.canGoForward()) contents()?.navigationHistory.goForward(); };
    if (key === 'escape' && state.peek) action = closePeek;
    else if (key === 'escape' && state.panel !== 'none') action = () => { state.panel = 'none'; layout(); publish(); contents()?.focus(); };
    if (action) { event.preventDefault(); action(); }
  });
}
function closePeek(): void {
  if (peekTimer) { clearTimeout(peekTimer); peekTimer = undefined; }
  if (peekView) {
    try { win.contentView.removeChildView(peekView); } catch { /* Already detached. */ }
    if (!peekView.webContents.isDestroyed()) peekView.webContents.close();
    peekView = undefined;
  }
  if (state?.peek) { state.peek = undefined; publish(); }
}
function schedulePeek(url: string, tabId: string): void {
  if (!isWebURL(url) || tabId !== state.activeId) return;
  if (peekTimer) clearTimeout(peekTimer);
  if (state.peek?.url === url) return;
  peekTimer = setTimeout(() => { peekTimer = undefined; if (altHeld && tabId === state.activeId && hoveredLinks.get(tabId) === url) openPeek(url); }, 350);
}
function openPeek(url: string): void {
  closePeek();
  const tab = active(); if (!tab || !isWebURL(url)) return;
  state.peek = { url, title: new URL(url).hostname, loading: true };
  peekView = new WebContentsView({ webPreferences: { session: pageSession(tab.workspaceId ?? DEFAULT_WORKSPACE.id), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false, navigateOnDragDrop: false, safeDialogs: true, webviewTag: false } });
  win.contentView.addChildView(peekView);
  const wc = peekView.webContents;
  bindKeys(wc);
  wc.setWindowOpenHandler(({ url: target }) => { if (isWebURL(target)) newTab(target); return { action: 'deny' }; });
  wc.on('will-navigate', (event, target) => { if (!isWebURL(target)) event.preventDefault(); });
  wc.on('page-title-updated', (_event, title) => { if (state.peek) { state.peek.title = title.slice(0, 200); publish(); } });
  wc.on('did-stop-loading', () => { if (state.peek) { state.peek.loading = false; state.peek.url = isWebURL(wc.getURL()) ? wc.getURL() : state.peek.url; publish(); } });
  wc.on('did-fail-load', (_event, code, description, _target, mainFrame) => { if (mainFrame && code !== -3 && state.peek) { state.peek.loading = false; state.peek.title = `${description} (${code})`; publish(); } });
  void wc.loadURL(url).catch(() => {});
  layout(); publish();
}
function createView(tab: Tab): WebContentsView {
  const view = new WebContentsView({ webPreferences: {
    session: pageSession(tab.workspaceId ?? DEFAULT_WORKSPACE.id),
    nodeIntegration: false, contextIsolation: true, sandbox: true,
    webSecurity: true, allowRunningInsecureContent: false, spellcheck: false,
    navigateOnDragDrop: false, safeDialogs: true, webviewTag: false,
  } });
  views.set(tab.id, view);
  win.contentView.addChildView(view);
  const wc = view.webContents;
  wc.on('focus', () => { if (splitContains(tab.id) && state.activeId !== tab.id) activateTab(tab.id); });
  installNavigationConfirmation(wc, win, () => hibernator.isSuspending(tab.id));
  bindKeys(wc);
  wc.setWindowOpenHandler(({ url }) => {
    if (isWebURL(url)) newTab(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => { if (!isWebURL(url)) event.preventDefault(); });
  wc.on('will-redirect', (event, url) => { if (!isWebURL(url)) event.preventDefault(); });
  wc.on('update-target-url', (_event, url) => {
    if (url && isWebURL(url)) { hoveredLinks.set(tab.id, url); if (altHeld) schedulePeek(url, tab.id); }
    else { hoveredLinks.delete(tab.id); if (altHeld) closePeek(); }
  });
  const update = () => {
    if (wc.isDestroyed()) return;
    tab.loading = !!tab.restoring || wc.isLoading();
    tab.canBack = !tab.restoring && wc.navigationHistory.canGoBack(); tab.canForward = !tab.restoring && wc.navigationHistory.canGoForward();
    publish();
  };
  wc.on('did-start-loading', update);
  wc.on('did-stop-loading', () => {
    if (!tab.error) tab.url = isWebURL(wc.getURL()) ? wc.getURL() : '';
    update(); layout();
  });
  wc.on('did-stop-loading', () => hibernator.schedule());
  wc.on('page-title-updated', (_event, title) => { tab.title = title.slice(0, 500); publish(); });
  const navigated = (url: string) => {
    if (!isWebURL(url)) return;
    tab.url = url; tab.error = undefined;
    update(); layout();
  };
  wc.on('did-navigate', (_event, url) => navigated(url));
  wc.on('did-navigate-in-page', (_event, url, mainFrame) => { if (mainFrame) navigated(url); });
  wc.on('did-finish-load', () => {
    if (!isWebURL(wc.getURL())) return;
    tab.title = wc.getTitle().slice(0, 500) || tab.url;
    state.history.unshift({ id: randomUUID(), url: tab.url, title: tab.title, time: Date.now() });
    state.history = state.history.slice(0, 2000);
    persist(); update();
    void applyBoost(tab, wc);
  });
  wc.on('did-fail-load', (_event, code, description, url, mainFrame) => {
    if (mainFrame && code !== -3) {
      if (splitContains(tab.id)) state.split = undefined;
      if (isWebURL(url)) tab.url = url;
      tab.error = `${description} (${code})`; tab.loading = false; layout(); publish();
    }
  });
  wc.on('render-process-gone', (_event, details) => {
    if (quitting) return;
    if (splitContains(tab.id)) state.split = undefined;
    tab.error = `The page process stopped: ${details.reason}. Reload to try again.`;
    tab.loading = false; layout(); publish();
  });
  wc.on('context-menu', (_event, params) => {
    const template: Electron.MenuItemConstructorOptions[] = [];
    if (isWebURL(params.linkURL)) template.push({ label: 'Open link in new tab', click: () => newTab(params.linkURL) });
    if (params.isEditable) template.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
    else if (params.selectionText) template.push({ role: 'copy' });
    template.push({ label: 'Reload page', click: () => wc.reload() });
    Menu.buildFromTemplate(template).popup({ window: win });
  });
  layout();
  return view;
}
function newTab(url = '', title = 'New tab'): void {
  closePeek(); state.split = undefined;
  const tab = createTab(url, title, state.activeWorkspaceId);
  state.tabs.push(tab); state.activeId = tab.id; state.panel = 'none';
  const workspace = state.workspaces.find(workspace => workspace.id === state.activeWorkspaceId);
  if (workspace) workspace.lastActiveTabId = tab.id;
  if (url) void createView(tab).webContents.loadURL(url).catch(() => {});
  layout(); publish(); persist();
  hibernator.schedule();
}
function activateTab(id: string): void {
  if (!state.tabs.some(tab => tab.id === id)) return;
  if (state.split && !splitContains(id)) state.split = undefined;
  closePeek(); state.activeId = id; state.panel = 'none';
  const tab = active()!;
  state.activeWorkspaceId = tab.workspaceId ?? DEFAULT_WORKSPACE.id;
  const workspace = state.workspaces.find(workspace => workspace.id === state.activeWorkspaceId);
  if (workspace) workspace.lastActiveTabId = id;
  tab.lastActiveAt = Date.now();
  if (tab.url && !views.has(id)) void hibernator.restore(tab, createView(tab)).catch(() => {});
  layout(); publish(); contents()?.focus();
  hibernator.schedule();
}
function enterSplit(id: string): void {
  const current = active(), partner = state.tabs.find(tab => tab.id === id);
  if (!current?.url || !partner?.url || current.id === id || current.workspaceId !== partner.workspaceId || current.error || partner.error) throw new Error('Split view needs two loaded pages in the same workspace.');
  state.split = { leftId: current.id, rightId: id }; state.panel = 'none';
  if (!views.has(id)) void hibernator.restore(partner, createView(partner)).catch(() => {});
  layout(); publish(); contents()?.focus(); hibernator.schedule();
}
function switchWorkspace(id: string): void {
  const workspace = state.workspaces.find(workspace => workspace.id === id);
  if (!workspace) throw new Error('This workspace no longer exists.');
  state.activeWorkspaceId = id;
  const tabs = state.tabs.filter(tab => tab.workspaceId === id);
  const target = tabs.find(tab => tab.id === workspace.lastActiveTabId) ?? tabs[0];
  if (target) activateTab(target.id); else newTab();
  persist();
}
async function closeTab(id: string): Promise<void> {
  if (closingTabs.has(id)) return;
  let index = state.tabs.findIndex(tab => tab.id === id);
  if (index < 0) return;
  const view = views.get(id);
  if (view) {
    closingTabs.add(id);
    try { if (!await requestPageClose(view.webContents, win)) return; }
    finally { closingTabs.delete(id); }
    win.contentView.removeChildView(view); views.delete(id);
  }
  index = state.tabs.findIndex(tab => tab.id === id);
  if (index < 0) return;
  state.tabs.splice(index, 1);
  if (splitContains(id)) state.split = undefined;
  hibernator.forget(id);
  if (id === state.activeId) {
    const remaining = state.tabs.filter(tab => tab.workspaceId === state.activeWorkspaceId);
    if (remaining.length) activateTab(remaining[Math.min(index, remaining.length - 1)].id); else newTab();
  }
  layout(); publish(); persist();
}
async function pageDocument(): Promise<PageDocument> {
  const tab = active(), wc = contents();
  if (!tab?.url || !wc || wc.isDestroyed() || tab.error) throw new Error('Open a readable webpage first.');
  const sourceUrl = wc.getURL();
  const extracted = await wc.executeJavaScript(`({ title: document.title, text: (document.body?.innerText || '').slice(0, 200000) })`, true) as { title?: unknown; text?: unknown };
  if (wc.isDestroyed() || wc.getURL() !== sourceUrl) throw new Error('The page changed while Astra was reading it. Try again.');
  return { url: sourceUrl, title: typeof extracted.title === 'string' ? extracted.title.slice(0, 500) : tab.title, text: typeof extracted.text === 'string' ? extracted.text : '' };
}
async function runAI(question?: string): Promise<void> {
  const ai = state.ai!;
  const provider = modelProviders.get(ai.provider);
  if (!provider) throw new Error('The selected AI provider is unavailable.');
  ai.busy = true; ai.error = undefined; publish();
  try {
    const page = await pageDocument();
    ai.sourceUrl = page.url;
    if (question) ai.answer = await provider.answer(page, question);
    else ai.summary = await provider.summarize(page);
  } catch (cause) { ai.error = cause instanceof Error ? cause.message : String(cause); }
  finally { ai.busy = false; publish(); }
}
function toggleBookmark(): void {
  const tab = active(); if (!tab?.url) return;
  const index = state.bookmarks.findIndex(entry => entry.url === tab.url);
  if (index >= 0) state.bookmarks.splice(index, 1);
  else state.bookmarks.unshift({ id: randomUUID(), url: tab.url, title: tab.title, time: Date.now() });
  persist(); publish();
}
function authorize(event: IpcMainInvokeEvent): void {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== chromeURL) throw new Error('Untrusted browser command.');
}
async function dispatch(command: Command): Promise<void> {
  const wc = contents();
  switch (command.type) {
    case 'unlock-vault': {
      if (unlockingVault) throw new Error('A vault unlock is already in progress.');
      unlockingVault = true;
      try { await vault.unlock(command.passphrase); } finally { unlockingVault = false; }
      const merge = (saved: Entry[], current: Entry[]) => [...new Map([...saved, ...current].map(entry => [entry.id, entry])).values()].sort((a, b) => b.time - a.time);
      state.bookmarks = merge(vault.get<Entry[]>('bookmarks', []), state.bookmarks);
      state.history = merge(vault.get<Entry[]>('history', []), state.history).slice(0, 2000);
      state.backgroundLimit = vault.get('background-limit', state.backgroundLimit);
      state.sidebarCollapsed = vault.get('sidebar-collapsed', state.sidebarCollapsed ?? false);
      state.theme = vault.get('theme', state.theme); nativeTheme.themeSource = state.theme;
      state.accent = vault.get('accent', state.accent ?? '#e5231b');
      state.boosts = [...new Map([...(state.boosts ?? []), ...vault.get<Boost[]>('boosts', [])].map(boost => [boost.domain, boost])).values()];
      const savedExtensions = vault.get<ExtensionRegistration[]>('extensions', []);
      state.extensions ??= [];
      for (const extension of savedExtensions) if (!state.extensions.some(item => item.id === extension.id)) state.extensions.push({ ...extension, enabled: false, error: extension.enabled ? 'Review and enable this extension after unlocking.' : extension.error });
      const savedWorkspaces = restoreWorkspaces(vault.get('workspaces', []));
      state.workspaces = [...new Map([...state.workspaces, ...savedWorkspaces].map(workspace => [workspace.id, workspace])).values()];
      for (const tab of restoreSavedTabs(vault.get('session', []), state.workspaces)) {
        if (!state.tabs.some(existing => existing.id === tab.id)) state.tabs.push(tab);
      }
      state.storage = vault.mode; state.storageMessage = vault.message; state.vaultLocked = vault.locked;
      persist(); break;
    }
    case 'navigate': {
      const tab = active(); if (!tab) return;
      const url = resolveAddress(command.url);
      if (!url) break;
      state.panel = 'none';
      if (url) {
        const view = views.get(tab.id) ?? createView(tab);
        void view.webContents.loadURL(url).catch(() => {});
        view.webContents.focus();
      }
      layout(); persist(); break;
    }
    case 'new-tab': newTab(resolveAddress(command.url ?? '')); if (!command.url) shortcut('address'); break;
    case 'create-workspace': {
      if (state.workspaces.some(workspace => workspace.name.toLocaleLowerCase() === command.name.toLocaleLowerCase())) throw new Error('A workspace with this name already exists.');
      const workspace = { id: randomUUID(), name: command.name };
      state.workspaces.push(workspace); switchWorkspace(workspace.id); break;
    }
    case 'rename-workspace': {
      const workspace = state.workspaces.find(workspace => workspace.id === command.id);
      if (!workspace) throw new Error('This workspace no longer exists.');
      if (state.workspaces.some(other => other.id !== command.id && other.name.toLocaleLowerCase() === command.name.toLocaleLowerCase())) throw new Error('A workspace with this name already exists.');
      workspace.name = command.name; persist(); break;
    }
    case 'switch-workspace': switchWorkspace(command.id); break;
    case 'activate-tab': activateTab(command.id); break;
    case 'move-tab': state.tabs = moveTab(state.tabs, command.id, command.index); persist(); break;
    case 'split-tab': enterSplit(command.id); break;
    case 'toggle-split': {
      if (state.split) { state.split = undefined; layout(); contents()?.focus(); }
      else {
        const partner = state.tabs.find(tab => tab.id !== state.activeId && tab.workspaceId === state.activeWorkspaceId && tab.url && !tab.error);
        if (!partner) throw new Error('Open a second page in this workspace to use split view.');
        enterSplit(partner.id);
      }
      break;
    }
    case 'close-tab': await closeTab(command.id); break;
    case 'back': if (!active()?.restoring && wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); break;
    case 'forward': if (!active()?.restoring && wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); break;
    case 'reload': {
      const tab = active();
      if (tab?.error && tab.url) {
        void (wc ?? createView(tab).webContents).loadURL(tab.url).catch(() => {});
      } else wc?.reload();
      layout(); break;
    }
    case 'stop': wc?.stop(); break;
    case 'background-limit': state.backgroundLimit = command.value; persist(); hibernator.schedule(); break;
    case 'toggle-sidebar': state.sidebarCollapsed = !state.sidebarCollapsed; layout(); persist(); break;
    case 'bookmark': toggleBookmark(); break;
    case 'remove-bookmark': state.bookmarks = state.bookmarks.filter(item => item.id !== command.id); persist(); break;
    case 'clear-history': state.history = []; persist(); break;
    case 'theme': state.theme = command.value; nativeTheme.themeSource = command.value; persist(); break;
    case 'accent': state.accent = command.value; persist(); break;
    case 'load-extension': await chooseExtension(); break;
    case 'toggle-extension': {
      const extension = state.extensions?.find(item => item.id === command.id);
      if (!extension) break;
      const hadEnabled = state.extensions?.some(item => item.enabled) ?? false;
      const confirm = await dialog.showMessageBox(win, { type: 'question', title: 'Change extension state?', message: `${extension.enabled ? 'Disable' : 'Enable'} ${extension.name}?`, detail: 'Open pages will reload. If this changes the browser session mode, current site logins are cleared.', buttons: ['Cancel', extension.enabled ? 'Disable' : 'Enable'], defaultId: 0, cancelId: 0, noLink: true });
      if (confirm.response !== 1) break;
      extension.enabled = !extension.enabled; extension.error = undefined;
      const hasEnabled = state.extensions?.some(item => item.enabled) ?? false;
      if (hadEnabled !== hasEnabled) migratePageSessions();
      else { for (const context of disposableSessions.all()) await applyExtensions(context); for (const view of views.values()) if (!view.webContents.isDestroyed()) view.webContents.reload(); }
      persist(); break;
    }
    case 'remove-extension': {
      const extension = state.extensions?.find(item => item.id === command.id);
      if (!extension) break;
      const confirm = await dialog.showMessageBox(win, { type: 'question', title: 'Remove extension?', message: `Remove ${extension.name}?`, detail: extension.enabled ? 'Open pages will reload. Removing the last enabled extension clears its disposable site session.' : 'The local extension folder will not be deleted.', buttons: ['Cancel', 'Remove'], defaultId: 0, cancelId: 0, noLink: true });
      if (confirm.response !== 1) break;
      const hadEnabled = state.extensions?.some(item => item.enabled) ?? false;
      extension.enabled = false;
      for (const context of disposableSessions.all()) await applyExtensions(context);
      state.extensions = state.extensions?.filter(item => item.id !== command.id) ?? [];
      const hasEnabled = state.extensions.some(item => item.enabled);
      if (hadEnabled !== hasEnabled) migratePageSessions();
      persist(); break;
    }
    case 'save-boost': {
      const tab = active();
      let domain = '';
      try { domain = tab?.url ? new URL(tab.url).hostname.toLowerCase() : ''; } catch { /* handled below */ }
      if (!domain || command.domain.toLowerCase() !== domain) throw new Error('Site customizations can only change the active domain.');
      state.boosts ??= [];
      const boost = state.boosts.find(item => item.domain === domain);
      if (boost) Object.assign(boost, { css: command.css, js: command.js, enabled: command.enabled, error: undefined });
      else state.boosts.push({ domain, css: command.css, js: command.js, enabled: command.enabled });
      persist(); wc?.reload(); break;
    }
    case 'remove-boost': {
      const tab = active();
      let domain = '';
      try { domain = tab?.url ? new URL(tab.url).hostname.toLowerCase() : ''; } catch { /* handled below */ }
      if (!domain || command.domain.toLowerCase() !== domain) throw new Error('Site customizations can only change the active domain.');
      state.boosts = state.boosts?.filter(item => item.domain !== domain) ?? [];
      persist(); wc?.reload(); break;
    }
    case 'toggle-ai': state.ai!.open = !state.ai!.open; layout(); break;
    case 'ai-summarize': await runAI(); break;
    case 'ai-ask': await runAI(command.question); break;
    case 'close-peek': closePeek(); break;
    case 'open-peek': { const url = state.peek?.url; closePeek(); if (url) newTab(url); break; }
    case 'panel': state.panel = command.value; layout(); if (command.value === 'none') contents()?.focus(); break;
  }
  publish();
}
app.whenReady().then(async () => {
  if (!primaryInstance) return;
  vault = new Vault(join(app.getPath('userData'), 'vault'), { useKeychain: !testProfile });
  const localModel = modelProviders.get('local-extractive')!;
  state = { tabs: [], activeId: '', bookmarks: vault.get<Entry[]>('bookmarks', []), history: vault.get<Entry[]>('history', []), storage: vault.mode, storageMessage: vault.message, vaultLocked: vault.locked, theme: vault.get('theme', 'system'), accent: vault.get('accent', '#e5231b'), panel: 'none', backgroundLimit: vault.get('background-limit', 6), workspaces: restoreWorkspaces(vault.get('workspaces', [])), activeWorkspaceId: DEFAULT_WORKSPACE.id, extensions: vault.get<ExtensionRegistration[]>('extensions', []), extensionsAvailable: RamSessions.supported(), boosts: vault.get<Boost[]>('boosts', []), ai: { open: false, busy: false, provider: localModel.id, disclosure: localModel.disclosure } };
  const savedActiveWorkspace = vault.get('active-workspace', state.workspaces[0].id);
  state.sidebarCollapsed = vault.get('sidebar-collapsed', false);
  state.activeWorkspaceId = state.workspaces.some(workspace => workspace.id === savedActiveWorkspace) ? savedActiveWorkspace : state.workspaces[0].id;
  nativeTheme.themeSource = state.theme;
  win = new BrowserWindow({ width: 1280, height: 840, minWidth: 760, minHeight: 520, title: 'Astra', backgroundColor: '#000000', show: false, autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false, webviewTag: false, partition: 'astra-chrome' },
  });
  Menu.setApplicationMenu(null);
  hibernator = new Hibernator(() => state, views, view => { if (!win.isDestroyed()) win.contentView.removeChildView(view); }, () => {
    if (!quitting && active()?.suspended && !views.has(state.activeId)) activateTab(state.activeId);
    layout(); publish();
  }, id => closingWindow || closingTabs.has(id) || splitContains(id));
  metricsTimer = setInterval(() => {
    const metrics = new Map(app.getAppMetrics().map(metric => [metric.pid, metric]));
    for (const tab of state.tabs) {
      const wc = views.get(tab.id)?.webContents;
      tab.rendererPid = wc && !wc.isDestroyed() ? wc.getOSProcessId() : undefined;
      const metric = tab.rendererPid ? metrics.get(tab.rendererPid) : undefined;
      tab.rendererMemoryMB = metric ? Math.round(metric.memory.workingSetSize / 1024) : undefined;
    }
    hibernator.schedule(); publish();
  }, 5000);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  bindKeys(win.webContents);
  pageSession(DEFAULT_WORKSPACE.id);
  ipcMain.handle('astra:snapshot', event => { authorize(event); return state; });
  ipcMain.handle('astra:command', async (event, command) => { authorize(event); await dispatch(validateCommand(command)); });
  win.on('resize', layout);
  win.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    if (closingWindow) return;
    closingWindow = true;
    void (async () => {
      for (const [id, view] of views) {
        if (!await requestPageClose(view.webContents, win)) {
          closingWindow = false; activateTab(state.activeId); return;
        }
        win.contentView.removeChildView(view); views.delete(id);
        const tab = state.tabs.find(tab => tab.id === id); if (tab) tab.suspended = true;
      }
      persist(); quitting = true; hibernator.stop(); win.destroy();
    })().catch(() => { closingWindow = false; activateTab(state.activeId); });
  });
  const saved = restoreSavedTabs(vault.get('session', []), state.workspaces);
  // Saved pages restore on explicit activation; startup makes no website requests.
  newTab();
  state.tabs.push(...saved);
  persist();
  await win.loadURL(chromeURL);
  win.show();
  for (const url of [...process.argv.filter(isWebURL), ...pendingURLs]) newTab(url);
  pendingURLs.length = 0;
  if (!app.isPackaged && process.env.ASTRA_SMOKE_URL) await dispatch({ type: 'navigate', url: process.env.ASTRA_SMOKE_URL });
}).catch(error => { console.error('Astra startup failed:', error); app.exit(1); });
app.on('second-instance', (_event, argv) => {
  if (!win || win.isDestroyed()) { pendingURLs.push(...argv.filter(isWebURL)); return; }
  if (win.isMinimized()) win.restore(); win.focus();
  for (const url of argv.filter(isWebURL)) newTab(url);
});
app.on('open-url', (event, url) => {
  event.preventDefault(); if (!isWebURL(url)) return;
  if (win && !win.isDestroyed() && state) newTab(url); else pendingURLs.push(url);
});
app.on('before-quit', event => { if (!quitting && win && !win.isDestroyed()) { event.preventDefault(); win.close(); } });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { if (publishTimer) clearTimeout(publishTimer); if (metricsTimer) clearInterval(metricsTimer); hibernator?.stop(); vault?.close(); disposableSessions.dispose(); });
