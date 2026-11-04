#!/usr/bin/env bash
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/dist"
PACKAGE_DIR="$OUTPUT_DIR/Dashboard-Ubuntu"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 20+ dan npm harus terpasang sebelum build." >&2
  exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "tar tidak ditemukan." >&2
  exit 1
fi

NODE_PLATFORM="$(node -p 'process.platform')"
if [ "$NODE_PLATFORM" != "linux" ]; then
  echo "Build Linux memerlukan Node.js Linux; Node.js yang aktif berjalan di '$NODE_PLATFORM'." >&2
  echo "Di WSL, pastikan Node.js/npm Linux terpasang dan command -v node mengarah ke instalasi Linux." >&2
  echo "node: $(command -v node)" >&2
  echo "npm:  $(command -v npm)" >&2
  exit 1
fi

if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  echo "Build membutuhkan Node.js versi 20 atau lebih baru." >&2
  exit 1
fi

DEB_ARCH="$(dpkg --print-architecture)"
case "$DEB_ARCH:$(node -p 'process.arch')" in
  amd64:x64) PKG_ARCH="x64" ;;
  arm64:arm64) PKG_ARCH="arm64" ;;
  *)
    echo "Arsitektur build tidak didukung: Debian '$DEB_ARCH', Node.js '$(node -p 'process.arch')'." >&2
    echo "Build mendukung amd64/x64 dan arm64/arm64." >&2
    exit 1
    ;;
esac

if [ ! -x "$SCRIPT_DIR/node_modules/.bin/pkg" ]; then
  echo "Tool pkg belum terpasang. Jalankan npm install di folder proyek." >&2
  exit 1
fi

APP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/dashboard-linux-build.XXXXXX")"
trap 'rm -rf "$APP_DIR"' EXIT
cp "$SCRIPT_DIR/server_marugo.js" "$SCRIPT_DIR/database_marugo.js" \
  "$SCRIPT_DIR/dashboard-launcher.js" "$SCRIPT_DIR/manager.js" \
  "$SCRIPT_DIR/package.json" "$SCRIPT_DIR/package-lock.json" "$APP_DIR/"
cp -R "$SCRIPT_DIR/control-center" "$SCRIPT_DIR/public" "$APP_DIR/"
npm ci --omit=dev --ignore-scripts=false --prefix "$APP_DIR"

if ! (cd "$APP_DIR" && node -e 'const Database = require("better-sqlite3"); const db = new Database(":memory:"); db.close()'); then
  echo "Modul native better-sqlite3 tidak berhasil dipasang untuk Linux." >&2
  echo "Pastikan build-essential dan python3 tersedia, lalu jalankan ulang build: npm run build:linux." >&2
  exit 1
fi

"$SCRIPT_DIR/node_modules/.bin/pkg" "$APP_DIR/dashboard-launcher.js" \
  --targets "node22-linux-$PKG_ARCH" \
  --output "$APP_DIR/Dashboard" \
  --compress Brotli

if [ ! -x "$APP_DIR/Dashboard" ]; then
  echo "Executable pengelola Linux tidak berhasil dibuat." >&2
  exit 1
fi

mkdir -p "$PACKAGE_DIR"
rm -f "$PACKAGE_DIR/control_center.py"
cp "$APP_DIR/Dashboard" "$SCRIPT_DIR/launch-linux.sh" \
  "$PACKAGE_DIR/"
cp -R "$SCRIPT_DIR/control-center" "$PACKAGE_DIR/"
cp "$SCRIPT_DIR/public/vgahub.png" "$PACKAGE_DIR/icon.png"
cat > "$PACKAGE_DIR/README.txt" <<'EOF'
Dashboard Timbangan untuk Ubuntu/Linux

Jalankan launch-linux.sh untuk membuka Control Center di browser default.
Antarmuka Control Center dibuat dengan HTML, CSS, dan JavaScript di folder
control-center. Browser modern diperlukan; Python dan GTK tidak diperlukan.
Folder ini tidak perlu dipasang dan dapat dipindahkan.
Port, database, dan log disimpan di folder ini.
Folder aplikasi harus dapat ditulis.

Kode aplikasi dipaketkan sebagai executable. Ini menyamarkan source biasa,
tetapi bukan enkripsi dan tidak mencegah analisis atau modifikasi oleh pihak
yang memiliki paket.
EOF
chmod +x "$PACKAGE_DIR/Dashboard" "$PACKAGE_DIR/launch-linux.sh"

PACKAGE_FILE="$OUTPUT_DIR/Dashboard-Ubuntu-$DEB_ARCH.tar.gz"
rm -f "$PACKAGE_FILE"
tar -C "$OUTPUT_DIR" -czf "$PACKAGE_FILE" \
  --exclude='Dashboard-Ubuntu/db_marugo.db' \
  --exclude='Dashboard-Ubuntu/manager.pid' \
  --exclude='Dashboard-Ubuntu/manager.port' \
  --exclude='Dashboard-Ubuntu/manager.log' \
  --exclude='Dashboard-Ubuntu/server.pid' \
  --exclude='Dashboard-Ubuntu/server.log' \
  --exclude='Dashboard-Ubuntu/port.conf' \
  "Dashboard-Ubuntu"

echo
echo "Paket portabel selesai: $PACKAGE_FILE"
echo "Ekstrak arsip, lalu jalankan launch-linux.sh untuk membuka Control Center."
