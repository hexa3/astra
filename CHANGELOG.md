# Changelog

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
