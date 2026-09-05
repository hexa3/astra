# Astra

A quiet, open browser. Local by default. Yours by design.

Astra is an MIT-licensed Electron + Svelte browser under active construction.
It is not yet a stable release. Verified milestones and limitations live in
[the build log](docs/progress-log.md); architecture lives in
[decisions](docs/decisions.md).

[Download the Linux alpha](https://github.com/hexa3/astra/releases/tag/v0.1.0).
It supports real browsing, vertical tabs, encrypted bookmarks/history, a
passphrase vault, dark/light themes and a privacy panel with measured counts.
See [release notes](docs/releases/v0.1.0.md) for verification and limitations.

## Development

Node.js 24 and a graphical desktop are required. Run `npm ci`, then `npm start`.
Use `npm run verify` to typecheck, run unit tests, build and exercise the app.
Linux packages: `npm run package:linux`.

On Arch Linux, electron-builder's bundled Debian packager may require
`libcrypt.so.1`. You can use your installed Ruby instead: install FPM with
`gem install --user-install fpm --no-document`, then set `CUSTOM_FPM_PATH` to
the absolute `bin/fpm` path under `gem environment user_gemhome` when running
the packaging command. This workaround only affects build tooling.

## Privacy contract

No telemetry, analytics SDK, remote font, cloud sync or automatic update request.
History, bookmarks and session records must be encrypted before persistence.
Without a secure OS key store, Astra starts in clearly disclosed memory-only
mode. Click the storage status at the bottom to create or unlock a passphrase
vault. Use a unique passphrase of at least 12 characters; there is no recovery
service. Website storage is ephemeral: logins do not currently survive quitting.
Basic tracker blocking and third-party network-cookie filtering are enabled.
This is not an anonymity tool; navigating to a site contacts that site.

## Contributing and governance

Forks and replacement modules are welcome. No contributor agreement or paid tier.
Open an issue explaining the user problem, then propose a small, tested change.
Architectural changes require a paragraph in `docs/decisions.md`. Features must
work, remain keyboard accessible, and disclose their network/storage behavior.
The initial maintainer reviews changes; formal community governance has not yet
been established. We will document decisions publicly rather than imply an
elected governance structure that does not exist.
