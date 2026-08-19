# Reusable ES6 modules

Vanilla modules — no React, no bundler. GitHub Pages can serve them as-is.
Point `es6_html_to_iife_html.py` at `standalone.html`, or import from Jupyter / marimo / anyui.

| File | Role |
| --- | --- |
| `turtle-graphics.js` | `Segments2Complex`, `TurtlePathLengthArea`, `plot_segments` |
| `geometry.js` | `cube`, `circle`, `extrude` |
| `m4.js` | Column-major camera / matrix math (`m4_cMaj`) |
| `cookiecutters.js` | Outline library (`Duck`, `Heart`, `Blade`, …) |
| `path-utils.js` | Degrees ↔ radians, epath, centroid, import/export |
| `curve-editor.js` | `CurveEditor` — `setOutline`, `insertSegment`, `deleteSegment` |
| `webgl-cutter.js` | `WebGLCutter` — extrude outline × fixed Blade |
| `curve-editor-widget.js` | anywidget `_esm`: `render({ model, el })` |
| `webgl-cutter-widget.js` | anywidget `_esm`: `render({ model, el })` |

`turtlePath` is always `[length, angleDegrees]`, same as the notebook.

## CurveEditor

- Drag a **handle** to edit that segment (does not append).
- Drag the **red end-dot** to append a segment.
- Empty-canvas drag pans. Two-finger pinch zooms.
- `insertSegment()` / `deleteSegment()` — Delete removes the highlighted segment, or the last one if none is selected.

## anywidget

`curve-editor-widget.js` is the `_esm` entry. Model keys:

`turtlePath`, `startPoint`, `startAngle`, `name`, `selected_index`

`webgl-cutter-widget.js` also listens to `outlineScale`, `bladeScale`, `animate`.
