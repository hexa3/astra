// SPDX-License-Identifier: MPL-2.0

/** Stable shell-to-core API. Breaking changes require a new major channel. */
export const CORE_API_VERSION = '2.0' as const;

export type ShellVariant = 'default' | 'minimal';
export interface ShellInsets { top: number; right: number; bottom: number; left: number }

export interface CoreCapabilities {
  apiVersion: typeof CORE_API_VERSION;
  shell: ShellVariant;
  commands: readonly Command['type'][];
}

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
export interface ExtensionRegistration {
  id: string; directory: string; name: string; version: string;
  permissions: string[]; hosts: string[]; enabled: boolean; error?: string;
}
export interface Boost { domain: string; css: string; js: string; enabled: boolean; error?: string }
export interface AIState { open: boolean; busy: boolean; provider: string; disclosure: string; sourceUrl?: string; summary?: string; answer?: string; error?: string }
export interface SyncState { configured: boolean; busy: boolean; endpoint?: string; realm?: string; device?: string; lastSync?: number; message?: string }
export interface BrowserState {
  tabs: Tab[]; activeId: string; bookmarks: Entry[]; history: Entry[];
  storage: 'encrypted' | 'memory'; storageMessage: string; vaultLocked: boolean;
  backgroundLimit: number;
  sidebarCollapsed?: boolean;
  split?: { leftId: string; rightId: string };
  workspaces: Workspace[]; activeWorkspaceId: string;
  extensions?: ExtensionRegistration[]; extensionsAvailable?: boolean;
  boosts?: Boost[];
  ai?: AIState;
  sync?: SyncState;
  peek?: { url: string; title: string; loading: boolean };
  theme: 'system' | 'dark' | 'light'; panel: 'none' | 'bookmarks' | 'history' | 'privacy' | 'storage' | 'workspaces' | 'commands' | 'extensions' | 'boosts';
  accent?: string;
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
  | { type: 'accent'; value: string }
  | { type: 'configure-shell'; insets: ShellInsets }
  | { type: 'load-extension' }
  | { type: 'toggle-extension' | 'remove-extension'; id: string }
  | { type: 'save-boost'; domain: string; css: string; js: string; enabled: boolean }
  | { type: 'remove-boost'; domain: string }
  | { type: 'toggle-ai' | 'ai-summarize' }
  | { type: 'close-peek' | 'open-peek' }
  | { type: 'ai-ask'; question: string }
  | { type: 'configure-sync'; endpoint: string; realm?: string; device: string; passphrase: string }
  | { type: 'sync-now'; passphrase: string }
  | { type: 'disable-sync' }
  | { type: 'panel'; value: BrowserState['panel'] };

export const CORE_COMMAND_TYPES = [
  'navigate', 'new-tab', 'activate-tab', 'close-tab', 'split-tab', 'move-tab',
  'back', 'forward', 'reload', 'stop', 'bookmark', 'clear-history',
  'toggle-sidebar', 'toggle-split', 'remove-bookmark', 'unlock-vault',
  'background-limit', 'create-workspace', 'rename-workspace', 'switch-workspace',
  'theme', 'accent', 'configure-shell', 'load-extension', 'toggle-extension', 'remove-extension',
  'save-boost', 'remove-boost', 'toggle-ai', 'ai-summarize', 'close-peek',
  'open-peek', 'ai-ask', 'panel',
  'configure-sync', 'sync-now', 'disable-sync',
] as const satisfies readonly Command['type'][];

export interface CoreAPI {
  readonly version: typeof CORE_API_VERSION;
  capabilities(): Promise<CoreCapabilities>;
  snapshot(): Promise<BrowserState>;
  command(command: Command): Promise<void>;
  onState(callback: (state: BrowserState) => void): () => void;
  onShortcut(callback: (shortcut: string) => void): () => void;
}
