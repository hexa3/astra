// SPDX-License-Identifier: MPL-2.0
import type { CoreAPI } from '../core/api';
declare global {
  interface Window { astra: CoreAPI }
  const __ASTRA_VERSION__: string;
}
