import type { NavigationEntry, WebContentsView } from 'electron';
import type { BrowserState, Tab } from '../shared/types';

interface SleepingPage { entries: NavigationEntry[]; index: number; x: number; y: number }
interface PageActivity { edited: boolean; x: number; y: number }
const inspectActivity = `(() => ({
  edited: [...document.querySelectorAll('input,textarea,select')].some(element => {
    if (element instanceof HTMLInputElement) return ['checkbox','radio'].includes(element.type)
      ? element.checked !== element.defaultChecked : element.value !== element.defaultValue;
    if (element instanceof HTMLTextAreaElement) return element.value !== element.defaultValue;
    return [...element.options].some(option => option.selected !== option.defaultSelected);
  }) || [...document.querySelectorAll('[contenteditable]')].some(element => element.textContent.trim()),
  x: scrollX, y: scrollY
}))()`;

export class Hibernator {
  private sleeping = new Map<string, SleepingPage>();
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private stopped = false;
  private suspending = new Set<string>();
  constructor(private state: () => BrowserState, private views: Map<string, WebContentsView>, private detach: (view: WebContentsView) => void, private changed: () => void, private protectedTab: (id: string) => boolean = () => false) {}
  schedule(): void {
    if (this.stopped || this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.enforce(); }, 300);
  }
  isSuspending(id: string): boolean { return this.suspending.has(id); }
  private async enforce(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const background = () => this.state().tabs.filter(tab => tab.id !== this.state().activeId && !this.protectedTab(tab.id) && this.views.has(tab.id));
      const candidates = background().sort((a, b) => (a.lastActiveAt ?? 0) - (b.lastActiveAt ?? 0));
      for (const tab of candidates) {
        if (background().length <= this.state().backgroundLimit || this.stopped) break;
        await this.suspend(tab);
      }
    } finally { this.running = false; this.changed(); }
  }
  private async suspend(tab: Tab): Promise<void> {
    const view = this.views.get(tab.id), wc = view?.webContents;
    if (!view || !wc || wc.isDestroyed() || wc.isLoading()) return;
    if (wc.isCurrentlyAudible()) { tab.suspensionReason = 'Playing audio'; return; }
    try {
      let inspectionTimer: ReturnType<typeof setTimeout> | undefined;
      const activities = await Promise.race([
        Promise.all(wc.mainFrame.framesInSubtree.map(frame => frame.executeJavaScript(inspectActivity) as Promise<PageActivity>)),
        new Promise<never>((_resolve, reject) => { inspectionTimer = setTimeout(() => reject(new Error('Page inspection timed out')), 2000); }),
      ]).finally(() => clearTimeout(inspectionTimer));
      const activity = activities[0];
      if (!activity || activities.some(activity => activity.edited)) { tab.suspensionReason = 'Unsaved form or editable content'; return; }
      if (this.stopped || tab.id === this.state().activeId || this.protectedTab(tab.id) || wc.isDestroyed()) return;
      const saved: SleepingPage = { entries: wc.navigationHistory.getAllEntries(), index: wc.navigationHistory.getActiveIndex(), x: activity.x, y: activity.y };
      await new Promise<void>(resolve => {
        const done = () => { this.suspending.delete(tab.id); clearTimeout(timeout); wc.removeListener('destroyed', destroyed); wc.removeListener('will-prevent-unload', prevented); resolve(); };
        const destroyed = () => {
          if (this.views.get(tab.id) === view) {
            this.views.delete(tab.id); this.detach(view);
            this.sleeping.set(tab.id, saved);
            tab.suspended = true; tab.suspensionReason = undefined;
            tab.rendererMemoryMB = undefined; tab.rendererPid = undefined;
          }
          done();
        };
        const prevented = () => { tab.suspensionReason = 'Page requested to stay open'; done(); };
        const timeout = setTimeout(done, 2000);
        wc.once('destroyed', destroyed); wc.once('will-prevent-unload', prevented);
        this.suspending.add(tab.id);
        wc.close({ waitForBeforeUnload: true });
      });
    } catch { tab.suspensionReason = 'Page activity could not be checked'; }
  }
  async restore(tab: Tab, view: WebContentsView): Promise<void> {
    const saved = this.sleeping.get(tab.id);
    this.sleeping.delete(tab.id); tab.suspended = false; tab.suspensionReason = undefined;
    tab.restoring = true; tab.loading = true; tab.canBack = false; tab.canForward = false;
    const contents = view.webContents;
    try {
      if (saved?.entries.length) {
        await contents.navigationHistory.restore({ entries: saved.entries, index: saved.index });
        if (!contents.isDestroyed()) await contents.executeJavaScript(`scrollTo(${Math.round(saved.x)},${Math.round(saved.y)})`);
      } else await contents.loadURL(tab.url);
    } finally {
      tab.restoring = false;
      if (!contents.isDestroyed()) {
        tab.loading = contents.isLoading();
        tab.canBack = contents.navigationHistory.canGoBack(); tab.canForward = contents.navigationHistory.canGoForward();
      }
      this.changed();
    }
  }
  forget(id: string): void { this.sleeping.delete(id); }
  stop(): void { this.stopped = true; if (this.timer) clearTimeout(this.timer); }
}
