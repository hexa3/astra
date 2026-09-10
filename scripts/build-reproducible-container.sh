#!/bin/sh
# SPDX-License-Identifier: MPL-2.0
set -eu

ASTRA_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ASTRA_ROOT"

for ASTRA_TOOL in docker git id; do
  if ! command -v "$ASTRA_TOOL" >/dev/null 2>&1; then
    echo "required container-build tool is missing: $ASTRA_TOOL" >&2
    exit 1
  fi
done

ASTRA_COMMIT=$(git rev-parse --verify HEAD)
ASTRA_EPOCH=$(git log -1 --format=%ct "$ASTRA_COMMIT")
ASTRA_IMAGE="astra-reproducible:${ASTRA_COMMIT}"
ASTRA_OUTPUT_DIR=${ASTRA_CONTAINER_OUTPUT_DIR:-"$ASTRA_ROOT/release/reproduced"}

mkdir -p "$ASTRA_OUTPUT_DIR"
docker build \
  --platform=linux/amd64 \
  --file Dockerfile.reproducible \
  --build-arg "SOURCE_DATE_EPOCH=$ASTRA_EPOCH" \
  --tag "$ASTRA_IMAGE" \
  .
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$ASTRA_OUTPUT_DIR:/result" \
  "$ASTRA_IMAGE" \
  sh -c 'cp /output/. /result/'

echo "Reproduced Astra commit $ASTRA_COMMIT in $ASTRA_OUTPUT_DIR"
