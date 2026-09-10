# Astra Core API 2.0

## The boundary

`src/core/` is Astra's privileged browser core. It owns Electron/Chromium page views, tabs and workspaces, navigation, lifecycle consent, privacy policy and counters, extension review/runtime, hibernation, encrypted records, AI providers, and shell authorization. `src/shells/` contains unprivileged front ends. `src/main/` contains only Electron's bootstrap and the context-isolated preload adapter.

A shell cannot import a core implementation module or Electron. It communicates only through the typed contract in `src/core/api.ts`, exposed as `window.astra`. The build has an architecture test that rejects a shell import from `src/core/` except `core/api`, any `src/main/` import, or direct `electron` access. A reciprocal test rejects core imports from shells. Pure functions in `src/shared/` have no browser authority and may be used on either side.

The API version is `2.0`. Every IPC channel contains that major version (`astra:core:v2.0:*`) and is declared once in `src/core/protocol.ts`. Channel names are transport details; shells use `window.astra`, not Electron IPC.

## Runtime contract

```ts
interface CoreAPI {
  readonly version: '2.0';
  capabilities(): Promise<CoreCapabilities>;
  snapshot(): Promise<BrowserState>;
  command(command: Command): Promise<void>;
  onState(callback: (state: BrowserState) => void): () => void;
  onShortcut(callback: (shortcut: string) => void): () => void;
}
```

- `version` is available synchronously so an incompatible shell can stop before issuing commands.
- `capabilities()` returns the API version, selected built-in shell slot, and the core's actual accepted command vocabulary. A shell must feature-detect commands it did not require at compile time.
- `snapshot()` returns a structured clone of current state. Mutating the clone cannot mutate core state.
- `command()` is the only mutation path. The main process validates type, bounds, identifiers, URLs, source sizes, and enum values again even though TypeScript checked the shell.
- `onState()` receives complete replacement snapshots. It returns an unsubscribe function. Delivery can be coalesced; do not count events or infer persisted completion from timing.
- `onShortcut()` reports core-owned shortcuts that require shell focus, currently `address`. It also returns an unsubscribe function.

The source interfaces are normative. `BrowserState` deliberately exposes user-visible state and honest measurements, never database handles, keys, cookies, raw Electron objects, extension contexts, or arbitrary code-execution primitives.

## Commands and guarantees

The discoverable command list covers navigation, tabs, split view, bookmarks/history, workspaces, appearance, encrypted-vault unlock, hibernation threshold, reviewed extensions, per-host Boosts, Peek, the optional assistant, panels, and shell layout. Invalid input rejects the promise without partially applying a command.

`configure-shell` accepts integer top/right/bottom/left insets from 0 through 2048 CSS pixels. This is the mechanism that lets a shell reserve only the trusted chrome it actually renders while the core positions native pages, split panes, and Peek. Insets are process-local UI geometry; they are not saved as user settings. They grant no page or filesystem authority.

Navigation accepts user text but the core resolves it and rejects privileged schemes. Extension and vault operations retain native consent/validation in the core. Page content never receives `window.astra`; native tests assert that Node, Electron, the preload bridge, and process globals are absent from remote documents.

## Loading and trust

The core loads only a packaged shell document selected from the allowlist `default | minimal`. `--astra-shell=minimal` selects the second reference shell; omitting it selects `default`. Arbitrary filesystem URLs are intentionally forbidden because a shell can issue trusted browser commands.

Authorization requires all of the following for every invocation:

1. the sender is the one browser-chrome `WebContents`;
2. the sender frame is its main frame, not an iframe;
3. the committed frame URL is the exact selected packaged shell document;
4. the command passes runtime schema validation.

Both shipped HTML documents also use a deny-by-default Content Security Policy with no network connection permission. Website views run sandboxed in separate sessions and never inherit shell preload code.

## Build a third shell without changing core implementation

1. Import types and `CORE_API_VERSION` only from `src/core/api.ts`. A shell may use Svelte, another UI framework, or plain DOM code.
2. Refuse to operate when `window.astra.version` has an unsupported major version. Call `capabilities()` and check required commands.
3. Subscribe before requesting the first snapshot, render accessible controls, and unsubscribe on teardown.
4. Send `configure-shell` with the chrome insets your layout reserves. Re-send it when your own chrome size changes.
5. Add a Vite HTML entry and compile it as the package's `dist/renderer/index.html` default slot, or propose an additional audited built-in slot. Replacing the default shell entry changes no file under `src/core/` or `src/main/`.
6. Run `npm test`, `npm run check`, and an Electron test that navigates a real page. Never test a shell by embedding a screenshot or fake page data.

The minimal reference is intentionally not a reskin: it has one horizontal 52-pixel bar, a native tab selector, no sidebar, panels, command palette, AI surface, workspace editor, or default-shell typography. It still browses, navigates, opens/closes/selects tabs, receives real privacy counts, and reports API 2.0 from the same core. Its Electron test proves real remote rendering.

## Compatibility policy

- Additive state fields, commands, and capability values may ship in API 2.x. Shells ignore unknown fields and feature-detect optional commands.
- Existing command meaning, required fields, security behavior, or event semantics do not change incompatibly within API 2.x.
- A breaking change creates API 3 and new channel names. The old adapter remains for at least one stable release unless retaining it would preserve an actively exploitable vulnerability; that exception requires a security advisory.
- Deprecations are recorded here and in `CHANGELOG.md`. Astra does not expose this bridge to web pages, so it is a browser-shell interface—not a proprietary web-platform API.
