import { dialog } from 'electron';
import type { BrowserWindow, WebContents } from 'electron';

/** User-requested close. Automatic hibernation never calls this confirmation path. */
export function requestPageClose(contents: WebContents, window: BrowserWindow): Promise<boolean> {
  if (contents.isDestroyed()) return Promise.resolve(true);
  return new Promise(resolve => {
    const finish = (closed: boolean) => {
      clearTimeout(timer);
      contents.removeListener('destroyed', destroyed);
      contents.removeListener('will-prevent-unload', prevented);
      resolve(closed);
    };
    const destroyed = () => finish(true);
    const prevented = (event: Electron.Event) => {
      const answer = dialog.showMessageBoxSync(window, {
        type: 'question', title: 'Leave this page?',
        message: 'This page asked to stay open.',
        detail: 'Leaving may discard unsaved changes.',
        buttons: ['Stay', 'Leave page'], defaultId: 0, cancelId: 0, noLink: true,
      });
      if (answer === 1) event.preventDefault();
      else finish(false);
    };
    const timer = setTimeout(() => finish(false), 10000);
    contents.once('destroyed', destroyed); contents.once('will-prevent-unload', prevented);
    contents.close({ waitForBeforeUnload: true });
  });
}
