// SPDX-License-Identifier: MPL-2.0
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { stringify } from 'smol-toml';
import { CONFIG_FILES, ConfigStore, portableConfigPath, resolveConfigPath } from '../config/index';
import { inspectExtension } from '../core/extension-manifest';

export interface CliIO {
  out(text: string): void;
  error(text: string): void;
}

const usage = `Usage: astractl [--config-dir PATH] <command>

  config path                    Print the active config directory
  config dump                    Dump every credential-free config file
  extension list                 List declared extensions
  extension install DIRECTORY    Review and enable a local MV3 extension
  extension remove ID            Remove an extension declaration
  workspace list                 List workspace definitions
  workspace create NAME          Create and select a workspace
  workspace switch ID            Select a workspace or declared session
  workspace export ID            Print portable TOML for one workspace`;

function requireValue(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function workspaceId(name: string, occupied: Set<string>): string {
  const base = name.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 48) || 'workspace';
  let candidate = base;
  while (occupied.has(candidate)) candidate = `${base}-${randomUUID().slice(0, 8)}`;
  return candidate;
}

function parseGlobalOptions(args: string[]): { args: string[]; directory?: string } {
  const remaining = [...args];
  const index = remaining.indexOf('--config-dir');
  if (index < 0) return { args: remaining };
  const directory = requireValue(remaining[index + 1], '--config-dir');
  if (!isAbsolute(directory)) throw new Error('--config-dir must be an absolute path.');
  remaining.splice(index, 2);
  return { args: remaining, directory: resolve(directory) };
}

export function runCli(argv: string[], io: CliIO): number {
  try {
    const parsed = parseGlobalOptions(argv);
    const [group, action, ...values] = parsed.args;
    if (!group || group === 'help' || group === '--help' || group === '-h') { io.out(usage); return 0; }
    const store = new ConfigStore(parsed.directory);
    const config = store.load();
    if (config.warnings.length) throw new Error(`Refusing to edit invalid config:\n${config.warnings.join('\n')}`);

    if (group === 'config' && action === 'path') { io.out(config.directory); return 0; }
    if (group === 'config' && action === 'dump') {
      io.out(CONFIG_FILES.map(filename => `### ${filename}\n${readFileSync(resolve(config.directory, filename), 'utf8').trimEnd()}`).join('\n\n'));
      return 0;
    }
    if (group === 'extension' && action === 'list') {
      io.out(config.extensions.extensions.length
        ? config.extensions.extensions.map(item => `${item.id}\t${item.enabled ? 'enabled' : 'disabled'}\t${item.directory}`).join('\n')
        : 'No extensions declared.');
      return 0;
    }
    if (group === 'extension' && action === 'install') {
      const directory = resolve(requireValue(values[0], 'Extension directory'));
      const summary = inspectExtension(directory);
      const existing = config.extensions.extensions.find(item => resolveConfigPath(item.directory) === directory);
      const declaration = existing ?? { id: randomUUID(), directory: portableConfigPath(directory), enabled: true, ...summary };
      Object.assign(declaration, summary, { enabled: true });
      if (!existing) config.extensions.extensions.push(declaration);
      store.writeExtensions(config.extensions);
      io.out([`Installed ${summary.name} ${summary.version} as ${declaration.id}.`, `Browser permissions: ${summary.permissions.join(', ') || 'none'}`, `Site access: ${summary.hosts.join(', ') || 'none'}`, 'Restart Astra to apply this declaration.'].join('\n'));
      return 0;
    }
    if (group === 'extension' && action === 'remove') {
      const id = requireValue(values[0], 'Extension id');
      const before = config.extensions.extensions.length;
      config.extensions.extensions = config.extensions.extensions.filter(item => item.id !== id);
      if (config.extensions.extensions.length === before) throw new Error(`Unknown extension: ${id}`);
      store.writeExtensions(config.extensions); io.out(`Removed ${id}. Restart Astra to apply.`); return 0;
    }
    if (group === 'workspace' && action === 'list') {
      io.out(config.workspaces.workspaces.map(item => `${item.id}\t${item.id === config.workspaces.activeWorkspaceId ? '*' : ' '}\t${item.name}`).join('\n'));
      return 0;
    }
    if (group === 'workspace' && action === 'create') {
      const name = values.join(' ').trim();
      requireValue(name, 'Workspace name');
      if (name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Workspace name must be at most 60 printable characters.');
      if (config.workspaces.workspaces.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('A workspace with this name already exists.');
      const id = workspaceId(name, new Set(config.workspaces.workspaces.map(item => item.id)));
      config.workspaces.workspaces.push({ id, name, startupPages: [] });
      config.workspaces.activeWorkspaceId = id; config.workspaces.activeSession = undefined;
      store.writeWorkspaces(config.workspaces); io.out(`Created and selected ${id}. Restart Astra to apply.`); return 0;
    }
    if (group === 'workspace' && action === 'switch') {
      const target = requireValue(values[0], 'Workspace or session');
      const workspace = config.workspaces.workspaces.find(item => item.id === target);
      const session = config.workspaces.sessions.find(item => item.name === target);
      if (!workspace && !session) throw new Error(`Unknown workspace or session: ${target}`);
      config.workspaces.activeWorkspaceId = workspace?.id ?? session!.workspaceId;
      config.workspaces.activeSession = session?.name;
      store.writeWorkspaces(config.workspaces); io.out(`Selected ${target}. Restart Astra to apply.`); return 0;
    }
    if (group === 'workspace' && action === 'export') {
      const id = requireValue(values[0], 'Workspace id');
      const workspace = config.workspaces.workspaces.find(item => item.id === id);
      if (!workspace) throw new Error(`Unknown workspace: ${id}`);
      const sessions = config.workspaces.sessions.filter(item => item.workspaceId === id);
      io.out(`# Portable Astra workspace export — contains no credentials.\n${stringify({ format_version: 1, active_workspace: id, workspace: [{ id: workspace.id, name: workspace.name, startup_pages: workspace.startupPages }], session: sessions.map(item => ({ name: item.name, workspace: item.workspaceId, pages: item.pages })) }).trimEnd()}`);
      return 0;
    }
    throw new Error(`Unknown command.\n\n${usage}`);
  } catch (cause) {
    io.error(cause instanceof Error ? cause.message : String(cause));
    return 1;
  }
}
