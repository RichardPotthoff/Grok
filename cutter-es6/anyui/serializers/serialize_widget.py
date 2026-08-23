import json
import re
import ipywidgets as widgets

def to_kebab(name):
    # Standard CamelCase to kebab-case
    s = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1-\2', s).lower()

def serialize_widget(widget,level=0):
    class_name = widget.__class__.__name__
    tag = f"anyui-{to_kebab(class_name)}"
    
    important_keys = set(('key',)) #"key" is the name of the parameter that the widget controls
    if hasattr(widget, '_repr_keys'):
        important_keys.update(widget._repr_keys())
        
    noise = {'_model_module', '_model_module_version', '_view_module', '_view_name', 'msg_throttle'}
    # CRITICAL: Remove 'children' from the attribute loop!
    keys_to_serialize = (important_keys - noise) - {'children'}
    
    attributes = []
    
    # We still skip 'children' here to handle them recursively
    keys_to_serialize = (important_keys - noise) - {'children'}
    
    for key in keys_to_serialize:
        if not hasattr(widget, key):
            continue
        value = getattr(widget, key)
        
        # FIX: Explicitly check for get_state on non-main widgets
        # This converts Layout and DescriptionStyle objects into dicts
        if hasattr(value, 'get_state') and not isinstance(value, widgets.Box):
            # drop_defaults=True keeps the HTML clean
            value = value.get_state(drop_defaults=True)
            
        attr_name = key.replace('_', '-')
        
        # Now serialize the resulting dict/list to a JSON string
        if isinstance(value, (dict, list, tuple)):
            # ensure_ascii=False for UTF-8 safety as we discussed
            json_data = json.dumps(value, ensure_ascii=False)
            attributes.append(f"{attr_name}='{json_data}'")
        else:
            attributes.append(f'{attr_name}="{value}"')
            
    # Handle Nesting separately (This is where VBox/HBox children go)
    child_content = ""
    if hasattr(widget, 'children'):
        # This calls the function recursively for each child widget
        child_content = "\n".join([serialize_widget(c,level+1) for c in widget.children])
    if child_content == "":
      return f"{'  '*level}<{tag} {' '.join(attributes)}></{tag}>"
    else:
      return f"{'  '*level}<{tag} {' '.join(attributes)}>\n{child_content}\n{'  '*level}</{tag}>"
    
      

def layout_to_html(layout):
    return (
"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AnyUI Parser Test</title>
</head>
  <script type="module">
    import "../anyui/static/widget-upgrader.js";
  </script>
<body>
  <h1>UI – Parser Test</h1>
""" +
serialize_widget(layout) +
"""
</body>
</html>
"""
)