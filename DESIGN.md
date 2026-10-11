# Design: piano tuning guide

**Style in one line:** a technical drawing sheet. White paper, ink hairlines, a white
3D model with flat light, Geist + Geist Mono, near-square corners. Colour appears only
where it means something.

## Colour (meaning, not decoration)
| Token | Hex | Meaning |
|---|---|---|
| `--ink` | #141414 | text, primary buttons, edges |
| `--ink-2` | #545454 | secondary text, captions (7.5:1 on white) |
| `--rule` / `--rule-2` | #e3e3e3 / #cfcfcf | dividers, control borders |
| `--wash` | #f6f6f4 | grouped areas (target box, tips) |
| `--tune` / `--tune-fill` / `--tune-3d` | #1f4fd8 / #e3ebfd / #a6c0f6 | **the note you tune**: its chip, label, 3D key, string and pin, the mini-map key |
| `--ref` / `--ref-fill` / `--ref-3d` | #9a5400 / #fcf0d8 / #f6d38f | **the note you play with it** |
| felt (3D) | #b9897a | the temperament strip (muted, so it never reads as a warning) |
| check partners (3D, mini map) | #dde6fa / #4a5a85 | notes a key is checked against, in the Keys tab |
| tuner green / red | #0e7340 / #b8322a | locked in / far off (tuner only; "close" is ink) |

Rule: blue and amber never mean anything else; links, buttons, tabs and focus rings are ink. Red and green appear only on the tuner.

## Type
- Geist (UI, body) and Geist Mono (note names, numbers, labels on the 3D). Two weights: 400 and 600.
- Sizes: 13 (captions, mono labels), 17 (body and all secondary text), 22 (section heads, tuner title), 28 (step and Learn titles), 40 (big rate, note readouts). Big numbers and note names use Geist (no slashed zero).
- `tabular-nums` on every number; `text-wrap: balance` on headings, `pretty` on body.

## Shapes and controls
- Radius 6 px on controls, 16 px on sheets. Primary button = solid ink; secondary = white with a grey border.
- Every control is at least 44 x 44 px. `:active` scales 0.96, rows tint instead.
- Phone: no header bar. 3D stage (40 % of height; 30 % on Keys, 16 % on Tuner) + card + a footer
  (Back, step count, Next) + iOS tab bar. Detail opens in a bottom sheet you can drag down
  (glossary, sources, step list). Landscape puts the stage and the card side by side.
- Desktop (900 px and up): 3D stage on the left, a 400 to 500 px panel on the right, tabs as a
  segmented control in the header. Hover states on all controls; arrow keys step through
  steps and keys; Escape closes the sheet.

## 3D
- Orthographic camera, MeshToonMaterial with a 3-band gradient, ink edges at 0.72 (0.32 for
  the repeated hammers), strings as thin grey or copper lines.
- Only the current step's notes are coloured (blue / amber); notes already tuned turn light grey.
- Labels are HTML pills projected from 3D anchors: key labels hang below the keyboard, pin
  labels sit to the left of the pin.
