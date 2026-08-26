"""Python twin of es6/webgl-cutter-cls.js."""

from __future__ import annotations

import anywidget
import traitlets

from ._constants import PAGES_ES6, WIDGET_CSS


class WebGLCutterWidget(anywidget.AnyWidget):
    _esm = f"{PAGES_ES6}/webgl-cutter-widget.js"
    _css = WIDGET_CSS

    name = traitlets.Unicode("Custom").tag(sync=True)
    startPoint = traitlets.List(traitlets.Float(), default_value=[0.0, 0.0]).tag(sync=True)
    startAngle = traitlets.Float(0.0).tag(sync=True)
    turtlePath = traitlets.List(default_value=[]).tag(sync=True)
    outlineScale = traitlets.Float(11.0).tag(sync=True)
    bladeScale = traitlets.Float(5.0).tag(sync=True)
    animate = traitlets.Bool(True).tag(sync=True)

    def set_outline(self, outline: dict, *, scale: float | None = None, blade_scale: float | None = None) -> None:
        self.name = outline.get("name") or "Custom"
        self.startPoint = [float(x) for x in (outline.get("startPoint") or [0, 0])]
        self.startAngle = float(outline.get("startAngle") or 0)
        self.turtlePath = [list(seg) for seg in (outline.get("turtlePath") or [])]
        if scale is not None:
            self.outlineScale = float(scale)
        if blade_scale is not None:
            self.bladeScale = float(blade_scale)
