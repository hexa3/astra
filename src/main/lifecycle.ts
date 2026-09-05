import { dialog } from 'electron';
import type { BrowserWindow, WebContents } from 'electron';

const closingPages = new WeakSet<WebContents>();

function confirmLeave(window: BrowserWindow): boolean {
  return dialog.showMessageBoxSync(window, {
    type: 'question', title: 'Leave this page?',
    message: 'This page asked to stay open.',
    detail: 'Leaving may discard unsaved changes.',
    buttons: ['Stay', 'Leave page'], defaultId: 0, cancelId: 0, noLink: true,
  }) === 1;
}

/** Handles reload, history, links and address navigation; close has its own path. */
export function installNavigationConfirmation(contents: WebContents, window: BrowserWindow, suppress: () => boolean): void {
  contents.on('will-prevent-unload', event => {
    if (closingPages.has(contents) || suppress()) return;
    if (confirmLeave(window)) event.preventDefault();
  });
}

/** User-requested close. Automatic hibernation never calls this confirmation path. */
export function requestPageClose(contents: WebContents | undefined, window: BrowserWindow): Promise<boolean> {
  if (!contents || contents.isDestroyed()) return Promise.resolve(true);
  closingPages.add(contents);
  return new Promise(resolve => {
    const finish = (closed: boolean) => {
      clearTimeout(timer);
      contents.removeListener('destroyed', destroyed);
      contents.removeListener('will-prevent-unload', prevented);
      closingPages.delete(contents);
      resolve(closed);
    };
    const destroyed = () => finish(true);
    const prevented = (event: Electron.Event) => {
      if (confirmLeave(window)) event.preventDefault();
      else finish(false);
    };
    const timer = setTimeout(() => finish(false), 10000);
    contents.once('destroyed', destroyed); contents.once('will-prevent-unload', prevented);
    contents.close({ waitForBeforeUnload: true });
  });
}
