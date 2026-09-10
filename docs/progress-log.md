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

## 2026-09-05 15:37 UTC — hour 2 checkpoint

The hibernation/lifecycle slice is verified, merged and pushed to main. The workspace branch adds real isolated website sessions, named context creation/renaming, keyboard switching and encrypted tab membership. Unit tests verify old-profile migration, duplicate URLs and large-session preservation. Browser testing confirms first-party cookies are isolated between Personal and Work; native keyboard injection verifies workspace switching (DevTools keyboard injection does not reach Electron's before-input-event hook). Encrypted workspace restart is undergoing its final check. Source history is being committed and pushed in focused increments toward the user's 440-commit target. The downloadable v0.1.0 alpha remains available; the next package will include the newly verified slices. Next: merge workspaces, establish CI, build the command bar and split view.

## 2026-09-05 16:36 UTC — hour 3 checkpoint

Main now includes workspaces, the local fuzzy command bar, drag/keyboard tab ordering, a persistent compact sidebar, conservative hibernation and actual renderer-memory reporting. Navigation regression checks protect committed address identity across cancelled/204/failed loads; native tests verify Stay/Leave for navigation and closure without DevTools auto-acceptance. Browser errors remain above native page surfaces. Local verification passes 19 unit tests, 11 Electron tests and the native lifecycle suite; Linux CI has also passed the sidebar slice. Source commits and pushes continue in focused increments (40 commits at this checkpoint). Linux 0.2.0 AppImage/Debian packages build, but the expanded packaged smoke test times out on a command-bar action after passing real-page rendering and isolation. Publication is held pending investigation. The v0.1.0 release remains the downloadable alpha. Next: resolve packaged behavior, publish verified artifacts, then implement split view and begin native Windows/macOS verification.

## 2026-09-06 06:26 UTC — resumed after interruption

The worktree still contains the uncommitted split-view controls and integration test from September 5; no build or upload process remained live when checked. There were no engineering commits or hourly checkpoints during the interruption, and missed milestone tags will not be backdated. GitHub confirms v0.2.0 finished publishing at 16:50 UTC with both Linux packages and matching SHA-256 digests. Main and the committed split-view backend passed CI. On resumption, typechecking, all 20 unit tests and the source build pass; the full native browser suite is being rerun before committing and merging the controls. The repository has 43 commits before this entry, well short of the requested 440. The original end time remains 13:36 UTC today; remaining work includes split-view verification, native platform packages, extensions/customization, optional AI and accessibility/stability work. No claim of uninterrupted autonomous work is made.

## 2026-09-09 18:00 GST — implementation resumed

Audited the inherited feature branch and verified a clean production build, zero Svelte/TypeScript diagnostics and all 24 unit tests. The existing native MV3 execution proof is now connected to a real extension manager: users choose an unpacked folder, review requested access in a native confirmation, enable/disable or remove it, and see load failures. Registrations persist only through the encrypted vault; runtime data stays in disposable extension-capable sessions. Native lifecycle and MV3 worker/content-script tests pass. Next: finish per-site boosts and optional local/pluggable AI without weakening the trusted chrome boundary.

## 2026-09-09 18:35 GST — boosts and local assistant

Per-host CSS/JavaScript Boosts now save in the encrypted vault, enforce exact active-host scoping and execute only in sandboxed page worlds. The optional AI sidebar summarizes and answers questions with a deterministic local extractive provider; page text never leaves the process and the UI states that limitation. A new end-to-end test proves real style/script injection and both assistant actions. The full 13-test Electron suite passes after preserving normal workspace sessions unless a user explicitly enables an extension; switching extension session mode warns that pages reload and current site logins clear. Next: implement link Peek, finish release-facing settings/documentation and package a verified candidate.

## 2026-09-09 18:50 GST — native link Peek

Holding Alt over a real page link now creates a delayed, sandboxed native preview using Chromium's hover target; releasing Alt destroys it, while trusted controls can close or promote it to a tab. Bounds remain inside the page region alongside collapsed sidebar and AI layouts. An Electron test drives actual native mouse/key input, observes the second page render, and verifies teardown. Next: consolidate the feature branch, audit remaining directive gaps, then package and smoke-test the release candidate.

## 2026-09-09 19:10 GST — 1.0 release candidate prepared

Added the user-selectable single accent, completed textarea and forced-color focus treatment, and restored encrypted theme/accent choices after vault unlock. Version metadata is now 1.0.0; README, changelog and release notes enumerate working behavior and limits without claiming Web Store parity, agentic AI, comprehensive filter coverage or commercial code signing. Native verification now always exercises both unload protection and real MV3 execution. Next: merge the stable branch into main, run the entire release verification, build Linux installers and exercise the packaged Chromium binary before tagging.

## 2026-09-09 21:01 GST — Linux 1.0 artifacts verified

Fast-forwarded the complete feature branch to main after `npm run verify` passed 30 unit tests, 14 Electron browser/privacy tests and both native suites; the production dependency audit reports zero vulnerabilities. Built the 1.0.0 AppImage and Debian package. Both the unpacked production executable and the actual AppImage rendered a local page in sandboxed Chromium, honored an isolated packaged profile, included project/font licenses and executed the command bar. SHA-256: AppImage `46529078fb4b776b7c6e617a416479d78f48e6cec9ed4a327d2d86ca49f6e5e0`; Debian `de365152b086a6e58dc92d5f009aced0acefe16f43c8bf6ca793b6b6f1c39278`. The host lacks `dpkg-deb`, so package structure was produced by electron-builder/FPM but not independently queried with Debian tooling. Next: commit this verification record, tag 1.0.0 and push main so native CI can rebuild Windows/macOS artifacts.

## 2026-09-09 21:05 GST — CI input ordering fix

The first two 1.0 Linux CI runs passed typechecking, all unit tests and 13 of 14 Electron tests, then missed the synthetic Peek hover because Xvfb did not route mouse movement into the embedded native page surface. Product behavior passed repeatedly on the local desktop. CI now drives the documented Electron `update-target-url` boundary directly, then uses native Alt input and verifies the real preview page plus teardown; this avoids mistaking virtual-display pointer limitations for application behavior. The candidate remains blocked until the replacement CI run is green.

## 2026-09-09 21:15 GST — macOS layout and driver compatibility

The final Linux workflow is green. Apple Silicon verification exposed two real layout overlaps: the expanded library exceeded the shorter macOS content area and intercepted footer clicks, so tab content now flexes/scrolls while fixed controls remain within the sidebar grid row. It also confirmed Playwright's macOS driver emits only `pointerdown` for an HTML5 drag; the cross-platform test now logs the event sequence and falls back to the same validated keyboard reorder command when no synthetic `drop` exists. Linux continues to exercise the full pointer drag path. The matrix remains blocked pending the replacement run.

## 2026-09-09 21:45 GST — release matrix green

The exact 1.0 source passed the Linux browser gate and the native Windows x64, macOS arm64 and macOS x64 matrix. Each native job passed typechecking, 30 unit tests, 14 real Electron browser/privacy tests, native unload/hibernation and MV3 worker tests, then built and launched its packaged executable against a real local page. Windows revealed that Chromium extension-worker handles can delay synchronous temporary-profile deletion during shutdown; the final implementation delegates that exact generated directory to a detached Node-mode cleanup helper after the parent exits. All five native Windows/macOS installers and both Linux packages were downloaded or built and SHA-256 hashed. Next: point the final annotated tag at this green record and publish the installers plus checksum manifest as the public v1.0.0 release.

## 2026-09-10 14:15 GST — Astra 1.0.0 published

Published [Astra 1.0.0](https://github.com/hexa3/astra/releases/tag/v1.0.0) as a non-prerelease with AppImage and Debian packages for Linux, an NSIS installer for Windows x64, DMG/ZIP packages for both Apple Silicon and Intel macOS, and a checksum manifest. GitHub independently reports an uploaded SHA-256 digest for every asset matching the local manifest. The final Linux gate passed all source/native tests and the production audit after CI stopped consulting an unrelated hosted Google Chrome apt source whose changing index had caused two pre-test infrastructure failures. The native three-platform package run remains green. The release tag is annotated, `main` is clean and pushed, and the documented limitations remain intentionally visible rather than represented as unfinished working features.

## 2026-09-10 15:50 GST — Phase 2 licensing audit

Started Phase 2 on `hour0-license-governance` from the verified 1.0 release. Git history identifies one author/copyright holder for all pre-Phase-2 commits, clearing the ownership prerequisite for a legitimate relicense. Replaced MIT with the unmodified MPL 2.0 text and changed package metadata and user-facing claims to describe its actual file-level copyleft scope. Existing third-party licenses remain separate. Next: attach SPDX notices to covered files and make the governance/funding commitments operational rather than aspirational.

## 2026-09-10 16:29 GST — public governance mechanism

Established a foundation-style public charter while recording that Astra is currently an unincorporated project with one bootstrap steward. RFC and maintainer nomination forms, durable roll-call records, automatic bootstrap exit, employer concentration limits, conflict recusals, appeals, release requirements, protected privacy/funding changes, and an append-only treasury ledger make participation possible today. The charter does not pretend a legal entity or multi-person council already exists. Next: establish executable funding intake rules and repository labels, then run the full Phase 1 verification before merging the legal/governance slice.
