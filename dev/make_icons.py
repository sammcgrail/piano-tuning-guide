#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""Draw the app icon (a tuning lever on a pin over three strings) at 180/192/512 px.
Usage: dev/make_icons.py OUTDIR"""
import sys, math
from pathlib import Path
from PIL import Image, ImageDraw

INK, BLUE, PALE, STEEL = (20, 20, 20), (31, 79, 216), (166, 192, 246), (150, 150, 150)

def icon(n: int) -> Image.Image:
    s = 4 * n
    im = Image.new("RGB", (s, s), "white"); d = ImageDraw.Draw(im)
    u = s / 100
    for x in (38, 50, 62):  # three strings
        d.line([(x * u, 8 * u), (x * u, 92 * u)], fill=STEEL, width=int(1.6 * u))
    cx, cy = 50 * u, 40 * u  # pin on the middle string
    a = math.radians(-32)  # lever handle toward 1 o'clock
    ex, ey = cx + math.sin(-a) * 44 * u, cy - math.cos(-a) * 44 * u
    d.line([(cx, cy), (ex, ey)], fill=INK, width=int(5 * u))
    gx, gy = cx + math.sin(-a) * 34 * u, cy - math.cos(-a) * 34 * u
    d.line([(gx, gy), (ex, ey)], fill=INK, width=int(10 * u))
    d.ellipse([cx - 9 * u, cy - 9 * u, cx + 9 * u, cy + 9 * u], fill=PALE, outline=BLUE, width=int(2.5 * u))
    d.ellipse([cx - 3 * u, cy - 3 * u, cx + 3 * u, cy + 3 * u], fill=BLUE)
    # keys along the bottom
    top = 70 * u
    d.rectangle([10 * u, top, 90 * u, 92 * u], fill="white", outline=INK, width=int(1.5 * u))
    for i in range(1, 6):
        x = (10 + i * 80 / 6) * u
        d.line([(x, top), (x, 92 * u)], fill=INK, width=int(1.2 * u))
    for i in (1, 2, 4, 5):
        x = (10 + i * 80 / 6) * u
        fill = BLUE if i == 4 else INK
        d.rectangle([x - 4 * u, top, x + 4 * u, 83 * u], fill=fill)
    return im.resize((n, n), Image.LANCZOS)

out = Path(sys.argv[1] if len(sys.argv) > 1 else "icons")
out.mkdir(parents=True, exist_ok=True)
icon(180).save(out / "apple-touch-icon.png"); icon(192).save(out / "icon-192.png"); icon(512).save(out / "icon-512.png")
print("wrote", sorted(p.name for p in out.iterdir()))
