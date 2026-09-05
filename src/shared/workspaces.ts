import type { Workspace } from './types';
export const DEFAULT_WORKSPACE: Workspace = { id: 'personal', name: 'Personal' };

export function workspaceName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Use a workspace name between 1 and 60 characters.');
  return name;
}

export function restoreWorkspaces(raw: unknown): Workspace[] {
  if (!Array.isArray(raw)) return [{ ...DEFAULT_WORKSPACE }];
  const restored = new Map<string, Workspace>();
  for (const item of raw) {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || typeof item.name !== 'string') continue;
    try { restored.set(item.id, { id: item.id, name: workspaceName(item.name) }); } catch { /* Ignore malformed individual records. */ }
  }
  return restored.size ? [...restored.values()] : [{ ...DEFAULT_WORKSPACE }];
}

export function workspacePartition(id: string): string {
  return id === DEFAULT_WORKSPACE.id ? 'astra-pages' : `astra-pages:${id}`;
}
