# Verification

`npm run verify` checks all TypeScript and Svelte files, runs unit tests, builds
the production assets and launches real Electron instances with temporary
profiles. A graphical desktop is required (or Xvfb on a Linux CI host).
No test uses `--no-sandbox`.

`npm run test:native` verifies unload confirmation and hibernation protection
in a separate Electron process without a DevTools client attached. Playwright's
default dialog manager accepts unhandled `beforeunload` dialogs, so that behavior
cannot verify Astra's native Stay/Leave path. The native test supplies the two
dialog choices, verifies the actual page lifetime, and verifies that automatic
hibernation keeps guarded pages alive without prompting. It is included in
`npm run verify`.

The integration fixtures are explicitly test data served by a local HTTP or
HTTPS server, never user-facing demo content. The HTTPS cookie test generates
a temporary certificate using OpenSSL and trusts only its two local test
hostnames within that test process. Production code never overrides certificate
validation. Tests verify:

- Native rendering, history navigation, tabs, bookmarks and tracker counters.
- No `require`, `process` or Astra bridge in remote page JavaScript.
- Passphrase vault creation, actual SQLite persistence across restart,
  wrong-passphrase rejection, and absence of plaintext browsing strings on disk.
- First-party cookies still function while third-party request/response headers
  and `document.cookie` reads/writes are blocked.

`npm run test:live` is a separate, explicit network smoke test that renders
https://example.com. The default tests need no external response; requests to
the tracker fixture hostname are blocked before reaching the network.

Not yet verified: Windows/macOS runtime or installer behavior, screen-reader
operation, broad website compatibility, extension compatibility, all possible
Chromium background services, crash recovery under every disk failure. A passing
test suite does not establish those claims.
