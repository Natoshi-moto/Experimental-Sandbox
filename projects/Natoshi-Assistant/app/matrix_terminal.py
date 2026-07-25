#!/usr/bin/env python3
"""MATRIX TERMINAL — always-on-top floating chat overlay.

Draggable · resizable · multi-model · web search · local reminders.
No Lab / FORGE / alarm protocol. Just a sick floating pane.
"""

from __future__ import annotations

import json
import os
import queue
import random
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import tkinter as tk
from tkinter import messagebox, ttk

# --------------------------------------------------------------------------- #
# Paths / config
# --------------------------------------------------------------------------- #
APP_DIR = Path(__file__).resolve().parent
CONFIG_PATH = APP_DIR / "config.json"
HISTORY_PATH = APP_DIR / "history.jsonl"
STATE_PATH = APP_DIR / "window_state.json"

DEFAULT_CONFIG: dict[str, Any] = {
    "providers": {
        "ollama": {
            "type": "ollama",
            "base_url": "http://127.0.0.1:11434",
            "models": [],  # filled live
        },
        "xai": {
            "type": "openai_compatible",
            "base_url": "https://api.x.ai/v1",
            "api_key_env": "XAI_API_KEY",
            "models": ["grok-4.5", "grok-3", "grok-3-mini"],
        },
        "deepseek": {
            "type": "openai_compatible",
            "base_url": "https://api.deepseek.com",
            "api_key_env": "DEEPSEEK_API_KEY",
            "models": ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-flash"],
        },
        "openai": {
            "type": "openai_compatible",
            "base_url": "https://api.openai.com/v1",
            "api_key_env": "OPENAI_API_KEY",
            "models": ["gpt-4o", "gpt-4o-mini"],
        },
        "custom": {
            "type": "openai_compatible",
            "base_url": "http://127.0.0.1:8000/v1",
            "api_key_env": "CUSTOM_API_KEY",
            "models": ["local-model"],
        },
    },
    "default_provider": "ollama",
    "default_model": "",
    "system_prompt": (
        "You are MATRIX TERMINAL — a concise, sharp overlay assistant. "
        "User is multitasking. Be useful, short when possible, dense when needed. "
        "If they ask to search, use provided web results. "
        "If they set a reminder, confirm time clearly."
    ),
    "opacity": 0.94,
    "always_on_top": True,
    "max_history_messages": 40,
}

# Matrix palette
BG = "#030805"
BG2 = "#06120a"
FG = "#00ff66"
FG_DIM = "#0a7a38"
FG_SOFT = "#7dffb0"
FG_USER = "#b8ffd9"
ACCENT = "#00cc55"
RED = "#ff3355"
AMBER = "#ffcc33"
FONT = ("JetBrains Mono", 11)
FONT_SM = ("JetBrains Mono", 9)
FONT_LG = ("JetBrains Mono", 12, "bold")
FONT_FALLBACK = ("DejaVu Sans Mono", 11)


def load_config() -> dict[str, Any]:
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if CONFIG_PATH.exists():
        try:
            user = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            deep_merge(cfg, user)
        except Exception:
            pass
    return cfg


def save_config(cfg: dict[str, Any]) -> None:
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")


def deep_merge(base: dict, overlay: dict) -> None:
    for k, v in overlay.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v


def http_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: dict | None = None,
    timeout: float = 120.0,
) -> Any:
    data = None
    hdrs = {"User-Agent": "MatrixTerminal/1.0"}
    if headers:
        hdrs.update(headers)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        return json.loads(raw) if raw.strip() else {}


# --------------------------------------------------------------------------- #
# Providers
# --------------------------------------------------------------------------- #
def list_ollama_models(base_url: str) -> list[str]:
    try:
        d = http_json(f"{base_url.rstrip('/')}/api/tags", timeout=3)
        return [m["name"] for m in d.get("models", [])]
    except Exception:
        return []


def chat_ollama(base_url: str, model: str, messages: list[dict], stream_q: queue.Queue) -> None:
    url = f"{base_url.rstrip('/')}/api/chat"
    body = {"model": model, "messages": messages, "stream": True}
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "MatrixTerminal/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            for raw in resp:
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if chunk.get("error"):
                    stream_q.put(("error", str(chunk["error"])))
                    return
                msg = chunk.get("message") or {}
                content = msg.get("content") or ""
                if content:
                    stream_q.put(("token", content))
                if chunk.get("done"):
                    stream_q.put(("done", None))
                    return
        stream_q.put(("done", None))
    except Exception as e:
        stream_q.put(("error", str(e)))


def chat_openai_compatible(
    base_url: str,
    api_key: str | None,
    model: str,
    messages: list[dict],
    stream_q: queue.Queue,
) -> None:
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "MatrixTerminal/1.0",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    body = {"model": model, "messages": messages, "stream": True}
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            for raw in resp:
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                if line.startswith("data:"):
                    line = line[5:].strip()
                if line == "[DONE]":
                    stream_q.put(("done", None))
                    return
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                content = delta.get("content") or ""
                if content:
                    stream_q.put(("token", content))
                if choices[0].get("finish_reason"):
                    stream_q.put(("done", None))
                    return
        stream_q.put(("done", None))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        stream_q.put(("error", f"HTTP {e.code}: {err[:400]}"))
    except Exception as e:
        stream_q.put(("error", str(e)))


# --------------------------------------------------------------------------- #
# Web search (DuckDuckGo HTML, no key)
# --------------------------------------------------------------------------- #
def web_search(query: str, n: int = 5) -> list[dict[str, str]]:
    q = urllib.parse.quote_plus(query)
    url = f"https://html.duckduckgo.com/html/?q={q}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode("utf-8", errors="replace")
    results: list[dict[str, str]] = []
    # rough parse of DDG HTML results
    for m in re.finditer(
        r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?class="result__snippet"[^>]*>(.*?)</(?:a|td|div)',
        html,
        re.S | re.I,
    ):
        href, title, snip = m.group(1), m.group(2), m.group(3)
        title = re.sub(r"<[^>]+>", "", title).strip()
        snip = re.sub(r"<[^>]+>", "", snip).strip()
        # unwrap ddg redirect
        if "uddg=" in href:
            ud = re.search(r"uddg=([^&]+)", href)
            if ud:
                href = urllib.parse.unquote(ud.group(1))
        results.append({"title": title, "url": href, "snippet": snip})
        if len(results) >= n:
            break
    if not results:
        # fallback simpler pattern
        for m in re.finditer(r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
            href, title = m.group(1), re.sub(r"<[^>]+>", "", m.group(2)).strip()
            if "uddg=" in href:
                ud = re.search(r"uddg=([^&]+)", href)
                if ud:
                    href = urllib.parse.unquote(ud.group(1))
            results.append({"title": title, "url": href, "snippet": ""})
            if len(results) >= n:
                break
    return results


# --------------------------------------------------------------------------- #
# Reminders
# --------------------------------------------------------------------------- #
class ReminderEngine:
    def __init__(self, on_fire):
        self.on_fire = on_fire
        self._lock = threading.Lock()
        self._items: list[dict] = []
        self._stop = threading.Event()
        self._t = threading.Thread(target=self._loop, daemon=True)
        self._t.start()

    def add(self, when: datetime, text: str) -> str:
        rid = f"r{int(time.time()*1000)%1000000}"
        with self._lock:
            self._items.append({"id": rid, "when": when, "text": text, "fired": False})
        return rid

    def list_pending(self) -> list[dict]:
        with self._lock:
            return [i for i in self._items if not i["fired"]]

    def cancel(self, rid: str | None = None) -> int:
        with self._lock:
            if rid is None:
                n = sum(1 for i in self._items if not i["fired"])
                for i in self._items:
                    i["fired"] = True
                return n
            n = 0
            for i in self._items:
                if i["id"] == rid and not i["fired"]:
                    i["fired"] = True
                    n += 1
            return n

    def _loop(self) -> None:
        while not self._stop.is_set():
            now = datetime.now()
            due = []
            with self._lock:
                for i in self._items:
                    if not i["fired"] and i["when"] <= now:
                        i["fired"] = True
                        due.append(i)
            for i in due:
                self.on_fire(i)
                try:
                    subprocess_notify(i["text"])
                except Exception:
                    pass
            time.sleep(0.5)


def subprocess_notify(text: str) -> None:
    import shutil
    import subprocess

    if shutil.which("notify-send"):
        subprocess.Popen(
            ["notify-send", "-u", "critical", "MATRIX REMINDER", text],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def parse_remind(cmd: str) -> tuple[timedelta, str] | None:
    """Parse: /remind 10m take pills | /remind 1h30m call mom | /remind 14:30 standup"""
    raw = cmd.strip()
    m = re.match(r"^/remind\s+(\S+)\s+(.+)$", raw, re.I)
    if not m:
        return None
    when_s, text = m.group(1), m.group(2).strip()
    # HH:MM today or tomorrow
    m_clock = re.match(r"^(\d{1,2}):(\d{2})$", when_s)
    if m_clock:
        h, mi = int(m_clock.group(1)), int(m_clock.group(2))
        now = datetime.now()
        target = now.replace(hour=h, minute=mi, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        return (target - now, text)
    # relative: 10m, 1h, 1h30m, 90s
    total = 0
    for num, unit in re.findall(r"(\d+)\s*([smhd])", when_s.lower()):
        n = int(num)
        total += {"s": n, "m": n * 60, "h": n * 3600, "d": n * 86400}[unit]
    if total <= 0:
        return None
    return (timedelta(seconds=total), text)


# --------------------------------------------------------------------------- #
# Matrix rain canvas
# --------------------------------------------------------------------------- #
class MatrixRain(tk.Canvas):
    def __init__(self, master, **kw):
        super().__init__(master, highlightthickness=0, bg=BG, **kw)
        self.cols: list[dict] = []
        self._running = True
        self.bind("<Configure>", self._rebuild)
        self.after(50, self._tick)

    def _rebuild(self, _evt=None) -> None:
        w = max(self.winfo_width(), 40)
        h = max(self.winfo_height(), 40)
        col_w = 14
        n = max(w // col_w, 4)
        chars = "アイウエオカキクケコ01ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ"
        self.cols = []
        for i in range(n):
            self.cols.append(
                {
                    "x": i * col_w + 4,
                    "y": random.randint(-h, 0),
                    "speed": random.uniform(1.5, 4.5),
                    "len": random.randint(6, 18),
                    "chars": [random.choice(chars) for _ in range(24)],
                }
            )
        self._h = h

    def _tick(self) -> None:
        if not self._running:
            return
        self.delete("rain")
        h = getattr(self, "_h", self.winfo_height())
        for c in self.cols:
            c["y"] += c["speed"]
            if c["y"] - c["len"] * 14 > h:
                c["y"] = random.randint(-80, 0)
                c["speed"] = random.uniform(1.5, 4.5)
            for j in range(c["len"]):
                ch = c["chars"][(j + int(c["y"])) % len(c["chars"])]
                yy = c["y"] - j * 14
                if yy < -20 or yy > h + 20:
                    continue
                color = FG if j == 0 else (FG_SOFT if j < 3 else FG_DIM)
                self.create_text(
                    c["x"],
                    yy,
                    text=ch,
                    fill=color,
                    font=("DejaVu Sans Mono", 10),
                    tags="rain",
                    anchor="nw",
                )
        self.after(45, self._tick)

    def stop(self) -> None:
        self._running = False


# --------------------------------------------------------------------------- #
# Main app
# --------------------------------------------------------------------------- #
class MatrixTerminal(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.cfg = load_config()
        self.title("MATRIX TERMINAL")
        self.configure(bg=BG)
        self.minsize(360, 420)
        self.geometry("440x620+80+80")
        self.attributes("-topmost", bool(self.cfg.get("always_on_top", True)))
        try:
            self.attributes("-alpha", float(self.cfg.get("opacity", 0.94)))
        except tk.TclError:
            pass

        # frameless-ish: keep border for easy resize on Linux
        # custom drag bar on top
        self._drag_x = 0
        self._drag_y = 0
        self.messages: list[dict[str, str]] = [
            {"role": "system", "content": self.cfg.get("system_prompt", "")}
        ]
        self.busy = False
        self.stream_q: queue.Queue = queue.Queue()
        self.provider_var = tk.StringVar()
        self.model_var = tk.StringVar()
        self.status_var = tk.StringVar(value="ready · type /help")
        self.topmost_var = tk.BooleanVar(value=bool(self.cfg.get("always_on_top", True)))
        self.rain_var = tk.BooleanVar(value=True)

        self.reminders = ReminderEngine(self._on_reminder_fire)
        self._build_ui()
        self._restore_window_state()
        self._refresh_models()
        self._bind_keys()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.after(80, self._poll_stream)
        self._boot_banner()

    # ---- UI ----
    def _build_ui(self) -> None:
        # title / drag bar
        bar = tk.Frame(self, bg=BG2, height=36)
        bar.pack(fill="x", side="top")
        bar.pack_propagate(False)
        title = tk.Label(
            bar,
            text="▣ MATRIX TERMINAL",
            bg=BG2,
            fg=FG,
            font=FONT_LG,
            anchor="w",
        )
        title.pack(side="left", padx=10, pady=6)
        for widget in (bar, title):
            widget.bind("<ButtonPress-1>", self._start_drag)
            widget.bind("<B1-Motion>", self._on_drag)
            widget.bind("<Double-Button-1>", self._toggle_maximize)

        btn_f = tk.Frame(bar, bg=BG2)
        btn_f.pack(side="right", padx=4)
        self._mk_btn(btn_f, "−", self._minimize).pack(side="left", padx=2)
        self._mk_btn(btn_f, "✕", self._on_close, fg=RED).pack(side="left", padx=2)

        # controls
        ctrl = tk.Frame(self, bg=BG)
        ctrl.pack(fill="x", padx=8, pady=(6, 2))

        tk.Label(ctrl, text="PROV", bg=BG, fg=FG_DIM, font=FONT_SM).grid(row=0, column=0, sticky="w")
        self.provider_combo = ttk.Combobox(
            ctrl, textvariable=self.provider_var, state="readonly", width=10, font=FONT_SM
        )
        self.provider_combo["values"] = list(self.cfg["providers"].keys())
        self.provider_combo.grid(row=0, column=1, padx=4)
        self.provider_combo.bind("<<ComboboxSelected>>", lambda e: self._refresh_models())

        tk.Label(ctrl, text="MODEL", bg=BG, fg=FG_DIM, font=FONT_SM).grid(row=0, column=2, sticky="w")
        self.model_combo = ttk.Combobox(
            ctrl, textvariable=self.model_var, width=28, font=FONT_SM
        )
        self.model_combo.grid(row=0, column=3, padx=4, sticky="ew")
        ctrl.columnconfigure(3, weight=1)

        opts = tk.Frame(self, bg=BG)
        opts.pack(fill="x", padx=8, pady=2)
        tk.Checkbutton(
            opts,
            text="always on top",
            variable=self.topmost_var,
            command=self._toggle_topmost,
            bg=BG,
            fg=FG,
            selectcolor=BG2,
            activebackground=BG,
            activeforeground=FG,
            font=FONT_SM,
        ).pack(side="left")
        tk.Checkbutton(
            opts,
            text="rain",
            variable=self.rain_var,
            command=self._toggle_rain,
            bg=BG,
            fg=FG,
            selectcolor=BG2,
            activebackground=BG,
            activeforeground=FG,
            font=FONT_SM,
        ).pack(side="left", padx=8)
        self._mk_btn(opts, "CLEAR", self._clear_chat, width=6).pack(side="right")
        self._mk_btn(opts, "REMINDERS", self._show_reminders, width=10).pack(side="right", padx=4)

        # chat area with rain behind
        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True, padx=8, pady=4)
        body.grid_rowconfigure(0, weight=1)
        body.grid_columnconfigure(0, weight=1)

        self.rain = MatrixRain(body)
        self.rain.grid(row=0, column=0, sticky="nsew")

        chat_frame = tk.Frame(body, bg=BG)
        chat_frame.grid(row=0, column=0, sticky="nsew")
        # make chat semi-see-through of rain: rain is behind; chat has solid-ish bg
        chat_frame.configure(bg="")

        self.chat = tk.Text(
            chat_frame,
            wrap="word",
            bg=BG,
            fg=FG,
            insertbackground=FG,
            selectbackground="#0d3d20",
            font=FONT,
            relief="flat",
            padx=10,
            pady=8,
            state="disabled",
            cursor="arrow",
            borderwidth=0,
            highlightthickness=1,
            highlightbackground=FG_DIM,
            highlightcolor=ACCENT,
        )
        scroll = tk.Scrollbar(chat_frame, command=self.chat.yview, bg=BG2, troughcolor=BG)
        self.chat.configure(yscrollcommand=scroll.set)
        self.chat.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

        self.chat.tag_configure("sys", foreground=FG_DIM, font=FONT_SM)
        self.chat.tag_configure("user", foreground=FG_USER, font=FONT)
        self.chat.tag_configure("ai", foreground=FG, font=FONT)
        self.chat.tag_configure("err", foreground=RED, font=FONT_SM)
        self.chat.tag_configure("meta", foreground=AMBER, font=FONT_SM)
        self.chat.tag_configure("search", foreground=FG_SOFT, font=FONT_SM)

        # lower rain opacity effect: put chat on top fully — rain only in margins hard
        # Raise chat above rain
        chat_frame.tkraise()

        # input
        inp_wrap = tk.Frame(self, bg=BG2)
        inp_wrap.pack(fill="x", padx=8, pady=(2, 4))
        self.input = tk.Text(
            inp_wrap,
            height=3,
            wrap="word",
            bg=BG2,
            fg=FG,
            insertbackground=FG,
            font=FONT,
            relief="flat",
            padx=8,
            pady=6,
            highlightthickness=1,
            highlightbackground=FG_DIM,
            highlightcolor=ACCENT,
        )
        self.input.pack(fill="x", expand=True)
        self.input.bind("<Return>", self._on_enter)
        self.input.bind("<Shift-Return>", lambda e: None)

        status = tk.Label(
            self,
            textvariable=self.status_var,
            bg=BG,
            fg=FG_DIM,
            font=FONT_SM,
            anchor="w",
        )
        status.pack(fill="x", padx=10, pady=(0, 6))

        # style comboboxes
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure(
            "TCombobox",
            fieldbackground=BG2,
            background=BG2,
            foreground=FG,
            arrowcolor=FG,
        )
        style.map(
            "TCombobox",
            fieldbackground=[("readonly", BG2)],
            foreground=[("readonly", FG)],
        )

        # default provider
        prov = self.cfg.get("default_provider") or "ollama"
        if prov not in self.cfg["providers"]:
            prov = "ollama"
        self.provider_var.set(prov)

        # size grip
        grip = tk.Label(self, text="◢", bg=BG, fg=FG_DIM, font=FONT_SM, cursor="bottom_right_corner")
        grip.place(relx=1.0, rely=1.0, x=-2, y=-2, anchor="se")
        grip.bind("<ButtonPress-1>", self._start_resize)
        grip.bind("<B1-Motion>", self._on_resize)

    def _mk_btn(self, parent, text, cmd, fg=None, width=3) -> tk.Label:
        b = tk.Label(
            parent,
            text=text,
            bg=BG2,
            fg=fg or FG,
            font=FONT_SM,
            width=width,
            cursor="hand2",
            padx=4,
            pady=2,
        )
        b.bind("<Button-1>", lambda e: cmd())
        b.bind("<Enter>", lambda e: b.configure(bg="#0a2814"))
        b.bind("<Leave>", lambda e: b.configure(bg=BG2))
        return b

    # ---- window chrome ----
    def _start_drag(self, e) -> None:
        self._drag_x = e.x_root - self.winfo_x()
        self._drag_y = e.y_root - self.winfo_y()

    def _on_drag(self, e) -> None:
        self.geometry(f"+{e.x_root - self._drag_x}+{e.y_root - self._drag_y}")

    def _start_resize(self, e) -> None:
        self._rx, self._ry = e.x_root, e.y_root
        self._rw, self._rh = self.winfo_width(), self.winfo_height()

    def _on_resize(self, e) -> None:
        dw = e.x_root - self._rx
        dh = e.y_root - self._ry
        w = max(360, self._rw + dw)
        h = max(420, self._rh + dh)
        self.geometry(f"{w}x{h}")

    def _toggle_maximize(self, _e=None) -> None:
        try:
            self.attributes("-zoomed", not self.attributes("-zoomed"))
        except tk.TclError:
            self.state("zoomed" if self.state() != "zoomed" else "normal")

    def _minimize(self) -> None:
        self.iconify()

    def _toggle_topmost(self) -> None:
        self.attributes("-topmost", self.topmost_var.get())
        self.cfg["always_on_top"] = self.topmost_var.get()

    def _toggle_rain(self) -> None:
        if self.rain_var.get():
            self.rain._running = True
            self.rain.after(40, self.rain._tick)
            self.rain.lift()  # still under chat frame
            self.rain.lower(self.chat.master)
        else:
            self.rain.stop()
            self.rain.delete("all")

    def _restore_window_state(self) -> None:
        if not STATE_PATH.exists():
            return
        try:
            st = json.loads(STATE_PATH.read_text(encoding="utf-8"))
            geo = st.get("geometry")
            if geo:
                self.geometry(geo)
        except Exception:
            pass

    def _save_window_state(self) -> None:
        try:
            STATE_PATH.write_text(
                json.dumps({"geometry": self.geometry()}, indent=2) + "\n",
                encoding="utf-8",
            )
        except Exception:
            pass

    def _on_close(self) -> None:
        self._save_window_state()
        save_config(self.cfg)
        self.rain.stop()
        self.destroy()

    # ---- chat helpers ----
    def _append(self, text: str, tag: str = "ai") -> None:
        self.chat.configure(state="normal")
        self.chat.insert("end", text, tag)
        self.chat.see("end")
        self.chat.configure(state="disabled")

    def _boot_banner(self) -> None:
        self._append(
            "══════════════════════════════════════\n"
            "  MATRIX TERMINAL  ·  overlay ready\n"
            "  drag title bar  ·  resize corner ◢\n"
            "  /help  /search  /remind  /models\n"
            "══════════════════════════════════════\n\n",
            "sys",
        )

    def _clear_chat(self) -> None:
        self.messages = [{"role": "system", "content": self.cfg.get("system_prompt", "")}]
        self.chat.configure(state="normal")
        self.chat.delete("1.0", "end")
        self.chat.configure(state="disabled")
        self._boot_banner()
        self.status_var.set("cleared · ready")

    def _bind_keys(self) -> None:
        self.bind("<Escape>", lambda e: self.iconify())
        self.bind("<Control-l>", lambda e: self._clear_chat())

    # ---- models ----
    def _refresh_models(self) -> None:
        prov = self.provider_var.get() or "ollama"
        pconf = self.cfg["providers"].get(prov, {})
        models: list[str] = []
        if pconf.get("type") == "ollama":
            models = list_ollama_models(pconf.get("base_url", "http://127.0.0.1:11434"))
            if not models:
                models = pconf.get("models") or ["(ollama offline)"]
        else:
            models = list(pconf.get("models") or [])
        self.model_combo["values"] = models
        preferred = self.cfg.get("default_model") or ""
        if preferred in models:
            self.model_var.set(preferred)
        elif models and not models[0].startswith("("):
            self.model_var.set(models[0])
        else:
            self.model_var.set(models[0] if models else "")
        self.status_var.set(f"provider={prov} · {len(models)} models")

    # ---- input ----
    def _on_enter(self, e) -> str | None:
        if e.state & 0x0001:  # shift
            return None
        self._send()
        return "break"

    def _send(self) -> None:
        text = self.input.get("1.0", "end").strip()
        if not text or self.busy:
            return
        self.input.delete("1.0", "end")

        if text.startswith("/"):
            self._handle_command(text)
            return

        self._append(f"\nYOU › {text}\n", "user")
        self.messages.append({"role": "user", "content": text})
        self._start_chat()

    def _handle_command(self, text: str) -> None:
        low = text.strip().lower()
        if low in ("/help", "/?"):
            self._append(
                "\nCOMMANDS\n"
                "  /search <query>     web search + answer\n"
                "  /remind <when> <msg>  e.g. /remind 10m stand up\n"
                "                       /remind 14:30 call bank\n"
                "  /reminders          list pending\n"
                "  /cancel [id]        cancel one or all reminders\n"
                "  /models             refresh model list\n"
                "  /provider <name>    ollama | xai | deepseek | openai | custom\n"
                "  /model <name>       set model\n"
                "  /clear              clear chat\n"
                "  /top                toggle always-on-top\n"
                "  /opacity <0.5-1>    window opacity\n"
                "  /sys <prompt>       set system prompt\n"
                "  Enter=send · Shift+Enter=newline · Esc=minimize\n\n",
                "meta",
            )
            return
        if low.startswith("/search "):
            q = text[8:].strip()
            self._do_search(q)
            return
        if low.startswith("/remind"):
            if low in ("/remind", "/reminders"):
                self._show_reminders()
                return
            parsed = parse_remind(text)
            if not parsed:
                self._append("\nusage: /remind 10m message  |  /remind 14:30 message\n", "err")
                return
            delta, msg = parsed
            when = datetime.now() + delta
            rid = self.reminders.add(when, msg)
            self._append(
                f"\n⏰ REMINDER {rid} @ {when.strftime('%H:%M:%S')} — {msg}\n",
                "meta",
            )
            self.status_var.set(f"reminder set · {rid}")
            return
        if low.startswith("/cancel"):
            parts = text.split(maxsplit=1)
            rid = parts[1].strip() if len(parts) > 1 else None
            n = self.reminders.cancel(rid)
            self._append(f"\ncancelled {n} reminder(s)\n", "meta")
            return
        if low == "/models":
            self._refresh_models()
            vals = list(self.model_combo["values"])
            self._append("\nMODELS: " + ", ".join(vals[:20]) + ("…" if len(vals) > 20 else "") + "\n", "meta")
            return
        if low.startswith("/provider "):
            name = text.split(maxsplit=1)[1].strip()
            if name not in self.cfg["providers"]:
                self._append(f"\nunknown provider. choose: {', '.join(self.cfg['providers'])}\n", "err")
                return
            self.provider_var.set(name)
            self.cfg["default_provider"] = name
            self._refresh_models()
            self._append(f"\nprovider → {name}\n", "meta")
            return
        if low.startswith("/model "):
            name = text.split(maxsplit=1)[1].strip()
            self.model_var.set(name)
            self.cfg["default_model"] = name
            self._append(f"\nmodel → {name}\n", "meta")
            return
        if low == "/clear":
            self._clear_chat()
            return
        if low == "/top":
            self.topmost_var.set(not self.topmost_var.get())
            self._toggle_topmost()
            self._append(f"\nalways-on-top → {self.topmost_var.get()}\n", "meta")
            return
        if low.startswith("/opacity "):
            try:
                a = float(text.split(maxsplit=1)[1])
                a = min(1.0, max(0.45, a))
                self.attributes("-alpha", a)
                self.cfg["opacity"] = a
                self._append(f"\nopacity → {a}\n", "meta")
            except Exception as e:
                self._append(f"\nopacity error: {e}\n", "err")
            return
        if low.startswith("/sys "):
            prompt = text[5:].strip()
            self.cfg["system_prompt"] = prompt
            self.messages = [{"role": "system", "content": prompt}] + [
                m for m in self.messages if m["role"] != "system"
            ]
            self._append("\nsystem prompt updated\n", "meta")
            return
        self._append(f"\nunknown command. /help\n", "err")

    def _show_reminders(self) -> None:
        items = self.reminders.list_pending()
        if not items:
            self._append("\nno pending reminders\n", "meta")
            return
        lines = ["\nPENDING REMINDERS"]
        for i in items:
            lines.append(f"  {i['id']}  {i['when'].strftime('%Y-%m-%d %H:%M:%S')}  {i['text']}")
        self._append("\n".join(lines) + "\n", "meta")

    def _on_reminder_fire(self, item: dict) -> None:
        def ui():
            self._append(
                f"\n\n▓▓▓ REMINDER ▓▓▓  {item['text']}\n\n",
                "meta",
            )
            self.status_var.set(f"REMINDER: {item['text'][:40]}")
            try:
                self.deiconify()
                self.attributes("-topmost", True)
                self.topmost_var.set(True)
                self.lift()
                self.focus_force()
            except Exception:
                pass

        self.after(0, ui)

    def _do_search(self, query: str) -> None:
        if not query:
            self._append("\nusage: /search your query\n", "err")
            return
        self._append(f"\nYOU › /search {query}\n", "user")
        self.status_var.set("searching the net…")
        self.busy = True

        def work():
            try:
                results = web_search(query)
                if not results:
                    self.stream_q.put(("search_fail", "no results"))
                    return
                block = "\n".join(
                    f"- {r['title']}\n  {r['url']}\n  {r['snippet']}" for r in results
                )
                self.stream_q.put(("search_ok", block))
                # feed into model
                user_msg = (
                    f"Web search results for: {query}\n\n{block}\n\n"
                    f"Summarize what matters for the user. Cite titles/urls briefly."
                )
                self.messages.append({"role": "user", "content": user_msg})
                self.stream_q.put(("search_chat", None))
            except Exception as e:
                self.stream_q.put(("search_fail", str(e)))

        threading.Thread(target=work, daemon=True).start()

    def _start_chat(self) -> None:
        prov = self.provider_var.get()
        model = self.model_var.get()
        if not model or model.startswith("("):
            self._append("\nno model selected / ollama offline\n", "err")
            return
        pconf = self.cfg["providers"][prov]
        self.busy = True
        self.status_var.set(f"thinking · {prov}/{model}")
        self._append("NEO › ", "ai")
        self._stream_buf = ""

        # trim history
        max_m = int(self.cfg.get("max_history_messages", 40))
        msgs = [self.messages[0]] + self.messages[1:][-max_m:]

        def work():
            if pconf.get("type") == "ollama":
                chat_ollama(pconf["base_url"], model, msgs, self.stream_q)
            else:
                env = pconf.get("api_key_env") or ""
                key = os.environ.get(env, "") if env else ""
                if not key and env:
                    self.stream_q.put(
                        (
                            "error",
                            f"missing env {env}. export it or switch to ollama.",
                        )
                    )
                    return
                chat_openai_compatible(
                    pconf["base_url"], key or None, model, msgs, self.stream_q
                )

        threading.Thread(target=work, daemon=True).start()

    def _poll_stream(self) -> None:
        try:
            while True:
                kind, payload = self.stream_q.get_nowait()
                if kind == "token":
                    self._stream_buf = getattr(self, "_stream_buf", "") + payload
                    self._append(payload, "ai")
                elif kind == "done":
                    buf = getattr(self, "_stream_buf", "")
                    if buf:
                        self.messages.append({"role": "assistant", "content": buf})
                        self._log_history("assistant", buf)
                    self._append("\n", "ai")
                    self.busy = False
                    self.status_var.set("ready")
                    self._stream_buf = ""
                elif kind == "error":
                    self._append(f"\n[error] {payload}\n", "err")
                    self.busy = False
                    self.status_var.set("error")
                    self._stream_buf = ""
                elif kind == "search_ok":
                    self._append(f"\nSEARCH HITS\n{payload}\n", "search")
                elif kind == "search_fail":
                    self._append(f"\nsearch failed: {payload}\n", "err")
                    self.busy = False
                    self.status_var.set("search failed")
                elif kind == "search_chat":
                    # kick model after search injected
                    self.busy = False
                    self._start_chat()
        except queue.Empty:
            pass
        self.after(40, self._poll_stream)

    def _log_history(self, role: str, content: str) -> None:
        try:
            with HISTORY_PATH.open("a", encoding="utf-8") as f:
                f.write(
                    json.dumps(
                        {
                            "ts": datetime.now().isoformat(timespec="seconds"),
                            "role": role,
                            "content": content[:4000],
                            "provider": self.provider_var.get(),
                            "model": self.model_var.get(),
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass


def main() -> None:
    # ensure config exists for easy editing
    if not CONFIG_PATH.exists():
        save_config(DEFAULT_CONFIG)
    app = MatrixTerminal()
    app.mainloop()


if __name__ == "__main__":
    main()
