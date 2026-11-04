#!/usr/bin/python3
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

APP_DIR = (
    os.path.dirname(sys.executable)
    if getattr(sys, "frozen", False)
    else os.path.dirname(os.path.abspath(__file__))
)
DLL_DIRECTORY_HANDLES = []

if os.name == "nt":
    runtime_bin = os.path.join(APP_DIR, "bin")
    if os.path.isdir(runtime_bin):
        os.environ["PATH"] = runtime_bin + os.pathsep + os.environ.get("PATH", "")
        DLL_DIRECTORY_HANDLES.append(os.add_dll_directory(runtime_bin))
        os.environ["GTK_EXE_PREFIX"] = APP_DIR
        os.environ["GTK_DATA_PREFIX"] = APP_DIR
        os.environ["GI_TYPELIB_PATH"] = os.path.join(
            APP_DIR, "lib", "girepository-1.0"
        )
        os.environ["GTK_PATH"] = os.path.join(APP_DIR, "lib", "gtk-4.0")
        os.environ["GSETTINGS_SCHEMA_DIR"] = os.path.join(
            APP_DIR, "share", "glib-2.0", "schemas"
        )
        os.environ["XDG_DATA_DIRS"] = os.path.join(APP_DIR, "share")

import gi

gi.require_version("Gdk", "4.0")
gi.require_version("Gtk", "4.0")
from gi.repository import Gdk, GLib, Gtk


MANAGER_PORT_FILE = os.path.join(APP_DIR, "manager.port")
API = None
WORKERS = ThreadPoolExecutor(max_workers=3)

CSS = b"""
window, .app-background { background-color: #101725; color: #e7eefb; }
label { color: #e7eefb; }
.topbar { background: #111a29; border-bottom: 1px solid #263449; padding: 17px 24px; }
.brand { font-size: 19px; font-weight: 700; color: #f1f5fb; }
.brand-caption { color: #8292aa; font-size: 10px; letter-spacing: 1.4px; }
.eyebrow { color: #83dcbf; font-size: 10px; letter-spacing: 2px; }
.hero-title { font-size: 34px; font-weight: 700; }
.hero-subtitle, .muted { color: #94a3b8; }
.card { background: #1a2638; border: 1px solid #2a394f; border-radius: 14px; padding: 20px; }
.card-title { font-size: 15px; font-weight: 700; }
.card-subtitle { color: #94a3b8; font-size: 11px; }
.field-label { color: #9cabc0; font-size: 10px; letter-spacing: 1.1px; }
entry, spinbutton { background: #101725; color: #f1f5fb; border: 1px solid #34445a; border-radius: 8px; padding: 9px 11px; }
entry:focus, spinbutton:focus { border-color: #73e5bd; }
.status { background: #273448; border-radius: 999px; padding: 7px 12px; color: #bac6d8; font-size: 11px; }
.status.running { background: #153b35; color: #91e8c5; }
.status.busy { background: #493921; color: #f1cb88; }
button { background: #29364a; color: #eef4fc; border: 1px solid #3a4b63; border-radius: 8px; padding: 10px 16px; font-weight: 700; }
button:hover { background: #33445b; }
button.start { background: #70dfb8; color: #10251e; border-color: #70dfb8; }
button.start:hover { background: #8aebc8; }
button.stop { background: #de686d; color: white; border-color: #de686d; }
button.stop:hover { background: #ed777b; }
button:disabled { background: #29364a; color: #8290a4; border-color: #34445a; }
.terminal { background: #0b111b; border: 1px solid #28364b; border-radius: 9px; padding: 12px; }
.terminal-toolbar { color: #91a1b7; font-size: 10px; padding-bottom: 8px; }
.terminal-view { background: #0b111b; color: #cbd6e4; font-family: monospace; font-size: 11px; }
.terminal-status { color: #80dfba; font-size: 10px; }
.footnote { color: #738299; font-size: 9px; letter-spacing: 1px; }
"""


def api_request(path, body=None, timeout=1.5):
    payload = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        API + path,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="GET" if body is None else "POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        message = json.loads(error.read().decode("utf-8"))
        raise RuntimeError(message.get("error", str(error))) from error


def install_styles():
    provider = Gtk.CssProvider()
    provider.load_from_data(CSS)
    Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(),
        provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
    )


class ControlCenter(Gtk.Application):
    def __init__(self):
        super().__init__(application_id="com.vgahub.weighing-dashboard")
        self.window = None
        self.port = 3000
        self.status = "stopped"
        self.operation_in_progress = False
        self.polling = False
        self.log_offset = 0
        self.partial_mark = None

    def do_activate(self):
        if self.window:
            self.window.present()
            return

        install_styles()
        self.build_window()
        self.window.present()
        self.poll_state()
        GLib.timeout_add(850, self.refresh)

    @staticmethod
    def label(text, style=None):
        widget = Gtk.Label(label=text)
        widget.set_xalign(0)
        if style:
            widget.add_css_class(style)
        return widget

    def build_window(self):
        self.window = Gtk.ApplicationWindow(application=self)
        self.window.set_title("Dashboard Timbangan · Control Center")
        self.window.set_default_size(860, 760)
        self.window.set_size_request(540, 620)

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        root.add_css_class("app-background")
        self.window.set_child(root)

        topbar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        topbar.add_css_class("topbar")
        brand = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        brand.append(self.label("VGAHub", "brand"))
        brand.append(self.label("WEIGHING CONTROL", "brand-caption"))
        topbar.append(brand)
        topbar.append(Gtk.Box(hexpand=True))
        topbar.append(self.label("●  SISTEM LOKAL", "status"))
        root.append(topbar)

        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        page.set_margin_top(30)
        page.set_margin_bottom(22)
        page.set_margin_start(28)
        page.set_margin_end(28)
        root.append(page)

        page.append(self.label("CONTROL CENTER", "eyebrow"))
        page.append(self.label("Dashboard Timbangan", "hero-title"))
        page.append(
            self.label(
                "Kelola server dan pantau aktivitas aplikasi dalam satu tempat.",
                "hero-subtitle",
            )
        )

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=17)
        card.add_css_class("card")
        page.append(card)

        heading = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        heading.append(self.label("▣", "brand"))
        title_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
        title_box.append(self.label("Server aplikasi", "card-title"))
        title_box.append(self.label("Atur koneksi dashboard lokal Anda", "card-subtitle"))
        heading.append(title_box)
        heading.append(Gtk.Box(hexpand=True))
        self.status_badge = self.label("Menghubungkan", "status")
        heading.append(self.status_badge)
        card.append(heading)

        divider = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        card.append(divider)

        controls = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=14)
        card.append(controls)

        port_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=7)
        port_box.set_hexpand(True)
        port_box.append(self.label("PORT SERVER", "field-label"))
        self.port_input = Gtk.SpinButton.new_with_range(1, 65535, 1)
        self.port_input.set_numeric(True)
        self.port_input.set_value(self.port)
        self.port_input.connect("value-changed", self.on_port_changed)
        port_box.append(self.port_input)
        port_box.append(self.label("Port lokal antara 1–65535", "card-subtitle"))
        controls.append(port_box)

        self.toggle_button = Gtk.Button(label="▶   Start server")
        self.toggle_button.add_css_class("start")
        self.toggle_button.set_size_request(190, 44)
        self.toggle_button.set_valign(Gtk.Align.CENTER)
        self.toggle_button.set_margin_top(20)
        self.toggle_button.connect("clicked", self.on_toggle)
        controls.append(self.toggle_button)

        self.notice = self.label("", "card-subtitle")
        self.notice.set_wrap(True)
        card.append(self.notice)

        terminal_card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        terminal_card.add_css_class("card")
        page.append(terminal_card)

        terminal_header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        terminal_title = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
        terminal_title.append(self.label("⌘   Terminal", "card-title"))
        terminal_title.append(self.label("Output server secara langsung", "card-subtitle"))
        terminal_header.append(terminal_title)
        terminal_header.append(Gtk.Box(hexpand=True))
        terminal_header.append(self.label("● LIVE", "terminal-status"))
        terminal_card.append(terminal_header)

        terminal_shell = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        terminal_shell.add_css_class("terminal")
        terminal_card.append(terminal_shell)

        terminal_bar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        terminal_bar.add_css_class("terminal-toolbar")
        terminal_bar.append(self.label("●  ●  ●", "terminal-toolbar"))
        terminal_bar.append(self.label("dashboard-server  ~/weighing-app", "terminal-toolbar"))
        terminal_bar.append(Gtk.Box(hexpand=True))
        clear_button = Gtk.Button(label="Bersihkan")
        clear_button.connect("clicked", self.on_clear_terminal)
        terminal_bar.append(clear_button)
        terminal_shell.append(terminal_bar)

        scroller = Gtk.ScrolledWindow()
        scroller.set_min_content_height(280)
        scroller.set_max_content_height(420)
        scroller.set_vexpand(True)
        scroller.add_css_class("terminal")
        self.terminal_buffer = Gtk.TextBuffer()
        self.terminal_view = Gtk.TextView(buffer=self.terminal_buffer)
        self.terminal_view.set_editable(False)
        self.terminal_view.set_cursor_visible(False)
        self.terminal_view.set_monospace(True)
        self.terminal_view.set_wrap_mode(Gtk.WrapMode.WORD_CHAR)
        self.terminal_view.add_css_class("terminal-view")
        scroller.set_child(self.terminal_view)
        terminal_shell.append(scroller)

        terminal_footer = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        terminal_footer.append(self.label("●  Terminal terhubung", "terminal-status"))
        terminal_footer.append(Gtk.Box(hexpand=True))
        terminal_footer.append(self.label("LOCAL SESSION", "footnote"))
        terminal_card.append(terminal_footer)

        page.append(Gtk.Box(vexpand=True))
        footer = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        footer.append(self.label("VGAHub  /  Weighing Scale Dashboard", "footnote"))
        footer.append(Gtk.Box(hexpand=True))
        footer.append(self.label("RUNS LOCALLY ON YOUR DEVICE", "footnote"))
        page.append(footer)

    def set_notice(self, message):
        self.notice.set_text(message)

    def update_state(self, result):
        self.status = result.get("status", "stopped")
        self.port = result.get("port", self.port)
        if self.port_input.get_value_as_int() != self.port:
            self.port_input.set_value(self.port)

        states = {
            "running": ("●  Server aktif", "running", "■   Stop server", "stop"),
            "starting": ("◌  Memulai server", "busy", "Memulai...", "busy"),
            "stopping": ("◌  Menghentikan", "busy", "Menghentikan...", "busy"),
            "stopped": ("●  Server berhenti", "", "▶   Start server", "start"),
        }
        status_text, status_style, button_text, button_style = states.get(
            self.status, ("●  Server berhenti", "", "▶   Start server", "start")
        )
        self.status_badge.set_text(status_text)
        self.status_badge.remove_css_class("running")
        self.status_badge.remove_css_class("busy")
        if status_style:
            self.status_badge.add_css_class(status_style)
        self.toggle_button.set_label(button_text)
        self.toggle_button.remove_css_class("start")
        self.toggle_button.remove_css_class("stop")
        if button_style in ("start", "stop"):
            self.toggle_button.add_css_class(button_style)
        self.toggle_button.set_sensitive(
            not self.operation_in_progress and self.status not in ("starting", "stopping")
        )
        self.port_input.set_sensitive(
            not self.operation_in_progress and self.status not in ("running", "starting", "stopping")
        )
        if result.get("error"):
            self.set_notice(result["error"])

    def poll_state(self):
        if self.polling:
            return
        self.polling = True

        def fetch_state():
            try:
                state = api_request("/api/state")
                GLib.idle_add(self.apply_state, state)
            except Exception as error:
                GLib.idle_add(self.apply_error, str(error))
            finally:
                GLib.idle_add(self.finish_poll)

        WORKERS.submit(fetch_state)

    def apply_state(self, state):
        self.update_state(state)
        return GLib.SOURCE_REMOVE

    def apply_error(self, message):
        self.set_notice(f"Tidak dapat terhubung ke pengelola: {message}")
        return GLib.SOURCE_REMOVE

    def finish_poll(self):
        self.polling = False
        return GLib.SOURCE_REMOVE

    def refresh(self):
        self.poll_state()
        self.poll_logs()
        return GLib.SOURCE_CONTINUE

    def poll_logs(self):
        def fetch_logs():
            try:
                result = api_request(f"/api/logs?from={self.log_offset}")
                GLib.idle_add(self.append_logs, result)
            except Exception:
                pass

        WORKERS.submit(fetch_logs)

    def append_logs(self, result):
        if self.partial_mark is not None:
            start = self.terminal_buffer.get_iter_at_mark(self.partial_mark)
            end = self.terminal_buffer.get_end_iter()
            self.terminal_buffer.delete(start, end)
        for line in result.get("lines", []):
            self.append_terminal_line(line)
        self.log_offset = result.get("offset", self.log_offset)
        partial = result.get("partial", "")
        if partial:
            end = self.terminal_buffer.get_end_iter()
            self.partial_mark = self.terminal_buffer.create_mark(None, end, True)
            self.terminal_buffer.insert(end, partial)
            self.scroll_terminal()
        else:
            end = self.terminal_buffer.get_end_iter()
            self.partial_mark = self.terminal_buffer.create_mark(None, end, True)
        return GLib.SOURCE_REMOVE

    def append_terminal_line(self, line):
        end = self.terminal_buffer.get_end_iter()
        self.terminal_buffer.insert(end, f"{line}\n")
        if self.terminal_buffer.get_line_count() > 900:
            start = self.terminal_buffer.get_start_iter()
            remove_end = self.terminal_buffer.get_iter_at_line(200)
            self.terminal_buffer.delete(start, remove_end)
        self.scroll_terminal()

    def scroll_terminal(self):
        end = self.terminal_buffer.get_end_iter()
        self.terminal_view.scroll_to_iter(end, 0, False, 0, 0)

    def on_clear_terminal(self, _button):
        self.terminal_buffer.set_text("")
        end = self.terminal_buffer.get_end_iter()
        self.partial_mark = self.terminal_buffer.create_mark(None, end, True)

    def on_port_changed(self, spin_button):
        if self.status != "stopped" or self.operation_in_progress:
            return
        port = spin_button.get_value_as_int()
        self.operation_in_progress = True
        self.toggle_button.set_sensitive(False)

        def save_port():
            try:
                result = api_request("/api/port", {"port": port})
                GLib.idle_add(self.port_saved, result)
            except Exception as error:
                GLib.idle_add(self.operation_failed, str(error))

        WORKERS.submit(save_port)

    def port_saved(self, result):
        self.operation_in_progress = False
        self.update_state(result)
        self.set_notice(f"Port {result['port']} berhasil disimpan.")
        return GLib.SOURCE_REMOVE

    def operation_failed(self, message):
        self.operation_in_progress = False
        self.set_notice(message)
        self.poll_state()
        return GLib.SOURCE_REMOVE

    def on_toggle(self, _button):
        if self.operation_in_progress:
            return
        action = "stop" if self.status == "running" else "start"
        requested_port = self.port_input.get_value_as_int()
        self.operation_in_progress = True
        if action == "start":
            self.update_state(
                {
                    "status": "starting",
                    "port": requested_port,
                    "url": "",
                }
            )
        else:
            self.update_state({"status": "stopping", "port": self.port, "url": ""})
        self.set_notice("")

        def toggle_server():
            try:
                if action == "start":
                    result = api_request("/api/start", {"port": requested_port}, timeout=12)
                else:
                    result = api_request("/api/stop", {}, timeout=3)
                GLib.idle_add(self.toggle_complete, result)
            except Exception as error:
                GLib.idle_add(self.operation_failed, str(error))

        WORKERS.submit(toggle_server)

    def toggle_complete(self, result):
        self.operation_in_progress = False
        self.update_state(result)
        if result.get("status") == "running":
            self.set_notice(f"Dashboard berjalan pada http://127.0.0.1:{result['port']}/")
        self.poll_logs()
        return GLib.SOURCE_REMOVE


def main():
    global API
    try:
        if os.name == "nt":
            try:
                manager_port = get_manager_port()
            except (OSError, ValueError):
                manager_port = None
            if manager_port is None or not manager_is_available(manager_port):
                manager_port = start_windows_manager()
        else:
            manager_port = get_manager_port()
    except (OSError, ValueError, RuntimeError) as error:
        message = f"Pengelola dashboard belum berjalan: {error}"
        if os.name == "nt":
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, message, "Dashboard Timbangan", 0x10)
        else:
            print(message, file=sys.stderr)
        return 1

    API = f"http://127.0.0.1:{manager_port}"
    app = ControlCenter()
    try:
        return app.run(None)
    finally:
        WORKERS.shutdown(wait=False, cancel_futures=True)


def get_manager_port():
    with open(MANAGER_PORT_FILE, "r", encoding="utf-8") as file:
        manager_port = int(file.read().strip())
    if not 1 <= manager_port <= 65535:
        raise ValueError("Port pengelola tidak valid.")
    return manager_port


def manager_is_available(port):
    try:
        with urllib.request.urlopen(
            f"http://127.0.0.1:{port}/api/state", timeout=1
        ):
            return True
    except (OSError, urllib.error.URLError, ValueError):
        return False


def start_windows_manager():
    manager_executable = os.path.join(APP_DIR, "Dashboard.exe")
    if not os.path.isfile(manager_executable):
        raise RuntimeError(f"Executable pengelola tidak ditemukan: {manager_executable}")

    log_path = os.path.join(APP_DIR, "manager.log")
    with open(log_path, "a", encoding="utf-8") as manager_log:
        subprocess.Popen(
            [manager_executable, "--manager"],
            cwd=APP_DIR,
            stdin=subprocess.DEVNULL,
            stdout=manager_log,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )

    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        try:
            manager_port = get_manager_port()
        except (OSError, ValueError):
            time.sleep(0.25)
            continue
        if manager_is_available(manager_port):
            return manager_port
        time.sleep(0.25)

    raise RuntimeError(f"Pengelola gagal dijalankan. Periksa log: {log_path}")


if __name__ == "__main__":
    raise SystemExit(main())
