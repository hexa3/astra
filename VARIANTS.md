# Official Astra variants

Astra 2.0 ships two official Linux x64 variants built from one source tree and one packaged core. They are functional products, not screenshots or theme presets.

| Release asset | Shell | Deliberate behavior |
| --- | --- | --- |
| `astra-2.0.0-default-linux-x64-reproducible.tar.gz` | Default | Vertical tabs, command bar, workspaces, panels, split view, Peek, Boosts, local AI, and sync UI |
| `astra-2.0.0-minimal-linux-x64-reproducible.tar.gz` | Minimal | One horizontal 52-pixel bar with navigation, address field, native tab selector, blocked count, and no sidebar, command palette, panels, AI UI, or workspace editor |

Both archives contain byte-identical `astra/astra-core` executables. Their small MPL-licensed `astra/astra-browser` launchers select an allowlisted packaged shell with `--astra-shell=default` or `--astra-shell=minimal`. Both HTML/Svelte shells and the one core are compiled in the same build; no core source is copied into a shell and electron-builder runs once before the two archives are assembled.

## Run a variant

Download one of the two assets from the v2.0.0 release, then:

```sh
tar -xzf astra-2.0.0-<default-or-minimal>-linux-x64-reproducible.tar.gz
./astra/astra-browser
```

The launcher fixes the artifact's official variant. It passes later arguments unchanged, including `--astra-profile=/absolute/path`. Chromium's normal Linux sandbox requirements apply.

Native Windows and macOS installers currently carry the default shell, although both shell bundles are present. Those installer formats remain platform-tested but are not yet claimed as byte-reproducible or separate variant downloads.

## Verify shared core and distinct launchers

```sh
mkdir default minimal
tar -xzf astra-2.0.0-default-linux-x64-reproducible.tar.gz -C default
tar -xzf astra-2.0.0-minimal-linux-x64-reproducible.tar.gz -C minimal
cmp default/astra/astra-core minimal/astra/astra-core
cmp default/astra/astra-browser minimal/astra/astra-browser && echo unexpected || true
```

The first `cmp` must print nothing and return success. The launchers must differ. Each archive has its own `.sha256` manifest, and release CI rebuilds and compares both artifacts independently.

Shell authors can use [CORE_API.md](CORE_API.md) to implement a third interface. An additional official slot requires API compatibility, accessibility and packaged-browser tests, but no import or duplication of core implementation.
