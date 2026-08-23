import ipywidgets as widgets
import json

def serialize_layout(widget):
    """Recursively converts a widget layout into a dictionary."""
    # Base metadata for every widget
    data = {
        "type": widget.__class__.__name__,
        "id": getattr(widget, 'model_id', str(id(widget)))
    }
    
    # Handle Container Widgets (VBox, HBox)
    if isinstance(widget, widgets.Box):
        data["children"] = [serialize_layout(c) for c in widget.children]
        data["layout_type"] = "vertical" if isinstance(widget, widgets.VBox) else "horizontal"

    # Handle Tab Widgets
    elif isinstance(widget, widgets.Tab):
        data["children"] = [serialize_layout(c) for c in widget.children]
        # Extract tab titles using the internal _titles map or get_title method
        data["titles"] = [widget.get_title(i) for i in range(len(widget.children))]

    # Handle Custom/AnyWidgets (Capture coordinates for your Canvas)
    elif hasattr(widget, 'trait_names'):
        traits = widget.trait_names()
        # Capture specific traits like 'x', 'y', 'value', etc.
        data["state"] = {t: getattr(widget, t) for t in traits if not t.startswith('_')}

    return data

# Usage:
# my_json_layout = serialize_layout(your_top_level_widget)
# with open("layout.json", "w") as f:
#     json.dump(my_json_layout, f, indent=4)
import ipywidgets as widgets

def deserialize_layout(data):
    """Recursively reconstructs a widget layout from a dictionary."""
    widget_type = data.get("type")
    
    # 1. Instantiate the widget class dynamically
    # Falls back to 'Box' if the specific type is missing
    widget_class = getattr(widgets, widget_type, widgets.Box)
    
    # 2. Reconstruct children if the widget is a container
    children = []
    if "children" in data:
        children = [deserialize_layout(c) for c in data["children"]]
    
    # 3. Handle specific widget initializations
    if widget_type in ["VBox", "HBox", "Box"]:
        return widget_class(children=children)
    
    elif widget_type == "Tab":
        tab = widget_class(children=children)
        # Restore tab titles using set_title
        if "titles" in data:
            for i, title in enumerate(data["titles"]):
                tab.set_title(i, title)
        return tab
    
    # 4. Handle AnyWidgets or basic widgets with 'state'
    elif "state" in data:
        # Filter out internal/private traits and pass to constructor
        state = {k: v for k, v in data["state"].items() if not k.startswith('_')}
        return widget_class(**state)
    
    return widget_class()

# To test your round-trip:
# reconstructed_ui = deserialize_layout(my_json_layout)
# display(reconstructed_ui)
def generate_jupyter_code(data, indent=0):
    """Recursively generates Python code string to reconstruct a Jupyter layout."""
    import ipywidgets as widgets
    
    ws = "    " * indent
    w_type = data.get("type", "Box")
    
    # 1. Handle Children first (Depth-first)
    child_codes = []
    if "children" in data:
        for i, child in enumerate(data["children"]):
            # Recursive call to get code for children
            child_codes.append(generate_jupyter_code(child, indent + 1))
    
    # 2. Build the constructor arguments
    args = []
    
    # Add children if they exist
    if child_codes:
        children_str = "[\n" + ",\n".join(child_codes) + f"\n{ws}]"
        args.append(f"children={children_str}")
    
    # Add titles for Tabs
    if w_type == "Tab" and "titles" in data:
        args.append(f"titles={data['titles']}")
        
    # Add state (traits) for custom/simple widgets
    if "state" in data:
        for k, v in data["state"].items():
            # Basic sanitization: format strings with quotes
            val = f"'{v}'" if isinstance(v, str) else v
            args.append(f"{k}={val}")

    # 3. Format the final constructor call
    arg_sep = f",\n{ws}    "
    return f"{ws}widgets.{w_type}(\n{ws}    {arg_sep.join(args)}\n{ws})"

# Example usage:
# layout_json = serialize_layout(original_widget)
# python_code = "import ipywidgets as widgets\n\nui = " + generate_jupyter_code(layout_json)
# print(python_code)
import ipywidgets as widgets

def serialize_to_live_html(top_widget, self_contained=True):
    def get_html(widget):
        tag_map = {'VBox': 'Box', 'HBox': 'Box', 'Tab': 'Tabs'}
        raw_name = widget.__class__.__name__
        tag = tag_map.get(raw_name, raw_name)
        
        # 1. Attributes
        attrs = []
        if tag == 'Box':
            attrs.append(f'direction="{"v" if raw_name == "VBox" else "h"}"')
        
        # Capture common traits
        for trait in ['x', 'y', 'width', 'height', 'label', 'min', 'max', 'value', 'id']:
            val = getattr(widget, trait, None)
            if val is not None: attrs.append(f'{trait}="{val}"')
        
        # 2. Children
        inner = ""
        if hasattr(widget, 'children'):
            if tag == 'Tabs':
                for i, child in enumerate(widget.children):
                    title = widget.get_title(i) or f"Tab {i}"
                    inner += f'\n<Tab label="{title}">{get_html(child)}</Tab>'
            else:
                for child in widget.children:
                    inner += f'\n{get_html(child)}'
        
        return f'<{tag} {" ".join(attrs)}>{inner}</{tag}>'

    html_content = get_html(top_widget)

    if not self_contained:
        return html_content

    # 3. The "Self-Contained" Shim (CSS + JS)
    shim = """
<style>
    /* Layout Basics */
    Box { display: flex; border: 1px solid #eee; padding: 5px; }
    Box[direction="v"] { flex-direction: column; }
    Box[direction="h"] { flex-direction: row; }
    Tabs { display: block; border: 2px solid #ccc; margin-top: 10px; }
    Tab { display: block; padding: 10px; border-top: 1px solid #ddd; }
    Tab::before { content: "Tab: " attr(label); font-weight: bold; display: block; color: #555; }
    Canvas { display: block; position: relative; background: #fafafa; border: 1px solid #999; overflow: hidden; }
    
    /* Missing Widget Placeholder */
    :not(Box):not(Tabs):not(Tab):not(Canvas):not(script):not(style) {
        display: inline-block;
        border: 2px dashed #ff9999;
        background: #fff5f5;
        min-width: 80px;
        min-height: 30px;
        padding: 5px;
        font-family: sans-serif;
        font-size: 11px;
    }
    :not(Box):not(Tabs):not(Tab):not(Canvas):not(script):not(style)::after {
        content: "<" local-name() "> " attr(label) " " attr(id);
        color: #cc0000;
    }
</style>

<script>
    // Absolute positioning for children of Canvas
    window.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('Canvas > *').forEach(el => {
            el.style.position = 'absolute';
            el.style.left = (el.getAttribute('x') || 0) + 'px';
            el.style.top = (el.getAttribute('y') || 0) + 'px';
        });
    });
</script>
    """
    return f"{html_content}\n{shim}"

def jupyter_to_html_pro(widget, self_contained=True):
    def get_html(widget):
        tag_map = {'VBox': 'Box', 'HBox': 'Box', 'Tab': 'Tabs'}
        raw_name = widget.__class__.__name__
        tag = tag_map.get(raw_name, raw_name)
        
        # 1. Capture ALL relevant traits automatically
        attrs = []
        if tag == 'Box':
            attrs.append(f'direction="{"v" if raw_name == "VBox" else "h"}"')
            
        # We filter for common functional traits found in your repr()
        interesting_traits = ['description', 'value', 'min', 'max', 'step', 'id', 'x', 'y', 'options']
        
        for trait in interesting_traits:
            if hasattr(widget, trait):
                val = getattr(widget, trait)
                if val is not None:
                    # Convert lists/tuples (like options) to strings
                    attr_val = str(val).replace('"', '&quot;')
                    attrs.append(f'{trait}="{attr_val}"')
        
        # 2. Recursive Children
        inner = ""
        if hasattr(widget, 'children'):
            if tag == 'Tabs':
                # Use 'titles' from the Tab widget specifically
                titles = getattr(widget, 'titles', [])
                for i, child in enumerate(widget.children):
                    title = titles[i] if i < len(titles) else f"Tab {i}"
                    inner += f'\n<Tab label="{title}">{get_html(child)}</Tab>'
            else:
                for child in widget.children:
                    inner += f'\n{get_html(child)}'
        
        return f'<{tag} {" ".join(attrs)}>{inner}</{tag}>'

    html_content = get_html(widget)

    if not self_contained:
        return html_content

    # 3. The "Self-Contained" Shim (CSS + JS)
    shim = """
<style>
    /* Layout Basics */
    Box { display: flex; border: 1px solid #eee; padding: 5px; }
    Box[direction="v"] { flex-direction: column; }
    Box[direction="h"] { flex-direction: row; }
    Tabs { display: block; border: 2px solid #ccc; margin-top: 10px; }
    Tab { display: block; padding: 10px; border-top: 1px solid #ddd; }
    Tab::before { content: "Tab: " attr(label); font-weight: bold; display: block; color: #555; }
    Canvas { display: block; position: relative; background: #fafafa; border: 1px solid #999; overflow: hidden; }
    
    /* Missing Widget Placeholder */
    :not(Box):not(Tabs):not(Tab):not(Canvas):not(script):not(style) {
        display: inline-block;
        border: 2px dashed #ff9999;
        background: #fff5f5;
        min-width: 80px;
        min-height: 30px;
        padding: 5px;
        font-family: sans-serif;
        font-size: 11px;
    }
    :not(Box):not(Tabs):not(Tab):not(Canvas):not(script):not(style)::after {
        content: "<" local-name() "> " attr(label) " " attr(id);
        color: #cc0000;
    }
</style>

<script>
    // Absolute positioning for children of Canvas
    window.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('Canvas > *').forEach(el => {
            el.style.position = 'absolute';
            el.style.left = (el.getAttribute('x') || 0) + 'px';
            el.style.top = (el.getAttribute('y') || 0) + 'px';
        });
    });
</script>
    """
    return get_html(widget) + shim


