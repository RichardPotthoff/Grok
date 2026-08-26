# cutter-es6

Vanilla cookie-cutter designer. No Node, no bundler.

| File | What |
| --- | --- |
| `standalone.html` | Reference app: HTML chrome + `es6/` editor |
| `cutter_anyui.html` | Same app, chrome built from copied `anyui/` widgets |
| `cutter_anyui_main.js` | Programmatic widget tree (VBox / HBox / Button / …) |
| `anyui/` | Copied UI widgets (from the anyui project) |
| `es6/` | Turtle math, curve editor, WebGL cutter, app widgets |
| `cutter_widgets/` | Python anywidget twins (`_esm` → Pages `es6/*-widget.js`) |
| `cutter_anyui.ipynb` | Jupyter layout twin |
| `es6_html_to_iife_html.py` | Converter → single-file `index.html` |

`turtlePath` is `[length, angleDegrees]`.

Open `cutter_anyui.html` or `standalone.html` next to `es6/` and `anyui/`.
