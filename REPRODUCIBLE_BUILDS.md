# Reproducible Astra builds

## What is reproducible today

The release asset named `astra-<version>-linux-x64-reproducible.tar.gz` is a complete Linux x64 browser: it contains Astra's production application, native SQLite module, Electron/Chromium runtime, licenses, locales, and executable. Two clean builders must produce the exact same SHA-256 digest, byte for byte. This is not a source archive or a checksum supplied by the same opaque build server.

AppImage, Debian, NSIS, DMG, and macOS ZIP packages remain install conveniences with native execution tests. They are **not currently claimed as bit-reproducible** because their packaging/signing containers include metadata Astra does not yet control across hosts. Their hashes prove download integrity only. The verified tarball is the release-blocking reproducible binary for supported Linux x64 systems.

## Rebuild a tagged release

Requirements: Git, ordinary Docker with Linux/amd64 container support, about 4 GB of free disk space, and network access to fetch content-addressed npm/Electron inputs. Docker Buildx is not required.

```sh
git clone https://github.com/hexa3/astra.git
cd astra
git checkout <release-tag>
npm run package:reproducible:container
cd release/reproduced
sha256sum --check *.sha256
```

Download the identically named `.tar.gz` from that GitHub release and compare it directly:

```sh
sha256sum astra-*-linux-x64-reproducible.tar.gz /path/to/downloaded/astra-*-linux-x64-reproducible.tar.gz
cmp astra-*-linux-x64-reproducible.tar.gz /path/to/downloaded/astra-*-linux-x64-reproducible.tar.gz
```

Both hashes must match and `cmp` must print nothing. To run the rebuilt browser:

```sh
tar -xzf astra-*-linux-x64-reproducible.tar.gz
./astra/astra-browser
```

Chromium's normal Linux sandbox requirements still apply. Do not add `--no-sandbox` to work around a host that disables unprivileged user namespaces.

## Why the bytes are deterministic

- `Dockerfile.reproducible` names the exact multi-platform image digest for Node 24.8.0 on Debian 12; the build requests Linux/amd64 explicitly.
- `package-lock.json` pins npm inputs with integrity hashes. Electron 44.2.0 is exact and its downloader validates the upstream runtime checksum.
- Vite/esbuild production output does not embed build time or checkout path.
- `SOURCE_DATE_EPOCH` is the tagged Git commit timestamp, not wall-clock time.
- GNU tar receives a sorted path list, one timestamp for every member, numeric `0:0` ownership, and a fixed archive format. `gzip -n -9` omits filename and timestamp metadata.
- The checksum is produced only after the runnable archive is complete.

The Docker image itself is not a release artifact and need not have a stable image ID; Docker layer timestamps do not enter the canonical tarball.

## Independent CI evidence and release blocking

`.github/workflows/reproducible.yml` builds the artifact on two separate clean GitHub runners and fails unless every archive byte and emitted manifest match. On a published-release event, it also downloads the public asset and compares it with the source rebuild.

Releases use the manual `Verify and publish reproducible release` workflow. Given an existing semantic-version tag, two independent jobs rebuild it. The publish job cannot run unless their bytes match; only that final job receives `contents: write`, uploads the verified result to a draft, and then publishes it. A maintainer cannot obtain a green result by supplying an expected hash.

## Reproduce without Docker

`SOURCE_DATE_EPOCH=<tag-commit-time> npm run package:reproducible` runs the canonical packager on a Linux x64 host. This is useful for diagnosis, but only the digest-pinned container is the documented reference environment. Different compilers or npm versions can otherwise change native dependency bytes.

If a comparison fails, keep both archives, compare `tar -tvf` metadata, extract into separate directories, and use `diff -qr` to isolate the input. Never update a published checksum to bless unexplained bytes; fix the source of nondeterminism and rebuild the release under a new tag.
