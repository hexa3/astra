# Astra

**A quiet, open browser. Local by default. Yours by design.**

Astra is a desktop browser built with Electron, Chromium, TypeScript and Svelte. Its “Linux of browsers” claim rests on eight checkable mechanisms:

1. **Guaranteed-open covered code:** the [MPL 2.0 license](LICENSE) requires distributed modifications to Astra's covered files to remain available under MPL, while allowing practical larger works and forks.
2. **Reproducible binaries:** two clean builders must produce byte-identical runnable Linux archives before publication; [rebuild and compare them yourself](REPRODUCIBLE_BUILDS.md).
3. **Core/shell boundary:** privileged browsing and security live behind the stable [Core API 2.0](CORE_API.md), with import and runtime authorization tests.
4. **Config as code:** reviewed TOML under the platform config directory and the offline [`astractl` CLI](CONFIGURATION.md) make settings, extensions, and workspace startup definitions diffable and scriptable without exposing secrets.
5. **Identity-free sync:** the bundled [self-hostable E2EE server and client](SYNC.md) require no Astra account, email, default cloud, or server-side content key.
6. **Conflict-free governance and funding:** public [governance](GOVERNANCE.md) and [funding rules](FUNDING.md) exclude ads, search placement, data revenue, and paid control while recording the project's present bootstrap status honestly.
7. **Official variants:** the full default and sparse minimal [release variants](VARIANTS.md) launch different shells on byte-identical packaged core executables.
8. **Standards discipline:** a permanent [policy](STANDARDS.md), machine-checked [surface audit](docs/standards-audit.json), and public [proposal staging area](docs/standards-proposals/README.md) prohibit quiet Astra-only web APIs.

The [Phase 2 retrospective](docs/decisions.md#phase-2-retrospective--v200) distinguishes what v2 proves today from work that remains aspirational. Astra has no telemetry or advertising code, makes no background update request, and has no account requirement or paid tier. The Doto chrome font is bundled separately under the [SIL Open Font License](LICENSES/Doto-OFL.txt); pages retain their own typography.

## What works in 2.0

- Sandboxed Chromium pages with address/search, back, forward, reload, tabs and popup-to-tab handling.
- Vertical keyboard-accessible tabs with drag and keyboard reorder, collapse mode and conservative automatic hibernation.
- Named workspaces with separate ephemeral website sessions, keyboard switching and encrypted lazy session restore.
- Local fuzzy command bar across tabs, workspaces, history, bookmarks and browser actions.
- Two-page split view and Alt-hover native link Peek.
- Encrypted SQLite history, bookmarks, live tab sessions and Boosts through the OS key store or a user-created passphrase vault.
- Versioned TOML settings, workspace/session definitions and extension declarations, plus the non-interactive `astractl` CLI for dotfiles and scripts.
- Manual end-to-end encrypted bookmark/history/workspace sync to the bundled self-hostable server, derived from a passphrase and random Realm with no Astra account or default cloud.
- Default basic tracker blocking, cross-site HTTP/document cookie blocking, denied sensitive permissions, Global Privacy Control and no telemetry.
- A resource/privacy panel with observed request counts, blocked trackers/cookies, real renderer working-set samples and sleeping-tab state.
- Reviewed unpacked Manifest V3 extensions in disposable runtime sessions, including content scripts and service workers supported by Electron.
- Exact-hostname CSS/JavaScript Boosts stored locally and executed only in sandboxed page worlds.
- An optional, dismissible AI sidebar for local extractive summaries and page questions. It makes no network request and requires no model download or account.
- Dark, light and system themes, a user-selected single accent, reduced-motion behavior, forced-color support, labeled controls and keyboard equivalents for primary actions.
- A versioned, context-isolated Core API with architecture tests and two independent shells: the full default interface and a horizontal minimal reference.

## Install and run

The [v2.0.0 release](https://github.com/hexa3/astra/releases/tag/v2.0.0) publishes separately downloadable default and minimal reproducible Linux x64 variants with individual SHA-256 manifests. Windows uses NSIS; macOS uses DMG/ZIP; those native installers currently carry the default shell and remain tested but non-reproducible conveniences. Community builds are not code-signed or notarized, so each operating system may display an unverified-publisher warning.

To run from source, install Node.js 24 and a graphical desktop:

```sh
npm ci
npm start
```

Use `--astra-profile=/absolute/path` for an isolated profile. This changes the profile location, not the encryption policy.

Run the deliberately sparse second shell against the same core:

```sh
npm start -- --astra-shell=minimal
```

Its one horizontal bar has no sidebar or command palette; it still performs real navigation and tab operations. The stable contract and third-shell guide are in [CORE_API.md](CORE_API.md).

Review or script the credential-free config after building:

```sh
npm exec -- astractl config dump
npm exec -- astractl workspace create "Research"
npm exec -- astractl extension install /absolute/path/to/extension
```

The schema, location, complete command list, safety boundary and version-control workflow are in [CONFIGURATION.md](CONFIGURATION.md). History, bookmarks, current tabs, Boosts, credentials and encryption keys do not enter this directory.

Run the identity-free reference sync server locally with `docker compose -f sync-server/compose.yaml up -d --build`, then configure `http://localhost:8787` under encrypted storage settings. Remote deployments require your own TLS endpoint. Pairing, backups, cryptographic separation, server-visible metadata, and protocol limitations are documented in [SYNC.md](SYNC.md).

## Verify and package

```sh
npm run verify
npm run package:linux
npm run package:mac
npm run package:win
npm run package:reproducible:container
```

`verify` typechecks Svelte/TypeScript, runs unit tests, builds production assets, drives real Electron browser/privacy flows, and runs native unload and MV3 worker/content-script tests. Tests use sandboxed pages and disposable profiles; no test disables Chromium's sandbox. See [verification details](docs/testing.md) and [keyboard controls](docs/keyboard.md).

The unit gate also enforces the web-platform boundary and completeness of the custom-surface audit. See [STANDARDS.md](STANDARDS.md) and the public [proposal staging area](docs/standards-proposals/README.md).

The Linux x64 reproducible tarball is a complete runnable browser built inside a digest-pinned environment and canonicalized byte for byte. CI requires two independent builds to match before the verified-release workflow can publish it. Native installer formats are not mislabeled as reproducible. Follow [REPRODUCIBLE_BUILDS.md](REPRODUCIBLE_BUILDS.md) to rebuild and compare a release yourself.

On Arch Linux, electron-builder's bundled Debian packager may require `libcrypt.so.1`. Install FPM with `gem install --user-install fpm --no-document`, then set `CUSTOM_FPM_PATH` to its absolute executable when packaging. This affects build tooling only.

## Privacy model

Astra contacts a site when you navigate to it. It is not an anonymity network and its bundled tracker list is intentionally small, local and reviewable—not a claim of comprehensive ad blocking.

Browser records are encrypted before persistence. Without a secure OS key store, Astra uses memory only until you create or unlock a passphrase vault from the footer. There is no recovery service. Normal website cookies, logins and storage are ephemeral and clear on exit. Extensions require a path-backed Chromium session; Astra uses `/dev/shm` on Linux and a disposable OS temporary directory elsewhere, removes it on orderly exit, and clearly warns when switching session mode clears current logins. A crash can leave temporary extension data for the OS to clean.

The built-in assistant processes capped rendered text locally. No page content is sent to a model provider. Boost JavaScript can read and change its configured site because that is its purpose, but it cannot access Node, Astra's bridge or trusted browser chrome.

## Known limits

- “Load unpacked” is supported; one-click Chrome Web Store installation is not. Electron implements only part of the Chrome extension API surface, and failures are shown rather than hidden.
- Native installers are tested in CI but are not yet bit-reproducible and are not backed by paid Windows publisher signing, Apple Developer ID signing or notarization. The runnable Linux x64 tarball is independently reproducible.
- Split layout does not persist or resize yet. Peek is intentionally transient.
- The assistant is extractive, not generative or agentic; it does not fill forms or take actions.
- The bundled tracker seed is a privacy baseline, not a substitute for a full maintained filter-list engine.
- Accessibility has automated keyboard/focus coverage and OS preference support, but broad manual screen-reader certification remains future work.

## Contributing and governance

Forks and replacement modules are welcome. No contributor agreement, account, monetization gate or proprietary service is required. See [CONTRIBUTING.md](CONTRIBUTING.md) for the engineering path and [GOVERNANCE.md](GOVERNANCE.md) for public RFCs, maintainer eligibility, votes, appeals, conflicts and the automatic end of single-maintainer bootstrap. Astra states plainly that it is not yet an incorporated foundation or elected multi-person council.

[FUNDING.md](FUNDING.md) defines the only permitted donation, grant and enterprise-support paths and excludes ads, search placement, data revenue and paid governance. Intake remains closed until a transparent legal recipient and payment rail pass the protected vote; the public treasury therefore starts at exactly zero. See the [build log](docs/progress-log.md) for the implementation record.
