// SPDX-License-Identifier: MPL-2.0
import type { AstraAPI } from '../shared/types';
declare global {
  interface Window { astra: AstraAPI }
  const __ASTRA_VERSION__: string;
}
