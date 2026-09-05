import type { Command } from './types';
import { workspaceName } from './workspaces';

/** Validate every command at the process boundary, including trusted UI mistakes. */
export function validateCommand(raw: unknown): Command {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid command.');
  const command = raw as Record<string, unknown>;
  if (typeof command.type !== 'string') throw new Error('Invalid command.');
  const simple = ['back', 'forward', 'reload', 'stop', 'bookmark', 'clear-history', 'toggle-sidebar', 'toggle-split'];
  if (simple.includes(command.type)) return raw as Command;
  if (command.type === 'navigate' && typeof command.url === 'string' && command.url.length <= 8192) return raw as Command;
  if (command.type === 'new-tab' && (command.url === undefined || typeof command.url === 'string' && command.url.length <= 8192)) return raw as Command;
  if (['activate-tab', 'close-tab', 'remove-bookmark', 'switch-workspace', 'split-tab'].includes(command.type) && typeof command.id === 'string' && command.id.length <= 100) return raw as Command;
  if (command.type === 'move-tab' && typeof command.id === 'string' && command.id.length <= 100 && Number.isInteger(command.index) && Number(command.index) >= 0 && Number(command.index) <= 100000) return raw as Command;
  if (command.type === 'create-workspace' && typeof command.name === 'string') return { type: command.type, name: workspaceName(command.name) };
  if (command.type === 'rename-workspace' && typeof command.id === 'string' && command.id.length <= 100 && typeof command.name === 'string') return { type: command.type, id: command.id, name: workspaceName(command.name) };
  if (command.type === 'theme' && typeof command.value === 'string' && ['system', 'dark', 'light'].includes(command.value)) return raw as Command;
  if (command.type === 'unlock-vault' && typeof command.passphrase === 'string' && command.passphrase.length >= 12 && command.passphrase.length <= 1024) return raw as Command;
  if (command.type === 'background-limit' && Number.isInteger(command.value) && Number(command.value) >= 0 && Number(command.value) <= 32) return raw as Command;
  if (command.type === 'panel' && typeof command.value === 'string' && ['none', 'bookmarks', 'history', 'privacy', 'storage', 'workspaces', 'commands'].includes(command.value)) return raw as Command;
  throw new Error('Unsupported browser command.');
}
