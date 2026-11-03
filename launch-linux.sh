#!/usr/bin/env bash
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_BINARY="$APP_DIR/Dashboard"
GUI_SCRIPT="$APP_DIR/control_center.py"
PYTHON="${PYTHON:-/usr/bin/python3}"
MANAGER_PID_FILE="$APP_DIR/manager.pid"
MANAGER_PORT_FILE="$APP_DIR/manager.port"
MANAGER_LOG="$APP_DIR/manager.log"
DEFAULT_PORT="${PORT:-3000}"

if [ ! -x "$APP_BINARY" ]; then
  echo "Executable Dashboard tidak ditemukan di $APP_DIR." >&2
  exit 1
fi

if [ ! -x "$PYTHON" ] || ! "$PYTHON" -c 'import gi; gi.require_version("Gtk", "4.0"); from gi.repository import Gtk' >/dev/null 2>&1; then
  echo "GUI desktop membutuhkan GTK 4 dan Python GObject Introspection." >&2
  echo "Pasang dependensi dengan: sudo apt install python3-gi gir1.2-gtk-4.0" >&2
  exit 1
fi

if [ ! -r "$GUI_SCRIPT" ]; then
  echo "Aplikasi desktop tidak ditemukan: $GUI_SCRIPT" >&2
  exit 1
fi

is_manager_running() {
  [ -r "$MANAGER_PID_FILE" ] || return 1
  IFS= read -r MANAGER_PID < "$MANAGER_PID_FILE" || true
  case "${MANAGER_PID:-}" in
    ''|*[!0-9]*) rm -f "$MANAGER_PID_FILE"; return 1 ;;
  esac
  MANAGER_ARGS="$(tr '\0' ' ' < "/proc/$MANAGER_PID/cmdline" 2>/dev/null || true)"
  if ! kill -0 "$MANAGER_PID" 2>/dev/null ||
    [ "$(readlink -f "/proc/$MANAGER_PID/exe" 2>/dev/null || true)" != "$(readlink -f "$APP_BINARY")" ] ||
    [ "${MANAGER_ARGS#*--manager}" = "$MANAGER_ARGS" ]; then
    rm -f "$MANAGER_PID_FILE" "$MANAGER_PORT_FILE"
    return 1
  fi
  return 0
}

if ! is_manager_running; then
  rm -f "$MANAGER_PORT_FILE"
  (
    cd "$APP_DIR"
    nohup env PORT="$DEFAULT_PORT" "$APP_BINARY" --manager \
      >>"$MANAGER_LOG" 2>&1 </dev/null &
  )

  for attempt in {1..30}; do
    if [ -r "$MANAGER_PORT_FILE" ] &&
      is_manager_running; then
      break
    fi
    if [ -r "$MANAGER_PID_FILE" ] && ! is_manager_running; then
      break
    fi
    sleep 1
  done
fi

if ! is_manager_running || [ ! -r "$MANAGER_PORT_FILE" ]; then
  echo "Pengelola dashboard gagal dijalankan. Periksa log: $MANAGER_LOG" >&2
  exit 1
fi

exec "$PYTHON" "$GUI_SCRIPT"
