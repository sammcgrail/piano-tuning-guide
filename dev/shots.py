#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright>=1.47"]
# ///
"""Screenshot the guide in real Chrome (GPU on) at phone and desktop sizes.

Usage: dev/shots.py BASE_URL OUTDIR [--hash step-9 --hash note-As3 ...] [--size 390x844] [--size 1440x900]
Prints console errors / page errors and one line per shot. Exit 1 if any error was logged.
"""
import argparse, asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base"); ap.add_argument("out")
    ap.add_argument("--hash", action="append", default=[])
    ap.add_argument("--size", action="append", default=[])
    ap.add_argument("--wait", type=int, default=1600)
    ap.add_argument("--eval", default=None, help="JS to run before each shot")
    a = ap.parse_args()
    sizes = a.size or ["390x844", "1440x900"]
    hashes = a.hash or ["step-1"]
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True, args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"])
        for size in sizes:
            w, h = map(int, size.split("x"))
            mobile = w < 700
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
            page = await ctx.new_page()
            page.on("console", lambda m, s=size: errors.append(f"[{s}] console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e, s=size: errors.append(f"[{s}] pageerror: {e}"))
            for hsh in hashes:
                url = a.base.rstrip("/") + "/#" + hsh + "&still"
                await page.goto("about:blank")
                await page.goto(url)
                try:
                    await page.wait_for_function("document.documentElement.dataset.ready === '1'", timeout=15000)
                except Exception as ex:
                    errors.append(f"[{size}] {hsh}: page never became ready ({ex.__class__.__name__})")
                    for e in errors: print(e)
                    sys.exit(2)
                if a.eval:
                    await page.evaluate(a.eval)
                await page.wait_for_timeout(a.wait)
                f = out / f"{hsh.replace('/', '_')}-{w}x{h}.png"
                await page.screenshot(path=str(f))
                print(f)
            await ctx.close()
        await b.close()
    for e in errors: print(e)
    sys.exit(1 if any("error" in e for e in errors) else 0)

asyncio.run(main())
