import type { BrowserState, Command } from './types';
import { resolveAddress } from './navigation';

export interface SearchResult {
  id: string; label: string; detail: string;
  kind: 'tab' | 'workspace' | 'bookmark' | 'history' | 'command' | 'navigate';
  command: Command;
  keywords?: string;
}

const normalize = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
export function fuzzyScore(query: string, candidate: string): number {
  const needle = normalize(query.trim()), haystack = normalize(candidate);
  if (!needle) return 0;
  if (needle === haystack) return 1000;
  const substring = haystack.indexOf(needle);
  if (substring >= 0) return 700 - Math.min(substring, 100) - Math.min(haystack.length - needle.length, 100);
  let position = 0, score = 0, previous = -2;
  for (const letter of needle) {
    const index = haystack.indexOf(letter, position);
    if (index < 0) return -Infinity;
    score += index === previous + 1 ? 15 : 1;
    if (index === 0 || /[\s/._-]/.test(haystack[index - 1])) score += 8;
    score -= Math.min(index - position, 20);
    previous = index; position = index + 1;
  }
  return score;
}

export function searchBrowser(state: BrowserState, query: string, limit = 30): SearchResult[] {
  const workspace = (id: string | undefined) => state.workspaces.find(workspace => workspace.id === id)?.name ?? 'Personal';
  const active = state.tabs.find(tab => tab.id === state.activeId);
  const partners = active?.url && !active.error ? state.tabs.filter(tab => tab.id !== active.id && tab.workspaceId === active.workspaceId && tab.url && !tab.error) : [];
  const candidates: SearchResult[] = [
    ...state.tabs.map(tab => ({ id: `tab:${tab.id}`, label: tab.title, detail: `${workspace(tab.workspaceId)} · ${tab.url || 'New tab'}`, kind: 'tab' as const, command: { type: 'activate-tab' as const, id: tab.id } })),
    ...state.workspaces.map(workspace => ({ id: `workspace:${workspace.id}`, label: workspace.name, detail: 'Switch workspace', kind: 'workspace' as const, command: { type: 'switch-workspace' as const, id: workspace.id } })),
    ...state.bookmarks.map(entry => ({ id: `bookmark:${entry.id}`, label: entry.title, detail: entry.url, kind: 'bookmark' as const, command: { type: 'navigate' as const, url: entry.url } })),
    ...state.history.map(entry => ({ id: `history:${entry.id}`, label: entry.title, detail: entry.url, kind: 'history' as const, command: { type: 'navigate' as const, url: entry.url } })),
    { id: 'new-tab', label: 'New tab', detail: 'Ctrl/Cmd+T', kind: 'command', command: { type: 'new-tab' } },
    { id: 'sidebar', label: state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar', detail: 'Ctrl/Cmd+B', keywords: 'toggle sidebar', kind: 'command', command: { type: 'toggle-sidebar' } },
    ...(state.split ? [{ id: 'split:exit', label: 'Exit split view', detail: 'Keep the focused page open', kind: 'command' as const, command: { type: 'toggle-split' as const } }] : []),
    ...partners.map(tab => ({ id: `split:${tab.id}`, label: `Split with ${tab.title}`, detail: tab.url, kind: 'command' as const, command: { type: 'split-tab' as const, id: tab.id } })),
    { id: 'workspaces', label: 'Create or manage workspaces', detail: 'Separate tabs and site logins', keywords: 'new space spaces workspace', kind: 'command', command: { type: 'panel', value: 'workspaces' } },
    { id: 'history', label: 'Browsing history', detail: 'Your local record of visited pages', kind: 'command', command: { type: 'panel', value: 'history' } },
    { id: 'bookmarks', label: 'Bookmarks', detail: 'Your saved pages', kind: 'command', command: { type: 'panel', value: 'bookmarks' } },
    { id: 'privacy', label: 'Behind the page', detail: 'Privacy, memory and background pages', keywords: 'resource trackers permissions', kind: 'command', command: { type: 'panel', value: 'privacy' } },
    { id: 'storage', label: 'Encrypted storage', detail: 'Create or unlock your local vault', keywords: 'password passphrase', kind: 'command', command: { type: 'panel', value: 'storage' } },
    ...(['dark', 'light', 'system'] as const).map(theme => ({ id: `theme:${theme}`, label: `${theme[0].toUpperCase()}${theme.slice(1)} theme`, detail: 'Change browser appearance', kind: 'command' as const, command: { type: 'theme' as const, value: theme } })),
  ];
  const weights = { tab: 40, workspace: 30, bookmark: 20, history: 0, command: 10, navigate: -10 };
  const seenHistory = new Set<string>();
  const ranked = candidates.filter(candidate => {
    if (candidate.kind !== 'history') return true;
    if (seenHistory.has(candidate.detail)) return false;
    seenHistory.add(candidate.detail); return true;
  }).map(candidate => ({ candidate, score: Math.max(fuzzyScore(query, candidate.label), fuzzyScore(query, `${candidate.label} ${candidate.detail} ${candidate.keywords ?? ''}`) - 30) + weights[candidate.kind] }))
    .filter(result => Number.isFinite(result.score)).sort((a, b) => b.score - a.score).slice(0, limit).map(result => result.candidate);
  if (query.trim()) {
    try {
      const url = resolveAddress(query);
      if (url) ranked.push({ id: 'navigate', label: url.startsWith('https://duckduckgo.com/?q=') ? `Search the web for “${query.trim()}”` : `Open ${url}`, detail: url.startsWith('https://duckduckgo.com/?q=') ? 'DuckDuckGo · sends your query only when selected' : 'Navigate to this address', kind: 'navigate', command: { type: 'navigate', url } });
    } catch { /* Privileged schemes must not become navigation actions. */ }
  }
  return ranked;
}
