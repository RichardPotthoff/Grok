# Drawing REPL — progress

Handoff for the next chat. Last updated 2026-11-17.

**Goal:** arc-only turtle. Primitive is the circular arc. Live geometry is `[[s, Δθ], …]` plus a start pose. The document is a tree of **blocks** (stream operators); flatten only to draw, hit-test, or export. 3D-printing extrusion paths are the goal.

**Source of truth:** `cutter-es6/` in this workspace and `RichardPotthoff/Grok` on `main`. Drawing REPL: `drawing_anyui.html`. Drawing reference: `drawing.html`. Cutter reference: `standalone.html`.

Pages: https://richardpotthoff.github.io/Grok/cutter-es6/drawing_anyui.html

Service worker: `cutter-offline-v65-20261117`. Hard-refresh after a deploy.

## Next conversation — analytic intersect + ATA rebuild

Start here. New primitives in `es6/intersect.js` and `es6/ata.js`.

**What landed (2026-11-17):**

- `es6/intersect.js`: analytic `intersectCircleCircle`, `intersectCircleLine`, `intersectLineLine`, dispatcher `intersect`. Accepts `+0`/`-0` (point) and `±Infinity` (directed line). Optional pre-allocated buffer (8 numbers: two hits × (x,y,t0,t1)). Parameters may be negative (“behind”). No epsilon policy inside; tiny values returned as computed.
- `es6/ata.js`: `ataSigned(from, to, r0, rt, r1)` (senses from radius signs) and `ataBest(from, to, radii)` (enumerates admissible sign pairs / magnitudes, picks minimal total |Δθ|). Built on the intersect primitives. `radii` elements may be a number (both senses), `[rPos, rNeg]`, `0`, or `±Infinity`.
- Exposed in the REPL: `ataSigned`, `ataBest`, `intersectCC`, `intersectCL`, `intersectLL`, `intersect`.
- Test script: `test-ata.js` (paste into a script tab). One start pose, several end poses, various r0/rt/r1, visualizes a couple, and times N calls with buffer reuse.

**Open / rough edges (expected on first cut):**

- `ataSigned` now allocates a buffer when none is supplied (fixes the `buf[i*4]` crash).
- `rt=0` paths (line-line and circle-line) now emit the signed parameters returned by the intersection, with no extra `hypot` or sign fix-ups.
- Both-radii-infinite + `rt=0` uses the signed parameters from the line-line intersection (negative length when the end point lies behind the directed heading).
- Straight-middle (`rt=±Infinity`) and finite-rt fillet against a line remain incomplete.
- Sign-to-internal/external distance (`|rt ± r|`) needs a clean rule per combination.
- Caller still decides whether a returned `1e-16` length means zero.

**Use cases to exercise:**

- Layer slicing: intersect outline arcs with a horizontal line at height h (the extrusion-fill script).
- ATA construction via offset-circle intersection.
- Performance: buffer-reused intersect vs. object-creating ATA.

## What landed since 2026-11-04

### Print and Z (2026-11-09 … 2026-11-17)
...

**Reported bug (2026-11-17):** with `rt` set to `0`, the length of the second arc was not zero. The user expected a zero middle (or second) arc for that input.

**Current convention, which may be the bug:** in `ataCurve`, `Object.is(rt, 0)` selects `rtmax` and `Object.is(rt, -0)` selects `rtmin` — the extreme radii that still touch both circles with every arc length positive. A literal `0` is therefore not “no middle arc”; it is “largest valid radius.” `rt` omitted or non-finite keeps the tangent straight (`ataBlock`). Decide whether `+0`/`-0` should stay as the extremes, or whether `rt = 0` should collapse the middle arc to `s = 0`.

**Where to look:**

- `ata` / `ataArcs` / `ataCurve` / `ataBlock` / `solveCurve` / `buildCurve` / `rtBounds` in `es6/connector.js`.
- `rtBounds` probes `solveCurve` repeatedly (`v *= 0.6` from a 16× span). That search is also the hot-path cost.
- Infinite `r0`/`r1` still uses a `1e6` stand-in, then `flattenWide` collapses a huge radius to `Δθ = 0`.
- `ataArcs` only avoids allocation for the straight-tangent case. Other cases call `ata()` and copy out.
- End-pose check in `buildCurve` rejects a solution whose interface misses `(rx, ry, dh)` by more than `1e-3`. A near-miss can fall through to `ataBlock` and look like a wrong length.

Keep exact arcs. Prefer a closed form or a tighter bound over the probe loop. Profile both correctness (end pose, arc lengths, the `rt = 0` case) and allocation.

## What landed since 2026-11-04

### Print and Z (2026-11-09 … 2026-11-17)

- `gcode(block, printer)` streams G1 lines. `downloadGcode` shares the file alone (no title — a title became a second `text N.txt` on iPad). `show3D(block, printer)` builds the tube and opens the 3D rail.
- Z, bead width, and layer height ride on the arc extra: `seg(s, dθ, { z, hl, width })`. Volume is `width * hl * length`. A `Z` word is written only when it changes. No per-arc `z` falls back to `z0 + pitch * s`.
- Print example loads an explicit key (`await load("MeshCam/camMesh")`) and does not read the 2D page. `form()` is the dialog. `clear()` empties the page; the store stays.

### Page, load, and preview (2026-11-11 … 2026-11-17)

- One script owns the page. A Run leaves the page alone until that script calls `show`. `show` again to add drawings.
- `load(path)` is async. Use `await load("Script/name")`. A relative `store("name")` is saved as `script/name`. If the key is missing or its script was edited, `load` runs that script with `show` and `show3D` suppressed.
- Reload does not run scripts. The store is empty until something `load`s.
- 2D preview is a state machine: fill pass, then stroke pass, generator re-run on each redraw. Arcs are sampled straight into `lineTo`. Fit keeps only the two corners of the axis-aligned box, including arc crowns.
- `size(w, h)` sets the Fit window in world units.

### Slice, repeat, reuse (2026-11-08 … 2026-11-09)

- `slice(of, from, to)` treats `of` as periodic. Length is `to − from`. `repeat(of, n)` is that slice.
- `poseAt`, `ataArcs`, `arcsSlice`, and reused rows on `arcs(ctx, row)`. `walkCtx` / `emitArc` write into reused objects.

## Older notes

### Slice wraps (2026-11-08)

- `slice(of, from, to)` treats `of` as periodic. Length is `to − from` (not clipped). A finite range that crosses the end wraps; `*arcs` loops across the period boundary and splits the boundary arcs.
- `interface()` of a long prefix uses divmod against `of.length()` plus the one-period interface, so the cost is one period walk, not a walk of the whole distance. Full periods are composed by exponentiation.
- A non-finite `to` still means “to the end of one period” (old clip behaviour).
- Drop the `repeat(...)` wrapper when you only need a window of a closed outline. `slice(outline, lo, lo1).interface()` and `slice(outline, lo, lo1).arcs()` are enough.

### Print (2026-11-09)

- `gcode(block, printer)` streams G1 lines. `downloadGcode` writes them (save picker when available, else share/download). `preview3d` builds a rectangular tube and opens the 3D rail view.
- Printer object and the parameter dialog live in the `print` sample script (Files → Print). `form()` is the only new UI primitive.
- Z is `z0 + pitch * s`. pitch 0 is one flat layer.

### Hot-path reuse (2026-11-09)

- `block.poseAt(s, out)` writes the pose at arc length `s` into `out`. Period-aware.
- `ataArcs(from, to, r0, r1, rt, buf)` writes six numbers into a buffer. Straight-tangent case allocates no `Seq`.
- `block.arcsSlice(from, to, ctx, row)` is the wrapping window without a `Slice`. Pass `row` to reuse one array.
- `walkCtx(ctx, out)` and `emitArc(s, dθ, ctx, out)` write into a reused object. `arcs(ctx, row)` threads the row so a leaf yield allocates nothing after the first call.
- REPL exposes `ataArcs`.

### Repeat is a slice (2026-11-08)

- `repeat(of, n)` is implemented as a wrapping `slice(of, 0, n * of.length())`. Interface and arcs go through the same period/divmod path. Length, closed-area, arc-count, bound, and nearest shortcuts stay on `Repeat`.
- A large `n` no longer expands. Cost is one period plus a fast composition.

### UI (drawing_anyui)

- Icon-rail sidebars. Left: Files / hide. Right: Preview / Objects / Log / hide. Right views are multi-select; Preview and Log stack vertically when both are on. Collapsing the right rail gives the script the full remaining width. Run auto-opens the right rail on Preview.
- Files is a folder-mode tree (`anyui/tree.js`). Path-style script names. Rename on the editor and on a folder row. Selecting a script opens it in the same panel (Done / Run / Output on|off).
- Files is a folder-mode tree (`anyui/tree.js`). Path-style script names. Rename on the editor and on a folder row. Selecting a script opens it in the same panel (Done / Run / Output on|off).
- Rail icons are drawn with the arc API (`es6/rail-icons.js`) and rendered as SVG.
- Log pane: Copy and Clear.
- Zip backup: `es6/ZipEngine.js`. Files rail Download/Upload. Skips `__MACOSX` / AppleDouble. Share sheet preferred over the download attribute.
- Preview chrome: ~52px top padding when the page is an in-app WKWebView (Textastic / Working Copy), none in Safari.
- Stroke width: an explicit `width` is in drawing units. Omitted width is a hairline (~1 screen pixel) so small icons stay readable.
- Auto-run on reload only for scripts that previously finished successfully (`ok` flag). An infinite loop never returns, so it is not restarted. Editing a script clears the flag. Storage key still `arc-drawing-repl-v2`.

### Geometry (radians, array poses)

- Angles are radians in the blocks. `deg = π/180` is in the REPL. `interface()` returns `[dx, dy, Δθ]`.
- `asPose` accepts an array, a typed array, or `{dx, dy, dtheta}` and returns the array form.
- Connectors are separate functions, not one `connect` with a mode:
  - `line(from, to, extra?)` — turn, straight, turn.
  - `biarc(from, to, p=1, extra?)` — G1 biarc, `p` places the junction.
  - `ata(from, to, r0, r1, rt, extra?)` — arc, tangent, arc.
- Poses are `[x, y, θ]`. End pose matches the requested end exactly.

### ata

- `r0`, `r1` are signed radii (positive = left). Zero is allowed: both zero is the straight line; one zero is a point-to-circle tangent.
- `rt` curves the tangent (a third arc). Omitted or `±Infinity` keeps it straight. `+0` is `rtmax`, `-0` is `rtmin` (the extreme radii that still touch both circles). Out-of-range values clamp to the nearest valid radius of the same sign.
- `undefined` or `±Infinity` for `r0` or `r1` means that side is straight. Both straight with a finite `rt` is a fillet (rounded corner). One straight side is evaluated as a large finite radius (`1e6`) and the wide arc is collapsed to `Δθ = 0`, so it matches a large finite radius such as `1000`.
- Every arc length is positive: the turn is taken the long way when that is what keeps `s = r·Δθ ≥ 0`.
- A zero-length end arc leaves a biarc. That is a consequence, not a separate tool.

### Paint

- `paint(b, {stroke, width, fill, dash})` and `seg(s, dθ, fields)`. Lazy paint object, cached once per block per parent. `width: 0` is a move; `width: 0` plus `dash` draws a thin debug stroke.
- `extra` can be passed straight to `line` / `biarc` / `ata`, so a connector does not need a `paint` wrapper to hide a move.

### Scripts and store

- Scripts use a path as the name. `store(name, value)` accepts any value (not just blocks); a relative name is stored under the current script path. `load(path)` returns a value or the script's exports. `script` is the current path. Re-running a script replaces its previous exports.
- Storage key `arc-drawing-repl-v2`.

## Where the geometry stands

`es6/blocks.js` is the model. `es6/drawing-repl.js` is the `new Function` API. `es6/connector.js` is line / biarc / ata.

- Blocks: `Arc` `Seq` `Repeat` `Scale` `Mirror` `Reverse` `Offset` `Slice` `Ah` `Orbit` `Ref` `Paint`.
- `arcs(ctx)` is a restartable generator. Reverse, mirror, scale, and offset are walk flags. Do not flatten to implement them.
- `interface()` is `[dx, dy, Δθ]` in radians. `length` / `area` / `arcCount` are lazy. A repeat does not expand to count its length.
- `bound()` caches a minimum enclosing circle in the block's own frame.
- REPL: `seg` `seq` `repeat` `reverse` `mirror` `scale` `offset` `slice` `line` `biarc` `ata` `paint` `store`/`load` `show` `print`. `deg` converts degrees.

## Deploy

- Pages workflow is `.github/workflows/deploy-pages.yaml`, manual (`workflow_dispatch`).
- Working Copy / Textastic previews have unreliable Blob downloads. Prefer clipboard, Web Share, or Open in Safari.
- Bump `VERSION` in `sw.js` whenever app sources change.
