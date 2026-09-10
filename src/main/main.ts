// SPDX-License-Identifier: MPL-2.0

// Electron's configured entry point is intentionally only a core bootstrap.
// Shell code receives authority exclusively through the versioned preload API.
import '../core/browser-core';
