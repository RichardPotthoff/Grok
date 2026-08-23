function render({ model, el }) {
  // 1. Configure the el wrapper directly
  el.style.display = "flex";
  el.style.gap = "8px";
  el.style.alignItems = "center";
  el.style.fontFamily = "system-ui, sans-serif";
  el.style.width = model.get("layout")?.width || "100%";

  // 2. Create the three peer elements
  const description = document.createElement("label");
  description.style.fontSize = "0.9em";
  description.style.color = "#555";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.style.flex = "1";

  const readout = document.createElement("input");
  readout.type = "number";
  readout.style.width = "80px";

  // 3. Flat Append
  el.appendChild(description);
  el.appendChild(slider);
  el.appendChild(readout);

  const formatValue = (val) => {
    const fmt = model.get("readout_format") || ".2f";
    const decimals = parseInt(fmt.replace(/[^0-9]/g, "")) || 2;
    return parseFloat(val).toFixed(decimals);
  };

  const updateUI = () => {
    const isVert = model.get("orientation") === "vertical";
    const val = model.get("value") ?? 0;

    // Toggle flow on the wrapper itself
    el.style.flexDirection = isVert ? "column" : "row";

    description.textContent = model.get("description") || "";
    
    slider.min = model.get("min") ?? 0;
    slider.max = model.get("max") ?? 1.0;
    slider.step = model.get("step") || "any";
    slider.value = val;
    slider.style.writingMode = isVert ? "vertical-lr" : "";
    slider.style.direction = isVert ? "rtl" : "";
    slider.style.height = isVert ? "150px" : ""; // Give vertical some height

    readout.value = formatValue(val);
  };

  // Event Handlers
  const onSlider = () => {
    const v = parseFloat(slider.value);
    model.set("value", v);
    model.save_changes();
    readout.value = formatValue(v);
  };

  const onReadout = () => {
    let v = parseFloat(readout.value);
    if (isNaN(v)) return;
    v = Math.max(model.get("min"), Math.min(model.get("max"), v));
    model.set("value", v);
    model.save_changes();
    slider.value = v;
  };

  slider.addEventListener("input", onSlider);
  readout.addEventListener("change", onReadout);
  
  const traits = ["value", "min", "max", "step", "orientation", "description", "readout_format"];
  traits.forEach(t => model.on(`change:${t}`, updateUI));

  updateUI();

  // 4. Explicit Teardown
  return () => {
    traits.forEach(t => model.off(`change:${t}`, updateUI));
    slider.removeEventListener("input", onSlider);
    readout.removeEventListener("change", onReadout);
    
    // Remove individual elements to clear memory
    description.remove();
    slider.remove();
    readout.remove();
  };
}


export default {render};