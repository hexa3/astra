export const CHROME_TOP = 88;
export const STATUS_HEIGHT = 24;
export const sidebarWidth = (collapsed = false): number => collapsed ? 56 : 232;

export function pageBounds(width: number, height: number, collapsed = false) {
  const x = sidebarWidth(collapsed);
  return { x, y: CHROME_TOP, width: Math.max(0, width - x), height: Math.max(0, height - CHROME_TOP - STATUS_HEIGHT) };
}
