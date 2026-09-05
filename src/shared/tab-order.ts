import type { Tab } from './types';

/** Reorder within a workspace while preserving every other workspace's slots. */
export function moveTab(tabs: Tab[], id: string, index: number): Tab[] {
  const tab = tabs.find(tab => tab.id === id);
  if (!tab) throw new Error('This tab no longer exists.');
  const siblings = tabs.filter(other => other.workspaceId === tab.workspaceId);
  if (!Number.isInteger(index) || index < 0 || index >= siblings.length) throw new Error('Invalid tab position.');
  const source = siblings.indexOf(tab);
  siblings.splice(source, 1); siblings.splice(index, 0, tab);
  let position = 0;
  return tabs.map(other => other.workspaceId === tab.workspaceId ? siblings[position++] : other);
}
