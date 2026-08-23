import anywidget
import traitlets
from pathlib import Path

ButtonFlag=False

class Button(anywidget.AnyWidget):
    description = traitlets.Unicode("Click me!").tag(sync=True)

    _esm = Path(__file__).parent / "static" / "button.js"
    _css = Path(__file__).parent / "static" / "button.css"
    
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 1. Store your callback
        self._click_handlers = []
        
        # 2. Listen for 'msg:custom' from JS
        self.on_msg(self._handle_custom_msg)

    def _handle_custom_msg(self, content, buffers):
        print(f"Message received: {content}") # Debug print
        ButtonFlag=True
        if content.get("event") == "click":
            try:
                for handler in self._click_handlers:
                    handler(self)
            except Exception as e:
                print(f"Callback error: {e}")

    def on_click(self, callback):
        """Helper to register a callback."""
        self._click_handlers.append(callback)
        return callback

