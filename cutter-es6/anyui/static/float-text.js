// anyui/static/int-text.js
function render({ model, el }) {

  const label = document.createElement("label");
  label.textContent = model.get("description") || "";
  label.style.minWidth = model.get("style")?.descriptionWidth  || "140px";
  label.style.textAlign = "right";

  const input = document.createElement("input");
  input.type = "number";
  input.step = model.get("step") ?? "any";    
  input.min =  model.get("min") ?? "any";     // floating point steps
  input.max =  model.get("max") ?? "any";     // floating point steps
  input.value = model.get("value") ?? 0.0;
  input.disabled = model.get("disabled") ?? false;
  input.style.flex = "1";
  input.style.minWidth = 0;
  input.style.boxSizing = "border-box";

  // Update model on input change
// Update model ONLY when the user finishes typing or leaves the field
  input.addEventListener("change", () => {
    let val = parseFloat(input.value);
    if (isNaN(val)) val = 0;
    model.set("value", val);
    model.save_changes();
  });


  // Sync model changes back to input
  model.on("change:value", () => {
    input.value = model.get("value");
  });

  model.on("change:description", () => {
    label.textContent = model.get("description") || "";
  });

  model.on("change:disabled", () => {
    input.disabled = model.get("disabled");
  });

  if (model.get("description")) {
    el.appendChild(label);
  }
  el.appendChild(input);
}

export default { render };