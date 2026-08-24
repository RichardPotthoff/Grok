// static/html.js

function render({ model, el }) {
  el.innerHTML = model.get("value") || "";
  
  model.on("change:value", () => {
    el.innerHTML = model.get("value") || "";
  });
}

export default {render}