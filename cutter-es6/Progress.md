# Cookie cutter designer — progress

Handoff notes so we can pick up here. Last updated 2026-08-25.

**Goal:** a turtle-path editor + WebGL blade preview, reusable as ES6 modules (Marimo / Jupyter / anywidget) and as a single-file HTML via `es6_html_to_iife_html.py`. First product: cookie cutter.

Related:

- anyui layout (new): `cutter_anyui.html` + `cutter_anyui_main.js`
- reference chrome: `standalone.html`
- IIFE (standalone): `index.html`
- IIFE (anyui): `es6_to_iife_anyui.py` → `index_anyui.html`. CSS inlined from `@exclude-iife` `loadCSS` lines; IIFE side uses `@include-iife` `Promise.resolve()`.
- `css-loader.js` stays a module-only file (not bundled). Callers pass `new URL('./x.css', import.meta.url).href`.
- `loadModule` lives only in `widget-upgrader.js`. Demo: `anyui/upgrade-demo.html`.
- anyui project: https://github.com/RichardPotthoff/anyui

## Two layers (do not mix them up)

| Layer | What it is | Needed on the iPad? |
| --- | --- | --- |
| **Grok Build host** | Node + TanStack Start so the live preview can run | **No.** |
| **This folder (`cutter-es6/`)** | Vanilla ES6 + HTML | **Yes.** |

## Folder split (2026-08-24)

| Folder | Owns |
| --- | --- |
| `anyui/` | Copied general UI widgets (Box, HBox, VBox, Button, Dropdown, Label, Html, FloatText, …). Safe to edit locally; copy improvements back to the anyui repo later. |
| `es6/` | App core (turtle math, CurveEditor, WebGL cutter) and **app-specific** widgets (`curve-editor-cls.js`, `webgl-cutter-cls.js`, `path-table-cls.js`). |

Do **not** put layout chrome in `es6/` or turtle math in `anyui/`.

## Two UIs, same editor

| Entry | Chrome |
| --- | --- |
| `standalone.html` | Hand-written HTML elements. Stable reference. |
| `cutter_anyui.html` | Programmatic anyui widget tree (`cutter_anyui_main.js`). Stress-test for anyui. |

Both import the same `es6/curve-editor.js` and `es6/webgl-cutter.js`.

## Shared data model

`turtlePath` is always `[[length, angleDegrees], …]` plus `startPoint`, `startAngle`, `name`.

Degrees in storage/UI, radians in `Segments2Complex`. Canvas is y-up in world coords, flipped at draw time.

## Editor behavior (current)

- Duck loads with the **last** segment selected.
- Drag a **handle** = edit that segment (does not append).
- Empty drag = pan; pinch = zoom.
- Hollow **+** past the red end (or **Insert**) = add a segment.
- **Delete** / Backspace = remove the highlighted row (or the last one if none).
- Table edits length/angle; 3D updates on change.
- **Export JSON** = outline in notebook format.
- anyui version: layout is VBox / HBox / Button / Dropdown / FloatText. App widgets wrap the canvases.

## Known nits

- Copied anyui Button originally `alert()`ed on click — local copy now `model.send({ event: "click" })`.
- Insert after a delete still drops in `[4, 0]` (dummy straight segment).
- Hitting the path body selects; it does not split a segment.
- Closed-path / start-handle move of `startPoint` not exposed.

## Sensible next picks

1. Smoke `anyui/upgrade-demo.html` (custom tags + dynamic `import()`).
2. Jupyter / marimo notebook that recreates the same tree with ipywidgets + anywidgets (`cutter_anyui.ipynb` is a first sketch).
3. Copy useful anyui fixes (Button click, Box fill, Dropdown cleanup, `loadCSS` href, registry-only `getOrLoadClass`, `@include-iife` / `@exclude-iife`) back to the anyui repo.

When you come back: treat **this folder** as source. Ignore the Node host. Iterate the modules. Keep `standalone.html` until the anyui chrome feels better.
