#!/usr/bin/env sh
set -eu
borderless_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$borderless_root"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 24 LTS, then run this launcher again.' >&2
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci --omit=dev --ignore-scripts
fi
exec node server/index.mjs
