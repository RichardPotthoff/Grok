# Cookie cutter designer — progress

Handoff for the next chat. Last updated 2026-09-14 (span overlay, seam collapse, log).

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
| Pan, Fit | Select, Add, Arc, p, Locus, Move, Tan | Close, Split, Ins, Del, Undo | Shape, Scale, Export, Kit |

- **Select** picks only. Empty drag pans after slop.
- **Add** is the only tool that shows the hollow `+` / appends.
- **Arc / Locus / Move / Tan** edit after ~10 px slop, with grab offset so the handle sits beside the finger.
- iOS: `user-select` / callout off, `maximum-scale=1`, canvas `touchstart` / `gesturestart` `preventDefault`.
- Highlight: Arc = 1 segment, p / Locus = 2, Move / Tan = 4.
- Split halves the selected arc (`s/2`, `Δθ/2`).
- `setTool("vertex")` still aliases to **Move**.

### Move + Tan

- **Move** (`P`, keep `θ`) and **Tan** (heading, keep `P`) call the same `applyVertex`.
- **JOINT_LOCK** (`p`, `locus`, `move`, `tan`): a stroke tap does **not** change `joint`.

### Seam collapse (fixed)

`applyVertex` used to write `startPoint = P` whenever arc 0 sat in the four-arc quad. That pinned the path start onto the moving joint and the drawing collapsed. Start is rewritten only when the joint **is** the seam (`j === 0` or `j === n`).

### Span overlay

Move / Tan / Locus / numeric p lift the 2 or 4 arcs into a linear snippet (`extractSpan`), edit that, paint it over the frozen base, then `commitSpan`. Wrap-around is in-order on the snippet. Same overlay is the place a later Möbius should run.

### p is not a perfect invariant

When the pair already lies on one circle the locus degenerates (`r → ∞`, recovered `p` hits the −1 pole). A tiny Tan then jumps to the long-way-around member. `applyVertexStable` treats pole `p` as 1, tries `{kept,1}×{kept,1}`, and rejects collapse / length explosion / turn flip. If every candidate fails, the snippet stays. Guard, not a theory.

### Log + undo

Each committed edit is a snapshot. Footer is **arc table | log**. Undo restores the previous snapshot (replay minus the last commit). Rejected swaps log as `reject`. Header Undo and `⌘Z` / `Ctrl+Z`.

### Packaging (leave alone)

HTML apps, IIFE script, Carnets + Pages `_esm`, `cutter_widgets/`, Spin after drag — still as of 2026-08-26. Local `/files/` is a dead end. Do not merge `anyui/` into `es6/`.

## Open interaction issues

1. ~~Vert combines move and tangent.~~ Split into Move + Tan.
2. ~~Stroke tap steals the joint.~~ JOINT_LOCK.
3. ~~Seam collapse when arc 0 is in the quad.~~ Overlay + seam guard.
4. **p / same-circle locus swap** still open. What should Move/Tan actually hold?
5. **Thru** not in the rail.
6. Single-arc **Len vs Turn** still not built.
7. Insert still plants `[4, 0]`.
8. IIFE not regenerated.

## Next conversation — pick one

1. Stay on the p / same-circle theory if it is still biting in testing.
2. **Thru bead** on the two-arc span.
3. **Arc Len / Turn**.
4. Only then IIFE / anyui / Marimo.

Keep `standalone.html` as the reference.

## Layout (do not merge)

| Folder | Owns |
| --- | --- |
| `anyui/` | Copied general UI widgets |
| `es6/` | Turtle math, `CurveEditor`, `WebGLCutter`, widgets |
| `cutter_widgets/` | Python twins; `_esm` → Pages |

Math files: `es6/close-path.js`, `es6/biarc.js`, `es6/path-utils.js`. UI: `es6/curve-editor.js`.

Design notes in `artifacts/00-Overview.md` … `06-Open-Questions.md` (esp. `03-Interaction-Ideas.md`).
