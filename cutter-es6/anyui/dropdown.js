function render({ model, el }) {
  el.classList.add("anyui-dropdown-container");

  const label = document.createElement("label");
  const select = document.createElement("select");
  select.style.flex = "1";
  select.style.minWidth = "0";
  select.style.boxSizing = "border-box";

  function applyLabel() {
    const text = model.get("description") || "";
    label.textContent = text;
    label.style.display = text ? "inline-block" : "none";
    const style = model.get("style") || {};
    label.style.minWidth = style.descriptionWidth || "auto";
    if (style.descriptionWidth) {
      label.style.width = style.descriptionWidth;
      label.style.textAlign = "right";
    }
  }

  function applyOptions() {
    const options = model.get("options") || [];
    const index = model.get("index") ?? 0;
    select.innerHTML = "";
    options.forEach((opt, idx) => {
      const optionEl = document.createElement("option");
      optionEl.value = String(idx);
      optionEl.textContent = String(opt);
      if (idx === index) optionEl.selected = true;
      select.appendChild(optionEl);
    });
    select.value = String(index);
  }

  applyLabel();
  applyOptions();

  select.addEventListener("change", () => {
    const options = model.get("options") || [];
    const newIndex = parseInt(select.value, 10);
    model.set("index", newIndex);
    model.set("value", options[newIndex]);
    model.save_changes();
  });

  model.on("change:description", applyLabel);
  model.on("change:style", applyLabel);
  model.on("change:options", applyOptions);
  model.on("change:index", applyOptions);

  el.appendChild(label);
  el.appendChild(select);

  return () => {
    model.off("change:description", applyLabel);
    model.off("change:style", applyLabel);
    model.off("change:options", applyOptions);
    model.off("change:index", applyOptions);
    el.innerHTML = "";
  };
}

export default { render };
