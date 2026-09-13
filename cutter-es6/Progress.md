# Cookie cutter designer — progress

Handoff for the next chat. Last updated 2026-09-13 (Move / Tan split).

**Goal:** a turtle-path editor + WebGL blade preview. Only geometric primitive is the circular arc. Paths are `turtlePath = [[length, angleDegrees], …]` plus `startPoint`, `startAngle`, `name`.

**Source of truth:** this folder (`cutter-es6/`), also `RichardPotthoff/Grok` on `main`. Test in modular `standalone.html`. IIFE `index*.html` is stale until regenerated.

## What we achieved

### Close

- `es6/close-path.js`: G1 close as a **menu**, not one button.
- Default **Ends**: rewrite first + last arcs; middle `(s, Δθ)` unchanged. Same geometry as a wrap-around biarc.
- Also: **Tail** (last two), **Cap** (append two), **Spread** (`snapTurtle`), **Corner** (G0 last arc).

### Biarc math

- `es6/biarc.js` from `myrepo/BiArc.ipynb` (`compute_biarc`, `arc_from_chord`).
- Family parameter `p` (Kurnosenko) or through-point `P`. Default new pairs: `p = 1`. Vertex keeps each pair’s `p` while the shared pose moves.
- Tools are on-the-fly only. Commit is still `[s, Δθ]` + start pose. No extra path fields.
- Wrap-around (last + first) rewrites `startPoint` / `startAngle`.
- `p ≈ 0` and `p ≈ -1` are poles; editor nudges off them.
- `P` in the notebook **is** a point on one of the two arcs. **Thru is still deferred.**

### Editor chrome

Sidebar **beside** the canvas (not an overlay):

| View | Edit | Act | Header |
| --- | --- | --- | --- |
| Pan, Fit | Select, Add, Arc, p, Locus, Move, Tan | Close, Split, Ins, Del | Shape, Scale, Export, Kit |

- **Select** picks only. Empty drag pans after slop.
- **Add** is the only tool that shows the hollow `+` / appends.
- **Arc / Locus / Move / Tan** edit after ~10 px slop, with grab offset so the handle sits beside the finger.
- iOS: `user-select` / callout off, `maximum-scale=1`, canvas `touchstart` / `gesturestart` `preventDefault`.
- Highlight: Arc = 1 segment, p / Locus = 2, Move / Tan = 4.
- Split halves the selected arc (`s/2`, `Δθ/2`).
- `setTool("vertex")` still aliases to **Move**.

### Move + Tan (this thread)

- One Vert handle was doing two jobs; the stroke was a bigger hit target than the joint, so a tap retargeted the four-arc span.
- **Move** (`P`, keep `θ`) and **Tan** (heading, keep `P`) call the same `applyVertex`. Different handle only.
- **JOINT_LOCK** (`p`, `locus`, `move`, `tan`): a stroke tap does **not** change `joint`. A vertex hit still retargets. Empty space pans.
- Move draws a solid joint disc + faint heading tick (tick is not a grab). Tan draws the stem + hollow tick as the grab.

### Packaging (leave alone)

HTML apps, IIFE script, Carnets + Pages `_esm`, `cutter_widgets/`, Spin after drag — still as of 2026-08-26. Local `/files/` is a dead end. Do not merge `anyui/` into `es6/`.

## Open interaction issues

1. ~~Vert combines move and tangent.~~ Split into Move + Tan.
2. ~~Stroke tap steals the joint in those tools.~~ JOINT_LOCK.
3. **Thru** not in the rail. Next: bead *on* the pair; `compute_biarc(..., P=bead)` so the ink goes through the bead.
4. Single-arc **Len vs Turn** lock still not built. Arc is still 2-DOF `fitArc` to the offset point.
5. Insert still plants `[4, 0]`.
6. IIFE not regenerated after these edits.

## Next conversation — pick one

1. **Thru bead** on the two-arc span (`P` = point on an arc, as in the notebook).
2. **Arc Len / Turn** as separate tools (or radial vs tangential on the stem).
3. Only then: regenerate IIFE, push anyui fixes back, Marimo on the Pi.

Keep `standalone.html` as the reference.

## Layout (do not merge)

| Folder | Owns |
| --- | --- |
| `anyui/` | Copied general UI widgets |
| `es6/` | Turtle math, `CurveEditor`, `WebGLCutter`, widgets |
| `cutter_widgets/` | Python twins; `_esm` → Pages |

Math files: `es6/close-path.js`, `es6/biarc.js`, `es6/path-utils.js`. UI: `es6/curve-editor.js`.

Design notes in `artifacts/00-Overview.md` … `06-Open-Questions.md` (esp. `03-Interaction-Ideas.md`).
