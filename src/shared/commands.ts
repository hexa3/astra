// SPDX-License-Identifier: MPL-2.0
import type { Command } from '../core/api';
import { workspaceName } from './workspaces';

/** Validate every command at the process boundary, including trusted UI mistakes. */
export function validateCommand(raw: unknown): Command {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid command.');
  const command = raw as Record<string, unknown>;
  if (typeof command.type !== 'string') throw new Error('Invalid command.');
  const simple = ['back', 'forward', 'reload', 'stop', 'bookmark', 'clear-history', 'toggle-sidebar', 'toggle-split', 'load-extension', 'toggle-ai', 'ai-summarize', 'close-peek', 'open-peek'];
  if (simple.includes(command.type)) return raw as Command;
  if (command.type === 'navigate' && typeof command.url === 'string' && command.url.length <= 8192) return raw as Command;
  if (command.type === 'new-tab' && (command.url === undefined || typeof command.url === 'string' && command.url.length <= 8192)) return raw as Command;
  if (['activate-tab', 'close-tab', 'remove-bookmark', 'switch-workspace', 'split-tab', 'toggle-extension', 'remove-extension'].includes(command.type) && typeof command.id === 'string' && command.id.length <= 100) return raw as Command;
  if (command.type === 'move-tab' && typeof command.id === 'string' && command.id.length <= 100 && Number.isInteger(command.index) && Number(command.index) >= 0 && Number(command.index) <= 100000) return raw as Command;
  if (command.type === 'create-workspace' && typeof command.name === 'string') return { type: command.type, name: workspaceName(command.name) };
  if (command.type === 'rename-workspace' && typeof command.id === 'string' && command.id.length <= 100 && typeof command.name === 'string') return { type: command.type, id: command.id, name: workspaceName(command.name) };
  if (command.type === 'theme' && typeof command.value === 'string' && ['system', 'dark', 'light'].includes(command.value)) return raw as Command;
  if (command.type === 'accent' && typeof command.value === 'string' && /^#[0-9a-fA-F]{6}$/.test(command.value)) return { type: 'accent', value: command.value.toLowerCase() };
  if (command.type === 'configure-shell' && command.insets && typeof command.insets === 'object') {
    const insets = command.insets as Record<string, unknown>;
    if (['top', 'right', 'bottom', 'left'].every((key) => Number.isInteger(insets[key]) && Number(insets[key]) >= 0 && Number(insets[key]) <= 2048)) {
      return { type: 'configure-shell', insets: { top: Number(insets.top), right: Number(insets.right), bottom: Number(insets.bottom), left: Number(insets.left) } };
    }
  }
  if (command.type === 'unlock-vault' && typeof command.passphrase === 'string' && command.passphrase.length >= 12 && command.passphrase.length <= 1024) return raw as Command;
  if (command.type === 'background-limit' && Number.isInteger(command.value) && Number(command.value) >= 0 && Number(command.value) <= 32) return raw as Command;
  if (command.type === 'save-boost' && typeof command.domain === 'string' && command.domain.length <= 253 && typeof command.css === 'string' && command.css.length <= 100000 && typeof command.js === 'string' && command.js.length <= 100000 && typeof command.enabled === 'boolean') return raw as Command;
  if (command.type === 'remove-boost' && typeof command.domain === 'string' && command.domain.length <= 253) return raw as Command;
  if (command.type === 'ai-ask' && typeof command.question === 'string' && command.question.trim().length > 0 && command.question.length <= 1000) return { type: 'ai-ask', question: command.question.trim() };
  if (command.type === 'panel' && typeof command.value === 'string' && ['none', 'bookmarks', 'history', 'privacy', 'storage', 'workspaces', 'commands', 'extensions', 'boosts'].includes(command.value)) return raw as Command;
  throw new Error('Unsupported browser command.');
}
