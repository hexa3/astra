import { isAbsolute, resolve } from 'node:path';

/** A deliberate CLI profile works in packaged builds without test-only hooks. */
export function profileArgument(args: string[]): string | undefined {
  const prefix = '--astra-profile=';
  const values = args.filter(arg => arg.startsWith(prefix));
  if (values.length > 1) throw new Error('Specify only one Astra profile directory.');
  if (!values.length) return undefined;
  const path = values[0].slice(prefix.length);
  if (!path || !isAbsolute(path) || path.includes('\0')) throw new Error('The Astra profile directory must be an absolute filesystem path.');
  return resolve(path);
}
