import anywidget
import traitlets
from pathlib import Path

class HTML(anywidget.AnyWidget):
    _esm = Path(__file__).parent / "static" /  "html.js"
    _css = Path(__file__).parent / "static" / "html.css"
    value = traitlets.Unicode("").tag(sync=True)