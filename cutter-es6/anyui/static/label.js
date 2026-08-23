function render({ model, el }) {
  const label = document.createElement("label");
  label.textContent = model.get("value") || "";
  label.style.minWidth = "0px";
  label.style.textAlign = "left";

  model.on("change:value", () => label.textContent = model.get("value") || "");

  el.appendChild(label);
}

export default { render };