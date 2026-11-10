# Drawing REPL — progress

Handoff for the next chat. Last updated 2026-11-04.

**Goal:** arc-only turtle. Primitive is the circular arc. Live geometry is `[[s, Δθ], …]` plus a start pose. The document is a tree of **blocks** (stream operators); flatten only to draw, hit-test, or export. 3D-printing extrusion paths are the goal.

**Source of truth:** `cutter-es6/` in this workspace and `RichardPotthoff/Grok` on `main`. Drawing REPL: `drawing_anyui.html`. Drawing reference: `drawing.html`. Cutter reference: `standalone.html`.

Pages: https://richardpotthoff.github.io/Grok/cutter-es6/drawing_anyui.html

Service worker: `cutter-offline-v47-20261110`. Hard-refresh after a deploy.

## Next conversation — performance for ESP32 / modded xs

The path generators will drive a 3D-printer extrusion path. The algorithm has to run in a memory-constrained environment (ESP32, modded xs). This conversation got long; start a new one on bottlenecks.

**What to look at first:**

- `arcs()` walk and `interface()`: allocations per yield, copy-on-write paint objects, repeat expansion.
- `ata` / `line` / `biarc`: temporary objects, the `rt` bounds search (repeated `solveCurve` probes), the `1e6` stand-in for an infinite radius.
- Paint walk in `drawing-ui.js` (`paintUse`): polyline sampling via `walkPath` is for the canvas only; the printer path should stay exact arcs.
- Anything that builds a full array where a stream would do.

Profile both allocation (GC pressure) and time. Keep the data model streamable.

## What landed since 2026-10-15

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
