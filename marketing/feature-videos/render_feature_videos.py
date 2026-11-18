#!/usr/bin/env python3
"""Render short Al Shantaf feature showcase MP4s matching site theme."""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
W, H, FPS = 1280, 720, 30
DUR = 10.0  # seconds

GREEN = (15, 52, 47)
GREEN2 = (26, 74, 66)
GOLD = (200, 154, 88)
GOLD2 = (217, 181, 122)
CREAM = (243, 239, 230)
SURFACE = (255, 255, 255)
INK = (20, 32, 40)
INK_SOFT = (93, 107, 116)
LINE = (20, 32, 40, 28)

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def ease_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_in_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 0.5 - 0.5 * math.cos(math.pi * t)


def mix(c1, c2, t: float):
    t = max(0.0, min(1.0, t))
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def rounded(draw: ImageDraw.ImageDraw, xy, r: int, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def text_w(draw: ImageDraw.ImageDraw, text: str, f) -> int:
    return int(draw.textlength(text, font=f))


def draw_brand_bar(draw: ImageDraw.ImageDraw, y: int = 36):
    draw.rectangle((0, 0, W, 8), fill=GOLD)
    f = font(18, True)
    draw.text((48, y), "ALSHANTAF INVEST", font=f, fill=GOLD)


FEATURES = [
    {
        "slug": "01-offer-detail",
        "title": "Offer Detail",
        "subtitle": "Media · map · regulation · pricing · WhatsApp",
        "beats": [
            ("Media gallery", "Photos & video of the opportunity"),
            ("Parcel on map", "DLS boundary overlaid on the site"),
            ("Regulation guide", "Industry rules & setbacks"),
            ("WhatsApp CTA", "Talk to an advisor in one tap"),
        ],
    },
    {
        "slug": "02-compare-offers",
        "title": "Compare Offers",
        "subtitle": "Side-by-side · up to two listings",
        "beats": [
            ("Pick two", "Select offers from the grid"),
            ("Align specs", "Size · price · industry · status"),
            ("Decide clearly", "Open the compare sheet"),
            ("Act next", "Details or WhatsApp from either"),
        ],
    },
    {
        "slug": "03-investment-journey",
        "title": "Investment Journey",
        "subtitle": "Wizard that matches live listings",
        "beats": [
            ("Choose intent", "Hangar · invest · land"),
            ("Set filters", "Area · budget · industry"),
            ("Match offers", "Scored against live inventory"),
            ("Shortlist", "Jump into the right opportunities"),
        ],
    },
    {
        "slug": "04-land-check",
        "title": "Land Check",
        "subtitle": "DLS parcel · topo 3D · blueprint · draft",
        "beats": [
            ("Locate parcel", "DLS cascade & map pin"),
            ("3D topography", "Terrain side view for context"),
            ("Print blueprint", "Parcel plan ready to share"),
            ("Draft autosave", "Resume anytime before submit"),
        ],
    },
    {
        "slug": "05-request-publish",
        "title": "Request Publish",
        "subtitle": "Owner / broker · DLS · media · PDF",
        "beats": [
            ("Owner or broker", "Role-specific intake"),
            ("DLS cascade", "Governorate → parcel identity"),
            ("Attach media", "Images · video · PDF plan"),
            ("Submit", "Tracking code on confirmation"),
        ],
    },
    {
        "slug": "06-track-my-offer",
        "title": "Track & My Offer",
        "subtitle": "Status · SMS · owner portal · delete",
        "beats": [
            ("Track code", "Follow submission status"),
            ("My Offer portal", "Secret-code owner access"),
            ("SMS alerts", "Opt in for publish milestones"),
            ("Stay in control", "Update status or delete safely"),
        ],
    },
]


def render_frame(feat: dict, t: float) -> Image.Image:
    """t in [0, DUR] seconds."""
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img, "RGBA")

    # subtle vertical rules (ledger feel)
    for x in range(80, W, 80):
        draw.line((x, 0, x, H), fill=(15, 52, 47, 10), width=1)

    # intro overlay
    intro = ease_out(min(1.0, t / 1.4))
    panel_y = int(lerp(40, 0, intro))

    # left forest panel
    left_w = int(lerp(0, 460, intro))
    if left_w > 4:
        draw.rectangle((0, 0, left_w, H), fill=GREEN)
        draw.rectangle((0, 0, left_w, 8), fill=GOLD)
        if intro > 0.35:
            f_k = font(16, True)
            f_t = font(40, True)
            f_s = font(18, False)
            draw.text((48, 72), "FEATURE", font=f_k, fill=GOLD)
            draw.text((48, 110), feat["title"], font=f_t, fill=SURFACE)
            words = feat["subtitle"].split()
            lines, cur = [], ""
            for w in words:
                test = (cur + " " + w).strip()
                if text_w(draw, test, f_s) > 340:
                    lines.append(cur)
                    cur = w
                else:
                    cur = test
            if cur:
                lines.append(cur)
            yy = 190
            for line in lines[:3]:
                draw.text((48, yy), line, font=f_s, fill=GOLD2)
                yy += 28
            draw.text((48, H - 90), "alshantaf.com", font=font(15, True), fill=GOLD)

    # right content card
    card_t = ease_out(max(0.0, min(1.0, (t - 0.6) / 1.0)))
    if card_t > 0.02:
        cx0 = int(lerp(W - 40, 470, card_t))
        card = (cx0, 90 + panel_y, W - 48, H - 70)
        if card[2] > card[0] + 80:
            rounded(draw, card, 18, SURFACE, outline=(210, 205, 195), width=1)
            draw.rectangle((card[0], card[1], card[2], card[1] + 4), fill=GOLD)

            progress = ease_in_out(max(0.0, min(1.0, (t - 1.2) / (DUR - 2.2))))
            beats = feat["beats"]
            n = len(beats)
            active = min(n - 1, int(progress * n))
            pulse = 0.5 + 0.5 * math.sin(t * 4.0)

            f_num = font(14, True)
            f_head = font(26, True)
            f_body = font(17, False)

            y = card[1] + 36
            for i, (head, body) in enumerate(beats):
                on = i <= active
                strong = i == active
                row = (card[0] + 28, y, card[2] - 28, y + 96)
                if row[2] > row[0]:
                    if strong:
                        rounded(draw, row, 14, (248, 245, 239), outline=GOLD, width=2)
                    else:
                        rounded(draw, row, 14, SURFACE, outline=(220, 216, 208), width=1)

                nx, ny = card[0] + 52, y + 48
                r = 18
                fill = GOLD if on else (230, 226, 216)
                draw.ellipse((nx - r, ny - r, nx + r, ny + r), fill=fill)
                num = str(i + 1)
                tw = text_w(draw, num, f_num)
                draw.text((nx - tw / 2, ny - 8), num, font=f_num, fill=GREEN if on else INK_SOFT)

                ink = INK if on else INK_SOFT
                draw.text((card[0] + 88, y + 24), head, font=f_head, fill=ink)
                draw.text((card[0] + 88, y + 58), body, font=f_body, fill=INK_SOFT if on else (160, 168, 172))

                if i < active:
                    draw.text((card[2] - 56, y + 36), "✓", font=font(22, True), fill=GREEN)

                if strong:
                    uw = int(lerp(0, 160, 0.55 + 0.45 * pulse))
                    draw.rectangle((card[0] + 88, y + 86, card[0] + 88 + uw, y + 89), fill=GOLD)

                y += 112

            bar_x0, bar_x1 = card[0] + 28, card[2] - 28
            if bar_x1 > bar_x0:
                draw.rectangle((bar_x0, H - 48, bar_x1, H - 44), fill=(230, 226, 216))
                fill_w = int(lerp(bar_x0, bar_x1, progress))
                draw.rectangle((bar_x0, H - 48, fill_w, H - 44), fill=GOLD)

    # end card fade
    if t > DUR - 1.2:
        end = ease_out((t - (DUR - 1.2)) / 1.2)
        overlay = Image.new("RGBA", (W, H), (*GREEN, int(230 * end)))
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(img)
        if end > 0.2:
            msg = feat["title"]
            f = font(40, True)
            tw = text_w(draw, msg, f)
            draw.text(((W - tw) / 2, H / 2 - 40), msg, font=f, fill=SURFACE)
            sub = "ALSHANTAF INVEST"
            f2 = font(18, True)
            tw2 = text_w(draw, sub, f2)
            draw.text(((W - tw2) / 2, H / 2 + 20), sub, font=f2, fill=GOLD)

    return img


def encode_feature(feat: dict) -> Path:
    frames_dir = ROOT / "frames" / feat["slug"]
    frames_dir.mkdir(parents=True, exist_ok=True)
    nframes = int(DUR * FPS)
    for i in range(nframes):
        t = i / FPS
        frame = render_frame(feat, t)
        frame.save(frames_dir / f"f_{i:04d}.png")

    out = ROOT / f"{feat['slug']}.mp4"
    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        str(frames_dir / "f_%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "20",
        "-movflags",
        "+faststart",
        str(out),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out


def main():
    paths = []
    for feat in FEATURES:
        print(f"rendering {feat['slug']}…")
        paths.append(encode_feature(feat))
    print("done:")
    for p in paths:
        print(" ", p, f"({p.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
