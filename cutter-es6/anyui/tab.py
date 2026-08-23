import anywidget
import traitlets
import ipywidgets
from pathlib import Path

class Tab(anywidget.AnyWidget):
    _esm = Path(__file__).parent / "static" / "tab.js"
    _css = Path(__file__).parent / "static" / "tab.css"

    titles = traitlets.List(traitlets.Unicode()).tag(sync=True)
    selected_index = traitlets.Int(0).tag(sync=True)
    children = traitlets.List(traitlets.Instance(ipywidgets.DOMWidget)).tag(
      sync=True, **ipywidgets.widget_serialization
      )    