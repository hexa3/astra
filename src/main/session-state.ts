import { randomUUID } from 'node:crypto';
import type { Tab, Workspace } from '../shared/types';
import { isWebURL } from '../shared/navigation';

export function createTab(url: string, title: string, workspaceId: string, id: string = randomUUID()): Tab {
  return { id, url, title, workspaceId, loading: false, canBack: false, canForward: false, requests: 0, blocked: 0, cookiesBlocked: 0, lastActiveAt: Date.now() };
}

export function restoreSavedTabs(raw: unknown, workspaces: Workspace[]): Tab[] {
  if (!Array.isArray(raw)) return [];
  const available = new Set(workspaces.map(workspace => workspace.id));
  const usedIds = new Set<string>();
  const tabs: Tab[] = [];
  for (const item of raw) {
    if (!item || typeof item.url !== 'string' || !isWebURL(item.url) || typeof item.title !== 'string') continue;
    let id = typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(item.id) ? item.id : randomUUID();
    if (usedIds.has(id)) id = randomUUID();
    usedIds.add(id);
    const workspaceId = available.has(item.workspaceId) ? item.workspaceId : workspaces[0].id;
    tabs.push({ ...createTab(item.url, item.title.slice(0, 500), workspaceId, id), suspended: true });
  }
  return tabs;
}
