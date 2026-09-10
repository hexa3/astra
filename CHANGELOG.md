# Changelog

## 1.20.0 — 2026-09-10

- Added identity-free, manually triggered end-to-end encrypted sync for bookmarks, history, and workspaces, using passphrase-derived but cryptographically separated authentication and content keys.
- Shipped a standalone dependency-free reference server, pinned non-root Docker image, and hardened Compose deployment that require no email, Astra account, or contact with an Astra service and store only bounded opaque envelopes.
- Added real two-device client/server and Electron tests for exchange, wrong-key isolation, replay/tamper rejection, transport policy, and absence of plaintext records in server storage.
- Centralized every untrusted tab and Peek view behind one no-preload sandbox policy, while retaining the versioned bridge only for authorized packaged browser chrome.
- Published the permanent standards policy, machine-readable custom-surface audit, and public proposal staging rules; CI now rejects unaudited surfaces and page-view paths that bypass the standards boundary.

## 1.16.0 — 2026-09-10

- Moved non-secret settings, workspace/session definitions, extension paths, enabled states, and reviewed manifest access into validated, atomic TOML under the platform config directory.
- Added the offline `astractl` executable for config dumps, reviewed MV3 install/list/remove, and workspace list/create/switch/export operations.
- Kept history, bookmarks, live crash-recovery tabs, Boost source, credentials, website data, passphrases, and encryption keys outside version-controlled config.
- Added safe migration from 1.0 vault preferences, explicit startup-session behavior, portable `$HOME` extension paths, invalid-edit preservation, and runtime permission-change disabling.
- Verified the change with 45 unit tests, 16 real Electron browser/privacy tests, native unload/hibernation and MV3 tests, a zero-finding production audit, and a reproducible runnable Linux build.

## 1.12.0 — 2026-09-10

- Separated privileged browser implementation into `src/core/`, Electron bootstrap/preload into `src/main/`, and unprivileged front ends into `src/shells/`.
- Added a discoverable Core API 2.0 with versioned channels, runtime-validated commands, state subscriptions, and shell-owned native-page geometry.
- Added architecture tests that forbid shells from importing Electron or core internals and forbid core imports from shells.
- Shipped a meaningfully different minimal horizontal shell with no sidebar or command palette, proven against real Chromium navigation and tabs.
- Documented compatibility, authorization, security, and third-shell build rules in `CORE_API.md`.

## 1.8.0 — 2026-09-10

- Added a complete runnable Linux x64 archive whose Electron runtime, app tree, metadata, and compression are canonicalized.
- Pinned the reference build to an exact Node 24.8.0/Debian container digest and lockfile/checksum-verified inputs.
- Added two independent CI builders with a byte comparison gate and a write-isolated workflow that cannot publish until both results match.
- Published exact third-party reproduction and failure-investigation steps while explicitly excluding native installer formats from the current bit-reproducibility claim.

## 1.4.0 — 2026-09-10

- Relicensed Astra-owned files under MPL 2.0 file-level copyleft and attached SPDX identifiers to covered source.
- Established public RFCs, roll-call votes, contributor-based maintainer eligibility, conflict recusals, appeals, protected privacy/funding decisions, and an automatic end to the single-maintainer bootstrap.
- Opened usable GitHub proposal paths for governance, nominations, grants, donation infrastructure, and enterprise support.
- Defined conflict-free donation, grant, and support rules with closed intake until custody passes public approval, backed by an append-only treasury ledger with a verified opening balance of USD 0.

## 1.0.0 — 2026-09-09

- Shipped sandboxed Chromium browsing, navigation, bookmarks and encrypted history/session records.
- Added vertical reorderable tabs, isolated named workspaces, command search, split view, hibernation and native link Peek.
- Enabled default tracker/cross-site-cookie protection and an honest resource/privacy panel with actual counters and renderer memory samples.
- Added reviewed unpacked Manifest V3 loading in disposable sessions and encrypted per-host CSS/JavaScript Boosts.
- Added an optional local extractive page assistant behind a replaceable provider contract.
- Completed monochrome light/dark/system themes, one user accent, bundled Doto typography, reduced-motion/forced-color support and keyboard-labeled primary controls.
- Added Linux, Windows and macOS packaging pipelines and native packaged-browser smoke tests.

Earlier public Linux alpha milestones are documented in [v0.1.0](docs/releases/v0.1.0.md) and [v0.2.0](docs/releases/v0.2.0.md).
