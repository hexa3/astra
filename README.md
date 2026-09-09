# Astra

**A quiet, open browser. Local by default. Yours by design.**

Astra is a desktop browser built with Electron, Chromium, TypeScript and Svelte. It combines an austere black/white/one-accent interface with browser internals that are visible rather than hidden: tracker and request counts, renderer memory, sleeping tabs, storage state and permission policy all live in the interface.

Astra is MIT-licensed, has no telemetry or advertising code, makes no background update request, and has no account requirement or paid tier. The Doto chrome font is bundled under the [SIL Open Font License](LICENSES/Doto-OFL.txt); pages retain their own typography.

## What works in 1.0

- Sandboxed Chromium pages with address/search, back, forward, reload, tabs and popup-to-tab handling.
- Vertical keyboard-accessible tabs with drag and keyboard reorder, collapse mode and conservative automatic hibernation.
- Named workspaces with separate ephemeral website sessions, keyboard switching and encrypted lazy session restore.
- Local fuzzy command bar across tabs, workspaces, history, bookmarks and browser actions.
- Two-page split view and Alt-hover native link Peek.
- Encrypted SQLite history, bookmarks, tab sessions, preferences, Boosts and extension registrations through the OS key store or a user-created passphrase vault.
- Default basic tracker blocking, cross-site HTTP/document cookie blocking, denied sensitive permissions, Global Privacy Control and no telemetry.
- A resource/privacy panel with observed request counts, blocked trackers/cookies, real renderer working-set samples and sleeping-tab state.
- Reviewed unpacked Manifest V3 extensions in disposable runtime sessions, including content scripts and service workers supported by Electron.
- Exact-hostname CSS/JavaScript Boosts stored locally and executed only in sandboxed page worlds.
- An optional, dismissible AI sidebar for local extractive summaries and page questions. It makes no network request and requires no model download or account.
- Dark, light and system themes, a user-selected single accent, reduced-motion behavior, forced-color support, labeled controls and keyboard equivalents for primary actions.

## Install and run

Release artifacts are attached to the [v1.0.0 release](https://github.com/hexa3/astra/releases/tag/v1.0.0) when published. Linux builds provide AppImage and Debian packages. Windows uses NSIS; macOS uses DMG/ZIP. Current community builds are not code-signed or notarized, so each operating system may display an unverified-publisher warning.

To run from source, install Node.js 24 and a graphical desktop:

```sh
npm ci
npm start
```

Use `--astra-profile=/absolute/path` for an isolated profile. This changes the profile location, not the encryption policy.

## Verify and package

```sh
npm run verify
npm run package:linux
npm run package:mac
npm run package:win
```

`verify` typechecks Svelte/TypeScript, runs unit tests, builds production assets, drives real Electron browser/privacy flows, and runs native unload and MV3 worker/content-script tests. Tests use sandboxed pages and disposable profiles; no test disables Chromium's sandbox. See [verification details](docs/testing.md) and [keyboard controls](docs/keyboard.md).

On Arch Linux, electron-builder's bundled Debian packager may require `libcrypt.so.1`. Install FPM with `gem install --user-install fpm --no-document`, then set `CUSTOM_FPM_PATH` to its absolute executable when packaging. This affects build tooling only.

## Privacy model

Astra contacts a site when you navigate to it. It is not an anonymity network and its bundled tracker list is intentionally small, local and reviewable—not a claim of comprehensive ad blocking.

Browser records are encrypted before persistence. Without a secure OS key store, Astra uses memory only until you create or unlock a passphrase vault from the footer. There is no recovery service. Normal website cookies, logins and storage are ephemeral and clear on exit. Extensions require a path-backed Chromium session; Astra uses `/dev/shm` on Linux and a disposable OS temporary directory elsewhere, removes it on orderly exit, and clearly warns when switching session mode clears current logins. A crash can leave temporary extension data for the OS to clean.

The built-in assistant processes capped rendered text locally. No page content is sent to a model provider. Boost JavaScript can read and change its configured site because that is its purpose, but it cannot access Node, Astra's bridge or trusted browser chrome.

## Known limits

- “Load unpacked” is supported; one-click Chrome Web Store installation is not. Electron implements only part of the Chrome extension API surface, and failures are shown rather than hidden.
- Installers are reproducibly built in CI but are not backed by paid Windows publisher signing, Apple Developer ID signing or notarization.
- Split layout does not persist or resize yet. Peek is intentionally transient.
- The assistant is extractive, not generative or agentic; it does not fill forms or take actions.
- The bundled tracker seed is a privacy baseline, not a substitute for a full maintained filter-list engine.
- Accessibility has automated keyboard/focus coverage and OS preference support, but broad manual screen-reader certification remains future work.

## Contributing and governance

Forks and replacement modules are welcome. No contributor agreement, account, monetization gate or proprietary service is required. Open an issue describing the user problem and propose a small tested change. Architectural changes require a rationale in [docs/decisions.md](docs/decisions.md); features must work, remain keyboard accessible, and disclose their network and storage behavior.

The initial maintainer currently reviews changes. Astra does not claim an elected governance body that does not yet exist. The project records decisions publicly and intends to evolve governance with sustained contributors. See the [build log](docs/progress-log.md) for the implementation record.
