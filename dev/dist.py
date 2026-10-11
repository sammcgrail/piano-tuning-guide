#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Make a deployable copy of the site with cache stamps and absolute link-preview URLs.

The repo root already works as a static site as-is. This optional step only:
  * replaces every ?v=1 asset stamp (import map, stylesheet, service worker list) with a
    content hash, so browsers and the service worker pick up changed files at once;
  * writes absolute og:image / og:url for the host you deploy to (iMessage and Slack
    previews need absolute URLs).

Usage: dev/dist.py OUTDIR --base https://your.host/path/
"""
import argparse, hashlib, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHIP = ["index.html", "sw.js", "manifest.webmanifest", "og.jpg", "LICENSE", "css", "js", "vendor", "fonts", "icons"]

def h(p: Path) -> str: return hashlib.sha256(p.read_bytes()).hexdigest()[:10]

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out"); ap.add_argument("--base", required=True, help="public URL of the folder, ending in /")
    a = ap.parse_args()
    base = a.base if a.base.endswith("/") else a.base + "/"
    out = Path(a.out).resolve()
    if out == ROOT or out in ROOT.parents:
        sys.exit("refusing to overwrite the source tree")
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True)
    for name in SHIP:
        src = ROOT / name
        if not src.exists(): print("skip (missing):", name); continue
        (shutil.copytree if src.is_dir() else shutil.copy2)(src, out / name)
    stamps = {rel: h(out / rel) for rel in ["css/app.css", "js/app.js", "js/data.js", "js/scene.js", "js/audio.js", "js/tuner.js"]}
    idx = (out / "index.html").read_text()
    for rel, hh in stamps.items():
        idx = idx.replace(f"{rel}?v=1", f"{rel}?v={hh}")
    idx = re.sub(r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{base}og.jpg">', idx)
    idx = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{base}">', idx)
    (out / "index.html").write_text(idx)
    sw = (out / "sw.js").read_text()
    for rel, hh in stamps.items():
        sw = sw.replace(f"./{rel}?v=1", f"./{rel}?v={hh}")
    allh = hashlib.sha256("".join(sorted(stamps.values())).encode() + idx.encode()).hexdigest()[:10]
    sw = sw.replace("const VERSION = 'ptg-v1';", f"const VERSION = 'ptg-{allh}';")
    (out / "sw.js").write_text(sw)
    left = [f for f in ("index.html", "sw.js") if re.search(r"\?v=1(?![0-9a-f])", (out / f).read_text())]
    if left: sys.exit(f"unstamped ?v=1 left in {left}")
    print(f"wrote {out} ({sum(1 for _ in out.rglob('*') if _.is_file())} files), cache version ptg-{allh}, og base {base}")

if __name__ == "__main__":
    main()
