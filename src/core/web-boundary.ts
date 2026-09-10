// SPDX-License-Identifier: MPL-2.0
import type { Session, WebPreferences } from 'electron';

/**
 * Web content is the untrusted side of Astra's web-platform boundary.
 *
 * Keep this policy free of a preload script: browser features belong in chrome,
 * not on website globals. A site must observe the same platform surface it would
 * in upstream Chromium.
 */
export const UNTRUSTED_PAGE_PREFERENCES = Object.freeze({
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  spellcheck: false,
  navigateOnDragDrop: false,
  safeDialogs: true,
  webviewTag: false,
} satisfies WebPreferences);

export function pageWebPreferences(context: Session): WebPreferences {
  return { ...UNTRUSTED_PAGE_PREFERENCES, session: context };
}
