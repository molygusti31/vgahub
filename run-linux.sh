#!/usr/bin/env bash
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$APP_DIR"

if [ -x "$APP_DIR/node" ]; then
  NODE="$APP_DIR/node"
elif command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
else
  echo "Node.js 20+ belum terpasang." >&2
  exit 1
fi

if ! "$NODE" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  echo "Aplikasi membutuhkan Node.js versi 20 atau lebih baru." >&2
  exit 1
fi

exec "$NODE" server_marugo.js
