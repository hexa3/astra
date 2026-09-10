#!/bin/sh
# SPDX-License-Identifier: MPL-2.0
set -eu

export LC_ALL=C
export TZ=UTC

ASTRA_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ASTRA_ROOT"

if [ -n "${SOURCE_DATE_EPOCH:-}" ]; then
  ASTRA_EPOCH=$SOURCE_DATE_EPOCH
elif command -v git >/dev/null 2>&1; then
  ASTRA_EPOCH=$(git log -1 --format=%ct)
else
  echo "SOURCE_DATE_EPOCH is required outside a Git checkout" >&2
  exit 1
fi

case "$ASTRA_EPOCH" in
  ''|*[!0-9]*)
    echo "SOURCE_DATE_EPOCH must be an integer Unix timestamp" >&2
    exit 1
    ;;
esac

for ASTRA_TOOL in node npm tar gzip sha256sum mktemp; do
  if ! command -v "$ASTRA_TOOL" >/dev/null 2>&1; then
    echo "required build tool is missing: $ASTRA_TOOL" >&2
    exit 1
  fi
done

if ! tar --version 2>/dev/null | head -n 1 | grep -q 'GNU tar'; then
  echo "the reproducible package requires GNU tar" >&2
  exit 1
fi

ASTRA_VERSION=$(node -p "require('./package.json').version")
ASTRA_OUTPUT_DIR=${ASTRA_REPRO_OUTPUT_DIR:-"$ASTRA_ROOT/release/reproducible"}
ASTRA_TMP_BASE=${TMPDIR:-/tmp}
ASTRA_STAGE=$(mktemp -d "$ASTRA_TMP_BASE/astra-repro.XXXXXXXX")

cleanup() {
  case "$ASTRA_STAGE" in
    "$ASTRA_TMP_BASE"/astra-repro.*) rm -rf -- "$ASTRA_STAGE" ;;
    *) echo "refusing to remove unexpected temporary path: $ASTRA_STAGE" >&2 ;;
  esac
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$ASTRA_OUTPUT_DIR"
npm run build
npx electron-builder --linux dir --x64 --publish never \
  --config.directories.output="$ASTRA_STAGE"

if [ ! -x "$ASTRA_STAGE/linux-unpacked/astra-browser" ]; then
  echo "electron-builder did not produce the expected Linux x64 executable" >&2
  exit 1
fi

for ASTRA_VARIANT in default minimal; do
  ASTRA_NAME="astra-${ASTRA_VERSION}-${ASTRA_VARIANT}-linux-x64-reproducible.tar.gz"
  ASTRA_VARIANT_STAGE="$ASTRA_STAGE/variant-$ASTRA_VARIANT"
  mkdir -p "$ASTRA_VARIANT_STAGE"
  cp -a "$ASTRA_STAGE/linux-unpacked" "$ASTRA_VARIANT_STAGE/astra"
  mv "$ASTRA_VARIANT_STAGE/astra/astra-browser" "$ASTRA_VARIANT_STAGE/astra/astra-core"
  cp "$ASTRA_ROOT/packaging/launchers/astra-$ASTRA_VARIANT" "$ASTRA_VARIANT_STAGE/astra/astra-browser"
  chmod 0755 "$ASTRA_VARIANT_STAGE/astra/astra-browser"

  tar --sort=name \
    --format=gnu \
    --mtime="@$ASTRA_EPOCH" \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    -C "$ASTRA_VARIANT_STAGE" \
    -cf "$ASTRA_STAGE/astra-$ASTRA_VARIANT.tar" astra
  gzip -n -9 -c "$ASTRA_STAGE/astra-$ASTRA_VARIANT.tar" > "$ASTRA_OUTPUT_DIR/$ASTRA_NAME"
  (
    cd "$ASTRA_OUTPUT_DIR"
    sha256sum "$ASTRA_NAME" > "$ASTRA_NAME.sha256"
  )
  echo "$ASTRA_OUTPUT_DIR/$ASTRA_NAME"
  cat "$ASTRA_OUTPUT_DIR/$ASTRA_NAME.sha256"
done
