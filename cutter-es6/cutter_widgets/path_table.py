"""Python twin of es6/path-table-cls.js."""

from __future__ import annotations

import anywidget
import traitlets

from ._constants import PAGES_ES6, WIDGET_CSS


class PathTableWidget(anywidget.AnyWidget):
    _esm = f"{PAGES_ES6}/path-table.js"
    _css = WIDGET_CSS

    name = traitlets.Unicode("Custom").tag(sync=True)
    startPoint = traitlets.List(traitlets.Float(), default_value=[0.0, 0.0]).tag(sync=True)
    startAngle = traitlets.Float(0.0).tag(sync=True)
    turtlePath = traitlets.List(default_value=[]).tag(sync=True)
    selected_index = traitlets.Int(-1).tag(sync=True)
