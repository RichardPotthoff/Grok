# Reusable ES6 modules

Vanilla modules — no React, no bundler. Point `es6_html_to_iife_html.py` at
`/standalone.html` (or import these from Jupyter / marimo / Pythonista).

| File | Role |
| --- | --- |
| `turtle-graphics.js` | `Segments2Complex`, `TurtlePathLengthArea`, `plot_segments` |
| `geometry.js` | `cube`, `circle`, `extrude` |
| `m4.js` | Column-major camera / matrix math (`m4_cMaj`) |
| `cookiecutters.js` | Outline library (`Duck`, `Heart`, `Blade`, …) |
| `path-utils.js` | Degrees ↔ radians, epath, centroid, import/export |
| `curve-editor.js` | `CurveEditor` — touch-first turtle path canvas |
| `webgl-cutter.js` | `WebGLCutter` — extrude outline × fixed Blade |

`turtlePath` is always `[length, angleDegrees]`, same as the notebook and
`cookiecutters.json`.
