// SPDX-License-Identifier: MPL-2.0
export const CHROME_TOP = 88;
export const STATUS_HEIGHT = 24;
export const AI_WIDTH = 336;
export const sidebarWidth = (collapsed = false): number => collapsed ? 56 : 232;

export interface Insets { top: number; right: number; bottom: number; left: number }

export function contentBounds(width: number, height: number, insets: Insets) {
  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(0, width - insets.left - insets.right),
    height: Math.max(0, height - insets.top - insets.bottom),
  };
}

export function pageBounds(width: number, height: number, collapsed = false, aiOpen = false) {
  return contentBounds(width, height, { top: CHROME_TOP, right: aiOpen ? AI_WIDTH : 0, bottom: STATUS_HEIGHT, left: sidebarWidth(collapsed) });
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
