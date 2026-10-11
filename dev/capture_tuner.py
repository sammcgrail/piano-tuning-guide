#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright>=1.47"]
# ///
"""Screenshot the tuner with a synthetic microphone (an oscillator), so its states can be seen.
Usage: dev/capture_tuner.py BASE_URL OUTDIR [--size 390x844]"""
import argparse, asyncio
from pathlib import Path
from playwright.async_api import async_playwright

FAKE = """
window.__fakeHz = 293.66;
navigator.mediaDevices.getUserMedia = async () => {
  const ac = new AudioContext(); const o = ac.createOscillator();
  const re = new Float32Array(9), im = new Float32Array(9); for (let k = 1; k <= 8; k++) im[k] = 1 / k;
  o.setPeriodicWave(ac.createPeriodicWave(re, im)); o.frequency.value = window.__fakeHz;
  const d = ac.createMediaStreamDestination(); o.connect(d); o.start(); window.__fakeCtl = { o, ac }; return d.stream;
};
"""
async def main():
    ap = argparse.ArgumentParser(); ap.add_argument("base"); ap.add_argument("out"); ap.add_argument("--size", default="390x844"); a = ap.parse_args()
    w, h = map(int, a.size.split("x")); mobile = w < 700
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True, args=["--autoplay-policy=no-user-gesture-required", "--enable-gpu", "--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
        page = await ctx.new_page(); await page.add_init_script(FAKE)
        await page.goto(a.base.rstrip("/") + "/#step-9"); await page.wait_for_function("document.documentElement.dataset.ready==='1'")
        d4 = 440 * 2 ** (-7 / 12)
        await page.evaluate(f"window.__fakeHz = {d4 * 2 ** (-6 / 1200)}")
        await page.click("[data-mic=step]"); await page.wait_for_timeout(1800)
        await page.screenshot(path=str(out / f"step9-bar-{w}.png")); print(out / f"step9-bar-{w}.png")
        tab = ".tabbar [data-tab=tuner]" if mobile else ".seg [data-tab=tuner]"
        await page.click(tab)
        async def shot(name, hz, wait=1800):
            await page.evaluate(f"window.__fakeCtl.o.frequency.value = {hz}"); await page.wait_for_timeout(wait)
            f = out / f"tuner-{name}-{w}.png"; await page.screenshot(path=str(f)); print(f)
        await shot("flat", d4 * 2 ** (-6 / 1200))
        for c in (-4, -2, -1, 0.3):
            await page.evaluate(f"window.__fakeCtl.o.frequency.value = {d4 * 2 ** (c / 1200)}"); await page.wait_for_timeout(500)
        await shot("locked", d4 * 2 ** (0.3 / 1200), 1200)
        await shot("wrong", 440 * 2 ** (-5 / 12))
        await page.click("#modeSeg [data-raw='1']")
        await shot("raw", 440 * 2 ** (12 / 1200))
        await page.click("#modeSeg [data-raw='0']")
        await b.close()
asyncio.run(main())
