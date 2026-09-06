export interface Tab {
  id: string; url: string; title: string; loading: boolean;
  workspaceId?: string;
  canBack: boolean; canForward: boolean; error?: string;
  requests: number; blocked: number; cookiesBlocked: number;
  suspended?: boolean; suspensionReason?: string; lastActiveAt?: number;
  restoring?: boolean;
  rendererMemoryMB?: number; rendererPid?: number;
}
export interface Entry { id: string; url: string; title: string; time: number }
export interface Workspace { id: string; name: string; lastActiveTabId?: string }
export interface BrowserState {
  tabs: Tab[]; activeId: string; bookmarks: Entry[]; history: Entry[];
  storage: 'encrypted' | 'memory'; storageMessage: string; vaultLocked: boolean;
  backgroundLimit: number;
  sidebarCollapsed?: boolean;
  split?: { leftId: string; rightId: string };
  workspaces: Workspace[]; activeWorkspaceId: string;
  theme: 'system' | 'dark' | 'light'; panel: 'none' | 'bookmarks' | 'history' | 'privacy' | 'storage' | 'workspaces' | 'commands';
}
export type Command =
  | { type: 'navigate'; url: string }
  | { type: 'new-tab'; url?: string }
  | { type: 'activate-tab' | 'close-tab' | 'split-tab'; id: string }
  | { type: 'move-tab'; id: string; index: number }
  | { type: 'back' | 'forward' | 'reload' | 'stop' | 'bookmark' | 'clear-history' | 'toggle-sidebar' | 'toggle-split' }
  | { type: 'remove-bookmark'; id: string }
  | { type: 'unlock-vault'; passphrase: string }
  | { type: 'background-limit'; value: number }
  | { type: 'create-workspace'; name: string }
  | { type: 'rename-workspace'; id: string; name: string }
  | { type: 'switch-workspace'; id: string }
  | { type: 'theme'; value: BrowserState['theme'] }
  | { type: 'panel'; value: BrowserState['panel'] };
export interface AstraAPI {
  snapshot(): Promise<BrowserState>;
  command(command: Command): Promise<void>;
  onState(callback: (state: BrowserState) => void): () => void;
  onShortcut(callback: (shortcut: string) => void): () => void;
}
