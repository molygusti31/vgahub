#!/usr/bin/env bash
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_BINARY="$APP_DIR/Dashboard"
MANAGER_PID_FILE="$APP_DIR/manager.pid"
MANAGER_PORT_FILE="$APP_DIR/manager.port"
MANAGER_LOG="$APP_DIR/manager.log"
DEFAULT_PORT="${PORT:-3000}"

if [ ! -x "$APP_BINARY" ]; then
  echo "Executable pengelola tidak ditemukan di $APP_DIR." >&2
  exit 1
fi

is_manager_ready() {
  [ -r "$MANAGER_PORT_FILE" ] || return 1
  IFS= read -r MANAGER_PORT < "$MANAGER_PORT_FILE" || true
  case "${MANAGER_PORT:-}" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$MANAGER_PORT" -ge 1 ] && [ "$MANAGER_PORT" -le 65535 ] || return 1
  exec 3<>"/dev/tcp/127.0.0.1/$MANAGER_PORT" || return 1
  HTTP_STATUS=""
  printf 'GET /api/state HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n' >&3
  IFS= read -r HTTP_STATUS <&3 || true
  exec 3>&-
  case "${HTTP_STATUS:-}" in
    *" 200 "*) return 0 ;;
    *) return 1 ;;
  esac
}

if ! is_manager_ready; then
  rm -f "$MANAGER_PORT_FILE"
  (
    cd "$APP_DIR"
    nohup env PORT="$DEFAULT_PORT" "$APP_BINARY" --manager \
      >>"$MANAGER_LOG" 2>&1 </dev/null &
  )

  for attempt in {1..60}; do
    if is_manager_ready; then
      break
    fi
    sleep 0.25
  done
fi

if ! is_manager_ready; then
  echo "Pengelola dashboard gagal dijalankan. Periksa log: $MANAGER_LOG" >&2
  exit 1
fi

MANAGER_PORT="$(tr -d '\r\n' < "$MANAGER_PORT_FILE")"
CONTROL_CENTER_URL="http://127.0.0.1:$MANAGER_PORT/control-center/"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$CONTROL_CENTER_URL" >/dev/null 2>&1 &
elif command -v gio >/dev/null 2>&1; then
  gio open "$CONTROL_CENTER_URL" >/dev/null 2>&1 &
else
  echo "Browser launcher xdg-open atau gio tidak ditemukan." >&2
  echo "Buka URL ini di browser: $CONTROL_CENTER_URL" >&2
  exit 1
fi
