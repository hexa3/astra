export function isWebURL(value: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

export function resolveAddress(raw: string): string {
  const value = raw.trim();
  if (!value || value === 'astra://newtab') return '';
  if (value.length > 8192) throw new Error('Address is too long.');
  if (isWebURL(value)) return new URL(value).href;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^(localhost|[\w.-]+\.\w+):\d+(\/|$)/.test(value)) {
    throw new Error('Only HTTP and HTTPS addresses can be opened.');
  }
  if (!/\s/.test(value) && /^(localhost(:\d+)?|\[[a-f\d:]+\](:\d+)?|[^/]+\.[^/]+)(\/.*)?$/i.test(value)) {
    return new URL(`${/^(localhost|127\.)/.test(value) ? 'http' : 'https'}://${value}`).href;
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
}
