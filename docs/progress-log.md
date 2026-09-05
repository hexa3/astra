# Astra build log

Mission start: **2026-09-05 13:36 UTC**. Requested end: **2026-09-06 13:36 UTC**.
Milestone versions describe verified capabilities, not simulated elapsed hours.

Commit target: **440 commits**, requested explicitly during the mission.
Commits remain focused on real implementation, verification and documentation;
stable slices are pushed to main, with work-in-progress pushed on feature branches.

## 2026-09-05 13:40 UTC — foundation

Created an MIT-licensed repository on `hour0-foundation`. Selected the latest registry Electron/Svelte/Vite releases and documented rendering isolation, encrypted records, ephemeral website storage and default privacy. The app is not launchable yet. Next: install dependencies, implement the native view shell and test a real page inside the first hour. No existing user files were changed.

## 2026-09-05 13:51 UTC — first verified launch (15 minutes)

`main` now builds and launches. Svelte/TypeScript: zero diagnostics. Four unit tests and one Electron end-to-end test pass. A native page view rendered a local HTTP test page; back/forward, history, bookmarking, new/close tabs and real tracker counters passed. Remote content cannot access Node, process or the browser bridge. Light-theme screenshot inspected. Production dependency audit: zero findings. This desktop has no secure key store, and the app correctly uses disclosed memory-only records. Next: passphrase-backed persistence, browser-level third-party-cookie verification, live HTTPS smoke test and first Linux package. No milestone tag yet; first-block persistence is not complete.

## 2026-09-05 14:03 UTC — privacy verified; first Linux artifact

Live HTTPS rendering passed against example.com at 13:51:46 UTC. Passphrase-encrypted SQLite history/bookmarks/tabs survive restarting; wrong passphrases are rejected, and file scans found no plaintext test URLs, titles or passphrases. A two-site HTTPS test verifies both HTTP and document-cookie blocking while first-party cookies remain functional. Full check: four unit tests, three Electron tests, zero TypeScript/Svelte errors. AppImage produced (131 MB); the packaged Linux executable launches with its own temporary profile. Dark and light UI screenshots inspected. Debian packaging stopped on missing homepage metadata; publishing the source at https://github.com/hexa3/astra resolves this with a real project URL. A low-severity development-only esbuild advisory is being fixed by updating to 0.28.2. Next: complete Linux release, then workspace/command-bar slice once the first block's capabilities are packaged.

## 2026-09-05 14:08 UTC — first downloadable alpha

AppImage and Debian packages now build successfully. Direct AppImage launch passed at 14:07:35 UTC, with sandbox enabled and an isolated profile. The full suite passes again after the esbuild update; npm audit reports zero findings. Debian's archive is valid, but installation on Debian has not been tested. Publishing `v0.1.0` as an explicitly limited Linux alpha with SHA-256 hashes. This is an additional early release, not the four-hour checkpoint tag. Next: hibernation and lifecycle protection, then workspaces/command bar/split once this foundation remains green.

## 2026-09-05 14:27 UTC — lifecycle investigation

The Linux alpha upload completed and is public. On `hour0-tab-lifecycle`, hibernation now passes native-view destruction, history restoration, embedded-draft protection and measured-memory tests. Single-instance URL handoff also passes. A new close-confirmation test fails: the native page closes after the test supplies Stay despite an activated beforeunload handler. Investigating Electron's WebContentsView lifecycle semantics; this branch has not been merged into main. The failing test is retained as evidence. Next: correct that behavior or explicitly narrow the feature before merging.

## 2026-09-05 15:22 UTC — native lifecycle verified after resumption

Resumed from the actual worktree after the interrupted turn; no build or upload process was still running. The apparent Stay failure was caused by Playwright's default DevTools dialog handler automatically accepting beforeunload. A separate native Electron test now verifies Stay, Leave and automatic sleep protection without DevTools interception. A renderer round trip separates successive decisions, and assertions retain the WebContents reference because Electron clears it from the view on destruction. Also fixed the corresponding destroyed-view lookup edge case in application code. Five end-to-end browser tests pass, including encrypted restart, cookies, hibernation, draft preservation and second-instance handoff. The additional native test passes. The requested commit target is now 440; work branches are pushed as well as stable main. The interrupted interval did not produce an hourly checkpoint; this entry records the gap explicitly rather than backdating activity.
