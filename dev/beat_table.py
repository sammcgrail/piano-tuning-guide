#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Independent beat-rate calculator for 12-TET at A4 = 440 Hz (ideal, harmonic strings).

Coincident partials (lower note L, upper note U):
  P5  3:2   beat = 3L - 2U   (positive = narrow)
  P4  4:3   beat = 3U - 4L   (positive = wide)
  M3  5:4   beat = 4U - 5L   (positive = wide)
  M6  5:3   beat = 3U - 5L   (positive = wide)
  m3  6:5   beat = 6L - 5U   (positive = narrow)
  M10 5:2   beat = 2U - 5L   (positive = wide)
  P8  2:1   beat = U - 2L    (0 in ideal 12-TET)
Usage: beat_table.py [--json]
"""
import json, sys

NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

def midi(name: str) -> int:
    pc, octv = name[:-1], int(name[-1])
    return 12 * (octv + 1) + NAMES.index(pc)

def freq(name: str) -> float:
    return 440.0 * 2 ** ((midi(name) - 69) / 12)

def nm(m: int) -> str:
    return f"{NAMES[m % 12]}{m // 12 - 1}"

RULES = {  # semitones, (lower partial, upper partial)
    "P5": (7, 3, 2), "P4": (5, 4, 3), "M3": (4, 5, 4), "M6": (9, 5, 3),
    "m3": (3, 6, 5), "M10": (16, 5, 2), "P8": (12, 2, 1),
}

def beat(lo: str, kind: str) -> tuple[str, float, str]:
    semis, pl, pu = RULES[kind]
    hi = nm(midi(lo) + semis)
    d = pu * freq(hi) - pl * freq(lo)  # >0: upper partial sharp = interval wide
    return hi, abs(d), ("wide" if d > 1e-9 else "narrow" if d < -1e-9 else "pure")

def main():
    rows = []
    for kind in ["P4", "P5", "M3", "M6", "m3"]:
        for m in range(midi("F3"), midi("F4") + 1):
            lo = nm(m)
            hi, b, s = beat(lo, kind)
            if midi(hi) <= midi("A4") + (5 if kind == "M6" else 0):
                rows.append({"kind": kind, "lo": lo, "hi": hi, "beat": round(b, 3), "sense": s})
    if "--json" in sys.argv:
        print(json.dumps(rows, indent=1)); return
    for n in ["F3", "A3", "C4", "F4", "A4"]:
        print(f"{n} = {freq(n):.3f} Hz")
    cur = None
    for r in rows:
        if r["kind"] != cur:
            cur = r["kind"]; print(f"\n{cur}")
        print(f"  {r['lo']:>3}-{r['hi']:<3} {r['beat']:6.2f}  {r['sense']}")

if __name__ == "__main__":
    main()
