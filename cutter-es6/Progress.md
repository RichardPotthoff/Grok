# Cookie cutter designer — progress

Handoff notes so we can pick up here. Last updated 2026-08-27.

**Goal:** a turtle-path editor + WebGL blade preview. Only geometric primitive is the circular arc. Paths are `turtlePath = [[length, angleDegrees], …]` plus `startPoint`, `startAngle`, `name`.

**Source of truth:** this folder (`cutter-es6/`), also `RichardPotthoff/Grok` on `main`. Not the Node/TanStack host.

## What works now (tested)

| Surface | Status |
| --- | --- |
| `standalone.html` | Reference app. Unchanged by the notebook work. |
| `cutter_anyui.html` + `cutter_anyui_main.js` | Same editor, anyui chrome. |
| `index.html` / `index_anyui.html` | IIFE deployables (Safari / Pages). |
| `cutter_anyui.ipynb` on Carnets Plus | Working twin. Duck, Insert/Delete, Export, Fit, 3D follows path, **Spin restarts after a drag**. |
| Pages modules | `https://richardpotthoff.github.io/Grok/cutter-es6/es6/*.js` serve as `application/javascript` with CORS `*`. Carnets `import()` keys: `default,render`. |

Carnets workflow: **reload from disk** after pulling the `.ipynb`; **restart kernel** after changing `cutter_widgets/*.py`. Pages `_esm` is cached ~10 min after a push.

## Layout (do not merge these layers)

| Folder | Owns |
| --- | --- |
| `anyui/` | Copied general UI widgets (Box, HBox, VBox, Button, Dropdown, …). |
| `es6/` | Turtle math, `CurveEditor`, `WebGLCutter`, `*-widget.js` (anywidget render), `*-cls.js` (anyui class). |
| `cutter_widgets/` | Python twins of `es6/*-cls.js`. `_esm` → Pages widget URLs. |

Do **not** put layout chrome in `es6/` or turtle math in `anyui/`.

## Notebook `_esm` lesson (keep this)

anywidget `Path` / source string becomes a **blob URL**. Relative `import "./curve-editor.js"` does not resolve from a blob.

Carnets `/files/` and `/api/contents/` see a **different root** from the kernel `cwd`. Local `http://localhost:8888/files/es6/…` is 404 even when Python can read the file. Do not chase that.

Working pattern (same idea as anyui `box.py` + `static/box.js`):

```text
cutter_widgets/curve_editor.py   _esm = Pages …/curve-editor-widget.js
es6/curve-editor-cls.js          import _esm from "./curve-editor-widget.js"
```

IIFE bundle remains the **offline / deploy** path, not the notebook default.

## Spin (fixed 2026-08-26)

Drag called `WebGLCutter.setAnimate(false)` without updating the widget `animate` trait. Setting `animate = True` again was a no-op.

Now: drag writes `animate: false` back to the model; `viewer.spin()` sends `{cmd: "spin"}`; `setAnimate(true)` always starts a fresh RAF loop. HTML `WebGLCutterWidget.setAnimate` also forwards to `_view`.

## Editor behavior (current)

- Duck loads with the **last** segment selected.
- Tool strip on the path canvas: **Select / Add / Pan / Close**.
- Select: drag a handle to edit that segment; empty drag pans; pinch zooms.
- Add: drag empty space (or the hollow +) appends an arc from the current end.
- Pan: drag never edits.
- **Close** rewrites the last two arcs as a G1 biarc onto `startPoint` + `startAngle`. Already-closed paths are left alone. Canvas shows gap dashed line, heading ticks, and a `gap · Δθ` badge.
- Hollow **+** past the red end (or header **Insert**) still adds `[4, 0]` in Select.
- **Delete** / Backspace = remove the highlighted row (or the last if none).
- Table edits length/angle; 3D updates on change.
- **Export JSON** = outline object.
- Fit = `{cmd: "fit"}` to the canvas (view only).
- Notebook: `editor.close_path()` sends `{cmd: "close"}`. Insert/Delete still mutate Python `turtlePath` (do not also send insert/delete messages).

## Known nits

- Insert still drops in a dummy `[4, 0]` straight segment.
- Hitting the path body selects; it does not split a segment.
- Start-handle move of `startPoint` / `startAngle` not exposed.
- Append-two close is weak when the end heading already matches and the start is directly behind the turtle (adjust-two is the product path and works).
- Notebook `_esm` needs network + a published Pages tree (not the file you are mid-edit).
- IIFE HTML should be regenerated after `es6/` edits if you care about `index*.html` on Pages.

## Sensible next steps

Pick **one** thread per conversation. Suggested order for the drawing app (not packaging):

1. **Start-point / first-tangent handle.** Move `startPoint` and `startAngle` without inventing extra primitives. Green start dot is visible; it does not drag yet.
2. **Split-on-path and smarter Insert.** Tap the stroke to split an arc; stop inserting dummy `[4, 0]` as the only add gesture.
3. **Offset that stays exact-arc.** Parallel curve as another `turtlePath`. Needed later for cutter wall / blade; keep it geometric, not mesh.
4. **Regenerate IIFE** (`es6_to_iife_anyui.py`) so Pages `index_anyui.html` matches Close + tool strip.
5. **Copy anyui fixes back** to `RichardPotthoff/anyui` (Button click, Box fill, Dropdown cleanup, `loadCSS` href). Separate repo, separate conversation.
6. **Marimo twin** on the Pi, only after the editor feels like a drawing tool in HTML + Carnets.

Leave alone unless asked: Node/TanStack host, merging `anyui/` into `es6/`, Pythonista static server, bundling `_esm` in the notebook.

When you come back: this folder is source. Keep `standalone.html` as the reference until the anyui chrome is clearly better. Interaction and exact-arc operations first; packaging is done enough.
