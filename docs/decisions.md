# Astra engineering decisions

## 1. Build an experience on Electron, not a new engine — 2026-09-05

Astra uses Electron 44, Chromium, TypeScript, Svelte 5, Vite, electron-builder and better-sqlite3. A fresh, small experience layer lets contributors replace browser features without maintaining a Chromium fork; a fork would offer deeper extension and browser-service compatibility but greatly exceed this mission's maintenance budget. Electron does not provide all Chrome extension APIs or the Chrome Web Store installation flow: compatibility must be tested and described honestly. Remote sites live in sandboxed WebContentsViews, never the privileged UI. The main process owns a single typed state and validates the UI's narrow IPC commands. Reference: https://www.electronjs.org/docs/latest/tutorial/security and https://www.electronjs.org/docs/latest/api/web-contents-view.

## 2. Encrypt application records; keep website storage ephemeral — 2026-09-05

History, bookmarks and saved sessions are authenticated encrypted payloads in SQLite using a random AES-256-GCM key wrapped by the operating-system key store through Electron safeStorage. No URL or title becomes a plaintext index. On Linux, the basic_text backend is explicitly rejected. When a secure key store is unavailable, the browser works in memory and clearly reports that persistence is unavailable; a passphrase unlock path will follow. Chromium sessions use nonpersistent partitions with disk cache disabled, so website cookies and storage do not survive quitting. This privacy/compatibility tradeoff is disclosed in the UI and README. We will not claim that normal Chromium profile files are fully encrypted. Reference: https://www.electronjs.org/docs/latest/api/safe-storage.

## 3. Default privacy before feature breadth — 2026-09-05

Application UI has a network-denying CSP and bundled fonts, no telemetry, updater, analytics or crash uploader. Page sessions deny sensitive permissions initially and intercept known tracker hosts using a bundled, reviewable seed list. Third-party network cookies are stripped using registrable-domain comparisons rather than unsafe hostname suffix guesses; additional document-cookie verification is part of the first milestone. We disable spellcheck downloads and Chromium background networking where exposed. A small seed blocklist is basic protection, not a claim of comprehensive ad blocking. Request counters must count actual events.
