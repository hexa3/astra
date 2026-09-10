// SPDX-License-Identifier: MPL-2.0
import type { Server } from 'node:http';

export function createSyncServer(options?: { dataDirectory?: string }): Server;
