// SPDX-License-Identifier: MPL-2.0
import type { ShellVariant } from './api';

export function shellArgument(args: string[]): ShellVariant {
  const prefix = '--astra-shell=';
  const values = args.filter((arg) => arg.startsWith(prefix));
  if (values.length > 1) throw new Error('Specify only one Astra shell.');
  if (!values.length) return 'default';
  const value = values[0].slice(prefix.length);
  if (value === 'default' || value === 'minimal') return value;
  throw new Error(`Unknown Astra shell: ${value || '(empty)'}`);
}
