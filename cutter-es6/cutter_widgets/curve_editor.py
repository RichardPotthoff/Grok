"""Python twin of es6/curve-editor-cls.js."""

from __future__ import annotations

import anywidget
import traitlets

from ._constants import PAGES_ES6, WIDGET_CSS


class CurveEditorWidget(anywidget.AnyWidget):
    _esm = f"{PAGES_ES6}/curve-editor-widget.js"
    _css = WIDGET_CSS

    name = traitlets.Unicode("Custom").tag(sync=True)
    startPoint = traitlets.List(traitlets.Float(), default_value=[0.0, 0.0]).tag(sync=True)
    startAngle = traitlets.Float(0.0).tag(sync=True)
    turtlePath = traitlets.List(default_value=[]).tag(sync=True)
    selected_index = traitlets.Int(-1).tag(sync=True)

    def get_outline(self) -> dict:
        return {
            "name": self.name,
            "startPoint": list(self.startPoint),
            "startAngle": float(self.startAngle),
            "turtlePath": [list(seg) for seg in (self.turtlePath or [])],
        }

    def set_outline(self, outline: dict, *, keep_selection: bool = True) -> None:
        path = [list(seg) for seg in (outline.get("turtlePath") or [])]
        self.name = outline.get("name") or "Custom"
        self.startPoint = [float(x) for x in (outline.get("startPoint") or [0, 0])]
        self.startAngle = float(outline.get("startAngle") or 0)
        self.turtlePath = path
        n = len(path)
        if not keep_selection or self.selected_index >= n:
            self.selected_index = n - 1 if n else -1

    def insert_segment(self) -> int:
        path = [list(seg) for seg in (self.turtlePath or [])]
        n = len(path)
        i = self.selected_index
        at = (i + 1) if i >= 0 else n
        at = max(0, min(at, n))
        path.insert(at, [4.0, 0.0])
        self.turtlePath = path
        self.selected_index = at
        return at

    def delete_segment(self) -> int:
        path = [list(seg) for seg in (self.turtlePath or [])]
        n = len(path)
        if not n:
            self.selected_index = -1
            return -1
        i = self.selected_index if self.selected_index >= 0 else n - 1
        if i < 0 or i >= n:
            return self.selected_index
        path.pop(i)
        self.turtlePath = path
        self.selected_index = min(i, len(path) - 1) if path else -1
        return self.selected_index

    def fit(self) -> None:
        self.send({"cmd": "fit"})
