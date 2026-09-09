export const CHROME_TOP = 88;
export const STATUS_HEIGHT = 24;
export const AI_WIDTH = 336;
export const sidebarWidth = (collapsed = false): number => collapsed ? 56 : 232;

export function pageBounds(width: number, height: number, collapsed = false, aiOpen = false) {
  const x = sidebarWidth(collapsed);
  return { x, y: CHROME_TOP, width: Math.max(0, width - x - (aiOpen ? AI_WIDTH : 0)), height: Math.max(0, height - CHROME_TOP - STATUS_HEIGHT) };
}

export function splitBounds(bounds: ReturnType<typeof pageBounds>) {
  const available = Math.max(0, bounds.width - 1);
  const leftWidth = Math.floor(available / 2);
  return [
    { ...bounds, width: leftWidth },
    { ...bounds, x: bounds.x + leftWidth + 1, width: available - leftWidth },
  ];
}

export function peekBounds(bounds: ReturnType<typeof pageBounds>) {
  const inset = Math.min(24, Math.floor(bounds.width / 20), Math.floor(bounds.height / 20));
  return { x: bounds.x + inset, y: bounds.y + inset, width: Math.max(0, bounds.width - inset * 2), height: Math.max(0, bounds.height - inset * 2) };
}
