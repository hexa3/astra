import type { AstraAPI } from '../shared/types';
declare global {
  interface Window { astra: AstraAPI }
  const __ASTRA_VERSION__: string;
}
