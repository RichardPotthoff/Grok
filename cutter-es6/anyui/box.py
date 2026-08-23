 
import anywidget
import traitlets
import ipywidgets
from pathlib import Path

class Box(anywidget.AnyWidget):
  _esm = Path(__file__).parent / "static" / "box.js"
  _css = Path(__file__).parent / "static" / "box.css"
  children = traitlets.List(traitlets.Instance(ipywidgets.DOMWidget)).tag(
      sync=True, **ipywidgets.widget_serialization
      )
  orientation = traitlets.Unicode("column").tag(sync=True)  # "column" or "row"
      
  