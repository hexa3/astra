import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface ExtensionManifestSummary {
  name: string; version: string; permissions: string[]; hosts: string[];
}
const strings = (value: unknown): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 256 || value.some(item => typeof item !== 'string' || item.length > 2048)) throw new Error('Invalid extension permission list.');
  return value;
};
export function summarizeManifest(raw: unknown): ExtensionManifestSummary {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid extension manifest.');
  const manifest = raw as Record<string, unknown>;
  if (manifest.manifest_version !== 3) throw new Error('This loader accepts Manifest V3 extensions only.');
  if (typeof manifest.name !== 'string' || !manifest.name.trim() || manifest.name.length > 200 || typeof manifest.version !== 'string' || manifest.version.length > 64) throw new Error('The extension needs a valid name and version.');
  if (manifest.content_scripts !== undefined && !Array.isArray(manifest.content_scripts)) throw new Error('Invalid content-script declaration.');
  const scriptHosts = (manifest.content_scripts as Record<string, unknown>[] | undefined ?? []).flatMap(script => {
    if (!script || typeof script !== 'object') throw new Error('Invalid content-script declaration.');
    return strings(script.matches);
  });
  return {
    name: manifest.name, version: manifest.version,
    permissions: [...new Set([...strings(manifest.permissions), ...strings(manifest.optional_permissions).map(permission => `${permission} (optional)`)])].sort(),
    hosts: [...new Set([...strings(manifest.host_permissions), ...scriptHosts, ...strings(manifest.optional_host_permissions).map(host => `${host} (optional)`)])].sort(),
  };
}
export function inspectExtension(directory: string): ExtensionManifestSummary {
  const path = join(directory, 'manifest.json');
  if (statSync(path).size > 256 * 1024) throw new Error('The extension manifest is too large.');
  return summarizeManifest(JSON.parse(readFileSync(path, 'utf8')));
}
export function samePermissions(left: ExtensionManifestSummary, right: ExtensionManifestSummary): boolean {
  return JSON.stringify(left.permissions) === JSON.stringify(right.permissions) && JSON.stringify(left.hosts) === JSON.stringify(right.hosts);
}
