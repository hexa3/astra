// SPDX-License-Identifier: MPL-2.0
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { parse, stringify } from 'smol-toml';

export const CONFIG_FORMAT_VERSION = 1;
export const CONFIG_FILES = ['settings.toml', 'workspaces.toml', 'extensions.toml'] as const;

export interface SettingsConfig {
  theme: 'system' | 'dark' | 'light';
  accent: string;
  backgroundLimit: number;
  sidebarCollapsed: boolean;
}
export interface WorkspaceDefinition {
  id: string;
  name: string;
  startupPages: string[];
}
export interface SessionDefinition {
  name: string;
  workspaceId: string;
  pages: string[];
}
export interface WorkspacesConfig {
  activeWorkspaceId: string;
  activeSession?: string;
  workspaces: WorkspaceDefinition[];
  sessions: SessionDefinition[];
}
export interface ExtensionDeclaration {
  id: string;
  directory: string;
  enabled: boolean;
}
export interface ExtensionsConfig { extensions: ExtensionDeclaration[] }
export interface PlainConfig {
  settings: SettingsConfig;
  workspaces: WorkspacesConfig;
  extensions: ExtensionsConfig;
  directory: string;
  warnings: string[];
}
export interface ConfigSeeds {
  settings?: SettingsConfig;
  workspaces?: WorkspacesConfig;
  extensions?: ExtensionsConfig;
}

export const DEFAULT_SETTINGS: SettingsConfig = {
  theme: 'system', accent: '#e5231b', backgroundLimit: 6, sidebarCollapsed: false,
};
export const DEFAULT_WORKSPACES: WorkspacesConfig = {
  activeWorkspaceId: 'personal',
  workspaces: [{ id: 'personal', name: 'Personal', startupPages: [] }],
  sessions: [],
};
export const DEFAULT_EXTENSIONS: ExtensionsConfig = { extensions: [] };

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a TOML table.`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, label: string, maximum = 500): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || value.includes('\0')) throw new Error(`${label} must be non-empty text up to ${maximum} characters.`);
  return value.trim();
};
const identifier = (value: unknown, label: string): string => {
  const result = text(value, label, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new Error(`${label} may contain only letters, numbers, underscores, and hyphens.`);
  return result;
};
const list = (value: unknown, label: string): unknown[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1000) throw new Error(`${label} must be an array of at most 1000 entries.`);
  return value;
};

export function safeStartupURL(value: unknown, label = 'startup page'): string {
  const raw = text(value, label, 8192);
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`${label} must be an absolute HTTP(S) URL.`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must use HTTP or HTTPS.`);
  if (url.username || url.password || url.search || url.hash) throw new Error(`${label} cannot contain credentials, a query, or a fragment because config is safe to commit.`);
  return url.href;
}

export function configDirectory(environment: NodeJS.ProcessEnv = process.env, userHome = homedir()): string {
  const override = environment.ASTRA_CONFIG_DIR;
  if (override !== undefined) {
    if (!isAbsolute(override) || override.includes('\0')) throw new Error('ASTRA_CONFIG_DIR must be an absolute path.');
    return resolve(override);
  }
  const xdg = environment.XDG_CONFIG_HOME;
  if (xdg && isAbsolute(xdg) && !xdg.includes('\0')) return join(resolve(xdg), 'astra');
  return join(userHome, '.config', 'astra');
}

export function portableConfigPath(directory: string, userHome = homedir()): string {
  const absolute = resolve(directory);
  const withinHome = relative(userHome, absolute);
  return withinHome && !withinHome.startsWith('..') && !isAbsolute(withinHome)
    ? `$HOME/${withinHome.replaceAll('\\', '/')}`
    : absolute;
}

export function resolveConfigPath(directory: string, userHome = homedir()): string {
  if (directory === '$HOME') return userHome;
  if (directory.startsWith('$HOME/')) return resolve(userHome, directory.slice(6));
  if (!isAbsolute(directory) || directory.includes('\0')) throw new Error('Extension directory must be absolute or begin with $HOME/.');
  return resolve(directory);
}

function parseSettings(raw: unknown): SettingsConfig {
  const value = object(raw, 'settings');
  const theme = value.theme;
  if (typeof theme !== 'string' || !['system', 'dark', 'light'].includes(theme)) throw new Error('theme must be system, dark, or light.');
  if (typeof value.accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.accent)) throw new Error('accent must be a six-digit hexadecimal color.');
  if (!Number.isInteger(value.background_limit) || Number(value.background_limit) < 0 || Number(value.background_limit) > 32) throw new Error('background_limit must be an integer from 0 through 32.');
  if (typeof value.sidebar_collapsed !== 'boolean') throw new Error('sidebar_collapsed must be true or false.');
  return { theme: theme as SettingsConfig['theme'], accent: value.accent.toLowerCase(), backgroundLimit: Number(value.background_limit), sidebarCollapsed: value.sidebar_collapsed };
}

function parseWorkspaces(raw: unknown): WorkspacesConfig {
  const value = object(raw, 'workspaces');
  const workspaces = list(value.workspace, 'workspace').map((item, index) => {
    const workspace = object(item, `workspace ${index + 1}`);
    return {
      id: identifier(workspace.id, `workspace ${index + 1} id`),
      name: text(workspace.name, `workspace ${index + 1} name`, 60),
      startupPages: list(workspace.startup_pages, `workspace ${index + 1} startup_pages`).map((page, pageIndex) => safeStartupURL(page, `workspace ${index + 1} startup page ${pageIndex + 1}`)),
    };
  });
  if (!workspaces.length) throw new Error('At least one [[workspace]] is required.');
  if (new Set(workspaces.map(workspace => workspace.id)).size !== workspaces.length) throw new Error('Workspace ids must be unique.');
  const available = new Set(workspaces.map(workspace => workspace.id));
  const activeWorkspaceId = identifier(value.active_workspace, 'active_workspace');
  if (!available.has(activeWorkspaceId)) throw new Error('active_workspace must name a declared workspace.');
  const sessions = list(value.session, 'session').map((item, index) => {
    const session = object(item, `session ${index + 1}`);
    const workspaceId = identifier(session.workspace, `session ${index + 1} workspace`);
    if (!available.has(workspaceId)) throw new Error(`session ${index + 1} refers to an unknown workspace.`);
    return {
      name: text(session.name, `session ${index + 1} name`, 80),
      workspaceId,
      pages: list(session.pages, `session ${index + 1} pages`).map((page, pageIndex) => safeStartupURL(page, `session ${index + 1} page ${pageIndex + 1}`)),
    };
  });
  if (new Set(sessions.map(session => session.name.toLocaleLowerCase())).size !== sessions.length) throw new Error('Session names must be unique.');
  const activeSession = value.active_session === undefined ? undefined : text(value.active_session, 'active_session', 80);
  if (activeSession && !sessions.some(session => session.name === activeSession)) throw new Error('active_session must name a declared session.');
  return { activeWorkspaceId, activeSession, workspaces, sessions };
}

function parseExtensions(raw: unknown): ExtensionsConfig {
  const value = object(raw, 'extensions');
  const extensions = list(value.extension, 'extension').map((item, index) => {
    const extension = object(item, `extension ${index + 1}`);
    const directory = text(extension.directory, `extension ${index + 1} directory`, 4096);
    resolveConfigPath(directory);
    if (typeof extension.enabled !== 'boolean') throw new Error(`extension ${index + 1} enabled must be true or false.`);
    return { id: identifier(extension.id, `extension ${index + 1} id`), directory, enabled: extension.enabled };
  });
  if (new Set(extensions.map(extension => extension.id)).size !== extensions.length) throw new Error('Extension ids must be unique.');
  return { extensions };
}

const settingsDocument = (settings: SettingsConfig) => ({ format_version: CONFIG_FORMAT_VERSION, theme: settings.theme, accent: settings.accent, background_limit: settings.backgroundLimit, sidebar_collapsed: settings.sidebarCollapsed });
const workspacesDocument = (config: WorkspacesConfig) => ({ format_version: CONFIG_FORMAT_VERSION, active_workspace: config.activeWorkspaceId, active_session: config.activeSession, workspace: config.workspaces.map(workspace => ({ id: workspace.id, name: workspace.name, startup_pages: workspace.startupPages })), session: config.sessions.map(session => ({ name: session.name, workspace: session.workspaceId, pages: session.pages })) });
const extensionsDocument = (config: ExtensionsConfig) => ({ format_version: CONFIG_FORMAT_VERSION, extension: config.extensions });

export class ConfigStore {
  readonly directory: string;
  constructor(directory = configDirectory()) {
    if (!isAbsolute(directory)) throw new Error('Config directory must be absolute.');
    this.directory = resolve(directory);
  }

  load(seeds: ConfigSeeds = {}): PlainConfig {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const warnings: string[] = [];
    const settings = this.read('settings.toml', seeds.settings ?? DEFAULT_SETTINGS, parseSettings, settingsDocument, warnings);
    const workspaces = this.read('workspaces.toml', seeds.workspaces ?? DEFAULT_WORKSPACES, parseWorkspaces, workspacesDocument, warnings);
    const extensions = this.read('extensions.toml', seeds.extensions ?? DEFAULT_EXTENSIONS, parseExtensions, extensionsDocument, warnings);
    return { settings, workspaces, extensions, directory: this.directory, warnings };
  }

  writeSettings(value: SettingsConfig): void { this.write('settings.toml', settingsDocument(parseSettings(settingsDocument(value)))); }
  writeWorkspaces(value: WorkspacesConfig): void { this.write('workspaces.toml', workspacesDocument(parseWorkspaces(workspacesDocument(value)))); }
  writeExtensions(value: ExtensionsConfig): void { this.write('extensions.toml', extensionsDocument(parseExtensions(extensionsDocument(value)))); }

  declareExtension(directory: string): ExtensionDeclaration {
    const config = this.load().extensions;
    const portable = portableConfigPath(resolve(directory));
    const existing = config.extensions.find(extension => resolveConfigPath(extension.directory) === resolve(directory));
    if (existing) return existing;
    const declaration = { id: randomUUID(), directory: portable, enabled: false };
    config.extensions.push(declaration);
    this.writeExtensions(config);
    return declaration;
  }

  private read<T>(filename: string, fallback: T, validate: (raw: unknown) => T, document: (value: T) => Record<string, unknown>, warnings: string[]): T {
    const path = join(this.directory, filename);
    if (!existsSync(path)) { this.write(filename, document(fallback)); return structuredClone(fallback); }
    try {
      const parsed = object(parse(readFileSync(path, 'utf8')), filename);
      if (parsed.format_version !== CONFIG_FORMAT_VERSION) throw new Error(`format_version must be ${CONFIG_FORMAT_VERSION}.`);
      return validate(parsed);
    } catch (cause) {
      warnings.push(`${filename}: ${cause instanceof Error ? cause.message : String(cause)}`);
      return structuredClone(fallback);
    }
  }

  private write(filename: string, document: Record<string, unknown>): void {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const path = join(this.directory, filename);
    const temporary = join(this.directory, `.${filename}.${process.pid}.${randomUUID()}.tmp`);
    const header = '# Astra config — contains no credentials or encryption keys. Safe to version-control.\n';
    writeFileSync(temporary, `${header}${stringify(document)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(temporary, path);
    chmodSync(path, 0o600);
  }
}
