from anywidget import AnyWidget
import traitlets as t
from pathlib import Path

class IntSlider(AnyWidget):
    value = t.Float(0.5).tag(sync=True)
    min = t.Float(0).tag(sync=True)
    max = t.Float(1.0).tag(sync=True)
    step = t.Float(0).tag(sync=True)
    orientation = t.Unicode("horizontal").tag(sync=True)
    
    _esm = Path(__file__).parent / "static" / "int-slider.js"
    _css = Path(__file__).parent / "static" / "int-slider.css"
