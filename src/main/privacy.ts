import type { Session } from 'electron';
import { getDomain } from 'tldts';
import type { Tab } from '../shared/types';

// A deliberately small, locally bundled seed list. No remote list fetches.
export const TRACKERS = new Set([
  'doubleclick.net', 'google-analytics.com', 'googlesyndication.com',
  'googleadservices.com', 'adservice.google.com', 'connect.facebook.net',
  'analytics.tiktok.com', 'ads.twitter.com', 'ads.linkedin.com',
  'scorecardresearch.com', 'quantserve.com', 'hotjar.com', 'hotjar.io',
  'clarity.ms', 'mouseflow.com', 'fullstory.com', 'segment.io',
  'api.segment.io', 'mixpanel.com', 'amplitude.com', 'adsrvr.org',
  'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com',
]);
export function isTracker(raw: string): boolean {
  try {
    let host = new URL(raw).hostname.toLowerCase();
    while (host.includes('.')) {
      if (TRACKERS.has(host)) return true;
      host = host.slice(host.indexOf('.') + 1);
    }
  } catch { /* Non-URL requests do not match hosts. */ }
  return false;
}
export function isThirdParty(request: string, top: string): boolean {
  try {
    const a = new URL(request), b = new URL(top);
    const site = (host: string) => getDomain(host, { allowPrivateDomains: true }) ?? host;
    return a.protocol !== b.protocol || site(a.hostname) !== site(b.hostname);
  } catch { return true; }
}
export function installPrivacy(ses: Session, getTab: (id: number) => Tab | undefined, changed: () => void): void {
  ses.setPermissionCheckHandler(() => false);
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ses.setDevicePermissionHandler(() => false);
  ses.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  ses.webRequest.onBeforeRequest((details, callback) => {
    const tab = getTab(details.webContentsId ?? -1);
    if (tab) tab.requests++;
    const blocked = isTracker(details.url);
    if (tab && blocked) tab.blocked++;
    callback({ cancel: blocked });
    changed();
  });
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const tab = getTab(details.webContentsId ?? -1);
    const headers = { ...details.requestHeaders };
    if (details.resourceType !== 'mainFrame' && isThirdParty(details.url, tab?.url ?? '')) {
      for (const name of Object.keys(headers)) if (name.toLowerCase() === 'cookie') {
        delete headers[name]; if (tab) tab.cookiesBlocked++;
      }
    }
    headers['Sec-GPC'] = '1';
    callback({ requestHeaders: headers });
  });
  ses.webRequest.onHeadersReceived((details, callback) => {
    const tab = getTab(details.webContentsId ?? -1);
    const headers = { ...details.responseHeaders };
    if (details.resourceType !== 'mainFrame' && isThirdParty(details.url, tab?.url ?? '')) {
      for (const name of Object.keys(headers)) if (name.toLowerCase() === 'set-cookie') {
        if (tab) tab.cookiesBlocked += headers[name].length;
        delete headers[name];
      }
    }
    callback({ responseHeaders: headers });
  });
}
