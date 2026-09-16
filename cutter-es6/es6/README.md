# Reusable ES6 modules

Vanilla modules — no React, no bundler. GitHub Pages can serve them as-is.

| File | Role |
| --- | --- |
| `turtle-graphics.js` | `Segments2Complex`, length/area |
| `geometry.js` | `extrude` |
| `m4.js` | Camera / matrices |
| `cookiecutters.js` | Outline library |
| `path-utils.js` | Degrees ↔ radians, epath, JSON |
| `curve-editor.js` | `CurveEditor` core |
| `drawing-doc.js` | Multi-stroke `{ name, paths }` document |
| `tool-icons.js` | Icon drawings + exact SVG `A` renderer |
| `path-xform.js` | Exact rotate / mirror / stitch |
| `turtle-cmd.js` | Stack tape (`ah`, `loop`, `seg`, `emit`, …) |
| `webgl-cutter.js` | `WebGLCutter` 3D preview |
| `curve-editor-widget.js` | anywidget `_esm` render |
| `webgl-cutter-widget.js` | anywidget `_esm` render |
| `curve-editor-cls.js` | anyui class wrapper (app-specific) |
| `webgl-cutter-cls.js` | anyui class wrapper (app-specific) |
| `path-table-cls.js` | Segment table widget (app-specific) |

Python twins for Jupyter (same defaults, `_esm` on Pages) live in `../cutter_widgets/`.

UI chrome widgets live in `../anyui/`, not here.

`turtlePath` is always `[length, angleDegrees]`.
