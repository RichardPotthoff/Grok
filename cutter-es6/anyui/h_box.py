 
import anywidget
import traitlets
import ipywidgets
from pathlib import Path

class HBox(anywidget.AnyWidget):
  #  _esm = Path(__file__).parent / "static" / "h-box.js"
  _esm = Path(__file__).parent / "static" / "box.js"
  _css = Path(__file__).parent / "static" / "h-box.css"
  children = traitlets.List(traitlets.Instance(ipywidgets.DOMWidget)).tag(
      sync=True, **ipywidgets.widget_serialization
      )
  orientation = traitlets.Unicode("row").tag(sync=False)  # "column" or "row"
      
  