#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright>=1.47", "pillow>=10"]
# ///
"""Render the link-preview image (og.jpg, 1200x630) from the 3D stage itself.
Usage: dev/capture_og.py BASE_URL OUT.jpg [--hash step-9]"""
import argparse, asyncio
from playwright.async_api import async_playwright
from PIL import Image

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument("base"); ap.add_argument("out"); ap.add_argument("--hash", default="step-9"); a = ap.parse_args()
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist"])
        page = await b.new_page(viewport={"width": 1700, "height": 690}, device_scale_factor=1)
        await page.goto(a.base.rstrip("/") + "/#" + a.hash + "&still"); await page.wait_for_function("document.documentElement.dataset.ready==='1'")
        await page.wait_for_timeout(1500)
        await page.evaluate("document.querySelector('#replay').hidden = true")
        await page.locator("#stage").screenshot(path="/tmp/og-raw.png")
        await b.close()
    im = Image.open("/tmp/og-raw.png").convert("RGB")
    w, h = im.size; s = max(1200 / w, 630 / h); im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    l, t = (im.width - 1200) // 2, (im.height - 630) // 2
    im.crop((l, t, l + 1200, t + 630)).save(a.out, quality=88)
    print("wrote", a.out, "from", (w, h))

asyncio.run(main())
