# Cookie cutter designer — progress

Handoff notes so we can pick up here. Last updated 2026-08-19.

**Goal:** a turtle-path editor + WebGL blade preview, reusable as ES6 modules (Marimo / Jupyter / anywidget) and as a single-file HTML via `es6_html_to_iife_html.py`. First product: cookie cutter. Later: hingebot / 3D-print designer.

Related work on GitHub Pages:

- modular: https://richardpotthoff.github.io/Grok/cutter-es6/standalone.html
- IIFE (~39 kB): https://richardpotthoff.github.io/Grok/cutter-es6/index.html
- earlier turtle demo: https://richardpotthoff.github.io/Grok/modular.html
- anyui: https://github.com/RichardPotthoff/anyui
- cookiecutter notebook: https://github.com/RichardPotthoff/myrepo (cookiecutter.ipynb)
- hingebot notebook: https://github.com/RichardPotthoff/hingebot

## Two layers (do not mix them up)

| Layer | What it is | Needed on the iPad? |
| --- | --- | --- |
| **Grok Build host** | Node + TanStack Start in this sandbox so the live preview can run on port 8080 | **No.** `node_modules`, `src/`, `package.json` are only the preview engine. |
| **This folder (`cutter-es6/`)** | Vanilla ES6 + `standalone.html` | **Yes.** This is what belongs in Working Copy / GitHub Pages. |

In the Grok sandbox, `/` redirects to `/standalone.html`. The preview iframe may show a cookies warning (unused auth on the host) and may block **Download kit** until you maximize / open in a new tab.

## Shared data model

`turtlePath` is always `[[length, angleDegrees], …]` plus `startPoint`, `startAngle`, `name` — same as `cookiecutter.ipynb` / `cookiecutters.outlines`.

Degrees in storage/UI, radians in `Segments2Complex`. Canvas is y-up in world coords, flipped at draw time.

## ES6 modules (`es6/`)

| File | Role |
| --- | --- |
| `turtle-graphics.js` | `Segments2Complex`, length/area |
| `geometry.js` | `extrude(epath, bladeProfile)` |
| `m4.js` | Camera / matrices from the torus viewer |
| `cookiecutters.js` | Duck, Heart, Star, Blade, … |
| `path-utils.js` | Walk, fit-arc, epath, JSON |
| `curve-editor.js` | Touch editor class |
| `webgl-cutter.js` | Fixed-blade 3D preview |
| `curve-editor-widget.js` | anywidget `_esm`: `render({ model, el })` |
| `webgl-cutter-widget.js` | same for the 3D view |
| `download-kit.js` | In-page zip of this folder |

Blade profile is **fixed**. No brickwork editor. No G-code yet.

## Editor behavior (current)

- Duck loads with the **last** segment selected, so **Delete** works immediately.
- Drag a **handle** = edit that segment (does not append).
- Empty drag = pan; pinch = zoom.
- Hollow **+** past the red end (or **Insert**) = add a segment.
- **Delete** / Backspace = remove the highlighted row (or the last one if none).
- Table edits length/angle; 3D updates on change.
- **Export JSON** = outline in notebook format.
- **Download kit** = `cutter-es6.zip` (works in a top-level tab; often blocked inside the tiny preview iframe).

## What we explicitly did *not* do

- Bundle into one giant HTML here (use `es6_html_to_iife_html.py`).
- Replace fullcontrol / generate G-code.
- Variable blade / brickwork.
- Wrap as a published anywidget package — only the `_esm` adapters exist.
- Delete the Node host (that would kill the Grok preview).

## anywidget hook (next packaging step)

`curve-editor-widget.js` / `webgl-cutter-widget.js` match anyui’s contract:

- `render({ model, el })` → returns `cleanup`
- `model.get` / `set` / `save_changes` / `on("change:…")`

Keys: `turtlePath`, `startPoint`, `startAngle`, `name`, `selected_index`, plus `outlineScale` / `bladeScale` / `animate` on the 3D widget.

Point anyui `_esm` at those files; don’t wrap the geometry in React.

## Known nits

- Grok iframe: cookies banner and download blocked until maximize / new tab.
- Insert after a delete currently drops in `[4, 0]` (straight 4-unit segment) — dummy, not a fitted arc.
- Hitting the path body selects; it does not split a segment.
- Closed-path / area / start-handle move of `startPoint` not exposed.

## Sensible next picks

1. anywidget / anyui shell around these two widgets (Marimo + notebook).
2. Split-segment / join, and edit `startPoint` / `startAngle`.
3. Persist a design (JSON) — export already exists; load-from-file does not.
4. Later: hingebot layout (`test-capstan_layout.html`) using the same turtle model.
5. Much later: G-code from turtle paths.

When you come back: treat **this folder** as source, ignore Node, pull Pages from GitHub, iterate the modules, re-run the Python IIFE script for `index.html`.
