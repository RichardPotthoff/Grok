import anywidget
import traitlets
from pathlib import Path

class FloatText(anywidget.AnyWidget):
    _esm = Path(__file__).parent / "static" / "float-text.js"
    _css = Path(__file__).parent / "static" / "float-text.css" 
    value = traitlets.Float(0.0).tag(sync=True)
    description = traitlets.Unicode("").tag(sync=True)
    disabled = traitlets.Bool(False).tag(sync=True)