# Astra configuration as code

Astra's reviewable configuration is ordinary TOML. On Linux it lives in
`$XDG_CONFIG_HOME/astra` when that variable is an absolute path, otherwise in
`~/.config/astra`. Set `ASTRA_CONFIG_DIR` to an absolute directory to use a
different dotfiles checkout. Development test profiles use their own `config/`
directory so tests never change a person's real configuration.

The directory contains exactly these files:

| File | Contents |
| --- | --- |
| `settings.toml` | Theme, accent, background-tab limit, collapsed-sidebar preference |
| `workspaces.toml` | Workspace names/IDs, explicit startup pages, named sessions, active selection |
| `extensions.toml` | Local MV3 extension IDs, portable directories, enabled state |
| `sync.toml` | Optional self-hosted endpoint, random Realm, device ID, passphrase verifier |

Every file begins with `format_version = 1`. Astra validates the complete file
before using it. An invalid edit produces a visible storage warning, uses safe
in-memory defaults, and is left untouched for the user to repair. Successful
writes use a same-directory temporary file and atomic rename with mode `0600`;
the directory is created with mode `0700`.

## CLI

Build once, then invoke the CLI through npm or its generated executable:

```sh
npm run build
npm exec -- astractl help
./dist/cli/astractl.cjs config path
```

`astractl` supports:

```text
config path
config dump
extension list
extension install DIRECTORY
extension remove ID
workspace list
workspace create NAME
workspace switch ID_OR_SESSION_NAME
workspace export ID
```

Every mutating command is non-interactive and returns a nonzero exit status on
invalid input. Installing an extension prints the browser permissions and site
access read from its Manifest V3 manifest, records the declaration as enabled,
and never copies or modifies the extension directory. `workspace export` writes
portable TOML to stdout, so callers choose whether to redirect it to a file.
Use `--config-dir /absolute/path` with any command to target a specific checkout.

Astra reads external CLI/file edits at startup. Close Astra before editing the
same config with scripts: the browser is the only writer while it is running,
and GUI changes can atomically replace an older file snapshot. Restart after a
CLI mutation to apply it.

## Example files

```toml
# settings.toml
format_version = 1
theme = "system"
accent = "#e5231b"
background_limit = 6
sidebar_collapsed = false
```

```toml
# workspaces.toml
format_version = 1
active_workspace = "personal"

[[workspace]]
id = "personal"
name = "Personal"
startup_pages = ["https://example.com/docs"]

[[session]]
name = "Morning research"
workspace = "personal"
pages = ["https://example.org/", "https://example.net/notes"]
```

Set `active_session = "Morning research"` at the top level, or run
`astractl workspace switch 'Morning research'`, to open that named page set on
the next launch. URLs must be absolute HTTP(S) addresses and cannot contain URL
credentials, query strings, or fragments. This prevents common tokens and
passwords from being written accidentally; users should still avoid secrets in
URL paths.

```toml
# extensions.toml
format_version = 1

[[extension]]
id = "local-reader"
directory = "$HOME/src/reader-extension"
enabled = true
name = "Reader"
version = "1.0.0"
permissions = ["storage"]
hosts = ["https://example.com/*"]
```

`$HOME` is a literal supported prefix, making generated declarations portable
without recording the account name. The manifest fields are the review record,
so permission changes are visible in a diff. Astra compares them with the live
manifest on launch; missing/invalid extensions and on-disk permission changes
are disabled and shown as errors.

## What is not in dotfiles

The config directory contains no passphrases, auth/content keys, vault keys, cookies, credentials,
history, bookmarks, current crash-recovery tabs, Boost source, or website data.
Extension permission names and host patterns are present intentionally so an
enable decision can be reviewed in version control; they are not credentials.
When sync is configured, its verifier is also present to catch passphrase typos.
It cannot authenticate or decrypt, but it enables offline passphrase guessing;
keep `sync.toml` private if the passphrase is not high entropy. See [SYNC.md](SYNC.md).
Private browser records stay in Astra's authenticated encrypted vault; normal
website storage stays in ephemeral Chromium sessions. An existing 1.0 profile
migrates non-secret preferences, workspace structure, and extension declarations
into TOML, then deletes those legacy records from the vault. Previously enabled
extensions require review after migration.

This split makes the whole config directory suitable for direct version control
without turning private browsing activity or encryption material into dotfiles.
