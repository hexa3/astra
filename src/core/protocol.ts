// SPDX-License-Identifier: MPL-2.0
import { CORE_API_VERSION } from './api';

export const CORE_CHANNELS = Object.freeze({
  capabilities: `astra:core:v${CORE_API_VERSION}:capabilities`,
  snapshot: `astra:core:v${CORE_API_VERSION}:snapshot`,
  command: `astra:core:v${CORE_API_VERSION}:command`,
  state: `astra:core:v${CORE_API_VERSION}:state`,
  shortcut: `astra:core:v${CORE_API_VERSION}:shortcut`,
});
