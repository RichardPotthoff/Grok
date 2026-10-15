# Cookie cutter designer — progress

Handoff for the next chat. Last updated 2026-10-15.

**Goal:** arc-only turtle editor. Primitive is the circular arc. Live *geometry walk* is still `[[s, Δθ], …]` plus start pose. The long-term *document* is a tree of **blocks** (stream operators); flatten only to draw, hit-test, or export. 3D-printing extrusion paths are the goal, not background.

**Source of truth:** `cutter-es6/` in this workspace and `RichardPotthoff/Grok` on `main` (`138e615`, 2026-10-14). Drawing REPL: `drawing_anyui.html`. Drawing reference: `drawing.html`. Cutter reference: `standalone.html`. Cutter anyui twin: `cutter_anyui.html`.

Pages: https://richardpotthoff.github.io/Grok/cutter-es6/drawing_anyui.html

## Next conversation (2026-10-15) — script editor UI

The REPL works. The chrome is being reworked for the iPad (landscape + onscreen keyboard).

**What landed this pass (2026-10-15):**

- New anyui `Collapsible` widget (`anyui/collapsible-cls.js`, `collapsible.js`, `collapsible.css`). Traits: `open`, `title`, `side` (`left`|`right`|`bottom`|`top`), `child`. Collapses to a thin rail; expands to show the child.
- `drawing_anyui_main.js` layout rewritten:
  - Compact top toolbar: title, Fit, Run, **Clear** (canvas only — store stays), Edit.
  - Stage row: Objects collapsible (left, closed by default), canvas, Log collapsible (right, closed by default).
  - Thin script bar under the canvas: script dropdown + Edit.
  - **Edit** enters full-screen script mode (Done / Run / dropdown / New / Close / Copy / examples / Help + the textarea filling the rest). Done returns to the preview layout.
- Nested `Tab`s removed. Script switching is a `Dropdown`.
- Clear Canvas button: sets `repl.uses = []` and republishes strokes. Does not touch script text or the store.

**Still open / iterative:**

- Virtual file system for scripts (save, run individually or from another script). Not started.
- Fine-tuning of the Collapsible rails and script mode on the real iPad (keyboard height, rail width, button density).
- Whether Objects/Log should be overlays instead of layout siblings when open.

**What to rethink, not patch:**

- Script pane must be able to take the whole screen while the keyboard is up. Preview is secondary during editing.
- Collapse or hide the canvas, object list, and log on demand. One control, not several header bars.
- anyui widgets stay (`Tab` / `VBox` / `HBox` / `Button`). Reactivity stays on the model. Do not go back to hand-built HTML chrome.
- Touch-first. No assumption of a hardware keyboard or a wide desktop.
- Keep the geometry API. The UI change is about space, not about blocks.

## Where the geometry stands

`es6/blocks.js` is the model. `es6/drawing-repl.js` is the `new Function` API. Scripts persist (`arc-drawing-repl-v2`); the store is global across Run. Several script tabs.

- Blocks: `Arc` `Seq` `Repeat` `Scale` `Mirror` `Reverse` `Offset` `Slice` `Ah` `Orbit` `Ref`.
- `arcs(ctx)` is a restartable generator. Reverse, mirror, scale, and offset are walk flags, XOR/composed down the tree. Do not flatten to implement them.
- `interface()` is the relative `(dx, dy, Δθ°)`. `length` / `area` / `arcCount` are lazy and keyed by the walk context. A repeat does not expand to count its length.
- A hinge (`s = 0`, `Δθ ≠ 0`) is kept. Offset may produce a negative arc length; that is the user’s problem to avoid, not a special case to drop.
- `Slice(of, from, to)` is a sub-path by arc length. Boundary arcs split as `[v−u, Δθ·(v−u)/s]`.
- `Offset(of, d)` is the parallel curve, `d` to the right.
- Each block caches a minimum enclosing circle in its own frame: `bound()` → `{cx, cy, r}`, also `.center` and `.radius`. A closed repeat centers it on the rotation center of one step; radius is the farthest crown of one copy, so the circle touches the path. `nearest(block, x, y)` prunes with that circle.
- REPL: `seg` `seq` `repeat` `reverse` `mirror` `scale` `offset` `slice` `store`/`define` `show` `circle` `nearest` `print`. `circle(b)` returns `{cx, cy, r, path, at}` so the circle can be shown.

Verified 2026-10-12: rounded square circle `(10, 14)` r `18.14` (touches four crowns); star6 circle `(0, 25.81)` r `39.35` (touches the tips).

## Deploy

- `es6_iife_drawing_anyui.py` bundles the drawing app. Pages workflow is `.github/workflows/deploy-pages.yaml`, manual (`workflow_dispatch`); the push trigger is commented out.
- `es6_to_iife_anyui.py` minifies (`minify=True`). CSS minifier uses the stylesheet just loaded, not the previous one (`138e615`).
- Working Copy / Textastic previews have unreliable Blob downloads. Prefer clipboard, Web Share, or Open in Safari.

## Still later
