#!/usr/bin/env python3
"""Serve scenes + capture timed frames with Chromium, then encode Arabic feature MP4s."""

from __future__ import annotations

import http.server
import shutil
import socketserver
import subprocess
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCENES = ROOT / "scenes"
FRAMES = ROOT / "scene-frames"
CHROME = Path.home() / ".cache/ms-playwright/chromium-1194/chrome-linux/chrome"
PORT = 8765
FPS = 30
DUR = 11.0  # seconds
W, H = 1280, 720

FEATURES = [
    ("offer-detail", "01-offer-detail"),
    ("compare", "02-compare-offers"),
    ("journey", "03-investment-journey"),
    ("land-check", "04-land-check"),
    ("publish", "05-request-publish"),
    ("track", "06-track-my-offer"),
]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass


def start_server():
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    httpd.allow_reuse_address = True
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def shot(url: str, out: Path):
    cmd = [
        str(CHROME),
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--allow-running-insecure-content",
        f"--window-size={W},{H}",
        f"--screenshot={out}",
        "--virtual-time-budget=2500",
        "--run-all-compositor-stages-before-draw",
        "--no-sandbox",
        url,
    ]
    subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def encode(feat_slug: str, out_name: str):
    frames = FRAMES / feat_slug
    out = ROOT / f"{out_name}.mp4"
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        str(frames / "f_%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "19",
        "-movflags",
        "+faststart",
        str(out),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out


def main():
    if not CHROME.exists():
        raise SystemExit(f"missing chrome: {CHROME}")
    httpd = start_server()
    time.sleep(0.3)
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)

    nframes = int(DUR * FPS)
    try:
        for feat_id, out_name in FEATURES:
            print(f"recording {feat_id}…")
            dest = FRAMES / feat_id
            dest.mkdir(parents=True)
            # sample every 2 frames for speed (~5.5s effective at 15fps encode? No — duplicate)
            # Capture at 15fps then encode as 30 with frame doubling for speed
            capture_fps = 15
            cap_n = int(DUR * capture_fps)
            for i in range(cap_n):
                t = i / max(1, cap_n - 1)
                url = f"http://127.0.0.1:{PORT}/scenes/scene.html?id={feat_id}&t={t:.4f}"
                # write temporary then copy into sequence with doubling
                tmp = dest / f"raw_{i:04d}.png"
                shot(url, tmp)
                # place as two frames for 30fps feel
                a = dest / f"f_{i * 2:04d}.png"
                b = dest / f"f_{i * 2 + 1:04d}.png"
                if tmp.exists() and tmp.stat().st_size > 1000:
                    shutil.copy(tmp, a)
                    shutil.copy(tmp, b)
                    tmp.unlink(missing_ok=True)
                else:
                    print(f"  warn empty frame {i}")
            out = encode(feat_id, out_name)
            print(f"  -> {out.name} ({out.stat().st_size // 1024} KB)")
            # preview mid
            mid = dest / "f_0080.png"
            if mid.exists():
                shutil.copy(mid, ROOT / f"preview-{out_name}.png")
    finally:
        httpd.shutdown()

    print("done")


if __name__ == "__main__":
    main()
